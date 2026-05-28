import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const pagePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../app/page.tsx");

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
    expect(source).toContain('if (!confirmWorkspaceReplacement("import a floor plan")) return;');
    expect(source).toContain('if (!confirmWorkspaceReplacement("start scan intake")) return;');
    expect(source).toContain('if (!confirmWorkspaceReplacement("create a new scene")) return;');
    expect(source).toContain('if (!confirmWorkspaceReplacement("open AI layout draft")) return;');
    expect(source).toContain("onGuidedScanPlanned={() => setShowGuidedScanKickoff(true)}");
    expect(source).toContain("onOpenScene={openScene}");
    expect(source).toContain("savedProjects={savedProjects}");
    expect(source).toContain("onUpdateProjectMetadata={updateSavedSceneMetadata}");
    expect(source).toContain("const [aiDraftPreview, setAiDraftPreview] = useState");
    expect(source).toContain("const aiDraftSummary = useMemo");
    expect(source).toContain("Draft Preview");
    expect(source).toContain("Review before apply");
    expect(source).toContain("Workspace comparison");
    expect(source).toContain("Current vs Draft");
    expect(source).toContain("Generated Scene JSON");
    expect(source).toContain("Show JSON");
    expect(source).toContain("Copy JSON");
    expect(source).toContain("Draft JSON copied to clipboard.");
    expect(source).toContain("Generate Preview");
    expect(source).toContain("Regenerate Preview");
    expect(source).toContain("Use Draft Scene");
    expect(source).toContain("const provenanceNote =");
    expect(source).toContain("setLaunchNotice(provenanceNote)");
    expect(source).toContain("setAiDraftNotice(provenanceNote)");
    expect(source).toContain("AI draft status:");
    expect(source).toContain("Verify Real Camera Footage (Preview)");
    expect(source).toContain("Open Camera View Preview");
    expect(source).toContain("Manual-assisted flow available now");
    expect(source).toContain("Guided Scan Reconstruction (Planned)");
    expect(source).toContain("Open Manual-Assisted Scan");
    expect(source).toContain("Planning mode only: guided capture is not implemented yet, so the manual-assisted scan flow remains the supported entry point.");
    expect(source).toContain("Guided scan is planned. Opening the manual-assisted Scan Site flow instead.");
    expect(source).toContain("const [queryBootEnabled, setQueryBootEnabled] = useState(false);");
    expect(source).toContain('setQueryBootEnabled(new URLSearchParams(window.location.search).get("studio") === "1");');
  });
});
