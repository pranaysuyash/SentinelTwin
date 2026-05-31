import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const novelAlgorithmsPath = "./src/components/bottom-panel/NovelAlgorithmsTab.tsx";

describe("NovelAlgorithmsTab", () => {
  test("exposes a coverage time budget surface", () => {
    const source = readFileSync(novelAlgorithmsPath, "utf8");

    expect(source).toContain("Coverage Time Budget");
    expect(source).toContain("Coverage Stability Index");
    expect(source).toContain("Coverage Uncertainty");
    expect(source).toContain("Coverage Under Posture Variation");
    expect(source).toContain("Blind Spot Topology");
    expect(source).toContain("Blind-Spot Pattern");
    expect(source).toContain("Reflective Bounce Vision");
    expect(source).toContain("Navigator");
    expect(source).toContain("Inspect on Map");
    expect(source).toContain("Focus Region");
    expect(source).toContain("Open Replay");
    expect(source).toContain("Open 24H Profile");
    expect(source).toContain("Blind Regions");
    expect(source).toContain("Budget status");
    expect(source).toContain("1s budget");
    expect(source).toContain("2s budget");
    expect(source).toContain("3s budget");
    expect(source).toContain("computeCoverageTimeBudget");
    expect(source).toContain("computeCoverageEntropy");
    expect(source).toContain("computeCoverageUncertainty");
    expect(source).toContain("computeCoveragePostureVariation");
    expect(source).toContain("reflectiveBounce");
    expect(source).toContain("firstVisibleTimeS");
    expect(source).toContain("setFocusScenePointRequest");
    expect(source).toContain("setViewMode(\"map\")");
    expect(source).toContain("setBottomTab(\"timeline\")");
  });
});
