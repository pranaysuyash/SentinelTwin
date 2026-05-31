import type {
  DoriQuality,
  ScenarioBatchResult,
  ScenarioState,
  SecurityScene,
  SimulationResult,
} from "@sentineltwin/core";
import { cloneSecuritySceneSimulation, qualityToScore } from "@sentineltwin/core";
import { simulateStudio } from "./simulate-studio";

/**
 * Default scenario states for batch comparison.
 *
 * These cover the most common operational scenarios a security
 * operator would want to compare against baseline:
 * - Normal daytime operation (baseline itself)
 * - Night mode (all cameras on, lights on, night penalties active)
 * - Camera offline (simulate failure of each camera individually)
 * - Light failure (all security lights out)
 * - Obstruction moved (each movable obstruction removed)
 */
export const DEFAULT_SCENARIO_STATES: ScenarioState[] = [
  {
    label: "normal_day",
    description: "Normal daytime operation — all cameras and lights on, full daylight.",
    timeOfDay: "day",
    interiorLightLevel: "normal",
    relativeOrder: 0,
  },
  {
    label: "normal_night",
    description: "Night operation with security lights — camera IR/night mode active.",
    timeOfDay: "night",
    interiorLightLevel: "dim",
    relativeOrder: 1,
  },
  {
    label: "night_no_lights",
    description: "Night operation with all security lights failed.",
    timeOfDay: "night",
    interiorLightLevel: "dark",
    lightStatusOverrides: {},
    relativeOrder: 2,
  },
];

/**
 * Apply a scenario state override to a cloned scene.
 *
 * Modifies the scene in-place (caller must have cloned).
 */
export function applyScenarioState(
  scene: SecurityScene,
  state: ScenarioState,
): void {
  if (state.timeOfDay) {
    if (state.timeOfDay === "dusk" || state.timeOfDay === "dawn") {
      scene.assumptions.timeOfDay = "night";
    } else {
      scene.assumptions.timeOfDay = state.timeOfDay;
    }
  }

  if (state.exteriorLightLux != null) {
    scene.assumptions.exteriorLightLux = state.exteriorLightLux;
  }

  if (state.interiorLightLevel) {
    scene.assumptions.interiorLightLevel = state.interiorLightLevel;
  }

  if (state.offlineCameraIds) {
    for (const cameraId of state.offlineCameraIds) {
      const camera = scene.cameras.find(c => c.id === cameraId);
      if (camera) camera.status = "off";
    }
  }

  if (state.activeCameraIds && state.activeCameraIds.length > 0) {
    for (const camera of scene.cameras) {
      if (!state.activeCameraIds.includes(camera.id)) {
        camera.status = "off";
      }
    }
  }

  if (state.lightStatusOverrides) {
    for (const [lightId, status] of Object.entries(state.lightStatusOverrides)) {
      const light = scene.securityLights.find(l => l.id === lightId);
      if (light) light.status = status;
    }
  }

  if (state.doorStateOverrides) {
    for (const [doorId, doorState] of Object.entries(state.doorStateOverrides)) {
      const door = scene.doors.find(d => d.id === doorId);
      if (door) door.state = doorState;
    }
  }

  if (state.obstructionMovedIds) {
    scene.obstructions = scene.obstructions.filter(
      o => !state.obstructionMovedIds!.includes(o.id),
    );
  }
}

/**
 * Create a scenario state for each camera failing independently.
 */
export function generateCameraOfflineScenarios(scene: SecurityScene): ScenarioState[] {
  return scene.cameras
    .filter(c => c.status === "on")
    .map((camera, index) => ({
      label: `camera_offline_${camera.id}`,
      description: `Camera "${camera.name}" is offline — simulate coverage impact.`,
      offlineCameraIds: [camera.id],
      relativeOrder: index + 10,
    }));
}

/**
 * Create scenario states for each movable obstruction removed.
 */
export function generateObstructionRemovedScenarios(scene: SecurityScene): ScenarioState[] {
  return scene.obstructions
    .filter(o => o.movable)
    .map((obs, index) => ({
      label: `obstruction_removed_${obs.id}`,
      description: `Movable obstruction "${obs.label}" removed from scene.`,
      obstructionMovedIds: [obs.id],
      relativeOrder: index + 20,
    }));
}

