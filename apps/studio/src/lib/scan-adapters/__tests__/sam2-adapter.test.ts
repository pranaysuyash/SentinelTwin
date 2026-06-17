import { describe, expect, test } from "bun:test";

import { SAM2Adapter, createSAM2OnnxRuntimeInference } from "@/lib/scan-adapters/adapters/sam2-adapter";
import type { PhotoArtifact, ScanArtifact } from "@/lib/scan-artifacts";

function makePhoto(): PhotoArtifact {
  return {
    id: "photo_test",
    kind: "photo",
    sourceFileName: "test.png",
    linkedCandidateIds: [],
    capturedAt: Date.parse("2026-06-16T00:00:00Z"),
    role: "overview",
  };
}

function makeDepthArtifact(): ScanArtifact {
  return {
    id: "depth_only",
    kind: "depth_map",
    linkedCandidateIds: [],
  };
}

const SYNTHETIC_IMAGE_DATA = {
  data: new Uint8ClampedArray([255, 255, 255, 255]),
  width: 1,
  height: 1,
  colorSpace: "srgb",
} as unknown as ImageData;

function makeSyntheticMask(): Float32Array {
  // Square mask in the centre of the 1024×1024 frame.
  const t = new Float32Array(1024 * 1024);
  for (let y = 256; y < 768; y += 1) {
    for (let x = 256; x < 768; x += 1) {
      t[y * 1024 + x] = 1;
    }
  }
  return t;
}

function makeAdapter(opts: { runInference?: SAM2AdapterOptions["runInference"] } = {}): SAM2Adapter {
  return new SAM2Adapter({
    loadImage: async () => SYNTHETIC_IMAGE_DATA,
    imageToTensor: () => new Float32Array(1024 * 1024 * 3),
    runInference: opts.runInference ?? (async () => makeSyntheticMask()),
  });
}

interface SAM2AdapterOptions {
  runInference?: (
    input: Float32Array,
    prompts: ReadonlyArray<{ kind: "point" | "box"; coords: ReadonlyArray<number> }>,
    dims: { width: number; height: number },
  ) => Promise<Float32Array>;
  supportsTextPrompts?: boolean;
}

describe("SAM2Adapter (I16)", () => {
  test("adapter implements the SegmentationAdapter contract", () => {
    const adapter = makeAdapter();
    expect(adapter.id).toBe("sam2");
    expect(adapter.name).toBe("SAM2");
    expect(typeof adapter.segment).toBe("function");
    expect(typeof adapter.segmentBox).toBe("function");
    expect(typeof adapter.segmentPrompt).toBe("function");
  });

  test("segment with a point prompt returns a calibrated bounding box", async () => {
    const adapter = makeAdapter();
    const result = await adapter.segment(makePhoto(), [0.5, 0.5]);
    expect(result.maskArtifact.modelId).toBe("sam2");
    expect(result.confidence).toBe(0.85);
    // The synthetic mask is a square from (256,256) to (768,768);
    // the bounding box is (minX, minY, w, h).
    expect(result.boundingBox[0]).toBe(256);
    expect(result.boundingBox[1]).toBe(256);
    expect(result.boundingBox[2]).toBe(512);
    expect(result.boundingBox[3]).toBe(512);
  });

  test("segmentBox returns a box derived from the inference mask", async () => {
    const adapter = makeAdapter();
    const box: [number, number, number, number] = [100, 200, 300, 400];
    const result = await adapter.segmentBox(makePhoto(), box);
    // The adapter derives the bounding box from the synthetic mask
    // (a 512x512 square centred in the 1024x1024 frame), not from
    // the prompt. This is the expected real-SAM behaviour: the
    // prompt guides the decoder, and the resulting mask's bbox is
    // what gets returned.
    expect(result.boundingBox).toEqual([256, 256, 512, 512]);
    expect(result.confidence).toBe(0.85);
  });

  test("segmentPrompt routes through the text encoder when supported", async () => {
    const adapter = makeAdapter();
    const result = await adapter.segmentPrompt(makePhoto(), "door");
    expect(result.maskArtifact.modelId).toBe("sam2");
    expect(result.maskArtifact.classLabel).toBe("door");
  });

  test("segmentPrompt returns an error result when text encoder is missing", async () => {
    const adapter = new SAM2Adapter({
      supportsTextPrompts: false,
      loadImage: async () => SYNTHETIC_IMAGE_DATA,
      imageToTensor: () => new Float32Array(1024 * 1024 * 3),
      runInference: async () => makeSyntheticMask(),
    });
    const result = await adapter.segmentPrompt(makePhoto(), "door");
    expect(result.maskArtifact.modelId).toContain(":error:no_text_encoder");
    expect(result.confidence).toBe(0);
  });

  test("non-photo artifacts fall back gracefully", async () => {
    const adapter = makeAdapter();
    const result = await adapter.segment(makeDepthArtifact(), [0.5, 0.5]);
    expect(result.maskArtifact.modelId).toBe(`${adapter.id}:fallback`);
    expect(result.boundingBox).toEqual([0, 0, 0, 0]);
  });

  test("inference failure surfaces an error result, not a crash", async () => {
    const adapter = new SAM2Adapter({
      loadImage: async () => SYNTHETIC_IMAGE_DATA,
      imageToTensor: () => new Float32Array(1024 * 1024 * 3),
      runInference: async () => {
        throw new Error("model file missing");
      },
    });
    const result = await adapter.segment(makePhoto(), [0.5, 0.5]);
    expect(result.maskArtifact.modelId?.startsWith(`${adapter.id}:error`)).toBe(true);
    expect(result.confidence).toBe(0);
  });

  test("createSAM2OnnxRuntimeInference factory is exported", () => {
    expect(typeof createSAM2OnnxRuntimeInference).toBe("function");
  });

  test("registry exposes SAM2 in the default segmentation list", async () => {
    const { getDefaultAdapterSet, ensureSAM2Ready } = await import("@/lib/scan-adapters/registry");
    const set = getDefaultAdapterSet();
    const ids = set.segmentation.map((a) => a.id);
    expect(ids).toContain("stub-segmentation");
    expect(ids).toContain("sam2");
    const adapter = await ensureSAM2Ready();
    expect(adapter.id).toBe("sam2");
  });
});