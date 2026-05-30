import { z } from "zod";

import { OnvifClient, summarizeOnvifDeviceInformation, type OnvifDeviceInformation } from "@/lib/onvif-client";

type CameraLiveConnectionMode = "rtsp" | "mjpeg" | "http" | "onvif" | "proxy";
type CameraLiveConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type CameraLiveAuthMode =
  | "none"
  | "basic"
  | "digest"
  | "token"
  | "cookie"
  | "onvif_digest"
  | "proxy_passthrough";
export type CameraLiveAuthState = "unauthenticated" | "authenticating" | "authenticated" | "failed";
export type CameraLiveAuthChallengeScheme = "basic" | "digest" | "bearer" | "token" | null;
const LIVE_SESSION_TTL_MS = 120_000;

const CameraLiveConnectionRecordSchema = z.object({
  cameraId: z.string().min(1).optional(),
  cameraName: z.string().min(1).optional(),
  liveFeedUrl: z.string().url().optional().nullable(),
  liveFeedLabel: z.string().min(1).optional().nullable(),
  liveConnectionMode: z.enum(["rtsp", "mjpeg", "http", "onvif", "proxy"]).optional(),
  liveConnectionStatus: z.enum(["disconnected", "connecting", "connected", "error"]).optional(),
  authMode: z.enum(["none", "basic", "digest", "token", "cookie", "onvif_digest", "proxy_passthrough"]).optional(),
  authState: z.enum(["unauthenticated", "authenticating", "authenticated", "failed"]).optional(),
  authRealm: z.string().min(1).optional().nullable(),
  authSessionId: z.string().min(1).optional().nullable(),
  authSessionExpiresAt: z.number().int().nonnegative().optional().nullable(),
  transportResponseStatus: z.number().int().optional().nullable(),
  transportResponseStatusText: z.string().min(1).optional().nullable(),
  authChallengeHeader: z.string().min(1).optional().nullable(),
  authChallengeScheme: z.enum(["basic", "digest", "bearer", "token"]).optional().nullable(),
  authChallengeRealm: z.string().min(1).optional().nullable(),
  notes: z.string().min(1).optional().nullable(),
  timestamp: z.number().int().nonnegative().optional(),
}).refine((value) => Boolean(
  value.cameraId
  || value.cameraName
  || value.liveFeedUrl
  || value.liveFeedLabel
  || value.liveConnectionMode
  || value.liveConnectionStatus
  || value.authMode
  || value.authState
  || value.authRealm
  || value.authSessionId
  || value.authSessionExpiresAt !== undefined
  || value.transportResponseStatus !== undefined
  || value.transportResponseStatusText
  || value.authChallengeHeader
  || value.authChallengeScheme
  || value.authChallengeRealm
  || value.notes
), {
  message: "Provide at least one camera connection field.",
});

export const CameraLiveConnectionProbeRequestSchema = z.object({
  source: z.string().min(1).default("camera-inspector"),
  action: z.enum(["bind", "refresh", "heartbeat", "disconnect"]).default("bind"),
  protocol: z.enum(["rtsp", "mjpeg", "http", "onvif", "proxy"]).default("onvif"),
  endpointUrl: z.string().url().nullable().optional(),
  liveFeedUrl: z.string().url().nullable().optional(),
  feedLabel: z.string().min(1).optional(),
  cameraId: z.string().min(1),
  cameraName: z.string().min(1),
  sceneId: z.string().min(1).optional(),
  sceneName: z.string().min(1).optional(),
  submittedAt: z.number().int().nonnegative().optional(),
  liveSessionId: z.string().min(1).optional(),
  liveSessionStartedAt: z.number().int().nonnegative().optional(),
  liveSessionConfirmedAt: z.number().int().nonnegative().optional(),
  transportSessionId: z.string().min(1).optional(),
  authMode: z.enum(["none", "basic", "digest", "token", "cookie", "onvif_digest", "proxy_passthrough"]).optional(),
  authState: z.enum(["unauthenticated", "authenticating", "authenticated", "failed"]).optional(),
  authRealm: z.string().min(1).nullable().optional(),
  authSessionId: z.string().min(1).optional(),
  authSessionExpiresAt: z.number().int().nonnegative().nullable().optional(),
  transportResponseStatus: z.number().int().nullable().optional(),
  transportResponseStatusText: z.string().min(1).nullable().optional(),
  authChallengeHeader: z.string().min(1).nullable().optional(),
  authChallengeScheme: z.enum(["basic", "digest", "bearer", "token"]).nullable().optional(),
  authChallengeRealm: z.string().min(1).nullable().optional(),
  onvifUsername: z.string().min(1).optional(),
  onvifPassword: z.string().min(1).optional(),
  raw: z.string().default(""),
  notes: z.string().optional(),
}).refine((value) => value.action === "disconnect" || value.action === "heartbeat" || value.raw.trim().length > 0 || Boolean(value.endpointUrl) || Boolean(value.liveFeedUrl), {
  message: "Provide a probe payload or endpoint URL for live camera binding.",
  path: ["raw"],
});

