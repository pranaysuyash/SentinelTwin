import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cameraViewModePath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/view/CameraViewMode.tsx";

describe("CameraViewMode", () => {
  test("exposes the live overlay strip and replay presets", () => {
    const source = readFileSync(cameraViewModePath, "utf8");

    expect(source).toContain("LIVE MODE (SIMULATED)");
    expect(source).toContain("DORI RANGES AT TARGET");
    expect(source).toContain("DORI OVERLAY");
    expect(source).toContain("REQUIRED ·");
    expect(source).toContain("PASSES");
    expect(source).toContain("FAILS");
    expect(source).toContain("Back to Map View");
    expect(source).toContain("Show replay essentials");
    expect(source).toContain("Minimal camera feed");
    expect(source).toContain("Inspection preset");
    expect(source).toContain("MORE");
  });
});
