import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const demoModeOverlayPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/demo/DemoModeOverlay.tsx";

describe("DemoModeOverlay", () => {
  test("points users at the coverage breakdown instead of a fake analysis action", () => {
    const source = readFileSync(demoModeOverlayPath, "utf8");

    expect(source).toContain("Open the Coverage Failure Breakdown");
    expect(source).not.toContain("Run Coverage Failure Analysis");
  });
});
