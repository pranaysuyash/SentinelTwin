import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const viewModeBarPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../view/ViewModeBar.tsx");

describe("ViewModeBar", () => {
  test("includes report mode and respects view mode bar visibility", () => {
    const source = readFileSync(viewModeBarPath, "utf8");

    expect(source).toContain("PRIMARY_VIEW_OPTIONS");
    expect(source).toContain("SECONDARY_VIEW_OPTIONS");
    expect(source).toContain('mode: "map"');
    expect(source).toContain('mode: "camera_view"');
    expect(source).toContain('mode: "wall"');
    expect(source).toContain('mode: "replay"');
    expect(source).toContain("Map View");
    expect(source).toContain("Camera View");
    expect(source).toContain("Camera Wall");
    expect(source).toContain("Path Replay");
    expect(source).toContain('mode: "report"');
    expect(source).toContain("Compare");
    expect(source).toContain("Report");
    expect(source).toContain('const visible = useStudioStore((s) => s.visibleComponents.view_mode_bar);');
    expect(source).toContain("if (!visible) return null;");
  });
});
