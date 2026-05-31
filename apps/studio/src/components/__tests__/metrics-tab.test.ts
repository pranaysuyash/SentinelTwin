import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const metricsTabPath = "./src/components/bottom-panel/MetricsTab.tsx";

describe("MetricsTab", () => {
  test("exposes the live metric cards used by the studio shell", () => {
    const source = readFileSync(metricsTabPath, "utf8");

    expect(source).toContain("Fragility");
    expect(source).toContain("Overall Coverage (Detection)");
    expect(source).toContain("Truth: Simulated");
    expect(source).toContain("Critical Zones");
    expect(source).toContain("Average Quality (Walkable)");
    expect(source).toContain("Worst Area Quality");
    expect(source).toContain("Walkable Area Quality");
    expect(source).toContain("Recognition");
    expect(source).toContain("Identification");
    expect(source).toContain("Coverage Stability Index");
    expect(source).toContain("Backup Coverage");
    expect(source).toContain("Recommended Mounts");
    expect(source).toContain("Blind Spot FP");
    expect(source).toContain("Reflective Bounce");
    expect(source).toContain("Temporal Anomalies");
    expect(source).toContain("Occlusion Blame");
    expect(source).toContain("result.totalCoveragePct");
    expect(source).toContain("qualityToScore");
  });
});
