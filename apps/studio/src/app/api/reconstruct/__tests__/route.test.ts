import { describe, expect, test } from "bun:test";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

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

describe("reconstruct route", () => {
  test("exposes the reconstruction contract metadata", async () => {
    const response = await GET(createNextRequest("http://localhost/api/reconstruct"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expectEnvelopeMetadata(payload);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("available");
    expect(Array.isArray(payload.stages)).toBe(true);
    expect(payload.stages).toContain("compile");
    expect(payload.modelEndpoints.depthEstimation).toContain("Depth Anything V2");
  });

  test("runs the deterministic reconstruction pipeline in local mode", async () => {
    const response = await POST(createNextRequest("http://localhost/api/reconstruct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        photos: [
          {
            id: "photo-1",
            fileName: "front-entry.jpg",
            timestamp: 1710000000000,
            widthPx: 1920,
            heightPx: 1080,
          },
        ],
        measurements: {
          knownWidthM: 12,
          knownDepthM: 8,
          estimatedHeightM: 3,
        },
      }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expectEnvelopeMetadata(payload);
    expect(payload.ok).toBe(true);
    expect(payload.photosAccepted).toBe(1);
    expect(payload.stageResults).toHaveLength(8);
    expect(payload.qualityRecommendation).toBe("auto_accept");
    expect(payload.compiledSceneId).toBeTruthy();
    expect(payload.compiledScene?.name).toContain("Reconstructed Scene");
  });

  test("rejects invalid reconstruction payloads", async () => {
    const response = await POST(createNextRequest("http://localhost/api/reconstruct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photos: [] }),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("validation_error");
    expect(payload.error).toContain("At least one valid photo is required.");
  });
});
