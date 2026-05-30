import type { DoriQuality } from "@sentineltwin/core";

/**
 * IEC 62676-4:2025 OODPCVS (Operator-Observer Detection, Perception, Classification, Verification, Search)
 * quality assessment model.
 *
 * Extends DORI (2014) with finer granularity over observation-level qualities and multi-factor
 * adjustments for scene complexity, operator experience, and task criticality.
 */

// OODPCVS resolution threshold in PPM (pixels per metre) at the imaging plane.
// Each quality level maps to the minimum PPM needed to achieve it.
export const OODPCVS_MIN_PPM: Record<string, number> = {
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

/**
 * Scene complexity factors that degrade effective quality.
 */
export type SceneComplexity = "simple" | "moderate" | "complex" | "cluttered";

/**
 * Operator experience level.
 */
export type OperatorExperience = "novice" | "trained" | "expert";

/**
 * Task criticality level.
 */
export type TaskCriticality = "low" | "standard" | "high" | "critical";

/**
 * Probability of performance factor (Pop) adjustment table.
 * Multiplied with base quality to get effective usable quality.
 */
export function getPopFactor(
  complexity: SceneComplexity,
  experience: OperatorExperience,
): number {
  const factors: Record<SceneComplexity, Record<OperatorExperience, number>> = {
    simple: { novice: 0.85, trained: 0.95, expert: 1.0 },
    moderate: { novice: 0.7, trained: 0.85, expert: 0.95 },
    complex: { novice: 0.5, trained: 0.7, expert: 0.85 },
    cluttered: { novice: 0.35, trained: 0.55, expert: 0.7 },
  };
  return (factors[complexity]?.[experience]) ?? 0.7;
}

/**
 * Task criticality adjustment.
 * For higher criticality tasks, we require more margin above the threshold.
 */
export function getCriticalityMargin(criticality: TaskCriticality): number {
  const margins: Record<TaskCriticality, number> = {
    low: 0,
    standard: 0.1,
    high: 0.2,
    critical: 0.35,
  };
  return margins[criticality] ?? 0;
}

/**
 * Compute the OODPCVS quality given PPM and multi-factor adjustments.
 */
export function computeOODPCVSQuality(
  ppm: number,
  complexity: SceneComplexity = "moderate",
  experience: OperatorExperience = "trained",
  criticality: TaskCriticality = "standard",
): DoriQuality {
  const popFactor = getPopFactor(complexity, experience);
  const margin = getCriticalityMargin(criticality);
  const effectivePpm = ppm * popFactor;
  const requiredPpm = effectivePpm * (1 + margin);

  // Walk descending from highest quality to find the best match
  const levels = Object.entries(OODPCVS_MIN_PPM).reverse();
  for (const [quality, minPpm] of levels) {
    if (requiredPpm >= minPpm) {
      return quality as DoriQuality;
    }
  }

  return "none";
}

/**
 * Determine if a given PPM meets the specified quality requirement under OODPCVS.
 */
export function meetsOODPCVSRequirement(
  ppm: number,
  requiredQuality: DoriQuality,
  complexity: SceneComplexity = "moderate",
  experience: OperatorExperience = "trained",
  criticality: TaskCriticality = "standard",
): boolean {
  const actual = computeOODPCVSQuality(ppm, complexity, experience, criticality);
  const qualityOrder: DoriQuality[] = [
    "none", "detection", "overview", "outline", "observation",
    "discern", "perceive", "recognition", "characterize",
    "validate", "identification", "scrutinize",
  ];
  return qualityOrder.indexOf(actual) >= qualityOrder.indexOf(requiredQuality);
}
