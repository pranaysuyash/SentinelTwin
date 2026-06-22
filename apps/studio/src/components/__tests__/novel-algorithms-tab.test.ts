import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const novelAlgorithmsPath = join(import.meta.dir, "../..", "components/bottom-panel/NovelAlgorithmsTab.tsx");

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

  test("surfaces the 4 core novel algorithms (occlusion/blind/fragility/k-robustness)", () => {
    // I19: the simulation package exports four pure functions for novel
    // security analysis. Each must be visible somewhere in the
    // NovelAlgorithmsTab. This test is the contract.
    const source = readFileSync(novelAlgorithmsPath, "utf8");

    // Occlusion Blame Attribution
    expect(source).toMatch(/Occlusion Blame/);
    expect(source).toMatch(/occlusionBlame/);
    expect(source).toMatch(/blameFraction/);

    // Coverage Fragility Field
    expect(source).toMatch(/Coverage Stability/);
    expect(source).toMatch(/fragilitySummary/);
    expect(source).toMatch(/meanFragility/);

    // Blind-Spot Topology
    expect(source).toMatch(/Blind Spot Topology/);
    expect(source).toMatch(/blindRegions/);
    // The component reads blindRegions from the simulation result
    // (the analyseBlindSpotTopology function is called inside
    // simulateStudio). The contract is: the UI surfaces the
    // blind-region list.
    expect(source).toMatch(/result\?\.blindRegions|blindRegions\s*=/);

    // Adversarial K-Robustness
    expect(source).toMatch(/Backup Coverage|K-Robustness|kRobustness/);
    expect(source).toMatch(/kRobustness/);
    expect(source).toMatch(/criticalSets/);

    // All four should map to clearly-labelled Section headers
    const sectionTitles = source.match(/title="[^"]+"/g) ?? [];
    const labels = sectionTitles.map((entry) => entry.replace(/title="/, "").replace(/"$/, ""));
    expect(labels.some((l) => l.toLowerCase().includes("occlusion"))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes("fragility") || l.toLowerCase().includes("stability"))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes("blind") || l.toLowerCase().includes("topology"))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes("backup") || l.toLowerCase().includes("k-robustness") || l.toLowerCase().includes("robustness"))).toBe(true);
  });
});
