import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const statusBarPath = "./src/components/layout/StatusBar.tsx";

describe("StatusBar", () => {
  test("surfaces scene, view, selection, and coverage context in the footer", () => {
    const source = readFileSync(statusBarPath, "utf8");

    expect(source).toContain("Scene:");
    expect(source).toContain("View:");
    expect(source).toContain("Selection:");
    expect(source).toContain("Coverage:");
    expect(source).toContain("Scene overview");
    expect(source).toContain("Truth: Live");
    expect(source).toContain("Workflow: Idle");
    expect(source).toContain("formatWorkflowLabel");
    expect(source).toContain("activeWorkflowStep");
    expect(source).toContain("activeWorkflowSteps");
    expect(source).toContain("describeSelection");
    expect(source).toContain("formatCoverageSummary");
    expect(source).toContain("Map / Edit");
    expect(source).toContain("Camera View");
    expect(source).toContain("Report");
  });
});
