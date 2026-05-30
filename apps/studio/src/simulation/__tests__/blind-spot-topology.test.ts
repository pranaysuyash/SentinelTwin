import { describe, it, expect } from "bun:test";
import { analyseBlindSpotTopology } from "@/simulation/blind-spot-topology";
import type { CoverageCellResult } from "@/schema/security-scene";
import type { SecurityScene } from "@/schema/security-scene";

/** Build a minimal SecurityScene for topology tests */
function makeScene(overrides: Partial<SecurityScene> = {}): SecurityScene {
  return {
    id: "scene_test",
    name: "Test",
    createdAt: 0,
    updatedAt: 0,
    units: "meters",
    dimensions: { width: 10, depth: 8, height: 3 },
    assumptions: {
      wallHeightM: 3,
      personHeightM: 1.75,
      vehicleHeightM: 1.5,
      timeOfDay: "day",
      interiorLightLevel: "normal",
      nightPenaltyMode: "simple",
      backlightIntensity: "none",
      glareIntensity: "none",
      overexposedZones: false,
      doriStandard: "oodpcvs_2025",
      pixelsPerMeter: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
      showAssumptionsPanel: false,
    },
    walls: [],
    doors: [],
    windows: [],
    cameras: [],
    securityLights: [],
    obstructions: [],
    criticalZones: [],
    entryPoints: [],
    paths: [],
    privacyZones: [],
    sensors: [],
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    version: "0.1.0",
    snapshots: [],
    scenarios: [],
    changeLog: [],
    ...overrides,
  };
}

/** Build a cell grid with some cells blind (quality = "none") */
function makeCells(
  spec: Array<{ x: number; z: number; quality: "none" | "detection" | "observation" | "recognition" | "identification" }>,
): CoverageCellResult[] {
  return spec.map((c) => ({
    x: c.x,
    z: c.z,
    quality: c.quality,
    coveringCameras: [],
    blockedBy: [],
    ppm: 0,
    coverageIncluded: true,
    privacyRestricted: false,
  }));
}

describe("analyseBlindSpotTopology", () => {
  it("returns empty array when no blind cells", () => {
    const cells = makeCells([
      { x: 0, z: 0, quality: "detection" },
      { x: 0.5, z: 0, quality: "recognition" },
    ]);
    const result = analyseBlindSpotTopology(makeScene(), cells);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when no cells at all", () => {
    const result = analyseBlindSpotTopology(makeScene(), []);
    expect(result).toHaveLength(0);
  });

  it("identifies a single isolated blind cell as isolated", () => {
    const cells = makeCells([
      { x: 5, z: 4, quality: "none" },
    ]);
    const result = analyseBlindSpotTopology(makeScene(), cells);
    expect(result).toHaveLength(1);
    expect(result[0].classification).toBe("isolated");
    expect(result[0].severity).toBe("low");
    expect(result[0].areaSqM).toBeCloseTo(0.25); // 0.5 * 0.5
  });

  it("classifies blind region near entry point as entry_connected", () => {
    const scene = makeScene({
      entryPoints: [
        { id: "entry_1", nodeType: "entry_point", label: "Front Door", position: [5, 0], source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid" },
      ],
    });
    // Blind cells 0.5m from entry
    const cells = makeCells([
      { x: 5, z: 0, quality: "none" },
      { x: 5, z: 0.5, quality: "none" },
      { x: 5.5, z: 0, quality: "none" },
    ]);
    const result = analyseBlindSpotTopology(scene, cells);
    expect(result).toHaveLength(1);
    expect(result[0].classification).toBe("entry_connected");
    expect(result[0].severity).toBe("medium");
    expect(result[0].areaSqM).toBeCloseTo(0.75);
  });

  it("classifies blind corridor connecting entry to critical zone as entry_corridor", () => {
    const scene = makeScene({
      entryPoints: [
        { id: "entry_1", nodeType: "entry_point", label: "Front Door", position: [0, 0], source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid" },
      ],
      criticalZones: [
        {
          id: "zone_cash",
          nodeType: "critical_zone",
          label: "Cash Counter",
          polygon: [[4.5, 3.5], [5.5, 3.5], [5.5, 4.5], [4.5, 4.5]],
          heightM: 2,
          priority: "critical",
          requiredQuality: "identification",
          targetType: "cash_counter_activity",
          nightRequired: false,
          redundancyRequired: false,
          privacyZone: false,
          source: "manual",
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        },
      ],
    });
    // Contiguous blind path from entry at [0,0] to critical zone at [5,4]
    const cells = makeCells([
      { x: 0, z: 0, quality: "none" },   // near entry
      { x: 0.5, z: 0, quality: "none" },
      { x: 1, z: 0, quality: "none" },
      { x: 1.5, z: 0, quality: "none" },
      { x: 2, z: 0, quality: "none" },
      { x: 2.5, z: 0, quality: "none" },
      { x: 3, z: 0, quality: "none" },
      { x: 3.5, z: 0, quality: "none" },
      { x: 4, z: 0, quality: "none" },
      { x: 4.5, z: 0, quality: "none" },
      { x: 5, z: 0, quality: "none" },
      { x: 5, z: 0.5, quality: "none" },
      { x: 5, z: 1, quality: "none" },
      { x: 5, z: 1.5, quality: "none" },
      { x: 5, z: 2, quality: "none" },
      { x: 5, z: 2.5, quality: "none" },
      { x: 5, z: 3, quality: "none" },
      { x: 5, z: 3.5, quality: "none" }, // inside critical zone
      { x: 5, z: 4, quality: "none" },   // inside critical zone
    ]);
    const result = analyseBlindSpotTopology(scene, cells);
    expect(result).toHaveLength(1);
    expect(result[0].classification).toBe("entry_corridor");
    expect(result[0].severity).toBe("critical");
    expect(result[0].touchesCriticalZone).toBe(true);
    expect(result[0].affectedZoneIds).toContain("zone_cash");
    expect(result[0].description).toContain("corridor");
  });

  it("separates two disconnected blind regions", () => {
    const cells = makeCells([
      { x: 0, z: 0, quality: "none" },
      { x: 0.5, z: 0, quality: "none" },
      // gap
      { x: 5, z: 5, quality: "none" },
      { x: 5.5, z: 5, quality: "none" },
    ]);
    const result = analyseBlindSpotTopology(makeScene(), cells);
    expect(result).toHaveLength(2);
  });

  it("sorts results with critical severity first", () => {
    const scene = makeScene({
      entryPoints: [
        { id: "entry_1", nodeType: "entry_point", label: "Front Door", position: [0, 0], source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid" },
      ],
      criticalZones: [
        {
          id: "zone_1",
          nodeType: "critical_zone",
          label: "Zone",
          polygon: [[0, 0], [1, 0], [1, 1], [0, 1]],
          heightM: 2,
          priority: "critical",
          requiredQuality: "recognition",
          targetType: "person_detection",
          nightRequired: false,
          redundancyRequired: false,
          privacyZone: false,
          source: "manual",
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        },
      ],
    });
    // entry_corridor region (should sort first)
    const cells = makeCells([
      { x: 0, z: 0, quality: "none" },
      { x: 0.5, z: 0, quality: "none" },
      // isolated far away
      { x: 8, z: 7, quality: "none" },
    ]);
    const result = analyseBlindSpotTopology(scene, cells);
    expect(result[0].severity).toBe("critical");
    expect(result[result.length - 1].severity).toBe("low");
  });
});
