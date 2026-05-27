import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const bottomPanelPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/BottomPanel.tsx";

describe("BottomPanel", () => {
  test("surfaces the redundancy tab in the main tab strip", () => {
    const source = readFileSync(bottomPanelPath, "utf8");

    expect(source).toContain('{ id: "redundancy", label: "REDUNDANCY" }');
    expect(source).toContain('activeTab === "redundancy" && <RedundancyTab />');
  });
});
