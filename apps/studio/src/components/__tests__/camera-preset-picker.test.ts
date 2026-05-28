import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pickerPath = "./src/components/workspace/CameraPresetPicker.tsx";

describe("CameraPresetPicker", () => {
  test("renders the preset library as a deliberate placement surface", () => {
    const source = readFileSync(pickerPath, "utf8");

    expect(source).toContain("Camera placement presets");
    expect(source).toContain("Pick the camera profile before placing a new camera");
    expect(source).toContain("Selected");
    expect(source).toContain("Clear selection");
    expect(source).toContain("describeCameraPreset");
    expect(source).toContain("findBestCameraPreset");
    expect(source).toContain("presetTags");
    expect(source).toContain("Camera placement presets");
    expect(source).toContain("Active");
    expect(source).toContain("Custom camera");
  });
});
