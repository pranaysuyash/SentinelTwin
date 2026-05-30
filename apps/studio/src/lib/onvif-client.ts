import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const OnvifCredentialsSchema = z.object({
  address: z.string().url(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

export type OnvifCredentials = z.infer<typeof OnvifCredentialsSchema>;

export type OnvifConnectionState =
  | "disconnected"
  | "authenticating"
  | "probing_services"
  | "subscribing_events"
  | "streaming"
  | "error";

export type OnvifDeviceInformation = {
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  hardwareId: string;
};

type OnvifAuthScheme = "basic" | "digest" | "bearer" | "token" | null;

type ParsedOnvifAuthChallenge = {
  scheme: OnvifAuthScheme;
  realm: string | null;
  nonce: string | null;
  qop: string[];
  algorithm: string | null;
  opaque: string | null;
  stale: boolean | null;
};

export interface OnvifSession {
  sessionId: string;
  address: string;
  state: OnvifConnectionState;
  responseStatus: number | null;
  responseStatusText: string | null;
  authChallengeHeader: string | null;
  deviceInformation?: OnvifDeviceInformation;
  eventSubscriptionUri?: string;
  eventSubscriptionReference?: string;
  eventSubscriptionExpiresAt?: number;
  mediaUri?: string;
  lastHeartbeatAt: number;
}

export type OnvifProbeResult = {
  raw: string;
  responseStatus: number | null;
  responseStatusText: string | null;
  authChallengeHeader: string | null;
  session: OnvifSession;
};

const SOAP_DEVICE_INFORMATION_ENVELOPE = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body>
    <GetDeviceInformation xmlns="http://www.onvif.org/ver10/device/wsdl" />
  </s:Body>
</s:Envelope>`;

const SOAP_EVENT_SUBSCRIBE_ENVELOPE = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing" xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">
  <s:Body>
    <wsnt:Subscribe>
      <wsnt:ConsumerReference>
        <wsa:Address>http://www.w3.org/2005/08/addressing/anonymous</wsa:Address>
      </wsnt:ConsumerReference>
      <wsnt:InitialTerminationTime>PT1H</wsnt:InitialTerminationTime>
    </wsnt:Subscribe>
  </s:Body>
</s:Envelope>`;

const SOAP_EVENT_RENEW_ENVELOPE = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2">
  <s:Body>
    <wsnt:Renew>
      <wsnt:TerminationTime>PT1H</wsnt:TerminationTime>
    </wsnt:Renew>
  </s:Body>
</s:Envelope>`;

const SOAP_DEVICE_SOAPACTION = "http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation";
const SOAP_EVENT_SOAPACTION = "http://docs.oasis-open.org/wsn/b-2/NotificationProducer/Subscribe";
const SOAP_EVENT_RENEW_SOAPACTION = "http://docs.oasis-open.org/wsn/bw-2/SubscriptionManager/RenewRequest";
const DEFAULT_EVENT_SUBSCRIPTION_TTL_MS = 60 * 60 * 1000;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findXmlTagText(block: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${escapeRegExp(tagName)}>`, "i");
    const match = block.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

function findXmlAttribute(block: string, attributeNames: string[]) {
  for (const attributeName of attributeNames) {
    const doubleQuoted = new RegExp(`\\b${escapeRegExp(attributeName)}="([^"]+)"`, "i");
    const singleQuoted = new RegExp(`\\b${escapeRegExp(attributeName)}='([^']+)'`, "i");
    const doubleMatch = block.match(doubleQuoted)?.[1]?.trim();
    if (doubleMatch) return doubleMatch;
    const singleMatch = block.match(singleQuoted)?.[1]?.trim();
    if (singleMatch) return singleMatch;
  }
  return null;
}

function parseDeviceInformation(raw: string): OnvifDeviceInformation | null {
  const manufacturer = findXmlTagText(raw, ["Manufacturer", "Vendor"]) ?? findXmlAttribute(raw, ["manufacturer", "vendor"]);
  const model = findXmlTagText(raw, ["Model", "ProductModel"]) ?? findXmlAttribute(raw, ["model", "productModel"]);
  const firmwareVersion = findXmlTagText(raw, ["FirmwareVersion", "Firmware", "Version"]) ?? findXmlAttribute(raw, ["firmwareVersion", "firmware", "version"]);
  const serialNumber = findXmlTagText(raw, ["SerialNumber", "Serial", "DeviceSerialNumber"]) ?? findXmlAttribute(raw, ["serialNumber", "serial", "deviceSerialNumber"]);
  const hardwareId = findXmlTagText(raw, ["HardwareId", "Hardware", "DeviceHardwareId"]) ?? findXmlAttribute(raw, ["hardwareId", "hardware", "deviceHardwareId"]);

  if (!manufacturer && !model && !firmwareVersion && !serialNumber && !hardwareId) return null;

  return {
    manufacturer: manufacturer ?? "Unknown manufacturer",
    model: model ?? "Unknown model",
    firmwareVersion: firmwareVersion ?? "Unknown firmware",
    serialNumber: serialNumber ?? "Unknown serial",
    hardwareId: hardwareId ?? "Unknown hardware",
  };
}

function parseOnvifUri(raw: string, tagNames: string[]) {
  const tagValue = findXmlTagText(raw, tagNames);
  if (tagValue) {
    if (tagValue.includes("<") && tagValue.includes(">")) {
      return findXmlTagText(tagValue, ["Address", "Uri", "URL", "XAddr"]) ?? tagValue;
    }
    return tagValue;
  }
  return findXmlAttribute(raw, tagNames) ?? findXmlTagText(raw, ["Address", "Uri", "URL", "XAddr"]) ?? null;
}

function splitAuthChallengeParameters(input: string) {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let escaped = false;

  for (const character of input) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (character === "\"") {
      current += character;
      quoted = !quoted;
      continue;
    }
    if (character === "," && !quoted) {
      if (current.trim().length > 0) parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

function parseAuthChallengeHeader(header: string | null | undefined): ParsedOnvifAuthChallenge {
  if (!header) {
    return {
      scheme: null,
      realm: null,
      nonce: null,
      qop: [],
      algorithm: null,
      opaque: null,
      stale: null,
    };
  }
  const trimmed = header.trim();
  const schemeText = (trimmed.match(/^(\S+)/)?.[1] ?? "").toLowerCase();
  const scheme =
    schemeText === "basic" || schemeText === "digest" || schemeText === "bearer" || schemeText === "token"
      ? schemeText
      : null;
  const parameterText = trimmed.slice(trimmed.indexOf(" ") + 1).trim();
  const parameters = new Map<string, string>();
  for (const part of splitAuthChallengeParameters(parameterText)) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = part.slice(0, separatorIndex).trim().toLowerCase();
    let value = part.slice(separatorIndex + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }
    if (key) parameters.set(key, value);
  }
  return {
    scheme,
    realm: parameters.get("realm")?.trim() || null,
    nonce: parameters.get("nonce")?.trim() || null,
    qop: parameters.get("qop")?.split(",").map((item) => item.trim()).filter(Boolean) ?? [],
    algorithm: parameters.get("algorithm")?.trim() || null,
    opaque: parameters.get("opaque")?.trim() || null,
    stale: parameters.get("stale") ? parameters.get("stale") === "true" : null,
  };
}

function encodeBasicAuth(username: string, password: string) {
  const text = `${username}:${password}`;
  if (typeof btoa === "function") {
    return btoa(text);
  }
  return Buffer.from(text, "utf8").toString("base64");
}

function escapeAuthHeaderValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function buildBasicAuthorizationHeader(credentials: OnvifCredentials) {
  if (!credentials.username || !credentials.password) return null;
  return `Basic ${encodeBasicAuth(credentials.username, credentials.password)}`;
}

function buildOnvifHeaders(authorizationHeader: string | null = null, extraHeaders: HeadersInit = {}): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/soap+xml, application/xml, text/xml, */*;q=0.1",
    "content-type": "application/soap+xml; charset=utf-8",
    soapaction: SOAP_DEVICE_SOAPACTION,
  };
  if (authorizationHeader) {
    headers.authorization = authorizationHeader;
  }
  return {
    ...headers,
    ...extraHeaders,
  };
}

function buildOnvifRequestPath(address: string) {
  const url = new URL(address);
  const path = `${url.pathname || "/"}${url.search || ""}`;
  return path.length > 0 ? path : "/";
}

function md5Hex(input: string) {
  return createHash("md5").update(input, "utf8").digest("hex");
}

function buildDigestAuthorizationHeader(credentials: OnvifCredentials, challenge: ParsedOnvifAuthChallenge, address: string, method = "POST") {
  if (!credentials.username || !credentials.password) return null;
  if (!challenge.realm || !challenge.nonce) return null;

  const algorithm = (challenge.algorithm ?? "MD5").toUpperCase();
  if (algorithm !== "MD5" && algorithm !== "MD5-SESS") return null;

  const qop = challenge.qop.includes("auth") ? "auth" : null;
  if (challenge.qop.length > 0 && !qop) return null;

  const requestPath = buildOnvifRequestPath(address);
  const cnonce = randomBytes(16).toString("hex");
  const nonceCount = "00000001";
  const ha1Base = md5Hex(`${credentials.username}:${challenge.realm}:${credentials.password}`);
  const ha1 = algorithm === "MD5-SESS"
    ? md5Hex(`${ha1Base}:${challenge.nonce}:${cnonce}`)
    : ha1Base;
  const ha2 = md5Hex(`${method.toUpperCase()}:${requestPath}`);
  const response = qop
    ? md5Hex(`${ha1}:${challenge.nonce}:${nonceCount}:${cnonce}:${qop}:${ha2}`)
    : md5Hex(`${ha1}:${challenge.nonce}:${ha2}`);
  const authorization = [
    `Digest username="${escapeAuthHeaderValue(credentials.username)}"`,
    `realm="${escapeAuthHeaderValue(challenge.realm)}"`,
    `nonce="${escapeAuthHeaderValue(challenge.nonce)}"`,
    `uri="${escapeAuthHeaderValue(requestPath)}"`,
    `response="${response}"`,
    `algorithm=${algorithm === "MD5-SESS" ? "MD5-sess" : "MD5"}`,
  ];

  if (challenge.opaque) {
    authorization.push(`opaque="${escapeAuthHeaderValue(challenge.opaque)}"`);
  }
  if (qop) {
    authorization.push(`qop=${qop}`);
    authorization.push(`nc=${nonceCount}`);
    authorization.push(`cnonce="${cnonce}"`);
  }

  return authorization.join(", ");
}

function parseOnvifTimestamp(raw: string, tagNames: string[]) {
  const value = findXmlTagText(raw, tagNames);
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseEventSubscriptionResponse(raw: string) {
  return {
    eventSubscriptionReference: parseOnvifUri(raw, ["SubscriptionReference", "Address", "Uri", "XAddr"]),
    eventSubscriptionExpiresAt: parseOnvifTimestamp(raw, ["TerminationTime", "Expires", "ExpirationTime"]),
  };
}

function createSession(credentials: OnvifCredentials): OnvifSession {
  return {
    sessionId: crypto.randomUUID(),
    address: credentials.address,
    state: "disconnected",
    responseStatus: null,
    responseStatusText: null,
    authChallengeHeader: null,
    lastHeartbeatAt: 0,
  };
}

export class OnvifClient {
  private readonly credentials: OnvifCredentials;

  private session: OnvifSession;

  constructor(credentials: OnvifCredentials) {
    this.credentials = credentials;
    this.session = createSession(credentials);
  }

  public getSession(): OnvifSession {
    return {
      ...this.session,
      deviceInformation: this.session.deviceInformation ? { ...this.session.deviceInformation } : undefined,
    };
  }

  private async probeAuthenticatedOnvifRequest(targetUrl: string, body: string, soapAction: string) {
    const hasCredentials = Boolean(this.credentials.username && this.credentials.password);
    const initialAttempt = await fetch(targetUrl, {
      method: "POST",
      headers: buildOnvifHeaders(null, { soapaction: soapAction }),
      body,
    });

    const initialRaw = (await initialAttempt.text()).trim();
    const initialAuthChallengeHeader = initialAttempt.headers.get("www-authenticate");
    const initialChallenge = parseAuthChallengeHeader(initialAuthChallengeHeader);

    let response = initialAttempt;
    let raw = initialRaw;
    let authChallengeHeader = initialAuthChallengeHeader;

    if ((response.status === 401 || response.status === 403) && hasCredentials) {
      const authorizationHeader = initialChallenge.scheme === "digest"
        ? buildDigestAuthorizationHeader(this.credentials, initialChallenge, targetUrl) ?? buildBasicAuthorizationHeader(this.credentials)
        : buildBasicAuthorizationHeader(this.credentials);

      if (authorizationHeader) {
        const retryAttempt = await fetch(targetUrl, {
          method: "POST",
          headers: buildOnvifHeaders(authorizationHeader, { soapaction: soapAction }),
          body,
        });
        response = retryAttempt;
        raw = (await retryAttempt.text()).trim();
        authChallengeHeader = authChallengeHeader ?? retryAttempt.headers.get("www-authenticate");
      }
    }

    return {
      response,
      raw,
      authChallengeHeader,
    };
  }

  private updateSessionFromEventSubscriptionAttempt(
    attempt: { response: Response; raw: string; authChallengeHeader: string | null },
    targetUrl: string,
    eventSubscriptionUri: string | null,
  ) {
    const parsedSubscription = parseEventSubscriptionResponse(attempt.raw);
    const nextEventSubscriptionUri = attempt.response.ok
      ? this.session.eventSubscriptionUri ?? eventSubscriptionUri ?? targetUrl ?? undefined
      : this.session.eventSubscriptionUri ?? undefined;
    const nextEventSubscriptionReference = attempt.response.ok
      ? parsedSubscription.eventSubscriptionReference ?? this.session.eventSubscriptionReference ?? undefined
      : this.session.eventSubscriptionReference ?? undefined;
    const nextEventSubscriptionExpiresAt = attempt.response.ok
      ? parsedSubscription.eventSubscriptionExpiresAt ?? this.session.eventSubscriptionExpiresAt ?? (Date.now() + DEFAULT_EVENT_SUBSCRIPTION_TTL_MS)
      : this.session.eventSubscriptionExpiresAt ?? undefined;
    this.session = {
      ...this.session,
      state: attempt.response.ok ? "streaming" : "error",
      responseStatus: attempt.response.status,
      responseStatusText: attempt.response.statusText || null,
      authChallengeHeader: attempt.authChallengeHeader,
      eventSubscriptionUri: nextEventSubscriptionUri,
      eventSubscriptionReference: nextEventSubscriptionReference,
      eventSubscriptionExpiresAt: nextEventSubscriptionExpiresAt,
      lastHeartbeatAt: Date.now(),
    };
    return this.getSession();
  }

  public async connect(): Promise<OnvifProbeResult> {
    this.session.state = "authenticating";

    const deviceAttempt = await this.probeAuthenticatedOnvifRequest(
      this.credentials.address,
      SOAP_DEVICE_INFORMATION_ENVELOPE,
      SOAP_DEVICE_SOAPACTION,
    );

    let response = deviceAttempt.response;
    let raw = deviceAttempt.raw;
    let authChallengeHeader = deviceAttempt.authChallengeHeader;

    this.session.state = "probing_services";

    const deviceInformation = parseDeviceInformation(raw);
    const eventSubscriptionUri = parseOnvifUri(raw, ["EventSubscriptionUri", "SubscriptionReference", "PullPointUri", "EventsUri", "XAddr"]);
    const mediaUri = parseOnvifUri(raw, ["MediaUri", "StreamUri", "XAddr", "Uri"]);
    let eventSubscriptionReference: string | null = null;
    let eventSubscriptionExpiresAt: number | null = null;

    if (response.ok && eventSubscriptionUri) {
      this.session.state = "subscribing_events";
      const eventAttempt = await this.probeAuthenticatedOnvifRequest(
        eventSubscriptionUri,
        SOAP_EVENT_SUBSCRIBE_ENVELOPE,
        SOAP_EVENT_SOAPACTION,
      );
      response = eventAttempt.response;
      raw = `${raw}\n${eventAttempt.raw}`.trim();
      authChallengeHeader = authChallengeHeader ?? eventAttempt.authChallengeHeader;
      const parsedSubscription = parseEventSubscriptionResponse(eventAttempt.raw);
      eventSubscriptionReference = parsedSubscription.eventSubscriptionReference;
      eventSubscriptionExpiresAt = parsedSubscription.eventSubscriptionExpiresAt;
    }

    const connected = response.ok;
    this.session = {
      ...this.session,
      state: connected ? "streaming" : "error",
      responseStatus: response.status,
      responseStatusText: response.statusText || null,
      authChallengeHeader,
      deviceInformation: deviceInformation ?? undefined,
      eventSubscriptionUri: eventSubscriptionUri ?? undefined,
      eventSubscriptionReference: eventSubscriptionReference ?? undefined,
      eventSubscriptionExpiresAt: eventSubscriptionExpiresAt ?? undefined,
      mediaUri: mediaUri ?? undefined,
      lastHeartbeatAt: connected ? Date.now() : 0,
    };

    return {
      raw,
      responseStatus: response.status,
      responseStatusText: response.statusText || null,
      authChallengeHeader,
      session: this.getSession(),
    };
  }

  public async renewEventSubscription(
    targetUrl = this.session.eventSubscriptionReference ?? this.session.eventSubscriptionUri ?? null,
    eventSubscriptionUri: string | null = this.session.eventSubscriptionUri ?? null,
  ): Promise<OnvifProbeResult | null> {
    const renewalTarget = typeof targetUrl === "string" && targetUrl.trim().length > 0 ? targetUrl.trim() : null;
    if (!renewalTarget) {
      return null;
    }

    this.session.state = "subscribing_events";
    const renewalAttempt = await this.probeAuthenticatedOnvifRequest(
      renewalTarget,
      SOAP_EVENT_RENEW_ENVELOPE,
      SOAP_EVENT_RENEW_SOAPACTION,
    );

    const session = this.updateSessionFromEventSubscriptionAttempt(renewalAttempt, renewalTarget, eventSubscriptionUri);
    return {
      raw: renewalAttempt.raw,
      responseStatus: renewalAttempt.response.status,
      responseStatusText: renewalAttempt.response.statusText || null,
      authChallengeHeader: renewalAttempt.authChallengeHeader,
      session,
    };
  }

  public async disconnect(): Promise<void> {
    this.session = {
      ...this.session,
      state: "disconnected",
      lastHeartbeatAt: Date.now(),
    };
  }

  public heartbeat(): void {
    if (this.session.state === "streaming") {
      this.session = {
        ...this.session,
        lastHeartbeatAt: Date.now(),
      };
    }
  }
}

export function summarizeOnvifDeviceInformation(deviceInformation: OnvifDeviceInformation | null | undefined) {
  if (!deviceInformation) return null;
  return [
    deviceInformation.manufacturer,
    deviceInformation.model,
    deviceInformation.firmwareVersion,
    deviceInformation.serialNumber,
    deviceInformation.hardwareId,
  ].join(" · ");
}
