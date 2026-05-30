import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const viewModeBarPath = "./src/components/view/ViewModeBar.tsx";

describe("ViewModeBar", () => {
  test("includes report mode and respects view mode bar visibility", () => {
    const source = readFileSync(viewModeBarPath, "utf8");

    expect(source).toContain('mode: "report"');
    expect(source).toContain("Coverage - Map & Analysis");
    expect(source).toContain("Camera View - Single Camera");
    expect(source).toContain("Camera Wall - Multi Camera");
    expect(source).toContain("Path Replay - Route Analysis");
    expect(source).toContain("Compare - Before / After");
    expect(source).toContain("Report Lite - Quick Report");
    expect(source).toContain('const visible = useStudioStore((s) => s.visibleComponents.view_mode_bar);');
    expect(source).toContain("if (!visible) return null;");
  });
});
