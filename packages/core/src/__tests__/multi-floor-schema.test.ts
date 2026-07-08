import { describe, expect, test } from "bun:test";
import { parseSecurityScene, cloneSecurityScene, type SecurityScene } from "../schema/security-scene";

function createTestScene(): SecurityScene {
  const now = Date.now();
  return {
    id: `scene_${now.toString(36)}`,
    name: "Test Scene",
    createdAt: now,
    updatedAt: now,
    units: "meters",
    dimensions: { width: 10, depth: 8, height: 3 },
    levels: [],
    walls: [
      {
        id: "wall_1",
        nodeType: "wall",
        label: "South Wall",
        start: [0, 0],
        end: [10, 0],
        heightM: 3,
        thicknessM: 0.18,
        material: "solid",
        visionTransmission: 0,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ],
    doors: [],
    windows: [],
    cameras: [
      {
        id: "cam_1",
        nodeType: "camera",
        name: "Cam 1",
        label: "Cam 1",
        position: [5, 3, 5],
        yawDeg: 0,
        pitchDeg: -15,
        mountType: "wall",
        mountHeightM: 3,
        fovHorizontalDeg: 90,
        fovVerticalDeg: 60,
        rangeM: 15,
        resolutionMP: 4,
        lensType: "fixed",
        status: "on",
        nightMode: "ir",
        irRangeM: 15,
        thermalCapable: false,
        ptz: false,
        clarity: "good",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ],
    securityLights: [],
    obstructions: [],
    criticalZones: [],
    privacyZones: [],
    sensors: [],
    entryPoints: [],
    paths: [],
    comments: [],
    evidenceArtifacts: [],
    mismatchReports: [],
    assumptions: {
      wallHeightM: 3,
      personHeightM: 1.75,
      vehicleHeightM: 1.5,
      timeOfDay: "day",
      interiorLightLevel: "normal",
      nightPenaltyMode: "simple",
      doriStandard: "oodpcvs_2025",
      pixelsPerMeter: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
      showAssumptionsPanel: false,
      backlightIntensity: "none",
      glareIntensity: "none",
      overexposedZones: false,
      sceneComplexity: "moderate",
      operatorExperience: "trained",
      taskCriticality: "standard",
    },
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    version: "0.1.0",
    snapshots: [],
    scenarios: [],
    changeLog: [],
    crowdProfiles: [],
    fenceSegments: [],
    gateNodes: [],
    bollardLines: [],
  };
}

describe("Core Multi-floor SecurityScene schema (D-328)", () => {
  test("accepts a scene with levels and levelId assignments", () => {
    const base = createTestScene();
    const sceneWithLevels: SecurityScene = {
      ...base,
      levels: [
        { id: "lvl_1", name: "Ground Floor", elevation: 0, height: 3.5, order: 0 },
        { id: "lvl_2", name: "Mezzanine", elevation: 3.5, height: 3.0, order: 1 },
      ],
      walls: [
        { ...base.walls[0], levelId: "lvl_1" },
      ],
      cameras: [
        { ...base.cameras[0], levelId: "lvl_2" },
      ],
    };

    const parsed = parseSecurityScene(sceneWithLevels);
    expect(parsed.levels).toHaveLength(2);
    expect(parsed.levels?.[0]?.name).toBe("Ground Floor");
    expect(parsed.walls[0]?.levelId).toBe("lvl_1");
    expect(parsed.cameras[0]?.levelId).toBe("lvl_2");
  });

  test("scenes without levels or levelId stay valid (backward compatible)", () => {
    const base = createTestScene();
    const parsed = parseSecurityScene(base);
    expect(parsed.levels).toEqual([]);
    expect(parsed.walls[0]?.levelId).toBeUndefined();
  });

  test("cloneSecurityScene preserves levels and levelId assignments", () => {
    const base = createTestScene();
    const sceneWithLevels: SecurityScene = {
      ...base,
      levels: [{ id: "lvl_1", name: "Ground Floor", elevation: 0, height: 3.5, order: 0 }],
      cameras: [{ ...base.cameras[0], levelId: "lvl_1" }],
    };
    const parsed = parseSecurityScene(sceneWithLevels);
    const clone = cloneSecurityScene(parsed);
    expect(clone.levels).toEqual(parsed.levels);
    expect(clone.cameras[0]?.levelId).toBe("lvl_1");
  });
});
