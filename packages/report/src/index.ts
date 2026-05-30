export { buildRedundancyMatrixReport } from "./redundancy-matrix";
export type {
  RedundancyMatrixZoneRow,
  RedundancyMatrixCameraZone,
  RedundancyMatrixCameraRow,
  RedundancyMatrixReport,
} from "./redundancy-matrix";

export type ReportAudience = "operator" | "auditor" | "insurer" | "installer" | "privacy_reviewer";
export type ReportVisibility = "internal" | "shared" | "privacy_safe";
export type ReportStandardTemplateId =
  | "general-audit"
  | "installer-proposal"
  | "insurer-brief"
  | "privacy-review"
  | "oodpcvs-audit"
  | "dori-audit";

export type ReportExportPreset = {
  id: string;
  title: string;
  audience: ReportAudience;
  visibility: ReportVisibility;
  templateId: ReportStandardTemplateId;
  summary: string;
};

export type ReportData = any;
export type CompareReportData = any;

const AUDIENCE_META: Record<ReportAudience, {
  label: string;
  summary: string;
  framing: string;
  disclosureLevel: "full_internal" | "partner_shared" | "privacy_safe";
  disclosureSummary: string;
  visibleSections: string[];
  withheldSections: string[];
}> = {
  operator: {
    label: "Operator",
    summary: "Operational report for daily security teams.",
    framing: "Operational readiness and immediate actions.",
    disclosureLevel: "full_internal",
    disclosureSummary: "Complete operational detail retained.",
    visibleSections: ["coverage", "issues", "counterfactual", "timeline", "provenance"],
    withheldSections: [],
  },
  auditor: {
    label: "Auditor",
    summary: "Controls, evidence, and standards compliance framing.",
    framing: "Evidence-backed compliance posture.",
    disclosureLevel: "partner_shared",
    disclosureSummary: "Sensitive implementation details reduced.",
    visibleSections: ["coverage", "issues", "assumptions", "provenance"],
    withheldSections: ["credentials", "internal_only_notes"],
  },
  insurer: {
    label: "Insurer",
    summary: "Risk exposure summary with mitigation priorities.",
    framing: "Risk and mitigation delta with accountability trail.",
    disclosureLevel: "partner_shared",
    disclosureSummary: "Business-sensitive detail condensed.",
    visibleSections: ["coverage", "issues", "recommendations", "before_after"],
    withheldSections: ["internal_only_notes"],
  },
  installer: {
    label: "Installer",
    summary: "Implementation-focused install and commissioning handoff.",
    framing: "Implementation packet for field execution.",
    disclosureLevel: "partner_shared",
    disclosureSummary: "Install-relevant detail prioritized.",
    visibleSections: ["recommendations", "camera_matrix", "zones", "commissioning"],
    withheldSections: ["internal_only_notes"],
  },
  privacy_reviewer: {
    label: "Privacy Reviewer",
    summary: "Privacy-safe summary for governance review.",
    framing: "Privacy and governance-safe evidence digest.",
    disclosureLevel: "privacy_safe",
    disclosureSummary: "Personal/sensitive details redacted.",
    visibleSections: ["coverage_summary", "privacy_zones", "governance"],
    withheldSections: ["identifiable_media", "credentials", "internal_only_notes"],
  },
};

const VISIBILITY_META: Record<ReportVisibility, { label: string; summary: string; framing: string }> = {
  internal: {
    label: "Internal",
    summary: "Full internal workspace context and evidence.",
    framing: "Unredacted internal operating mode.",
  },
  shared: {
    label: "Shared",
    summary: "Partner-shareable with sensitive internal details reduced.",
    framing: "Externally shareable with operational redactions.",
  },
  privacy_safe: {
    label: "Privacy Safe",
    summary: "Strict redaction profile for external disclosure.",
    framing: "Maximum privacy preservation and minimal disclosure.",
  },
};

