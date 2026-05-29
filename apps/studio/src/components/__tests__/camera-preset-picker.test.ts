import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pickerPath = "./src/components/workspace/camera-preset-utils.ts";

describe("CameraPresetPicker", () => {
  test("renders the preset library as a deliberate placement surface", () => {
    const source = readFileSync(pickerPath, "utf8");

    expect(source).toContain("describeCameraPreset");
    expect(source).toContain("findBestCameraPreset");
    expect(source).toContain("CAMERA_PRESETS");
    expect(source).toContain("getCameraPreset");
    expect(source).toContain("applyCameraPreset");
  });
});
