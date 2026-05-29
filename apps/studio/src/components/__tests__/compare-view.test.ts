import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const compareViewPath = join(import.meta.dir, "../view/CompareView.tsx");

describe("CompareView", () => {
  test("exposes an evidence bundle export alongside compare exports", () => {
    const source = readFileSync(compareViewPath, "utf8");

    expect(source).toContain("Export JSON");
    expect(source).toContain("Export MD");
    expect(source).toContain("Export HTML");
    expect(source).toContain("Evidence Bundle");
    expect(source).toContain("buildReportEvidenceBundle");
    expect(source).toContain("stringifyReportEvidenceBundle");
    expect(source).toContain("Best zone quality");
    expect(source).toContain("Critical zones failed");
    expect(source).toContain("Critical zones passed");
    expect(source).toContain("Detection range");
  });
});
