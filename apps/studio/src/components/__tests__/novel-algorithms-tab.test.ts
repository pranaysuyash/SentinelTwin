import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const novelAlgorithmsPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/NovelAlgorithmsTab.tsx";

describe("NovelAlgorithmsTab", () => {
  test("exposes a coverage time budget surface", () => {
    const source = readFileSync(novelAlgorithmsPath, "utf8");

    expect(source).toContain("Coverage Time Budget");
    expect(source).toContain("Coverage Uncertainty");
    expect(source).toContain("Coverage Under Posture Variation");
    expect(source).toContain("Blind Spot Topology");
    expect(source).toContain("Blind Spot Fingerprint");
    expect(source).toContain("Reflective Bounce Vision");
    expect(source).toContain("Blind Regions");
    expect(source).toContain("Budget status");
    expect(source).toContain("1s budget");
    expect(source).toContain("2s budget");
    expect(source).toContain("3s budget");
    expect(source).toContain("computeCoverageTimeBudget");
    expect(source).toContain("computeCoverageUncertainty");
    expect(source).toContain("computeCoveragePostureVariation");
    expect(source).toContain("reflectiveBounce");
    expect(source).toContain("firstVisibleTimeS");
  });
});
