import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const rightPanelPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/panels/ContextRightPanel.tsx";

describe("ContextRightPanel", () => {
  test("exposes per-panel toggles for the inspector, assumptions, and path sections", () => {
    const source = readFileSync(rightPanelPath, "utf8");

    expect(source).toContain("function SectionToggle(");
    expect(source).toContain("Selection Inspector");
    expect(source).toContain("Simulation Assumptions");
    expect(source).toContain("Scenario / Path");
    expect(source).toContain('const pathOpenEffective = viewMode === "replay" ? true : pathOpen;');
    expect(source).toContain("pathOpenEffective ? (");
    expect(source).toContain("Object properties hidden. Expand when you need detailed editing controls.");
    expect(source).toContain("Assumptions stay tucked away until you need to tune the model.");
    expect(source).toContain("Path controls are hidden. Expand them for replay and scenario editing.");
  });
});
