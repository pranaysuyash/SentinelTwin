import type { OperationalEvidenceTemporalTwinSummary } from "@/lib/operational-evidence";
import type { SecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";

export type ReportSummaryLine = {
  label: "Critical Issue" | "Primary Cause" | "Impact" | "Recommendation" | "Evidence Trail" | "Temporal Twin";
  text: string;
};

// ---------------------------------------------------------------------------
// Audience modes (4.9 — Reporting, Export, and Compliance Evidence)
// ---------------------------------------------------------------------------

export type AudienceMode =
  | "operator"
  | "auditor"
  | "insurer"
  | "installer"
  | "privacy_reviewer";

/**
 * Returns the human-readable label for an audience mode.
 */
export function audienceModeLabel(mode: AudienceMode): string {
  const labels: Record<AudienceMode, string> = {
    operator: "Operator",
    auditor: "Security Auditor",
    insurer: "Insurance Reviewer",
    installer: "Installer / Integrator",
    privacy_reviewer: "Privacy Reviewer",
  };
  return labels[mode];
}

/**
 * Returns a one-sentence description of what this audience cares about
 * in the exported report.
 */
export function audienceModeDescription(mode: AudienceMode): string {
  const descriptions: Record<AudienceMode, string> = {
    operator: "Focused on day-to-day coverage quality, alert posture, and operational incident history.",
    auditor: "Focused on standards compliance (IEC 62676-4:2025 / DORI), evidence trail completeness, and audit trail integrity.",
    insurer: "Focused on verified coverage percentages, critical zone pass/fail status, and documented risk mitigation.",
    installer: "Focused on camera placement geometry, field-of-view calculations, and wiring / mounting recommendations.",
    privacy_reviewer: "Focused on privacy zone compliance, GDPR-relevant restricted coverage areas, and data minimisation posture.",
  };
  return descriptions[mode];
}

/**
 * Returns a Markdown header block to prepend to a report when an audience mode
 * is specified, making the audience context explicit in the export artifact.
 */
export function audienceModeReportHeader(mode: AudienceMode): string {
  return `## Report Mode: ${audienceModeLabel(mode)}\n\n> ${audienceModeDescription(mode)}\n\n---\n\n`;
}


export function buildReportSummaryLines(
  outcome: SecurityOutcomeModel,
  result: SimulationResult | null,
  scene?: Pick<SecurityScene, "changeLog">,
  temporalTwin?: Pick<
    OperationalEvidenceTemporalTwinSummary,
    | "totalEvents"
    | "checkpointCount"
    | "publishedCheckpointCount"
    | "latestCheckpointAgeMs"
    | "latestPublishedCheckpointAgeMs"
    | "latestCheckpointProvenance"
    | "latestPublishedCheckpointProvenance"
    | "currentVsLatestCheckpointDelta"
    | "currentVsLatestPublishedCheckpointDelta"
  > | null,
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
  const evidenceEntries = scene
    ? scene.changeLog.filter((entry) => entry.startsWith("Evidence: ")).length
    : null;
  const sensorEvidenceEntries = scene
    ? scene.changeLog.filter((entry) => entry.startsWith("Evidence: ") && /sensor/i.test(entry)).length
    : null;
  const evidenceTrail = scene
    ? `${scene.changeLog.length} change-log entries, ${evidenceEntries} evidence entries, ${sensorEvidenceEntries} sensor-related evidence`
    : "Scene evidence trail unavailable.";
  const publishedCheckpointLabel = temporalTwin?.publishedCheckpointCount === 1 ? "published checkpoint" : "published checkpoints";
  const latestCheckpointProvenanceText = temporalTwin?.latestCheckpointProvenance
    ? temporalTwin.latestCheckpointProvenance.isExactSnapshot
      ? `, latest checkpoint exact snapshot from "${temporalTwin.latestCheckpointProvenance.sourceEventTitle}"`
      : `, latest checkpoint derived from "${temporalTwin.latestCheckpointProvenance.sourceEventTitle}"`
    : "";
  const latestPublishedCheckpointProvenanceText = temporalTwin?.latestPublishedCheckpointProvenance
    ? temporalTwin.latestPublishedCheckpointProvenance.isExactSnapshot
      ? `, latest published exact snapshot from "${temporalTwin.latestPublishedCheckpointProvenance.sourceEventTitle}"`
      : `, latest published derived from "${temporalTwin.latestPublishedCheckpointProvenance.sourceEventTitle}"`
    : "";
  const temporalTwinLine = temporalTwin
    ? `${temporalTwin.totalEvents} scene events, ${temporalTwin.checkpointCount} reconstructable checkpoints, ${temporalTwin.publishedCheckpointCount} ${publishedCheckpointLabel}${temporalTwin.latestCheckpointAgeMs != null ? `, latest checkpoint ${Math.max(1, Math.round(temporalTwin.latestCheckpointAgeMs / 60000))}m old` : ""}${latestCheckpointProvenanceText}${temporalTwin.latestPublishedCheckpointAgeMs != null ? `, latest published ${Math.max(1, Math.round(temporalTwin.latestPublishedCheckpointAgeMs / 60000))}m old` : ""}${latestPublishedCheckpointProvenanceText}${temporalTwin.currentVsLatestCheckpointDelta ? `, checkpoint delta cams ${temporalTwin.currentVsLatestCheckpointDelta.cameras >= 0 ? "+" : ""}${temporalTwin.currentVsLatestCheckpointDelta.cameras}` : ""}${temporalTwin.currentVsLatestPublishedCheckpointDelta ? `, published delta cams ${temporalTwin.currentVsLatestPublishedCheckpointDelta.cameras >= 0 ? "+" : ""}${temporalTwin.currentVsLatestPublishedCheckpointDelta.cameras}` : ""}`
    : null;

  const lines: ReportSummaryLine[] = [
    { label: "Critical Issue", text: criticalIssue },
    { label: "Primary Cause", text: primaryCause },
    { label: "Impact", text: impact },
    { label: "Recommendation", text: recommendation },
    { label: "Evidence Trail", text: evidenceTrail },
  ];

  if (temporalTwinLine) {
    lines.push({ label: "Temporal Twin", text: temporalTwinLine });
  }

  return lines;
}
