import { describe, expect, test } from "bun:test";
import { StubSegmentationAdapter } from "@/lib/scan-adapters/adapters/stub-segmentation-adapter";
import { createPhotoArtifact } from "@/lib/scan-artifacts";

describe("StubSegmentationAdapter", () => {
  const adapter = new StubSegmentationAdapter();

  test("segment returns mask artifact and bounding box", async () => {
    const photo = createPhotoArtifact("data:img/png;base64,x", "test.jpg", 1920, 1080);
    const result = await adapter.segment(photo, [0.5, 0.5]);
    expect(result.maskArtifact.kind).toBe("mask");
    expect(result.maskArtifact.modelId).toBe("stub-segmentation");
    expect(result.boundingBox).toHaveLength(4);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test("segmentBox returns mask with given bounding box", async () => {
    const photo = createPhotoArtifact("data:img/png;base64,x", "test.jpg", 640, 480);
    const box: [number, number, number, number] = [100, 100, 300, 400];
    const result = await adapter.segmentBox(photo, box);
    expect(result.boundingBox).toEqual(box);
    expect(result.maskArtifact.kind).toBe("mask");
  });

  test("segmentPrompt maps text prompts to class labels", async () => {
    const photo = createPhotoArtifact("data:img/png;base64,x", "test.jpg", 640, 480);

    const cameraResult = await adapter.segmentPrompt(photo, "find the camera");
    expect(cameraResult.maskArtifact.classLabel).toBe("camera");

    const doorResult = await adapter.segmentPrompt(photo, "mark the door");
    expect(doorResult.maskArtifact.classLabel).toBe("door");

    const personResult = await adapter.segmentPrompt(photo, "segment the person");
    expect(personResult.maskArtifact.classLabel).toBe("person");
  });

  test("segmentPrompt falls back to unknown for unmatched prompts", async () => {
    const photo = createPhotoArtifact("data:img/png;base64,x", "test.jpg", 640, 480);
    const result = await adapter.segmentPrompt(photo, "find the quantum flux capacitor");
    expect(result.maskArtifact.classLabel).toBe("unknown");
    expect(result.confidence).toBe(0.5);
  });

  test("segment confidence varies with each call", async () => {
    const photo = createPhotoArtifact("data:img/png;base64,x", "test.jpg", 640, 480);
    const r1 = await adapter.segment(photo, [0.3, 0.3]);
    const r2 = await adapter.segment(photo, [0.7, 0.7]);
    const diff = Math.abs(r1.confidence - r2.confidence);
    expect(r1.confidence).toBeGreaterThan(0.5);
    expect(r1.confidence).toBeLessThanOrEqual(1);
  });
});
