import type { DoriQuality } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export type QualityStandard = "dori_2014" | "oodpcvs_2025";

/**
 * Canonical quality display mappings.
 * All UI components should import from here instead of defining their own.
 */

/** Full labels for tools, panels, inspector. */
export const QUALITY_LABEL: Record<DoriQuality, string> = {
  none: "None",
  detection: "Detection",
  overview: "Overview",
  outline: "Outline",
  observation: "Observation",
  discern: "Discern",
  perceive: "Perceive",
  recognition: "Recognition",
  characterize: "Characterize",
  validate: "Validate",
  identification: "Identification",
  scrutinize: "Scrutinize",
};

/** Short abbreviations for badges, chips, status bars. */
export const QUALITY_ABBR: Record<DoriQuality, string> = {
  none: "—",
  detection: "DET",
  overview: "OV",
  outline: "OU",
  observation: "OBS",
  discern: "DI",
  perceive: "PE",
  recognition: "REC",
  characterize: "CH",
  validate: "VA",
  identification: "ID",
  scrutinize: "SC",
};

/** Medium-length labels for summary panels, table cells. */
export const QUALITY_SHORT_LABEL: Record<DoriQuality, string> = {
  none: "—",
  detection: "DETECT",
  overview: "OVER",
  outline: "OUTL",
  observation: "OBS",
  discern: "DISC",
  perceive: "PERC",
  recognition: "RECOG",
  characterize: "CHAR",
  validate: "VALID",
  identification: "IDENT",
  scrutinize: "SCRUT",
};

/** Hex color per quality level (used by Canvas, SVG, CoverageRibbon, map overlays). */
export const QUALITY_COLOR: Record<DoriQuality, string> = {
  none: "#ef4444",
  detection: "#fb923c",
  overview: "#fb923c",
  outline: "#f97316",
  observation: "#facc15",
  discern: "#eab308",
  perceive: "#84cc16",
  recognition: "#22c55e",
  characterize: "#22c55e",
  validate: "#3b82f6",
  identification: "#3b82f6",
  scrutinize: "#0ea5e9",
};

/** Tailwind text-color classes per quality level (used by CameraStatusSummaryPanel). */
export const QUALITY_TEXT_COLOR: Record<DoriQuality, string> = {
  none: "UI_SURFACES.textMuted",
  detection: "text-orange-300",
  overview: "text-orange-300",
  outline: "text-orange-300",
  observation: "text-yellow-300",
  discern: "text-yellow-300",
  perceive: "text-lime-300",
  recognition: "text-green-300",
  characterize: "text-green-300",
  validate: "text-blue-300",
  identification: "text-blue-300",
  scrutinize: "text-sky-300",
};

/** Tailwind bg/text/dot class triples for badges (used by TimelineTab). */
export function qualityBadgeClasses(quality: DoriQuality): { bg: string; text: string; dot: string } {
  const map: Record<DoriQuality, { bg: string; text: string; dot: string }> = {
    none: { bg: "bg-red-900/40", text: "text-red-400", dot: "bg-red-500" },
    detection: { bg: "bg-orange-900/40", text: "text-orange-300", dot: "bg-orange-400" },
    overview: { bg: "bg-orange-900/40", text: "text-orange-300", dot: "bg-orange-400" },
    outline: { bg: "bg-orange-900/40", text: "text-orange-300", dot: "bg-orange-400" },
    observation: { bg: "bg-yellow-900/40", text: "text-yellow-300", dot: "bg-yellow-400" },
    discern: { bg: "bg-yellow-900/40", text: "text-yellow-300", dot: "bg-yellow-400" },
    perceive: { bg: "bg-lime-900/40", text: "text-lime-300", dot: "bg-lime-400" },
    recognition: { bg: "bg-green-900/40", text: "text-green-300", dot: "bg-green-400" },
    characterize: { bg: "bg-green-900/40", text: "text-green-300", dot: "bg-green-400" },
    validate: { bg: "bg-blue-900/40", text: "text-blue-300", dot: "bg-blue-400" },
    identification: { bg: "bg-blue-900/40", text: "text-blue-300", dot: "bg-blue-400" },
    scrutinize: { bg: "bg-sky-900/40", text: "text-sky-300", dot: "bg-sky-400" },
  };
  return map[quality] ?? map.none;
}

/** Bar-chart color per quality level (used by TimelineTab bar strips). */
export const QUALITY_BAR_COLOR: Record<DoriQuality, string> = {
  none: "#ef4444",
  detection: "#fb923c",
  overview: "#fb923c",
  outline: "#fb923c",
  observation: "#facc15",
  discern: "#eab308",
  perceive: "#84cc16",
  recognition: "#60a5fa",
  characterize: "#4ade80",
  validate: "#60a5fa",
  identification: "#4ade80",
  scrutinize: "#0ea5e9",
};

/**
 * Quality rank for ordering/sorting.
 * Uses the full IEC 62676-4:2025 / DORI ladder so OODPCVS levels are preserved
 * distinctly in sort-based UI surfaces such as the timeline and camera summary.
 * Range: 0 (none) → 11 (scrutinize).
 */
export const QUALITY_RANK: Record<DoriQuality, number> = {
  none: 0,
  detection: 1,
  overview: 2,
  outline: 3,
  observation: 4,
  discern: 5,
  perceive: 6,
  recognition: 7,
  characterize: 8,
  validate: 9,
  identification: 10,
  scrutinize: 11,
};

/**
 * Core trust-facing label set used in explainability UI.
 * OODPCVS levels are collapsed into the core DORI-style user language.
 */
export const CORE_QUALITY_LABEL: Record<DoriQuality, string> = {
  none: "No view",
  detection: "Detection",
  overview: "Detection",
  outline: "Detection",
  observation: "Observation",
  discern: "Observation",
  perceive: "Recognition",
  recognition: "Recognition",
  characterize: "Recognition",
  validate: "Identification",
  identification: "Identification",
  scrutinize: "Identification",
};

export function getTrustQualityLabel(
  quality: DoriQuality,
  standard: QualityStandard,
): string {
  const core = CORE_QUALITY_LABEL[quality] ?? "No view";
  if (standard !== "oodpcvs_2025") {
    return core;
  }

  const detailed = QUALITY_LABEL[quality] ?? quality;
  if (quality === "none") {
    return core;
  }

  if (core === detailed) {
    return core;
  }

  return `${core} (${detailed})`;
}
