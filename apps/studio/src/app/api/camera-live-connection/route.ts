import { appendCameraLiveConnectionHistory, loadCameraLiveConnectionHistory } from "@/lib/camera-live-connection-history";
import { appendCameraLiveSessionRecord, closeCameraLiveSessionRecord, pruneExpiredCameraLiveSessionRegistry, renewCameraLiveSessionRecord, toCameraLiveSessionRecord, type CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { buildCameraLiveConnectionRecord, CameraLiveConnectionProbeRequestSchema, probeCameraLiveConnection, type CameraLiveConnectionProbeRequest, type CameraLiveConnectionProbeResponse } from "@/lib/camera-live-connection";
import { OnvifClient } from "@/lib/onvif-client";
import { corsJson, corsNoContent } from "@/lib/api-cors";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { startSubscriptionScheduler, runSubscriptionCycle } from "@/lib/subscription-scheduler";

import { NextRequest } from "next/server";

const ONVIF_EVENT_SUBSCRIPTION_RENEWAL_WINDOW_MS = 5 * 60 * 1000;

let scheduler: { stop: () => void } | null = null;

function ensureScheduler() {
  if (typeof globalThis !== "undefined" && !scheduler) {
    scheduler = startSubscriptionScheduler();
  }
}

ensureScheduler();

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
        record: buildCameraLiveConnectionRecord(
          {
            ...parsed.data,
            action: "heartbeat",
            liveSessionId: sessionId,
            liveSessionStartedAt: activeSession?.liveSessionStartedAt ?? storedAt,
            liveSessionConfirmedAt: storedAt,
            transportSessionId,
            authMode,
            authState,
            authRealm,
            authSessionId,
            authSessionExpiresAt,
            submittedAt: storedAt,
          },
          {
            status: "connected",
            liveConnectionMode: parsed.data.protocol,
            liveFeedUrl: parsed.data.liveFeedUrl ?? activeSession?.liveFeedUrl ?? null,
            liveFeedLabel: parsed.data.feedLabel ?? activeSession?.feedLabel ?? null,
            responseStatus: transportResponseStatus,
            responseStatusText: transportResponseStatusText,
            authChallengeHeader,
            authChallengeScheme,
            authChallengeRealm,
            eventSubscriptionUri,
            eventSubscriptionReference,
            eventSubscriptionExpiresAt,
          },
        ),
        errors: [],
        sourceCount: 0,
      };

      renewCameraLiveSessionRecord(
        toCameraLiveSessionRecord(heartbeatRecord.record, {
          sceneId: parsed.data.sceneId ?? null,
          sceneName: parsed.data.sceneName ?? null,
          summary: heartbeatRecord.summary,
          lastAction: "heartbeat",
          lastObservedAt: storedAt,
          sessionExpiresAt: heartbeatRecord.record.liveSessionExpiresAt,
        }),
      );

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
        appendCameraLiveSessionRecord(
          toCameraLiveSessionRecord(summary.record, {
            sceneId: parsed.data.sceneId ?? null,
            sceneName: parsed.data.sceneName ?? null,
            summary: summary.summary,
            lastAction: summary.action,
            lastObservedAt: storedAt,
            sessionExpiresAt: summary.record.liveSessionExpiresAt,
            status: summary.record.liveConnectionStatus === "connected" || summary.record.liveConnectionStatus === "connecting" ? "active" : "closed",
          }),
        );
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
