import { describe, expect, test } from "bun:test";

import { DepthAnythingV2Adapter } from "@/lib/scan-adapters/adapters/depth-anything-v2-adapter";
import type { PhotoArtifact, ScanArtifact } from "@/lib/scan-artifacts";

function makePhoto(role: PhotoArtifact["role"] = "overview"): PhotoArtifact {
  return {
    id: "photo_test",
    kind: "photo",
    sourceFileName: "test.png",
    linkedCandidateIds: [],
    capturedAt: Date.parse("2026-06-16T00:00:00Z"),
    role,
  };
}

function makeDepthArtifact(): ScanArtifact {
  return {
    id: "depth_only",
    kind: "depth_map",
    linkedCandidateIds: [],
  };
}

function makeSyntheticDepthTensor(): Float32Array {
  // Low values near the centre, high values at the edges (i.e. far
  // from the camera) — emulates Depth Anything V2's radial output.
  const t = new Float32Array(518 * 518);
  for (let i = 0; i < t.length; i += 1) {
    const cx = (i % 518) - 259;
    const cy = Math.floor(i / 518) - 259;
    const r = Math.sqrt(cx * cx + cy * cy) / 367;
    t[i] = Math.min(1, r);
  }
  return t;
}

const SYNTHETIC_IMAGE_DATA = {
  data: new Uint8ClampedArray([255, 255, 255, 255]),
  width: 1,
  height: 1,
  colorSpace: "srgb",
} as unknown as ImageData;

function makeAdapter(opts: { runInference?: (input: Float32Array, dims: { width: number; height: number }) => Promise<Float32Array> } = {}): DepthAnythingV2Adapter {
  return new DepthAnythingV2Adapter({
    loadImage: async () => SYNTHETIC_IMAGE_DATA,
    imageToTensor: () => new Float32Array(518 * 518 * 3),
    runInference: opts.runInference ?? (async () => makeSyntheticDepthTensor()),
  });
}

describe("DepthAnythingV2Adapter (I14)", () => {
  test("adapter implements the DepthEstimationAdapter contract", () => {
    const adapter = makeAdapter();
    expect(adapter.id).toBe("depth-anything-v2");
    expect(adapter.name).toBe("Depth Anything V2");
    expect(typeof adapter.estimateDepth).toBe("function");
  });

  test("estimateDepth returns a calibrated range for photo artifacts", async () => {
    const adapter = makeAdapter();
    const result = await adapter.estimateDepth(makePhoto());
    expect(result.modelUsed).toBe("depth-anything-v2");
    expect(result.depthMinM).toBeGreaterThan(0);
    expect(result.depthMaxM).toBeGreaterThan(result.depthMinM);
    // Overview role prior caps max depth at 12m; the calibrated range
    // must respect that ceiling.
    expect(result.depthMaxM).toBeLessThanOrEqual(12);
  });

  test("non-photo artifacts fall back gracefully", async () => {
    const adapter = makeAdapter();
    const result = await adapter.estimateDepth(makeDepthArtifact());
    expect(result.modelUsed).toBe(`${adapter.id}:fallback`);
    expect(result.depthMinM).toBe(0.5);
    expect(result.depthMaxM).toBe(10);
  });

  test("inference failure surfaces an error result, not a crash", async () => {
    const adapter = new DepthAnythingV2Adapter({
      loadImage: async () => SYNTHETIC_IMAGE_DATA,
      imageToTensor: () => new Float32Array(518 * 518 * 3),
      runInference: async () => {
        throw new Error("model file missing");
      },
    });
    const result = await adapter.estimateDepth(makePhoto());
    expect(result.modelUsed.startsWith(`${adapter.id}:error`)).toBe(true);
    expect(result.depthArtifact.confidence).toBe(0);
    expect(result.depthMaxM).toBeLessThanOrEqual(12);
  });

  test("inference returns calibration data when complete", async () => {
    const adapter = makeAdapter();
    const result = await adapter.estimateDepth(makePhoto());
    expect(result.modelUsed).toBe("depth-anything-v2");
    expect(result.depthArtifact.confidence).toBe(0.8);
  });

  test("registry exposes the real adapter in the default set", async () => {
    const { getDefaultAdapterSet } = await import("@/lib/scan-adapters/registry");
    const set = getDefaultAdapterSet();
    const ids = set.depthEstimation.map((a) => a.id);
    expect(ids).toContain("stub-depth-estimation");
    expect(ids).toContain("depth-anything-v2");
  });
});