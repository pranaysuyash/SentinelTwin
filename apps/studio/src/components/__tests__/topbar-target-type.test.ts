import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const topBarPath = "./src/components/layout/TopBar.tsx";

describe("TopBar target-type switcher", () => {
  test("exposes the global target-type dropdown, live label, and assumptions shortcut", () => {
    const source = readFileSync(topBarPath, "utf8");

    expect(source).toContain("currentTargetLabel");
    expect(source).toContain('Default Target: ${currentTargetLabel}');
    expect(source).toContain('setCriticalZoneTargetType');
    expect(source).toContain("setAllZoneTargetTypes");
    expect(source).toContain("TARGET_TYPE_OPTIONS");
    expect(source).toContain("Default Target:");
    expect(source).toContain('<SurfaceButton onClick={() => setBottomTab("assumptions")}>');
    expect(source).toContain("Assumptions");
    expect(source).toContain('<SurfaceButton onClick={() => setBottomTab("provenance")}>');
    expect(source).toContain("Provenance");
    expect(source).toContain('data-testid="topbar-view-settings"');
    expect(source).toContain('data-testid="more-view-settings"');
    expect(source).toContain('aria-label="Open keyboard shortcuts"');
    expect(source).toContain('aria-label="Open more actions"');
  });
});
