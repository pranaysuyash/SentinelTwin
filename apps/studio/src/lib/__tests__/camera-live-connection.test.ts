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
      expect(probe.errors).toHaveLength(0);
      expect(probe.record.cameraId).toBe("cam-77");
      expect(probe.record.cameraName).toBe("Dock West");
      expect(probe.record.liveConnectionMode).toBe("onvif");
      expect(probe.record.liveConnectionStatus).toBe("connecting");
      expect(probe.record.transportResponseStatus).toBe(401);
      expect(probe.record.transportResponseStatusText).toBe("Unauthorized");
      expect(probe.record.authChallengeScheme).toBe("digest");
      expect(probe.record.authChallengeRealm).toBe("camera-gateway");
      expect(probe.record.notes).toBe("Challenged by relay");
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
});
