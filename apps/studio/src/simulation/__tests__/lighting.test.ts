import { describe, expect, test } from "bun:test";

import { qualityToScore } from "@/simulation/dori";
import { computeCoverageCells } from "@/simulation/coverage";
import {
  createTestCamera,
  createTestLight,
  createTestScene,
  findCellNear,
} from "@/simulation/__tests__/helpers";

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
});
