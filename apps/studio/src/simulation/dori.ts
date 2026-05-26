import type { DoriQuality } from "@/schema/security-scene";

export const DORI_THRESHOLDS = {
  identification: 250,
  recognition: 125,
  observation: 62.5,
  detection: 25,
} as const;

export const QUALITY_ORDER: DoriQuality[] = [
  "none",
  "detection",
  "observation",
  "recognition",
  "identification",
];

export function ppmToQuality(ppm: number): DoriQuality {
  if (ppm >= DORI_THRESHOLDS.identification) return "identification";
  if (ppm >= DORI_THRESHOLDS.recognition) return "recognition";
  if (ppm >= DORI_THRESHOLDS.observation) return "observation";
  if (ppm >= DORI_THRESHOLDS.detection) return "detection";
  return "none";
}

export function qualityToScore(quality: DoriQuality): number {
  return QUALITY_ORDER.indexOf(quality);
}

export function maxQuality(a: DoriQuality, b: DoriQuality): DoriQuality {
  return qualityToScore(a) >= qualityToScore(b) ? a : b;
}

export function scoreToQuality(score: number): DoriQuality {
  return QUALITY_ORDER[Math.max(0, Math.min(QUALITY_ORDER.length - 1, Math.round(score)))]!;
}
