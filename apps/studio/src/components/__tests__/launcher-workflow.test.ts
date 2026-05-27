import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const launcherPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/app/page.tsx";

describe("Studio launcher workflow", () => {
  test("surfaces the explicit 5-step guided workflow from goal2", () => {
    const source = readFileSync(launcherPath, "utf8");

    expect(source).toContain("Workspace Resume");
    expect(source).toContain("Current Workspace");
    expect(source).toContain("Resume Current Workspace");
    expect(source).toContain("Open Coverage Workspace");
    expect(source).toContain("Saved Scenes");
    expect(source).toContain("Open any saved workspace directly from the launcher.");
    expect(source).toContain("Model-backed if");
    expect(source).toContain("The generated scene will replace the current workspace.");
    expect(source).toContain("Guided Security Workflow (Goal2)");
    expect(source).toContain("1. Define outcomes: what must be detected/recognized and when?");
    expect(source).toContain("2. Choose source: template, floor plan, scan, or AI draft.");
    expect(source).toContain("3. Model site geometry: walls/openings/cameras/obstructions/zones.");
    expect(source).toContain("4. Verify baseline: run simulation and inspect pass/fail, blind spots, reasons.");
    expect(source).toContain("5. Harden and report: replay route, stress conditions, then export evidence.");
    expect(source).toContain("Run Baseline Check");
    expect(source).toContain("Test Cheapest Fix");
    expect(source).toContain("Failure Drill");
    expect(source).toContain("Export Report");
    expect(source).toContain("disabled={scene.cameras.length === 0}");
    expect(source).toContain("disabled={scene.obstructions.length === 0}");
    expect(source).toContain("Product Feature Status");
    expect(source).toContain("PRODUCT_FEATURE_STATUS");
    expect(source).toContain("PRODUCT_FEATURE_STATUS_LAST_VERIFIED");
  });
});
