import { describe, expect, test } from "bun:test";

import { computeCoverageCells } from "@/simulation/coverage";
import {
  createTestCamera,
  createTestScene,
  findCellNear,
} from "@/simulation/__tests__/helpers";

describe("computeCoverageCells FOV handling", () => {
  const scene = createTestScene({
    cameras: [
      createTestCamera({
        position: [2, 2.5, 2],
        yawDeg: 0,
        pitchDeg: -35,
        fovHorizontalDeg: 90,
        fovVerticalDeg: 80,
      }),
    ],
  });
  const cells = computeCoverageCells(scene, 4);

  test("covers a cell directly in front of the camera", () => {
    const frontCell = findCellNear(cells, 1.875, 0.875);

    expect(frontCell.quality).not.toBe("none");
  });

  test("drops cells behind the camera out of coverage", () => {
    const behindCell = findCellNear(cells, 2.875, 2.875);

    expect(behindCell.quality).toBe("none");
  });

  test("treats the exact horizontal FOV edge as visible but rejects cells past it", () => {
    // The edge cell sits at a 45° horizontal angle from a 90° FoV camera.
    const edgeCell = findCellNear(cells, 2.875, 1.125);
    const outsideCell = findCellNear(cells, 3.125, 1.125);

    expect(edgeCell.quality).not.toBe("none");
    expect(outsideCell.quality).toBe("none");
  });
});
