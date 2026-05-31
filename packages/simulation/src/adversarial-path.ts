import type {
  AdversarialPathResult,
  DoriQuality,
  SecurityScene,
} from "@sentineltwin/core";
import { pointInPolygon, polygonCenter, getDetectionProbability } from "@sentineltwin/core";
import { buildCoverageGrid, QUALITY_ORDER } from "@sentineltwin/core";
import { selectHighestPriorityCriticalZone } from "./critical-zone-selection";

type CoverageCellLookup = {
  x: number;
  z: number;
  quality: DoriQuality;
  coveringCameras: string[];
  probabilities: number[];
};

type NavNode = {
  id: string;
  x: number;
  z: number;
  walkable: boolean;
  exposure: number;
  quality: DoriQuality;
  cameras: string[];
};

function nearestNode(target: [number, number], nodes: NavNode[]) {
  return nodes.reduce((best, node) => {
    const distance = Math.hypot(node.x - target[0], node.z - target[1]);
    if (!best || distance < best.distance) {
      return { node, distance };
    }
    return best;
  }, null as { node: NavNode; distance: number } | null)?.node;
}

/**
 * Adversarial path simulation — find the lowest-exposure route from an
 * entry point to a critical zone through walkable space.
 *
 * Uses A* search where the cost of traversing a cell combines:
 *   stepDistance + exposureWeight * stepDistance * EXPOSURE_MULTIPLIER
 *
 * The heuristic (octile distance to the goal) biases search toward the
 * target rather than exploring uniformly in all directions.
 *
 * EXPOSURE_MULTIPLIER (4) was calibrated empirically from small-retail
 * scenes (6–8m rooms, 3–4 cameras). It weights detection probability
 * relative to raw distance. Higher values penalize exposure more heavily
 * (favouring longer but stealthier routes); lower values favour shorter
 * paths through visible areas. Tune per deployment if scene scale or
 * risk posture differs significantly from the reference scenes.
 */
const EXPOSURE_MULTIPLIER = 4;

/**
 * Octile distance heuristic for A* — admissible on an 8-directional grid.
 * Combines Chebyshev (diagonal) distance with Manhattan for the remainder.
 */
function octileDistance(
  ax: number, az: number,
  bx: number, bz: number,
  cellSize: number,
): number {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  const diagonal = Math.min(dx, dz) * Math.SQRT2;
  const straight = Math.abs(dx - dz);
  return (diagonal + straight) / cellSize;
}

