import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const viewModeBarPath = join(import.meta.dir, "../../..", "components/view/ViewModeBar.tsx");

describe("ViewModeBar semantics", () => {
  test("labels mode buttons and uses the shared viewport token", () => {
    const source = readFileSync(viewModeBarPath, "utf8");

    expect(source).toContain('`Switch to ${label} mode`');
    expect(source).toContain("aria-pressed={active}");
    expect(source).toContain("Map View");
    expect(source).toContain("Camera View");
    expect(source).toContain("Camera Wall");
    expect(source).toContain("Path Replay");
    expect(source).toContain("MAP_COLORS.viewport");
    expect(source).toContain("MAP_COLORS.panelFillAlt");
  });
});
