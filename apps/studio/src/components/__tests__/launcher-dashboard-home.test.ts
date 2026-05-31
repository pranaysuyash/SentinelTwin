import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const dashboardHomePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../launcher/StudioDashboardHome.tsx");

describe("Studio dashboard launcher surface", () => {
  test("surfaces the product-home and workspace dashboard surface", () => {
    const source = readFileSync(dashboardHomePath, "utf8");

    expect(source).toContain("Studio dashboard");
    expect(source).toContain("SentinelTwin Studio");
    expect(source).toContain("Security Simulation Workspace");
    expect(source).toContain("Workspace selector:");
    expect(source).toContain("Status:");
    expect(source).toContain("Last run: Never");
    expect(source).toContain("Environment mode:");
    expect(source).toContain("CURRENT WORKSPACE");
    expect(source).toContain("STUDIO");
    expect(source).toContain("Reference Sites");
    expect(source).toContain("Open Studio");
    expect(source).toContain("Run Simulation");
    expect(source).toContain("Import Scene JSON");
    expect(source).toContain("New Blank Scene");
    expect(source).toContain("Coverage");
    expect(source).toContain("Camera Wall");
    expect(source).toContain("Path Replay");
    expect(source).toContain("Compare");
    expect(source).toContain("Run Guided Walkthrough");
    expect(source).toContain("Worst Quality");
    expect(source).toContain("Redundancy");
    expect(source).toContain("Running");
    expect(source).toContain("QUICK START");
    expect(source).toContain("Open Report");
    expect(source).toContain("Scan a Site");
    expect(source).toContain("Guided Scan Assistant");
    expect(source).toContain("Manual-assisted site photo intake");
    expect(source).toContain("AI Layout Draft");
    expect(source).toContain("Run Guided Walkthrough");
    expect(source).toContain("QUICK START");
    expect(source).toContain("RECENT WORKSPACES");
    expect(source).toContain("setTimelineFocusRequest");
    expect(source).toContain("branch:");
    expect(source).toContain("after:");
    expect(source).toContain("Project metadata");
    expect(source).toContain("All systems operational");
    expect(source).toContain("Organization");
    expect(source).toContain("Owner");
    expect(source).toContain("Visibility");
    expect(source).toContain("Target:");
    expect(source).toContain("Route:");
  });
});
