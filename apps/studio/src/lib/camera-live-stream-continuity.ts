import type { CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";

export type StreamContinuityState = "connected" | "degraded" | "reconnecting" | "disconnected";

export interface StreamContinuityRecord {
  sessionId: string;
  cameraId: string;
  continuityState: StreamContinuityState;
  reconnectAttempts: number;
  lastAttemptAt: number | null;
  nextReconnectAt: number | null;
  nextScheduledRenewalAt: number | null;
  consecutiveFailures: number;
  backoffWindowMs: number;
  summary: string;
}

export interface StreamRenewalEvaluation {
  sessionId: string;
  cameraId: string;
  shouldRenewNow: boolean;
  renewalType: "onvif_event_subscription" | "session_ttl" | "none";
  nextRenewalAt: number | null;
  reason: string;
}

export const DEFAULT_BACKOFF_BASE_MS = 1_000;
export const DEFAULT_BACKOFF_MAX_MS = 60_000;
export const DEFAULT_RENEWAL_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes
export const DEFAULT_SESSION_RENEWAL_WINDOW_MS = 60 * 1_000; // 1 minute

/**
 * Computes exponential backoff with +/- 20% jitter.
 */
export function computeExponentialBackoff(
  attempt: number,
  baseMs = DEFAULT_BACKOFF_BASE_MS,
  maxMs = DEFAULT_BACKOFF_MAX_MS,
): { backoffMs: number; jitteredMs: number } {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const rawBackoff = Math.min(maxMs, baseMs * Math.pow(2, Math.min(safeAttempt, 10)));
  // Add deterministic/pseudo-random jitter (+/- 20%)
  const jitterFactor = 0.8 + ((safeAttempt * 13) % 41) / 100;
  const jitteredMs = Math.round(Math.min(maxMs, rawBackoff * jitterFactor));
  return { backoffMs: rawBackoff, jitteredMs };
}

/**
 * Evaluates whether a session needs subscription or TTL renewal.
 */
export function evaluateStreamRenewal(
  session: CameraLiveSessionRecord,
  now = Date.now(),
): StreamRenewalEvaluation {
  if (session.status !== "active") {
    return {
      sessionId: session.sessionId,
      cameraId: session.cameraId,
      shouldRenewNow: false,
      renewalType: "none",
      nextRenewalAt: null,
      reason: `Session is ${session.status}, no renewal required.`,
    };
  }

  // Check ONVIF Event Subscription lease
  if (
    session.protocolProfile === "onvif_device" &&
    (session.eventSubscriptionReference || session.eventSubscriptionUri)
  ) {
    if (session.eventSubscriptionExpiresAt == null) {
      return {
        sessionId: session.sessionId,
        cameraId: session.cameraId,
        shouldRenewNow: true,
        renewalType: "onvif_event_subscription",
        nextRenewalAt: now,
        reason: "ONVIF event subscription expiry is unknown; renewal needed immediately.",
      };
    }
    const msUntilExpiry = session.eventSubscriptionExpiresAt - now;
    if (msUntilExpiry <= DEFAULT_RENEWAL_WINDOW_MS) {
      return {
        sessionId: session.sessionId,
        cameraId: session.cameraId,
        shouldRenewNow: true,
        renewalType: "onvif_event_subscription",
        nextRenewalAt: now,
        reason: `ONVIF event subscription expires in ${Math.max(0, Math.round(msUntilExpiry / 1000))}s (within ${DEFAULT_RENEWAL_WINDOW_MS / 1000}s window).`,
      };
    }
    return {
      sessionId: session.sessionId,
      cameraId: session.cameraId,
      shouldRenewNow: false,
      renewalType: "onvif_event_subscription",
      nextRenewalAt: session.eventSubscriptionExpiresAt - DEFAULT_RENEWAL_WINDOW_MS,
      reason: `ONVIF event subscription valid for ${Math.round(msUntilExpiry / 1000)}s. Next renewal scheduled ahead of expiry.`,
    };
  }

  // Check Session TTL lease
  if (session.sessionExpiresAt != null) {
    const msUntilExpiry = session.sessionExpiresAt - now;
    if (msUntilExpiry <= DEFAULT_SESSION_RENEWAL_WINDOW_MS) {
      return {
        sessionId: session.sessionId,
        cameraId: session.cameraId,
        shouldRenewNow: true,
        renewalType: "session_ttl",
        nextRenewalAt: now,
        reason: `Session TTL expires in ${Math.max(0, Math.round(msUntilExpiry / 1000))}s; renewal needed.`,
      };
    }
    return {
      sessionId: session.sessionId,
      cameraId: session.cameraId,
      shouldRenewNow: false,
      renewalType: "session_ttl",
      nextRenewalAt: session.sessionExpiresAt - DEFAULT_SESSION_RENEWAL_WINDOW_MS,
      reason: `Session TTL healthy for ${Math.round(msUntilExpiry / 1000)}s.`,
    };
  }

  return {
    sessionId: session.sessionId,
    cameraId: session.cameraId,
    shouldRenewNow: false,
    renewalType: "none",
    nextRenewalAt: null,
    reason: "Active session has indefinite TTL.",
  };
}

/**
 * Initializes a continuity record from a live session record.
 */
export function initializeStreamContinuity(session: CameraLiveSessionRecord, now = Date.now()): StreamContinuityRecord {
  const renewal = evaluateStreamRenewal(session, now);
  const isConnected = session.status === "active" && session.liveConnectionStatus === "connected";
  return {
    sessionId: session.sessionId,
    cameraId: session.cameraId,
    continuityState: isConnected ? "connected" : session.status === "active" ? "degraded" : "disconnected",
    reconnectAttempts: 0,
    lastAttemptAt: null,
    nextReconnectAt: null,
    nextScheduledRenewalAt: renewal.nextRenewalAt,
    consecutiveFailures: 0,
    backoffWindowMs: 0,
    summary: isConnected
      ? `Stream connected and healthy. ${renewal.reason}`
      : `Stream status is ${session.liveConnectionStatus}.`,
  };
}

/**
 * Records a stream or probe failure, advancing exponential backoff state.
 */
export function recordStreamFailure(
  current: StreamContinuityRecord,
  errorReason: string,
  now = Date.now(),
  baseMs = DEFAULT_BACKOFF_BASE_MS,
  maxMs = DEFAULT_BACKOFF_MAX_MS,
): StreamContinuityRecord {
  const nextFailures = current.consecutiveFailures + 1;
  const nextAttempts = current.reconnectAttempts + 1;
  const { jitteredMs } = computeExponentialBackoff(nextAttempts - 1, baseMs, maxMs);
  const nextState: StreamContinuityState = nextFailures >= 3 ? "reconnecting" : "degraded";

  return {
    ...current,
    continuityState: nextState,
    reconnectAttempts: nextAttempts,
    consecutiveFailures: nextFailures,
    lastAttemptAt: now,
    nextReconnectAt: now + jitteredMs,
    backoffWindowMs: jitteredMs,
    summary: `Stream ${nextState} after ${nextFailures} failure(s): ${errorReason}. Retrying in ${Math.round(jitteredMs / 1000)}s.`,
  };
}

/**
 * Records a successful connection or heartbeat probe, resetting backoff.
 */
export function recordStreamSuccess(
  current: StreamContinuityRecord,
  successMessage?: string,
  now = Date.now(),
): StreamContinuityRecord {
  return {
    ...current,
    continuityState: "connected",
    reconnectAttempts: 0,
    consecutiveFailures: 0,
    lastAttemptAt: now,
    nextReconnectAt: null,
    backoffWindowMs: 0,
    summary: successMessage || "Stream connected and stable.",
  };
}
