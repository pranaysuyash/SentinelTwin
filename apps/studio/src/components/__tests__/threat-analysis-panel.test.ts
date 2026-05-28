import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const threatAnalysisPanelPath = "./src/components/bottom-panel/ThreatAnalysisPanel.tsx";

describe("ThreatAnalysisPanel", () => {
  test("runs the shared simulation action instead of only revealing cached details", () => {
    const source = readFileSync(threatAnalysisPanelPath, "utf8");

    expect(source).toContain("Coverage Failure Breakdown");
    expect(source).toContain("Run Coverage Failure Analysis");
    expect(source).toContain("runSimulation");
    expect(source).not.toContain("Show Coverage Breakdown");
  });
});
