import { appendCameraLiveConnectionHistory, loadCameraLiveConnectionHistory } from "@/lib/camera-live-connection-history";
import { appendCameraLiveSessionRecord, closeCameraLiveSessionRecord, pruneExpiredCameraLiveSessionRegistry, renewCameraLiveSessionRecord, type CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { CameraLiveConnectionProbeRequestSchema, probeCameraLiveConnection, type CameraLiveConnectionProbeRequest, type CameraLiveConnectionProbeResponse } from "@/lib/camera-live-connection";
import { OnvifClient } from "@/lib/onvif-client";
import { corsJson, corsNoContent } from "@/lib/api-cors";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";

import { NextRequest } from "next/server";

const ONVIF_EVENT_SUBSCRIPTION_RENEWAL_WINDOW_MS = 5 * 60 * 1000;

function shouldRenewOnvifSubscription(activeSession: CameraLiveSessionRecord | null, storedAt: number) {
  if (!activeSession) return false;
  if (activeSession.status !== "active") return false;
  if (activeSession.protocolProfile !== "onvif_device") return false;
  if (!activeSession.eventSubscriptionReference && !activeSession.eventSubscriptionUri) return false;
  if (activeSession.eventSubscriptionExpiresAt == null) return true;
  return activeSession.eventSubscriptionExpiresAt - storedAt <= ONVIF_EVENT_SUBSCRIPTION_RENEWAL_WINDOW_MS;
}

export async function GET(request: NextRequest) {
  const history = loadCameraLiveConnectionHistory();
  const sessions = pruneExpiredCameraLiveSessionRegistry().filter((record) => record.status === "active");
  return apiJson(
    request,
    {
      ok: true,
      history,
      historyCount: history.length,
      latestSubmission: history[0] ?? null,
      activeSessions: sessions,
      activeSessionCount: sessions.length,
    },
    undefined,
    { methods: API_METHODS },
  );
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: API_METHODS });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, CameraLiveConnectionProbeRequestSchema, {
    validationErrorMessage: "Invalid camera live connection payload.",
    parseErrorMessage: "Failed to parse camera live connection payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
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
      const renewTargetUrl = activeSession?.eventSubscriptionReference ?? activeSession?.eventSubscriptionUri ?? null;
      let renewedEventSubscription: Awaited<ReturnType<OnvifClient["renewEventSubscription"]>> | null = null;
      if (shouldRenewOnvifSubscription(activeSession, storedAt) && renewTargetUrl) {
        try {
          const onvifClient = new OnvifClient({
            address: renewTargetUrl,
            username: parsed.data.onvifUsername ?? activeSession?.onvifUsername ?? undefined,
            password: parsed.data.onvifPassword ?? activeSession?.onvifPassword ?? undefined,
          });
          renewedEventSubscription = await onvifClient.renewEventSubscription(renewTargetUrl, activeSession?.eventSubscriptionUri ?? null);
        } catch {
          renewedEventSubscription = null;
        }
      }
      const renewedSession = renewedEventSubscription?.session ?? null;
      const eventSubscriptionUri = renewedSession?.eventSubscriptionUri ?? activeSession?.eventSubscriptionUri ?? null;
      const eventSubscriptionReference = renewedSession?.eventSubscriptionReference ?? activeSession?.eventSubscriptionReference ?? null;
      const eventSubscriptionExpiresAt = renewedSession?.eventSubscriptionExpiresAt ?? activeSession?.eventSubscriptionExpiresAt ?? null;
      const renewalSummary = renewedEventSubscription?.responseStatus === 200
        ? `Renewed the ONVIF event subscription${eventSubscriptionExpiresAt != null ? ` until ${new Date(eventSubscriptionExpiresAt).toLocaleTimeString()}` : ""}.`
        : null;
      const authSummary = authState === "authenticated"
        ? `Authenticated via ${authMode.replaceAll("_", " ")}`
        : authState === "unauthenticated"
          ? "Unauthenticated"
          : authState === "failed"
            ? "Authentication failed"
            : `Authenticating via ${authMode.replaceAll("_", " ")}`;
      const heartbeatRecord: CameraLiveConnectionProbeResponse = {
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
        summary: `Heartbeat renewed the live session for ${parsed.data.cameraName}. ${authSummary}.${renewalSummary ? ` ${renewalSummary}` : ""}`.trim(),
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
          eventSubscriptionUri,
          eventSubscriptionReference,
          eventSubscriptionExpiresAt,
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
        eventSubscriptionUri,
        eventSubscriptionReference,
        eventSubscriptionExpiresAt,
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
          onvifUsername: summary.record.onvifUsername ?? null,
          onvifPassword: summary.record.onvifPassword ?? null,
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

    return apiJson(
      request,
      {
      ...summary,
      storedAt,
      historyCount: history.length,
      },
      undefined,
      { methods: API_METHODS },
    );
  } catch {
    return apiJson(
      request,
      {
        ok: false,
        error: "Failed to parse camera live connection payload.",
        errorCode: "internal_error",
      },
      { status: 500 },
      { methods: API_METHODS },
    );
  }
}
