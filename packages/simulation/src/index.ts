// Core coverage engine
export { createCoverageEvaluator, computeCoverageCells, getQualityShare, getIdentificationAreaPct, getRecognitionAreaPct } from "./coverage";
export type { CellComputation, CameraEvaluation, CoverageEvaluator } from "./coverage";
export { simulateStudio, simulateStudioLite } from "./simulate-studio";

// DORI/OODPCVS quality models
export {
  DORI_THRESHOLDS, OODPCVS_THRESHOLDS,
  qualityToScore, scoreToQuality, maxQuality,
  ppmToDoriQuality, ppmToOodpcvsQuality, ppmToQuality,
  QUALITY_ORDER,
} from "./dori";
export { OODPCVS_MIN_PPM, computeOODPCVSQuality, getPopFactor, getCriticalityMargin, meetsOODPCVSRequirement } from "./odpcvs";

// Geometry utilities
export { toRadians, normalizeAngle, getYawPitchDirection, pointInPolygon, polygonCenter, distance2D, lerp2D } from "./geometry";

// Grid
export { buildCoverageGrid } from "./grid";

// Mount model
export { computeMountTiltPenalty, getMountModel, getDefaultHeight, isPitchWithinMountLimits, isYawWithinMountLimits, computeBlindSpotPenalty } from "./mount-model";

// Vision collider
export { buildVisionColliderMesh, getVisionColliderSource } from "./vision-collider-mesh";

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

export { computeSeasonalLightState, getExteriorLightStateSeasonal, estimateExteriorLux, computeTwilightPeriods } from "./seasonal-lighting";

export type { SunPosition, LightMeasurement, SeasonalLightState } from "./seasonal-lighting";

// Utility
export { getQualityThresholds, getForwardVector } from "./coverage";