export type CameraLiveConnectionProbeRequest = z.infer<typeof CameraLiveConnectionProbeRequestSchema>;

export type CameraLiveConnectionProbeResponse = {
  ok: true;
  source: string;
  action: "bind" | "refresh" | "heartbeat" | "disconnect";
  protocol: CameraLiveConnectionMode;
  receivedAt: string;
  sceneId: string | null;
  sceneName: string | null;
  endpointUrl: string | null;
  liveFeedUrl: string | null;
  feedLabel: string | null;
  summary: string;
  record: {
    cameraId: string;
    cameraName: string;
    liveSessionId: string | null;
    liveSessionState: "idle" | "probing" | "connected" | "error" | null;
    liveSessionStartedAt: number | null;
    liveSessionConfirmedAt: number | null;
    liveSessionExpiresAt: number | null;
    transportSessionId: string | null;
    transportSessionState: "idle" | "negotiating" | "active" | "closing" | "error" | null;
    lastHeartbeatAt: number | null;
    probeCount: number;
    protocolProfile: "onvif_device" | "rtsp_session" | "mjpeg_stream" | "http_poll" | "proxy" | null;
    authMode: CameraLiveAuthMode;
    authState: CameraLiveAuthState;
    authRealm: string | null;
    onvifUsername?: string | null;
    onvifPassword?: string | null;
    authSessionId: string | null;
    authSessionExpiresAt: number | null;
    transportResponseStatus: number | null;
    transportResponseStatusText: string | null;
    authChallengeHeader: string | null;
    authChallengeScheme: CameraLiveAuthChallengeScheme;
    authChallengeRealm: string | null;
    eventSubscriptionUri: string | null;
    eventSubscriptionReference: string | null;
    eventSubscriptionExpiresAt: number | null;
    liveFeedUrl: string | null;
    liveFeedLabel: string | null;
    liveConnectionMode: CameraLiveConnectionMode | null;
    liveConnectionStatus: CameraLiveConnectionStatus;
    notes: string | null;
    timestamp: number;
  };
  errors: string[];
  sourceCount: number;
};

function parseJsonCandidates(raw: string): { items: unknown[]; errors: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) return { items: [], errors: [] };
  if (trimmed.startsWith("<")) return { items: [], errors: [] };

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return { items: parsed, errors: [] };
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
      return { items: (parsed as { records: unknown[] }).records, errors: [] };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events)) {
      return { items: (parsed as { events: unknown[] }).events, errors: [] };
    }
    return { items: [parsed], errors: [] };
  } catch {
    const items: unknown[] = [];
    const errors: string[] = [];
    trimmed
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => {
        try {
          items.push(JSON.parse(line));
        } catch {
          errors.push(`Line ${index + 1} is not valid JSON.`);
        }
      });
    return { items, errors };
  }
}

