import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const dashboardHomePath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/launcher/StudioDashboardHome.tsx";

describe("Studio dashboard launcher surface", () => {
  test("surfaces the launcher entry flows and project/status cards", () => {
    const source = readFileSync(dashboardHomePath, "utf8");

    expect(source).toContain("Security Simulation Workspace");
    expect(source).toContain("Open Studio");
    expect(source).toContain("Run Simulation");
    expect(source).toContain("Import JSON");
    expect(source).toContain("New Scene");
    expect(source).toContain("Current Workspace Preview");
    expect(source).toContain("Recent Workspaces");
    expect(source).toContain("Quick Start");
    expect(source).toContain("Security Outcome");
    expect(source).toContain("Open Issues");
    expect(source).toContain("Simulation Assumptions");
    expect(source).toContain("AI Layout Draft");
    expect(source).toContain("Product feature status");
  });
});
