import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pagePath = "./src/app/page.tsx";

describe("Studio launcher shell", () => {
  test("wires the launcher dashboard and AI draft handoff", () => {
    const source = readFileSync(pagePath, "utf8");

    expect(source).toContain("StudioDashboardHome");
    expect(source).toContain("onOpenCoverageWorkspace={openCoverageWorkspace}");
    expect(source).toContain("onOpenCameraWall={openCameraWall}");
    expect(source).toContain("onOpenPathReplay={openPathReplay}");
    expect(source).toContain("onOpenCompareFixes={openCompareFixes}");
    expect(source).toContain("onOpenIssues={openIssues}");
    expect(source).toContain('const openReport = () => launchWorkspace("report", "report", "report");');
    expect(source).toContain("onRunSimulation={runSimulation}");
    expect(source).toContain("onImportFloorPlan={() => setShowFloorPlanWizard(true)}");
    expect(source).toContain("onScanSite={() => setShowScanWizard(true)}");
    expect(source).toContain("onGuidedScanPlanned={() => setShowGuidedScanKickoff(true)}");
    expect(source).toContain("onOpenScene={openScene}");
    expect(source).toContain("savedProjects={savedProjects}");
    expect(source).toContain("onUpdateProjectMetadata={updateSavedSceneMetadata}");
    expect(source).toContain("const provenanceNote =");
    expect(source).toContain("setLaunchNotice(provenanceNote)");
    expect(source).toContain("setAiDraftNotice(provenanceNote)");
    expect(source).toContain("AI draft status:");
    expect(source).toContain("Verify Real Camera Footage (Preview)");
    expect(source).toContain("Open Camera View Preview");
    expect(source).toContain("Local video ingest + frame extraction");
    expect(source).toContain("Guided Scan Reconstruction (Preview)");
    expect(source).toContain("Start Guided Scan Session");
    expect(source).toContain("const [queryBootEnabled, setQueryBootEnabled] = useState(false);");
    expect(source).toContain('setQueryBootEnabled(query.get("studio") === "1");');
  });
});
