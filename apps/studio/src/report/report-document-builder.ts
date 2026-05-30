import type { ReportDocument } from "@/schema/report-document";
import type { ReportData } from "@sentineltwin/report";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import { buildEvidenceBundleJson } from "./evidence-bundle";
import type { SiteTwinDraft } from "@/lib/site-compiler";
import type { SecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";

export function createReportDocument(
  reportData: ReportData,
  scene: SecurityScene,
  simulation: SimulationResult,
  siteTwinDraft?: SiteTwinDraft,
  securityOutcome?: SecurityOutcomeModel
): ReportDocument {
  return {
    id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    title: reportData.title,
    sceneId: reportData.sceneId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    audience: reportData.audience,
    visibility: reportData.visibility,
    status: "draft",
    sections: [
      "site_overview",
      "provenance",
      "assumptions",
      "coverage_results",
      "privacy_review",
      "summary",
      "truth_ladder",
      "operational_evidence",
      "causal_trace",
      "zone_analysis",
      "camera_analysis",
      "temporal_twin",
      "recommendations",
      "privacy_masking"
    ],
    visualArtifacts: ["heatmap", "cones", "view"],
    sceneSnapshot: scene,
    simulationSnapshot: simulation,
    securityOutcomeSnapshot: securityOutcome,
    siteTwinDraftSnapshot: siteTwinDraft,
    evidenceBundleJson: buildEvidenceBundleJson(reportData, scene, simulation),
    forensicGuarantees: false,
    truthChecksPassed: scene.snapshots !== undefined && scene.snapshots.length > 0,
  };
}
