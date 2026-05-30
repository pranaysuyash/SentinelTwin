import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const reportLitePath = new URL("../bottom-panel/ReportLiteTab.tsx", import.meta.url);

describe("ReportLiteTab", () => {
  test("exposes markdown and html export actions for the handoff report", () => {
    const source = readFileSync(reportLitePath, "utf8");

    expect(source).toContain("Export Markdown");
    expect(source).toContain("handleExportMarkdown");
    expect(source).toContain("exportCompareAsMarkdown");
    expect(source).toContain("Export HTML");
    expect(source).toContain("Export Evidence Bundle");
    expect(source).toContain("Export PDF");
    expect(source).toContain("handleExportPdf");
    expect(source).toContain("exportTextAsPdf");
    expect(source).toContain("compareReportSelection ? \"compare\" : \"single\"");
    expect(source).toContain("Copy");
    expect(source).toContain("Copy compare link");
    expect(source).toContain("Compare provenance:");
    expect(source).toContain("Print");
    expect(source).toContain("Report Summary");
    expect(source).toContain("Truth: Computed");
    expect(source).toContain("buildReportSummaryLines");
    expect(source).toContain("getReportExportPresets");
    expect(source).toContain("Audience");
    expect(source).toContain("reportAudience");
    expect(source).toContain("Visibility");
    expect(source).toContain("reportVisibility");
    expect(source).toContain("Latest Run");
    expect(source).toContain("Truth Ladder");
    expect(source).toContain("Best Zone Quality");
    expect(source).toContain("Zones Failed");
    expect(source).toContain("Temporal Operational Twin");
    expect(source).toContain("Reconstructable Checkpoints");
    expect(source).toContain("Published Checkpoints");
    expect(source).toContain("Checkpoint Age");
    expect(source).toContain("Latest Published Checkpoint");
    expect(source).toContain("Published Age");
    expect(source).toContain("summarizeSceneTruthLadder");
    expect(source).toContain("Occlusion Blame");
    expect(source).toContain("Quality Without");
    expect(source).toContain("Operational Evidence");
  });
});
