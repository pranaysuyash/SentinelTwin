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

describe("ai command route", () => {
  test("blocks local-only command mode with machine-readable error code", async () => {
    const response = await POST(createNextRequest("http://localhost/api/ai/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userText: "Turn camera 1 off",
        selection: {
          providerId: "openai",
          model: "gpt-4o",
        },
        localOnlyMode: true,
        sceneContext: {
          cameraNames: ["Camera 1"],
          obstructionLabels: [],
          lightNames: ["Front light"],
          zoneLabels: ["Checkout"],
          activeCameraCount: 1,
          currentTimeOfDay: "day",
          dimensions: {
            width: 10,
            depth: 6,
            height: 3,
          },
        },
      }),
    }));

    expect(response.status).toBe(403);
    const payload = await response.json();
    expectEnvelopeMetadata(payload);
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("LOCAL_ONLY_MODE");
    expect(payload.error).toContain("Local-only mode blocks cloud-backed parsing.");
  });

  test("rejects invalid command payloads", async () => {
    const response = await POST(createNextRequest("http://localhost/api/ai/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userText: "Turn camera 1 off" }),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("validation_error");
    expect(payload.error).toContain("Invalid command payload");
  });
});
