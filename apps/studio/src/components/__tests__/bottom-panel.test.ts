import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const bottomPanelPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/BottomPanel.tsx";

describe("BottomPanel", () => {
  test("surfaces the analysis tabs in the main tab strip", () => {
    const source = readFileSync(bottomPanelPath, "utf8");

    expect(source).toContain('{ id: "redundancy", label: "REDUNDANCY" }');
    expect(source).toContain('{ id: "counterfactual", label: "COUNTERFACTUAL" }');
    expect(source).toContain('{ id: "threat", label: "THREAT REVIEW" }');
    expect(source).toContain('activeTab === "redundancy" && <RedundancyTab />');
    expect(source).toContain('activeTab === "counterfactual" && <CounterfactualPanel />');
    expect(source).toContain('activeTab === "threat" && <ThreatAnalysisPanel />');
  });
});
