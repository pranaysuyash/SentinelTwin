import { qualityToScore } from "@sentineltwin/core";
import type { CoverageCellLike } from "./path-quality.js";
import { groupPathQualitySamples, pathLengthM, samplePathQuality } from "./path-quality.js";
import type { DoriQuality, ScenarioPath } from "@sentineltwin/core";

export interface CoverageTimeBudgetResult {
  pathId: string;
  pathLabel: string;
  totalLengthM: number;
  coverageTimeS: number;
  cumulativeCoverageTimeS: number;
  uncoveredTimeS: number;
  coverageRatio: number;
}

export function computeCoverageTimeBudget(
  path: ScenarioPath,
  coverageCells: CoverageCellLike[],
  stepM = 0.25,
): CoverageTimeBudgetResult {
  const samples = samplePathQuality(path, coverageCells, stepM);
  const bands = groupPathQualitySamples(samples);

  let coveredTime = 0;
  let uncoveredTime = 0;

  for (const band of bands) {
    const duration = band.endTimeS - band.startTimeS;
    if (band.quality !== "none" && band.quality !== "detection") {
      coveredTime += duration;
    } else {
      uncoveredTime += duration;
    }
  }

  return {
    pathId: path.id,
    pathLabel: path.label,
    totalLengthM: pathLengthM(path),
    coverageTimeS: Number(coveredTime.toFixed(2)),
    cumulativeCoverageTimeS: Number(coveredTime.toFixed(2)),
    uncoveredTimeS: Number(uncoveredTime.toFixed(2)),
    coverageRatio: coveredTime + uncoveredTime > 0
      ? Number((coveredTime / (coveredTime + uncoveredTime)).toFixed(3))
      : 0,
  };
}
