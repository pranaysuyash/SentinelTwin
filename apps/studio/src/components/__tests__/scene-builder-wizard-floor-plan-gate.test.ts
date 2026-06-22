import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const wizardPath = join(import.meta.dir, "../..", "components/scan-to-scene/SceneBuilderWizard.tsx");

describe("SceneBuilderWizard floor-plan Tier 1 gate", () => {
  test("renders gate status and blocks progression for rescan-required imports", () => {
    const source = readFileSync(wizardPath, "utf8");

    expect(source).toContain("Tier 1 Gate");
    expect(source).toContain("evaluateFloorPlanTierGate");
    expect(source).toContain("getFloorPlanTierGateWarning");
    expect(source).toContain("state.roomName.trim().length > 0 && state.floorPlanResult !== null && state.floorPlanGateDecision?.action !== \"rescan_required\"");
    expect(source).toContain("formatGateAction");
    expect(source).toContain("Scene Metadata");
    expect(source).toContain("deriveSceneNameFromFile");
    expect(source).toContain("roomName: seededName");
    expect(source).toContain("widthM: recalibrated.roomDimensions.widthM");
    expect(source).toContain("How this review works");
    expect(source).toContain("Create Draft Scene");
  });
});
