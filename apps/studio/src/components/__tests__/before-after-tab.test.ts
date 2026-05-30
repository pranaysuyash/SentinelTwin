import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const beforeAfterTabPath = "./src/components/bottom-panel/BeforeAfterTab.tsx";

describe("BeforeAfterTab", () => {
  test("surfaces a visual diff summary and compare workspace handoff", () => {
    const source = readFileSync(beforeAfterTabPath, "utf8");

    expect(source).toContain("Visual Diff");
    expect(source).toContain("compareVisualEvidence");
    expect(source).toContain("compareReportSelection");
    expect(source).toContain("setCompareReportSelection");
    expect(source).toContain('setViewMode("compare")');
    expect(source).toContain("Open Compare View");
    expect(source).toContain("Copy compare link");
    expect(source).toContain("Scene Intelligence can seed this panel with a checkpoint pair now.");
    expect(source).toContain("Compare provenance:");
    expect(source).toContain("Capture visual evidence in Compare View");
  });
});
