import type {
  SecurityScene,
  TemporalSecurityProfile,
  TimeSlice,
} from "@sentineltwin/core";
import { qualityToScore, scoreToQuality } from "@sentineltwin/core";

function simulateTimeSlice(
  scene: SecurityScene,
  hour: number,
  evaluator: { computeCoverageCells: (resolution: number) => { quality: string; x: number; z: number }[] },
): TimeSlice {
  const cells = evaluator.computeCoverageCells(4);

  const coveredCells = cells.filter((cell) => cell.quality !== "none");
  const totalCoveragePct =
    cells.length > 0 ? (coveredCells.length / cells.length) * 100 : 0;

  const qualityScores = coveredCells.map((cell) => qualityToScore(cell.quality as any));
  const avgQuality =
    qualityScores.length > 0
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : 0;

  const ambientLevel = getAmbientLight(hour);
  const qualityModifier = getLightQualityModifier(hour);

  return {
    hour,
    ambientLightLux: ambientLevel,
    totalCoveragePct: Number(totalCoveragePct.toFixed(1)),
    averageQuality: scoreToQuality(avgQuality),
    qualityModifier,
  };
}

function getAmbientLight(hour: number): number {
  if (hour >= 6 && hour < 8) return 200 + ((hour - 6) / 2) * 300; // dawn
  if (hour >= 8 && hour < 17) return 500; // day
  if (hour >= 17 && hour < 19) return 500 - ((hour - 17) / 2) * 300; // dusk
  return 10; // night
}

function getLightQualityModifier(hour: number): number {
  if (hour >= 7 && hour < 18) return 1.0;
  if (hour >= 6 && hour < 7) return 0.85;
  if (hour >= 5 && hour < 6) return 0.7;
  if (hour >= 18 && hour < 19) return 0.85;
  if (hour >= 19 && hour < 20) return 0.7;
  return 0.5;
}

export function computeTemporalProfile(
  scene: SecurityScene,
  evaluator: { computeCoverageCells: (resolution: number) => { quality: string; x: number; z: number }[] },
): TemporalSecurityProfile {
  const slices: TimeSlice[] = [];

  for (let hour = 0; hour < 24; hour++) {
    slices.push(simulateTimeSlice(scene, hour, evaluator));
  }

  const worstSlice = slices.reduce((worst, candidate) =>
    candidate.totalCoveragePct < worst.totalCoveragePct ? candidate : worst,
  );
  const bestSlice = slices.reduce((best, candidate) =>
    candidate.totalCoveragePct > best.totalCoveragePct ? candidate : best,
  );

  return {
    slices,
    worstHour: worstSlice.hour,
    worstCoveragePct: worstSlice.totalCoveragePct,
    bestHour: bestSlice.hour,
    bestCoveragePct: bestSlice.totalCoveragePct,
    averageCoveragePct: Number(
      (slices.reduce((sum, slice) => sum + slice.totalCoveragePct, 0) / slices.length).toFixed(1),
    ),
    coverageStability:
      slices.length > 1
        ? Number(
            (1 - Math.sqrt(
              slices.reduce(
                (sum, slice) =>
                  sum +
                  (slice.totalCoveragePct - bestSlice.totalCoveragePct / slices.length) ** 2,
                0,
              ) / slices.length,
            )).toFixed(2),
          )
        : 1,
  };
}

export function computeTimeSliceStateForHour(
  scene: SecurityScene,
  evaluator: { computeCoverageCells: (resolution: number) => { quality: string; x: number; z: number }[] },
  hour: number,
): TimeSlice {
  return simulateTimeSlice(scene, Math.max(0, Math.min(23, hour)), evaluator);
}
