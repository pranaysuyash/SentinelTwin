// Simulation engine — pure TS, no React deps
export { simulateStudio, simulateStudioLite } from "./simulate-studio.js";
export { computeCoverageCells, createCoverageEvaluator, getQualityShare, getIdentificationAreaPct, getRecognitionAreaPct } from "./coverage.js";
export { computeAdversarialPath } from "./adversarial-path.js";
export { analyseBlindSpotTopology } from "./blind-spot-topology.js";
export { computeBlindSpotFingerprint } from "./blind-spot-fingerprint.js";
export { computeCoverageEntropy } from "./coverage-entropy.js";
export { computeCoverageFragility } from "./coverage-fragility.js";
export { computeCoveragePostureVariation } from "./coverage-posture.js";
export { computeCoverageTimeBudget } from "./coverage-time-budget.js";
export { computeCoverageUncertainty } from "./coverage-uncertainty.js";
export { computeKRobustness } from "./k-robustness.js";
export { computeMountTiltPenalty, getMountModel, getDefaultHeight, isPitchWithinMountLimits, isYawWithinMountLimits, computeBlindSpotPenalty } from "./mount-model.js";
export { analyzeOcclusionBlame } from "./occlusion-blame.js";
export { computePathResults, deriveCameraQualityByZone } from "./path-analysis.js";
export { pathLengthM, pointOnPathAtProgress, samplePathQuality, groupPathQualitySamples } from "./path-quality.js";
export { computePlacementOracle } from "./placement-oracle.js";
export { computeTemporalProfile, computeTimeSliceStateForHour } from "./temporal.js";
export { detectTemporalAnomalies } from "./temporal-anomaly.js";
export { selectHighestPriorityCriticalZone, selectCounterCriticalZone } from "./critical-zone-selection.js";

// Re-export types from core for convenience
export type {
  SecurityScene, SimulationResult, DoriQuality, CoverageCellResult,
  ZoneResult, CameraResult, SecurityIssue, Recommendation,
  AdversarialPathResult, TemporalSecurityProfile,
  CellComputation
} from "@sentineltwin/core";
