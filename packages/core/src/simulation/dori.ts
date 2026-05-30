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
 * IEC 62676-4:2025 OODPCVS PPM thresholds (7-level).
 * overview=25, outline=50, discern=62.5, perceive=100,
 * characterize=125, validate=250, scrutinize=500.
 */
export const OODPCVS_THRESHOLDS = {
  scrutinize: 500,
  validate: 250,
  characterize: 125,
  perceive: 100,
  discern: 62.5,
  outline: 50,
  overview: 25,
} as const;

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
 */
export function ppmToOodpcvsQuality(ppm: number): DoriQuality {
  if (ppm >= OODPCVS_THRESHOLDS.scrutinize) return "scrutinize";
  if (ppm >= OODPCVS_THRESHOLDS.validate) return "validate";
  if (ppm >= OODPCVS_THRESHOLDS.characterize) return "characterize";
  if (ppm >= OODPCVS_THRESHOLDS.perceive) return "perceive";
  if (ppm >= OODPCVS_THRESHOLDS.discern) return "discern";
  if (ppm >= OODPCVS_THRESHOLDS.outline) return "outline";
  if (ppm >= OODPCVS_THRESHOLDS.overview) return "overview";
  return "none";
}

/**
 * Backward-compatible PPM mapper that preserves the older DORI-only call site shape.
 * @deprecated Use ppmToDoriQuality() or ppmToOodpcvsQuality() explicitly.
 */
export function ppmToQuality(ppm: number, thresholds: PpmThresholds = DORI_THRESHOLDS): DoriQuality {
  return ppmToDoriQuality(ppm, thresholds);
}
