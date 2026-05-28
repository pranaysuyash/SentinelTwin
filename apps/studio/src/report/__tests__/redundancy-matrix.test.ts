import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { simulateStudio } from "@/simulation/simulate-studio";
import { buildRedundancyMatrixReport } from "@/report/redundancy-matrix";

describe("buildRedundancyMatrixReport", () => {
  test("computes camera rows and vulnerable zones from the scene", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);
    const matrix = buildRedundancyMatrixReport(scene, result);

    expect(matrix).toBeDefined();
    expect(matrix?.cameraCount).toBe(scene.cameras.length);
    expect(matrix?.zoneCount).toBe(scene.criticalZones.length);
    expect(matrix?.cameraRows.length).toBe(scene.cameras.length);
    expect(matrix?.vulnerableZones.length).toBeGreaterThan(0);
    expect(
      (matrix?.redundantZoneCount ?? 0) +
        (matrix?.spofZoneCount ?? 0) +
        (matrix?.uncoveredZoneCount ?? 0),
    ).toBe(scene.criticalZones.length);
    expect(matrix?.cameraRows[0]?.cameraName).toBeTruthy();
    expect(matrix?.cameraRows[0]?.criticalityLabel).toBeTruthy();
  });
});
