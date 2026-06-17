import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/camera-live-session-health/route";
import { appendCameraLiveSessionRecord } from "@/lib/camera-live-session-registry";

describe("camera-live-session-health route", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "camera-live-health-"));
    process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR = tempRoot;

    appendCameraLiveSessionRecord({
      sessionId: "session_1",
      status: "active",
      cameraId: "cam_1",
      cameraName: "Front Cam",
      sceneId: "scene_1",
      sceneName: "Retail",
      liveFeedUrl: "rtsp://example.com/live",
      feedLabel: "Entrance",
      liveConnectionMode: "onvif",
      liveConnectionStatus: "connected",
      liveSessionState: "connected",
      liveSessionStartedAt: Date.now() - 10_000,
      liveSessionConfirmedAt: Date.now() - 5_000,
      liveSessionExpiresAt: Date.now() + 10_000,
      transportSessionId: "transport_1",
      transportSessionState: "active",
      lastHeartbeatAt: Date.now() - 1_000,
      probeCount: 2,
      protocolProfile: "onvif_device",
      authMode: "onvif_digest",
      authState: "authenticated",
      authRealm: "example",
      authSessionId: "auth_1",
      authSessionExpiresAt: Date.now() + 60_000,
      transportResponseStatus: 200,
      transportResponseStatusText: "OK",
      authChallengeHeader: null,
      authChallengeScheme: null,
      authChallengeRealm: null,
      onvifUsername: "operator",
      onvifPassword: "secret",
      eventSubscriptionUri: "http://example.com/events",
      eventSubscriptionReference: "sub_1",
      eventSubscriptionExpiresAt: Date.now() + 60_000,
      lastObservedAt: Date.now(),
      sessionExpiresAt: Date.now() + 10_000,
      lastAction: "bind",
      summary: "seed",
    });
  });

  afterEach(() => {
    delete process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR;
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("returns session health summary", async () => {
    const response = await GET(new NextRequest("http://localhost/api/camera-live-session-health"));
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; totals: { active: number } };
    expect(body.ok).toBe(true);
    expect(body.errorCode).toBeUndefined();
    expect(body.apiVersion).toBe("1");
    expect(typeof body.requestId).toBe("string");
    expect(body.requestId).toBeTruthy();
    expect(typeof body.timestamp).toBe("string");
    expect(body.totals.active).toBeGreaterThan(0);
  });

  test("renews a session", async () => {
    const response = await POST(new NextRequest("http://localhost/api/camera-live-session-health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "session_1", ttlMs: 300000 }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; renewedSessionId: string };
    expect(body.ok).toBe(true);
    expect(body.errorCode).toBeUndefined();
    expect(body.apiVersion).toBe("1");
    expect(typeof body.requestId).toBe("string");
    expect(body.requestId).toBeTruthy();
    expect(typeof body.timestamp).toBe("string");
    expect(body.renewedSessionId).toBe("session_1");
  });

  test("returns not-found for unknown sessions", async () => {
    const response = await POST(new NextRequest("http://localhost/api/camera-live-session-health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "missing-session" }),
    }));

    expect(response.status).toBe(404);
    const body = await response.json() as { ok: boolean; errorCode: string };
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("not_found");
  });
});
