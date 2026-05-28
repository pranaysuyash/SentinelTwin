import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const bottomPanelPath = "./src/components/bottom-panel/BottomPanel.tsx";

describe("BottomPanel", () => {
  test("surfaces the analysis tabs in the main tab strip", () => {
    const source = readFileSync(bottomPanelPath, "utf8");

    expect(source).toContain('{ id: "redundancy", label: "REDUNDANCY" }');
    expect(source).toContain('{ id: "counterfactual", label: "COUNTERFACTUAL" }');
    expect(source).toContain('{ id: "threat", label: "THREAT REVIEW" }');
    expect(source).toContain('bottomDrawerMode === "single_module"');
    expect(source).toContain('bottomDrawerMode === "hidden"');
    expect(source).toContain('Analysis Drawer Hidden');
    expect(source).toContain('renderTab(activeTabSafe)');
    expect(source).toContain('renderTab(singleModuleTab)');
    expect(source).toContain('renderTab(compareActiveTab)');
  });
});
