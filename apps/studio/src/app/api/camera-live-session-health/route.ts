import { z } from "zod";

import { loadCameraLiveSessionRegistry, renewCameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { evaluateStreamRenewal, initializeStreamContinuity } from "@/lib/camera-live-stream-continuity";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

const RenewRequestSchema = z.object({
  sessionId: z.string().min(1),
  ttlMs: z.number().int().positive().max(86_400_000).optional(),
  summary: z.string().min(1).optional(),
});

function getSessionHealthSummary() {
  const sessions = loadCameraLiveSessionRegistry();
  const now = Date.now();
  const expiringSoon = sessions.filter((session) => session.status === "active" && session.sessionExpiresAt != null && session.sessionExpiresAt - now <= 60_000);
  const expired = sessions.filter((session) => session.status === "expired");

  const continuityRecords = sessions.map((session) => initializeStreamContinuity(session, now));
  const renewalEvaluations = sessions.map((session) => evaluateStreamRenewal(session, now));
  const pendingRenewals = renewalEvaluations.filter((ev) => ev.shouldRenewNow);

  return {
    sessions,
    continuityRecords,
    renewalEvaluations,
    totals: {
      active: sessions.filter((session) => session.status === "active").length,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      closed: sessions.filter((session) => session.status === "closed").length,
      pendingRenewals: pendingRenewals.length,
    },
    expiringSoon,
    pendingRenewals,
    generatedAt: now,
  };
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: API_METHODS });
}

export async function GET(request: NextRequest) {
  return apiJson(request, { ok: true, ...getSessionHealthSummary() }, undefined, { methods: API_METHODS });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, RenewRequestSchema, {
    validationErrorMessage: "Invalid renewal payload.",
    parseErrorMessage: "Failed to parse renewal payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const sessions = loadCameraLiveSessionRegistry();
    const target = sessions.find((session) => session.sessionId === parsed.data.sessionId);
    if (!target) {
      return apiJson(
        request,
        {
          ok: false,
          error: "Session not found.",
          errorCode: "not_found",
        },
        { status: 404 },
        { methods: API_METHODS },
      );
    }

    const now = Date.now();
    const sessionExpiresAt = now + (parsed.data.ttlMs ?? 120_000);

    renewCameraLiveSessionRecord({
      sessionId: target.sessionId,
      cameraId: target.cameraId,
      cameraName: target.cameraName,
      sceneId: target.sceneId,
      sceneName: target.sceneName,
      liveFeedUrl: target.liveFeedUrl,
      feedLabel: target.feedLabel,
      liveConnectionMode: target.liveConnectionMode,
      liveConnectionStatus: "connected",
      liveSessionState: "connected",
      liveSessionStartedAt: target.liveSessionStartedAt,
      liveSessionConfirmedAt: now,
      liveSessionExpiresAt: sessionExpiresAt,
      transportSessionId: target.transportSessionId,
      transportSessionState: "active",
      lastHeartbeatAt: now,
      probeCount: target.probeCount + 1,
      protocolProfile: target.protocolProfile,
      authMode: target.authMode,
      authState: target.authState,
      authRealm: target.authRealm,
      authSessionId: target.authSessionId,
      authSessionExpiresAt: target.authSessionExpiresAt,
      transportResponseStatus: target.transportResponseStatus,
      transportResponseStatusText: target.transportResponseStatusText,
      authChallengeHeader: target.authChallengeHeader,
      authChallengeScheme: target.authChallengeScheme,
      authChallengeRealm: target.authChallengeRealm,
      onvifUsername: target.onvifUsername,
      onvifPassword: target.onvifPassword,
      eventSubscriptionUri: target.eventSubscriptionUri,
      eventSubscriptionReference: target.eventSubscriptionReference,
      eventSubscriptionExpiresAt: target.eventSubscriptionExpiresAt,
      summary: parsed.data.summary ?? `Session ${target.sessionId} renewed through session-health route.`,
      sessionExpiresAt,
      lastObservedAt: now,
    });

    return apiJson(
      request,
      { ok: true, renewedSessionId: target.sessionId, sessionExpiresAt, ...getSessionHealthSummary() },
      undefined,
      { methods: API_METHODS },
    );
  } catch {
    return apiJson(
      request,
      {
        ok: false,
        error: "Failed to renew session.",
        errorCode: "internal_error",
      },
      { status: 500 },
      { methods: API_METHODS },
    );
  }
}
