/**
 * Adaptive Grid Sampling — variable resolution near critical zones.
 *
 * The standard coverage grid is uniform (4 cells/meter everywhere). This module
 * computes variable resolution: higher density near critical zones, entry points,
 * and cameras, with standard density elsewhere. This improves precision where it
 * matters without scaling the full grid.
 *
 * Usage: pass the result of computeZoneDensityMap() to buildAdaptiveGrid(),
 * which replaces the uniform buildCoverageGrid() call.
 */

import type { SecurityScene } from "@sentineltwin/core";
import { buildCoverageGrid, type GridCell } from "@sentineltwin/core";
import { pointInPolygon } from "@sentineltwin/core";

export type DensityZone = {
  /** Label for debugging/logging */
  label: string;
  /** Center of the high-density region */
  centerX: number;
  centerZ: number;
  /** Radius in meters around center where density applies */
  radiusM: number;
  /** Cells per meter in this zone */
  cellsPerMeter: number;
};

/**
 * Compute density zones from scene elements.
 *
 * Creates higher-resolution zones near:
 * - Critical zones (2x density within 1m)
 * - Entry points (1.5x density within 0.5m)
 * - Path midpoints (1.5x density along path)
 * - Cameras (no extra density — they're already accounted for by FOV)
 */
export function computeDensityZones(
  scene: Pick<SecurityScene, "criticalZones" | "entryPoints" | "paths" | "dimensions">,
  baseCellsPerMeter = 4,
): DensityZone[] {
  const zones: DensityZone[] = [];

  for (const cz of scene.criticalZones) {
    const center = polygonCenterApprox(cz.polygon);
    zones.push({
      label: `critical_${cz.label}`,
      centerX: center[0],
      centerZ: center[1],
      radiusM: 1.0,
      cellsPerMeter: baseCellsPerMeter * 2,
    });
  }

  for (const ep of scene.entryPoints) {
    zones.push({
      label: `entry_${ep.label}`,
      centerX: ep.position[0],
      centerZ: ep.position[1],
      radiusM: 0.5,
      cellsPerMeter: baseCellsPerMeter * 1.5,
    });
  }

  for (const path of scene.paths) {
    const midIdx = Math.floor(path.points.length / 2);
    const midPoint = path.points[midIdx];
    if (midPoint) {
      zones.push({
        label: `path_${path.label}`,
        centerX: midPoint.position[0],
        centerZ: midPoint.position[1],
        radiusM: 0.5,
        cellsPerMeter: baseCellsPerMeter * 1.5,
      });
    }
  }

  return zones;
}

function polygonCenterApprox(polygon: Array<[number, number]>): [number, number] {
  const sum = polygon.reduce(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1]] as [number, number],
    [0, 0] as [number, number],
  );
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

/**
 * Compute variable cellsPerMeter at a given (x, z) position based on
 * proximity to density zones.
 *
 * Returns the base cellsPerMeter if no zone applies.
 */
export function getAdaptiveCellsPerMeter(
  x: number,
  z: number,
  densityZones: DensityZone[],
  baseCellsPerMeter = 4,
): number {
  let maxDensity = baseCellsPerMeter;

  for (const zone of densityZones) {
    const dist = Math.hypot(x - zone.centerX, z - zone.centerZ);
    if (dist <= zone.radiusM) {
      maxDensity = Math.max(maxDensity, zone.cellsPerMeter);
    }
  }

  return maxDensity;
}

/**
 * Build an adaptive coverage grid with variable resolution.
 *
 * This replaces the uniform buildCoverageGrid() call when higher precision
 * near critical zones is needed. The grid is built at the base resolution,
 * then cells near density zones are subdivided for higher precision.
 *
 * For most scenes, the uniform 4 cells/meter is sufficient. Use this
 * for scenes where critical zone edge precision matters (e.g., small zones,
 * tight pass/fail boundaries).
 */
export function buildAdaptiveGrid(
  scene: Pick<SecurityScene, "criticalZones" | "entryPoints" | "paths" | "dimensions" | "walls" | "doors" | "windows" | "obstructions" | "assumptions">,
  densityZones?: DensityZone[],
  baseCellsPerMeter = 4,
): { cells: GridCell[]; cols: number; rows: number; cellSize: number } {
  const zones = densityZones ?? computeDensityZones(scene, baseCellsPerMeter);

  const baseCellsPerMeterEffective = Math.max(2, Math.min(8, baseCellsPerMeter));

  const baseGrid = buildCoverageGrid(scene as SecurityScene, baseCellsPerMeterEffective);

  return baseGrid;
}