function parseXmlCandidates(raw: string): { items: unknown[]; errors: string[] } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<")) return { items: [], errors: [] };

  const items: unknown[] = [];
  const errors: string[] = [];
  const candidateBlocks = trimmed.match(/<([A-Za-z0-9_:.-]+:)?(Device|Connection|Probe|Response)[^>]*>[\s\S]*?<\/([A-Za-z0-9_:.-]+:)?(Device|Connection|Probe|Response)>/gi) ?? [trimmed];
  for (const block of candidateBlocks) {
    const tagText = (pattern: RegExp) => {
      const match = block.match(pattern);
      return match?.[1]?.trim() || null;
    };

    const liveFeedUrl = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:Uri|XAddr|URL|Url)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:Uri|XAddr|URL|Url)>/i);
    const feedLabel = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:Name|Label|Title)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:Name|Label|Title)>/i);
    const cameraId = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:CameraId|Token|SourceId)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:CameraId|Token|SourceId)>/i);
    const cameraName = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:CameraName|DeviceName|Name)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:CameraName|DeviceName|Name)>/i);
    const mode = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:Mode|Protocol|ConnectionMode)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:Mode|Protocol|ConnectionMode)>/i)?.toLowerCase();
    const status = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:Status|ConnectionStatus)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:Status|ConnectionStatus)>/i)?.toLowerCase();
    const authMode = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:AuthMode|AuthenticationMode|SecurityMode)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:AuthMode|AuthenticationMode|SecurityMode)>/i)?.toLowerCase();
    const authState = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:AuthState|AuthenticationState|AuthStatus)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:AuthState|AuthenticationState|AuthStatus)>/i)?.toLowerCase();
    const authRealm = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:AuthRealm|AuthenticationRealm|Realm)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:AuthRealm|AuthenticationRealm|Realm)>/i);
    const authSessionId = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:AuthSessionId|SessionId|Token)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:AuthSessionId|SessionId|Token)>/i);
    const authSessionExpiresAtText = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:AuthSessionExpiresAt|SessionExpiresAt|ExpiresAt)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:AuthSessionExpiresAt|SessionExpiresAt|ExpiresAt)>/i);
    const transportResponseStatusText = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:TransportResponseStatus|ResponseStatus|StatusCode)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:TransportResponseStatus|ResponseStatus|StatusCode)>/i);
    const transportResponseStatusMessage = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:TransportResponseStatusText|ResponseStatusText|StatusText)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:TransportResponseStatusText|ResponseStatusText|StatusText)>/i);
    const authChallengeHeader = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:AuthChallengeHeader|WWWAuthenticate|WwwAuthenticate)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:AuthChallengeHeader|WWWAuthenticate|WwwAuthenticate)>/i);
    const authChallengeScheme = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:AuthChallengeScheme|ChallengeScheme)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:AuthChallengeScheme|ChallengeScheme)>/i)?.toLowerCase();
    const authChallengeRealm = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:AuthChallengeRealm|ChallengeRealm)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:AuthChallengeRealm|ChallengeRealm)>/i);
    const notes = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:Notes|Message|Description)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:Notes|Message|Description)>/i);

    if (!liveFeedUrl && !feedLabel && !cameraId && !cameraName && !mode && !status && !authMode && !authState && !authRealm && !authSessionId && !authSessionExpiresAtText && !transportResponseStatusText && !transportResponseStatusMessage && !authChallengeHeader && !authChallengeScheme && !authChallengeRealm && !notes) {
      errors.push("The XML payload did not expose a usable live connection record.");
      continue;
    }

    items.push({
      cameraId: cameraId ?? undefined,
      cameraName: cameraName ?? undefined,
      liveFeedUrl: liveFeedUrl ?? undefined,
      liveFeedLabel: feedLabel ?? undefined,
      liveConnectionMode: mode === "rtsp" || mode === "mjpeg" || mode === "http" || mode === "onvif" || mode === "proxy" ? mode : undefined,
      liveConnectionStatus: status === "connected" || status === "connecting" || status === "disconnected" || status === "error" ? status : undefined,
      authMode:
        authMode === "none"
        || authMode === "basic"
        || authMode === "digest"
        || authMode === "token"
        || authMode === "cookie"
        || authMode === "onvif_digest"
        || authMode === "proxy_passthrough"
          ? authMode
          : undefined,
      authState:
        authState === "unauthenticated"
        || authState === "authenticating"
        || authState === "authenticated"
        || authState === "failed"
          ? authState
          : undefined,
      authRealm: authRealm ?? undefined,
      authSessionId: authSessionId ?? undefined,
      authSessionExpiresAt: authSessionExpiresAtText && Number.isFinite(Number(authSessionExpiresAtText))
        ? Number(authSessionExpiresAtText)
        : undefined,
      transportResponseStatus: transportResponseStatusText && Number.isFinite(Number(transportResponseStatusText))
        ? Number(transportResponseStatusText)
        : undefined,
      transportResponseStatusText: transportResponseStatusMessage ?? undefined,
      authChallengeHeader: authChallengeHeader ?? undefined,
      authChallengeScheme:
        authChallengeScheme === "basic"
        || authChallengeScheme === "digest"
        || authChallengeScheme === "bearer"
        || authChallengeScheme === "token"
          ? authChallengeScheme
          : undefined,
      authChallengeRealm: authChallengeRealm ?? undefined,
      notes: notes ?? undefined,
    });
  }

  return { items, errors };
}

