import { describe, expect, test } from "bun:test";

import {
  CAMERA_PRESETS,
  getGenericPresets,
  getManufacturerPresets,
  getManufacturerNames,
  getPresetsByManufacturer,
} from "@/components/workspace/camera-preset-utils";

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

describe("Camera preset library — generic presets (spec §14)", () => {
  test("ships 8 generic presets", () => {
    expect(getGenericPresets().length).toBe(8);
  });

  test("matches every spec §14 preset label", () => {
    const labels: string[] = getGenericPresets().map((p) => p.label);
    for (const specLabel of SPEC_PRESET_LABELS) {
      expect(
        labels.includes(specLabel),
        `Missing label "${specLabel}" from preset library. Found: ${labels.join(", ")}`,
      ).toBe(true);
    }
  });

  test("all generic presets have category=generic", () => {
    for (const preset of getGenericPresets()) {
      expect(preset.category).toBe("generic");
    }
  });
});

describe("Camera preset library — manufacturer models", () => {
  test("ships at least 15 manufacturer models", () => {
    expect(getManufacturerPresets().length).toBeGreaterThanOrEqual(15);
  });

  test("all manufacturer presets have category=manufacturer", () => {
    for (const preset of getManufacturerPresets()) {
      expect(preset.category).toBe("manufacturer");
    }
  });

  test("every manufacturer preset has manufacturer and modelNumber", () => {
    for (const preset of getManufacturerPresets()) {
      expect(preset.manufacturer, `${preset.id} manufacturer`).toBeTruthy();
      expect(preset.modelNumber, `${preset.id} modelNumber`).toBeTruthy();
    }
  });

  test("covers at least 5 manufacturers", () => {
    const names = getManufacturerNames();
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  test("includes Hikvision, Dahua, Axis, Hanwha, Bosch", () => {
    const names = getManufacturerNames();
    for (const expected of ["Hikvision", "Dahua", "Axis", "Hanwha", "Bosch"]) {
      expect(names).toContain(expected);
    }
  });

  test("getPresetsByManufacturer returns correct subsets", () => {
    for (const name of getManufacturerNames()) {
      const subset = getPresetsByManufacturer(name);
      expect(subset.length).toBeGreaterThan(0);
      for (const p of subset) {
        expect(p.manufacturer).toBe(name);
      }
    }
  });
});

describe("Camera preset library — full list invariants", () => {
  test("total presets = generic + manufacturer", () => {
    expect(CAMERA_PRESETS.length).toBe(
      getGenericPresets().length + getManufacturerPresets().length,
    );
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

  test("every preset's description mentions resolution", () => {
    for (const preset of CAMERA_PRESETS) {
      const combined = `${preset.label} ${preset.description}`.toLowerCase();
      const hasResolution = /\b\d+(\.\d+)?\s*mp\b/.test(combined);
      expect(hasResolution, `${preset.id} should mention resolution`).toBe(true);
    }
  });
});
