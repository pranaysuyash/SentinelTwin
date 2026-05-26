import { describe, expect, test } from "bun:test";

import { buildCoverageGrid } from "@/simulation/grid";
import { createTestScene } from "@/simulation/__tests__/helpers";

describe("buildCoverageGrid", () => {
  test("builds the expected 10m x 7m grid at 4 cells per meter", () => {
    const scene = createTestScene({ width: 10, depth: 7 });
    const grid = buildCoverageGrid(scene, 4);

    expect(grid.cols).toBe(40);
    expect(grid.rows).toBe(28);
    expect(grid.cells).toHaveLength(1120);
    expect(grid.cellSize).toBe(0.25);
  });

  test("keeps every cell inside the room bounds", () => {
    const scene = createTestScene({ width: 10, depth: 7 });
    const grid = buildCoverageGrid(scene, 4);

    for (const cell of grid.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThanOrEqual(10);
      expect(cell.z).toBeGreaterThanOrEqual(0);
      expect(cell.z).toBeLessThanOrEqual(7);
    }
  });
});
