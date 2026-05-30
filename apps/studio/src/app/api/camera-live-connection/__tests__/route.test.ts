import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as unknown as NextRequest
);

const originalStoreDir = process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR;
const testStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-camera-live-connection-"));

process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR = testStoreDir;

afterAll(() => {
  rmSync(testStoreDir, { recursive: true, force: true });
  if (typeof originalStoreDir === "undefined") {
    delete process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR;
  } else {
    process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR = originalStoreDir;
  }
});

describe("camera-live-connection route", () => {
  beforeEach(() => {
    rmSync(join(testStoreDir, ".camera-live-connection-history"), { recursive: true, force: true });
  });

  test("archives a live connection probe and persists history", async () => {
    const response = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        action: "bind",
        protocol: "onvif",
        cameraId: "cam_front",
        cameraName: "Front Entrance",
        sceneId: "scene-camera",
        sceneName: "Camera Scene",
        submittedAt: 1_725_000_008_000,
        raw: JSON.stringify({
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          liveFeedUrl: "rtsp://camera.example.com/live",
          liveFeedLabel: "Front entrance live feed",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          authMode: "token",
          authState: "authenticated",
          authRealm: "front-entrance",
          authSessionId: "auth_session_cam_front_raw",
          authSessionExpiresAt: 1_725_000_128_000,
          notes: "ONVIF relay reachable",
        }),
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.historyCount).toBe(1);
    expect(body.summary).toContain("archived the live connection");
    expect(body.summary).toContain("Authenticated via token");
    expect(body.record.liveConnectionStatus).toBe("connected");
    expect(body.record.liveSessionExpiresAt).toBeGreaterThan(body.record.liveSessionConfirmedAt ?? 0);
    expect(body.record.transportSessionState).toBe("active");
    expect(body.record.protocolProfile).toBe("onvif_device");
    expect(body.record.authState).toBe("authenticated");
    expect(body.record.authMode).toBe("token");
    expect(body.record.authRealm).toBe("front-entrance");
    expect(body.record.authSessionId).toBe("auth_session_cam_front_raw");
    expect(body.record.authSessionExpiresAt).toBe(1_725_000_128_000);
    expect(body.record.transportSessionId).toContain("transport_session_");
    expect(body.record.lastHeartbeatAt).toBeGreaterThan(0);

    const history = await GET(createNextRequest("http://localhost/api/camera-live-connection"));
    const payload = await history.json();
    expect(payload.historyCount).toBe(1);
    expect(payload.latestSubmission.record.liveFeedUrl).toBe("rtsp://camera.example.com/live");
    expect(payload.activeSessionCount).toBe(1);
    expect(payload.activeSessions[0].sessionId).toBe(body.record.liveSessionId);
    expect(payload.activeSessions[0].transportSessionId).toBe(body.record.transportSessionId);
    expect(payload.activeSessions[0].protocolProfile).toBe("onvif_device");
  });

  test("refreshes an existing live session without changing the session id", async () => {
    const baseRequest = {
      source: "camera-inspector",
      action: "bind",
      protocol: "onvif" as const,
      cameraId: "cam_front",
      cameraName: "Front Entrance",
      sceneId: "scene-camera-refresh",
      sceneName: "Camera Scene Refresh",
      submittedAt: 1_725_000_018_000,
      raw: JSON.stringify({
        cameraId: "cam_front",
        cameraName: "Front Entrance",
        liveFeedUrl: "rtsp://camera.example.com/live",
        liveFeedLabel: "Front entrance live feed",
        liveConnectionMode: "onvif",
        liveConnectionStatus: "connected",
        authMode: "token",
        authState: "authenticated",
        authRealm: "front-entrance",
        authSessionId: "auth_session_cam_front_raw",
        authSessionExpiresAt: 1_725_000_128_000,
        notes: "ONVIF relay reachable",
      }),
    };

    const bindResponse = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseRequest),
    }));

    expect(bindResponse.status).toBe(200);
    const bindBody = await bindResponse.json();
    expect(bindBody.record.liveSessionId).toContain("live_session_cam_front");
    expect(bindBody.record.liveSessionExpiresAt).toBeGreaterThan(bindBody.record.liveSessionConfirmedAt ?? 0);
    expect(bindBody.record.transportSessionState).toBe("active");
    expect(bindBody.record.transportSessionId).toContain("transport_session_");
    expect(bindBody.record.lastHeartbeatAt).toBeGreaterThan(0);
    expect(bindBody.record.authState).toBe("authenticated");
    expect(bindBody.record.authMode).toBe("token");
    expect(bindBody.record.authRealm).toBe("front-entrance");
    expect(bindBody.record.authSessionId).toBe("auth_session_cam_front_raw");
    expect(bindBody.record.authSessionExpiresAt).toBe(1_725_000_128_000);

    const refreshResponse = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        action: "refresh",
        protocol: "onvif",
        endpointUrl: "http://camera.example.com/probe",
        liveFeedUrl: "rtsp://camera.example.com/live",
        feedLabel: "Front entrance live feed",
        cameraId: "cam_front",
        cameraName: "Front Entrance",
        sceneId: "scene-camera-refresh",
        sceneName: "Camera Scene Refresh",
        submittedAt: 1_725_000_019_000,
        liveSessionId: bindBody.record.liveSessionId,
        liveSessionStartedAt: bindBody.record.liveSessionStartedAt,
        liveSessionConfirmedAt: bindBody.record.liveSessionConfirmedAt,
        transportSessionId: bindBody.record.transportSessionId,
        raw: JSON.stringify({
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          liveFeedUrl: "rtsp://camera.example.com/live",
          liveFeedLabel: "Front entrance live feed",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          authMode: "token",
          authState: "authenticated",
          authRealm: "front-entrance",
          authSessionId: "auth_session_cam_front_raw",
          authSessionExpiresAt: 1_725_000_128_000,
          notes: "ONVIF relay reachable",
        }),
      }),
    }));

    expect(refreshResponse.status).toBe(200);
    const refreshBody = await refreshResponse.json();
    expect(refreshBody.ok).toBe(true);
    expect(refreshBody.action).toBe("refresh");
    expect(refreshBody.record.liveSessionId).toBe(bindBody.record.liveSessionId);
    expect(refreshBody.record.liveSessionState).toBe("connected");
    expect(refreshBody.summary).toContain("Refreshed live session");
    expect(refreshBody.record.liveSessionExpiresAt).toBeGreaterThanOrEqual(bindBody.record.liveSessionExpiresAt ?? 0);
    expect(refreshBody.record.transportSessionId).toBe(bindBody.record.transportSessionId);
    expect(refreshBody.record.transportSessionState).toBe("active");
    expect(refreshBody.record.lastHeartbeatAt).toBeGreaterThanOrEqual(bindBody.record.lastHeartbeatAt ?? 0);
    expect(refreshBody.record.authState).toBe("authenticated");
    expect(refreshBody.record.authMode).toBe("token");
    expect(refreshBody.record.authRealm).toBe("front-entrance");
    expect(refreshBody.record.authSessionId).toBe("auth_session_cam_front_raw");
    expect(refreshBody.record.authSessionExpiresAt).toBe(1_725_000_128_000);
  });

  test("records a heartbeat renewal without reprobing the device", async () => {
    const bindResponse = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        action: "bind",
        protocol: "onvif",
        cameraId: "cam_heartbeat",
        cameraName: "Heartbeat Camera",
        sceneId: "scene-camera-heartbeat",
        sceneName: "Camera Heartbeat Scene",
        submittedAt: 1_725_000_028_000,
        raw: JSON.stringify({
          cameraId: "cam_heartbeat",
          cameraName: "Heartbeat Camera",
          liveFeedUrl: "rtsp://camera.example.com/heartbeat",
          liveFeedLabel: "Heartbeat feed",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          authMode: "token",
          authState: "authenticated",
          authRealm: "heartbeat-scene",
          authSessionId: "auth_session_cam_heartbeat_raw",
          authSessionExpiresAt: 1_725_000_138_000,
          notes: "Initial bind",
        }),
      }),
    }));

    const bindBody = await bindResponse.json();

    const heartbeatResponse = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        action: "heartbeat",
        protocol: "onvif",
        cameraId: "cam_heartbeat",
        cameraName: "Heartbeat Camera",
        sceneId: "scene-camera-heartbeat",
        sceneName: "Camera Heartbeat Scene",
        submittedAt: 1_725_000_029_000,
        liveSessionId: bindBody.record.liveSessionId,
        transportSessionId: bindBody.record.transportSessionId,
        liveFeedUrl: "rtsp://camera.example.com/heartbeat",
        feedLabel: "Heartbeat feed",
        raw: "",
      }),
    }));

    expect(heartbeatResponse.status).toBe(200);
    const heartbeatBody = await heartbeatResponse.json();
    expect(heartbeatBody.ok).toBe(true);
    expect(heartbeatBody.action).toBe("heartbeat");
    expect(heartbeatBody.record.liveSessionId).toBe(bindBody.record.liveSessionId);
    expect(heartbeatBody.record.transportSessionId).toBe(bindBody.record.transportSessionId);
    expect(heartbeatBody.record.liveConnectionStatus).toBe("connected");
    expect(heartbeatBody.record.lastHeartbeatAt).toBeGreaterThanOrEqual(bindBody.record.lastHeartbeatAt ?? 0);
    expect(heartbeatBody.record.authState).toBe("authenticated");
    expect(heartbeatBody.record.authMode).toBe("token");
    expect(heartbeatBody.record.authRealm).toBe("heartbeat-scene");
    expect(heartbeatBody.record.authSessionId).toBe("auth_session_cam_heartbeat_raw");
    expect(heartbeatBody.record.authSessionExpiresAt).toBe(1_725_000_138_000);
    expect(heartbeatBody.summary).toContain("Heartbeat");
    expect(heartbeatBody.summary).toContain("Authenticated via token");

    const history = await GET(createNextRequest("http://localhost/api/camera-live-connection"));
    const payload = await history.json();
    expect(payload.historyCount).toBe(2);
    expect(payload.activeSessionCount).toBe(1);
    expect(payload.activeSessions[0].sessionId).toBe(bindBody.record.liveSessionId);
    expect(payload.activeSessions[0].lastAction).toBe("heartbeat");
  });

  test("probes an external live connection endpoint through the canonical route", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const mockedFetch = Object.assign(async (input: Parameters<typeof fetch>[0]) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
        expect(url).toContain("/probe");
        return new Response(JSON.stringify({
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          liveFeedUrl: "rtsp://camera.example.com/live",
          liveFeedLabel: "Front entrance live feed",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          authMode: "digest",
          authState: "authenticated",
          authRealm: "camera.example.com",
          authSessionId: "auth_session_cam_front_external",
          authSessionExpiresAt: 1_725_000_129_000,
          notes: "Connection healthy",
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }, {
        preconnect: async () => undefined,
      });
      globalThis.fetch = mockedFetch as typeof fetch;

      const response = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "camera-inspector",
          action: "bind",
          protocol: "onvif",
          endpointUrl: "http://camera.example.com/probe",
          liveFeedUrl: "http://camera.example.com/probe",
          feedLabel: "ONVIF relay",
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          sceneId: "scene-camera-external",
          sceneName: "External Camera Scene",
          submittedAt: 1_725_000_009_000,
          raw: "",
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.protocol).toBe("onvif");
      expect(body.record.liveConnectionStatus).toBe("connected");
      expect(body.record.authState).toBe("authenticated");
      expect(body.record.authMode).toBe("digest");
      expect(body.record.authRealm).toBe("camera.example.com");
      expect(body.record.authSessionId).toBe("auth_session_cam_front_external");
      expect(body.record.authSessionExpiresAt).toBe(1_725_000_129_000);
      expect(body.summary).toContain("ONVIF");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("parses an ONVIF-style XML live connection endpoint through the canonical route", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const mockedFetch = Object.assign(async (input: Parameters<typeof fetch>[0]) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
        expect(url).toContain("/probe");
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
          <Envelope>
            <Body>
              <ProbeResponse>
                <DeviceName>Front Entrance</DeviceName>
                <CameraId>cam_front</CameraId>
                <Uri>rtsp://camera.example.com/live</Uri>
                <Label>Front entrance live feed</Label>
                <Mode>onvif</Mode>
                <Status>connected</Status>
                <AuthMode>digest</AuthMode>
                <AuthState>authenticated</AuthState>
                <AuthRealm>camera.example.com</AuthRealm>
                <AuthSessionId>auth_session_cam_front_xml</AuthSessionId>
                <AuthSessionExpiresAt>1725000129000</AuthSessionExpiresAt>
                <Notes>ONVIF relay reachable</Notes>
              </ProbeResponse>
            </Body>
          </Envelope>`, {
          status: 200,
          headers: { "content-type": "application/xml" },
        });
      }, {
        preconnect: async () => undefined,
      });
      globalThis.fetch = mockedFetch as typeof fetch;

      const response = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "camera-inspector",
          action: "bind",
          protocol: "onvif",
          endpointUrl: "http://camera.example.com/probe",
          liveFeedUrl: "http://camera.example.com/probe",
          feedLabel: "ONVIF relay",
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          sceneId: "scene-camera-xml",
          sceneName: "XML Camera Scene",
          submittedAt: 1_725_000_009_500,
          raw: "",
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.protocol).toBe("onvif");
      expect(body.record.liveConnectionStatus).toBe("connected");
      expect(body.record.liveFeedUrl).toBe("rtsp://camera.example.com/live");
      expect(body.record.authState).toBe("authenticated");
      expect(body.record.authMode).toBe("digest");
      expect(body.record.authRealm).toBe("camera.example.com");
      expect(body.record.authSessionId).toBe("auth_session_cam_front_xml");
      expect(body.record.authSessionExpiresAt).toBe(1725000129000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("captures an authentication challenge as a negotiation step", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const mockedFetch = Object.assign(async (input: Parameters<typeof fetch>[0]) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
        expect(url).toContain("/probe");
        return new Response("", {
          status: 401,
          statusText: "Unauthorized",
          headers: {
            "content-type": "text/plain",
            "www-authenticate": 'Digest realm="camera.example.com", nonce="abc123"',
          },
        });
      }, {
        preconnect: async () => undefined,
      });
      globalThis.fetch = mockedFetch as typeof fetch;

      const response = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "camera-inspector",
          action: "bind",
          protocol: "onvif",
          endpointUrl: "http://camera.example.com/probe",
          liveFeedUrl: "http://camera.example.com/probe",
          feedLabel: "ONVIF relay",
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          sceneId: "scene-camera-challenge",
          sceneName: "Challenge Camera Scene",
          submittedAt: 1_725_000_009_250,
          raw: "",
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.record.liveConnectionStatus).toBe("connecting");
      expect(body.record.liveSessionState).toBe("probing");
      expect(body.record.transportSessionState).toBe("negotiating");
      expect(body.record.transportResponseStatus).toBe(401);
      expect(body.record.transportResponseStatusText).toBe("Unauthorized");
      expect(body.record.authState).toBe("authenticating");
      expect(body.record.authChallengeHeader).toContain("Digest realm=\"camera.example.com\"");
      expect(body.record.authChallengeScheme).toBe("digest");
      expect(body.record.authChallengeRealm).toBe("camera.example.com");
      expect(body.summary).toContain("challenge");

      const history = await GET(createNextRequest("http://localhost/api/camera-live-connection"));
      const payload = await history.json();
      expect(payload.activeSessionCount).toBe(1);
      expect(payload.activeSessions[0].status).toBe("active");
      expect(payload.activeSessions[0].transportResponseStatus).toBe(401);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("archives a disconnect action through the canonical route", async () => {
    const bindResponse = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        action: "bind",
        protocol: "onvif",
        cameraId: "cam_front",
        cameraName: "Front Entrance",
        sceneId: "scene-camera",
        sceneName: "Camera Scene",
        submittedAt: 1_725_000_020_000,
        raw: JSON.stringify({
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          liveFeedUrl: "rtsp://camera.example.com/live",
          liveFeedLabel: "Front entrance live feed",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          notes: "ONVIF relay reachable",
        }),
      }),
    }));

    expect(bindResponse.status).toBe(200);
    const bindBody = await bindResponse.json();

    const response = await POST(createNextRequest("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        action: "disconnect",
        protocol: "onvif",
        cameraId: "cam_front",
        cameraName: "Front Entrance",
        sceneId: "scene-camera",
        sceneName: "Camera Scene",
        submittedAt: 1_725_000_010_000,
        liveSessionId: bindBody.record.liveSessionId,
        transportSessionId: bindBody.record.transportSessionId,
        raw: "",
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.record.liveSessionId).toBe(bindBody.record.liveSessionId);
    expect(body.record.liveConnectionStatus).toBe("disconnected");
    expect(body.record.transportSessionId).toBe(bindBody.record.transportSessionId);
    expect(body.record.authState).toBe("unauthenticated");
    expect(body.record.authMode).toBe("onvif_digest");
    expect(body.record.authRealm).toBeNull();
    expect(body.record.authSessionId).toBe(bindBody.record.transportSessionId);
    expect(body.record.authSessionExpiresAt).toBeNull();
    expect(body.summary).toContain("Unauthenticated");
    expect(body.summary).toContain("Disconnected Front Entrance");
    expect(body.record.transportSessionState).toBe("closing");

    const history = await GET(createNextRequest("http://localhost/api/camera-live-connection"));
    const payload = await history.json();
    expect(payload.activeSessionCount).toBe(0);
  });
});
