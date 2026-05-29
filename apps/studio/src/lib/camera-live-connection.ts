import { z } from "zod";

type CameraLiveConnectionMode = "rtsp" | "mjpeg" | "http" | "onvif" | "proxy";
type CameraLiveConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
const LIVE_SESSION_TTL_MS = 120_000;

const CameraLiveConnectionRecordSchema = z.object({
  cameraId: z.string().min(1).optional(),
  cameraName: z.string().min(1).optional(),
  liveFeedUrl: z.string().url().optional().nullable(),
  liveFeedLabel: z.string().min(1).optional().nullable(),
  liveConnectionMode: z.enum(["rtsp", "mjpeg", "http", "onvif", "proxy"]).optional(),
  liveConnectionStatus: z.enum(["disconnected", "connecting", "connected", "error"]).optional(),
  notes: z.string().min(1).optional().nullable(),
  timestamp: z.number().int().nonnegative().optional(),
}).refine((value) => Boolean(
  value.cameraId
  || value.cameraName
  || value.liveFeedUrl
  || value.liveFeedLabel
  || value.liveConnectionMode
  || value.liveConnectionStatus
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
    const notes = tagText(/<(?:[A-Za-z0-9_.-]+:)?(?:Notes|Message|Description)>([^<]+)<\/(?:[A-Za-z0-9_.-]+:)?(?:Notes|Message|Description)>/i);

    if (!liveFeedUrl && !feedLabel && !cameraId && !cameraName && !mode && !status && !notes) {
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
      notes: notes ?? undefined,
    });
  }

  return { items, errors };
}

async function resolveLiveConnectionPayload(request: CameraLiveConnectionProbeRequest) {
  if (request.action === "disconnect") {
    return {
      raw: "",
      endpointUrl: request.endpointUrl ?? null,
      liveFeedUrl: request.liveFeedUrl ?? null,
      feedLabel: request.feedLabel ?? null,
    };
  }

  const trimmedRaw = request.raw.trim();
  if (trimmedRaw.length > 0) {
    return {
      raw: trimmedRaw,
      endpointUrl: request.endpointUrl ?? null,
      liveFeedUrl: request.liveFeedUrl ?? null,
      feedLabel: request.feedLabel ?? null,
    };
  }

  const probeUrl = request.endpointUrl ?? request.liveFeedUrl;
  if (!probeUrl) {
    return {
      raw: "",
      endpointUrl: null,
      liveFeedUrl: request.liveFeedUrl ?? null,
      feedLabel: request.feedLabel ?? null,
    };
  }

  const accept = "application/json, application/x-ndjson, application/xml, text/xml, text/plain;q=0.9, */*;q=0.1";
  const headers = { accept } as const;
  const endpointUrl = request.endpointUrl ?? probeUrl;
  const liveFeedUrl = request.liveFeedUrl ?? probeUrl;

  const readResponseText = async (response: Response) => {
    if (!response.ok) {
      throw new Error(`Live camera connection probe failed with HTTP ${response.status}.`);
    }
    return (await response.text()).trim();
  };

  if (request.protocol === "onvif") {
    try {
      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
          <s:Body>
            <GetDeviceInformation xmlns="http://www.onvif.org/ver10/device/wsdl" />
          </s:Body>
        </s:Envelope>`;
      const soapResponse = await fetch(probeUrl, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/soap+xml; charset=utf-8",
          soapaction: "http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation",
        },
        body: soapEnvelope,
      });
      const raw = await readResponseText(soapResponse);
      if (raw.length > 0) {
        return {
          raw,
          endpointUrl,
          liveFeedUrl,
          feedLabel: request.feedLabel ?? null,
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

  return {
    raw: await readResponseText(response),
    endpointUrl,
    liveFeedUrl,
    feedLabel: request.feedLabel ?? null,
  };
}

export async function probeCameraLiveConnection(request: CameraLiveConnectionProbeRequest): Promise<CameraLiveConnectionProbeResponse> {
  const payload = await resolveLiveConnectionPayload(request);
  const jsonCandidates = parseJsonCandidates(payload.raw);
  const xmlCandidates = parseXmlCandidates(payload.raw);
  const candidates = [...jsonCandidates.items, ...xmlCandidates.items];
  const errors: string[] = [...jsonCandidates.errors, ...xmlCandidates.errors];
  const sourceCount = candidates.length;

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
  const status = request.action === "disconnect"
    ? "disconnected"
    : parsedCandidate?.success
      ? parsedCandidate.data.liveConnectionStatus ?? "connected"
      : "error";
  const notes = request.action === "disconnect"
    ? (request.notes?.trim() || null)
    : parsedCandidate?.success && parsedCandidate.data.notes
      ? parsedCandidate.data.notes.trim()
      : request.notes?.trim() || null;
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
    transportSessionState: request.action === "disconnect"
      ? "closing"
      : status === "connected"
        ? "active"
        : "error",
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
    notes,
    timestamp: parsedCandidate?.success && parsedCandidate.data.timestamp ? parsedCandidate.data.timestamp : Date.now(),
  } as const;

  const receivedAt = new Date(request.submittedAt ?? Date.now()).toISOString();
  const summary = request.action === "disconnect"
    ? `Disconnected ${request.cameraName} from the live camera binding.`
    : request.action === "refresh" && status === "connected"
      ? `Refreshed live session for ${request.cameraName} via ${protocol.toUpperCase()} and confirmed the connection.`
      : status === "connected"
      ? `Probed ${request.cameraName} via ${protocol.toUpperCase()} and archived the live connection.`
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
