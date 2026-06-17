/**
 * crowd-sim.ts — Thread 147: NPC/Crowd Simulation for Dynamic Occlusion
 *
 * Computes an occlusion probability field given crowd profiles at a time-of-day.
 * Uses a Poisson-process model: each archetype contributes a density (agents/sqm)
 * to zones it prefers; per-cell occlusion probability = 1 - e^(-λ · A_agent)
 * where λ = agents/sqm and A_agent = π · bodyRadius².
 *
 * This is the dynamic sibling of occlusion-blame.ts (static obstructions).
 * Performance: O(zones × cells), no raycasting — suitable for the main thread.
 */

import type { SecurityScene, CrowdProfile } from "@sentineltwin/core";

// ── Output types ──────────────────────────────────────────────────────────────

export type CrowdChokepointEntry = {
  x: number;
  z: number;
  occlusionProbability: number;
  qualityWithCrowd: string;
};

export type CrowdOcclusionResult = {
  hour: number;
  totalAgentCount: number;
  geometricCoveragePct: number;
  effectiveCoveragePct: number;
  occlusionPenaltyPct: number;
  chokepoints: CrowdChokepointEntry[];
  agentDensityByZone: Record<string, number>;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function polygonArea(polygon: readonly (readonly [number, number])[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
  }
  return Math.abs(area) / 2;
}

function pointInPolygon(
  point: readonly [number, number],
  polygon: readonly (readonly [number, number])[],
): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute crowd-adjusted effective coverage at the given hour.
 *
 * @param scene           — the security scene (zones provide spatial anchors)
 * @param coverageCells   — output of the geometric coverage simulation
 * @param crowdProfiles   — crowd profiles from scene.crowdProfiles
 * @param hour            — 0–23
 */
export function computeCrowdOcclusion(
  scene: SecurityScene,
  coverageCells: ReadonlyArray<{ x: number; z: number; quality: string; coverageIncluded: boolean }>,
  crowdProfiles: readonly CrowdProfile[],
  hour: number,
): CrowdOcclusionResult {
  const activeCells = coverageCells.filter((c) => c.coverageIncluded);
  const geometricCoveredCount = activeCells.filter((c) => c.quality !== "none").length;
  const geometricCoveragePct = activeCells.length === 0 ? 0 : (geometricCoveredCount / activeCells.length) * 100;

  const enabledProfiles = crowdProfiles.filter((p) => p.enabled);
  if (enabledProfiles.length === 0) {
    return {
      hour,
      totalAgentCount: 0,
      geometricCoveragePct,
      effectiveCoveragePct: geometricCoveragePct,
      occlusionPenaltyPct: 0,
      chokepoints: [],
      agentDensityByZone: {},
    };
  }

  // Zone area lookup (minimum 0.5 sqm to avoid divide-by-zero on degenerate polygons)
  const zoneAreas = new Map<string, number>();
  for (const zone of scene.criticalZones) {
    const poly = zone.polygon as readonly (readonly [number, number])[];
    zoneAreas.set(zone.id, Math.max(0.5, polygonArea(poly)));
  }

  // Accumulate per-zone agent density from all enabled profiles at this hour
  const densityByZone = new Map<string, number>();
  let totalAgentCount = 0;

  for (const profile of enabledProfiles) {
    for (const archetype of profile.archetypes) {
      const count = archetype.countByHour[Math.min(hour, 23)] ?? 0;
      if (count <= 0) continue;
      totalAgentCount += count;

      const zoneIds =
        archetype.preferredZones.length > 0
          ? archetype.preferredZones
          : scene.criticalZones.map((z) => z.id);

      const countPerZone = count / Math.max(1, zoneIds.length);
      for (const zoneId of zoneIds) {
        const area = zoneAreas.get(zoneId) ?? 10;
        densityByZone.set(zoneId, (densityByZone.get(zoneId) ?? 0) + countPerZone / area);
      }
    }
  }

  const agentDensityByZone: Record<string, number> = Object.fromEntries(densityByZone);

  // Average body cross-section across all archetypes
  const allArchetypes = enabledProfiles.flatMap((p) => p.archetypes);
  const avgRadius =
    allArchetypes.length === 0
      ? 0.3
      : allArchetypes.reduce((s, a) => s + a.bodyRadiusM, 0) / allArchetypes.length;
  const agentArea = Math.PI * avgRadius * avgRadius;

  // Ambient density: 10% of mean zone density applies to cells outside all zones
  const meanZoneDensity =
    densityByZone.size === 0
      ? 0
      : [...densityByZone.values()].reduce((s, d) => s + d, 0) / densityByZone.size;
  const ambientDensity = meanZoneDensity * 0.1;

  // Per-cell occlusion probability
  const chokepoints: CrowdChokepointEntry[] = [];
  let effectivelyCoveredSum = 0;

  for (const cell of activeCells) {
    const pt = [cell.x, cell.z] as const;

    let totalDensity = 0;
    for (const zone of scene.criticalZones) {
      const poly = zone.polygon as readonly (readonly [number, number])[];
      if (pointInPolygon(pt, poly)) {
        totalDensity += densityByZone.get(zone.id) ?? 0;
      }
    }

    if (totalDensity === 0) {
      totalDensity = ambientDensity;
    }

    const occlusionP = totalDensity > 0 ? 1 - Math.exp(-totalDensity * agentArea) : 0;
    const isCovered = cell.quality !== "none";

    // Expected fraction of time this covered cell is unoccluded by a body
    if (isCovered) {
      effectivelyCoveredSum += 1 - occlusionP;
    }

    if (occlusionP > 0.4 && isCovered) {
      chokepoints.push({
        x: cell.x,
        z: cell.z,
        occlusionProbability: occlusionP,
        qualityWithCrowd: cell.quality,
      });
    }
  }

  const effectiveCoveragePct =
    activeCells.length === 0 ? 0 : (effectivelyCoveredSum / activeCells.length) * 100;
  const occlusionPenaltyPct = Math.max(0, geometricCoveragePct - effectiveCoveragePct);

  chokepoints.sort((a, b) => b.occlusionProbability - a.occlusionProbability);

  return {
    hour,
    totalAgentCount,
    geometricCoveragePct,
    effectiveCoveragePct,
    occlusionPenaltyPct,
    chokepoints: chokepoints.slice(0, 10),
    agentDensityByZone,
  };
}

/** Default crowd profile archetypes for a retail environment. */
export const DEFAULT_RETAIL_ARCHETYPES = [
  {
    archetypeId: "customer",
    label: "Customer",
    bodyRadiusM: 0.3,
    heightM: 1.7,
    preferredZones: [] as string[],
    // Retail traffic curve: low morning, peak midday/afternoon, tail off at close
    countByHour: [0, 0, 0, 0, 0, 0, 0, 2, 5, 12, 20, 28, 32, 30, 28, 25, 22, 18, 12, 5, 2, 0, 0, 0],
  },
  {
    archetypeId: "staff",
    label: "Staff",
    bodyRadiusM: 0.3,
    heightM: 1.7,
    preferredZones: [] as string[],
    countByHour: [0, 0, 0, 0, 0, 0, 1, 3, 4, 4, 5, 5, 5, 5, 5, 5, 4, 4, 3, 2, 1, 0, 0, 0],
  },
  {
    archetypeId: "stocking_cart",
    label: "Stocking Cart",
    // Wider body radius: cart + operator side-by-side blocks more of a camera's view
    bodyRadiusM: 0.55,
    heightM: 1.65,
    preferredZones: [] as string[],
    // Restocking typically happens before open (6–8am) and after close (20–22pm);
    // smaller midday pulse for ad-hoc shelf restocking
    countByHour: [0, 0, 0, 0, 0, 0, 2, 3, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 2, 2, 0, 0],
  },
  {
    archetypeId: "loiterer",
    label: "Loiterer",
    bodyRadiusM: 0.3,
    heightM: 1.75,
    preferredZones: [] as string[],
    // Loiterers peak in the late afternoon / early evening when staff density drops
    // and customer traffic is still moderate — the detection-gap window.
    countByHour: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 3, 4, 4, 3, 2, 1, 0, 0, 0],
  },
];