const TEMPLATE_META: Record<ReportStandardTemplateId, { title: string; summary: string }> = {
  "general-audit": { title: "General Audit", summary: "Default comprehensive security audit narrative." },
  "installer-proposal": { title: "Installer Proposal", summary: "Install-focused recommendations and billable scope." },
  "insurer-brief": { title: "Insurer Brief", summary: "Risk and mitigation delta summary for underwriting." },
  "privacy-review": { title: "Privacy Review", summary: "Privacy-governance framing with controlled evidence." },
  "oodpcvs-audit": { title: "OODPCVS Audit", summary: "IEC 62676-4:2025 OODPCVS-aligned audit framing." },
  "dori-audit": { title: "DORI Audit", summary: "Legacy DORI-aligned audit framing." },
};

export function getReportAudienceProfile(audience: ReportAudience) {
  return { id: audience, ...AUDIENCE_META[audience] };
}

export function getReportVisibilityProfile(visibility: ReportVisibility) {
  return { id: visibility, ...VISIBILITY_META[visibility] };
}

export function getReportStandardTemplateProfile(templateId: ReportStandardTemplateId) {
  return { id: templateId, ...TEMPLATE_META[templateId] };
}

export function getReportStandardTemplates() {
  return Object.entries(TEMPLATE_META).map(([id, value]) => ({ id: id as ReportStandardTemplateId, ...value }));
}

export function getReportExportPresets(): ReportExportPreset[] {
  return [
    {
      id: "preset-operator-internal",
      title: "Operator Internal",
      audience: "operator",
      visibility: "internal",
      templateId: "general-audit",
      summary: "Full internal operator audit report.",
    },
    {
      id: "preset-installer-shared",
      title: "Installer Shared",
      audience: "installer",
      visibility: "shared",
      templateId: "installer-proposal",
      summary: "Installer-friendly shared implementation report.",
    },
    {
      id: "preset-privacy-safe",
      title: "Privacy Safe",
      audience: "privacy_reviewer",
      visibility: "privacy_safe",
      templateId: "privacy-review",
      summary: "Redacted privacy-safe compliance report.",
    },
  ];
}

export function buildReportData(scene: any, simulationResult: any, options?: any): ReportData {
  return {
    sceneId: scene?.id ?? "scene",
    sceneName: scene?.name ?? "Untitled Scene",
    createdAt: Date.now(),
    simulation: simulationResult ?? null,
    options: options ?? {},
    findings: [],
    recommendations: [],
    summary: {
      coveragePct: typeof simulationResult?.totalCoveragePct === "number" ? simulationResult.totalCoveragePct : 0,
    },
  };
}

export function buildCompareReportData(sceneA: any, resultA: any, sceneB: any, resultB: any, options?: any): CompareReportData {
  return {
    before: buildReportData(sceneA, resultA),
    after: buildReportData(sceneB, resultB),
    options: options ?? {},
    deltas: {
      totalCoveragePctDelta: (resultB?.totalCoveragePct ?? 0) - (resultA?.totalCoveragePct ?? 0),
    },
    zoneChanges: [],
  };
}

export function applyReportVisibility<T>(report: T, _visibility: ReportVisibility): T {
  return report;
}

export function exportAsMarkdown(report: any): string {
  return `# SentinelTwin Report\n\nScene: ${report?.sceneName ?? "Untitled Scene"}`;
}

export function exportAsHtml(report: any): string {
  return `<html><body><h1>SentinelTwin Report</h1><p>Scene: ${report?.sceneName ?? "Untitled Scene"}</p></body></html>`;
}

export function exportAsText(report: any): string {
  return `SentinelTwin Report\nScene: ${report?.sceneName ?? "Untitled Scene"}`;
}

export function exportCompareAsMarkdown(compare: any): string {
  return `# SentinelTwin Compare\n\nCoverage delta: ${compare?.deltas?.totalCoveragePctDelta ?? 0}`;
}

export function exportCompareAsHtml(compare: any, _visuals?: any): string {
  return `<html><body><h1>SentinelTwin Compare</h1><p>Coverage delta: ${compare?.deltas?.totalCoveragePctDelta ?? 0}</p></body></html>`;
}
