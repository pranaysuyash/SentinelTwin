import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const issuesTabPath = "./src/components/bottom-panel/IssuesTab.tsx";

describe("IssuesTab", () => {
  test("supports preview/apply/revert recommendation actions", () => {
    const source = readFileSync(issuesTabPath, "utf8");

    expect(source).toContain("const previewFix = () => {");
    expect(source).toContain("const applyFix = () => {");
    expect(source).toContain("const revertPreview = () => {");
    expect(source).toContain("Preview Fix");
    expect(source).toContain("Apply Fix");
    expect(source).toContain("Revert Preview");
    expect(source).toContain("Privacy Review");
    expect(source).toContain("Restricted Cells");
    expect(source).toContain("selectNode(zoneId)");
  });
});
