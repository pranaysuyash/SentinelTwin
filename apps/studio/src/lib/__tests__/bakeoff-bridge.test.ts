import { describe, it, expect } from "bun:test";
import { bakeoffToSecurityScene, type BakeoffPrediction } from "@/lib/bakeoff-bridge";
import { safeParseSecurityScene } from "@/schema/security-scene";

const samplePrediction: BakeoffPrediction = {
  image_id: "retail_01_small_shop",
  walls: [
    { x1: 0.0, y1: 0.0, x2: 1.0, y2: 0.0 },
    { x1: 1.0, y1: 0.0, x2: 1.0, y2: 1.0 },
    { x1: 1.0, y1: 1.0, x2: 0.0, y2: 1.0 },
    { x1: 0.0, y1: 1.0, x2: 0.0, y2: 0.0 },
  ],
  doors: [
    { x1: 0.0, y1: 0.2, x2: 0.1, y2: 0.3, class_: "entry" },
  ],
  windows: [
    { x1: 0.3, y1: 0.0, x2: 0.5, y2: 0.0, class_: "storefront" },
  ],
  obstructions: [
    { x1: 0.6, y1: 0.4, x2: 0.7, y2: 0.5, class_: "shelf" },
    { x1: 0.6, y1: 0.6, x2: 0.7, y2: 0.7, class_: "shelf" },
  ],
  critical_zones: [
    { polygon: [0.2, 0.6, 0.4, 0.6, 0.4, 0.8, 0.2, 0.8], zone_type: "cash_register" },
  ],
};

describe("bakeoffToSecurityScene", () => {
  it("produces a Zod-valid SecurityScene", () => {
    const scene = bakeoffToSecurityScene(samplePrediction, {
      knownDimensionM: 8,
      axisHint: "width",
    });
    const parsed = safeParseSecurityScene(scene);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      console.error("Zod errors:", parsed.error);
    }
  });

  it("produces 4 walls matching input", () => {
    const scene = bakeoffToSecurityScene(samplePrediction, {
      knownDimensionM: 8,
      axisHint: "width",
    });
    expect(scene.walls).toHaveLength(4);
    expect(scene.walls[0].nodeType).toBe("wall");
    expect(scene.walls[0].start).toEqual([0, 0]);
    const expectedEnd = [8, 0];
    expect(scene.walls[0].end[0]).toBeCloseTo(expectedEnd[0], 1);
    expect(scene.walls[0].end[1]).toBeCloseTo(expectedEnd[1], 1);
  });

  it("maps door to entry point pair", () => {
    const scene = bakeoffToSecurityScene(samplePrediction, {
      knownDimensionM: 8,
      axisHint: "width",
    });
    expect(scene.doors).toHaveLength(1);
    expect(scene.doors[0].nodeType).toBe("door");
    expect(scene.entryPoints).toHaveLength(1);
    expect(scene.entryPoints[0].nodeType).toBe("entry_point");
  });

  it("sets source to ai with trace", () => {
    const scene = bakeoffToSecurityScene(samplePrediction, {
      knownDimensionM: 8,
      axisHint: "width",
    });
    expect(scene.source).toBe("ai");
    expect(scene.sourceTrace).toContain("bakeoff-prediction-v1");
  });

  it("creates entry points and critical zones", () => {
    const scene = bakeoffToSecurityScene(samplePrediction, {
      knownDimensionM: 8,
      axisHint: "width",
    });
    expect(scene.entryPoints.length).toBeGreaterThan(0);
    expect(scene.criticalZones).toHaveLength(1);
    expect(scene.criticalZones[0].targetType).toBe("cash_counter_activity");
  });

  it("handles empty walls gracefully producing a minimal scene", () => {
    const empty: BakeoffPrediction = {
      image_id: "empty",
      walls: [],
      doors: [],
      windows: [],
      obstructions: [],
      critical_zones: [],
    };
    const scene = bakeoffToSecurityScene(empty, { knownDimensionM: 8, axisHint: "width" });
    const parsed = safeParseSecurityScene(scene);
    expect(parsed.success).toBe(true);
    expect(scene.walls).toHaveLength(4);
    expect(scene.source).toBe("ai");
  });
});