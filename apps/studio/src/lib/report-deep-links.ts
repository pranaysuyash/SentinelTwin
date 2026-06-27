import type { ReportSection } from "@/schema/report-document";

const REPORT_SECTION_VIEW_MAP: Record<ReportSection, { viewMode: string; bottomTab: string; preset: string } | null> = {
  summary: { viewMode: "map", bottomTab: "metrics", preset: "coverage" },
  zone_analysis: { viewMode: "map", bottomTab: "metrics", preset: "coverage" },
  camera_analysis: { viewMode: "camera", bottomTab: "metrics", preset: "coverage" },
  recommendations: { viewMode: "map", bottomTab: "issues", preset: "coverage" },
  coverage_results: { viewMode: "map", bottomTab: "metrics", preset: "coverage" },
  site_overview: { viewMode: "map", bottomTab: "metrics", preset: "coverage" },
  temporal_twin: { viewMode: "map", bottomTab: "timeline", preset: "temporal" },
  operational_evidence: { viewMode: "map", bottomTab: "intelligence", preset: "evidence" },
  truth_ladder: { viewMode: "map", bottomTab: "governance", preset: "truth" },
  provenance: { viewMode: "map", bottomTab: "governance", preset: "provenance" },
  assumptions: { viewMode: "map", bottomTab: "metrics", preset: "coverage" },
  privacy_review: null,
  causal_trace: { viewMode: "map", bottomTab: "intelligence", preset: "evidence" },
  privacy_masking: null,
};

export function buildReportSectionDeepLink(
  sceneId: string,
  section: ReportSection,
  reportId?: string,
): string {
  const target = REPORT_SECTION_VIEW_MAP[section];
  if (!target) return "";

  const params = new URLSearchParams({
    viewMode: target.viewMode,
    bottomTab: target.bottomTab,
    workspacePreset: target.preset,
    reportSection: section,
  });
  if (reportId) params.set("reportId", reportId);

  return `?${params.toString()}`;
}

export function parseReportSectionDeepLink(
  searchParams: URLSearchParams,
): { section: ReportSection | null; viewMode: string | null; bottomTab: string | null; preset: string | null; reportId: string | null } {
  const section = searchParams.get("reportSection") as ReportSection | null;
  const viewMode = searchParams.get("viewMode");
  const bottomTab = searchParams.get("bottomTab");
  const preset = searchParams.get("workspacePreset");
  const reportId = searchParams.get("reportId");
  return { section, viewMode, bottomTab, preset, reportId };
}

export function getReportSectionLabel(section: ReportSection): string {
  const labels: Record<ReportSection, string> = {
    summary: "Summary",
    zone_analysis: "Zone Analysis",
    camera_analysis: "Camera Analysis",
    recommendations: "Recommendations",
    coverage_results: "Coverage Results",
    site_overview: "Site Overview",
    temporal_twin: "Temporal Twin",
    operational_evidence: "Operational Evidence",
    truth_ladder: "Truth Ladder",
    provenance: "Provenance",
    assumptions: "Assumptions",
    privacy_review: "Privacy Review",
    causal_trace: "Causal Trace",
    privacy_masking: "Privacy Masking",
  };
  return labels[section] ?? section;
}
