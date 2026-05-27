import type { DoriQuality, ScenarioPath } from "@/schema/security-scene";

import type { CoverageCellLike, Point2 } from "./map-geometry";
export { obstacleRectPoints, polygonToSvgPoints } from "./map-geometry";

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

function pathLengthRawM(path: ScenarioPath): number {
  if (path.points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < path.points.length; i += 1) {
    const previous = path.points[i - 1]!.position;
    const current = path.points[i]!.position;
    total += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
  }

  return total;
}

export function pathLengthM(path: ScenarioPath): number {
  return Number(pathLengthRawM(path).toFixed(3));
}

export function pointOnPathAtProgress(path: ScenarioPath, progress: number): [number, number] {
  if (path.points.length === 0) return [0, 0];
  if (path.points.length === 1 || progress <= 0) return path.points[0]!.position;

  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped >= 1) {
    const final = path.points[path.points.length - 1]!;
    return [final.position[0], final.position[1]];
  }

  const total = pathLengthRawM(path);
  if (total <= 0) {
    const final = path.points[path.points.length - 1]!;
    return [final.position[0], final.position[1]];
  }

  let target = total * clamped;
  for (let i = 1; i < path.points.length; i += 1) {
    const start = path.points[i - 1]!.position;
    const end = path.points[i]!.position;
    const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (segmentLength <= 0) continue;

    if (target <= segmentLength || i === path.points.length - 1) {
      const localT = Math.max(0, Math.min(1, target / segmentLength));
      return [
        start[0] + (end[0] - start[0]) * localT,
        start[1] + (end[1] - start[1]) * localT,
      ];
    }

    target -= segmentLength;
  }

  const final = path.points[path.points.length - 1]!;
  return [final.position[0], final.position[1]];
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
