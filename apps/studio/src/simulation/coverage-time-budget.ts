import type { CoverageCellLike } from "@/components/map/map-geometry";
import { groupPathQualitySamples, pathLengthM, samplePathQuality } from "@/components/map/path-quality";
import { qualityToScore } from "@/simulation/dori";
import type { DoriQuality, ScenarioPath } from "@/schema/security-scene";

export type CoverageTimeBudgetSegment = {
  startDistanceM: number;
  endDistanceM: number;
  startTimeS: number;
  endTimeS: number;
  quality: DoriQuality;
  lengthM: number;
  durationS: number;
  visible: boolean;
  minSpeedMps: number | null;
  meetsBudget: boolean;
};

export type CoverageTimeBudget = {
  threshold: DoriQuality;
  exposureBudgetS: number;
  totalDistanceM: number;
  totalDurationS: number;
  visibleDurationS: number;
  hiddenDurationS: number;
  firstVisibleTimeS: number | null;
  firstVisibleDistanceM: number | null;
  requiredSpeedMps: number | null;
  budgetMet: boolean;
  segments: CoverageTimeBudgetSegment[];
};

export function computeCoverageTimeBudget(
  path: ScenarioPath,
  coverageCells: CoverageCellLike[],
  threshold: DoriQuality = "observation",
  exposureBudgetS = 2,
): CoverageTimeBudget {
  const samples = samplePathQuality(path, coverageCells, 0.25);
  const bands = groupPathQualitySamples(samples);
  const totalDistanceM = pathLengthM(path);
  const totalDurationS = totalDistanceM / Math.max(path.speedMps, 0.01);
  const thresholdRank = qualityToScore(threshold);

  let visibleDurationS = 0;
  let hiddenDurationS = 0;
  let firstVisibleTimeS: number | null = null;
  let firstVisibleDistanceM: number | null = null;
  let requiredSpeedMps: number | null = null;

  const segments: CoverageTimeBudgetSegment[] = bands.map((band) => {
    const lengthM = Math.max(0, band.endDistanceM - band.startDistanceM);
    const durationS = Math.max(0, band.endTimeS - band.startTimeS);
    const visible = qualityToScore(band.quality) >= thresholdRank && band.quality !== "none";
    const minSpeedMps = visible && exposureBudgetS > 0 ? lengthM / exposureBudgetS : null;
    const meetsBudget = !visible || (minSpeedMps != null && path.speedMps >= minSpeedMps);

    if (visible) {
      visibleDurationS += durationS;
      if (firstVisibleTimeS == null) {
        firstVisibleTimeS = band.startTimeS;
        firstVisibleDistanceM = band.startDistanceM;
      }
      if (minSpeedMps != null) {
        requiredSpeedMps = requiredSpeedMps == null ? minSpeedMps : Math.max(requiredSpeedMps, minSpeedMps);
      }
    } else {
      hiddenDurationS += durationS;
    }

    return {
      startDistanceM: band.startDistanceM,
      endDistanceM: band.endDistanceM,
      startTimeS: band.startTimeS,
      endTimeS: band.endTimeS,
      quality: band.quality,
      lengthM,
      durationS,
      visible,
      minSpeedMps,
      meetsBudget,
    };
  });

  return {
    threshold,
    exposureBudgetS,
    totalDistanceM,
    totalDurationS,
    visibleDurationS,
    hiddenDurationS,
    firstVisibleTimeS,
    firstVisibleDistanceM,
    requiredSpeedMps,
    budgetMet: requiredSpeedMps == null ? true : path.speedMps >= requiredSpeedMps,
    segments,
  };
}
