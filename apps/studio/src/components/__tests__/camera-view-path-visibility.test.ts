import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cameraViewModePath = join(import.meta.dir, "..", "view", "CameraViewMode.tsx");
const cameraViewChromePath = join(import.meta.dir, "..", "view", "camera-view-chrome.tsx");

describe("CameraViewMode path visibility overlay", () => {
  test("shows per-camera path visibility status for replay context", () => {
    const cameraViewModeSource = readFileSync(cameraViewModePath, "utf8");
    const cameraViewChromeSource = readFileSync(cameraViewChromePath, "utf8");

    expect(cameraViewChromeSource).toContain("Path Visibility");
    expect(cameraViewChromeSource).toContain("CameraPathVisibilityOverlay");
    expect(cameraViewModeSource).toContain("visibilityByCamera[camera.id]");
  });
});
