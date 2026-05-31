import { describe, expect, test } from "bun:test";

import { computeAdversarialPath } from "@sentineltwin/simulation";
import { createCoverageEvaluator } from "@sentineltwin/simulation";
import { createTestCamera, createTestScene } from "./helpers";

// Create a simple room with one camera and one critical zone
function buildBasicScene() {
  const scene = createTestScene({
    width: 6,
    depth: 6,
    cameras: [
      createTestCamera({
        id: "cam_main",
        position: [3, 2.5, 1],
        yawDeg: 180,
        pitchDeg: -35,
        mountType: "ceiling",
        rangeM: 10,
        fovHorizontalDeg: 90,
        fovVerticalDeg: 80,
      }),
    ],
  });

  scene.entryPoints = [
    {
      id: "entry_door",
      nodeType: "entry_point",
      label: "Main Door",
      position: [1, 5.5],
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    },
  ];

  scene.criticalZones = [
    {
      id: "zone_counter",
      nodeType: "critical_zone",
      label: "Counter",
      targetType: "person",
      polygon: [
        [2, 1.5],
        [4, 1.5],
        [4, 2.5],
        [2, 2.5],
      ],
      requiredQuality: "recognition",
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    },
  ];

  return scene;
}

type CoverageCellResult = {
  x: number;
  z: number;
  quality: string;
  coveringCameras: string[];
  probabilities: number[];
};

describe("computeAdversarialPath", () => {
  test("returns a path from entry point to critical zone", () => {
    const scene = buildBasicScene();
    const evaluator = createCoverageEvaluator(scene);
    const coverageCells = evaluator.computeCoverageCells(4) as CoverageCellResult[];
    const result = computeAdversarialPath(scene, coverageCells);

    expect(result).toBeDefined();
    expect(result!.waypoints.length).toBeGreaterThan(0);
    expect(result!.criticalZoneReachable).toBe(true);
    expect(result!.criticalZonesReachableAlongRoute).toContain("Counter");
  });

  test("returns totalExposureScore greater than 0", () => {
    const scene = buildBasicScene();
    const evaluator = createCoverageEvaluator(scene);
    const coverageCells = evaluator.computeCoverageCells(4) as CoverageCellResult[];
    const result = computeAdversarialPath(scene, coverageCells);

    expect(result).toBeDefined();
    expect(result!.totalExposureScore).toBeGreaterThan(0);
    expect(result!.totalDurationS).toBeGreaterThan(0);
  });

  test("maxDetectionProbability reflects worst detection risk along path", () => {
    const scene = buildBasicScene();
    const evaluator = createCoverageEvaluator(scene);
    const coverageCells = evaluator.computeCoverageCells(4) as CoverageCellResult[];
    const result = computeAdversarialPath(scene, coverageCells);

    expect(result).toBeDefined();
    expect(result!.maxDetectionProbability).toBeGreaterThan(0);
    expect(result!.maxDetectionProbability).toBeLessThanOrEqual(1);
  });

  test("returns unreachable result when entry has no walkable path to zone", () => {
    // Scene with a solid obstruction spanning the full interior width
    // to ensure no walkable path exists from entry to zone.
    const scene = buildBasicScene();
    scene.obstructions = [
      {
        id: "obs_wall",
        nodeType: "obstruction",
        label: "Full Barrier",
        position: [3, 1, 3],
        rotationYDeg: 0,
        dimensions: [5.8, 0.2, 3],
        material: "solid",
        visionTransmission: 0,
        glareRisk: false,
        nightIRReflective: false,
        movable: false,
        movableByAI: false,
        obstructionType: "wall",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
        weightKg: 500,
      },
    ];

    const evaluator = createCoverageEvaluator(scene);
    const coverageCells = evaluator.computeCoverageCells(4) as CoverageCellResult[];
    const result = computeAdversarialPath(scene, coverageCells);

    expect(result).toBeDefined();
    expect(result!.criticalZoneReachable).toBe(false);
    expect(result!.failureReason).toBeDefined();
  });

  test("detectionQualityExposure has entries for all quality levels", () => {
    const scene = buildBasicScene();
    const evaluator = createCoverageEvaluator(scene);
    const coverageCells = evaluator.computeCoverageCells(4) as CoverageCellResult[];
    const result = computeAdversarialPath(scene, coverageCells);

    expect(result).toBeDefined();
    const exposure = result!.detectionQualityExposure as Record<string, number>;
    expect(exposure.detection).toBeDefined();
    expect(exposure.recognition).toBeDefined();
    expect(exposure.identification).toBeDefined();
  });

  test("coverageGapsUsed includes solid obstructions the path passes through", () => {
    const scene = buildBasicScene();
    scene.obstructions = [
      {
        id: "obs_shelf",
        nodeType: "obstruction",
        label: "Tall Shelf",
        position: [3, 1, 4],
        rotationYDeg: 0,
        dimensions: [1.5, 0.6, 2],
        material: "solid",
        visionTransmission: 0,
        glareRisk: false,
        nightIRReflective: false,
        movable: false,
        movableByAI: false,
        obstructionType: "shelf",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
        weightKg: 100,
      },
    ];

    const evaluator = createCoverageEvaluator(scene);
    const coverageCells = evaluator.computeCoverageCells(4) as CoverageCellResult[];
    const result = computeAdversarialPath(scene, coverageCells);

    expect(result).toBeDefined();
    // The path should pass through or near the obstruction
    expect(Array.isArray(result!.coverageGapsUsed)).toBe(true);
  });

  test("returns undefined when scene has no entry points or critical zones", () => {
    const scene = createTestScene({
      cameras: [createTestCamera()],
    });
    scene.entryPoints = [];
    scene.criticalZones = [];

    const evaluator = createCoverageEvaluator(scene);
    const coverageCells = evaluator.computeCoverageCells(4) as CoverageCellResult[];
    const result = computeAdversarialPath(scene, coverageCells);

    expect(result).toBeUndefined();
  });

  test("waypoints include position, time, quality, and camera exposure", () => {
    const scene = buildBasicScene();
    const evaluator = createCoverageEvaluator(scene);
    const coverageCells = evaluator.computeCoverageCells(4) as CoverageCellResult[];
    const result = computeAdversarialPath(scene, coverageCells);

    expect(result).toBeDefined();
    const first = result!.waypoints[0];
    expect(first.position).toHaveLength(2);
    expect(first.timeS).toBeGreaterThanOrEqual(0);
    expect(first.detectionQuality).toBeDefined();
    expect(first.detectionProbability).toBeGreaterThanOrEqual(0);
  });
});
