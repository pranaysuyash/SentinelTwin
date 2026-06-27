import { describe, expect, test } from "bun:test";
import {
  computeExponentialBackoff,
  evaluateStreamRenewal,
  initializeStreamContinuity,
  recordStreamFailure,
  recordStreamSuccess,
  DEFAULT_RENEWAL_WINDOW_MS,
} from "@/lib/camera-live-stream-continuity";
import type { CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";

function createMockSession(overrides: Partial<CameraLiveSessionRecord> = {}): CameraLiveSessionRecord {
  const now = Date.now();
  return {
    sessionId: "live_1",
    status: "active",
    cameraId: "cam_1",
    cameraName: "Front Gate",
    sceneId: "scene_1",
    sceneName: "Campus",
    liveFeedUrl: "http://example.com/stream",
    feedLabel: "Front Gate HD",
    liveConnectionMode: "rtsp",
    liveConnectionStatus: "connected",
    liveSessionState: "connected",
    liveSessionStartedAt: now - 100_000,
    liveSessionConfirmedAt: now - 10_000,
    liveSessionExpiresAt: now + 120_000,
    transportSessionId: "trans_1",
    transportSessionState: "active",
    lastHeartbeatAt: now - 10_000,
    probeCount: 5,
    protocolProfile: "rtsp_session",
    authMode: "digest",
    authState: "authenticated",
    authRealm: null,
    authSessionId: null,
    authSessionExpiresAt: null,
    transportResponseStatus: 200,
    transportResponseStatusText: "OK",
    authChallengeHeader: null,
    authChallengeScheme: null,
    authChallengeRealm: null,
    onvifUsername: null,
    onvifPassword: null,
    eventSubscriptionUri: null,
    eventSubscriptionReference: null,
    eventSubscriptionExpiresAt: null,
    lastObservedAt: now,
    sessionExpiresAt: now + 120_000,
    lastAction: "heartbeat",
    summary: "Active RTSP session",
    ...overrides,
  };
}

describe("camera-live-stream-continuity", () => {
  test("computeExponentialBackoff calculates bounded intervals with jitter", () => {
    const { backoffMs: b0, jitteredMs: j0 } = computeExponentialBackoff(0, 1000, 60000);
    expect(b0).toBe(1000);
    expect(j0).toBeGreaterThanOrEqual(800);
    expect(j0).toBeLessThanOrEqual(1200);

    const { backoffMs: b3, jitteredMs: j3 } = computeExponentialBackoff(3, 1000, 60000);
    expect(b3).toBe(8000); // 1000 * 2^3
    expect(j3).toBeGreaterThan(0);
    expect(j3).toBeLessThanOrEqual(60000);

    const { backoffMs: b20 } = computeExponentialBackoff(20, 1000, 60000);
    expect(b20).toBe(60000); // Capped at maxMs
  });

  test("evaluateStreamRenewal triggers ONVIF subscription renewal inside 5-minute window", () => {
    const now = 1_700_000_000_000;
    const session = createMockSession({
      protocolProfile: "onvif_device",
      eventSubscriptionUri: "http://cam/events",
      eventSubscriptionExpiresAt: now + DEFAULT_RENEWAL_WINDOW_MS - 10_000, // Expires in 4 min 50s
    });

    const evalResult = evaluateStreamRenewal(session, now);
    expect(evalResult.shouldRenewNow).toBe(true);
    expect(evalResult.renewalType).toBe("onvif_event_subscription");
    expect(evalResult.reason).toContain("within 300s window");
  });

  test("evaluateStreamRenewal defers renewal when outside renewal window", () => {
    const now = 1_700_000_000_000;
    const session = createMockSession({
      protocolProfile: "onvif_device",
      eventSubscriptionUri: "http://cam/events",
      eventSubscriptionExpiresAt: now + 10 * 60 * 1_000, // Expires in 10 minutes
    });

    const evalResult = evaluateStreamRenewal(session, now);
    expect(evalResult.shouldRenewNow).toBe(false);
    expect(evalResult.nextRenewalAt).toBe(now + 5 * 60 * 1_000);
  });

  test("recordStreamFailure advances attempts and transitions to degraded then reconnecting", () => {
    const now = 1_700_000_000_000;
    const session = createMockSession();
    const initial = initializeStreamContinuity(session, now);
    expect(initial.continuityState).toBe("connected");

    const fail1 = recordStreamFailure(initial, "Timeout", now);
    expect(fail1.reconnectAttempts).toBe(1);
    expect(fail1.consecutiveFailures).toBe(1);
    expect(fail1.continuityState).toBe("degraded");
    expect(fail1.nextReconnectAt).toBeGreaterThan(now);

    const fail2 = recordStreamFailure(fail1, "Timeout 2", now + 2000);
    expect(fail2.continuityState).toBe("degraded");
    expect(fail2.consecutiveFailures).toBe(2);

    const fail3 = recordStreamFailure(fail2, "Connection refused", now + 4000);
    expect(fail3.continuityState).toBe("reconnecting");
    expect(fail3.consecutiveFailures).toBe(3);
  });

  test("recordStreamSuccess resets failures and restores connected state", () => {
    const now = 1_700_000_000_000;
    const session = createMockSession();
    let record = initializeStreamContinuity(session, now);
    record = recordStreamFailure(record, "Drop", now);
    record = recordStreamFailure(record, "Drop 2", now);
    expect(record.continuityState).toBe("degraded");

    const success = recordStreamSuccess(record, "Recovered", now + 5000);
    expect(success.continuityState).toBe("connected");
    expect(success.reconnectAttempts).toBe(0);
    expect(success.consecutiveFailures).toBe(0);
    expect(success.nextReconnectAt).toBeNull();
  });
});
