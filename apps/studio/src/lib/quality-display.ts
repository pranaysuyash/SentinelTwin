import type { DoriQuality } from "@/schema/security-scene";

/**
 * Canonical quality display mappings.
 * All UI components should import from here instead of defining their own.
 */
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
