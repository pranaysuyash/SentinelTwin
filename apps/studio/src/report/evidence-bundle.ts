import type { ReportData } from "@sentineltwin/report";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";

export function buildEvidenceBundleJson(report: ReportData, scene: SecurityScene, simulation: SimulationResult) {
  return {
    metadata: {
      generatedAt: report.createdAt,
      sceneId: report.sceneId,
      title: report.title,
      audience: report.audience,
    },
    scene: scene,
    simulation: simulation,
    provenance: report.provenance,
    truthLadder: report.truthLadder,
    evidenceTrail: report.evidenceTrail,
    temporalTwin: report.temporalTwin,
    assumptions: scene.assumptions,
    truthChecks: {
      forensicGuarantees: false,
      truthChecksPassed: scene.snapshots !== undefined && scene.snapshots.length > 0
    }
  };
}
