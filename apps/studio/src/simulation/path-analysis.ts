import type {
  CameraNode,
  DoriQuality,
  PathVisibilityResult,
  ScenarioPath,
  SecurityScene,
} from "@/schema/security-scene";
import { maxQuality } from "@/simulation/dori";
import { distance2D, lerp2D } from "@/simulation/geometry";

type CoverageLookup = {
  x: number;
  z: number;
  quality: DoriQuality;
  coveringCameras: string[];
};

function nearestCoverageCell(point: [number, number], coverageCells: CoverageLookup[]) {
  return coverageCells.reduce((best, cell) => {
    const distance = distance2D(point, [cell.x, cell.z]);
    if (!best || distance < best.distance) {
      return { cell, distance };
    }
    return best;
  }, null as { cell: CoverageLookup; distance: number } | null)?.cell;
}

function segmentSamples(path: ScenarioPath) {
  const samples: { point: [number, number]; timeS: number }[] = [];
  let elapsed = 0;

  for (let index = 0; index < path.points.length - 1; index += 1) {
    const current = path.points[index]!;
    const next = path.points[index + 1]!;
    const segmentLength = distance2D(current.position, next.position);
    const steps = Math.max(1, Math.ceil(segmentLength / 0.25));

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const point = lerp2D(current.position, next.position, t);
      const timeS = elapsed + (segmentLength * t) / path.speedMps;
      samples.push({ point, timeS });
    }

    elapsed += segmentLength / path.speedMps;
  }

  samples.push({
    point: path.points[path.points.length - 1]!.position,
    timeS: elapsed,
  });

  return samples;
}

export function computePathResults(
  scene: SecurityScene,
  coverageCells: CoverageLookup[],
): PathVisibilityResult[] {
  return scene.paths.map((path) => {
    const samples = segmentSamples(path);
    const timeline: PathVisibilityResult["timeline"] = [];
    const visibilityByCamera: Record<string, PathVisibilityResult["visibilityByCamera"][string]> =
      {};

    let visibleDurationS = 0;
    let lostDurationS = 0;
    let previousQuality: DoriQuality = "none";

    for (let index = 0; index < samples.length; index += 1) {
      const current = samples[index]!;
      const next = samples[index + 1];
      const cell = nearestCoverageCell(current.point, coverageCells);
      const quality = cell?.quality ?? "none";
      const interval = next ? next.timeS - current.timeS : 0;

      if (quality === "none") {
        lostDurationS += interval;
      } else {
        visibleDurationS += interval;
      }

      if (quality !== previousQuality) {
        timeline.push({
          timeS: Number(current.timeS.toFixed(2)),
          event: quality === "none" ? "lost" : previousQuality === "none" ? "visible" : "quality_change",
          quality,
          cameraId: cell?.coveringCameras[0],
          reason: quality === "none" ? "Coverage lost at sampled path point" : undefined,
        });
      }

      previousQuality = quality;

      for (const cameraId of cell?.coveringCameras ?? []) {
        const cameraResult = visibilityByCamera[cameraId] ?? {
          cameraId,
          visibleS: 0,
          maxQuality: "none",
        };

        cameraResult.visibleS += interval;
        cameraResult.maxQuality = maxQuality(cameraResult.maxQuality, quality);
        visibilityByCamera[cameraId] = cameraResult;
      }
    }

    return {
      pathId: path.id,
      totalDurationS: Number((visibleDurationS + lostDurationS).toFixed(2)),
      visibleDurationS: Number(visibleDurationS.toFixed(2)),
      lostDurationS: Number(lostDurationS.toFixed(2)),
      visibilityByCamera,
      timeline,
    };
  });
}

export function deriveCameraQualityByZone(
  cameras: CameraNode[],
  zoneLabels: string[],
  cellQualities: Record<string, DoriQuality>,
) {
  const qualityByCamera: Record<string, Record<string, DoriQuality>> = {};

  for (const camera of cameras) {
    qualityByCamera[camera.id] = {};
    for (const zoneLabel of zoneLabels) {
      qualityByCamera[camera.id][zoneLabel] = cellQualities[zoneLabel] ?? "none";
    }
  }

  return qualityByCamera;
}
