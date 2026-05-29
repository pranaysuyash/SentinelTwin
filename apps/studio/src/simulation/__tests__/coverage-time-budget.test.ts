import { describe, expect, test } from "bun:test";

import type { CoverageCellLike } from "@/components/map/map-geometry";
import { computeCoverageTimeBudget } from "@/simulation/coverage-time-budget";
import { createTestScene } from "@/simulation/__tests__/helpers";

describe("coverage-time-budget", () => {
  test("derives a visible-band speed budget from the active path", () => {
    const scene = createTestScene({
      width: 8,
      depth: 4,
      cameras: [],
    });

    scene.paths = [
      {
        id: "path_budget",
        nodeType: "path",
        label: "Entry Run",
        actorType: "person",
        points: [
          { position: [0, 0] },
          { position: [2, 0] },
          { position: [4, 0] },
        ],
        speedMps: 1,
        heightM: 1.7,
        timeOfDay: "day",
        intent: "incident_replay",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const coverageCells: CoverageCellLike[] = [
      { x: 0, z: 0, quality: "none", coveringCameras: [] },
      { x: 1, z: 0, quality: "none", coveringCameras: [] },
      { x: 2, z: 0, quality: "recognition", coveringCameras: ["cam_a"] },
      { x: 3, z: 0, quality: "recognition", coveringCameras: ["cam_a"] },
      { x: 4, z: 0, quality: "recognition", coveringCameras: ["cam_a"] },
    ];

    const budget = computeCoverageTimeBudget(scene.paths[0]!, coverageCells, "observation", 2);

    expect(budget.threshold).toBe("observation");
    expect(budget.totalDistanceM).toBeCloseTo(4, 1);
    expect(budget.firstVisibleDistanceM).toBeGreaterThan(1.7);
    expect(budget.firstVisibleDistanceM).toBeLessThan(1.8);
    expect(budget.firstVisibleTimeS).toBeGreaterThan(1.7);
    expect(budget.firstVisibleTimeS).toBeLessThan(1.8);
    expect(budget.visibleDurationS).toBeGreaterThan(2);
    expect(budget.visibleDurationS).toBeLessThan(2.3);
    expect(budget.hiddenDurationS).toBeGreaterThan(1.7);
    expect(budget.hiddenDurationS).toBeLessThan(2.1);
    expect(budget.requiredSpeedMps).toBeGreaterThan(1);
    expect(budget.requiredSpeedMps).toBeLessThan(1.2);
    expect(budget.budgetMet).toBe(false);
    expect(budget.segments.some((segment) => segment.visible)).toBe(true);
    expect(budget.segments.at(-1)?.meetsBudget).toBe(false);
  });
});
