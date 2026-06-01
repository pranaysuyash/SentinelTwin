export type Point2 = [number, number];

export type WallSegment = {
  start: Point2;
  end: Point2;
};

const DEFAULT_PAD = 0.05;

function isFinitePoint(point: Point2): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function sanitizePoint(point: Point2): Point2 | null {
  return isFinitePoint(point) ? point : null;
}

function sanitizeFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizePad(pad: number): number {
  return Math.max(0, Math.abs(sanitizeFinite(pad, DEFAULT_PAD)));
}

function normalizeGrid(grid: number): number {
  const safeGrid = Math.abs(sanitizeFinite(grid, 0));
  return Number.isFinite(safeGrid) && safeGrid > Number.EPSILON ? safeGrid : 0;
}

function clampIndex(index: number, min: number, maxExclusive: number): number {
  if (!Number.isFinite(index)) return min;
  const bounded = Math.trunc(index);
  return Math.max(min, Math.min(maxExclusive, bounded));
}

export function pointDistance(a: Point2, b: Point2): number {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return Number.POSITIVE_INFINITY;

  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return Math.hypot(dx, dz);
}

export function clampToScene(point: Point2, width: number, depth: number, pad = DEFAULT_PAD): Point2 {
  const safePoint = sanitizePoint(point);
  const safePad = normalizePad(pad);
  const hasWidth = Number.isFinite(width);
  const hasDepth = Number.isFinite(depth);
  const safeWidth = hasWidth ? Math.max(0, width) : 0;
  const safeDepth = hasDepth ? Math.max(0, depth) : 0;

  if (!safePoint) {
    const fallbackX = safeWidth === 0 ? 0 : safeWidth / 2;
    const fallbackZ = safeDepth === 0 ? 0 : safeDepth / 2;
    return [fallbackX, fallbackZ];
  }

  if (!hasWidth && !hasDepth) {
    return safePoint;
  }

  if (safeWidth === 0 && safeDepth === 0) {
    return [0, 0];
  }

  const clampDimension = (value: number, maxDimension: number, hasDimension: boolean): number => {
    if (!hasDimension || maxDimension === 0) return value;
    const maxValue = Math.max(safePad, maxDimension - safePad);
    const minValue = Math.min(safePad, maxValue);
    return Math.max(minValue, Math.min(maxValue, value));
  };

  return [
    clampDimension(safePoint[0], safeWidth, hasWidth),
    clampDimension(safePoint[1], safeDepth, hasDepth),
  ];
}

export function snapValue(value: number, grid: number): number {
  if (!Number.isFinite(value)) return 0;

  const safeGrid = normalizeGrid(grid);
  if (!safeGrid) return value;

  return Math.round(value / safeGrid) * safeGrid;
}

export function snapPoint(point: Point2, grid = 0.5): Point2 {
  if (grid <= 0 || !Number.isFinite(grid)) {
    return point;
  }

  const safePoint = sanitizePoint(point);
  if (!safePoint) return [0, 0];

  return [snapValue(safePoint[0], grid), snapValue(safePoint[1], grid)];
}

export function insertPointAtIndex(points: Point2[], insertIndex: number, point: Point2): Point2[] {
  const safePoint = sanitizePoint(point);
  if (!safePoint) return [...points];

  const next = [...points];
  const index = clampIndex(insertIndex, 0, next.length);
  next.splice(index, 0, safePoint);
  return next;
}

export function removePointAtIndex(points: Point2[], removeIndex: number, minPoints: number): Point2[] | null {
  if (!Number.isFinite(minPoints) || points.length <= minPoints) return null;

  const index = Math.trunc(removeIndex);
  if (!Number.isFinite(index) || index < 0 || index >= points.length) return points;
  return points.filter((_, pointIndex) => pointIndex !== index);
}

export function insertPolygonVertex(points: Point2[], edgeIndex: number, point: Point2): Point2[] {
  return insertPointAtIndex(points, edgeIndex + 1, point);
}

export function removePolygonVertex(points: Point2[], removeIndex: number): Point2[] | null {
  return removePointAtIndex(points, removeIndex, 3);
}

export function removePathPoint(points: Point2[], removeIndex: number): Point2[] | null {
  return removePointAtIndex(points, removeIndex, 2);
}

export function angleDegBetween(a: Point2, b: Point2): number {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return 0;
  return Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
}

export function applyShiftLock(start: Point2, candidate: Point2, shiftHeld: boolean): Point2 {
  const safeStart = sanitizePoint(start);
  const safeCandidate = sanitizePoint(candidate);
  if (!safeStart || !safeCandidate || !shiftHeld) return safeCandidate ?? [0, 0];

  const dx = Math.abs(safeCandidate[0] - safeStart[0]);
  const dz = Math.abs(safeCandidate[1] - safeStart[1]);
  if (dx >= dz) {
    return [safeCandidate[0], safeStart[1]];
  }
  return [safeStart[0], safeCandidate[1]];
}

function segmentProjection(t: Point2, a: Point2, b: Point2): Point2 {
  const safeT = sanitizePoint(t);
  const safeA = sanitizePoint(a);
  const safeB = sanitizePoint(b);
  if (!safeT || !safeA || !safeB) return [0, 0];

  const vx = safeB[0] - safeA[0];
  const vz = safeB[1] - safeA[1];
  const len2 = sanitizeFinite(vx * vx + vz * vz, 0);
  if (len2 <= Number.EPSILON) return safeA;

  const tNorm = ((safeT[0] - safeA[0]) * vx + (safeT[1] - safeA[1]) * vz) / len2;
  const clamped = Math.max(0, Math.min(1, tNorm));
  return [safeA[0] + vx * clamped, safeA[1] + vz * clamped];
}

export function nearestPointOnWall(point: Point2, walls: WallSegment[]): {
  wallPoint: Point2;
  dist: number;
  wallIndex: number;
} {
  if (!isFinitePoint(point)) {
    return { wallPoint: [0, 0], dist: Number.POSITIVE_INFINITY, wallIndex: -1 };
  }

  if (walls.length === 0) {
    return { wallPoint: point, dist: Number.POSITIVE_INFINITY, wallIndex: -1 };
  }

  let best = Number.POSITIVE_INFINITY;
  let bestPoint = point;
  let bestWall = -1;

  for (let index = 0; index < walls.length; index += 1) {
    const wall = walls[index];
    if (!wall || !isFinitePoint(wall.start) || !isFinitePoint(wall.end)) {
      continue;
    }

    const projected = segmentProjection(point, wall.start, wall.end);
    const d = pointDistance(point, projected);
    if (d < best) {
      best = d;
      bestPoint = projected;
      bestWall = index;
    }
  }

  return { wallPoint: bestPoint, dist: best, wallIndex: bestWall };
}

export function pathLength(points: Point2[]): number {
  if (points.length < 2) return 0;
  return points.reduce((total, point, index) => {
    if (index === 0) return total;

    const delta = pointDistance(points[index - 1]!, point);
    if (!Number.isFinite(delta)) {
      return Number.POSITIVE_INFINITY;
    }

    return total + delta;
  }, 0);
}
