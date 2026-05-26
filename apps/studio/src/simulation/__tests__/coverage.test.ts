import { describe, expect, test } from "bun:test";

import { computeCoverageCells } from "@/simulation/coverage";
import {
  createTestCamera,
  createTestObstruction,
  createTestScene,
  findCellNear,
} from "@/simulation/__tests__/helpers";

function buildOcclusionScene(visionTransmission: number, material: "solid" | "glass" | "grill") {
  return createTestScene({
    width: 6,
    depth: 4,
    cameras: [
      createTestCamera({
        position: [1, 2.5, 2],
        yawDeg: 90,
        pitchDeg: -35,
        mountType: "wall",
      }),
    ],
    obstructions: [
      createTestObstruction({
        id: "obs_blocker",
        label: "Blocker",
        position: [3, 1, 2],
        dimensions: [0.5, 0.5, 2],
        material,
        visionTransmission,
      }),
    ],
  });
}

describe("computeCoverageCells occlusion handling", () => {
  test("keeps a clear line-of-sight cell visible", () => {
    const cells = computeCoverageCells(buildOcclusionScene(0, "solid"), 4);
    const clearCell = findCellNear(cells, 1.875, 1.875);

    expect(clearCell.quality).not.toBe("none");
    expect(clearCell.blockedBy).toEqual([]);
  });

  test("blocks a cell behind a solid obstruction", () => {
    const cells = computeCoverageCells(buildOcclusionScene(0, "solid"), 4);
    const blockedCell = findCellNear(cells, 4.375, 1.875);

    expect(blockedCell.quality).toBe("none");
    expect(blockedCell.blockedBy).toContain("Blocker");
  });

  test("allows partial visibility through high-transmission glass", () => {
    const cells = computeCoverageCells(buildOcclusionScene(0.9, "glass"), 4);
    const throughGlassCell = findCellNear(cells, 4.375, 1.875);

    expect(throughGlassCell.quality).not.toBe("none");
    expect(throughGlassCell.blockedBy).toContain("Blocker");
  });

  test("allows partial visibility through a grill", () => {
    const cells = computeCoverageCells(buildOcclusionScene(0.5, "grill"), 4);
    const throughGrillCell = findCellNear(cells, 4.375, 1.875);

    expect(throughGrillCell.quality).not.toBe("none");
    expect(throughGrillCell.blockedBy).toContain("Blocker");
  });
});
