import { describe, expect, test } from "bun:test";

import { createSceneFromFloorPlan, recalibrateFloorPlanResult, type FloorPlanResult } from "@/lib/floor-plan-import";

describe("createSceneFromFloorPlan", () => {
  test("materializes imported walls, doors, and windows into SecurityScene", () => {
    const floorPlan: FloorPlanResult = {
      imageWidth: 1000,
      imageHeight: 800,
      scalePixelsPerMeter: 100,
      confidence: 0.72,
      roomDimensions: { widthM: 10, depthM: 8, heightM: 3 },
      walls: [
        { start: { x: 100, y: 100 }, end: { x: 900, y: 100 }, detected: true },
        { start: { x: 900, y: 100 }, end: { x: 900, y: 700 }, detected: true },
      ],
      doors: [{ position: { x: 500, y: 100 }, widthM: 0.9, orientation: "horizontal" }],
      windows: [{ position: { x: 900, y: 400 }, widthM: 1.2, orientation: "vertical" }],
    };

    const scene = createSceneFromFloorPlan("Imported Floor Plan", floorPlan);

    expect(scene.name).toBe("Imported Floor Plan");
    expect(scene.source).toBe("floor_plan_import");
    expect(scene.dimensions).toEqual({ width: 10, depth: 8, height: 3 });
    expect(scene.walls.length).toBe(2);
    expect(scene.doors.length).toBe(1);
    expect(scene.windows.length).toBe(1);
    expect(scene.cameras.length).toBe(0);
    expect(scene.securityLights.length).toBe(0);
  });

  test("uses fallback room walls when all detected walls are removed during correction", () => {
    const floorPlan: FloorPlanResult = {
      imageWidth: 1000,
      imageHeight: 800,
      scalePixelsPerMeter: 100,
      confidence: 0.72,
      roomDimensions: { widthM: 10, depthM: 8, heightM: 3 },
      walls: [],
      doors: [{ position: { x: 500, y: 100 }, widthM: 0.9, orientation: "horizontal" }],
      windows: [],
    };

    const scene = createSceneFromFloorPlan("Corrected", floorPlan);
    expect(scene.walls.length).toBe(4);
    expect(scene.doors.length).toBe(1);
    expect(scene.windows.length).toBe(0);
  });
});

describe("recalibrateFloorPlanResult", () => {
  test("updates room dimensions and scale from known dimensions", () => {
    const base: FloorPlanResult = {
      imageWidth: 1000,
      imageHeight: 500,
      scalePixelsPerMeter: 50,
      confidence: 0.8,
      roomDimensions: { widthM: 20, depthM: 10, heightM: 3 },
      walls: [
        { start: { x: 100, y: 100 }, end: { x: 900, y: 100 }, detected: true },
        { start: { x: 900, y: 100 }, end: { x: 900, y: 400 }, detected: true },
      ],
      doors: [],
      windows: [],
    };

    const calibrated = recalibrateFloorPlanResult(base, { widthM: 8, depthM: 3, heightM: 3.4 });

    expect(calibrated.roomDimensions.widthM).toBe(8);
    expect(calibrated.roomDimensions.depthM).toBe(3);
    expect(calibrated.roomDimensions.heightM).toBe(3.4);
    expect(calibrated.scalePixelsPerMeter).toBeGreaterThan(base.scalePixelsPerMeter);
  });
});
