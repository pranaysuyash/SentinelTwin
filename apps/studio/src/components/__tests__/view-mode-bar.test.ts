import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const viewModeBarPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/view/ViewModeBar.tsx";

describe("ViewModeBar", () => {
  test("includes report mode and respects view mode bar visibility", () => {
    const source = readFileSync(viewModeBarPath, "utf8");

    expect(source).toContain('mode: "report"');
    expect(source).toContain('const visible = useStudioStore((s) => s.visibleComponents.view_mode_bar);');
    expect(source).toContain("if (!visible) return null;");
  });
});
