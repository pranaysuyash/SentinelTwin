import { describe, expect, test } from "bun:test";

import { createSceneFromFloorPlan, normalizeFloorPlanResult, recalibrateFloorPlanResult, type FloorPlanResult } from "@/lib/floor-plan-import";

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
    expect(scene.dimensions).toEqual({ width: 8, depth: 6, height: 3 });
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

describe("normalizeFloorPlanResult", () => {
  test("snaps openings to nearest wall anchors and recomputes dimensions", () => {
    const base: FloorPlanResult = {
      imageWidth: 1200,
      imageHeight: 900,
      scalePixelsPerMeter: 100,
      confidence: 0.3,
      roomDimensions: { widthM: 1, depthM: 1, heightM: 3 },
      walls: [
        { start: { x: 100, y: 120 }, end: { x: 900, y: 120 }, detected: true },
        { start: { x: 900, y: 120 }, end: { x: 900, y: 700 }, detected: true },
      ],
      doors: [{ position: { x: 500, y: 140 }, widthM: 0.9, orientation: "horizontal" }],
      windows: [{ position: { x: 870, y: 400 }, widthM: 1.2, orientation: "vertical" }],
    };

    const normalized = normalizeFloorPlanResult(base);
    expect(normalized.roomDimensions.widthM).toBeGreaterThan(1);
    expect(normalized.roomDimensions.depthM).toBeGreaterThan(1);
    expect(normalized.doors[0]?.position.y).toBe(120);
    expect(normalized.windows[0]?.position.x).toBe(900);
  });
});

describe("SceneBuilderWizard floor-plan extraction config", () => {
  test("keeps the import scale control wired to the actual extractor config", async () => {
    const { getFloorPlanExtractionConfig } = await import("@/components/scan-to-scene/SceneBuilderWizard");

    expect(
      getFloorPlanExtractionConfig({
        heightM: 3.2,
        floorPlanScalePixelsPerMeter: 72,
      }),
    ).toEqual({
      roomHeightM: 3.2,
      scalePixelsPerMeter: 72,
    });
  });
});
