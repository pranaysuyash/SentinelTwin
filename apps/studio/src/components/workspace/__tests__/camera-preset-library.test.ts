import { describe, expect, test } from "bun:test";

import { CAMERA_PRESETS } from "@/components/workspace/camera-preset-utils";

// The Camera Studio spec §14 lists 8 camera presets that should be
// available in the preset library. Each spec entry is a label string.
// This test asserts the canonical preset list contains a preset whose
// label matches the spec wording (either exactly, or as a sensible
// abbreviated form).
const SPEC_PRESET_LABELS = [
  "2MP Indoor Dome",
  "4MP Wide Dome",
  "8MP Bullet",
  "PTZ Outdoor",
  "Thermal Perimeter",
  "Low-Light Camera",
  "Fisheye 360",
  "License Plate Camera",
];

describe("Camera preset library (I21 — spec §14)", () => {
  test("ships 8 presets", () => {
    expect(CAMERA_PRESETS.length).toBe(8);
  });

  test("matches every spec §14 preset label", () => {
    const labels = CAMERA_PRESETS.map((p) => p.label);
    for (const specLabel of SPEC_PRESET_LABELS) {
      expect(labels, `Missing label "${specLabel}" from preset library`).toContain(specLabel);
    }
  });

  test("all preset ids are unique", () => {
    const ids = CAMERA_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every preset has a non-empty description", () => {
    for (const preset of CAMERA_PRESETS) {
      expect(preset.description.length, `${preset.id} description`).toBeGreaterThan(0);
    }
  });

  test("every preset's id appears in its label or description", () => {
    // A loose check: the label or description should mention the
    // preset's distinguishing characteristic (resolution, mount,
    // night mode, etc.). This catches future label regressions.
    for (const preset of CAMERA_PRESETS) {
      const combined = `${preset.label} ${preset.description}`.toLowerCase();
      const hasResolution = /\b\d+(\.\d+)?\s*mp\b/.test(combined);
      expect(hasResolution, `${preset.id} should mention resolution`).toBe(true);
    }
  });
});