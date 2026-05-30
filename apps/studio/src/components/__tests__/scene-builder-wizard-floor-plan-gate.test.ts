import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const wizardPath = "./src/components/scan-to-scene/SceneBuilderWizard.tsx";

describe("SceneBuilderWizard floor-plan Tier 1 gate", () => {
  test("renders gate status and blocks progression for rescan-required imports", () => {
    const source = readFileSync(wizardPath, "utf8");

    expect(source).toContain("Tier 1 Gate");
    expect(source).toContain("evaluateFloorPlanTierGate");
    expect(source).toContain("getFloorPlanTierGateWarning");
    expect(source).toContain("state.floorPlanGateDecision?.action !== \"rescan_required\"");
    expect(source).toContain("formatGateAction");
  });
});
