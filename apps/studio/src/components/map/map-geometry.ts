import type { CoverageCellResult, ScenarioPath, SecurityScene } from "@/schema/security-scene";

export type Point2 = [number, number];

export type MapLayerFlags = {
  walls: boolean;
  doors: boolean;
  windows: boolean;
  cameras: boolean;
  cameraCones: boolean;
  obstructions: boolean;
  lights: boolean;
  criticalZones: boolean;
  privacyZones: boolean;
  paths: boolean;
  coverage: boolean;
  labels: boolean;
};

export type LayerToggleInput = Partial<MapLayerFlags>;

export function createLayerFlags(overrides: LayerToggleInput = {}): MapLayerFlags {
  return {
    walls: true,
    doors: true,
    windows: true,
    cameras: true,
    cameraCones: true,
    obstructions: true,
    lights: true,
    criticalZones: true,
    privacyZones: true,
    paths: true,
    coverage: true,
    labels: false,
    ...overrides,
  };
}

export type CoverageCellLike = Pick<CoverageCellResult, "x" | "z" | "quality" | "coveringCameras"> & {
  coveringCameras: string[];
  id?: string;
};

export function formatSvgNumber(value: number, precision = 3): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(precision)).toString();
}

export function formatSvgPoint(point: { x: number; y: number }, precision = 3): string {
  return `${formatSvgNumber(point.x, precision)},${formatSvgNumber(point.y, precision)}`;
}

export function polygonToSvgPoints(
  polygon: Point2[],
  project: (point: Point2) => { x: number; y: number },
): string {
  if (polygon.length < 2) return "";

  return polygon
    .map(([x, y]) => {
      const mapped = project([x, y]);
      return formatSvgPoint(mapped);
    })
    .join(" ");
}

export function polygonCentroid(polygon: Point2[]): Point2 {
  if (polygon.length === 0) return [0, 0];
  if (polygon.length < 3) {
    const sum = polygon.reduce<Point2>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
    return [sum[0] / polygon.length, sum[1] / polygon.length];
  }

  let twiceArea = 0;
  let centerX = 0;
  let centerY = 0;

  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i]!;
    const next = polygon[(i + 1) % polygon.length]!;
    const cross = current[0] * next[1] - next[0] * current[1];
    twiceArea += cross;
    centerX += (current[0] + next[0]) * cross;
    centerY += (current[1] + next[1]) * cross;
  }

  if (Math.abs(twiceArea) < 1e-8) {
    const sum = polygon.reduce<Point2>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
    return [sum[0] / polygon.length, sum[1] / polygon.length];
  }

  const factor = 1 / (3 * twiceArea);
  return [centerX * factor, centerY * factor];
}

export function rotatePointAroundCenter(point: Point2, center: Point2, angleRad: number): Point2 {
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  const sin = Math.sin(angleRad);
  const cos = Math.cos(angleRad);

  return [
    center[0] + dx * cos - dy * sin,
    center[1] + dx * sin + dy * cos,
  ];
}

export function obstacleRectPoints(
  center: Point2,
  width: number,
  depth: number,
  rotationYDeg: number,
): Point2[] {
  const halfW = width / 2;
  const halfD = depth / 2;

  const corners: Point2[] = [
    [center[0] - halfW, center[1] - halfD],
    [center[0] + halfW, center[1] - halfD],
    [center[0] + halfW, center[1] + halfD],
    [center[0] - halfW, center[1] + halfD],
  ];

  if (!Number.isFinite(rotationYDeg) || rotationYDeg === 0) {
    return corners;
  }

  const theta = (rotationYDeg * Math.PI) / 180;
  return corners.map((corner) => rotatePointAroundCenter(corner, center, theta));
}

export function estimateCoverageCellSize(cells: CoverageCellLike[]): number {
  if (cells.length < 2) return 0.25;

  const uniqueX = Array.from(new Set(cells.map((cell) => Number(cell.x.toFixed(3)))));
  const uniqueY = Array.from(new Set(cells.map((cell) => Number(cell.z.toFixed(3)))));

  const findMinStep = (values: number[]) => {
    if (values.length < 2) return Number.POSITIVE_INFINITY;
    values.sort((a, b) => a - b);

    let min = Number.POSITIVE_INFINITY;
    for (let i = 1; i < values.length; i += 1) {
      const delta = values[i]! - values[i - 1]!;
      if (delta > 0 && delta < min) {
        min = delta;
      }
    }
    return min;
  };

  const dx = findMinStep(uniqueX);
  const dz = findMinStep(uniqueY);
  const base = Math.min(dx, dz);

  return Number.isFinite(base) && base > 0 ? base : 0.25;
}

