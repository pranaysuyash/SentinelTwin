import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const beforeAfterTabPath = "./src/components/bottom-panel/BeforeAfterTab.tsx";

describe("BeforeAfterTab", () => {
  test("surfaces a visual diff summary and compare workspace handoff", () => {
    const source = readFileSync(beforeAfterTabPath, "utf8");

    expect(source).toContain("Visual Diff");
    expect(source).toContain("compareVisualEvidence");
    expect(source).toContain("setCompareReportSelection");
    expect(source).toContain('setViewMode("compare")');
    expect(source).toContain("Open Compare View");
    expect(source).toContain("Capture visual evidence in Compare View");
  });
});
