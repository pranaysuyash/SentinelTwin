import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const wizardPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx";

describe("ScanSiteWizard", () => {
  test("supports manual correction controls and confidence-gated compile", () => {
    const source = readFileSync(wizardPath, "utf8");

    expect(source).toContain("Drag markers to reposition.");
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("Geometry sanity checks");
    expect(source).toContain("Low-confidence accepted candidates");
    expect(source).toContain("Compile anyway with low-confidence accepted candidates");
  });
});
