import { describe, expect, test } from "bun:test";
import type { NextRequest } from "next/server";

import { GET } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as unknown as NextRequest
);

const expectEnvelopeMetadata = (payload: Record<string, unknown>) => {
  expect(typeof payload.requestId).toBe("string");
  expect(payload.requestId).toBeTruthy();
  expect(payload.apiVersion).toBe("1");
  expect(payload.timestamp).toBeTruthy();
  expect(typeof payload.timestamp).toBe("string");
};

describe("health route", () => {
  test("returns the shared metadata envelope and service heartbeat", async () => {
    const response = await GET(createNextRequest("http://localhost/api/health"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expectEnvelopeMetadata(payload);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("ok");
    expect(payload.version).toBe("0.1.0");
    expect(typeof payload.uptime).toBe("number");
    expect(payload.uptime).toBeGreaterThan(0);
    expect(typeof payload.serverTimestampMs).toBe("number");
    expect(payload.serverTimestampMs).toBeGreaterThan(0);
  });
});
