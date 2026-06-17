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

describe("ai draft-scene route", () => {
  test("returns heuristic draft when local-only mode is enforced", async () => {
    const response = await POST(createNextRequest("http://localhost/api/ai/draft-scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "A small office with one doorway and one camera at the front.",
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
    expect(payload.mode).toBe("heuristic");
    expect(payload.draft).toBeDefined();
  });

  test("rejects invalid draft payloads", async () => {
    const response = await POST(createNextRequest("http://localhost/api/ai/draft-scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "", selection: { providerId: "openai", model: "gpt-4o" } }),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("validation_error");
    expect(payload.error).toContain("Invalid draft scene payload");
  });
});
