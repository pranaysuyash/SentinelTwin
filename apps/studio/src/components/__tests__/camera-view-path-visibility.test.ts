import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cameraViewPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/view/CameraViewMode.tsx";

describe("CameraViewMode path visibility overlay", () => {
  test("shows per-camera path visibility status for replay context", () => {
    const source = readFileSync(cameraViewPath, "utf8");
    expect(source).toContain("Path Visibility");
    expect(source).toContain("CameraPathVisibilityOverlay");
    expect(source).toContain("visibilityByCamera[camera.id]");
  });
});
