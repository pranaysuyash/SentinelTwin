import type {
  ConfidenceBand,
  ConfidenceLevel,
  ReviewStatus,
  SceneSource,
  SimulationResult,
} from "@sentineltwin/core";

/**
 * Trust/report language for simulation results.
 *
 * Distinguishes between:
 * - planning estimate (no calibration, no footage verification)
 * - DORI/OODPCVS-style estimate (calibrated against standard thresholds)
 * - operator-adjusted (human corrections applied)
 * - field-verified (real footage confirms the simulation)
 *
 * This is the engine-side implementation of the report language separation
 * called for in Thread 2b (simulation engine maturity). Every report claim
 * should be prefixed with the appropriate label.
 */

export type ClaimClassification =
  | "planning_estimate"
  | "calibrated_estimate"
  | "operator_adjusted"
  | "field_verified";

export type ClaimLabel = {
  classification: ClaimClassification;
  label: string;
  confidenceLabel: string;
  disclaimer: string;
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  none: "Insufficient data",
  low: "Low confidence — verify inputs before acting",
  medium: "Medium confidence — sensitive to scene assumptions",
  high: "High confidence within stated parameters",
  verified: "Verified against real footage or calibration",
};

const DISCLAIMERS: Record<ConfidenceLevel, string> = {
  none: "This result is based on incomplete or unreliable inputs and should not be used for security decisions without field verification.",
  low: "This is a planning estimate only. Actual coverage may differ significantly due to unverified scene geometry, camera specs, or lighting conditions.",
  medium: "This is a simulation estimate. Coverage quality depends on the accuracy of scene geometry, camera specifications, and lighting assumptions stated above.",
  high: "Simulation estimate with good confidence. Actual coverage should be verified on-site, but deviations are expected to be within stated margins.",
  verified: "Simulation matches field-verified data. Report confidence is at the maximum supported level.",
};

/**
 * Classify a simulation result's trust level based on its provenance and confidence.
 */
export function classifyClaim(result: Pick<SimulationResult, "provenance" | "overallConfidence" | "sceneHash">): ClaimClassification {
  const calibrationVersion = result.provenance?.calibrationVersion;
  const computationMode = result.provenance?.computationMode;
  const confidenceLevel = result.overallConfidence?.level ?? "none";

  if (confidenceLevel === "verified") return "field_verified";
  if (calibrationVersion && calibrationVersion !== "0.1.0" && confidenceLevel === "high") return "calibrated_estimate";
  if (calibrationVersion || confidenceLevel === "medium" || confidenceLevel === "high") return "calibrated_estimate";
  if (confidenceLevel === "low" || confidenceLevel === "none") return "planning_estimate";

  return "planning_estimate";
}

/**
 * Build a complete claim label for use in reports and UI.
 */
export function getClaimLabel(
  result: Pick<SimulationResult, "provenance" | "overallConfidence" | "sceneHash">,
): ClaimLabel {
  const classification = classifyClaim(result);
  const confidenceLevel = result.overallConfidence?.level ?? "none";

  const labelMap: Record<ClaimClassification, string> = {
    planning_estimate: "Planning Estimate",
    calibrated_estimate: "Calibrated Coverage Estimate",
    operator_adjusted: "Operator-Adjusted Assessment",
    field_verified: "Field-Verified Coverage Report",
  };

  return {
    classification,
    label: labelMap[classification],
    confidenceLabel: CONFIDENCE_LABELS[confidenceLevel],
    disclaimer: DISCLAIMERS[confidenceLevel],
  };
}

/**
 * Get a short status badge label for a simulation result.
 */
export function getConfidenceBadge(band: ConfidenceBand | undefined): string {
  if (!band) return "Unknown";
  const labels: Record<ConfidenceLevel, string> = {
    verified: "Verified",
    high: "High Confidence",
    medium: "Medium Confidence",
    low: "Low Confidence",
    none: "No Confidence",
  };
  return labels[band.level];
}

/**
 * Generate a human-readable report source line describing where the scene data came from.
 */
export function getReportSourceLine(source: SceneSource, reviewStatus: ReviewStatus): string {
  const sourceName: Record<SceneSource, string> = {
    manual: "manually created",
    ai: "AI-extracted",
    scan: "3D scan reconstruction",
    import: "imported",
    preset: "template-based",
    demo: "demo scene",
  };

  const statusNote: Record<ReviewStatus, string> = {
    unreviewed: "not yet reviewed",
    accepted: "accepted by operator",
    corrected: "corrected by operator",
    calibrated: "calibrated by operator",
    verified: "verified against real footage",
  };

  return `Scene was ${sourceName[source]} and ${statusNote[reviewStatus]}.`;
}
