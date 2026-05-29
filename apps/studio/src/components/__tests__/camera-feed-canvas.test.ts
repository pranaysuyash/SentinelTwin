import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cameraFeedCanvasPath = "./src/components/inspector/CameraFeedCanvas.tsx";

describe("CameraFeedCanvas", () => {
  test("exposes the inspector DORI overlay, live rig, and actor/noise cues", () => {
    const source = readFileSync(cameraFeedCanvasPath, "utf8");

    expect(source).toContain("DORI Overlay");
    expect(source).toContain("DEFAULT_FEED_OVERLAY_OPTIONS");
    expect(source).toContain("overlayFlags");
    expect(source).toContain("Normal");
    expect(source).toContain("IR");
    expect(source).toContain("Low Light");
    expect(source).toContain("Thermal");
    expect(source).toContain("Target Type");
    expect(source).toContain("Best Camera");
    expect(source).toContain("qualityRangeLabel");
    expect(source).toContain("targetZoneResult?.status");
    expect(source).toContain("CameraRigLive");
    expect(source).toContain("SceneFeedGeometry");
    expect(source).toContain("PathActor");
    expect(source).toContain("Dirty Lens");
    expect(source).toContain("Actor replay active");
    expect(source).toContain("pathLabel ?? \"Selected path\"");
    expect(source).toContain("pathProgress ?? 0");
    expect(source).toContain("Sensor Fusion");
    expect(source).toContain("Active sensors");
    expect(source).toContain("nearestSensorLabel");
    expect(source).toContain("Latest Camera Metadata");
    expect(source).toContain("latestCameraMetadataEvent");
    expect(source).toContain("Live Camera Connection");
    expect(source).toContain("latestCameraLiveConnectionEvent");
    expect(source).toContain("boundingBox");
    expect(source).toContain("grid");
  });
});
