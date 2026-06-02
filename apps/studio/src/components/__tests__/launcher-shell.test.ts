import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const pagePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../hooks/use-studio-navigation.ts");

describe("Studio launcher shell", () => {
  test("wires the launcher dashboard and AI draft handoff via ProductViewRouter", () => {
    const source = readFileSync(pagePath, "utf8");

    // New architecture: ProductViewRouter with handlers
    expect(source).toContain("ProductViewRouter");
    expect(source).toContain("ProductViewHandlers");
    expect(source).toContain("useProductViewStore");
    expect(source).toContain("navigate");

    // Handler definitions
    expect(source).toContain("openCoverageWorkspace");
    expect(source).toContain("openCameraWall");
    expect(source).toContain("openPathReplay");
    expect(source).toContain("openCompareFixes");
    expect(source).toContain("openIssues");
    expect(source).toContain("openReport");
    expect(source).toContain("runSimulation");
    expect(source).toContain("openReferenceWorkspace");
    expect(source).toContain("startDesignFlow");
    expect(source).toContain("openFloorPlanFlow");
    expect(source).toContain("openScanWizard");
    expect(source).toContain("openGuidedScanAssistant");
    expect(source).toContain("handleImportScene");
    expect(source).toContain("createDraftFromScene");
    expect(source).toContain("approveIntakeSession");
    expect(source).toContain("rejectIntakeSession");

    // Workspace navigation via launchWorkspace
    expect(source).toContain("launchWorkspace");
    expect(source).toContain('launchWorkspace("map", "edit", "metrics")');
    expect(source).toContain('launchWorkspace("map", "coverage", "metrics")');
    expect(source).toContain('launchWorkspace("wall", "camera_wall", "metrics")');
    expect(source).toContain('launchWorkspace("replay", "replay", "timeline")');
    expect(source).toContain('launchWorkspace("compare", "compare", "beforeafter")');
    expect(source).toContain('launchWorkspace("report", "report", "report")');

    // State guards
    expect(source).toContain("confirmWorkspaceReplacement");
    expect(source).toContain('confirmWorkspaceReplacement("start scan intake")');
    expect(source).toContain('confirmWorkspaceReplacement("create a new scene")');
    expect(source).toContain('confirmWorkspaceReplacement("import a floor plan")');
    expect(source).toContain('confirmWorkspaceReplacement("start guided scan intake")');
    expect(source).toContain('confirmWorkspaceReplacement("import a scene JSON")');

    // Store interactions
    expect(source).toContain("useStudioStore((s) => s.runSimulation)");
    expect(source).toContain("useStudioStore((s) => s.recordOperationalEvidenceEvent)");
    expect(source).toContain("useStudioStore((s) => s.setSiteIntakeSession)");
    expect(source).toContain("useStudioStore((s) => s.setScene)");

    // Draft pipeline — createSiteIntakeSession is the single entry point
    expect(source).toContain("createSiteIntakeSession");
    expect(source).toContain("promoteToActiveScene");
    expect(source).not.toContain("safeParseSecurityScene");

    // Draft review hooks
    expect(source).toContain("approveIntakeSession");
    expect(source).toContain("rejectIntakeSession");
    expect(source).toContain("approveAndRunBaseline");

    // Scan session events
    expect(source).toContain("kind: \"scan_session_started\"");
    expect(source).toContain("kind: \"scan_compiled\"");

    // JSON import via hidden file input
    expect(source).toContain("parseImportSceneDraft");
  });
});
