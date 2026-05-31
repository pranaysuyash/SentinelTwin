import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const testDir = fileURLToPath(new URL(".", import.meta.url));
const rightPanelPath = resolve(testDir, "../panels/ContextRightPanel.tsx");
const assumptionsPanelPath = resolve(testDir, "../panels/AssumptionsPanel.tsx");
const bulkCameraPath = resolve(testDir, "../panels/BulkCameraEditor.tsx");

describe("ContextRightPanel", () => {
  test("exposes the right panel mode switcher and inspector sections", () => {
    const source = readFileSync(rightPanelPath, "utf8");
    const assumptionsSource = readFileSync(assumptionsPanelPath, "utf8");
    const bulkCameraSource = readFileSync(bulkCameraPath, "utf8");

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
    expect(source).toContain("Bulk Cameras");
    expect(source).toContain("bulk_camera");
    expect(source).toContain("BulkCameraEditor");
    expect(bulkCameraSource).toContain("Apply to All Cameras");
    expect(bulkCameraSource).toContain("Night Mode Batch");
    expect(assumptionsSource).toContain("DORI Model");
    expect(assumptionsSource).toContain("Grid Resolution");
    expect(assumptionsSource).toContain("Open Full Assumptions Tab");
  });
});