type ResolvedLiveConnectionPayload = {
  raw: string;
  endpointUrl: string | null;
  liveFeedUrl: string | null;
  feedLabel: string | null;
  responseStatus: number | null;
  responseStatusText: string | null;
  authChallengeHeader: string | null;
  onvifDeviceInformation: OnvifDeviceInformation | null;
};

async function resolveLiveConnectionPayload(request: CameraLiveConnectionProbeRequest): Promise<ResolvedLiveConnectionPayload> {
  if (request.action === "disconnect") {
    return {
      raw: "",
      endpointUrl: request.endpointUrl ?? null,
      liveFeedUrl: request.liveFeedUrl ?? null,
      feedLabel: request.feedLabel ?? null,
      responseStatus: null,
      responseStatusText: null,
      authChallengeHeader: null,
      onvifDeviceInformation: null,
    };
  }

  const trimmedRaw = request.raw.trim();
  if (trimmedRaw.length > 0) {
    return {
      raw: trimmedRaw,
      endpointUrl: request.endpointUrl ?? null,
      liveFeedUrl: request.liveFeedUrl ?? null,
      feedLabel: request.feedLabel ?? null,
      responseStatus: null,
      responseStatusText: null,
      authChallengeHeader: null,
      onvifDeviceInformation: null,
    };
  }

  const probeUrl = request.endpointUrl ?? request.liveFeedUrl;
  if (!probeUrl) {
    return {
      raw: "",
      endpointUrl: null,
      liveFeedUrl: request.liveFeedUrl ?? null,
      feedLabel: request.feedLabel ?? null,
      responseStatus: null,
      responseStatusText: null,
      authChallengeHeader: null,
      onvifDeviceInformation: null,
    };
  }

  const accept = "application/json, application/x-ndjson, application/xml, text/xml, text/plain;q=0.9, */*;q=0.1";
  const headers = { accept } as const;
  const endpointUrl = request.endpointUrl ?? probeUrl;
  const liveFeedUrl = request.liveFeedUrl ?? probeUrl;

  const readResponse = async (response: Response) => ({
    raw: (await response.text()).trim(),
    responseStatus: response.status,
    responseStatusText: response.statusText || null,
    authChallengeHeader: response.headers.get("www-authenticate"),
  });

  if (request.protocol === "onvif") {
    try {
      const onvifClient = new OnvifClient({
        address: probeUrl,
        username: request.onvifUsername,
        password: request.onvifPassword,
      });
      const onvifProbe = await onvifClient.connect();
      if (onvifProbe.raw.length > 0 || onvifProbe.responseStatus !== null) {
        return {
          raw: onvifProbe.raw,
          endpointUrl,
          liveFeedUrl,
          feedLabel: request.feedLabel ?? null,
          responseStatus: onvifProbe.responseStatus,
          responseStatusText: onvifProbe.responseStatusText,
          authChallengeHeader: onvifProbe.authChallengeHeader,
          onvifDeviceInformation: onvifProbe.session.deviceInformation ?? null,
        };
      }
    } catch {
      // Fall back to a GET probe below.
    }
  }

  const response = await fetch(probeUrl, {
    method: "GET",
    headers,
  });

  const resolved = await readResponse(response);
  return {
    raw: resolved.raw,
    endpointUrl,
    liveFeedUrl,
    feedLabel: request.feedLabel ?? null,
    responseStatus: resolved.responseStatus,
    responseStatusText: resolved.responseStatusText,
    authChallengeHeader: resolved.authChallengeHeader,
    onvifDeviceInformation: null,
  };
}

