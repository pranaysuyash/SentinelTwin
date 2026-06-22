import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const compareViewPath = join(import.meta.dir, "../view/CompareView.tsx");

describe("CompareView", () => {
  test("uses shared path duration utility and sorted timeline events", () => {
    const source = readFileSync(compareViewPath, "utf8");

    expect(source).toContain("@/components/view/camera-view-utils");
    expect(source).toContain("clampPathDuration");
    expect(source).toContain("sortTimelineEvents");
    expect(source).toContain("const timeline = sortTimelineEvents(pathResult.timeline);");
    expect(source).toContain("visiblePathPct");
    expect(source).toContain("clampPathDuration(resultB?.totalDurationS ?? resultA?.totalDurationS ?? 0)");
  });

  test("exposes an evidence bundle export alongside compare exports", () => {
    const source = readFileSync(compareViewPath, "utf8");

    expect(source).toContain("Export Compare Data");
    expect(source).toContain("Share compare link");
    expect(source).toContain("Copy compare link");
    expect(source).toContain("Export MD");
    expect(source).toContain("Export HTML");
    expect(source).toContain("Evidence Bundle");
    expect(source).toContain("buildReportEvidenceBundle");
    expect(source).toContain("stringifyReportEvidenceBundle");
    expect(source).toContain("compareReportSelection");
    expect(source).toContain("Compare provenance:");
    expect(source).toContain("Best zone quality");
    expect(source).toContain("Critical zones failed");
    expect(source).toContain("Critical zones passed");
    expect(source).toContain("Detection range");
    expect(source).toContain("Compare - Before / After");
  });
});
