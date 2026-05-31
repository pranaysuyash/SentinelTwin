import { describe, expect, test } from "bun:test";

import type {
  CameraNode,
  CameraOfflineImpactEntry,
  CameraResult,
  CoverageCellResult,
  SecurityIssue,
  ZoneResult,
} from "@sentineltwin/core";
import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildSecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import { simulateStudio, qualityToScore, computeCoverageCells } from "@sentineltwin/simulation";
import {
  createTestCamera,
  createTestLight,
  createTestObstruction,
  createTestScene,
  findCellNear,
} from "@sentineltwin/simulation/__tests__/helpers";

const testWithTimeout = test as unknown as (
  name: string,
  options: { timeout: number },
  fn: () => void,
) => void;

function buildDoorStateScene(state: "open" | "closed") {
  const scene = createTestScene({
    width: 6,
    depth: 4,
    cameras: [
      createTestCamera({
        id: "cam_door",
        position: [1, 2.5, 2],
        yawDeg: 90,
        pitchDeg: -35,
        mountType: "wall",
      }),
    ],
  });

  scene.doors = [
    {
      id: "door_state",
      nodeType: "door",
      label: "Door State",
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

function buildWindowStateScene(state: "closed_glass" | "curtain", visionTransmission: number) {
  const scene = createTestScene({
    width: 6,
    depth: 4,
    cameras: [
      createTestCamera({
        id: "cam_window",
        position: [1, 2.5, 2],
        yawDeg: 90,
        pitchDeg: -35,
        mountType: "wall",
      }),
    ],
  });

  scene.windows = [
    {
      id: "window_state",
      nodeType: "window",
      label: "Window State",
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

function makeNightRetailScene(withLight: boolean) {
  const scene = createSmallRetailShopScene();
  scene.assumptions.timeOfDay = "night";
  scene.securityLights = withLight
    ? [createTestLight({ position: [5.2, 2.8, 4.8], brightness: "very_high", rangeM: 8, illuminatesNightCoverage: true })]
    : [];

  for (const camera of scene.cameras) {
    camera.nightMode = "none";
    camera.irRangeM = 0;
  }

  return scene;
}

function makeRedundancyScene() {
  const scene = createTestScene({
    width: 8,
    depth: 8,
    cameras: [
      createTestCamera({
        id: "cam_left",
        name: "Left Camera",
        position: [2.2, 2.5, 3],
        yawDeg: 180,
        pitchDeg: -20,
        fovHorizontalDeg: 160,
        rangeM: 12,
      }),
      createTestCamera({
        id: "cam_right",
        name: "Right Camera",
        position: [5.8, 2.5, 3],
        yawDeg: 180,
        pitchDeg: -20,
        fovHorizontalDeg: 160,
        rangeM: 12,
      }),
      createTestCamera({
        id: "cam_center",
        name: "Center Camera",
        position: [4, 2.5, 3],
        yawDeg: 180,
        pitchDeg: -20,
        fovHorizontalDeg: 160,
        rangeM: 12,
      }),
    ],
    assumptions: {
      showAssumptionsPanel: true,
    },
  });

  scene.criticalZones = [
    {
      id: "zone_redundant",
      nodeType: "critical_zone",
      label: "Redundant Zone",
      polygon: [
        [3.5, 4],
        [4.5, 4],
        [4.5, 5],
        [3.5, 5],
      ],
      heightM: 2,
      priority: "high",
      requiredQuality: "detection",
      targetType: "person_detection",
      nightRequired: false,
      redundancyRequired: true,
      privacyZone: false,
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    },
  ];

  return scene;
}

describe("golden simulation product claims", () => {
  test("baseline small retail shop still simulates the expected counter workflow", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);

    expect(result.totalCoveragePct).toBeGreaterThan(0);
    expect(result.cameraResults).toHaveLength(scene.cameras.length);
    expect(result.criticalZoneResults).toHaveLength(1);
    expect(result.criticalZoneResults[0]?.label).toBe("Cash Counter");
    expect(result.pathResults[0]?.timeline.length).toBeGreaterThan(0);
    expect(result.blindSpotFingerprint).toBeDefined();
  });

  test("turning off the entrance camera lowers coverage on the small retail shop baseline", () => {
    const baseline = simulateStudio(createSmallRetailShopScene());
    const scene = createSmallRetailShopScene();
    const camera = scene.cameras.find((entry) => entry.id === "cam_entrance");

    if (!camera) {
      throw new Error("Expected the entrance camera in the demo scene");
    }

    camera.status = "off";

    const result = simulateStudio(scene);

    expect(result.totalCoveragePct).toBeLessThan(baseline.totalCoveragePct);
    expect(result.cameraResults.find((entry: CameraResult) => entry.cameraId === "cam_entrance")?.offlineImpact).toBeDefined();
  });

  test("moving the cupboard away from the aisle improves the small retail shop coverage", () => {
    const baseline = simulateStudio(createSmallRetailShopScene());
    const scene = createSmallRetailShopScene();
    const cupboard = scene.obstructions.find((entry) => entry.id === "obs_cupboard_blocker");

    if (!cupboard) {
      throw new Error("Expected the cupboard blocker in the demo scene");
    }

    cupboard.position = [0.5, 0.5, 0.5];
    cupboard.dimensions = [0.5, 0.5, 0.5];

    const result = simulateStudio(scene);

    expect(result.totalCoveragePct).toBeGreaterThanOrEqual(baseline.totalCoveragePct);
    expect(result.criticalZoneResults[0]?.actualQuality).toBeDefined();
  });

  test("night mode recovers when a light is added to the retail scene", () => {
    const darkScene = makeNightRetailScene(false);
    const litScene = makeNightRetailScene(true);

    const darkResult = simulateStudio(darkScene);
    const litResult = simulateStudio(litScene);

    expect(litResult.averageWalkableQuality).toBeGreaterThan(darkResult.averageWalkableQuality);
    expect(litResult.identificationAreaPct).toBeGreaterThanOrEqual(darkResult.identificationAreaPct);
  });

  test("privacy zones visible in the retail scene emit a privacy issue", () => {
    const scene = createSmallRetailShopScene();
    scene.privacyZones = [
      {
        id: "privacy_front_counter",
        nodeType: "privacy_zone",
        label: "Front Counter Privacy",
        polygon: [
          [3.7, 4.5],
          [5.2, 4.5],
          [5.2, 6.2],
          [3.7, 6.2],
        ],
        restriction: "no_video",
        regulation: "GDPR",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const result = simulateStudio(scene);

    expect(result.coverageCells.some((cell: CoverageCellResult) => cell.privacyRestricted)).toBe(true);
    expect(result.issues.some((issue: SecurityIssue) => issue.category === "privacy")).toBe(true);
  });

  testWithTimeout("redundancy is preserved with one camera offline and degrades to single-point failure", { timeout: 15000 }, () => {
    const scene = makeRedundancyScene();
    const baseline = simulateStudio(scene);
    const baselineOutcome = buildSecurityOutcomeModel(scene, baseline, null);

    const oneOffline = makeRedundancyScene();
    const oneOfflineCamera = oneOffline.cameras.find((camera: CameraNode) => camera.id === "cam_right");
    if (!oneOfflineCamera) {
      throw new Error("Expected right redundancy camera");
    }
    oneOfflineCamera.status = "off";
    const preservedResult = simulateStudio(oneOffline);
    const preservedOutcome = buildSecurityOutcomeModel(oneOffline, preservedResult, null);

    expect(baselineOutcome.summary.redundancyStatus).not.toBe("fails");
    expect(preservedResult.criticalZoneResults[0]?.status).toBe("pass");
    expect(preservedOutcome.summary.redundancyStatus).toBe("single_point_failure");
  });

  test("door open improves line-of-sight outcome versus closed door", () => {
    const closedCells = computeCoverageCells(buildDoorStateScene("closed"), 4);
    const openCells = computeCoverageCells(buildDoorStateScene("open"), 4);

    const behindDoorClosed = findCellNear(closedCells, 4.375, 1.875);
    const behindDoorOpen = findCellNear(openCells, 4.375, 1.875);

    expect(qualityToScore(behindDoorOpen.quality)).toBeGreaterThanOrEqual(
      qualityToScore(behindDoorClosed.quality),
    );
    expect(behindDoorOpen.ppm).toBeGreaterThanOrEqual(behindDoorClosed.ppm);
  });

  test("high-transmission glass outperforms curtain transmission", () => {
    const glassCells = computeCoverageCells(buildWindowStateScene("closed_glass", 0.9), 4);
    const curtainCells = computeCoverageCells(buildWindowStateScene("curtain", 0.15), 4);

    const throughGlass = findCellNear(glassCells, 4.375, 1.875);
    const throughCurtain = findCellNear(curtainCells, 4.375, 1.875);

    expect(qualityToScore(throughGlass.quality)).toBeGreaterThanOrEqual(
      qualityToScore(throughCurtain.quality),
    );
    expect(throughGlass.ppm).toBeGreaterThanOrEqual(throughCurtain.ppm);
  });

  test("night plus IR improves coverage quality over non-night camera", () => {
    const nightNoIr = createTestScene({
      cameras: [
        createTestCamera({
          id: "cam_no_ir",
          position: [2, 2.5, 2],
          yawDeg: 0,
          pitchDeg: -35,
          nightMode: "none",
          irRangeM: 0,
        }),
      ],
      assumptions: {
        timeOfDay: "night",
      },
    });

    const nightWithIr = createTestScene({
      cameras: [
        createTestCamera({
          id: "cam_ir",
          position: [2, 2.5, 2],
          yawDeg: 0,
          pitchDeg: -35,
          nightMode: "ir",
          irRangeM: 8,
        }),
      ],
      assumptions: {
        timeOfDay: "night",
      },
    });

    const noIrCell = findCellNear(computeCoverageCells(nightNoIr, 4), 1.875, 0.875);
    const irCell = findCellNear(computeCoverageCells(nightWithIr, 4), 1.875, 0.875);

    expect(qualityToScore(irCell.quality)).toBeGreaterThan(qualityToScore(noIrCell.quality));
    expect(irCell.ppm).toBeGreaterThan(noIrCell.ppm);
  });

  testWithTimeout("moving an obstruction away improves critical zone outcome", { timeout: 15000 }, () => {
    const base = createTestScene({
      width: 8,
      depth: 8,
      cameras: [
        createTestCamera({
          id: "cam_blocked",
          position: [2, 2.5, 6],
          yawDeg: 10,
          pitchDeg: -25,
          fovHorizontalDeg: 90,
          rangeM: 12,
        }),
      ],
      obstructions: [
        createTestObstruction({
          id: "obs_blocker",
          label: "Blocker",
          position: [4, 1, 4],
          dimensions: [0.9, 0.9, 2],
          material: "solid",
          visionTransmission: 0,
          movable: true,
          movableByAI: true,
        }),
      ],
    });

    base.criticalZones = [
      {
        id: "zone_register",
        nodeType: "critical_zone",
        label: "Register",
        polygon: [
          [3.6, 3.6],
          [4.4, 3.6],
          [4.4, 4.4],
          [3.6, 4.4],
        ],
        heightM: 2,
        priority: "high",
        requiredQuality: "detection",
        targetType: "cash_counter_activity",
        nightRequired: false,
        redundancyRequired: false,
        privacyZone: false,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const improved = structuredClone(base);
    const moved = improved.obstructions.find((obs: { id: string }) => obs.id === "obs_blocker");
    if (!moved) throw new Error("expected blocker obstruction");
    moved.position = [6.5, moved.position[1], 6.5];

    const baseResult = simulateStudio(base);
    const improvedResult = simulateStudio(improved);

    const baseZone = baseResult.criticalZoneResults.find((zone: ZoneResult) => zone.zoneId === "zone_register");
    const improvedZone = improvedResult.criticalZoneResults.find((zone: ZoneResult) => zone.zoneId === "zone_register");

    expect(baseZone).toBeDefined();
    expect(improvedZone).toBeDefined();
    expect(qualityToScore(improvedZone?.actualQuality ?? "none")).toBeGreaterThanOrEqual(
      qualityToScore(baseZone?.actualQuality ?? "none"),
    );
  });

  test("privacy-zone visibility emits privacy issue", () => {
    const scene = createTestScene({
      width: 6,
      depth: 6,
      cameras: [
        createTestCamera({
          id: "cam_privacy",
          position: [3, 2.5, 4],
          yawDeg: 0,
          pitchDeg: -20,
          fovHorizontalDeg: 120,
          fovVerticalDeg: 90,
          rangeM: 20,
          resolutionMP: 8,
          resolutionWidth: 3840,
          resolutionHeight: 2160,
        }),
      ],
    });

    scene.privacyZones = [
      {
        id: "privacy_staff",
        nodeType: "privacy_zone",
        label: "Staff Area",
        polygon: [
          [2, 2],
          [4, 2],
          [4, 4],
          [2, 4],
        ],
        restriction: "no_video",
        regulation: "GDPR",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const result = simulateStudio(scene);

    expect(result.issues.some((issue) => issue.category === "privacy")).toBe(true);
    expect(result.issues.some((issue) => issue.affectedZones.includes("privacy_staff"))).toBe(true);
  });

  testWithTimeout("single camera failure preserves redundancy in a triple-camera setup", { timeout: 15000 }, () => {
    const scene = createTestScene({
      width: 8,
      depth: 8,
      cameras: [
        createTestCamera({
          id: "cam_a",
          position: [2, 2.5, 6],
          yawDeg: 0,
          pitchDeg: -20,
          fovHorizontalDeg: 140,
          rangeM: 12,
        }),
        createTestCamera({
          id: "cam_b",
          position: [6, 2.5, 6],
          yawDeg: 0,
          pitchDeg: -20,
          fovHorizontalDeg: 140,
          rangeM: 12,
        }),
        createTestCamera({
          id: "cam_c",
          position: [4, 2.5, 2],
          yawDeg: 180,
          pitchDeg: -20,
          fovHorizontalDeg: 140,
          rangeM: 12,
        }),
      ],
    });

    scene.criticalZones = [
      {
        id: "zone_redundant",
        nodeType: "critical_zone",
        label: "Redundant Zone",
        polygon: [
          [3.2, 3.2],
          [4.8, 3.2],
          [4.8, 4.8],
          [3.2, 4.8],
        ],
        heightM: 2,
        priority: "high",
        requiredQuality: "detection",
        targetType: "person_detection",
        nightRequired: false,
        redundancyRequired: true,
        privacyZone: false,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const result = simulateStudio(scene);
    const zone = result.criticalZoneResults.find((entry: ZoneResult) => entry.zoneId === "zone_redundant");

    expect(zone).toBeDefined();
    expect((zone?.redundancyCameraCount ?? 0) >= 2).toBe(true);

    for (const camera of result.cameraResults) {
      const losesRedundancy = camera.offlineImpactDetail?.some((entry: CameraOfflineImpactEntry) =>
        entry.reason.includes("loses redundancy"),
      ) ?? false;
      expect(losesRedundancy).toBe(false);
    }
  });
});
