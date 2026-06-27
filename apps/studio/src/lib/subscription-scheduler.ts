import { OnvifClient } from "@/lib/onvif-client";
import { pruneExpiredCameraLiveSessionRegistry, renewCameraLiveSessionRecord, toCameraLiveSessionRecord, type CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";
import { buildCameraLiveConnectionRecord } from "@/lib/camera-live-connection";

const RENEWAL_WINDOW_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 60_000;

function shouldRenew(activeSession: CameraLiveSessionRecord, now: number): boolean {
  if (activeSession.status !== "active") return false;
  if (activeSession.protocolProfile !== "onvif_device") return false;
  if (!activeSession.eventSubscriptionReference && !activeSession.eventSubscriptionUri) return false;
  if (activeSession.eventSubscriptionExpiresAt == null) return true;
  return activeSession.eventSubscriptionExpiresAt - now <= RENEWAL_WINDOW_MS;
}

type RenewalResult = {
  sessionId: string;
  cameraId: string;
  renewed: boolean;
  error: string | null;
};

async function renewSession(activeSession: CameraLiveSessionRecord, now: number): Promise<RenewalResult> {
  const targetUrl = activeSession.eventSubscriptionReference ?? activeSession.eventSubscriptionUri;
  if (!targetUrl) {
    return { sessionId: activeSession.sessionId, cameraId: activeSession.cameraId, renewed: false, error: null };
  }

  try {
    const onvifClient = new OnvifClient({
      address: targetUrl,
      username: activeSession.onvifUsername ?? undefined,
      password: activeSession.onvifPassword ?? undefined,
    });
    const renewed = await onvifClient.renewEventSubscription(targetUrl, activeSession.eventSubscriptionUri ?? null);
    if (!renewed) {
      return { sessionId: activeSession.sessionId, cameraId: activeSession.cameraId, renewed: false, error: "Renewal returned null response" };
    }
    const session = renewed.session ?? null;

    if (renewed?.responseStatus === 200 && session) {
      const request = {
        source: "subscription-scheduler" as const,
        action: "heartbeat" as const,
        protocol: "onvif" as const,
        cameraId: activeSession.cameraId,
        cameraName: activeSession.cameraName,
        sceneId: activeSession.sceneId ?? undefined,
        sceneName: activeSession.sceneName ?? undefined,
        liveSessionId: activeSession.sessionId,
        liveSessionStartedAt: activeSession.liveSessionStartedAt ?? undefined,
        submittedAt: now,
        raw: "",
      };
      const recordInput = {
        status: "connected" as const,
        liveConnectionMode: "onvif" as const,
        liveFeedUrl: activeSession.liveFeedUrl,
        liveFeedLabel: activeSession.feedLabel,
        responseStatus: renewed.responseStatus,
        responseStatusText: renewed.responseStatusText,
        authChallengeHeader: null,
        authChallengeScheme: null,
        authChallengeRealm: null,
        eventSubscriptionUri: session.eventSubscriptionUri ?? activeSession.eventSubscriptionUri,
        eventSubscriptionReference: session.eventSubscriptionReference ?? activeSession.eventSubscriptionReference,
        eventSubscriptionExpiresAt: session.eventSubscriptionExpiresAt ?? activeSession.eventSubscriptionExpiresAt,
        notes: `Subscription renewed by scheduler at ${new Date(now).toISOString()}.`,
        timestamp: now,
      };
      renewCameraLiveSessionRecord(
        toCameraLiveSessionRecord(
          buildCameraLiveConnectionRecord(request, recordInput),
          {
            sceneId: activeSession.sceneId ?? null,
            sceneName: activeSession.sceneName ?? null,
            summary: `Subscription renewed by scheduler (expires ${new Date(session.eventSubscriptionExpiresAt ?? now).toISOString()}).`,
            lastAction: "heartbeat",
            lastObservedAt: now,
            sessionExpiresAt: session.eventSubscriptionExpiresAt ?? activeSession.sessionExpiresAt,
          },
        ),
      );
      return { sessionId: activeSession.sessionId, cameraId: activeSession.cameraId, renewed: true, error: null };
    }

    return { sessionId: activeSession.sessionId, cameraId: activeSession.cameraId, renewed: false, error: `Renewal returned HTTP ${renewed?.responseStatus ?? "no response"}` };
  } catch (err) {
    return { sessionId: activeSession.sessionId, cameraId: activeSession.cameraId, renewed: false, error: String(err) };
  }
}

export async function runSubscriptionCycle(): Promise<{ renewed: number; failed: number; results: RenewalResult[] }> {
  const now = Date.now();
  const activeSessions = pruneExpiredCameraLiveSessionRegistry().filter((s) => s.status === "active");
  const results: RenewalResult[] = [];

  for (const session of activeSessions) {
    if (!shouldRenew(session, now)) continue;
    const result = await renewSession(session, now);
    results.push(result);
  }

  return {
    renewed: results.filter((r) => r.renewed).length,
    failed: results.filter((r) => r.error).length,
    results,
  };
}

export function startSubscriptionScheduler(): { stop: () => void } {
  const timer = setInterval(() => {
    runSubscriptionCycle().catch(() => {});
  }, POLL_INTERVAL_MS);

  runSubscriptionCycle().catch(() => {});

  return {
    stop: () => clearInterval(timer),
  };
}