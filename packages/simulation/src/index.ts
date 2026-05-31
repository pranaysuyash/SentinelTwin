// Core coverage engine
export { createCoverageEvaluator, computeCoverageCells, getQualityShare, getIdentificationAreaPct, getRecognitionAreaPct } from "./coverage";
export type { CellComputation, CameraEvaluation, CoverageEvaluator } from "./coverage";
export { simulateStudio, simulateStudioAsync, simulateStudioLite } from "./simulate-studio";

// DORI/OODPCVS quality models (re-exported from core)
export {
  DORI_THRESHOLDS, OODPCVS_THRESHOLDS,
  qualityToScore, scoreToQuality, maxQuality,
  ppmToDoriQuality, ppmToOodpcvsQuality, ppmToQuality,
  QUALITY_ORDER,
} from "@sentineltwin/core";
export { OODPCVS_MIN_PPM, computeOODPCVSQuality, getPopFactor, getCriticalityMargin, meetsOODPCVSRequirement } from "./odpcvs";

// Geometry utilities (re-exported from core)
export { toRadians, normalizeAngle, getYawPitchDirection, pointInPolygon, polygonCenter, distance2D, lerp2D } from "@sentineltwin/core";

// Grid (re-exported from core)
export { buildCoverageGrid } from "@sentineltwin/core";

// Mount model
export { computeMountTiltPenalty, getMountModel, getDefaultHeight, isPitchWithinMountLimits, isYawWithinMountLimits, computeBlindSpotPenalty } from "./mount-model";

// Vision collider
export { buildVisionColliderMesh, getVisionColliderSource, disposeVisionColliderMesh } from "./vision-collider-mesh";

// Path analysis
export { computePathResults, deriveCameraQualityByZone } from "./path-analysis";
export { pathLengthM, pointOnPathAtProgress, samplePathQuality, groupPathQualitySamples } from "./path-quality";
export type { Point2, CoverageCellLike, PathQualitySample, PathQualityBand } from "./path-quality";

// Adversarial path
export { computeAdversarialPath } from "./adversarial-path";

// Blind spot analysis
export { analyseBlindSpotTopology } from "./blind-spot-topology";
export { computeBlindSpotFingerprint } from "./blind-spot-fingerprint";

// Coverage analytics
export { computeCoverageEntropy } from "./coverage-entropy";
export { computeCoverageFragility } from "./coverage-fragility";
export { computeCoveragePostureVariation } from "./coverage-posture";
export { computeCoverageTimeBudget } from "./coverage-time-budget";
export { computeCoverageUncertainty } from "./coverage-uncertainty";

// Redundancy
export { computeKRobustness } from "./k-robustness";

// Occlusion blame
export { analyzeOcclusionBlame } from "./occlusion-blame";

// Placement oracle
export { computePlacementOracle } from "./placement-oracle";

// Temporal simulation
export { computeTemporalProfile, computeTimeSliceStateForHour } from "./temporal";

export type { TimeSliceState } from "./temporal";

export { detectTemporalAnomalies } from "./temporal-anomaly";

export { computeSeasonalLightState, getExteriorLightStateSeasonal, estimateExteriorLux, computeTwilightPeriods } from "./seasonal-lighting";

export type { SunPosition, LightMeasurement, SeasonalLightState } from "./seasonal-lighting";

// Utility
export { getQualityThresholds, getForwardVector } from "./coverage";

// ── Simulation Engine Maturity (Thread 2b) ──

// Calibration
export {
  DEFAULT_CALIBRATION,
  getCalibration,
  getCameraPreset,
  estimateCameraConfidence,
  getEdgeFalloffFactor,
  getMountTiltLimit,
  getNightModeRetentionFactor,
  luxToLightLevel,
  computePpmConfidenceInterval,
} from "./calibration";

// Scene hashing
export {
  serializeSceneInputs,
  computeSceneHash,
  computeSceneInputHash,
  isSceneHashMatch,
} from "./scene-hash";

// Confidence propagation
export {
  computeOverallConfidence,
  computeZoneConfidence,
  computePathConfidence,
  formatConfidenceSummary,
} from "./confidence";

// Scenario batch runner
export {
  DEFAULT_SCENARIO_STATES,
  applyScenarioState,
  generateCameraOfflineScenarios,
  generateObstructionRemovedScenarios,
  generateCameraBlockedScenarios,
  runScenarioBatch,
} from "./scenario-batch";

// Counterfactual search
export {
  computeCounterfactualSearch,
} from "./counterfactual-search";
export type { CounterfactualConstraints } from "./counterfactual-search";

// Assumption sensitivity
export { computeAssumptionSensitivity } from "./assumption-sensitivity";

// Provenance / report language
export {
  classifyClaim,
  getClaimLabel,
  getConfidenceBadge,
  getReportSourceLine,
} from "./provenance-label";
export type { ClaimClassification, ClaimLabel } from "./provenance-label";
