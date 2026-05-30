import { describe, expect, test } from "bun:test";

import { ReconstructionPipeline, assessSceneReconstructionReadiness } from "@/lib/reconstruction-pipeline";
import { createCapturePhoto } from "@/schema/reconstruction-pipeline";
import type { ReconstructionStage, StageResult, ReconstructionSession } from "@/schema/reconstruction-pipeline";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

function makePhoto(fileName: string): ReturnType<typeof createCapturePhoto> {
  return createCapturePhoto(fileName, `data:image/png;base64,${fileName}`);
}

describe("ReconstructionPipeline", () => {
  test("runs with no photos and fails at capture stage", async () => {
    const pipeline = new ReconstructionPipeline([], { estimatedHeightM: 3 });
    const session = await pipeline.run();

    expect(session.stageResults.length).toBeGreaterThan(0);
    const captureResult = session.stageResults.find((r) => r.stage === "capture");
    expect(captureResult?.status).toBe("failed");
    expect(captureResult?.error).toContain("No photos");
  });

  test("runs all stages with photos and default config (no models)", async () => {
    const photos = [makePhoto("front"), makePhoto("left"), makePhoto("right")];
    const pipeline = new ReconstructionPipeline(photos, {
      estimatedWidthM: 10,
      estimatedDepthM: 8,
      estimatedHeightM: 3,
    });

    const session = await pipeline.run();

    expect(session.stageResults.length).toBe(8);

    const captureStage = session.stageResults.find((r) => r.stage === "capture");
    expect(captureStage?.status).toBe("completed");

    const depthStage = session.stageResults.find((r) => r.stage === "depth_estimation");
    expect(depthStage?.status).toBe("skipped");

    const segmentationStage = session.stageResults.find((r) => r.stage === "segmentation");
    expect(segmentationStage?.status).toBe("skipped");

    const qualityGate = session.stageResults.find((r) => r.stage === "quality_gate");
    expect(qualityGate?.status).toBe("completed");

    const compile = session.stageResults.find((r) => r.stage === "compile");
    expect(compile?.status).toBe("completed");
    expect(compile?.outputData?.compiledSnapshot).toBeDefined();
    expect(session.compiledScene).toBeDefined();
  });

  test("rejects pipeline abort during run", async () => {
    const photos = [makePhoto("front")];
    const pipeline = new ReconstructionPipeline(photos, { estimatedHeightM: 3 });

    pipeline.abort();
    const session = await pipeline.run();

    expect(session.completedAt).toBeGreaterThanOrEqual(session.startedAt);
  });

  test("fires callbacks per stage", async () => {
    const photos = [makePhoto("test")];
    const pipeline = new ReconstructionPipeline(photos, { estimatedHeightM: 3 });
    const stageNames: string[] = [];

    pipeline.onStage((stage) => {
      stageNames.push(stage);
    });

    await pipeline.run();
    expect(stageNames.length).toBeGreaterThan(3);
    expect(stageNames).toContain("capture");
    expect(stageNames).toContain("quality_gate");
    expect(stageNames).toContain("compile");
  });

  test("adds photos during run", () => {
    const pipeline = new ReconstructionPipeline([], { estimatedHeightM: 3 });
    pipeline.addPhoto(makePhoto("added_later"));
    const session = pipeline.getSession();
    expect(session.photos.length).toBe(1);
  });
});

describe("assessSceneReconstructionReadiness", () => {
  test("returns not ready for blank scene with no walls", async () => {
    const scene = createBlankSecurityScene();
    const assessment = await assessSceneReconstructionReadiness(scene);
    expect(assessment.ready).toBe(false);
    expect(assessment.gaps.length).toBeGreaterThan(0);
    expect(assessment.confidence).toBeLessThan(0.7);
  });

  test("returns ready for a reviewed scene with valid walls", async () => {
    const scene = createBlankSecurityScene();
    scene.walls = [
      {
        id: "wall_1", nodeType: "wall", label: "Wall 1",
        start: [0, 0], end: [10, 0], heightM: 3, thicknessM: 0.18,
        material: "solid", visionTransmission: 0, source: "scan",
        reviewStatus: "verified", sourceTrace: "test", geometryValidity: "valid",
      },
      {
        id: "wall_2", nodeType: "wall", label: "Wall 2",
        start: [10, 0], end: [10, 8], heightM: 3, thicknessM: 0.18,
        material: "solid", visionTransmission: 0, source: "scan",
        reviewStatus: "verified", sourceTrace: "test", geometryValidity: "valid",
      },
      {
        id: "wall_3", nodeType: "wall", label: "Wall 3",
        start: [10, 8], end: [0, 8], heightM: 3, thicknessM: 0.18,
        material: "solid", visionTransmission: 0, source: "scan",
        reviewStatus: "verified", sourceTrace: "test", geometryValidity: "valid",
      },
    ];

    const assessment = await assessSceneReconstructionReadiness(scene);
    expect(assessment.ready).toBe(true);
    expect(assessment.confidence).toBeGreaterThan(0.8);
  });
});

describe("scale anchoring", () => {
  test("uses known measurements when provided", async () => {
    const photos = [makePhoto("room")];
    const pipeline = new ReconstructionPipeline(photos, {
      estimatedHeightM: 3,
      knownWidthM: 12,
      knownDepthM: 9,
      knownReferenceLabel: "door_width",
    });

    await pipeline.run();

    const scaleResult = pipeline.getSession().stageResults.find((r) => r.stage === "scale_anchoring");
    expect(scaleResult?.status).toBe("completed");
    expect(scaleResult?.confidence).toBeGreaterThan(0.8);
  });

  test("falls back to estimates without known measurements", async () => {
    const photos = [makePhoto("room")];
    const pipeline = new ReconstructionPipeline(photos, { estimatedHeightM: 3 });

    await pipeline.run();

    const scaleResult = pipeline.getSession().stageResults.find((r) => r.stage === "scale_anchoring");
    expect(scaleResult?.status).toBe("fallback");
    expect(scaleResult?.confidence).toBeLessThan(0.7);
  });
});
