import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const metricsTabPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/MetricsTab.tsx";

describe("MetricsTab", () => {
  test("exposes the live metric cards used by the studio shell", () => {
    const source = readFileSync(metricsTabPath, "utf8");

    expect(source).toContain("Coverage Fragility");
    expect(source).toContain("Overall Coverage (Detection)");
    expect(source).toContain("Critical Zones");
    expect(source).toContain("Average Quality (Walkable)");
    expect(source).toContain("Worst Area Quality");
    expect(source).toContain("Recognition Area");
    expect(source).toContain("Identification Area");
    expect(source).toContain("result.totalCoveragePct");
    expect(source).toContain("qualityToScore");
  });
});
