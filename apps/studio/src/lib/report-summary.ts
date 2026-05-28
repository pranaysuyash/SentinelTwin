import type { SecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import type { SimulationResult } from "@/schema/security-scene";

export type ReportSummaryLine = {
  label: "Critical Issue" | "Primary Cause" | "Impact" | "Recommendation";
  text: string;
};

export function buildReportSummaryLines(
  outcome: SecurityOutcomeModel,
  result: SimulationResult | null,
): ReportSummaryLine[] | null {
  if (!result) return null;

  const criticalIssue =
    outcome.summary.worstIssue?.description
    ?? result.issues.find((issue) => issue.category === "quality_fail")?.description
    ?? "No critical issue detected.";
  const primaryCause =
    result.issues.find((issue) => issue.category === "blindspot")?.description
    ?? result.issues.find((issue) => issue.category === "privacy")?.description
    ?? result.recommendations[0]?.description
    ?? "Coverage requires a scene or camera adjustment.";
  const impact = outcome.summary.coveragePct == null
    ? "Coverage impact is unavailable until simulation is run."
    : `Current simulated coverage is ${Math.round(outcome.summary.coveragePct)}% with ${outcome.summary.criticalZonesPassing}/${outcome.summary.criticalZonesTotal} critical zones passing.`;
  const recommendation = result.recommendations.length > 0
    ? result.recommendations
      .map((rec) => `${rec.description}${rec.verified ? " (verified)" : " (not yet verified)"}`)
      .slice(0, 2)
      .join(" ")
    : "No verified recommendation is available yet.";

  return [
    { label: "Critical Issue", text: criticalIssue },
    { label: "Primary Cause", text: primaryCause },
    { label: "Impact", text: impact },
    { label: "Recommendation", text: recommendation },
  ];
}
