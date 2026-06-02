import type { SecurityScene } from "@sentineltwin/core";
import { computeCoverageCells } from "./coverage";
import { computeAdversarialPath } from "./adversarial-path";
import { cloneSecuritySceneSimulation } from "@sentineltwin/core";

export interface CriticalFailureSet {
  k: number;
  cameraIds: string[];
  cameraNames: string[];
  exposureScore: number;
  waypointCount: number;
}

export interface KRobustnessResult {
  kRobustness: number;
  totalCameras: number;
  criticalSets: CriticalFailureSet[];
  isRobust: boolean;
}

const VIABLE_EXPOSURE_THRESHOLD = 3.0;
const MAX_K = 3;

function getSubsets<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const result: T[][] = [];
  const first = arr[0];
  const rest = arr.slice(1);
  for (const sub of getSubsets(rest, size - 1)) {
    result.push([first, ...sub]);
  }
  result.push(...getSubsets(rest, size));
  return result;
}

export function computeKRobustness(scene: SecurityScene, maxK = MAX_K): KRobustnessResult {
  const cameras = scene.cameras.filter((c) => c.status === "on");
  const totalCameras = cameras.length;

  if (totalCameras === 0) {
    return { kRobustness: 0, totalCameras: 0, criticalSets: [], isRobust: false };
  }

  const criticalSets: CriticalFailureSet[] = [];

  for (let k = 1; k <= Math.min(maxK, totalCameras); k++) {
    let foundViable = false;

    for (const subset of getSubsets(cameras, k)) {
      const disabledIds = new Set(subset.map((c) => c.id));
      const cloned = cloneSecuritySceneSimulation(scene);
      const modified: SecurityScene = {
        ...cloned,
        cameras: cloned.cameras.map((c) =>
          disabledIds.has(c.id) ? { ...c, status: "off" as const } : c,
        ),
      };

      const cells = computeCoverageCells(modified);
      const path = computeAdversarialPath(modified, cells);

      if (path && path.totalExposureScore < VIABLE_EXPOSURE_THRESHOLD) {
        criticalSets.push({
          k,
          cameraIds: subset.map((c) => c.id),
          cameraNames: subset.map((c) => c.name),
          exposureScore: path.totalExposureScore,
          waypointCount: path.waypoints.length,
        });
        foundViable = true;
        break;
      }
    }

    if (!foundViable) {
      return {
        kRobustness: k - 1,
        totalCameras,
        criticalSets,
        isRobust: k - 1 >= 2,
      };
    }
  }

  return {
    kRobustness: Math.min(maxK, totalCameras),
    totalCameras,
    criticalSets,
    isRobust: false,
  };
}