export function centerFromScene(scene: SecurityScene): Point2 {
  return [scene.dimensions.width / 2, scene.dimensions.depth / 2];
}

export function inferCoverageFromResult(sim: import("@/schema/security-scene").SimulationResult | null) {
  return sim?.coverageCells ?? [];
}

export function inferSceneBounds(
  dimensions: { width: number; depth: number },
  extras: Array<[number, number]>,
) {
  const points: Array<[number, number]> = [
    [0, 0],
    [dimensions.width, 0],
    [dimensions.width, dimensions.depth],
    [0, dimensions.depth],
    ...extras,
  ];

  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }

  let minX = points[0]![0];
  let minY = points[0]![1];
  let maxX = points[0]![0];
  let maxY = points[0]![1];

  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return {
    minX,
    minY,
    maxX: Math.max(minX + 1, maxX),
    maxY: Math.max(minY + 1, maxY),
  };
}

export function createDefaultSceneBounds(width: number, depth: number) {
  return inferSceneBounds({ width, depth }, []);
}

export function pathHasNoSteps(path: ScenarioPath): boolean {
  return path.points.length < 2;
}

// ── Architectural plan helpers (true-2D plan view) ──────────────────────────

/**
 * Orientation of the wall segment nearest to a point, in radians measured in
 * scene XZ space. Used to align door swings and window glazing with the wall
 * they sit in (via wallId when set, nearest segment otherwise).
 */
export function nearestWallAngle(
  scene: Pick<SecurityScene, "walls">,
  point: Point2,
  preferredWallId?: string,
): number {
  const preferred = preferredWallId
    ? scene.walls.find((wall) => wall.id === preferredWallId)
    : undefined;
  if (preferred) {
    return Math.atan2(preferred.end[1] - preferred.start[1], preferred.end[0] - preferred.start[0]);
  }

  let bestAngle = 0;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const wall of scene.walls) {
    const [ax, ay] = wall.start;
    const [bx, by] = wall.end;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / lenSq));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distSq = (point[0] - px) ** 2 + (point[1] - py) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestAngle = Math.atan2(dy, dx);
    }
  }
  return bestAngle;
}

/**
 * SVG path for an architectural door swing: hinge at one jamb, leaf drawn
 * open at 90°, plus the quarter-circle swing arc. All coordinates in scene
 * meters; the caller projects via `project`.
 */
export function doorSwingPath(
  center: Point2,
  widthM: number,
  wallAngleRad: number,
  project: (point: Point2) => { x: number; y: number },
): { leaf: string; arc: string; hinge: Point2 } {
  const half = Math.max(0.05, widthM / 2);
  const cos = Math.cos(wallAngleRad);
  const sin = Math.sin(wallAngleRad);
  // Hinge at one end of the opening along the wall direction.
  const hinge: Point2 = [center[0] - half * cos, center[1] - half * sin];
  const jamb: Point2 = [center[0] + half * cos, center[1] + half * sin];
  // Leaf swings 90° off the wall: rotate wall direction by +90° → (-sin, cos),
  // leaf length equals the opening width.
  const openEnd: Point2 = [hinge[0] + 2 * half * -sin, hinge[1] + 2 * half * cos];
  const h = project(hinge);
  const j = project(jamb);
  const o = project(openEnd);
  const radius = Math.hypot(j.x - h.x, j.y - h.y);
  return {
    leaf: `M ${formatSvgNumber(h.x)} ${formatSvgNumber(h.y)} L ${formatSvgNumber(o.x)} ${formatSvgNumber(o.y)}`,
    arc: `M ${formatSvgNumber(j.x)} ${formatSvgNumber(j.y)} A ${formatSvgNumber(radius)} ${formatSvgNumber(radius)} 0 0 1 ${formatSvgNumber(o.x)} ${formatSvgNumber(o.y)}`,
    hinge,
  };
}

/**
 * Endpoints of a wall-aligned segment centered on `center` with length
 * `widthM`, in scene meters. Used for window glazing lines in plan view.
 */
export function wallAlignedSegment(
  center: Point2,
  widthM: number,
  wallAngleRad: number,
): { start: Point2; end: Point2 } {
  const half = Math.max(0.05, widthM / 2);
  const cos = Math.cos(wallAngleRad);
  const sin = Math.sin(wallAngleRad);
  return {
    start: [center[0] - half * cos, center[1] - half * sin],
    end: [center[0] + half * cos, center[1] + half * sin],
  };
}
