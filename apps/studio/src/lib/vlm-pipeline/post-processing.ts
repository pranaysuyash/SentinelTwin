import type {
  Tier1Output,
  Tier2Output,
  PostProcessingOutput,
  ValidationIssue,
  WallCoordinate,
  OpeningDetection,
  ObstructionDetection,
  CriticalZoneDetection,
} from "./types";

export interface PostProcessor {
  validate(tier1: Tier1Output, tier2: Tier2Output): Promise<PostProcessingOutput>;
}

// ── Validation rules ──

function validateWallCount(
  walls: WallCoordinate[],
  tier1: Tier1Output,
): ValidationIssue | null {
  const expectedMin = tier1.roomCount * 3;
  const expectedMax = tier1.roomCount * 8;
  if (walls.length < expectedMin) {
    return {
      code: "WALL_COUNT_TOO_LOW",
      message: `Wall count (${walls.length}) is below expected minimum (${expectedMin}) for ${tier1.roomCount} room(s).`,
      severity: "warning",
    };
  }
  if (walls.length > expectedMax) {
    return {
      code: "WALL_COUNT_EXCESSIVE",
      message: `Wall count (${walls.length}) exceeds expected maximum (${expectedMax}) for ${tier1.roomCount} room(s). May include noise from non-wall elements.`,
      severity: "warning",
    };
  }
  return null;
}

function validateWallContinuity(walls: WallCoordinate[]): ValidationIssue | null {
  if (walls.length < 2) return null;
  const endpoints = walls.flatMap((w) => [w.start, w.end]);
  const eps = 0.02;
  let orphanCount = 0;
  for (let i = 0; i < endpoints.length; i++) {
    const [x, y] = endpoints[i];
    const hasNeighbor = walls.some((w, wi) => {
      const ei = Math.floor(i / 2);
      if (wi === ei) return false;
      const distToStart = Math.hypot(w.start[0] - x, w.start[1] - y);
      const distToEnd = Math.hypot(w.end[0] - x, w.end[1] - y);
      return distToStart < eps || distToEnd < eps;
    });
    if (!hasNeighbor) orphanCount++;
  }
  if (orphanCount > walls.length) {
    return {
      code: "WALL_DISCONTINUITY",
      message: `${orphanCount} wall endpoints are not connected to any adjacent wall. Check wall topology.`,
      severity: "warning",
    };
  }
  return null;
}

function validateDoorsOnWalls(
  doors: OpeningDetection[],
  walls: WallCoordinate[],
): ValidationIssue | null {
  if (doors.length === 0 || walls.length === 0) return null;
  const eps = 0.05;
  const offWallDoors = doors.filter((door) => {
    const [dx, dy] = door.position;
    return !walls.some((wall) => {
      if (door.orientation === "horizontal") {
        const yAvg = (wall.start[1] + wall.end[1]) / 2;
        return Math.abs(dy - yAvg) < eps;
      }
      const xAvg = (wall.start[0] + wall.end[0]) / 2;
      return Math.abs(dx - xAvg) < eps;
    });
  });
  if (offWallDoors.length > 0) {
    return {
      code: "DOORS_OFF_WALL",
      message: `${offWallDoors.length} door(s) are not positioned near any wall.`,
      severity: "warning",
    };
  }
  return null;
}

function validateRoomDimensions(
  walls: WallCoordinate[],
  tier1: Tier1Output,
): ValidationIssue | null {
  if (walls.length < 4) return null;
  const hWalls = walls.filter(
    (w) => Math.abs(w.start[1] - w.end[1]) < 0.02,
  );
  const vWalls = walls.filter(
    (w) => Math.abs(w.start[0] - w.end[0]) < 0.02,
  );
  if (hWalls.length < 2 || vWalls.length < 2) {
    return {
      code: "NON_ORTHOGONAL_LAYOUT",
      message: "Fewer than 2 horizontal and 2 vertical walls. Layout is non-rectangular.",
      severity: "info",
    };
  }
  const yCoords = walls.map((w) => [w.start[1], w.end[1]]).flat();
  const xCoords = walls.map((w) => [w.start[0], w.end[0]]).flat();
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);
  const width = maxX - minX;
  const depth = maxY - minY;
  if (width < 0.1 || depth < 0.1) {
    return {
      code: "ROOM_TOO_SMALL",
      message: "Detected room dimensions are unreasonably small.",
      severity: "blocking",
    };
  }
  if (width > 1.5 || depth > 1.5) {
    if (tier1.roomCount === 1) {
      return {
        code: "ROOM_VERY_LARGE",
        message: `Detected room dimensions (${(width * 10).toFixed(1)}m x ${(depth * 10).toFixed(1)}m) are very large for a single room. Verify scale.`,
        severity: "info",
      };
    }
  }
  return null;
}

// ── Core validator ──

export class DefaultPostProcessor implements PostProcessor {
  async validate(
    tier1: Tier1Output,
    tier2: Tier2Output,
  ): Promise<PostProcessingOutput> {
    const issues: ValidationIssue[] = [];
    const push = (issue: ValidationIssue | null) => {
      if (issue) issues.push(issue);
    };

    push(validateWallCount(tier2.walls, tier1));
    push(validateWallContinuity(tier2.walls));
    push(validateDoorsOnWalls(tier2.doors, tier2.walls));
    push(validateRoomDimensions(tier2.walls, tier1));

    let adjustedConfidence = tier2.confidence;
    const blockingCount = issues.filter((i) => i.severity === "blocking").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    if (blockingCount > 0) adjustedConfidence *= 0.3;
    if (warningCount > 0) adjustedConfidence *= Math.max(0.5, 1 - warningCount * 0.15);

    const overallPass = blockingCount === 0 && adjustedConfidence >= 0.3;

    return {
      adjustedWalls: tier2.walls,
      adjustedDoors: tier2.doors,
      adjustedWindows: tier2.windows,
      adjustedObstructions: tier2.obstructions,
      adjustedCriticalZones: tier2.criticalZones,
      confidence: Math.round(adjustedConfidence * 100) / 100,
      validationIssues: issues,
      overallPass,
    };
  }
}
