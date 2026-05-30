import { appendCameraLiveConnectionHistory, loadCameraLiveConnectionHistory } from "@/lib/camera-live-connection-history";
import { appendCameraLiveSessionRecord, closeCameraLiveSessionRecord, pruneExpiredCameraLiveSessionRegistry, renewCameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { CameraLiveConnectionProbeRequestSchema, probeCameraLiveConnection, type CameraLiveConnectionProbeRequest } from "@/lib/camera-live-connection";
import { corsJson, corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadCameraLiveConnectionHistory();
  const sessions = pruneExpiredCameraLiveSessionRegistry().filter((record) => record.status === "active");
  return corsJson({
    ok: true,
    history,
    historyCount: history.length,
    latestSubmission: history[0] ?? null,
    activeSessions: sessions,
    activeSessionCount: sessions.length,
  }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CameraLiveConnectionProbeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return corsJson(
        {
          ok: false,
          error: "Invalid camera live connection payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        request,
        { status: 400 },
        { methods: ["GET", "POST", "OPTIONS"] },
      );
    }

    const storedAt = Date.now();
    const sessionRegistry = pruneExpiredCameraLiveSessionRegistry();
    const activeSession = sessionRegistry.find((record) => record.cameraId === parsed.data.cameraId && record.status === "active") ?? null;

    if (parsed.data.action === "heartbeat") {
      const sessionId = parsed.data.liveSessionId ?? activeSession?.sessionId ?? `live_session_${parsed.data.cameraId}_${storedAt}`;
      const transportSessionId = parsed.data.transportSessionId ?? activeSession?.transportSessionId ?? `transport_session_${parsed.data.cameraId}_${storedAt}`;
      const authMode = parsed.data.authMode ?? activeSession?.authMode ?? "onvif_digest";
      const authState = parsed.data.authState ?? activeSession?.authState ?? "authenticated";
      const authRealm = parsed.data.authRealm ?? activeSession?.authRealm ?? null;
      const authSessionId = parsed.data.authSessionId ?? activeSession?.authSessionId ?? transportSessionId ?? sessionId;
      const authSessionExpiresAt = parsed.data.authSessionExpiresAt ?? activeSession?.authSessionExpiresAt ?? storedAt + 120_000;
      const transportResponseStatus = parsed.data.transportResponseStatus ?? activeSession?.transportResponseStatus ?? null;
      const transportResponseStatusText = parsed.data.transportResponseStatusText ?? activeSession?.transportResponseStatusText ?? null;
      const authChallengeHeader = parsed.data.authChallengeHeader ?? activeSession?.authChallengeHeader ?? null;
      const authChallengeScheme = parsed.data.authChallengeScheme ?? activeSession?.authChallengeScheme ?? null;
      const authChallengeRealm = parsed.data.authChallengeRealm ?? activeSession?.authChallengeRealm ?? null;
      const authSummary = authState === "authenticated"
        ? `Authenticated via ${authMode.replaceAll("_", " ")}`
        : authState === "unauthenticated"
          ? "Unauthenticated"
          : authState === "failed"
            ? "Authentication failed"
            : `Authenticating via ${authMode.replaceAll("_", " ")}`;
      const heartbeatRecord = {
        ok: true as const,
        source: parsed.data.source,
        action: "heartbeat" as const,
        protocol: parsed.data.protocol,
        receivedAt: new Date(storedAt).toISOString(),
        sceneId: parsed.data.sceneId ?? null,
        sceneName: parsed.data.sceneName ?? null,
        endpointUrl: parsed.data.endpointUrl ?? parsed.data.liveFeedUrl ?? null,
        liveFeedUrl: parsed.data.liveFeedUrl ?? parsed.data.endpointUrl ?? null,
        feedLabel: parsed.data.feedLabel ?? activeSession?.feedLabel ?? null,
        summary: `Heartbeat renewed the live session for ${parsed.data.cameraName}. ${authSummary}.`,
        record: {
          cameraId: parsed.data.cameraId,
          cameraName: parsed.data.cameraName,
          liveSessionId: sessionId,
          liveSessionState: "connected" as const,
          liveSessionStartedAt: activeSession?.liveSessionStartedAt ?? storedAt,
          liveSessionConfirmedAt: storedAt,
          liveSessionExpiresAt: storedAt + 120_000,
          transportSessionId,
          transportSessionState: "active" as const,
          lastHeartbeatAt: storedAt,
          probeCount: (activeSession?.probeCount ?? 0) + 1,
          protocolProfile: activeSession?.protocolProfile ?? (parsed.data.protocol === "onvif" ? "onvif_device" : parsed.data.protocol === "rtsp" ? "rtsp_session" : parsed.data.protocol === "mjpeg" ? "mjpeg_stream" : parsed.data.protocol === "http" ? "http_poll" : "proxy"),
          authMode,
          authState,
          authRealm,
          onvifUsername: parsed.data.onvifUsername ?? activeSession?.onvifUsername ?? null,
          onvifPassword: parsed.data.onvifPassword ?? activeSession?.onvifPassword ?? null,
          authSessionId,
          authSessionExpiresAt,
          transportResponseStatus,
          transportResponseStatusText,
          authChallengeHeader,
          authChallengeScheme,
          authChallengeRealm,
          liveFeedUrl: parsed.data.liveFeedUrl ?? activeSession?.liveFeedUrl ?? null,
          liveFeedLabel: parsed.data.feedLabel ?? activeSession?.feedLabel ?? null,
          liveConnectionMode: parsed.data.protocol,
          liveConnectionStatus: "connected" as const,
          notes: parsed.data.notes ?? activeSession?.summary ?? null,
          timestamp: storedAt,
        },
        errors: [],
        sourceCount: 0,
      };

      renewCameraLiveSessionRecord({
        sessionId,
        cameraId: parsed.data.cameraId,
        cameraName: parsed.data.cameraName,
        sceneId: parsed.data.sceneId ?? null,
        sceneName: parsed.data.sceneName ?? null,
        liveFeedUrl: heartbeatRecord.record.liveFeedUrl,
        feedLabel: heartbeatRecord.record.liveFeedLabel,
        liveConnectionMode: heartbeatRecord.record.liveConnectionMode,
        liveConnectionStatus: heartbeatRecord.record.liveConnectionStatus,
        liveSessionState: heartbeatRecord.record.liveSessionState,
        liveSessionStartedAt: heartbeatRecord.record.liveSessionStartedAt,
        liveSessionConfirmedAt: heartbeatRecord.record.liveSessionConfirmedAt,
        liveSessionExpiresAt: heartbeatRecord.record.liveSessionExpiresAt,
        transportSessionId,
        transportSessionState: heartbeatRecord.record.transportSessionState,
        lastHeartbeatAt: storedAt,
        probeCount: heartbeatRecord.record.probeCount,
        protocolProfile: heartbeatRecord.record.protocolProfile,
        authMode,
        authState,
        authRealm,
        onvifUsername: parsed.data.onvifUsername ?? activeSession?.onvifUsername ?? null,
        onvifPassword: parsed.data.onvifPassword ?? activeSession?.onvifPassword ?? null,
        authSessionId,
        authSessionExpiresAt,
        transportResponseStatus,
        transportResponseStatusText,
        authChallengeHeader,
        authChallengeScheme,
        authChallengeRealm,
        eventSubscriptionUri: activeSession?.eventSubscriptionUri ?? null,
        eventSubscriptionReference: activeSession?.eventSubscriptionReference ?? null,
        eventSubscriptionExpiresAt: activeSession?.eventSubscriptionExpiresAt ?? null,
        sessionExpiresAt: heartbeatRecord.record.liveSessionExpiresAt,
        summary: heartbeatRecord.summary,
      });

      const history = appendCameraLiveConnectionHistory({
        ...heartbeatRecord,
        submittedAt: parsed.data.submittedAt ?? storedAt,
        storedAt,
        raw: parsed.data.raw.trim(),
      });

      return corsJson({
        ...heartbeatRecord,
        storedAt,
        historyCount: history.length,
      }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
    }

    const probeRequest: CameraLiveConnectionProbeRequest = parsed.data.action === "disconnect"
      ? {
          ...parsed.data,
          authMode: parsed.data.authMode ?? activeSession?.authMode ?? "none",
          authState: parsed.data.authState ?? "unauthenticated",
          authRealm: parsed.data.authRealm ?? activeSession?.authRealm ?? null,
          authSessionId: parsed.data.authSessionId ?? activeSession?.authSessionId ?? activeSession?.transportSessionId ?? activeSession?.sessionId ?? undefined,
          authSessionExpiresAt: null,
          transportResponseStatus: parsed.data.transportResponseStatus ?? activeSession?.transportResponseStatus ?? null,
          transportResponseStatusText: parsed.data.transportResponseStatusText ?? activeSession?.transportResponseStatusText ?? null,
          authChallengeHeader: parsed.data.authChallengeHeader ?? activeSession?.authChallengeHeader ?? null,
          authChallengeScheme: parsed.data.authChallengeScheme ?? activeSession?.authChallengeScheme ?? null,
          authChallengeRealm: parsed.data.authChallengeRealm ?? activeSession?.authChallengeRealm ?? null,
        }
      : parsed.data;
    const summary = await probeCameraLiveConnection(probeRequest);
    const sessionId = summary.record.liveSessionId
      ?? parsed.data.liveSessionId
      ?? (parsed.data.action === "disconnect"
        ? sessionRegistry.find((record) => record.cameraId === parsed.data.cameraId && record.status === "active")?.sessionId ?? null
        : null);
    if (sessionId) {
      if (parsed.data.action === "disconnect") {
        closeCameraLiveSessionRecord(sessionId, summary.summary);
      } else {
        appendCameraLiveSessionRecord({
          sessionId,
          status: summary.record.liveConnectionStatus === "connected" || summary.record.liveConnectionStatus === "connecting" ? "active" : "expired",
          cameraId: summary.record.cameraId,
          cameraName: summary.record.cameraName,
          sceneId: parsed.data.sceneId ?? null,
          sceneName: parsed.data.sceneName ?? null,
          liveFeedUrl: summary.record.liveFeedUrl,
          feedLabel: summary.record.liveFeedLabel,
          liveConnectionMode: summary.record.liveConnectionMode,
          liveConnectionStatus: summary.record.liveConnectionStatus,
          liveSessionState: summary.record.liveSessionState,
          liveSessionStartedAt: summary.record.liveSessionStartedAt,
          liveSessionConfirmedAt: summary.record.liveSessionConfirmedAt,
          liveSessionExpiresAt: summary.record.liveSessionExpiresAt,
          transportSessionId: summary.record.transportSessionId,
          transportSessionState: summary.record.transportSessionState,
          lastHeartbeatAt: summary.record.lastHeartbeatAt,
          probeCount: summary.record.probeCount,
          protocolProfile: summary.record.protocolProfile,
          authMode: summary.record.authMode,
          authState: summary.record.authState,
          authRealm: summary.record.authRealm,
          authSessionId: summary.record.authSessionId,
          authSessionExpiresAt: summary.record.authSessionExpiresAt,
          transportResponseStatus: summary.record.transportResponseStatus,
          transportResponseStatusText: summary.record.transportResponseStatusText,
          authChallengeHeader: summary.record.authChallengeHeader,
          authChallengeScheme: summary.record.authChallengeScheme,
          authChallengeRealm: summary.record.authChallengeRealm,
          eventSubscriptionUri: summary.record.eventSubscriptionUri,
          eventSubscriptionReference: summary.record.eventSubscriptionReference,
          eventSubscriptionExpiresAt: summary.record.eventSubscriptionExpiresAt,
          sessionExpiresAt: summary.record.liveSessionExpiresAt,
          summary: summary.summary,
        } as Parameters<typeof appendCameraLiveSessionRecord>[0]);
      }
    }
    const history = appendCameraLiveConnectionHistory({
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
      raw: parsed.data.raw.trim(),
    });

    return corsJson({
      ...summary,
      storedAt,
      historyCount: history.length,
    }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
  } catch {
    return corsJson(
      {
        ok: false,
        error: "Failed to parse camera live connection payload.",
      },
      request,
      { status: 400 },
      { methods: ["GET", "POST", "OPTIONS"] },
    );
  }
}
