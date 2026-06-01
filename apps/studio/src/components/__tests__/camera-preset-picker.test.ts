import { describe, expect, test } from "bun:test";

import {
  CAMERA_PRESETS,
  applyCameraPreset,
  describeCameraPreset,
  findBestCameraPreset,
  getCameraPreset,
  type CameraPresetId,
} from "@/components/workspace/camera-preset-utils";

describe("camera preset utilities", () => {
  test("resolves preset by id with deterministic lookup", () => {
    const preset = getCameraPreset("dome_indoor");
    expect(preset).not.toBeNull();
    expect(preset?.id).toBe("dome_indoor");
    expect(getCameraPreset(null)).toBeNull();
    expect(getCameraPreset("not-a-preset" as CameraPresetId)).toBeNull();
  });

  test("describes preset as normalized optics line", () => {
    const preset = CAMERA_PRESETS[0];
    const description = describeCameraPreset(preset);
    expect(description).toContain("MP");
    expect(description).toContain("FOV");
    expect(description).toContain(preset.mountType);
  });

  test("returns closest preset for matching camera optics", () => {
    const camera = {
      mountType: "wall",
      lensType: "fixed",
      nightMode: "ir",
      ptz: false,
      fovHorizontalDeg: 62,
      rangeM: 32,
      resolutionMP: 4,
    } as const;

    const best = findBestCameraPreset(camera);

    expect(best).not.toBeNull();
    expect(best?.id).toBe("bullet_outdoor");
  });

  test("applies preset as scoped patch", () => {
    const preset = CAMERA_PRESETS.find((value) => value.id === "ptz_professional");
    expect(preset).not.toBeNull();
    const patch = applyCameraPreset(preset);
    expect(patch.presetId).toBe(preset!.id);
    expect(patch.fovHorizontalDeg).toBe(preset!.fovHorizontalDeg);
    expect(patch.ptz).toBe(preset!.ptz);
    expect(preset).not.toBeNull();
    expect(applyCameraPreset(null)).toEqual({});
  });
});
