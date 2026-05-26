import { describe, expect, test } from "bun:test";

import {
  createSmallRetailShopScene,
  smallRetailShopScene,
} from "@/demo-scenes/small-retail-shop";
import { qualityToScore } from "@/simulation/dori";
import { simulateStudio } from "@/simulation/simulate-studio";

describe("simulateStudio", () => {
  test("computes the baseline security failure for the cash counter", () => {
    const result = simulateStudio(smallRetailShopScene);

    expect(result.totalCoveragePct).toBeGreaterThan(0);
    expect(result.cameraResults).toHaveLength(2);
    expect(result.criticalZoneResults).toHaveLength(1);
    expect(result.criticalZoneResults[0]?.label).toBe("Cash Counter");
    expect(result.criticalZoneResults[0]?.status).toBe("fail");
    expect(result.issues.some((issue) => issue.category === "quality_fail")).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.adversarialPath?.targetReached).toBe(true);
    expect(result.pathResults[0]?.timeline.length).toBeGreaterThan(0);
  });

  test("drops coverage when Camera 1 is turned off", () => {
    const baseline = simulateStudio(createSmallRetailShopScene());
    const scene = createSmallRetailShopScene();
    const camera = scene.cameras.find((candidate) => candidate.id === "cam_entrance");

    if (!camera) {
      throw new Error("Expected Camera 1 in demo scene");
    }

    camera.status = "off";

    const result = simulateStudio(scene);

    expect(result.totalCoveragePct).toBeLessThan(baseline.totalCoveragePct);
    expect(result.criticalZoneResults[0]?.status).toBe("fail");
  });

  test("improves coverage when the cupboard is moved away from the aisle", () => {
    const baseline = simulateStudio(createSmallRetailShopScene());
    const scene = createSmallRetailShopScene();
    const cupboard = scene.obstructions.find((candidate) => candidate.id === "obs_cupboard_blocker");

    if (!cupboard) {
      throw new Error("Expected cupboard obstruction in demo scene");
    }

    cupboard.position = [0.5, 0.5, 0.5];
    cupboard.dimensions = [0.5, 0.5, 0.5];

    const result = simulateStudio(scene);
    const baselineZone = baseline.criticalZoneResults[0];
    const movedZone = result.criticalZoneResults[0];

    expect(result.totalCoveragePct).toBeGreaterThanOrEqual(baseline.totalCoveragePct);
    expect(qualityToScore(movedZone?.actualQuality ?? "none")).toBeGreaterThan(
      qualityToScore(baselineZone?.actualQuality ?? "none"),
    );
  });

  test("reduces overall quality scores at night", () => {
    const dayResult = simulateStudio(createSmallRetailShopScene());
    const nightScene = createSmallRetailShopScene();
    nightScene.assumptions.timeOfDay = "night";

    const nightResult = simulateStudio(nightScene);

    expect(nightResult.averageWalkableQuality).toBeLessThan(dayResult.averageWalkableQuality);
    expect(nightResult.identificationAreaPct).toBeLessThanOrEqual(dayResult.identificationAreaPct);
  });

  test("computeCoverage benchmark", () => {
    const iterations = 8;
    const scene = createSmallRetailShopScene();
    const start = performance.now();

    for (let i = 0; i < iterations; i += 1) {
      simulateStudio(scene);
    }

    const avgMs = (performance.now() - start) / iterations;

    console.log(`Average: ${avgMs.toFixed(1)}ms per simulation`);
    expect(avgMs).toBeLessThan(1500);
  });
});
