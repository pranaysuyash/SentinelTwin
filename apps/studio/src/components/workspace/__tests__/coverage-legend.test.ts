import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const coverageLegendPath = "./src/components/workspace/CoverageLegend.tsx";

describe("CoverageLegend shell semantics", () => {
  test("uses explicit accessibility hooks and shared map tokens", () => {
    const source = readFileSync(coverageLegendPath, "utf8");

    expect(source).toContain('aria-controls="coverage-legend-body"');
    expect(source).toContain('aria-controls="coverage-legend-filters"');
    expect(source).toContain('aria-expanded={!collapsed}');
    expect(source).toContain('aria-expanded={showFilters}');
    expect(source).toContain("MAP_COLORS.viewport");
    expect(source).toContain("MAP_COLORS.panelText");
  });
});
