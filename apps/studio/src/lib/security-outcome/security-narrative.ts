import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import type { SecurityOutcomeModel } from "./security-outcome-model";

export type SecurityNarrativeModel = {
  criticalIssue: string;
  primaryCause: string;
  impact: string;
  recommendation: string;
  evidenceTrail: string;
};

export function buildSecurityNarrativeModel(
  outcome: SecurityOutcomeModel,
  result: SimulationResult | null,
  scene?: Pick<SecurityScene, "changeLog">,
): SecurityNarrativeModel {
  const criticalIssue =
    outcome.summary.worstIssue?.description
    ?? result?.issues.find((issue) => issue.category === "quality_fail")?.description
    ?? "No critical issue detected.";

  const primaryCause =
    result?.issues.find((issue) => issue.category === "blindspot")?.description
    ?? result?.issues.find((issue) => issue.category === "privacy")?.description
    ?? result?.recommendations[0]?.description
    ?? "Coverage requires a scene or camera adjustment.";

  const impact = outcome.summary.coveragePct == null
    ? "Coverage impact is unavailable until simulation is run."
    : `Current simulated coverage is ${Math.round(outcome.summary.coveragePct)}% with ${outcome.summary.criticalZonesPassing}/${outcome.summary.criticalZonesTotal} critical zones passing.`;

  const recommendation = result?.recommendations.length
    ? result.recommendations
      .map((rec) => `${rec.description}${rec.verified ? " (verified)" : " (not yet verified)"}`)
      .slice(0, 2)
      .join(" ")
    : "No verified recommendation is available yet.";

  const evidenceEntries = scene
    ? scene.changeLog.filter((entry) => entry.startsWith("Evidence: ")).length
    : null;
  const sensorEvidenceEntries = scene
    ? scene.changeLog.filter((entry) => entry.startsWith("Evidence: ") && /sensor/i.test(entry)).length
    : null;
  const evidenceTrail = scene
    ? `${scene.changeLog.length} change-log entries, ${evidenceEntries} evidence entries, ${sensorEvidenceEntries} sensor-related evidence`
    : "Scene evidence trail unavailable.";

  return {
    criticalIssue,
    primaryCause,
    impact,
    recommendation,
    evidenceTrail,
  };
}
