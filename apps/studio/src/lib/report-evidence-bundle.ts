import type { CompareReportData, ReportData } from "@/report";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";

export type ReportEvidenceBundleVersion = "1";

export type ReportEvidenceBundle = {
  version: ReportEvidenceBundleVersion;
  exportedAt: string;
  source: "studio";
  mode: "single" | "compare";
  scene: {
    id: string;
    name: string;
    source: SecurityScene["source"];
  };
  evidenceTrail: ReportData["evidenceTrail"];
  report: ReportData;
  simulationResult: SimulationResult | null;
  compare?: CompareReportData;
  visualEvidence?: {
    beforeImageDataUrl?: string;
    afterImageDataUrl?: string;
  };
  notes: string[];
};

export function buildReportEvidenceBundle(input: {
  scene: SecurityScene;
  report: ReportData;
  simulationResult: SimulationResult | null;
  compare?: CompareReportData;
  visualEvidence?: {
    beforeImageDataUrl?: string;
    afterImageDataUrl?: string;
  };
  notes?: string[];
}): ReportEvidenceBundle {
  return {
    version: "1",
    exportedAt: new Date().toISOString(),
    source: "studio",
    mode: input.compare ? "compare" : "single",
    scene: {
      id: input.scene.id,
      name: input.scene.name,
      source: input.scene.source,
    },
    evidenceTrail: structuredClone(input.report.evidenceTrail),
    report: structuredClone(input.report),
    simulationResult: input.simulationResult ? structuredClone(input.simulationResult) : null,
    compare: input.compare ? structuredClone(input.compare) : undefined,
    visualEvidence: input.visualEvidence
      ? {
          beforeImageDataUrl: input.visualEvidence.beforeImageDataUrl,
          afterImageDataUrl: input.visualEvidence.afterImageDataUrl,
        }
      : undefined,
    notes: input.notes?.length ? [...input.notes] : [
      "Report evidence bundle exported from the SentinelTwin studio workspace.",
      "Use this bundle to carry the scene, report, and evidence trail together for handoff or archival review.",
    ],
  };
}

export function stringifyReportEvidenceBundle(bundle: ReportEvidenceBundle) {
  return JSON.stringify(bundle, null, 2);
}