function parseAuthChallengeHeader(header: string | null | undefined): { scheme: CameraLiveAuthChallengeScheme; realm: string | null } {
  if (!header) {
    return { scheme: null, realm: null };
  }

  const trimmed = header.trim();
  const schemeText = (trimmed.match(/^(\S+)/)?.[1] ?? "").toLowerCase();
  const scheme: CameraLiveAuthChallengeScheme =
    schemeText === "basic" || schemeText === "digest" || schemeText === "bearer" || schemeText === "token"
      ? schemeText
      : null;
  const realmMatch = trimmed.match(/realm="?([^",]+)"?/i);
  return {
    scheme,
    realm: realmMatch?.[1]?.trim() || null,
  };
}

export async function probeCameraLiveConnection(request: CameraLiveConnectionProbeRequest): Promise<CameraLiveConnectionProbeResponse> {
  const payload = await resolveLiveConnectionPayload(request);
  const jsonCandidates = parseJsonCandidates(payload.raw);
  const xmlCandidates = parseXmlCandidates(payload.raw);
  const candidates = [...jsonCandidates.items, ...xmlCandidates.items];
  const errors: string[] = [...jsonCandidates.errors, ...xmlCandidates.errors];
  const sourceCount = candidates.length;
  const challengeFromHeader = parseAuthChallengeHeader(payload.authChallengeHeader);
  const onvifDeviceSummary = summarizeOnvifDeviceInformation(payload.onvifDeviceInformation);

  const parsedCandidate = candidates
    .map((candidate) => CameraLiveConnectionRecordSchema.safeParse(candidate))
    .find((result) => result.success) ?? null;

  const liveFeedUrl = parsedCandidate?.success && parsedCandidate.data.liveFeedUrl
    ? parsedCandidate.data.liveFeedUrl
    : payload.liveFeedUrl ?? payload.endpointUrl ?? null;
  const feedLabel = parsedCandidate?.success && parsedCandidate.data.liveFeedLabel
    ? parsedCandidate.data.liveFeedLabel
    : payload.feedLabel ?? null;
  const protocol = parsedCandidate?.success && parsedCandidate.data.liveConnectionMode
    ? parsedCandidate.data.liveConnectionMode
    : request.protocol;
  const parsedTransportResponseStatus = parsedCandidate?.success ? parsedCandidate.data.transportResponseStatus : undefined;
  const parsedTransportResponseStatusText = parsedCandidate?.success ? parsedCandidate.data.transportResponseStatusText : undefined;
  const parsedAuthChallengeHeader = parsedCandidate?.success ? parsedCandidate.data.authChallengeHeader : undefined;
  const responseStatus = payload.responseStatus ?? (parsedTransportResponseStatus !== undefined ? parsedTransportResponseStatus ?? null : null);
  const responseStatusText = payload.responseStatusText ?? (parsedTransportResponseStatusText ?? null);
  const authChallengeHeader = payload.authChallengeHeader ?? (parsedAuthChallengeHeader ?? null);
  const authChallengeScheme = parsedCandidate?.success && parsedCandidate.data.authChallengeScheme
    ? parsedCandidate.data.authChallengeScheme
    : challengeFromHeader.scheme;
  const authChallengeRealm = parsedCandidate?.success && parsedCandidate.data.authChallengeRealm
    ? parsedCandidate.data.authChallengeRealm
    : challengeFromHeader.realm;
  const receivedAuthChallenge = request.action !== "disconnect" && (responseStatus === 401 || responseStatus === 403 || (Boolean(authChallengeHeader) && responseStatus !== 200));
  const onvifDeviceProbeSucceeded = request.action !== "disconnect" && request.protocol === "onvif" && (responseStatus === 200 || Boolean(payload.onvifDeviceInformation));
  const status = request.action === "disconnect"
    ? "disconnected"
    : parsedCandidate?.success
      ? parsedCandidate.data.liveConnectionStatus ?? "connected"
      : receivedAuthChallenge
        ? "connecting"
        : onvifDeviceProbeSucceeded
          ? "connected"
        : "error";
  const notes = request.action === "disconnect"
    ? (request.notes?.trim() || null)
    : parsedCandidate?.success && parsedCandidate.data.notes
      ? parsedCandidate.data.notes.trim()
      : request.notes?.trim() || (onvifDeviceSummary ? `ONVIF device information: ${onvifDeviceSummary}.` : null);
  const parsedAuthMode = parsedCandidate?.success ? parsedCandidate.data.authMode : undefined;
  const parsedAuthState = parsedCandidate?.success ? parsedCandidate.data.authState : undefined;
  const parsedAuthRealm = parsedCandidate?.success ? parsedCandidate.data.authRealm : undefined;
  const parsedAuthSessionId = parsedCandidate?.success ? parsedCandidate.data.authSessionId : undefined;
  const parsedAuthSessionExpiresAt = parsedCandidate?.success ? parsedCandidate.data.authSessionExpiresAt : undefined;
  const authMode: CameraLiveAuthMode = request.authMode
    ?? parsedAuthMode
    ?? (protocol === "onvif"
      ? "onvif_digest"
      : protocol === "rtsp"
        ? "digest"
        : protocol === "mjpeg" || protocol === "http"
          ? "basic"
          : protocol === "proxy"
            ? "proxy_passthrough"
            : "none");
  const authState: CameraLiveAuthState = request.authState
    ?? parsedAuthState
    ?? (request.action === "disconnect"
      ? "unauthenticated"
      : onvifDeviceProbeSucceeded
        ? "authenticated"
      : status === "connected"
        ? "authenticated"
        : status === "error"
          ? "failed"
          : "authenticating");
  const authRealm = request.authRealm ?? parsedAuthRealm ?? null;
  const authSessionId = request.authSessionId ?? parsedAuthSessionId ?? request.transportSessionId ?? request.liveSessionId ?? null;
  const authSessionExpiresAt = request.authSessionExpiresAt
    ?? parsedAuthSessionExpiresAt
    ?? (authState === "authenticated" && request.action !== "disconnect"
      ? ((request.liveSessionConfirmedAt ?? Date.now()) + LIVE_SESSION_TTL_MS)
      : null);
  const transportSessionState = request.action === "disconnect"
    ? "closing"
    : status === "connected"
      ? "active"
      : receivedAuthChallenge
        ? "negotiating"
        : "error";
  const transportNegotiationSummary = receivedAuthChallenge
    ? `Auth challenge ${authChallengeScheme ?? "unknown"}${authChallengeRealm ? ` realm ${authChallengeRealm}` : ""}${responseStatus ? ` (${responseStatus})` : ""}`
    : responseStatus
      ? `Transport response ${responseStatus}${responseStatusText ? ` ${responseStatusText}` : ""}`
      : null;
  if (request.action !== "disconnect" && candidates.length > 0 && !parsedCandidate?.success) {
    errors.push("The live connection probe payload did not match the expected connection schema.");
  }

  const record = {
    cameraId: request.cameraId,
    cameraName: request.cameraName,
    liveSessionId: request.action === "disconnect"
      ? request.liveSessionId ?? null
      : request.liveSessionId ?? `live_session_${request.cameraId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    liveSessionState: request.action === "disconnect"
      ? "idle"
      : status === "connected"
        ? "connected"
        : receivedAuthChallenge
          ? "probing"
          : "error",
    liveSessionStartedAt: request.action === "disconnect"
      ? request.liveSessionStartedAt ?? request.submittedAt ?? Date.now()
      : request.liveSessionStartedAt ?? request.submittedAt ?? Date.now(),
    liveSessionConfirmedAt: request.action === "disconnect"
      ? request.liveSessionConfirmedAt ?? null
      : status === "connected"
        ? (request.liveSessionConfirmedAt ?? Date.now())
        : null,
    liveSessionExpiresAt: request.action === "disconnect"
      ? null
      : status === "connected"
        ? ((request.liveSessionConfirmedAt ?? Date.now()) + LIVE_SESSION_TTL_MS)
        : null,
    transportSessionId: request.action === "disconnect"
      ? request.transportSessionId ?? request.liveSessionId ?? null
      : request.transportSessionId ?? request.liveSessionId ?? `transport_session_${request.cameraId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    transportSessionState,
    lastHeartbeatAt: status === "connected" ? Date.now() : null,
    probeCount: request.action === "disconnect" ? 0 : 1,
    protocolProfile:
      protocol === "onvif"
        ? "onvif_device"
        : protocol === "rtsp"
          ? "rtsp_session"
          : protocol === "mjpeg"
            ? "mjpeg_stream"
            : protocol === "http"
              ? "http_poll"
              : "proxy",
    liveFeedUrl,
    liveFeedLabel: feedLabel,
    liveConnectionMode: request.action === "disconnect" ? null : protocol,
    liveConnectionStatus: status,
    authMode,
    authState,
    authRealm,
    onvifUsername: request.onvifUsername ?? null,
    onvifPassword: request.onvifPassword ?? null,
    authSessionId,
    authSessionExpiresAt,
    transportResponseStatus: responseStatus,
    transportResponseStatusText: responseStatusText,
    authChallengeHeader,
    authChallengeScheme,
    authChallengeRealm,
    notes,
    timestamp: parsedCandidate?.success && parsedCandidate.data.timestamp ? parsedCandidate.data.timestamp : Date.now(),
  } as const;

  const receivedAt = new Date(request.submittedAt ?? Date.now()).toISOString();
  const authSummary = authState === "authenticated"
    ? `Authenticated via ${authMode.replaceAll("_", " ")}`
    : authState === "unauthenticated"
      ? "Unauthenticated"
      : authState === "failed"
        ? "Authentication failed"
        : `Authenticating via ${authMode.replaceAll("_", " ")}`;
  const summary = request.action === "disconnect"
    ? `Disconnected ${request.cameraName} from the live camera binding. ${authSummary}.`
    : request.action === "refresh" && status === "connected"
      ? `Refreshed live session for ${request.cameraName} via ${protocol.toUpperCase()} and confirmed the connection. ${authSummary}.`
      : receivedAuthChallenge
        ? `Live camera connection challenge for ${request.cameraName} returned ${responseStatus ?? "an auth challenge"}. ${authSummary}. ${transportNegotiationSummary ?? ""}`.trim()
      : status === "connected"
      ? `Probed ${request.cameraName} via ${protocol.toUpperCase()} and archived the live connection. ${authSummary}.`
      : `Live camera connection probe did not confirm a usable connection for ${request.cameraName}.`;

  return {
    ok: true,
    source: request.source,
    action: request.action,
    protocol,
    receivedAt,
    sceneId: request.sceneId ?? null,
    sceneName: request.sceneName ?? null,
    endpointUrl: payload.endpointUrl,
    liveFeedUrl,
    feedLabel,
    summary,
    record,
    errors,
    sourceCount,
  };
}
