import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cameraFeedCanvasPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/inspector/CameraFeedCanvas.tsx";

describe("CameraFeedCanvas", () => {
  test("exposes the inspector DORI overlay and local view modes", () => {
    const source = readFileSync(cameraFeedCanvasPath, "utf8");

    expect(source).toContain("DORI Overlay");
    expect(source).toContain("Normal");
    expect(source).toContain("IR");
    expect(source).toContain("Low Light");
    expect(source).toContain("Thermal");
    expect(source).toContain("Target Type");
    expect(source).toContain("Best Camera");
    expect(source).toContain("qualityRangeLabel");
    expect(source).toContain("targetZoneResult?.status");
  });
});
