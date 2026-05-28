import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const rightPanelPath = "./src/components/panels/ContextRightPanel.tsx";
const assumptionsPanelPath = "./src/components/panels/AssumptionsPanel.tsx";

describe("ContextRightPanel", () => {
  test("exposes the right panel mode switcher and inspector sections", () => {
    const source = readFileSync(rightPanelPath, "utf8");
    const assumptionsSource = readFileSync(assumptionsPanelPath, "utf8");

    expect(source).toContain("function SectionToggle(");
    expect(source).toContain("CameraInspector");
    expect(source).toContain("Selection Inspector");
    expect(source).toContain("Simulation Assumptions");
    expect(source).toContain("Scenario / Path");
    expect(source).toContain("Security Status");
    expect(source).toContain("Recommendations");
    expect(source).toContain("Camera Controls");
    expect(source).toContain('const pathOpenEffective = viewMode === "replay" ? true : pathOpen;');
    expect(source).toContain("pathOpenEffective ? (");
    expect(source).toContain("Object properties hidden. Expand when you need detailed editing controls.");
    expect(source).toContain("Assumptions stay tucked away until you need to tune the model.");
    expect(source).toContain("Path controls are hidden. Expand them for replay and scenario editing.");
    expect(source).toContain("assumptionsSummary");
    expect(source).toContain("IEC 62676-4:2025");
    expect(assumptionsSource).toContain("DORI Model");
    expect(assumptionsSource).toContain("Grid Resolution");
    expect(assumptionsSource).toContain("Edit Assumptions");
  });
});
