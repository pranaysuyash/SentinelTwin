import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const reportLiteTabPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/ReportLiteTab.tsx";

describe("ReportLiteTab", () => {
  test("supports before/after compare export mode with snapshot selectors", () => {
    const source = readFileSync(reportLiteTabPath, "utf8");

    expect(source).toContain("Before/After");
    expect(source).toContain("buildCompareReportData");
    expect(source).toContain("exportCompareAsHtml");
    expect(source).toContain("Snapshot A");
    expect(source).toContain("Snapshot B");
    expect(source).toContain("compareVisualEvidence");
    expect(source).toContain("compareReportSelection");
    expect(source).toContain("Using captured Compare canvas images");
  });
});
