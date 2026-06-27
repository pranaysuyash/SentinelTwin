import { describe, expect, test } from "bun:test";

import { qualityToScore } from "@sentineltwin/core";
import { computeCoverageCells } from "@sentineltwin/simulation";
import {
  createTestCamera,
  createTestLight,
  createTestObstruction,
  createTestScene,
  findCellNear,
} from "./helpers";

function getFrontCellQuality(options: { timeOfDay: "day" | "night"; withLight: boolean }) {
  const scene = createTestScene({
    cameras: [
      createTestCamera({
        position: [2, 2.5, 2],
        yawDeg: 0,
        pitchDeg: -35,
        nightMode: "none",
      }),
    ],
    securityLights: options.withLight ? [createTestLight({ position: [2, 2.8, 1] })] : [],
    assumptions: {
      timeOfDay: options.timeOfDay,
    },
  });

  return findCellNear(computeCoverageCells(scene, 4), 1.875, 0.875);
}

describe("computeCoverageCells lighting penalties", () => {
  test("keeps day quality at or above night quality", () => {
    const dayCell = getFrontCellQuality({ timeOfDay: "day", withLight: false });
    const nightCell = getFrontCellQuality({ timeOfDay: "night", withLight: false });

    expect(qualityToScore(dayCell.quality)).toBeGreaterThanOrEqual(
      qualityToScore(nightCell.quality),
    );
  });

  test("significantly penalizes a non-night camera in dark night conditions", () => {
    const dayCell = getFrontCellQuality({ timeOfDay: "day", withLight: false });
    const darkNightCell = getFrontCellQuality({ timeOfDay: "night", withLight: false });

    expect(qualityToScore(dayCell.quality) - qualityToScore(darkNightCell.quality)).toBeGreaterThanOrEqual(2);
    expect(darkNightCell.ppm).toBeLessThan(dayCell.ppm * 0.2);
  });

  test("recovers quality when a light illuminates the night scene", () => {
    const darkNightCell = getFrontCellQuality({ timeOfDay: "night", withLight: false });
    const litNightCell = getFrontCellQuality({ timeOfDay: "night", withLight: true });

    expect(qualityToScore(litNightCell.quality)).toBeGreaterThan(
      qualityToScore(darkNightCell.quality),
    );
    expect(litNightCell.ppm).toBeGreaterThan(darkNightCell.ppm);
  });

  test("models light and camera independently so obstructions cast lighting shadows", () => {
    const scene = createTestScene({
      width: 6,
      depth: 6,
      cameras: [
        createTestCamera({
          id: "cam_night",
          position: [3, 2.5, 5],
          yawDeg: 0,
          pitchDeg: -25,
          fovHorizontalDeg: 120,
          rangeM: 12,
          nightMode: "none",
        }),
      ],
      securityLights: [
        createTestLight({
          id: "light_front",
          position: [2, 2.8, 5],
          rangeM: 6,
          brightness: "very_high",
        }),
      ],
      obstructions: [
        createTestObstruction({
          label: "Shadow Shelf",
          position: [2.4, 1, 3],
          dimensions: [0.7, 0.7, 2.4],
          visionTransmission: 0,
        }),
      ],
      assumptions: { timeOfDay: "night" },
    });

    const cells = computeCoverageCells(scene, 4);
    const frontOfShelf = findCellNear(cells, 2.125, 4.125);
    const behindShelf = findCellNear(cells, 2.875, 1.875);
    const frontEval = frontOfShelf.cameraEvaluations?.cam_night;
    const behindEval = behindShelf.cameraEvaluations?.cam_night;

    expect(frontEval?.illuminatedBy).toContain("light_front");
    expect(frontEval?.lightLevel ?? 0).toBeGreaterThan(behindEval?.lightLevel ?? 0);
    expect(behindEval?.shadowedBy).toContain("obs_test");
    expect(behindEval?.reasonCodes).toContain("LIGHT_SHADOWED_BY_OBSTRUCTION");
  });
});
