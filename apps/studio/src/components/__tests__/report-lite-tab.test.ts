import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const reportLitePath = "./src/components/bottom-panel/ReportLiteTab.tsx";

describe("ReportLiteTab", () => {
  test("exposes markdown and html export actions for the handoff report", () => {
    const source = readFileSync(reportLitePath, "utf8");

    expect(source).toContain("Export Markdown");
    expect(source).toContain("handleExportMarkdown");
    expect(source).toContain("exportCompareAsMarkdown");
    expect(source).toContain("Export HTML");
    expect(source).toContain("Copy");
    expect(source).toContain("Print");
    expect(source).toContain("Occlusion Blame");
    expect(source).toContain("Quality Without");
  });
});
