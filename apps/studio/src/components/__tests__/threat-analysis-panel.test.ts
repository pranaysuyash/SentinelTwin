import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const threatAnalysisPanelPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/ThreatAnalysisPanel.tsx";

describe("ThreatAnalysisPanel", () => {
  test("uses honest breakdown wording instead of pretending to rerun analysis", () => {
    const source = readFileSync(threatAnalysisPanelPath, "utf8");

    expect(source).toContain("Coverage Failure Breakdown");
    expect(source).toContain("Show Coverage Breakdown");
    expect(source).not.toContain("Run Coverage Failure Analysis");
  });
});
