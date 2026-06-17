import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const viewModeBarPath = "./src/components/view/ViewModeBar.tsx";

describe("ViewModeBar semantics", () => {
  test("labels mode buttons and uses the shared viewport token", () => {
    const source = readFileSync(viewModeBarPath, "utf8");

    expect(source).toContain('aria-label={`Switch to ${label} mode`}');
    expect(source).toContain("aria-pressed={active}");
    expect(source).toContain("Map View");
    expect(source).toContain("Camera View");
    expect(source).toContain("Camera Wall");
    expect(source).toContain("Path Replay");
    expect(source).toContain("MAP_COLORS.viewport");
    expect(source).toContain("MAP_COLORS.panelFillAlt");
  });
});
