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

  test("retries with digest auth after an ONVIF challenge", async () => {
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
            "www-authenticate": 'Digest realm="camera.example.com", nonce="abc123", qop="auth", algorithm=MD5',
          },
        });
      }

      if (requests.length === 2) {
        expect(url).toBe("https://camera.example.com/onvif");
        expect(headers.get("authorization")).toContain('Digest username="admin"');
        expect(headers.get("authorization")).toContain('realm="camera.example.com"');
        expect(headers.get("authorization")).toContain('nonce="abc123"');
        expect(headers.get("authorization")).toContain('qop=auth');
        expect(headers.get("authorization")).toContain('nc=00000001');
        expect(headers.get("authorization")).toContain('cnonce="');

        return new Response([
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
            "www-authenticate": 'Digest realm="camera.example.com", nonce="event123", qop="auth", algorithm=MD5',
          },
        });
      }

      expect(url).toBe("http://camera.example.com/onvif/events");
      expect(headers.get("authorization")).toContain('Digest username="admin"');
      expect(headers.get("authorization")).toContain('realm="camera.example.com"');
      expect(headers.get("authorization")).toContain('nonce="event123"');

      return new Response([
        "<Envelope>",
        "  <Body>",
        "    <SubscribeResponse>",
        "      <SubscriptionReference>",
        "        <Address>http://camera.example.com/onvif/events/subscription/alpha</Address>",
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
      const client = new OnvifClient({
        address: "https://camera.example.com/onvif",
        username: "admin",
        password: "secret",
      });
      const probe = await client.connect();

      expect(requests.length).toBe(4);
      expect(requests[0].authorization).toBeNull();
      expect(requests[1].authorization).toContain("Digest ");
      expect(requests[2].url).toBe("http://camera.example.com/onvif/events");
      expect(requests[2].authorization).toBeNull();
      expect(requests[3].url).toBe("http://camera.example.com/onvif/events");
      expect(requests[3].authorization).toContain("Digest ");
      expect(probe.responseStatus).toBe(200);
      expect(probe.session.state).toBe("streaming");
      expect(probe.session.deviceInformation?.manufacturer).toBe("Axis");
      expect(probe.session.eventSubscriptionUri).toBe("http://camera.example.com/onvif/events");
      expect(probe.session.eventSubscriptionReference).toBe("http://camera.example.com/onvif/events/subscription/alpha");
      expect(probe.session.eventSubscriptionExpiresAt).toBe(Date.parse("2026-05-30T15:00:00Z"));
      expect(probe.session.mediaUri).toBe("rtsp://camera.example.com/live");
      expect(probe.authChallengeHeader).toContain("Digest realm=\"camera.example.com\"");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("falls back to basic auth when the challenge advertises basic", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<string | null> = [];
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const headers = new Headers(init?.headers ?? {});
      requests.push(headers.get("authorization"));

      if (requests.length === 1) {
        return new Response("", {
          status: 401,
          statusText: "Unauthorized",
          headers: {
            "content-type": "text/plain",
            "www-authenticate": 'Basic realm="camera.example.com"',
          },
        });
      }

      expect(headers.get("authorization")).toBe("Basic YWRtaW46c2VjcmV0");

      return new Response([
        "<Envelope>",
        "  <Body>",
        "    <GetDeviceInformationResponse>",
        "      <Manufacturer>Axis</Manufacturer>",
        "      <Model>P3265-LVE</Model>",
        "      <FirmwareVersion>10.12.1</FirmwareVersion>",
        "      <SerialNumber>AX-7788</SerialNumber>",
        "      <HardwareId>HW-7788</HardwareId>",
        "    </GetDeviceInformationResponse>",
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
      const client = new OnvifClient({
        address: "https://camera.example.com/onvif",
        username: "admin",
        password: "secret",
      });
      const probe = await client.connect();

      expect(requests).toHaveLength(2);
      expect(requests[0]).toBeNull();
      expect(requests[1]).toBe("Basic YWRtaW46c2VjcmV0");
      expect(probe.responseStatus).toBe(200);
      expect(probe.session.state).toBe("streaming");
      expect(probe.session.deviceInformation?.manufacturer).toBe("Axis");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
