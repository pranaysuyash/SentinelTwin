import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const dashboardHomePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../launcher/StudioDashboardHome.tsx");

describe("Studio dashboard launcher surface", () => {
  test("surfaces the V0.1 command-center dashboard surface", () => {
    const source = readFileSync(dashboardHomePath, "utf8");

    expect(source).toContain("SentinelTwin Studio");
    expect(source).toContain("Security Simulation Workspace");
    expect(source).toContain("Open Studio");
    expect(source).toContain("Run Simulation");
    expect(source).toContain("Import JSON");
    expect(source).toContain("New Scene");
    expect(source).toContain("Current Workspace Preview");
    expect(source).toContain("Open Coverage Workspace");
    expect(source).toContain("Open Camera Wall");
    expect(source).toContain("Open Path Replay");
    expect(source).toContain("Compare Fixes");
    expect(source).toContain("Run Demo Walkthrough");
    expect(source).toContain("Worst Quality");
    expect(source).toContain("Redundancy");
    expect(source).toContain("Running");
    expect(source).toContain("Quick Start");
    expect(source).toContain("Security Status");
    expect(source).toContain("OUTCOME SUMMARY");
    expect(source).toContain("OPEN ISSUES");
    expect(source).toContain("SIMULATION ASSUMPTIONS");
    expect(source).toContain("See all issues & recommendations");
    expect(source).toContain("Open Report");
    expect(source).toContain("Edit in Studio");
    expect(source).toContain("New Blank Scene");
    expect(source).toContain("Import Scene JSON");
    expect(source).toContain("Scan a Site");
    expect(source).toContain("AI Layout Draft");
    expect(source).toContain("Recent Workspaces");
    expect(source).toContain("Project metadata");
    expect(source).toContain("All systems operational");
    expect(source).toContain("Security Simulation Studio");
  });
});
