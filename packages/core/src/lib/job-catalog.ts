import type { Job, JobId } from "../schema/job";

/**
 * The v1 Job catalog — data layer (motto §0.8). Four jobs covering the product
 * thesis primary users + the evidence-frame buyer (D-020). Adding a lens is
 * adding a catalog entry, not a code change.
 *
 * Catalog scope rationale (motto §0.13): installer/auditor/operator/insurer in
 * v1. reviewer, privacy_reviewer, admin are deferred (workflow-stage / sys-auth,
 * not primary professional lenses).
 */
export const JOB_CATALOG: readonly Job[] = [
  {
    id: "installer",
    label: "CCTV Installer",
    blurb: "Design a credible camera setup and prove coverage to your client.",
    suggestedUserRole: "installer",
    lens: {
      entrySurface: "build_new",
      primaryVerb: "Design",
      entryCtaCopy: "Design a new camera setup",
      defaultViewMode: "map",
      defaultWorkspacePreset: "edit",
      defaultReadPosture: "read_write",
      suggestedStarterSceneId: "small-retail",
      foregroundedTool: "camera_placement",
      defaultBottomTab: "counterfactual",
      primaryOutput: "client_proposal",
      defaultExportFormat: "pdf",
      vocabularySet: "installer",
      suggestedStaircaseRung: 3,
    },
  },
  {
    id: "auditor",
    label: "Security Auditor",
    blurb: "Investigate coverage failures and reconstruct incidents.",
    suggestedUserRole: "auditor",
    lens: {
      entrySurface: "audit_existing",
      primaryVerb: "Audit",
      entryCtaCopy: "Open a site for audit or incident review",
      defaultViewMode: "replay",
      defaultWorkspacePreset: "replay",
      defaultReadPosture: "read_write",
      suggestedStarterSceneId: null,
      foregroundedTool: "adversarial_path",
      defaultBottomTab: "timeline",
      primaryOutput: "coverage_failure_report",
      defaultExportFormat: "pdf",
      vocabularySet: "auditor",
      suggestedStaircaseRung: 4,
    },
  },
  {
    id: "operator",
    label: "Facility Manager",
    blurb: "Monitor your sites' security posture over time.",
    suggestedUserRole: "operator",
    lens: {
      entrySurface: "monitor_portfolio",
      primaryVerb: "Monitor",
      entryCtaCopy: "Check your sites' security posture",
      defaultViewMode: "map",
      defaultWorkspacePreset: "coverage",
      defaultReadPosture: "read_write",
      suggestedStarterSceneId: null,
      foregroundedTool: "coverage_temporal",
      defaultBottomTab: "metrics",
      primaryOutput: "risk_digest",
      defaultExportFormat: "html",
      vocabularySet: "operator",
      suggestedStaircaseRung: 2,
    },
  },
  {
    id: "insurer",
    label: "Insurance / Compliance",
    blurb: "Review attested, standards-compliant coverage reports.",
    suggestedUserRole: "insurer",
    lens: {
      entrySurface: "review_attestations",
      primaryVerb: "Attest",
      entryCtaCopy: "Review attested coverage reports",
      defaultViewMode: "report",
      defaultWorkspacePreset: "report",
      defaultReadPosture: "read_only",
      suggestedStarterSceneId: null,
      foregroundedTool: "attestation",
      defaultBottomTab: "report",
      primaryOutput: "compliance_attestation",
      defaultExportFormat: "pdf",
      vocabularySet: "insurer",
      suggestedStaircaseRung: 3,
    },
  },
] as const;

export const DEFAULT_JOB_ID: JobId = "installer";

export function getJobById(id: JobId | string): Job | undefined {
  return JOB_CATALOG.find((j) => j.id === id);
}
