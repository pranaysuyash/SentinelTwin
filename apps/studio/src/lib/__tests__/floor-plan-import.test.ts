import { describe, expect, test } from "bun:test";

import {
  createSceneFromFloorPlan,
  deriveFloorPlanSemanticContext,
  evaluateFloorPlanTierGate,
  getFloorPlanDiagnostics,
  getFloorPlanTierGateWarning,
  normalizeFloorPlanResult,
  recalibrateFloorPlanResult,
  validateFloorPlan,
  type FloorPlanResult,
} from "@/lib/floor-plan-import";

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
    expect(scene.source).toBe("import");
    expect(scene.dimensions).toEqual({ width: 8, depth: 6, height: 3 });
    expect(scene.walls.length).toBe(2);
    expect(scene.doors.length).toBe(1);
    expect(scene.windows.length).toBe(1);
    expect(scene.cameras.length).toBe(0);
    expect(scene.securityLights.length).toBe(0);
    expect(scene.changeLog.some((entry) => entry.startsWith("Floor plan import:"))).toBe(true);
    expect(scene.changeLog.some((entry) => entry.startsWith("Floor plan diagnostics:"))).toBe(true);
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

describe("floor-plan import diagnostics", () => {
  test("flags duplicate walls and off-wall openings before scene creation", () => {
    const result: FloorPlanResult = {
      imageWidth: 1000,
      imageHeight: 800,
      scalePixelsPerMeter: 100,
      confidence: 0.7,
      roomDimensions: { widthM: 10, depthM: 8, heightM: 3 },
      walls: [
        { start: { x: 100, y: 100 }, end: { x: 900, y: 100 }, detected: true },
        { start: { x: 102, y: 104 }, end: { x: 898, y: 104 }, detected: true },
        { start: { x: 900, y: 100 }, end: { x: 900, y: 700 }, detected: true },
        { start: { x: 100, y: 700 }, end: { x: 900, y: 700 }, detected: true },
        { start: { x: 100, y: 100 }, end: { x: 100, y: 700 }, detected: true },
      ],
      doors: [{ position: { x: 500, y: 300 }, widthM: 0.9, orientation: "horizontal" }],
      windows: [{ position: { x: 900, y: 400 }, widthM: 1.2, orientation: "vertical" }],
    };

    const diagnostics = getFloorPlanDiagnostics(result);
    expect(diagnostics.duplicateWallPairs).toBe(1);
    expect(diagnostics.unsnappedDoorCount).toBe(1);
    expect(diagnostics.unsnappedWindowCount).toBe(0);

    const validation = validateFloorPlan(result);
    expect(validation.diagnostics).toEqual(diagnostics);
    expect(validation.warnings.some((warning) => warning.includes("near-duplicate wall pair"))).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes("door/window marker"))).toBe(true);
  });
});

describe("SceneBuilderWizard floor-plan extraction config", () => {
  test("keeps the import scale control wired to the actual extractor config", async () => {
    const { getFloorPlanExtractionConfig } = await import("@/components/scan-to-scene/floor-plan-extraction-config");

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

  describe("floor-plan Tier 1 gate", () => {
    const buildResult = (overrides: Partial<FloorPlanResult> = {}): FloorPlanResult => ({
      imageWidth: 1000,
      imageHeight: 800,
      scalePixelsPerMeter: 100,
      confidence: 0.78,
      roomDimensions: { widthM: 10, depthM: 8, heightM: 3 },
      walls: [
        { start: { x: 100, y: 100 }, end: { x: 900, y: 100 }, detected: true },
        { start: { x: 900, y: 100 }, end: { x: 900, y: 700 }, detected: true },
        { start: { x: 100, y: 700 }, end: { x: 900, y: 700 }, detected: true },
        { start: { x: 100, y: 100 }, end: { x: 100, y: 700 }, detected: true },
      ],
      doors: [{ position: { x: 500, y: 100 }, widthM: 0.9, orientation: "horizontal" }],
      windows: [{ position: { x: 900, y: 450 }, widthM: 1.2, orientation: "vertical" }],
      ...overrides,
    });

    test("returns rescan_required for low-quality imports", () => {
      const lowQuality = buildResult({
        confidence: 0.15,
        walls: [{ start: { x: 100, y: 120 }, end: { x: 220, y: 130 }, detected: true }],
        doors: [],
        windows: [],
      });
      const context = deriveFloorPlanSemanticContext(lowQuality);
      const gate = evaluateFloorPlanTierGate(context);
      expect(gate.action).toBe("rescan_required");
      expect(getFloorPlanTierGateWarning(gate)).toContain("blocked this import");
    });

    test("returns human_review when scene type stays unknown", () => {
      const unknownScene = buildResult({
        roomDimensions: { widthM: 24, depthM: 5, heightM: 3 },
        walls: [
          { start: { x: 80, y: 100 }, end: { x: 920, y: 100 }, detected: true },
          { start: { x: 920, y: 100 }, end: { x: 920, y: 700 }, detected: true },
          { start: { x: 80, y: 700 }, end: { x: 920, y: 700 }, detected: true },
          { start: { x: 80, y: 100 }, end: { x: 80, y: 700 }, detected: true },
          { start: { x: 300, y: 100 }, end: { x: 300, y: 700 }, detected: true },
          { start: { x: 700, y: 100 }, end: { x: 700, y: 700 }, detected: true },
        ],
        doors: [{ position: { x: 500, y: 100 }, widthM: 1, orientation: "horizontal" }],
        windows: [],
      });
      const context = deriveFloorPlanSemanticContext(unknownScene);
      const gate = evaluateFloorPlanTierGate(context);
      expect(gate.action).toBe("human_review");
    });

    test("returns cloud_geometry_required for low-clutter confidence", () => {
      const lowClutter = buildResult({
        walls: [
          { start: { x: 100, y: 100 }, end: { x: 900, y: 100 }, detected: true },
          { start: { x: 900, y: 100 }, end: { x: 900, y: 700 }, detected: true },
          { start: { x: 100, y: 700 }, end: { x: 900, y: 700 }, detected: true },
          { start: { x: 100, y: 100 }, end: { x: 100, y: 700 }, detected: true },
          { start: { x: 200, y: 250 }, end: { x: 220, y: 250 }, detected: true },
          { start: { x: 280, y: 320 }, end: { x: 300, y: 320 }, detected: true },
          { start: { x: 460, y: 380 }, end: { x: 480, y: 380 }, detected: true },
          { start: { x: 620, y: 450 }, end: { x: 640, y: 450 }, detected: true },
        ],
        doors: [
          { position: { x: 500, y: 100 }, widthM: 0.9, orientation: "horizontal" },
          { position: { x: 500, y: 400 }, widthM: 0.9, orientation: "horizontal" },
        ],
        windows: [{ position: { x: 900, y: 450 }, widthM: 1.2, orientation: "vertical" }],
      });
      const context = deriveFloorPlanSemanticContext(lowClutter);
      expect(context.confidence).toBe("low_clutter");
      const gate = evaluateFloorPlanTierGate(context);
      expect(gate.action).toBe("cloud_geometry_required");
    });

    test("returns proceed_to_tier2 for stable imports", () => {
      const context = deriveFloorPlanSemanticContext(buildResult());
      const gate = evaluateFloorPlanTierGate(context);
      expect(gate.action).toBe("proceed_to_tier2");
      expect(getFloorPlanTierGateWarning(gate)).toBeNull();
    });
  });
});
