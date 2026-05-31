import { describe, expect, test } from "bun:test";

import { computeCoverageCells } from "@sentineltwin/simulation";
import { qualityToScore } from "@sentineltwin/core";
import {
  createTestCamera,
  createTestScene,
  findCellNear,
} from "./helpers";

function buildDoorScene(state: "open" | "closed" | "locked" | "restricted") {
  const scene = createTestScene({
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
  });

  scene.doors = [
    {
      id: "door_test",
      nodeType: "door",
      label: "Test Door",
      position: [3, 1, 2],
      dimensions: [0.9, 2, 0.12],
      state,
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    },
  ];

  return scene;
}

function buildWindowScene(
  state: "closed_glass" | "open" | "grill" | "curtain" | "reflective",
  visionTransmission: number,
) {
  const scene = createTestScene({
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
  });

  scene.windows = [
    {
      id: "window_test",
      nodeType: "window",
      label: "Test Window",
      position: [3, 1, 2],
      dimensions: [0.9, 2, 0.08],
      state,
      visionTransmission,
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    },
  ];

  return scene;
}

describe("door and window occlusion", () => {
  test("computes coverage for closed and open door scenes", () => {
    const closedDoorCells = computeCoverageCells(buildDoorScene("closed"), 4);
    const openDoorCells = computeCoverageCells(buildDoorScene("open"), 4);
    const targetClosed = findCellNear(closedDoorCells, 4.375, 1.875);
    const targetOpen = findCellNear(openDoorCells, 4.375, 1.875);

    expect(closedDoorCells.length).toBeGreaterThan(0);
    expect(openDoorCells.length).toBeGreaterThan(0);
    expect(targetClosed.cameraEvaluations?.cam_test).toBeDefined();
    expect(targetOpen.cameraEvaluations?.cam_test).toBeDefined();
    expect(Array.isArray(targetClosed.blockedBy)).toBe(true);
    expect(Array.isArray(targetOpen.blockedBy)).toBe(true);
  });

  test("computes coverage for different window states", () => {
    const glassCells = computeCoverageCells(buildWindowScene("closed_glass", 0.9), 4);
    const curtainCells = computeCoverageCells(buildWindowScene("curtain", 0.15), 4);
    const reflectiveCells = computeCoverageCells(buildWindowScene("reflective", 0.4), 4);
    const glassTarget = findCellNear(glassCells, 4.375, 1.875);
    const curtainTarget = findCellNear(curtainCells, 4.375, 1.875);
    const reflectiveTarget = findCellNear(reflectiveCells, 4.375, 1.875);

    expect(glassCells.length).toBeGreaterThan(0);
    expect(curtainCells.length).toBeGreaterThan(0);
    expect(reflectiveCells.length).toBeGreaterThan(0);
    expect(glassTarget.cameraEvaluations?.cam_test).toBeDefined();
    expect(curtainTarget.cameraEvaluations?.cam_test).toBeDefined();
    expect(reflectiveTarget.cameraEvaluations?.cam_test).toBeDefined();
  });

  test("reflective windows can improve visibility via bounce", () => {
    // Scene geometry designed so the camera→cell ray passes through the window:
    //   Camera at (1, 2.5, 1), yaw=90 → faces +X
    //   Window at (3, 1.5, 2), full-height (3m)
    //   Cell behind window at x≈5, z≈3
    //
    // Direct ray from (1,2.5,1) to (5,1.7,3) crosses x=3 at y=2.1, z=2, squarely
    // inside the window → material + glare penalties apply.
    //
    // Reflected camera mirrors to z=2*2-1=3. From (1,2.5,3) to (5,1.7,3)
    // the ray is at constant z=3 — clear of the window at z=2 → no penalties.
    const scene = createTestScene({
      width: 6,
      depth: 5,
      cameras: [
        createTestCamera({
          position: [1, 2.5, 1],
          yawDeg: 90,
          pitchDeg: -20,
          fovHorizontalDeg: 80,
          rangeM: 12,
          clarity: "excellent",
        }),
      ],
    });

    scene.windows = [
      {
        id: "window_reflective",
        nodeType: "window",
        label: "Reflective Window",
        position: [3, 1.5, 2],
        dimensions: [1, 3, 0.05],
        state: "reflective",
        visionTransmission: 0.25,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];
    const reflectiveCells = computeCoverageCells(scene, 4);
    const reflectiveTarget = findCellNear(reflectiveCells, 5, 3);

    const glassScene = structuredClone(scene);
    glassScene.windows[0].state = "closed_glass";
    const glassCells = computeCoverageCells(glassScene, 4);
    const glassTarget = findCellNear(glassCells, 5, 3);

    expect(reflectiveTarget.cameraEvaluations?.cam_test).toBeDefined();
    expect(reflectiveTarget.cameraEvaluations?.cam_test?.reasonCodes).toContain("REFLECTIVE_BOUNCE");
    expect(qualityToScore(reflectiveTarget.quality)).toBeGreaterThanOrEqual(
      qualityToScore(glassTarget.quality),
    );
  });
});
