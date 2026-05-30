/**
 * Blind Spot Topology Analysis
 *
 * Identifies and classifies connected blind spot regions using flood-fill on
 * coverage cells. Classifies each region by its relationship to entry points
 * and critical zones — enabling prioritized remediation.
 *
 * Classifications:
 *   "entry_corridor"   — blind region connects an entry point to a critical zone
 *   "entry_connected"  — blind region is reachable from an entry point
 *   "isolated"         — blind region has no path to entry or critical zones
 *
 * Severity:
 *   "critical" — entry_corridor region
 *   "high"     — entry_connected region touching a critical zone polygon
 *   "medium"   — entry_connected region
 *   "low"      — isolated region
 */

import type { CoverageCellResult, SecurityScene } from "@sentineltwin/core";

export type BlindRegionClass =
  | "entry_corridor"
  | "entry_connected"
  | "isolated";

export type BlindRegionSeverity = "critical" | "high" | "medium" | "low";

export interface BlindRegion {
  /** Sequential region ID */
  id: string;
  /** Cell coordinates in this region */
  cells: Array<{ x: number; z: number }>;
  /** Area in square meters */
  areaSqM: number;
  classification: BlindRegionClass;
  severity: BlindRegionSeverity;
  /** True if this region overlaps or is adjacent to any critical zone */
  touchesCriticalZone: boolean;
  /** IDs of critical zones touched by this region */
  affectedZoneIds: string[];
  /** Human-readable description for the report */
  description: string;
}

const CELL_SIZE = 0.5; // metres — must match grid.ts GRID_CELL_SIZE

/**
 * Run blind spot topology on a completed simulation result.
 *
 * Pure function: no React, no DOM, no Zustand.
 */
export function analyseBlindSpotTopology(
  scene: SecurityScene,
  cells: CoverageCellResult[],
): BlindRegion[] {
  if (cells.length === 0) return [];

  // Build a fast lookup for blind cells: "x,z" → true
  const blindSet = new Set<string>();
  for (const c of cells) {
    if (c.quality === "none") blindSet.add(cellKey(c.x, c.z));
  }
  if (blindSet.size === 0) return [];

  // Find cell grid extents
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.z < minZ) minZ = c.z;
    if (c.z > maxZ) maxZ = c.z;
  }

  // Entry point positions (2D: x, z)
  const entryPositions: Array<{ x: number; z: number }> = scene.entryPoints.map((ep) => ({
    x: ep.position[0],
    z: ep.position[1], // entryPoint position is [x, z] (2D floor coords)
  }));

  // Critical zone polygons
  const critZones = scene.criticalZones;

  // Flood-fill to find connected blind regions
  const visited = new Set<string>();
  const regions: BlindRegion[] = [];

  for (const c of cells) {
    if (c.quality !== "none") continue;
    const key = cellKey(c.x, c.z);
    if (visited.has(key)) continue;

    // BFS flood fill
    const regionCells: Array<{ x: number; z: number }> = [];
    const queue: Array<{ x: number; z: number }> = [{ x: c.x, z: c.z }];
    visited.add(key);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      regionCells.push(cur);

      for (const [dx, dz] of NEIGHBOURS) {
        const nx = snapToGrid(cur.x + dx * CELL_SIZE);
        const nz = snapToGrid(cur.z + dz * CELL_SIZE);
        const nk = cellKey(nx, nz);
        if (!visited.has(nk) && blindSet.has(nk)) {
          visited.add(nk);
          queue.push({ x: nx, z: nz });
        }
      }
    }

    // Classify this region
    const region = classifyRegion(regionCells, entryPositions, critZones, regions.length);
    regions.push(region);
  }

  // Sort by severity then area desc
  regions.sort((a, b) => {
    const sv = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (sv !== 0) return sv;
    return b.areaSqM - a.areaSqM;
  });

  return regions;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
] as const;

const SEVERITY_ORDER: BlindRegionSeverity[] = ["critical", "high", "medium", "low"];

function cellKey(x: number, z: number): string {
  return `${x.toFixed(2)},${z.toFixed(2)}`;
}

function snapToGrid(v: number): number {
  return Math.round(v / CELL_SIZE) * CELL_SIZE;
}

/**
 * Check if a cell is within ~1 cell width of an entry point.
 * We snap entry positions to the nearest grid cell.
 */
