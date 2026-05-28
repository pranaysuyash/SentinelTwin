import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const topBarPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/layout/TopBar.tsx";

describe("TopBar target-type switcher", () => {
  test("exposes the global target-type dropdown and bulk retarget action", () => {
    const source = readFileSync(topBarPath, "utf8");

    expect(source).toContain("Target Type");
    expect(source).toContain("setAllZoneTargetTypes");
    expect(source).toContain("TARGET_TYPE_OPTIONS");
    expect(source).toContain("zoneCount > 0");
  });
});
