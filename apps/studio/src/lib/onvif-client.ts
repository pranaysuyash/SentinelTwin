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

export interface OnvifSession {
  sessionId: string;
  address: string;
  state: OnvifConnectionState;
  responseStatus: number | null;
  responseStatusText: string | null;
  authChallengeHeader: string | null;
  deviceInformation?: OnvifDeviceInformation;
  eventSubscriptionUri?: string;
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

function parseAuthChallengeHeader(header: string | null | undefined): { scheme: "basic" | "digest" | "bearer" | "token" | null; realm: string | null } {
  if (!header) return { scheme: null, realm: null };
  const trimmed = header.trim();
  const schemeText = (trimmed.match(/^(\S+)/)?.[1] ?? "").toLowerCase();
  const scheme =
    schemeText === "basic" || schemeText === "digest" || schemeText === "bearer" || schemeText === "token"
      ? schemeText
      : null;
  const realmMatch = trimmed.match(/realm="?([^",]+)"?/i);
  return {
    scheme,
    realm: realmMatch?.[1]?.trim() || null,
  };
}

function encodeBasicAuth(username: string, password: string) {
  const text = `${username}:${password}`;
  if (typeof btoa === "function") {
    return btoa(text);
  }
  return Buffer.from(text, "utf8").toString("base64");
}

function buildOnvifHeaders(credentials: OnvifCredentials, extraHeaders: HeadersInit = {}): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/soap+xml, application/xml, text/xml, */*;q=0.1",
    "content-type": "application/soap+xml; charset=utf-8",
    soapaction: "http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation",
  };
  if (credentials.username && credentials.password) {
    headers.authorization = `Basic ${encodeBasicAuth(credentials.username, credentials.password)}`;
  }
  return {
    ...headers,
    ...extraHeaders,
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

  public async connect(): Promise<OnvifProbeResult> {
    this.session.state = "authenticating";

    const response = await fetch(this.credentials.address, {
      method: "POST",
      headers: buildOnvifHeaders(this.credentials),
      body: SOAP_DEVICE_INFORMATION_ENVELOPE,
    });

    this.session.state = "probing_services";

    const raw = (await response.text()).trim();
    const deviceInformation = parseDeviceInformation(raw);
    const eventSubscriptionUri = parseOnvifUri(raw, ["EventSubscriptionUri", "SubscriptionReference", "PullPointUri", "EventsUri", "XAddr"]);
    const mediaUri = parseOnvifUri(raw, ["MediaUri", "StreamUri", "XAddr", "Uri"]);
    const authChallengeHeader = response.headers.get("www-authenticate");
    const challenge = parseAuthChallengeHeader(authChallengeHeader);

    const connected = response.ok;
    this.session = {
      ...this.session,
      state: connected
        ? "streaming"
        : challenge.scheme
          ? "error"
          : deviceInformation
            ? "error"
            : "error",
      responseStatus: response.status,
      responseStatusText: response.statusText || null,
      authChallengeHeader,
      deviceInformation: deviceInformation ?? undefined,
      eventSubscriptionUri: eventSubscriptionUri ?? undefined,
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
