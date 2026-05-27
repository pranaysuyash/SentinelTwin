import type {
  AdversarialPathResult,
  DoriQuality,
  SecurityScene,
} from "@/schema/security-scene";
import { pointInPolygon, polygonCenter } from "@/simulation/geometry";
import { buildCoverageGrid } from "@/simulation/grid";

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

function detectionProbabilityForQuality(quality: DoriQuality): number {
  const table: Record<DoriQuality, number> = {
    none: 0,
    detection: 0.25,
    overview: 0.25,
    outline: 0.35,
    observation: 0.5,
    discern: 0.5,
    perceive: 0.65,
    recognition: 0.85,
    characterize: 0.85,
    validate: 0.92,
    identification: 0.99,
    scrutinize: 0.99,
  };
  return table[quality];
}

function nearestNode(target: [number, number], nodes: NavNode[]) {
  return nodes.reduce((best, node) => {
    const distance = Math.hypot(node.x - target[0], node.z - target[1]);
    if (!best || distance < best.distance) {
      return { node, distance };
    }
    return best;
  }, null as { node: NavNode; distance: number } | null)?.node;
}

export function computeCoverageFailurePath(
  scene: SecurityScene,
  coverageCells: CoverageCellLookup[],
): AdversarialPathResult | undefined {
  const { cells, cols, rows, cellSize } = buildCoverageGrid(scene, 4);
  const indexedCoverage = new Map(
    coverageCells.map((cell) => [`${cell.x.toFixed(2)}:${cell.z.toFixed(2)}`, cell]),
  );
  const nodes: NavNode[] = cells.map((cell) => {
    const coverage =
      indexedCoverage.get(`${cell.x.toFixed(2)}:${cell.z.toFixed(2)}`) ??
      coverageCells.reduce((best, candidate) => {
        const bestDistance = best
          ? Math.hypot(best.x - cell.x, best.z - cell.z)
          : Number.POSITIVE_INFINITY;
        const currentDistance = Math.hypot(candidate.x - cell.x, candidate.z - cell.z);
        return currentDistance < bestDistance ? candidate : best;
      }, undefined as CoverageCellLookup | undefined);

    return {
      id: cell.id,
      x: cell.x,
      z: cell.z,
      walkable: cell.walkable,
      exposure: detectionProbabilityForQuality(coverage?.quality ?? "none"),
      quality: coverage?.quality ?? "none",
      cameras: coverage?.coveringCameras ?? [],
    };
  });

  const start = nearestNode(scene.entryPoints[0]?.position ?? [scene.dimensions.width / 2, scene.dimensions.depth], nodes.filter((node) => node.walkable));
  const zone = scene.criticalZones[0];
  const goal = zone
    ? nearestNode(polygonCenter(zone.polygon), nodes.filter((node) => node.walkable))
    : undefined;

  if (!start || !goal) return undefined;

  const distances = new Map<string, number>([[start.id, 0]]);
  const previous = new Map<string, string>();
  const queue = [{ id: start.id, cost: 0 }];

  const getNode = (id: string) => nodes.find((node) => node.id === id)!;
  const getNeighbors = (node: NavNode) => {
    const idParts = node.id.replace("cell_", "").split("_").map(Number);
    const [col, row] = idParts;
    // 8-directional movement: 4 cardinal + 4 diagonal.
    // stepDistance uses Math.hypot which naturally gives 1×cellSize for cardinals
    // and √2×cellSize for diagonals — the cost function needs no special-casing.
    const neighborOffsets = [
      [1, 0],   [-1, 0],  [0, 1],  [0, -1],  // cardinal
      [1, 1],   [1, -1], [-1, 1], [-1, -1],  // diagonal
    ];

    return neighborOffsets
      .map(([dc, dr]) => {
        const nextCol = col + dc;
        const nextRow = row + dr;
        if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) {
          return undefined;
        }
        return nodes.find((candidate) => candidate.id === `cell_${nextCol}_${nextRow}`);
      })
      .filter((candidate): candidate is NavNode => Boolean(candidate?.walkable));
  };

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    if (current.id === goal.id) {
      break;
    }

    const currentNode = getNode(current.id);
    const currentCost = distances.get(current.id)!;

    for (const neighbor of getNeighbors(currentNode)) {
      const stepDistance = Math.hypot(neighbor.x - currentNode.x, neighbor.z - currentNode.z);
      const candidateCost = currentCost + stepDistance + neighbor.exposure * stepDistance * 4;

      if (candidateCost < (distances.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor.id, candidateCost);
        previous.set(neighbor.id, current.id);
        queue.push({ id: neighbor.id, cost: candidateCost });
      }
    }
  }

  if (!distances.has(goal.id)) {
    return {
      waypoints: [],
      totalExposureScore: 0,
      totalDurationS: 0,
      detectionQualityExposure: {
        detection: 0,
        observation: 0,
        recognition: 0,
        identification: 0,
      },
      maxDetectionProbability: 0,
      coverageGapsUsed: [],
      camerasWithoutCoverageOnRoute: [],
      criticalZonesReachableAlongRoute: [],
      criticalZoneReachable: false,
      // Backward compatibility payload
      blindspotsExploited: [],
      camerasEvaded: [],
      criticalZonesReached: [],
      targetReached: false,
      failureReason: "Critical zone is unreachable through walkable space.",
    };
  }

  const path: NavNode[] = [];
  let cursor: string | undefined = goal.id;
  while (cursor) {
    path.unshift(getNode(cursor));
    cursor = previous.get(cursor);
  }

  const detectionQualityExposure: Record<string, number> = {
    detection: 0,
    observation: 0,
    recognition: 0,
    identification: 0,
    overview: 0,
    outline: 0,
    discern: 0,
    perceive: 0,
    characterize: 0,
    validate: 0,
    scrutinize: 0,
  };

  const waypoints = path.map((node, index) => {
    if (node.quality !== "none") {
      detectionQualityExposure[node.quality] += cellSize;
    }

    return {
      position: [node.x, node.z] as [number, number],
      timeS: Number((index * cellSize).toFixed(2)),
      detectionQuality: node.quality,
      detectionProbability: node.exposure,
      exposedToCamera: node.cameras[0],
    };
  });

  const blindspotsExploited = scene.obstructions
    .filter((obstruction) => {
      if (obstruction.visionTransmission > 0) return false;
      return waypoints.some((waypoint) => {
        const [width, depth] = obstruction.dimensions;
        const [ox, , oz] = obstruction.position;
        return (
          Math.abs(waypoint.position[0] - ox) <= width &&
          Math.abs(waypoint.position[1] - oz) <= depth
        );
      });
    })
    .map((obstruction) => obstruction.label);

  const criticalZonesReached = scene.criticalZones
    .filter((zoneCandidate) =>
      waypoints.some((waypoint) => pointInPolygon(waypoint.position, zoneCandidate.polygon)),
    )
    .map((zoneCandidate) => zoneCandidate.label);

  return {
    waypoints,
    totalExposureScore: Number(distances.get(goal.id)!.toFixed(2)),
    totalDurationS: Number((waypoints.length * cellSize).toFixed(2)),
    detectionQualityExposure,
    maxDetectionProbability: Math.max(...waypoints.map((waypoint) => waypoint.detectionProbability), 0),
    coverageGapsUsed: blindspotsExploited,
    camerasWithoutCoverageOnRoute: scene.cameras
      .filter(
        (camera) =>
          !waypoints.some((waypoint) => waypoint.exposedToCamera === camera.id),
      )
      .map((camera) => camera.id),
    criticalZonesReachableAlongRoute: criticalZonesReached,
    criticalZoneReachable: criticalZonesReached.length > 0,
    // Backward compatibility payload
    blindspotsExploited,
    camerasEvaded: scene.cameras
      .filter(
        (camera) =>
          !waypoints.some((waypoint) => waypoint.exposedToCamera === camera.id),
      )
      .map((camera) => camera.id),
    criticalZonesReached,
    targetReached: criticalZonesReached.length > 0,
  };
}

export const computeAdversarialPath = computeCoverageFailurePath;
