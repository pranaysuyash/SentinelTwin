import { describe, expect, test } from "bun:test";

import { computeCoverageCells } from "@/simulation/coverage";
import { getQualityShare } from "@/simulation/coverage";
import {
  createTestCamera,
  createTestObstruction,
  createTestScene,
  findCellNear,
} from "@/simulation/__tests__/helpers";

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
      inFov: expect.any(Boolean),
      withinRange: true,
      distanceM: expect.any(Number),
      hAngleDeg: expect.any(Number),
      vAngleDeg: expect.any(Number),
    });
  });

  test("supports coverage denominator filtering to only included cells", () => {
    const cells = [
      {
        x: 0,
        z: 0,
        quality: "none",
        coveringCameras: ["cam_test"],
        blockedBy: [],
        ppm: 0,
        coverageIncluded: true,
        privacyRestricted: false,
        cameraEvaluations: {},
      },
      {
        x: 1,
        z: 0,
        quality: "none",
        coveringCameras: [],
        blockedBy: [],
        ppm: 0,
        coverageIncluded: false,
        privacyRestricted: true,
        cameraEvaluations: {},
      },
      {
        x: 2,
        z: 0,
        quality: "detection",
        coveringCameras: ["cam_test"],
        blockedBy: [],
        ppm: 20,
        coverageIncluded: false,
        privacyRestricted: true,
        cameraEvaluations: {},
      },
    ];

    expect(getQualityShare(cells, "none")).toBeCloseTo(33.3, 1);
    expect(getQualityShare(cells, "none", true)).toBe(100);
  });

  test("marks privacy-restricted cells as non-counted but still computed", () => {
    const scene = createTestScene({
      width: 6,
      depth: 6,
      cameras: [createTestCamera({ yawDeg: 180, pitchDeg: -20, fovHorizontalDeg: 180, rangeM: 20 })],
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
  });
});
