import type { Tier1Output, GateDecision, GateAction } from "./types";

export const DEFAULT_QUALITY_THRESHOLD = 0.4;

export function evaluateGateDecision(
  tier1: Tier1Output,
  options?: { qualityThreshold?: number; forceTier2?: boolean },
): GateDecision {
  if (options?.forceTier2) {
    return {
      action: "proceed_to_tier2",
      reason: "Tier 2 forced by configuration.",
      qualityThreshold: options.qualityThreshold ?? DEFAULT_QUALITY_THRESHOLD,
    };
  }

  const qualityThreshold = options?.qualityThreshold ?? DEFAULT_QUALITY_THRESHOLD;

  if (tier1.imageQuality.isBlurry) {
    return {
      action: "reject_blurry",
      reason: `Image is blurry (blurScore=${tier1.imageQuality.blurScore.toFixed(2)}). Quality score ${tier1.imageQuality.qualityScore.toFixed(2)} is below threshold ${qualityThreshold.toFixed(2)}.`,
      qualityThreshold,
    };
  }

  if (tier1.imageQuality.qualityScore < qualityThreshold) {
    return {
      action: "reject_blurry",
      reason: `Quality score ${tier1.imageQuality.qualityScore.toFixed(2)} is below threshold ${qualityThreshold.toFixed(2)}. ${tier1.imageQuality.lowLight ? "Low light detected. " : ""}${tier1.imageQuality.overexposed ? "Overexposed. " : ""}${!tier1.imageQuality.resolutionSufficient ? "Resolution too low. " : ""}`,
      qualityThreshold,
    };
  }

  if (tier1.sceneType === "unknown" || tier1.sceneTypeConfidence < 0.3) {
    return {
      action: "human_review",
      reason: `Scene type "${tier1.sceneType}" could not be confidently classified (confidence=${tier1.sceneTypeConfidence.toFixed(2)}). Manual review required.`,
      qualityThreshold,
    };
  }

  if (tier1.ambiguityFlags.length > 2) {
    return {
      action: "human_review",
      reason: `Too many ambiguity flags (${tier1.ambiguityFlags.length}): ${tier1.ambiguityFlags.join(", ")}. Manual review recommended.`,
      qualityThreshold,
    };
  }

  if (tier1.overallConfidence < qualityThreshold) {
    return {
      action: "human_review",
      reason: `Tier 1 overall confidence ${tier1.overallConfidence.toFixed(2)} is below threshold ${qualityThreshold.toFixed(2)}.`,
      qualityThreshold,
    };
  }

  return {
    action: "proceed_to_tier2",
    reason: `Tier 1 passed: quality=${tier1.imageQuality.qualityScore.toFixed(2)}, scene="${tier1.sceneType}" (conf=${tier1.sceneTypeConfidence.toFixed(2)}), overall=${tier1.overallConfidence.toFixed(2)}.`,
    qualityThreshold,
  };
}

export function getGateWarning(decision: GateDecision): string | null {
  switch (decision.action) {
    case "reject_blurry":
      return "Image rejected by Tier 1 gate: quality too low. Upload a clearer floor plan photo.";
    case "human_review":
      return "Tier 1 gate flagged this image for manual review before proceeding to full extraction.";
    case "proceed_to_tier2":
    default:
      return null;
  }
}
