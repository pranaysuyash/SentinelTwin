import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const topBarPath = "./src/components/layout/TopBar.tsx";

describe("TopBar target-type switcher", () => {
  test("exposes the global target-type dropdown, live label, and assumptions shortcut", () => {
    const source = readFileSync(topBarPath, "utf8");

    expect(source).toContain("currentTargetLabel");
    expect(source).toContain('Target: Mixed');
    expect(source).toContain('Target: ${currentTargetLabel}');
    expect(source).toContain("setAllZoneTargetTypes");
    expect(source).toContain("TARGET_TYPE_OPTIONS");
    expect(source).toContain("zoneCount > 0");
    expect(source).toContain('<SurfaceButton onClick={() => setBottomTab("assumptions")}>');
    expect(source).toContain("Assumptions");
  });
});
