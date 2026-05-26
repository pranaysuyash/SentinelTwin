export type Point2 = [number, number];

export function pointDistance(a: Point2, b: Point2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return Math.hypot(dx, dz);
}

export function clampToScene(point: Point2, width: number, depth: number, pad = 0.05): Point2 {
  return [
    Math.max(pad, Math.min(width - pad, point[0])),
    Math.max(pad, Math.min(depth - pad, point[1])),
  ];
}

export function snapValue(value: number, grid: number): number {
  if (!grid || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function snapPoint(point: Point2, grid = 0.5): Point2 {
  if (!grid || grid <= 0) return point;
  return [snapValue(point[0], grid), snapValue(point[1], grid)];
}

export function angleDegBetween(a: Point2, b: Point2): number {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
}

export function applyShiftLock(start: Point2, candidate: Point2, shiftHeld: boolean): Point2 {
  if (!shiftHeld) return candidate;

  const dx = Math.abs(candidate[0] - start[0]);
  const dz = Math.abs(candidate[1] - start[1]);
  if (dx >= dz) {
    return [candidate[0], start[1]];
  }
  return [start[0], candidate[1]];
}

function segmentProjection(t: Point2, a: Point2, b: Point2): Point2 {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const len2 = vx * vx + vz * vz;
  if (len2 <= Number.EPSILON) return a;

  const tNorm = ((t[0] - a[0]) * vx + (t[1] - a[1]) * vz) / len2;
  const clamped = Math.max(0, Math.min(1, tNorm));
  return [a[0] + vx * clamped, a[1] + vz * clamped];
}

export function nearestPointOnWall(point: Point2, walls: Array<{ start: Point2; end: Point2 }>): {
  wallPoint: Point2;
  dist: number;
  wallIndex: number;
} {
  if (walls.length === 0) {
    return { wallPoint: point, dist: Number.POSITIVE_INFINITY, wallIndex: -1 };
  }

  let best = Number.POSITIVE_INFINITY;
  let bestPoint = point;
  let bestWall = -1;

  for (let index = 0; index < walls.length; index += 1) {
    const wall = walls[index]!;
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
    return total + pointDistance(points[index - 1]!, point);
  }, 0);
}
