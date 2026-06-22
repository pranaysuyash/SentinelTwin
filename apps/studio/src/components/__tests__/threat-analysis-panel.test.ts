import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const threatAnalysisPanelPath = join(import.meta.dir, "../..", "components/bottom-panel/ThreatAnalysisPanel.tsx");

describe("ThreatAnalysisPanel", () => {
  test("runs the shared simulation action instead of only revealing cached details", () => {
    const source = readFileSync(threatAnalysisPanelPath, "utf8");

    expect(source).toContain("Route Exposure Review");
    expect(source).toContain("Run Route Review");
    expect(source).toContain("runSimulation");
    expect(source).not.toContain("Show Coverage Breakdown");
  });
});
