import type { OperationalEvidenceTemporalTwinSummary } from "@/lib/operational-evidence";
import type { SecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import { buildSecurityNarrativeModel } from "@/lib/security-outcome/security-narrative";
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

  const narrative = buildSecurityNarrativeModel(outcome, result, scene);
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
    { label: "Critical Issue", text: narrative.criticalIssue },
    { label: "Primary Cause", text: narrative.primaryCause },
    { label: "Impact", text: narrative.impact },
    { label: "Recommendation", text: narrative.recommendation },
    { label: "Evidence Trail", text: narrative.evidenceTrail },
  ];

  if (temporalTwinLine) {
    lines.push({ label: "Temporal Twin", text: temporalTwinLine });
  }

  return lines;
}
