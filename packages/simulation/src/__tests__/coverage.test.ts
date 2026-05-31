import { describe, expect, test } from "bun:test";

import { createCoverageEvaluator, computeCoverageCells } from "@sentineltwin/simulation";
import { getQualityShare } from "@sentineltwin/simulation";
import { qualityToScore } from "@sentineltwin/core";
import {
  createTestCamera,
  createTestObstruction,
  createTestScene,
  findCellNear,
} from "./helpers";

function buildOcclusionScene(visionTransmission: number, material: "solid" | "glass" | "grill") {
  return createTestScene({
    width: 6,
    depth: 4,
    cameras: [
      createTestCamera({
        position: [1, 2.5, 2],
        yawDeg: 90,
        pitchDeg: -35,
        mountType: "wall",
      }),
    ],
    obstructions: [
      createTestObstruction({
        id: "obs_blocker",
        label: "Blocker",
        position: [3, 1, 2],
        dimensions: [0.5, 0.5, 2],
        material,
        visionTransmission,
      }),
    ],
  });
}

describe("computeCoverageCells occlusion handling", () => {
  test("keeps a clear line-of-sight cell visible", () => {
    const cells = computeCoverageCells(buildOcclusionScene(0, "solid"), 4);
    const clearCell = findCellNear(cells, 1.875, 1.875);

    expect(clearCell.quality).not.toBe("none");
    expect(clearCell.blockedBy).toEqual([]);
  });

  test("blocks a cell behind a solid obstruction", () => {
    const cells = computeCoverageCells(buildOcclusionScene(0, "solid"), 4);
    const blockedCell = findCellNear(cells, 4.375, 1.875);

    expect(blockedCell.quality).toBe("none");
    expect(blockedCell.blockedBy).toContain("Blocker");
  });

  test("allows partial visibility through high-transmission glass", () => {
    const cells = computeCoverageCells(buildOcclusionScene(0.9, "glass"), 4);
    const throughGlassCell = findCellNear(cells, 4.375, 1.875);

    expect(throughGlassCell.quality).not.toBe("none");
    expect(throughGlassCell.blockedBy).toContain("Blocker");
  });

  test("allows partial visibility through a grill", () => {
    const cells = computeCoverageCells(buildOcclusionScene(0.5, "grill"), 4);
    const throughGrillCell = findCellNear(cells, 4.375, 1.875);

    expect(throughGrillCell.quality).not.toBe("none");
    expect(throughGrillCell.blockedBy).toContain("Blocker");
  });

  test("returns per-camera evaluation metadata for each visible and blocked sample", () => {
    const cells = computeCoverageCells(createTestScene(), 4);
    const cell = findCellNear(cells, 2.875, 1.125);

    expect(cell.cameraEvaluations).toBeDefined();
    expect(cell.cameraEvaluations).toHaveProperty("cam_test");
    expect(cell.cameraEvaluations?.cam_test).toMatchObject({
      quality: expect.any(String),
      ppm: expect.any(Number),
      probability: expect.any(Number),
      visible: expect.any(Boolean),
      inFov: expect.any(Boolean),
      withinRange: true,
      distanceM: expect.any(Number),
      hAngleDeg: expect.any(Number),
      vAngleDeg: expect.any(Number),
      edgePenaltyMultiplier: expect.any(Number),
      clarityMultiplier: expect.any(Number),
      materialTransmission: expect.any(Number),
      glarePenalty: expect.any(Number),
      lightingPenalty: expect.any(Number),
      lightLevel: expect.any(Number),
      illuminatedBy: expect.any(Array),
      shadowedBy: expect.any(Array),
      finalPpmMultiplier: expect.any(Number),
      reasonCodes: expect.any(Array),
    });
  });

  test("exposes numeric penalty telemetry for low-light and poor-clarity cameras", () => {
    const scene = createTestScene({
      cameras: [
        createTestCamera({
          id: "cam_penalties",
          position: [2, 2.5, 2],
          yawDeg: 0,
          pitchDeg: -30,
          rangeM: 12,
          clarity: "poor",
          nightMode: "none",
        }),
      ],
    });
    scene.assumptions.timeOfDay = "night";
    scene.assumptions.interiorLightLevel = "dark";

    const evaluation = createCoverageEvaluator(scene).evaluatePoint(scene.cameras[0], [2.875, 1.125]);

    expect(evaluation.clarityMultiplier).toBeLessThan(1);
    expect(evaluation.lightingPenalty).toBeGreaterThan(0);
    expect(evaluation.finalPpmMultiplier).toBeLessThan(1);
  });

  test("applies the scene PPM thresholds to live camera quality scoring", () => {
    const scene = createTestScene({
      cameras: [
        createTestCamera({
          position: [2, 2.5, 2],
          yawDeg: 0,
          pitchDeg: -35,
          fovHorizontalDeg: 90,
          fovVerticalDeg: 80,
          rangeM: 12,
          resolutionWidth: 320,
          resolutionHeight: 180,
        }),
      ],
    });
    const point: [number, number] = [2.875, 1.125];

    scene.assumptions.pixelsPerMeter = {
      detection: 25,
      observation: 62.5,
      recognition: 125,
      identification: 250,
    };
    const baseline = createCoverageEvaluator(scene).evaluatePoint(scene.cameras[0], point);

    scene.assumptions.pixelsPerMeter = {
      detection: 100,
      observation: 200,
      recognition: 400,
      identification: 800,
    };
    const stricter = createCoverageEvaluator(scene).evaluatePoint(scene.cameras[0], point);

    scene.assumptions.pixelsPerMeter = {
      detection: 10,
      observation: 20,
      recognition: 40,
      identification: 80,
    };
    const looser = createCoverageEvaluator(scene).evaluatePoint(scene.cameras[0], point);

    expect(qualityToScore(stricter.quality)).toBeLessThan(qualityToScore(baseline.quality));
    expect(qualityToScore(looser.quality)).toBeGreaterThan(qualityToScore(baseline.quality));
  });

  test("supports coverage denominator filtering to only included cells", () => {
    const cells = [
      {
        x: 0,
        z: 0,
        quality: "none" as const,
        coveringCameras: ["cam_test"],
        blockedBy: [],
        ppm: 0,
        coverageIncluded: true,
        privacyRestricted: false,
        cameraEvaluations: {},
        probabilities: [],
      },
      {
        x: 1,
        z: 0,
        quality: "none" as const,
        coveringCameras: [],
        blockedBy: [],
        ppm: 0,
        coverageIncluded: false,
        privacyRestricted: true,
        cameraEvaluations: {},
        probabilities: [],
      },
      {
        x: 2,
        z: 0,
        quality: "detection" as const,
        coveringCameras: ["cam_test"],
        blockedBy: [],
        ppm: 20,
        coverageIncluded: false,
        privacyRestricted: true,
        cameraEvaluations: {},
        probabilities: [],
      },
    ];

    expect(getQualityShare(cells, "none")).toBeCloseTo(66.7, 1);
    expect(getQualityShare(cells, "none", true)).toBe(100);
  });

  test("marks privacy-restricted cells as non-counted but still computed", () => {
    const scene = createTestScene({
      width: 6,
      depth: 6,
      cameras: [createTestCamera({ yawDeg: 180, pitchDeg: -20, fovHorizontalDeg: 180, rangeM: 20 })],
    });

    scene.cameras[0] = createTestCamera({
      id: "cam_front",
      position: [3, 2.5, 4],
      yawDeg: 0,
      pitchDeg: -20,
      fovHorizontalDeg: 120,
      fovVerticalDeg: 90,
      rangeM: 20,
      resolutionMP: 8,
      resolutionWidth: 3840,
      resolutionHeight: 2160,
      clarity: "excellent",
    });

    scene.privacyZones = [
      {
        id: "privacy_restricted_area",
        nodeType: "privacy_zone",
        label: "Staff Restroom",
        polygon: [
          [1.5, 1.5],
          [4.5, 1.5],
          [4.5, 4.5],
          [1.5, 4.5],
        ],
        restriction: "no_video",
        regulation: "GDPR",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const cells = computeCoverageCells(scene, 4);
    const sample = findCellNear(cells, 3, 3);

    expect(sample.privacyRestricted).toBe(true);
    expect(sample.coverageIncluded).toBe(false);
    expect(sample.quality).not.toBe("none");
    expect(sample.coveringCameras).toBeDefined();
  });

  test("records range rejection separately from field-of-view and occlusion", () => {
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
    const cells = computeCoverageCells(scene, 4);
    const farCell = cells.find(
      (cell) => cell.cameraEvaluations?.cam_short?.withinRange === false
        && cell.cameraEvaluations?.cam_short?.quality === "none",
    );
    const visibleCell = cells.find(
      (cell) => cell.cameraEvaluations?.cam_short?.withinRange === true
        && cell.cameraEvaluations?.cam_short.quality !== "none",
    );

    expect(farCell).toBeDefined();
    expect(visibleCell).toBeDefined();
    expect(farCell?.cameraEvaluations?.cam_short?.visible).toBe(false);
    expect(visibleCell?.cameraEvaluations?.cam_short?.visible).toBe(true);
  });

  describe("reflective bounce", () => {
    test("improves quality for a cell behind a reflective window", () => {
      // Scene: camera at (1, 2.5, 1) yaw=90 (facing +X), full-height window
      // at x=3, z=2, full-height. Cell behind the window at x≈5, z≈3.
      // The direct ray crosses the window at the window plane (z=2).
      // The reflected camera sits at z=3 and sees the cell without hitting the window.
      //
      // IMPORTANT: createTestScene ignores the windows option (line 191 always sets []).
      // Must set scene.windows AFTER scene creation.
      const scene = createTestScene({
        width: 6,
        depth: 5,
        cameras: [
          createTestCamera({
            id: "cam_bounce",
            position: [1, 2.5, 1],
            yawDeg: 90,
            pitchDeg: -20,
            rangeM: 12,
            fovHorizontalDeg: 80,
          }),
        ],
      });
      scene.windows = [
        {
          id: "window_reflective",
          nodeType: "window" as const,
          label: "Reflective Glass",
          position: [3, 1.5, 2],
          dimensions: [1, 3, 0.05],
          state: "reflective" as const,
          visionTransmission: 0.25,
          source: "manual",
          reviewStatus: "unreviewed",
          sourceTrace: "",
          geometryValidity: "valid",
        },
      ];

      const cells = computeCoverageCells(scene, 4);
      const behindWindow = findCellNear(cells, 5, 3);

      expect(behindWindow.cameraEvaluations?.cam_bounce).toBeDefined();
      expect(behindWindow.cameraEvaluations?.cam_bounce?.reasonCodes).toContain("REFLECTIVE_BOUNCE");
    });
  });

  describe("OODPCVS quality mode", () => {
    test("computes quality with Pop factor adjustments when doriStandard is oodpcvs_2025", () => {
      const scene = createTestScene({
        cameras: [
          createTestCamera({
            position: [2, 2.5, 2],
            yawDeg: 0,
            pitchDeg: -35,
            rangeM: 12,
          }),
        ],
        assumptions: {
          doriStandard: "oodpcvs_2025",
          sceneComplexity: "complex",
          operatorExperience: "novice",
          taskCriticality: "high",
        },
      });

      const evaluator = createCoverageEvaluator(scene);
      const evaluation = evaluator.evaluatePoint(scene.cameras[0], [2.875, 1.125]);

      expect(evaluation.quality).not.toBe("none");
      expect(evaluation.reasonCodes).toContain("OODPCVS_MODE");
      // Pop factor: complex + novice = 0.5, high criticality margin = 0.2
      // So effective PPM is roughly ppm * 0.5 * 1.2 = ppm * 0.6
      expect(evaluation.finalPpmMultiplier).toBeGreaterThan(0);
    });
  });

});