/**
 * Create scenario states for obstructing each camera (dirty/blocked).
 */
export function generateCameraBlockedScenarios(scene: SecurityScene): ScenarioState[] {
  return scene.cameras
    .filter(c => c.status === "on")
    .map((camera, index) => ({
      label: `camera_blocked_${camera.id}`,
      description: `Camera "${camera.name}" lens is obstructed.`,
      offlineCameraIds: [camera.id],
      relativeOrder: index + 30,
    }));
}

/**
 * Run a full scenario batch against the baseline simulation.
 *
 * Each scenario clones the scene, applies the scenario state,
 * re-simulates, and computes a delta against the baseline.
 */
export function runScenarioBatch(
  scene: SecurityScene,
  baseline: SimulationResult,
  scenarios: ScenarioState[],
): ScenarioBatchResult[] {
  const results: ScenarioBatchResult[] = [];

  for (const scenario of scenarios) {
    const scenarioScene = cloneSecuritySceneSimulation(scene);

    if (scenario.lightStatusOverrides && (scenario.label === "normal_night" || scenario.label === "night_no_lights")) {
      if (Object.keys(scenario.lightStatusOverrides).length === 0) {
        for (const light of scenarioScene.securityLights) {
          if (scenario.label === "night_no_lights") {
            light.status = "off";
          }
        }
      }
    }

    applyScenarioState(scenarioScene, scenario);

    const scenarioResult = simulateStudio(scenarioScene);

    const delta = computeScenarioDelta(baseline, scenarioResult, scenario.label);

    results.push({
      scenarioId: scenario.label,
      label: scenario.description || scenario.label,
      totalCoveragePct: scenarioResult.totalCoveragePct,
      averageWalkableQuality: scenarioResult.averageWalkableQuality,
      zonePassCount: scenarioResult.criticalZoneResults.filter(z => z.status === "pass").length,
      zoneTotalCount: scenarioResult.criticalZoneResults.length,
      adversarialExposureScore: scenarioResult.adversarialPath?.totalExposureScore,
      delta,
    });
  }

  return results;
}

/**
 * Compute the delta between a scenario result and the baseline.
 */
function computeScenarioDelta(
  baseline: SimulationResult,
  scenario: SimulationResult,
  scenarioLabel: string,
) {
  const zonePassBefore = baseline.criticalZoneResults.filter(z => z.status === "pass").length;
  const zonePassAfter = scenario.criticalZoneResults.filter(z => z.status === "pass").length;

  return {
    totalCoverageDeltaPct: Number((scenario.totalCoveragePct - baseline.totalCoveragePct).toFixed(1)),
    qualityDelta: Number((scenario.averageWalkableQuality - baseline.averageWalkableQuality).toFixed(2)),
    zonePassDelta: zonePassAfter - zonePassBefore,
    adversarialExposureDelta: scenario.adversarialPath
      ? baseline.adversarialPath
        ? Number((scenario.adversarialPath.totalExposureScore - baseline.adversarialPath.totalExposureScore).toFixed(2))
        : scenario.adversarialPath.totalExposureScore
      : 0,
    description: buildScenarioDeltaDescription(scenarioLabel, baseline, scenario, zonePassBefore, zonePassAfter),
  };
}

function buildScenarioDeltaDescription(
  label: string,
  before: SimulationResult,
  after: SimulationResult,
  zonePassBefore: number,
  zonePassAfter: number,
): string {
  const parts: string[] = [];
  const coverageDelta = after.totalCoveragePct - before.totalCoveragePct;

  if (Math.abs(coverageDelta) > 0.5) {
    parts.push(`Coverage ${coverageDelta > 0 ? "+" : ""}${coverageDelta.toFixed(1)}%`);
  }

  const zoneDelta = zonePassAfter - zonePassBefore;
  if (zoneDelta !== 0) {
    parts.push(`Zones ${zoneDelta > 0 ? "+" : ""}${zoneDelta}`);
  }

  return parts.length > 0 ? parts.join(", ") : "No significant change.";
}
