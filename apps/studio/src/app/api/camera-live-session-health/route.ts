import { z } from "zod";

import { loadCameraLiveSessionRegistry, renewCameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { corsJson, corsNoContent } from "@/lib/api-cors";

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

  return {
    sessions,
    totals: {
      active: sessions.filter((session) => session.status === "active").length,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      closed: sessions.filter((session) => session.status === "closed").length,
    },
    expiringSoon,
    generatedAt: now,
  };
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function GET(request: NextRequest) {
  return corsJson({ ok: true, ...getSessionHealthSummary() }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RenewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return corsJson({ ok: false, error: "Invalid renewal payload.", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, request, { status: 400 }, { methods: ["GET", "POST", "OPTIONS"] });
    }

    const sessions = loadCameraLiveSessionRegistry();
    const target = sessions.find((session) => session.sessionId === parsed.data.sessionId);
    if (!target) {
      return corsJson({ ok: false, error: "Session not found." }, request, { status: 404 }, { methods: ["GET", "POST", "OPTIONS"] });
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

    return corsJson({ ok: true, renewedSessionId: target.sessionId, sessionExpiresAt, ...getSessionHealthSummary() }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
  } catch {
    return corsJson({ ok: false, error: "Failed to parse renewal payload." }, request, { status: 400 }, { methods: ["GET", "POST", "OPTIONS"] });
  }
}
