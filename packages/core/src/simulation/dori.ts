import type { DoriQuality } from "../schema/security-scene.js";

/**
 * DORI 2014 PPM thresholds (4-level).
 * detection=25, observation=62.5, recognition=125, identification=250.
 */
export const DORI_THRESHOLDS = {
  identification: 250,
  recognition: 125,
  observation: 62.5,
  detection: 25,
} as const;

/**
 * IEC 62676-4:2025 OODPCVS PPM thresholds — complete 12-level set.
 *
 * Covers every quality in QUALITY_ORDER (excluding "none").
 * Maps each named quality level to the minimum PPM required to achieve it.
 */
export const OODPCVS_THRESHOLDS: Record<string, number> = {
  detection: 12,
  overview: 16,
  outline: 24,
  observation: 32,
  discern: 48,
  perceive: 64,
  recognition: 96,
  characterize: 128,
  validate: 160,
  identification: 192,
  scrutinize: 256,
};

/** @deprecated Use OODPCVS_THRESHOLDS — same values, unified name. */
export const OODPCVS_PPM_THRESHOLDS = OODPCVS_THRESHOLDS;

export type PpmThresholds = {
  detection: number;
  observation: number;
  recognition: number;
  identification: number;
};

/** Score map for all quality levels. DORI and OODPCVS equivalents share positions. */
const QUALITY_SCORE_MAP: Record<DoriQuality, number> = {
  none: 0,
  detection: 1,
  overview: 1,
  outline: 2,
  observation: 3,
  discern: 3,
  perceive: 4,
  recognition: 5,
  characterize: 5,
  identification: 6,
  validate: 6,
  scrutinize: 7,
};

/** Maximum quality score. */
export const MAX_QUALITY_SCORE = 7;

/**
 * Ordered list of quality levels (by ascending PPM / score).
 * Used for iteration and display ordering.
 */
export const QUALITY_ORDER: DoriQuality[] = [
  "none",
  "detection",
  "overview",
  "outline",
  "observation",
  "discern",
  "perceive",
  "recognition",
  "characterize",
  "identification",
  "validate",
  "scrutinize",
];

export function qualityToScore(quality: DoriQuality): number {
  return QUALITY_SCORE_MAP[quality] ?? 0;
}

export function scoreToQuality(score: number): DoriQuality {
  if (score <= 0) return "none";
  if (score <= 1) return "detection";
  if (score <= 2) return "outline";
  if (score <= 3) return "observation";
  if (score <= 4) return "perceive";
  if (score <= 5) return "recognition";
  if (score <= 6) return "identification";
  return "scrutinize";
}

export function maxQuality(a: DoriQuality, b: DoriQuality): DoriQuality {
  return qualityToScore(a) >= qualityToScore(b) ? a : b;
}

/**
 * Map PPM to quality level using DORI 2014 thresholds.
 */
export function ppmToDoriQuality(ppm: number, thresholds: PpmThresholds = DORI_THRESHOLDS): DoriQuality {
  if (ppm >= thresholds.identification) return "identification";
  if (ppm >= thresholds.recognition) return "recognition";
  if (ppm >= thresholds.observation) return "observation";
  if (ppm >= thresholds.detection) return "detection";
  return "none";
}

/**
 * Map PPM to quality level using IEC 62676-4:2025 OODPCVS thresholds.
 *
 * Iterates QUALITY_ORDER in descending score to find the highest
 * quality whose PPM threshold the given PPM meets or exceeds.
 */
export function ppmToOodpcvsQuality(ppm: number): DoriQuality {
  for (let i = QUALITY_ORDER.length - 1; i >= 0; i--) {
    const q = QUALITY_ORDER[i];
    if (q === "none") continue;
    const threshold = OODPCVS_THRESHOLDS[q];
    if (ppm >= threshold) return q;
  }
  return "none";
}

/**
 * Detection probability table — maps each quality level to the estimated
 * probability that an operator will detect/track a subject at that quality.
 *
 * These values are used by the simulation, report, and AI agent layers
 * and are housed centrally here so all consumers share the same model.
 */
export const DETECTION_PROBABILITY: Record<DoriQuality, number> = {
  none: 0,
  detection: 0.25,
  overview: 0.25,
  outline: 0.35,
  observation: 0.5,
  discern: 0.5,
  perceive: 0.65,
  recognition: 0.85,
  characterize: 0.85,
  validate: 0.92,
  identification: 0.99,
  scrutinize: 0.99,
};

export function getDetectionProbability(quality: DoriQuality): number {
  return DETECTION_PROBABILITY[quality] ?? 0;
}

/**
 * Backward-compatible PPM mapper that preserves the older DORI-only call site shape.
 * @deprecated Use ppmToDoriQuality() or ppmToOodpcvsQuality() explicitly.
 */
export function ppmToQuality(ppm: number, thresholds: PpmThresholds = DORI_THRESHOLDS): DoriQuality {
  return ppmToDoriQuality(ppm, thresholds);
}
