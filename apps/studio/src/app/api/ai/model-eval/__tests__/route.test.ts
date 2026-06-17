import { describe, expect, test } from "bun:test";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

type RoutePayload = Record<string, unknown>;

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as unknown as NextRequest
);

const expectEnvelopeMetadata = (payload: RoutePayload) => {
  expect(typeof payload.requestId).toBe("string");
  expect(payload.requestId).toBeTruthy();
  expect(payload.apiVersion).toBe("1");
  expect(payload.timestamp).toBeTruthy();
  expect(typeof payload.timestamp).toBe("string");
};

describe("ai model-eval route", () => {
  test("runs model-eval in local-only mode with deterministic skipped fixtures", async () => {
    const response = await POST(createNextRequest("http://localhost/api/ai/model-eval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selection: {
          providerId: "openai",
          model: "gpt-4o",
        },
        localOnlyMode: true,
      }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expectEnvelopeMetadata(payload);
    expect(payload.ok).toBe(true);
    expect(payload.report).toBeDefined();
    expect(payload.report?.summary?.skipped).toBeGreaterThan(0);
    expect(Array.isArray(payload.report?.fixtures)).toBe(true);
    expect(payload.report?.fixtures?.length).toBeGreaterThan(0);
  });

  test("rejects invalid model-eval payloads", async () => {
    const response = await POST(createNextRequest("http://localhost/api/ai/model-eval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selection: {
          providerId: "openai",
          model: "gpt-4o",
        },
      }),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("validation_error");
    expect(payload.error).toContain("Invalid model eval payload");
  });

  test("exposes GET contract metadata", async () => {
    const response = await GET(createNextRequest("http://localhost/api/ai/model-eval"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expectEnvelopeMetadata(payload);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("available");
  });
});
