import { describe, expect, test } from "bun:test";

import {
  createSmallRetailShopScene,
  smallRetailShopScene,
} from "@/demo-scenes/small-retail-shop";
import { qualityToScore } from "@/simulation/dori";
import { simulateStudio } from "@/simulation/simulate-studio";
import { createTestCamera, createTestScene } from "@/simulation/__tests__/helpers";

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
    expect(baseline.cameraResults.find((entry) => entry.cameraId === "cam_entrance")?.offlineImpact.length).toBeGreaterThan(0);
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

  test("reduces overall quality scores at night", { timeout: 20000 }, () => {
    const dayResult = simulateStudio(createSmallRetailShopScene());
    const nightScene = createSmallRetailShopScene();
    nightScene.assumptions.timeOfDay = "night";

    const nightResult = simulateStudio(nightScene);

    expect(nightResult.averageWalkableQuality).toBeLessThan(dayResult.averageWalkableQuality);
    expect(nightResult.identificationAreaPct).toBeLessThanOrEqual(dayResult.identificationAreaPct);
  });

  test("enforces camera range before quality scoring", () => {
    const scene = createTestScene({
      width: 8,
      depth: 8,
      cameras: [
        createTestCamera({
          id: "cam_short",
          position: [1, 2.4, 1],
          yawDeg: 0,
          pitchDeg: -20,
          rangeM: 1.5,
        }),
      ],
    });
    scene.criticalZones = [
      {
        id: "zone_far",
        nodeType: "critical_zone",
        label: "Far Zone",
        polygon: [
          [6, 6],
          [7, 6],
          [7, 7],
          [6, 7],
        ],
        heightM: 2,
        priority: "high",
        requiredQuality: "detection",
        targetType: "person_detection",
        nightRequired: false,
        redundancyRequired: false,
        privacyZone: false,
      },
    ];

    const result = simulateStudio(scene);
    expect(result.totalCoveragePct).toBeGreaterThanOrEqual(0);
    expect(result.cameraResults[0]?.qualityByZone["Far Zone"]).toBe("none");
    expect(result.criticalZoneResults[0]?.status).toBe("fail");
  });

  test("uses scene PPM thresholds instead of hard-coded DORI constants", () => {
    const scene = createSmallRetailShopScene();
    const baseline = simulateStudio(scene);

    scene.assumptions.pixelsPerMeter = {
      detection: 60,
      observation: 120,
      recognition: 240,
      identification: 480,
    };

    const stricter = simulateStudio(scene);

    expect(stricter.recognitionAreaPct).toBeLessThanOrEqual(baseline.recognitionAreaPct);
    expect(stricter.identificationAreaPct).toBeLessThanOrEqual(baseline.identificationAreaPct);
  });

  test("produces data-driven recommendations from actual simulation output", () => {
    const result = simulateStudio(createSmallRetailShopScene());

    // At least one recommendation is generated
    expect(result.recommendations.length).toBeGreaterThan(0);
    // Recommendations reference real obstruction labels from the scene, not hardcoded strings
    const moveReco = result.recommendations.find((r) => r.type === "move_object");
    expect(moveReco).toBeDefined();
    expect(moveReco?.description).toContain("Cupboard"); // actual label from scene JSON
    // Counterfactual simulation runs — verified may be true or false depending on outcome
    expect(result.recommendations.every((r) => typeof r.verified === "boolean")).toBe(true);
  });

  test("computeCoverage benchmark", { timeout: 20000 }, () => {
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
