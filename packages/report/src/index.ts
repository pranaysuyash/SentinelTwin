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

const AUDIENCE_META: Record<ReportAudience, { label: string; summary: string }> = {
  operator: { label: "Operator", summary: "Operational report for daily security teams." },
  auditor: { label: "Auditor", summary: "Controls, evidence, and standards compliance framing." },
  insurer: { label: "Insurer", summary: "Risk exposure summary with mitigation priorities." },
  installer: { label: "Installer", summary: "Implementation-focused install and commissioning handoff." },
  privacy_reviewer: { label: "Privacy Reviewer", summary: "Privacy-safe summary for governance review." },
};

const VISIBILITY_META: Record<ReportVisibility, { label: string; summary: string }> = {
  internal: { label: "Internal", summary: "Full internal workspace context and evidence." },
  shared: { label: "Shared", summary: "Partner-shareable with sensitive internal details reduced." },
  privacy_safe: { label: "Privacy Safe", summary: "Strict redaction profile for external disclosure." },
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
