import type {
  CameraNode,
  DoriQuality,
  PathVisibilityResult,
  ScenarioPath,
  SecurityScene,
} from "@/schema/security-scene";
import { maxQuality, qualityToScore } from "@/simulation/dori";
import { distance2D, lerp2D } from "@/simulation/geometry";

type CoverageLookup = {
  x: number;
  z: number;
  quality: DoriQuality;
  coveringCameras: string[];
  cameraEvaluations?: Record<string, { quality: DoriQuality }>;
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
  const samples: { point: [number, number]; timeS: number; facingDeg: number }[] = [];
  let elapsed = 0;

  for (let index = 0; index < path.points.length - 1; index += 1) {
    const current = path.points[index]!;
    const next = path.points[index + 1]!;
    const segmentLength = distance2D(current.position, next.position);
    const steps = Math.max(1, Math.ceil(segmentLength / 0.25));
    
    const dx = next.position[0] - current.position[0];
    const dz = next.position[1] - current.position[1];
    const facingDeg = (Math.atan2(dx, -dz) * 180) / Math.PI;

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const point = lerp2D(current.position, next.position, t);
      const timeS = elapsed + (segmentLength * t) / path.speedMps;
      samples.push({ point, timeS, facingDeg });
    }

    elapsed += segmentLength / path.speedMps;
  }

  if (samples.length > 0) {
    samples.push({
      point: path.points[path.points.length - 1]!.position,
      timeS: elapsed,
      facingDeg: samples[samples.length - 1]!.facingDeg,
    });
  }

  return samples;
}

export function computePathResults(
  scene: SecurityScene,
  coverageCells: CoverageLookup[],
): PathVisibilityResult[] {
  const isOodpcvs = scene.assumptions.doriStandard === "oodpcvs_2025";
  const maxOrientedQuality = isOodpcvs ? "perceive" : "observation";

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
      const interval = next ? next.timeS - current.timeS : 0;
      
      let overallQuality: DoriQuality = "none";
      let overallCoveringCamera: string | undefined;

      if (cell) {
        for (const cameraId of cell.coveringCameras) {
          const camera = scene.cameras.find((c) => c.id === cameraId);
          const evaluation = cell.cameraEvaluations?.[cameraId];
          if (!camera || !evaluation || evaluation.quality === "none") continue;

          let cameraQuality = evaluation.quality;

          const dx = camera.position[0] - current.point[0];
          const dz = camera.position[2] - current.point[1];
          const cellToCamYaw = (Math.atan2(dx, -dz) * 180) / Math.PI;
          
          let angleDiff = Math.abs(current.facingDeg - cellToCamYaw) % 360;
          if (angleDiff > 180) {
            angleDiff = 360 - angleDiff;
          }
          
          if (angleDiff > 90) {
            if (qualityToScore(cameraQuality) > qualityToScore(maxOrientedQuality)) {
              cameraQuality = maxOrientedQuality;
            }
          }

          if (qualityToScore(cameraQuality) > qualityToScore(overallQuality)) {
            overallQuality = cameraQuality;
            overallCoveringCamera = cameraId;
          }
          
          const cameraResult = visibilityByCamera[cameraId] ?? {
            cameraId,
            visibleS: 0,
            maxQuality: "none",
          };

          cameraResult.visibleS += interval;
          cameraResult.maxQuality = maxQuality(cameraResult.maxQuality, cameraQuality);
          visibilityByCamera[cameraId] = cameraResult;
        }
      }

      const quality = overallQuality;

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
          cameraId: overallCoveringCamera,
          reason: quality === "none" ? "Coverage lost at sampled path point" : undefined,
        });
      }

      previousQuality = quality;
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