function isNearEntry(
  regionCells: Array<{ x: number; z: number }>,
  entryPositions: Array<{ x: number; z: number }>,
): boolean {
  const regionSet = new Set(regionCells.map((c) => cellKey(c.x, c.z)));
  for (const ep of entryPositions) {
    // Check the entry cell and its 3-cell radius
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const cx = snapToGrid(ep.x + dx * CELL_SIZE);
        const cz = snapToGrid(ep.z + dz * CELL_SIZE);
        if (regionSet.has(cellKey(cx, cz))) return true;
      }
    }
  }
  return false;
}

/**
 * Return the zone IDs whose polygon overlaps or is adjacent to any region cell.
 * Uses simple AABB test per zone polygon bounding box, then point-in-polygon.
 */
function getAffectedZones(
  regionCells: Array<{ x: number; z: number }>,
  zones: SecurityScene["criticalZones"],
): string[] {
  const affected = new Set<string>();
  for (const zone of zones) {
    const poly = zone.polygon;
    if (poly.length < 3) continue;
    // Quick AABB
    const minX = Math.min(...poly.map((p) => p[0]));
    const maxX = Math.max(...poly.map((p) => p[0]));
    const minZ = Math.min(...poly.map((p) => p[1]));
    const maxZ = Math.max(...poly.map((p) => p[1]));

    for (const c of regionCells) {
      if (c.x >= minX - CELL_SIZE && c.x <= maxX + CELL_SIZE &&
          c.z >= minZ - CELL_SIZE && c.z <= maxZ + CELL_SIZE) {
        if (pointInPolygon(c.x, c.z, poly, CELL_SIZE)) {
          affected.add(zone.id);
          break;
        }
      }
    }
  }
  return Array.from(affected);
}

/** Ray-casting point-in-polygon with a tolerance margin. */
function pointInPolygon(
  px: number,
  pz: number,
  polygon: [number, number][],
  margin = 0,
): boolean {
  let inside = false;
  const n = polygon.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = polygon[i][0], zi = polygon[i][1];
    const xj = polygon[j][0], zj = polygon[j][1];
    if (((zi > pz) !== (zj > pz)) &&
        (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
    j = i;
  }
  // Also check margin
  if (!inside && margin > 0) {
    // Simple proximity check to polygon edges
    for (let i = 0; i < n; i++) {
      const j2 = (i + 1) % n;
      if (distToSegment(px, pz, polygon[i], polygon[j2]) <= margin) return true;
    }
  }
  return inside;
}

function distToSegment(
  px: number, pz: number,
  a: [number, number], b: [number, number],
): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return Math.hypot(px - a[0], pz - a[1]);
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}

function classifyRegion(
  regionCells: Array<{ x: number; z: number }>,
  entryPositions: Array<{ x: number; z: number }>,
  zones: SecurityScene["criticalZones"],
  idx: number,
): BlindRegion {
  const areaSqM = regionCells.length * CELL_SIZE * CELL_SIZE;
  const affectedZoneIds = getAffectedZones(regionCells, zones);
  const touchesCriticalZone = affectedZoneIds.length > 0;
  const nearEntry = isNearEntry(regionCells, entryPositions);

  let classification: BlindRegionClass;
  let severity: BlindRegionSeverity;

  if (nearEntry && touchesCriticalZone) {
    classification = "entry_corridor";
    severity = "critical";
  } else if (nearEntry) {
    classification = "entry_connected";
    severity = touchesCriticalZone ? "high" : "medium";
  } else {
    classification = "isolated";
    severity = "low";
  }

  const description = buildDescription(classification, areaSqM, affectedZoneIds, zones);

  return {
    id: `blind_${idx}`,
    cells: regionCells,
    areaSqM,
    classification,
    severity,
    touchesCriticalZone,
    affectedZoneIds,
    description,
  };
}

function buildDescription(
  cls: BlindRegionClass,
  areaSqM: number,
  affectedZoneIds: string[],
  zones: SecurityScene["criticalZones"],
): string {
  const areaStr = `${areaSqM.toFixed(1)} m²`;
  const zoneLabels = affectedZoneIds
    .map((id) => zones.find((z) => z.id === id)?.label ?? id)
    .join(", ");

  switch (cls) {
    case "entry_corridor":
      return `${areaStr} blind corridor from entry to ${zoneLabels || "critical zone"} — undetected access route`;
    case "entry_connected":
      return zoneLabels
        ? `${areaStr} blind region reachable from entry, overlaps ${zoneLabels}`
        : `${areaStr} blind region reachable from entry`;
    case "isolated":
      return `${areaStr} isolated blind region (no entry-point access)`;
  }
}
