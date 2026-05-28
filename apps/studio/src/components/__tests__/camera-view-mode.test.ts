import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { formatTargetTypeLabel } from "@/components/view/CameraViewMode";

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
    expect(source).toContain("Why this quality:");
    expect(source).toContain("Quality:");
    expect(source).toContain("Segment:");
    expect(source).toContain("Best Camera");
    expect(source).toContain("Footage Verification");
    expect(source).toContain("Planning aid only.");
    expect(source).toContain("Reset align");
    expect(source).toContain("Overlay");
    expect(source).toContain("Split");
    expect(source).toContain("Alignment Quality");
    expect(source).toContain("Difference heat overlay");
    expect(source).toContain("non-forensic");
    expect(source).toContain("Excellent");
    expect(source).toContain("Good");
    expect(source).toContain("Fair");
    expect(source).toContain("Poor");
  });

  test("derives target labels from the zone target type", () => {
    expect(formatTargetTypeLabel("face_recognition")).toBe("Face");
    expect(formatTargetTypeLabel("cash_counter_activity")).toBe("Cash Counter");
    expect(formatTargetTypeLabel("door_entry_exit")).toBe("Entry / Exit");
  });
});
