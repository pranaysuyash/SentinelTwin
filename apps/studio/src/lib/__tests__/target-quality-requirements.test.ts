import { describe, test, expect } from "bun:test";
import {
  TARGET_QUALITY_REQUIREMENTS,
  getDefaultQualityForTarget,
  getTargetRequirementInfo,
} from "@/lib/target-quality-requirements";

describe("target-quality-requirements", () => {
  const allTargetTypes = [
    "person_detection",
    "face_recognition",
    "face_identification",
    "vehicle_detection",
    "license_plate",
    "package_detection",
    "cash_counter_activity",
    "door_entry_exit",
    "perimeter_breach",
  ] as const;

  test("every targetType has a complete requirement entry", () => {
    for (const tt of allTargetTypes) {
      const entry = TARGET_QUALITY_REQUIREMENTS[tt];
      expect(entry).toBeDefined();
      expect(entry.defaultRequiredQuality).toMatch(/^(detection|observation|recognition|identification)$/);
      expect(entry.rationale.length).toBeGreaterThan(10);
      expect(entry.ppmThreshold).toMatch(/^(high|medium|low)$/);
    }
  });

  test("getDefaultQualityForTarget returns correct defaults", () => {
    expect(getDefaultQualityForTarget("person_detection")).toBe("detection");
    expect(getDefaultQualityForTarget("face_recognition")).toBe("recognition");
    expect(getDefaultQualityForTarget("face_identification")).toBe("identification");
    expect(getDefaultQualityForTarget("license_plate")).toBe("identification");
    expect(getDefaultQualityForTarget("cash_counter_activity")).toBe("recognition");
    expect(getDefaultQualityForTarget("door_entry_exit")).toBe("observation");
    expect(getDefaultQualityForTarget("perimeter_breach")).toBe("detection");
  });

  test("getTargetRequirementInfo returns full info object", () => {
    const info = getTargetRequirementInfo("license_plate");
    expect(info.defaultRequiredQuality).toBe("identification");
    expect(info.ppmThreshold).toBe("high");
    expect(info.rationale).toContain("OCR");
  });

  test("high-value targets map to high ppm threshold", () => {
    const highValueTargets = ["face_recognition", "face_identification", "license_plate"] as const;
    for (const tt of highValueTargets) {
      expect(TARGET_QUALITY_REQUIREMENTS[tt].ppmThreshold).toBe("high");
    }
  });

  test("detection-only targets map to low ppm threshold", () => {
    const lowTargets = ["person_detection", "vehicle_detection", "package_detection", "perimeter_breach"] as const;
    for (const tt of lowTargets) {
      expect(TARGET_QUALITY_REQUIREMENTS[tt].ppmThreshold).toBe("low");
    }
  });
});
