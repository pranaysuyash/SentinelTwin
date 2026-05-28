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
    expect(source).toContain("Scene Work");
    expect(source).toContain("Current Workspace Preview");
    expect(source).toContain("Project Browser");
    expect(source).toContain("Search, pin, and reopen your workspaces first. The demo remains available as the reference baseline below.");
    expect(source).toContain("Selected Workspace");
    expect(source).toContain("Open Workspace");
    expect(source).toContain("Open Coverage");
    expect(source).toContain("Scene Work");
    expect(source).toContain("Scene Starter Gallery");
    expect(source).toContain("Your Workspaces");
    expect(source).toContain("Blank Workspace");
    expect(source).toContain("Import Workspace");
    expect(source).toContain("Scan Workspace");
    expect(source).toContain("AI Draft Workspace");
    expect(source).toContain("badge=\"Blank\"");
    expect(source).toContain("badge=\"Import\"");
    expect(source).toContain("badge=\"Scan\"");
    expect(source).toContain("badge=\"AI\"");
    expect(source).toContain("tone=\"blank\"");
    expect(source).toContain("tone=\"import\"");
    expect(source).toContain("tone=\"scan\"");
    expect(source).toContain("tone=\"ai\"");
    expect(source).toContain("WorkspaceMiniPreview");
    expect(source).toContain("Loading preview");
    expect(source).toContain("Preview loading");
    expect(source).toContain("const [hydrated, setHydrated] = useState(false);");
    expect(source).toContain("setHydrated(true);");
    expect(source).toContain("Reference Demo");
    expect(source).toContain("Draft Workspace");
    expect(source).toContain("Draft");
    expect(source).toContain("sourceBadgeTone");
    expect(source).toContain("Project metadata");
    expect(source).toContain("All tags");
    expect(source).toContain("Pin");
    expect(source).toContain("Save tags");
    expect(source).toContain("Security Outcome");
    expect(source).toContain("Open Issues");
    expect(source).toContain("Simulation Assumptions");
    expect(source).toContain("AI Layout Draft");
    expect(source).toContain("Product feature status");
  });
});
