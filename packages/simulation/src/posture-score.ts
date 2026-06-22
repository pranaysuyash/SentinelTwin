import type { SimulationResult, SecurityScene, TemporalSecurityProfile } from "@sentineltwin/core";

export interface PostureScoreFactors {
  coverageCompleteness: number;
  temporalResilience: number;
  adversarialPathResistance: number;
  redundancyDepth: number;
  responseWindow: number;
}

export interface PostureScoreResult {
  score: number;
  band: "poor" | "fair" | "good" | "excellent" | "exceptional";
  factors: PostureScoreFactors;
  factorScores: PostureScoreFactors;
  delta: number | null;
}

const FACTOR_WEIGHTS = {
  coverageCompleteness: 0.25,
  temporalResilience: 0.20,
  adversarialPathResistance: 0.25,
  redundancyDepth: 0.15,
  responseWindow: 0.15,
} as const;

const SCORE_MIN = 300;
const SCORE_MAX = 850;
const SCORE_RANGE = SCORE_MAX - SCORE_MIN;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function scoreToBand(score: number): PostureScoreResult["band"] {
  if (score >= 780) return "exceptional";
  if (score >= 700) return "excellent";
  if (score >= 600) return "good";
  if (score >= 450) return "fair";
  return "poor";
}

function computeCoverageCompleteness(sim: SimulationResult): number {
  const coveragePct = sim.totalCoveragePct ?? 0;
  const zoneResults = sim.criticalZoneResults ?? [];
  const zonePassRate = zoneResults.length > 0
    ? zoneResults.filter((z: { status: string }) => z.status === "pass").length / zoneResults.length
    : 0;
  return clamp01((coveragePct / 100) * 0.6 + zonePassRate * 0.4);
}

function computeTemporalResilience(
  temporalProfile: TemporalSecurityProfile | null | undefined,
): number {
  if (!temporalProfile) return 0.5;

  const snapshots = temporalProfile.hourlySnapshots ?? [];
  if (snapshots.length === 0) return 0.5;

  const vulnerabilityWindows = temporalProfile.peakVulnerabilityWindows ?? [];
  const highSeverityCount = vulnerabilityWindows.filter(
    (w: { severity: string }) => w.severity === "high",
  ).length;
  const mediumSeverityCount = vulnerabilityWindows.filter(
    (w: { severity: string }) => w.severity === "medium",
  ).length;

  const avgCoverage = snapshots.reduce(
    (sum: number, s: { overallCoveragePct?: number }) => sum + (s.overallCoveragePct ?? 0), 0,
  ) / snapshots.length;
  const coverageFactor = clamp01(avgCoverage / 100);

  const windowPenalty = clamp01(
    (highSeverityCount * 0.15 + mediumSeverityCount * 0.05),
  );

  return clamp01(coverageFactor * 0.7 + (1 - windowPenalty) * 0.3);
}

function computeAdversarialPathResistance(sim: SimulationResult): number {
  const path = sim.adversarialPath;
  if (!path) return 0.8;

  const totalExposure = path.totalExposureScore ?? 0;
  const exposureFactor = clamp01(totalExposure);

  const steps = path.waypoints ?? [];
  const detectedSteps = steps.filter(
    (s: { detectionQuality: string }) => s.detectionQuality !== "none",
  ).length;
  const detectionRate = steps.length > 0 ? detectedSteps / steps.length : 0;

  return clamp01(exposureFactor * 0.5 + detectionRate * 0.5);
}

function computeRedundancyDepth(sim: SimulationResult): number {
  const cells = sim.coverageCells ?? [];
  if (cells.length === 0) return 0;

  const coveredCells = cells.filter((c: { quality: string }) => c.quality !== "none");
  if (coveredCells.length === 0) return 0;

  const multiCoverCount = coveredCells.filter(
    (c: { coveringCameras?: string[] }) => (c.coveringCameras?.length ?? 0) >= 2,
  ).length;
  const multiCoverRate = multiCoverCount / coveredCells.length;

  const kRobustness = sim.kRobustness;
  const kFactor = kRobustness
    ? clamp01((kRobustness.kRobustness - 1) / 3)
    : 0;

  return clamp01(multiCoverRate * 0.6 + kFactor * 0.4);
}

function computeResponseWindow(sim: SimulationResult): number {
  const path = sim.adversarialPath;
  if (!path) return 0.5;

  const steps = path.waypoints ?? [];
  if (steps.length === 0) return 0.5;

  let firstDetectedIndex = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].detectionQuality !== "none") {
      firstDetectedIndex = i;
      break;
    }
  }

  if (firstDetectedIndex === -1) return 0;
  if (firstDetectedIndex === 0) return 1;

  return clamp01(1 - firstDetectedIndex / steps.length);
}

export function computePostureScore(
  sim: SimulationResult,
  temporalProfile?: TemporalSecurityProfile | null,
  previousScore?: number | null,
): PostureScoreResult {
  const factors: PostureScoreFactors = {
    coverageCompleteness: computeCoverageCompleteness(sim),
    temporalResilience: computeTemporalResilience(temporalProfile),
    adversarialPathResistance: computeAdversarialPathResistance(sim),
    redundancyDepth: computeRedundancyDepth(sim),
    responseWindow: computeResponseWindow(sim),
  };

  const weightedSum =
    factors.coverageCompleteness * FACTOR_WEIGHTS.coverageCompleteness +
    factors.temporalResilience * FACTOR_WEIGHTS.temporalResilience +
    factors.adversarialPathResistance * FACTOR_WEIGHTS.adversarialPathResistance +
    factors.redundancyDepth * FACTOR_WEIGHTS.redundancyDepth +
    factors.responseWindow * FACTOR_WEIGHTS.responseWindow;

  const score = Math.round(SCORE_MIN + weightedSum * SCORE_RANGE);

  const factorScores: PostureScoreFactors = {
    coverageCompleteness: Math.round(SCORE_MIN + factors.coverageCompleteness * SCORE_RANGE),
    temporalResilience: Math.round(SCORE_MIN + factors.temporalResilience * SCORE_RANGE),
    adversarialPathResistance: Math.round(SCORE_MIN + factors.adversarialPathResistance * SCORE_RANGE),
    redundancyDepth: Math.round(SCORE_MIN + factors.redundancyDepth * SCORE_RANGE),
    responseWindow: Math.round(SCORE_MIN + factors.responseWindow * SCORE_RANGE),
  };

  return {
    score,
    band: scoreToBand(score),
    factors,
    factorScores,
    delta: previousScore != null ? score - previousScore : null,
  };
}

export { FACTOR_WEIGHTS, SCORE_MIN, SCORE_MAX };
