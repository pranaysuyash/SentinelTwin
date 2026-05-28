import type { CoverageCellResult, DoriQuality, ScenarioPath } from "@/schema/security-scene";

export type Point2 = [number, number];

export type CoverageCellLike = Pick<CoverageCellResult, "x" | "z" | "quality" | "coveringCameras"> & {
  coveringCameras: string[];
  id?: string;
};

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

export function pointOnPathAtProgress(path: ScenarioPath, progress: number): Point2 {
  if (path.points.length === 0) return [0, 0];
  if (path.points.length === 1) return path.points[0]!.position;

  const clamped = Math.max(0, Math.min(1, progress));
  const totalLength = pathLengthRawM(path);
  if (totalLength <= 0) return path.points[0]!.position;

  let remaining = totalLength * clamped;
  for (let index = 1; index < path.points.length; index += 1) {
    const start = path.points[index - 1]!.position;
    const end = path.points[index]!.position;
    const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);

    if (segmentLength <= 0) continue;
    if (remaining <= segmentLength || index === path.points.length - 1) {
      const t = Math.min(1, Math.max(0, remaining / segmentLength));
      return [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ];
    }
    remaining -= segmentLength;
  }

  return path.points[path.points.length - 1]!.position;
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
      const n = nearestCell(coverageCells, point);
      const tLen = segmentLength * ratio;
      const segDist = distance + tLen;
      const segTime = Number((time + tLen * invSpeed).toFixed(3));
      samples.push({
        position: point,
        distanceM: Number(segDist.toFixed(3)),
        timeS: segTime,
        quality: n?.quality ?? "none",
        coveringCameras: n?.coveringCameras ?? [],
        nearestCellId: n ? n.id ?? `${n.x.toFixed(2)}:${n.z.toFixed(2)}` : undefined,
      });
    }

    time += segmentLength * invSpeed;
    distance += segmentLength;
  }

  const lastPoint = path.points[path.points.length - 1]!.position;
  const n = nearestCell(coverageCells, lastPoint);
  samples.push({
    position: lastPoint,
    distanceM: Number(distance.toFixed(3)),
    timeS: Number(time.toFixed(3)),
    quality: n?.quality ?? "none",
    coveringCameras: n?.coveringCameras ?? [],
    nearestCellId: n ? n.id ?? `${n.x.toFixed(2)}:${n.z.toFixed(2)}` : undefined,
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
