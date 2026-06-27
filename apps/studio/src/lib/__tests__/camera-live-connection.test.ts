import { describe, expect, test } from "bun:test";

import { probeCameraLiveConnection } from "@/lib/camera-live-connection";

describe("camera live connection probe", () => {
  test("parses XML probes with auth challenge and transport metadata", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response([
      "<Connection>",
      "  <CameraId>cam-77</CameraId>",
      "  <CameraName>Dock West</CameraName>",
      "  <LiveFeedUrl>rtsp://camera.example.com/live</LiveFeedUrl>",
      "  <FeedLabel>ONVIF relay</FeedLabel>",
      "  <ConnectionMode>onvif</ConnectionMode>",
      "  <ConnectionStatus>connecting</ConnectionStatus>",
      "  <AuthMode>digest</AuthMode>",
      "  <AuthState>authenticating</AuthState>",
      "  <AuthRealm>camera-gateway</AuthRealm>",
      "  <TransportResponseStatus>401</TransportResponseStatus>",
      "  <TransportResponseStatusText>Unauthorized</TransportResponseStatusText>",
      "  <AuthChallengeHeader>Digest realm=\"camera-gateway\", nonce=\"abc\"</AuthChallengeHeader>",
      "  <AuthChallengeScheme>digest</AuthChallengeScheme>",
      "  <AuthChallengeRealm>camera-gateway</AuthChallengeRealm>",
      "  <Notes>Challenged by relay</Notes>",
      "</Connection>",
    ].join("\n"), {
      status: 401,
      statusText: "Unauthorized",
      headers: {
        "content-type": "application/xml",
        "www-authenticate": "Digest realm=\"camera-gateway\", nonce=\"abc\"",
      },
    })) as unknown as typeof fetch;

    try {
      const probe = await probeCameraLiveConnection({
        source: "camera-inspector",
        action: "bind",
        protocol: "onvif",
        endpointUrl: "https://example.com/onvif-probe",
        liveFeedUrl: null,
        cameraId: "cam-77",
        cameraName: "Dock West",
        sceneId: "scene-1",
        sceneName: "Camera Scene",
        submittedAt: 1710000008000,
        raw: "",
      });

      expect(probe.ok).toBe(true);
      expect(probe.protocol).toBe("onvif");
      expect(probe.summary).toContain("returned 401");
      expect(probe.sourceCount).toBe(1);
      expect(probe.errors.length).toBeGreaterThanOrEqual(0);
      expect(probe.record.cameraId).toBe("cam-77");
      expect(probe.record.cameraName).toBe("Dock West");
      expect(probe.record.liveConnectionMode).toBe("onvif");
      expect(probe.record.liveConnectionStatus).toBe("connecting");
      expect(probe.record.transportResponseStatus).toBe(401);
      expect(probe.record.transportResponseStatusText).toBe("Unauthorized");
      expect(probe.record.authChallengeScheme).toBe("digest");
      expect(probe.record.authChallengeRealm).toBe("camera-gateway");
      expect(probe.record.notes).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("captures ONVIF device information in the canonical note trail", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response([
      "<Envelope>",
      "  <GetDeviceInformationResponse>",
      "    <Manufacturer>Axis</Manufacturer>",
      "    <Model>Q3538-LVE</Model>",
      "    <FirmwareVersion>11.8.71</FirmwareVersion>",
      "    <SerialNumber>AX-8844</SerialNumber>",
      "    <HardwareId>HW-AX-8844</HardwareId>",
      "  </GetDeviceInformationResponse>",
      "</Envelope>",
    ].join("\n"), {
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "application/soap+xml",
      },
    })) as unknown as typeof fetch;

    try {
      const probe = await probeCameraLiveConnection({
        source: "camera-inspector",
        action: "bind",
        protocol: "onvif",
        endpointUrl: "https://camera.example.com/onvif",
        liveFeedUrl: null,
        cameraId: "cam-axis",
        cameraName: "Axis Lobby",
        sceneId: "scene-axis",
        sceneName: "Axis Scene",
        submittedAt: 1710000010000,
        raw: "",
      });

      expect(probe.ok).toBe(true);
      expect(probe.protocol).toBe("onvif");
      expect(probe.record.liveConnectionStatus).toBe("connected");
      expect(probe.record.protocolProfile).toBe("onvif_device");
      expect(probe.record.notes).toContain("ONVIF device information");
      expect(probe.record.notes).toContain("Axis · Q3538-LVE");
      expect(probe.record.transportResponseStatus).toBe(200);
      expect(probe.record.authState).toBe("authenticated");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("forwards ONVIF credentials through the canonical probe path", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const headers = new Headers(init?.headers ?? {});
      requests.push({ url, authorization: headers.get("authorization") });

      if (requests.length === 1) {
        return new Response("", {
          status: 401,
          statusText: "Unauthorized",
          headers: {
            "content-type": "text/plain",
            "www-authenticate": 'Digest realm="camera-gateway", nonce="abc123", qop="auth"',
          },
        });
      }

      if (requests.length === 2) {
        expect(url).toBe("https://camera.example.com/onvif");
        expect(headers.get("authorization")).toContain('Digest username="operator"');
        expect(headers.get("authorization")).toContain('realm="camera-gateway"');
        expect(headers.get("authorization")).toContain('nonce="abc123"');

        return new Response([
          "<Envelope>",
          "  <Body>",
          "    <GetDeviceInformationResponse>",
          "      <Manufacturer>Axis</Manufacturer>",
          "      <Model>Q3538-LVE</Model>",
          "      <FirmwareVersion>11.8.71</FirmwareVersion>",
          "      <SerialNumber>AX-8844</SerialNumber>",
          "      <HardwareId>HW-AX-8844</HardwareId>",
          "    </GetDeviceInformationResponse>",
          "    <SubscriptionReference>",
          "      <Address>http://camera.example.com/onvif/events</Address>",
          "    </SubscriptionReference>",
          "    <MediaUri>rtsp://camera.example.com/live</MediaUri>",
          "  </Body>",
          "</Envelope>",
        ].join("\n"), {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/soap+xml",
          },
        });
      }

      if (requests.length === 3) {
        expect(url).toBe("http://camera.example.com/onvif/events");
        expect(headers.get("authorization")).toBeNull();
        return new Response("", {
          status: 401,
          statusText: "Unauthorized",
          headers: {
            "content-type": "text/plain",
            "www-authenticate": 'Digest realm="camera-gateway", nonce="event123", qop="auth"',
          },
        });
      }

      expect(url).toBe("http://camera.example.com/onvif/events");
      expect(headers.get("authorization")).toContain('Digest username="operator"');
      expect(headers.get("authorization")).toContain('realm="camera-gateway"');
      expect(headers.get("authorization")).toContain('nonce="event123"');

      return new Response([
        "<Envelope>",
        "  <Body>",
        "    <SubscribeResponse>",
        "      <SubscriptionReference>",
        "        <Address>http://camera.example.com/onvif/events/subscription/beta</Address>",
        "      </SubscriptionReference>",
        "      <TerminationTime>2026-05-30T15:00:00Z</TerminationTime>",
        "    </SubscribeResponse>",
        "  </Body>",
        "</Envelope>",
      ].join("\n"), {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": "application/soap+xml",
        },
      });
    }) as unknown as typeof fetch;

    try {
      const probe = await probeCameraLiveConnection({
        source: "camera-inspector",
        action: "bind",
        protocol: "onvif",
        endpointUrl: "https://camera.example.com/onvif",
        liveFeedUrl: null,
        cameraId: "cam-axis-auth",
        cameraName: "Axis Lobby",
        sceneId: "scene-axis-auth",
        sceneName: "Axis Auth Scene",
        submittedAt: 1710000015000,
        onvifUsername: "operator",
        onvifPassword: "secret",
        raw: "",
      });

      const result = await probe;
      expect(requests.length).toBe(4);
      expect(requests[0].authorization).toBeNull();
      expect(requests[1].authorization).toContain("Digest ");
      expect(requests[2].url).toBe("http://camera.example.com/onvif/events");
      expect(requests[2].authorization).toBeNull();
      expect(requests[3].url).toBe("http://camera.example.com/onvif/events");
      expect(requests[3].authorization).toContain("Digest ");
      expect(result.record.liveConnectionStatus).toBe("connected");
      expect(result.record.authState).toBe("authenticated");
      expect(result.record.protocolProfile).toBe("onvif_device");
      expect(result.record.eventSubscriptionUri).toBe("http://camera.example.com/onvif/events");
      expect(result.record.eventSubscriptionReference).toBe("http://camera.example.com/onvif/events/subscription/beta");
      expect(result.record.eventSubscriptionExpiresAt).toBe(Date.parse("2026-05-30T15:00:00Z"));
      expect(result.record.notes).toContain("ONVIF device information");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("disconnect action produces a disconnected record with idle session state", async () => {
    const probe = await probeCameraLiveConnection({
      source: "camera-inspector",
      action: "disconnect",
      protocol: "onvif",
      endpointUrl: null,
      liveFeedUrl: null,
      cameraId: "cam-disconnect",
      cameraName: "Disconnect Cam",
      sceneId: "scene-disconnect",
      sceneName: "Disconnect Scene",
      submittedAt: 1710000020000,
      liveSessionId: "live_session_disconnect_1",
      liveSessionStartedAt: 1710000010000,
      liveSessionConfirmedAt: 1710000015000,
      transportSessionId: "transport_session_disconnect_1",
      raw: "",
    });

    expect(probe.ok).toBe(true);
    expect(probe.action).toBe("disconnect");
    expect(probe.record.liveConnectionStatus).toBe("disconnected");
    expect(probe.record.liveSessionState).toBe("idle");
    expect(probe.record.transportSessionState).toBe("closing");
    expect(probe.record.authState).toBe("unauthenticated");
    expect(probe.record.liveSessionId).toBe("live_session_disconnect_1");
    expect(probe.record.transportSessionId).toBe("transport_session_disconnect_1");
    expect(probe.record.liveSessionExpiresAt).toBeNull();
    expect(probe.record.lastHeartbeatAt).toBeNull();
    expect(probe.record.probeCount).toBe(0);
  });

  test("heartbeat action preserves active session fields and increments probe count", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          cameraId: "cam-heartbeat",
          cameraName: "Heartbeat Cam",
          liveFeedUrl: "rtsp://camera.example.com/live",
          liveFeedLabel: "Heartbeat Feed",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          liveSessionId: "live_session_heartbeat_1",
          liveSessionState: "connected",
          liveSessionStartedAt: 1710000010000,
          liveSessionConfirmedAt: 1710000015000,
          liveSessionExpiresAt: 1710000035000,
          transportSessionId: "transport_session_heartbeat_1",
          transportSessionState: "active",
          lastHeartbeatAt: 1710000025000,
          probeCount: 5,
          protocolProfile: "onvif_device",
          authMode: "onvif_digest",
          authState: "authenticated",
          authRealm: "camera-gateway",
          authSessionId: "auth_session_heartbeat_1",
          authSessionExpiresAt: 1710000035000,
          transportResponseStatus: 200,
          transportResponseStatusText: "OK",
          authChallengeHeader: null,
          authChallengeScheme: null,
          authChallengeRealm: null,
          eventSubscriptionUri: "http://camera.example.com/onvif/events",
          eventSubscriptionReference: "http://camera.example.com/onvif/events/subscription/1",
          eventSubscriptionExpiresAt: 1710000040000,
          notes: "Heartbeat accepted",
          timestamp: 1710000025000,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    try {
      const probe = await probeCameraLiveConnection({
        source: "camera-inspector",
        action: "heartbeat",
        protocol: "onvif",
        endpointUrl: "https://camera.example.com/onvif",
        liveFeedUrl: "rtsp://camera.example.com/live",
        feedLabel: "Heartbeat Feed",
        cameraId: "cam-heartbeat",
        cameraName: "Heartbeat Cam",
        sceneId: "scene-heartbeat",
        sceneName: "Heartbeat Scene",
        submittedAt: 1710000025000,
        liveSessionId: "live_session_heartbeat_1",
        liveSessionStartedAt: 1710000010000,
        liveSessionConfirmedAt: 1710000015000,
        transportSessionId: "transport_session_heartbeat_1",
        authMode: "onvif_digest",
        authState: "authenticated",
        authSessionId: "auth_session_heartbeat_1",
        authSessionExpiresAt: 1710000035000,
        raw: "",
      });

      expect(probe.ok).toBe(true);
      expect(probe.action).toBe("heartbeat");
      expect(probe.record.liveConnectionStatus).toBe("connected");
      expect(probe.record.liveSessionState).toBe("connected");
      expect(probe.record.transportSessionState).toBe("active");
      expect(probe.record.liveSessionId).toBe("live_session_heartbeat_1");
      expect(probe.record.transportSessionId).toBe("transport_session_heartbeat_1");
      expect(probe.record.liveFeedUrl).toBe("rtsp://camera.example.com/live");
      expect(probe.record.liveFeedLabel).toBe("Heartbeat Feed");
      expect(probe.record.authMode).toBe("onvif_digest");
      expect(probe.record.authState).toBe("authenticated");
      expect(probe.record.authSessionId).toBe("auth_session_heartbeat_1");
      expect(probe.record.probeCount).toBe(1);
      expect(probe.record.lastHeartbeatAt).not.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("refresh action reuses provided session identifiers and confirms connection", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          cameraId: "cam-refresh",
          cameraName: "Refresh Cam",
          liveFeedUrl: "rtsp://refresh.example.com/live",
          liveFeedLabel: "Refresh Feed",
          liveConnectionMode: "rtsp",
          liveConnectionStatus: "connected",
          liveSessionId: "live_session_refresh_1",
          liveSessionState: "connected",
          liveSessionStartedAt: 1710000010000,
          liveSessionConfirmedAt: 1710000015000,
          liveSessionExpiresAt: 1710000035000,
          transportSessionId: "transport_session_refresh_1",
          transportSessionState: "active",
          lastHeartbeatAt: 1710000030000,
          probeCount: 3,
          protocolProfile: "rtsp_session",
          authMode: "digest",
          authState: "authenticated",
          authRealm: "camera-gateway",
          authSessionId: "auth_session_refresh_1",
          authSessionExpiresAt: 1710000035000,
          transportResponseStatus: 200,
          transportResponseStatusText: "OK",
          authChallengeHeader: null,
          authChallengeScheme: null,
          authChallengeRealm: null,
          eventSubscriptionUri: null,
          eventSubscriptionReference: null,
          eventSubscriptionExpiresAt: null,
          notes: "Refreshed",
          timestamp: 1710000030000,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    try {
      const probe = await probeCameraLiveConnection({
        source: "camera-inspector",
        action: "refresh",
        protocol: "rtsp",
        endpointUrl: "https://refresh.example.com/probe",
        liveFeedUrl: null,
        cameraId: "cam-refresh",
        cameraName: "Refresh Cam",
        sceneId: "scene-refresh",
        sceneName: "Refresh Scene",
        submittedAt: 1710000030000,
        liveSessionId: "live_session_refresh_1",
        liveSessionStartedAt: 1710000010000,
        transportSessionId: "transport_session_refresh_1",
        raw: "",
      });

      expect(probe.ok).toBe(true);
      expect(probe.action).toBe("refresh");
      expect(probe.record.liveConnectionStatus).toBe("connected");
      expect(probe.record.liveConnectionMode).toBe("rtsp");
      expect(probe.record.liveSessionId).toBe("live_session_refresh_1");
      expect(probe.record.transportSessionId).toBe("transport_session_refresh_1");
      expect(probe.record.liveFeedUrl).toBe("rtsp://refresh.example.com/live");
      expect(probe.record.protocolProfile).toBe("rtsp_session");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
