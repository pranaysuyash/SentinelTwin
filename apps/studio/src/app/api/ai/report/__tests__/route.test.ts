import { describe, expect, test } from "bun:test";
import type { NextRequest } from "next/server";

import { POST } from "../route";

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

describe("ai report route", () => {
  test("blocks local-only report generation with explicit machine-readable error", async () => {
    const response = await POST(createNextRequest("http://localhost/api/ai/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selection: {
          providerId: "openai",
          model: "gpt-4o",
        },
        localOnlyMode: true,
        simulationSummary: "Scene has 90% coverage and one blind spot.",
        sceneSummary: "Small office with checkout and two exits.",
      }),
    }));

    expect(response.status).toBe(403);
    const payload = await response.json();
    expectEnvelopeMetadata(payload);
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("LOCAL_ONLY_MODE");
    expect(payload.error).toContain("Local-only mode blocks cloud-backed report generation.");
  });

  test("rejects invalid report payloads", async () => {
    const response = await POST(createNextRequest("http://localhost/api/ai/report", {
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

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("validation_error");
    expect(payload.error).toContain("Invalid report payload");
  });
});
