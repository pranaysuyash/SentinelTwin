import type { DoriQuality, SimulationResult, SecurityScene, CoverageCellResult, ScenarioPath } from "@/schema/security-scene";

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

export type MapNodeKind =
  | "wall"
  | "door"
  | "window"
  | "camera"
  | "light"
  | "obstruction"
  | "critical_zone"
  | "privacy_zone"
  | "entry"
  | "path"
  | "coverage_path";

export type PathQualitySample = {
  position: Point2;
  distanceM: number;
  timeS: number;
  quality: DoriQuality;
  coveringCameras: string[];
  nearestCellId?: string;
};

export type PathQualityBand = {
  startDistanceM: number;
  endDistanceM: number;
  startTimeS: number;
  endTimeS: number;
  quality: DoriQuality;
  coveringCameras: string[];
};

export function pathLengthM(path: ScenarioPath): number {
  if (path.points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < path.points.length; i += 1) {
    const previous = path.points[i - 1]!.position;
    const current = path.points[i]!.position;
    total += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
  }

  return Number(total.toFixed(3));
}

export function pointOnPathAtProgress(path: ScenarioPath, progress: number): [number, number] {
  if (path.points.length === 0) return [0, 0];
  if (path.points.length === 1 || progress <= 0) return path.points[0]!.position;

  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped >= 1) {
    const final = path.points[path.points.length - 1]!;
    return [final.position[0], final.position[1]];
  }

  const segmentCount = path.points.length - 1;
  const offset = clamped * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(offset));
  const localT = offset - segmentIndex;
  const start = path.points[segmentIndex]!;
  const end = path.points[segmentIndex + 1]!;

  return [
    start.position[0] + (end.position[0] - start.position[0]) * localT,
    start.position[1] + (end.position[1] - start.position[1]) * localT,
  ];
}

export function pathHasNoSteps(path: ScenarioPath): boolean {
  return path.points.length < 2;
}

export function polygonToSvgPoints(
  polygon: Point2[],
  project: (point: Point2) => { x: number; y: number },
): string {
  if (polygon.length < 2) return "";

  return polygon
    .map(([x, y]) => {
      const mapped = project([x, y]);
      return `${mapped.x},${mapped.y}`;
    })
    .join(" ");
}

function nearestCell(cells: CoverageCellLike[], point: Point2) {
  let winner: CoverageCellLike | null = null;
  let best = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const dx = cell.x - point[0];
    const dz = cell.z - point[1];
    const distance = dx * dx + dz * dz;
    if (distance < best) {
      best = distance;
      winner = cell;
    }
  }

  return winner;
}

export function samplePathQuality(
  path: ScenarioPath,
  coverageCells: CoverageCellLike[],
  stepM = 0.25,
): PathQualitySample[] {
  const samples: PathQualitySample[] = [];

  if (path.points.length < 2) {
    return samples;
  }

  let distance = 0;
  let time = 0;
  const invSpeed = path.speedMps > 0 ? 1 / path.speedMps : 0;

  for (let index = 0; index < path.points.length - 1; index += 1) {
    const current = path.points[index]!.position;
    const next = path.points[index + 1]!.position;

    const segmentLength = Math.hypot(next[0] - current[0], next[1] - current[1]);
    const steps = Math.max(1, Math.ceil(segmentLength / stepM));

    for (let step = 0; step < steps; step += 1) {
      const ratio = step / steps;
      const point: Point2 = [
        current[0] + (next[0] - current[0]) * ratio,
        current[1] + (next[1] - current[1]) * ratio,
      ];
      const nearest = nearestCell(coverageCells, point);
      const tLen = segmentLength * ratio;
      const segDist = distance + tLen;
      const segTime = Number((time + tLen * invSpeed).toFixed(3));
      samples.push({
        position: point,
        distanceM: Number(segDist.toFixed(3)),
        timeS: segTime,
        quality: nearest?.quality ?? "none",
        coveringCameras: nearest?.coveringCameras ?? [],
        nearestCellId: nearest ? nearest.id ?? `${nearest.x.toFixed(2)}:${nearest.z.toFixed(2)}` : undefined,
      });
    }

    time += segmentLength * invSpeed;
    distance += segmentLength;
  }

  const lastPoint = path.points[path.points.length - 1]!.position;
  const nearest = nearestCell(coverageCells, lastPoint);
  samples.push({
    position: lastPoint,
    distanceM: Number(distance.toFixed(3)),
    timeS: Number(time.toFixed(3)),
    quality: nearest?.quality ?? "none",
    coveringCameras: nearest?.coveringCameras ?? [],
    nearestCellId: nearest ? nearest.id ?? `${nearest.x.toFixed(2)}:${nearest.z.toFixed(2)}` : undefined,
  });

  return samples;
}

function sameCameraSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.slice().sort().join(",") === right.slice().sort().join(",");
}

export function groupPathQualitySamples(samples: PathQualitySample[]): PathQualityBand[] {
  if (samples.length < 2) return [];

  const bands: PathQualityBand[] = [];

  let current: PathQualityBand | null = null;

  for (let i = 0; i < samples.length - 1; i += 1) {
    const curr = samples[i]!;
    const next = samples[i + 1]!;

    if (!current) {
      current = {
        startDistanceM: curr.distanceM,
        endDistanceM: next.distanceM,
        startTimeS: curr.timeS,
        endTimeS: next.timeS,
        quality: curr.quality,
        coveringCameras: curr.coveringCameras,
      };
      continue;
    }

    const shouldMerge =
      curr.quality === current.quality
      && sameCameraSet(curr.coveringCameras, current.coveringCameras);

    if (shouldMerge) {
      current.endDistanceM = next.distanceM;
      current.endTimeS = next.timeS;
    } else {
      bands.push(current);
      current = {
        startDistanceM: curr.distanceM,
        endDistanceM: next.distanceM,
        startTimeS: curr.timeS,
        endTimeS: next.timeS,
        quality: curr.quality,
        coveringCameras: curr.coveringCameras,
      };
    }
  }

  if (current) {
    bands.push(current);
  }

  return bands;
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

export function inferCoverageFromResult(sim: SimulationResult | null) {
  return sim?.coverageCells ?? [];
}

export function centerFromScene(scene: SecurityScene): Point2 {
  return [scene.dimensions.width / 2, scene.dimensions.depth / 2];
}
