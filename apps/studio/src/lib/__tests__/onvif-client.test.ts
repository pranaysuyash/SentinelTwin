import { describe, expect, test } from "bun:test";

import { OnvifClient } from "@/lib/onvif-client";

describe("OnvifClient", () => {
  test("probes device information and tracks session state", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response([
      "<Envelope>",
      "  <Body>",
      "    <GetDeviceInformationResponse>",
      "      <Manufacturer>Axis</Manufacturer>",
      "      <Model>P3265-LVE</Model>",
      "      <FirmwareVersion>10.12.1</FirmwareVersion>",
      "      <SerialNumber>AX-7788</SerialNumber>",
      "      <HardwareId>HW-7788</HardwareId>",
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
    })) as unknown as typeof fetch;

    try {
      const client = new OnvifClient({ address: "https://camera.example.com/onvif" });
      const probe = await client.connect();

      expect(probe.responseStatus).toBe(200);
      expect(probe.raw).toContain("GetDeviceInformationResponse");
      expect(probe.session.state).toBe("streaming");
      expect(probe.session.deviceInformation?.manufacturer).toBe("Axis");
      expect(probe.session.deviceInformation?.model).toBe("P3265-LVE");
      expect(probe.session.eventSubscriptionUri).toBe("http://camera.example.com/onvif/events");
      expect(probe.session.mediaUri).toBe("rtsp://camera.example.com/live");
      expect(client.getSession().lastHeartbeatAt).toBeGreaterThan(0);

      client.heartbeat();
      expect(client.getSession().lastHeartbeatAt).toBeGreaterThan(0);

      await client.disconnect();
      expect(client.getSession().state).toBe("disconnected");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
