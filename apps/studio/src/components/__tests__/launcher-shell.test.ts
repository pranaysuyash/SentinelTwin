import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pagePath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/app/page.tsx";

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
    expect(source).toContain("onOpenScene={openScene}");
    expect(source).toContain("savedProjects={savedProjects}");
    expect(source).toContain("onUpdateProjectMetadata={updateSavedSceneMetadata}");
    expect(source).toContain("const provenanceNote =");
    expect(source).toContain("setLaunchNotice(provenanceNote)");
    expect(source).toContain("setAiDraftNotice(provenanceNote)");
    expect(source).toContain("AI draft status:");
    expect(source).toContain("const resolvedSearchParams = use(searchParams ?? Promise.resolve<{ studio?: string | string[] }>({}));");
    expect(source).toContain('const hasQueryBoot = resolvedSearchParams.studio === "1";');
  });
});
