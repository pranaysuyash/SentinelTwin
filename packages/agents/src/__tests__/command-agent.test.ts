import { describe, expect, test } from "bun:test";

import type { SecurityScene } from "@sentineltwin/core";
import type { ModelProvider, ModelPrompt } from "../providers/ModelProvider";

import {
  parseCommand,
  parseCommandDetailed,
  type SceneContextSummary,
} from "../command-agent";
import { validateSceneOperationsAgainstScene } from "../scene-operation-validator";

const TEST_CONTEXT: SceneContextSummary = {
  cameraNames: ["cam_entrance", "cam_dock"],
  obstructionLabels: ["shelf_a"],
  lightNames: ["light_lobby"],
  zoneLabels: ["vault", "lobby"],
  activeCameraCount: 2,
  currentTimeOfDay: "day",
  dimensions: { width: 12, depth: 8, height: 3 },
};

function makeMockProvider(responseOps: unknown[]): ModelProvider {
  return {
    name: "mock",
    completeStructured: async <T>(_prompt: ModelPrompt, _schema: unknown): Promise<T> => {
      return { operations: responseOps } as T;
    },
  } as unknown as ModelProvider;
}

function makeEmptyScene(): SecurityScene {
  return {
    id: "scene_test",
    name: "Test Scene",
    dimensions: { width: 12, depth: 8, height: 3 },
    walls: [],
    doors: [],
    windows: [],
    cameras: [
      {
        id: "cam_entrance",
        nodeType: "camera",
        label: "Entrance",
        position: [2, 2.5, 2],
        yawDeg: 0,
        pitchDeg: -35,
        fovHorizontalDeg: 90,
        fovVerticalDeg: 60,
        rangeM: 8,
        clarity: "good",
        nightMode: "low_light",
        irRangeM: 5,
        status: "on",
        resolutionWidth: 1920,
        resolutionHeight: 1080,
        resolutionMP: 2,
        backlightCompensation: false,
        source: "manual",
        reviewStatus: "approved",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ],
    securityLights: [],
    obstructions: [],
    criticalZones: [],
    privacyZones: [],
    entryPoints: [],
    paths: [],
    sensors: [],
    snapshots: [],
    changeLog: [],
    assumptions: {
      wallHeightM: 3,
      personHeightM: 1.7,
      vehicleHeightM: 1.5,
      timeOfDay: "day",
      interiorLightLevel: "normal",
      nightPenaltyMode: "detailed",
      doriStandard: "oodpcvs_2025",
      pixelsPerMeter: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
      showAssumptionsPanel: false,
    },
    source: "manual",
    revisionDepth: 0,
    updatedAt: "2026-06-16T00:00:00Z",
  } as unknown as SecurityScene;
}

describe("command-agent (I2)", () => {
  test("parseCommand returns parsed operations from the provider", async () => {
    const ops = [
      {
        type: "set_time_of_day",
        timeOfDay: "night",
      },
    ];
    const provider = makeMockProvider(ops);
    const result = await parseCommand("turn on night mode", TEST_CONTEXT, provider);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("set_time_of_day");
  });

  test("parseCommandDetailed returns confidence and warnings when semantic scene is missing", async () => {
    const provider = makeMockProvider([
      { type: "set_time_of_day", timeOfDay: "night" },
    ]);
    const result = await parseCommandDetailed("turn on night mode", TEST_CONTEXT, provider);
    expect(result.operations).toHaveLength(1);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.warnings).toEqual([]);
    expect(result.requiresConfirmation).toBe(true);
  });

  test("parseCommandDetailed surfaces warnings for unknown cameras when a semantic scene is provided", async () => {
    const provider = makeMockProvider([
      {
        type: "toggle_camera",
        cameraId: "cam_does_not_exist",
        status: "off",
      },
    ]);
    const scene = makeEmptyScene();
    const result = await parseCommandDetailed("disable nonexistent camera", TEST_CONTEXT, provider, scene);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).toMatch(/cam_does_not_exist|UNKNOWN_CAMERA/i);
  });

  test("validateSceneOperationsAgainstScene rejects out-of-bounds operations", () => {
    const ops = [
      {
        type: "move_camera",
        cameraId: "cam_entrance",
        newPosition: [9999, 2.5, 9999],
      },
    ];
    const scene = makeEmptyScene();
    const result = validateSceneOperationsAgainstScene(ops as never, scene);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.validOperations).toHaveLength(0);
  });
});