export function computeAdversarialPath(
  scene: SecurityScene,
  coverageCells: CoverageCellLookup[],
): AdversarialPathResult | undefined {
  const { cells, cols, rows, cellSize } = buildCoverageGrid(scene, 4);

  // Build an O(1) lookup keyed by the same key the coverage-grid uses
  // so we never fall through to the O(n²) linear scan fallback.
  const coverageByKey = new Map<string, CoverageCellLookup>();
  const coverageFallback = new Map<string, CoverageCellLookup>();
  for (const cc of coverageCells) {
    coverageByKey.set(`${cc.x.toFixed(2)}:${cc.z.toFixed(2)}`, cc);
  }
  // Pre-index coverage cells by their own id if available, for the rare case
  // the grid cell ids don't match the toFixed(2) key exactly.
  for (let i = 0; i < coverageCells.length; i++) {
    const cc = coverageCells[i];
    coverageFallback.set(`cfb_${i}`, cc);
  }

  const nodes: NavNode[] = cells.map((cell) => {
    const key = `${cell.x.toFixed(2)}:${cell.z.toFixed(2)}`;
    let coverage = coverageByKey.get(key);
    if (!coverage) {
      // Linear scan fallback — should be extremely rare in practice;
      // only triggers when a coverage cell's toFixed(2) key doesn't
      // match the grid cell's key (floating-point edge case).
      coverage = coverageCells.reduce((best, candidate) => {
        const bestDistance = best
          ? Math.hypot(best.x - cell.x, best.z - cell.z)
          : Number.POSITIVE_INFINITY;
        const currentDistance = Math.hypot(candidate.x - cell.x, candidate.z - cell.z);
        return currentDistance < bestDistance ? candidate : best;
      }, undefined as CoverageCellLookup | undefined);
    }

    return {
      id: cell.id,
      x: cell.x,
      z: cell.z,
      walkable: cell.walkable,
      exposure: getDetectionProbability(coverage?.quality ?? "none"),
      quality: coverage?.quality ?? "none",
      cameras: coverage?.coveringCameras ?? [],
    };
  });

  // O(1) node lookup by id — replaces repeated nodes.find() in getNeighbors
  const nodeById = new Map<string, NavNode>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
  }

  const start = nearestNode(
    scene.entryPoints[0]?.position ?? [scene.dimensions.width / 2, scene.dimensions.depth],
    nodes.filter((node) => node.walkable),
  );
  const zone = selectHighestPriorityCriticalZone(scene);
  const goal = zone
    ? nearestNode(polygonCenter(zone.polygon), nodes.filter((node) => node.walkable))
    : undefined;

  if (!start || !goal) return undefined;

  const distances = new Map<string, number>([[start.id, 0]]);
  // A* heuristic estimate — admissible octile distance to goal
  const goalHeuristicCache = new Map(
    nodes.map((n) => [n.id, octileDistance(n.x, n.z, goal.x, goal.z, cellSize)] as const),
  );
  const previous = new Map<string, string>();
  const queue = [{ id: start.id, cost: 0, heuristic: goalHeuristicCache.get(start.id) ?? 0 }];

  // Pre-compute neighbor lookups per node so getNeighbors never searches
  const neighborCache = new Map<string, NavNode[]>();
  function getNeighbors(node: NavNode): NavNode[] {
    const cached = neighborCache.get(node.id);
    if (cached) return cached;

    const idParts = node.id.replace("cell_", "").split("_").map(Number);
    const [col, row] = idParts;
    const offsets = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    const neighbors: NavNode[] = [];
    for (const [dc, dr] of offsets) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const n = nodeById.get(`cell_${nc}_${nr}`);
      if (n?.walkable) neighbors.push(n);
    }
    neighborCache.set(node.id, neighbors);
    return neighbors;
  }

  while (queue.length > 0) {
    // Sort by f = cost + heuristic (A*)
    queue.sort((a, b) => a.cost + a.heuristic - (b.cost + b.heuristic));
    const current = queue.shift()!;

    if (current.id === goal.id) break;

    const currentCost = distances.get(current.id)!;
    const currentNode = nodeById.get(current.id)!;

    for (const neighbor of getNeighbors(currentNode)) {
      const stepDistance = Math.hypot(neighbor.x - currentNode.x, neighbor.z - currentNode.z);
      const candidateCost = currentCost + stepDistance + neighbor.exposure * stepDistance * EXPOSURE_MULTIPLIER;

      if (candidateCost < (distances.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor.id, candidateCost);
        previous.set(neighbor.id, current.id);
        queue.push({
          id: neighbor.id,
          cost: candidateCost,
          heuristic: goalHeuristicCache.get(neighbor.id) ?? 0,
        });
      }
    }
  }

  if (!distances.has(goal.id)) {
    return {
      waypoints: [],
      totalExposureScore: 0,
      totalDurationS: 0,
      detectionQualityExposure: Object.fromEntries(
        QUALITY_ORDER.filter((q) => q !== "none").map((q) => [q, 0]),
      ),
      maxDetectionProbability: 0,
      coverageGapsUsed: [],
      camerasWithoutCoverageOnRoute: [],
      criticalZonesReachableAlongRoute: [],
      criticalZoneReachable: false,
      failureReason: "Critical zone is unreachable through walkable space.",
    };
  }

  const path: NavNode[] = [];
  let cursor: string | undefined = goal.id;
  while (cursor) {
    path.unshift(nodeById.get(cursor)!);
    cursor = previous.get(cursor);
  }

  const detectionQualityExposure = Object.fromEntries(
    QUALITY_ORDER.filter((q) => q !== "none").map((q) => [q, 0]),
  ) as Record<string, number>;

  const waypoints = path.map((node, index) => {
    if (node.quality !== "none") {
      detectionQualityExposure[node.quality] =
        (detectionQualityExposure[node.quality] ?? 0) + cellSize;
    }

    return {
      position: [node.x, node.z] as [number, number],
      timeS: Number((index * cellSize).toFixed(2)),
      detectionQuality: node.quality,
      detectionProbability: node.exposure,
      exposedToCamera: node.cameras[0],
    };
  });

  const coverageGapsUsed = scene.obstructions
    .filter((obstruction) => {
      if (obstruction.visionTransmission > 0) return false;
      return waypoints.some((waypoint) => {
        const [wx, , wz] = obstruction.position;
        const [w, d] = obstruction.dimensions;
        const rotRad = (obstruction.rotationYDeg * Math.PI) / 180;
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);
        const dx = waypoint.position[0] - wx;
        const dz = waypoint.position[1] - wz;
        // Rotate waypoint into obstruction's local coordinate system
        const localX = dx * cos + dz * sin;
        const localZ = -dx * sin + dz * cos;
        return Math.abs(localX) <= w / 2 && Math.abs(localZ) <= d / 2;
      });
    })
    .map((obstruction) => obstruction.label);

  const criticalZonesReachableAlongRoute = scene.criticalZones
    .filter((zoneCandidate) =>
      waypoints.some((waypoint) => pointInPolygon(waypoint.position, zoneCandidate.polygon)),
    )
    .map((zoneCandidate) => zoneCandidate.label);

  const camerasWithoutCoverageOnRoute = scene.cameras
    .filter(
      (camera) =>
        !waypoints.some((waypoint) => waypoint.exposedToCamera === camera.id),
    )
    .map((camera) => camera.id);

  return {
    waypoints,
    totalExposureScore: Number(distances.get(goal.id)!.toFixed(2)),
    totalDurationS: Number((waypoints.length * cellSize).toFixed(2)),
    detectionQualityExposure,
    maxDetectionProbability: Math.max(...waypoints.map((waypoint) => waypoint.detectionProbability), 0),
    coverageGapsUsed,
    camerasWithoutCoverageOnRoute,
    criticalZonesReachableAlongRoute,
    criticalZoneReachable: criticalZonesReachableAlongRoute.length > 0,
  };
}
