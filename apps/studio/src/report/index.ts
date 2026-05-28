import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import { buildSceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { computeCoveragePostureVariation } from "@/simulation/coverage-posture";
import { computeCoverageUncertainty } from "@/simulation/coverage-uncertainty";
import { buildRedundancyMatrixReport, type RedundancyMatrixReport } from "./redundancy-matrix";

type ReportScene = SecurityScene;
// ── Report Data Interface ──

export interface ReportData {
  title: string;
  siteName: string;
  generatedAt: number;
  sceneName: string;
  dimensions: { width: number; depth: number; height: number };
  assumptions: {
    doriStandard: string;
    personHeightM: number;
    vehicleHeightM: number;
    timeOfDay: string;
    ppm: { detection: number; observation: number; recognition: number; identification: number };
  };
  summary: {
    totalCoveragePct: number;
    blindspotPct: number;
    recognitionAreaPct: number;
    identificationAreaPct: number;
    averageWalkableQuality: number;
    worstAreaQuality: string;
    zonesPassing: number;
    zonesTotal: number;
    issuesCount: number;
    recommendationsCount: number;
    verifiedRecommendationsCount: number;
  };
  zones: {
    label: string;
    requiredQuality: string;
    actualQuality: string;
    status: "pass" | "fail" | "warning";
    coveringCameras: string[];
    coveragePct: number;
  }[];
  cameras: {
    id: string;
    name: string;
    status: string;
    coveragePct: number;
    zonesCovered: string[];
    issues: string[];
  }[];
  redundancyMatrix?: RedundancyMatrixReport;
  issues: { severity: string; description: string; area: string; recommendation: string }[];
  recommendations: { description: string; costCategory: string; verified: boolean; estimatedImpact: string }[];
  provenance: {
    sceneSource: string;
    sceneSourceLabel: string;
    sourceCounts: Record<string, number>;
    nodeCount: number;
    edgeCount: number;
    revisionDepth: number;
    snapshotCount: number;
    confidenceNotes: string[];
    sourceNotes: string[];
  };
  adversarialPath?: {
    exposureScore: number;
    detectionProbability: number;
    totalDistance: number;
    waypoints: { x: number; z: number; exposure: number }[];
  };
  temporalProfile?: {
    vulnerabilityWindowCount: number;
    safestPeriods: { startHour: number; endHour: number; label: string }[];
    worstCoverage: number;
  };
  novelAlgorithms?: {
    coverageFragility?: {
      meanFragility: number;
      fragileCellCount: number;
      robustCellCount: number;
      totalCells: number;
    };
    coverageUncertainty?: {
      sampleCount: number;
      meanCoveragePct: number;
      p5CoveragePct: number;
      p95CoveragePct: number;
      worstZoneLabel: string | null;
      worstZonePassRate: number | null;
    };
    postureVariation?: {
      baselineProfileLabel: string;
      profiles: {
        profileId: string;
        label: string;
        targetHeightM: number;
        description: string;
        totalCoveragePct: number;
        blindspotPct: number;
        recognitionAreaPct: number;
        identificationAreaPct: number;
        averageWalkableQuality: number;
        zonesPassing: number;
        zonesTotal: number;
        worstZoneLabel: string | null;
        worstZoneStatus: "pass" | "fail" | null;
        worstZoneActualQuality: string | null;
        worstZoneRequiredQuality: string | null;
      }[];
      worstProfileLabel: string | null;
      worstProfileCoveragePct: number | null;
      largestDropProfileLabel: string | null;
      largestDropDeltaPct: number | null;
      worstZoneLabel: string | null;
      worstZoneProfileLabel: string | null;
    };
    kRobustness?: {
      kRobustness: number;
      totalCameras: number;
      isRobust: boolean;
      criticalSets: {
        k: number;
        cameraNames: string[];
        exposureScore: number;
        waypointCount: number;
      }[];
    };
    placementOracle?: {
      candidateCount: number;
      bestCandidateScore: number;
      bestCandidateMountType: string;
      bestCandidatePosition: [number, number, number];
    };
    temporalAnomalies?: {
      anomalyWindowCount: number;
      highSeverityCount: number;
      mediumSeverityCount: number;
      lowSeverityCount: number;
      worstCoverageDropPct: number;
      worstExposureJump: number;
    };
    occlusionBlameCount?: number;
    blindRegionCount?: number;
    blindRegions?: {
      id: string;
      areaSqM: number;
      classification: "entry_corridor" | "entry_connected" | "isolated";
      severity: "critical" | "high" | "medium" | "low";
      touchesCriticalZone: boolean;
      affectedZoneIds: string[];
      description: string;
    }[];
    blindSpotFingerprint?: {
      fingerprint: string;
      signature: string;
      regionCount: number;
      criticalRegionCount: number;
      entryConnectedRegionCount: number;
      isolatedRegionCount: number;
      totalBlindAreaSqM: number;
      largestRegionAreaSqM: number;
      affectedZoneCount: number;
      severityCounts: {
        critical: number;
        high: number;
        medium: number;
        low: number;
      };
      classificationCounts: {
        entry_corridor: number;
        entry_connected: number;
        isolated: number;
      };
    };
    reflectiveBounce?: {
      reflectiveWindowCount: number;
      affectedCellCount: number;
      affectedCameraCount: number;
    };
    occlusionBlame?: {
      zoneId: string;
      zoneLabel: string;
      baselineQuality: string;
      obstructions: {
        obstructionId: string;
        label: string;
        blameFraction: number;
        qualityWithout: string;
        qualityImprovement: number;
      }[];
    }[];
  };
  meetsModeledZoneRequirements: boolean;
  codeCompliant: boolean;
  standardsRef: string;
}

// ── Build Report Data ──

export function buildReportData(
  scene: ReportScene,
  result: SimulationResult,
  options?: {
    title?: string;
    temporalProfile?: TemporalProfileSummary;
    adversarialPath?: AdversarialPathSummary;
  },
): ReportData {
  const zonesPassing = result.criticalZoneResults.filter((z) => z.status === "pass").length;
  const totalZones = result.criticalZoneResults.length;
  const verifiedRecs = result.recommendations.filter((r) => r.verified).length;
  const meetsModeledZoneRequirements = zonesPassing === totalZones;
  const graph = buildSceneIntelligenceGraph(scene, {
    simulationResult: result,
    revisionDepth: scene.changeLog.length,
    snapshotCount: scene.snapshots?.length ?? 0,
  });
  const provenanceNotes = (scene.changeLog ?? []).filter((entry) => entry.startsWith("Provenance:") || entry.startsWith("Provenance confidence:"));
  const sourceNotes = provenanceNotes.filter((entry) => entry.startsWith("Provenance:"));
  const confidenceNotes = provenanceNotes.filter((entry) => entry.startsWith("Provenance confidence:"));
  const coverageUncertainty = computeCoverageUncertainty(scene, { sampleCount: 12 });
  const postureVariation = computeCoveragePostureVariation(scene);
  const redundancyMatrix = buildRedundancyMatrixReport(scene, result);
  if (sourceNotes.length === 0) {
    sourceNotes.push(`Provenance: ${graph.summary.sceneSourceLabel} scene derived from the canonical SecurityScene.`);
  }

  const cameraMap = new Map(scene.cameras.map((camera) => [camera.id, camera]));

  return {
    title: options?.title ?? "Security Coverage Audit Report",
    siteName: scene.name,
    generatedAt: Date.now(),
    sceneName: scene.name,
    dimensions: { width: scene.dimensions.width, depth: scene.dimensions.depth, height: scene.dimensions.height },
    assumptions: {
      doriStandard: scene.assumptions.doriStandard,
      personHeightM: scene.assumptions.personHeightM,
      vehicleHeightM: scene.assumptions.vehicleHeightM,
      timeOfDay: scene.assumptions.timeOfDay,
      ppm: { ...scene.assumptions.pixelsPerMeter },
    },
    summary: {
      totalCoveragePct: result.totalCoveragePct,
      blindspotPct: result.blindspotPct,
      recognitionAreaPct: result.recognitionAreaPct,
      identificationAreaPct: result.identificationAreaPct,
      averageWalkableQuality: result.averageWalkableQuality,
      worstAreaQuality: result.worstAreaQuality,
      zonesPassing,
      zonesTotal: totalZones,
      issuesCount: result.issues.length,
      recommendationsCount: result.recommendations.length,
      verifiedRecommendationsCount: verifiedRecs,
    },
    zones: result.criticalZoneResults.map((z) => ({
      label: z.label,
      requiredQuality: z.requiredQuality,
      actualQuality: z.actualQuality,
      status: z.status as "pass" | "fail" | "warning",
      coveringCameras: z.coveringCameras,
      coveragePct: 0,
    })),
    cameras: result.cameraResults.map((c) => ({
      id: c.cameraId,
      name: cameraMap.get(c.cameraId)?.name ?? c.cameraId,
      status: cameraMap.get(c.cameraId)?.status ?? "unknown",
      coveragePct: c.coveragePct,
      zonesCovered: c.criticalZonesCovered ?? [],
      issues: [],
    })),
    redundancyMatrix: redundancyMatrix ?? undefined,
    issues: result.issues.map((i) => ({
      severity: i.severity,
      description: i.description,
      area: i.affectedZones?.[0] ?? "general",
      recommendation: "",
    })),
    recommendations: result.recommendations.map((r) => ({
      description: r.description,
      costCategory: r.costCategory,
      verified: r.verified,
      estimatedImpact: r.estimatedImpact,
    })),
    provenance: {
      sceneSource: scene.source,
      sceneSourceLabel: graph.summary.sceneSourceLabel,
      sourceCounts: graph.summary.sourceCounts,
      nodeCount: graph.summary.nodeCount,
      edgeCount: graph.summary.edgeCount,
      revisionDepth: graph.summary.revisionDepth,
      snapshotCount: graph.summary.snapshotCount,
      confidenceNotes,
      sourceNotes,
    },
    adversarialPath: options?.adversarialPath
      ? {
          exposureScore: options.adversarialPath.exposureScore,
          detectionProbability: options.adversarialPath.detectionProbability,
          totalDistance: options.adversarialPath.totalDistance,
          waypoints: options.adversarialPath.waypoints ?? [],
        }
      : undefined,
    temporalProfile: options?.temporalProfile
      ? {
          vulnerabilityWindowCount: options.temporalProfile.vulnerabilityWindowCount,
          safestPeriods: options.temporalProfile.safestPeriods ?? [],
          worstCoverage: options.temporalProfile.worstCoverage,
        }
      : undefined,
    novelAlgorithms: {
      coverageFragility: result.fragilitySummary
        ? {
            meanFragility: result.fragilitySummary.meanFragility,
            fragileCellCount: result.fragilitySummary.fragileCellCount,
            robustCellCount: result.fragilitySummary.robustCellCount,
            totalCells: result.fragilitySummary.totalCells,
          }
        : undefined,
      coverageUncertainty: coverageUncertainty
        ? {
            sampleCount: coverageUncertainty.sampleCount,
            meanCoveragePct: coverageUncertainty.meanCoveragePct,
            p5CoveragePct: coverageUncertainty.p5CoveragePct,
            p95CoveragePct: coverageUncertainty.p95CoveragePct,
            worstZoneLabel: coverageUncertainty.worstZoneLabel,
            worstZonePassRate: coverageUncertainty.worstZonePassRate,
          }
        : undefined,
      postureVariation: postureVariation
        ? {
            baselineProfileLabel: postureVariation.baselineProfileLabel,
            profiles: postureVariation.profiles.map((profile) => ({
              profileId: profile.profileId,
              label: profile.label,
              targetHeightM: profile.targetHeightM,
              description: profile.description,
              totalCoveragePct: profile.totalCoveragePct,
              blindspotPct: profile.blindspotPct,
              recognitionAreaPct: profile.recognitionAreaPct,
              identificationAreaPct: profile.identificationAreaPct,
              averageWalkableQuality: profile.averageWalkableQuality,
              zonesPassing: profile.zonesPassing,
              zonesTotal: profile.zonesTotal,
              worstZoneLabel: profile.worstZoneLabel,
              worstZoneStatus: profile.worstZoneStatus,
              worstZoneActualQuality: profile.worstZoneActualQuality,
              worstZoneRequiredQuality: profile.worstZoneRequiredQuality,
            })),
            worstProfileLabel: postureVariation.worstProfileLabel,
            worstProfileCoveragePct: postureVariation.worstProfileCoveragePct,
            largestDropProfileLabel: postureVariation.largestDropProfileLabel,
            largestDropDeltaPct: postureVariation.largestDropDeltaPct,
            worstZoneLabel: postureVariation.worstZoneLabel,
            worstZoneProfileLabel: postureVariation.worstZoneProfileLabel,
          }
        : undefined,
      kRobustness: result.kRobustness
        ? {
            kRobustness: result.kRobustness.kRobustness,
            totalCameras: result.kRobustness.totalCameras,
            isRobust: result.kRobustness.isRobust,
            criticalSets: result.kRobustness.criticalSets.map((set) => ({
              k: set.k,
              cameraNames: set.cameraNames,
              exposureScore: set.exposureScore,
              waypointCount: set.waypointCount,
            })),
          }
        : undefined,
      placementOracle: result.placementOracle?.bestCandidate
        ? {
            candidateCount: result.placementOracle.candidateCount,
            bestCandidateScore: result.placementOracle.bestCandidate.score,
            bestCandidateMountType: result.placementOracle.bestCandidate.mountType,
            bestCandidatePosition: result.placementOracle.bestCandidate.position,
          }
        : undefined,
      temporalAnomalies: options?.temporalProfile
        ? {
            anomalyWindowCount: options.temporalProfile.vulnerabilityWindowCount,
            highSeverityCount: 0,
            mediumSeverityCount: 0,
            lowSeverityCount: 0,
            worstCoverageDropPct: options.temporalProfile.worstCoverage,
            worstExposureJump: 0,
          }
        : undefined,
      occlusionBlameCount: result.occlusionBlame?.length ?? 0,
      blindRegionCount: result.blindRegions?.length ?? 0,
      blindRegions: result.blindRegions?.map((region) => ({
        id: region.id,
        areaSqM: region.areaSqM,
        classification: region.classification,
        severity: region.severity,
        touchesCriticalZone: region.touchesCriticalZone,
        affectedZoneIds: region.affectedZoneIds,
        description: region.description,
      })),
      blindSpotFingerprint: result.blindSpotFingerprint
        ? {
            fingerprint: result.blindSpotFingerprint.fingerprint,
            signature: result.blindSpotFingerprint.signature,
            regionCount: result.blindSpotFingerprint.regionCount,
            criticalRegionCount: result.blindSpotFingerprint.criticalRegionCount,
            entryConnectedRegionCount: result.blindSpotFingerprint.entryConnectedRegionCount,
            isolatedRegionCount: result.blindSpotFingerprint.isolatedRegionCount,
            totalBlindAreaSqM: result.blindSpotFingerprint.totalBlindAreaSqM,
            largestRegionAreaSqM: result.blindSpotFingerprint.largestRegionAreaSqM,
            affectedZoneCount: result.blindSpotFingerprint.affectedZoneCount,
            severityCounts: result.blindSpotFingerprint.severityCounts,
            classificationCounts: result.blindSpotFingerprint.classificationCounts,
          }
        : undefined,
      reflectiveBounce: result.reflectiveBounce
        ? {
            reflectiveWindowCount: result.reflectiveBounce.reflectiveWindowCount,
            affectedCellCount: result.reflectiveBounce.affectedCellCount,
            affectedCameraCount: result.reflectiveBounce.affectedCameraCount,
          }
        : undefined,
      occlusionBlame: result.occlusionBlame?.map((zone) => ({
        zoneId: zone.zoneId,
        zoneLabel: zone.zoneLabel,
        baselineQuality: zone.baselineQuality,
        obstructions: zone.obstructions.map((obstruction) => ({
          obstructionId: obstruction.obstructionId,
          label: obstruction.label,
          blameFraction: obstruction.blameFraction,
          qualityWithout: obstruction.qualityWithout,
          qualityImprovement: obstruction.qualityImprovement,
        })),
      })),
    },
    meetsModeledZoneRequirements,
    codeCompliant: meetsModeledZoneRequirements,
    standardsRef:
      scene.assumptions.doriStandard === "oodpcvs_2025"
        ? "IEC 62676-4:2025 (OODPCVS)"
        : "DORI 2014 (IEC 62676-4:2014)",
  };
}

interface TemporalProfileSummary {
  vulnerabilityWindowCount: number;
  safestPeriods: { startHour: number; endHour: number; label: string }[];
  worstCoverage: number;
}

interface AdversarialPathSummary {
  exposureScore: number;
  detectionProbability: number;
  totalDistance: number;
  waypoints?: { x: number; z: number; exposure: number }[];
}

// ── Compare Report ──

export interface CompareReportData {
  before: ReportData;
  after: ReportData;
  deltas: {
    totalCoveragePctDelta: number;
    blindspotPctDelta: number;
    recognitionAreaPctDelta: number;
    identificationAreaPctDelta: number;
    zonesPassedDelta: number;
    issuesDelta: number;
    recommendationsDelta: number;
  };
  zoneChanges: { label: string; beforeStatus: string; afterStatus: string; changed: boolean }[];
}

export function buildCompareReportData(
  beforeScene: ReportScene,
  beforeResult: SimulationResult,
  afterScene: ReportScene,
  afterResult: SimulationResult,
): CompareReportData {
  const before = buildCompareReportSnapshot(beforeScene, beforeResult);
  const after = buildCompareReportSnapshot(afterScene, afterResult);

  const zoneChanges = before.zones.map((z) => {
    const afterZone = after.zones.find((az) => az.label === z.label);
    return {
      label: z.label,
      beforeStatus: z.status,
      afterStatus: afterZone?.status ?? "unknown",
      changed: z.status !== afterZone?.status,
    };
  });

  return {
    before,
    after,
    deltas: {
      totalCoveragePctDelta: Number((after.summary.totalCoveragePct - before.summary.totalCoveragePct).toFixed(1)),
      blindspotPctDelta: Number((after.summary.blindspotPct - before.summary.blindspotPct).toFixed(1)),
      recognitionAreaPctDelta: Number((after.summary.recognitionAreaPct - before.summary.recognitionAreaPct).toFixed(1)),
      identificationAreaPctDelta: Number((after.summary.identificationAreaPct - before.summary.identificationAreaPct).toFixed(1)),
      zonesPassedDelta: after.summary.zonesPassing - before.summary.zonesPassing,
      issuesDelta: after.summary.issuesCount - before.summary.issuesCount,
      recommendationsDelta: after.summary.recommendationsCount - before.summary.recommendationsCount,
    },
    zoneChanges,
  };
}

function buildCompareReportSnapshot(scene: ReportScene, result: SimulationResult): ReportData {
  const anyResult = result as any;
  const zonesPassing = anyResult.criticalZoneResults.filter((z: any) => z.status === "pass").length;
  const totalZones = anyResult.criticalZoneResults.length;
  const verifiedRecs = anyResult.recommendations.filter((r: any) => r.verified).length;
  const graph = buildSceneIntelligenceGraph(scene, {
    simulationResult: result,
    revisionDepth: scene.changeLog.length,
    snapshotCount: scene.snapshots?.length ?? 0,
  });
  const provenanceNotes = (scene.changeLog ?? []).filter((entry) => entry.startsWith("Provenance:") || entry.startsWith("Provenance confidence:"));
  const sourceNotes = provenanceNotes.filter((entry) => entry.startsWith("Provenance:"));
  const confidenceNotes = provenanceNotes.filter((entry) => entry.startsWith("Provenance confidence:"));
  if (sourceNotes.length === 0) {
    sourceNotes.push(`Provenance: ${graph.summary.sceneSourceLabel} scene derived from the canonical SecurityScene.`);
  }

  const cameraMap = new Map(scene.cameras.map((camera) => [camera.id, camera]));

  return {
    title: "Security Coverage Audit Report",
    siteName: scene.name,
    generatedAt: Date.now(),
    sceneName: scene.name,
    dimensions: { width: scene.dimensions.width, depth: scene.dimensions.depth, height: scene.dimensions.height },
    assumptions: {
      doriStandard: scene.assumptions.doriStandard,
      personHeightM: scene.assumptions.personHeightM,
      vehicleHeightM: scene.assumptions.vehicleHeightM,
      timeOfDay: scene.assumptions.timeOfDay,
      ppm: { ...scene.assumptions.pixelsPerMeter },
    },
    summary: {
      totalCoveragePct: result.totalCoveragePct,
      blindspotPct: result.blindspotPct,
      recognitionAreaPct: result.recognitionAreaPct,
      identificationAreaPct: result.identificationAreaPct,
      averageWalkableQuality: result.averageWalkableQuality,
      worstAreaQuality: result.worstAreaQuality,
      zonesPassing,
      zonesTotal: totalZones,
      issuesCount: result.issues.length,
      recommendationsCount: result.recommendations.length,
      verifiedRecommendationsCount: verifiedRecs,
    },
    zones: anyResult.criticalZoneResults.map((z: any) => ({
      label: z.label,
      requiredQuality: z.requiredQuality,
      actualQuality: z.actualQuality,
      status: z.status as "pass" | "fail" | "warning",
      coveringCameras: (z.coveringCameras ?? []).map((id: string) => cameraMap.get(id)?.name ?? id),
      coveragePct: 0,
    })),
    cameras: anyResult.cameraResults.map((c: any) => ({
      id: c.cameraId,
      name: cameraMap.get(c.cameraId)?.name ?? c.cameraId,
      status: cameraMap.get(c.cameraId)?.status ?? "unknown",
      coveragePct: c.coveragePct,
      zonesCovered: c.criticalZonesCovered ?? [],
      issues: [],
    })),
    issues: anyResult.issues.map((i: any) => ({
      severity: i.severity,
      description: i.description,
      area: i.category,
      recommendation: i.description,
    })),
    recommendations: anyResult.recommendations.map((r: any) => ({
      description: r.description,
      costCategory: r.costCategory,
      verified: r.verified,
      estimatedImpact: r.estimatedImpact,
    })),
    provenance: {
      sceneSource: scene.source,
      sceneSourceLabel: graph.summary.sceneSourceLabel,
      sourceCounts: graph.summary.sourceCounts,
      nodeCount: graph.summary.nodeCount,
      edgeCount: graph.summary.edgeCount,
      revisionDepth: graph.summary.revisionDepth,
      snapshotCount: graph.summary.snapshotCount,
      confidenceNotes,
      sourceNotes,
    },
    novelAlgorithms: undefined,
    meetsModeledZoneRequirements: zonesPassing === totalZones,
    codeCompliant: zonesPassing === totalZones,
    standardsRef: `${scene.assumptions.doriStandard === "oodpcvs_2025" ? "IEC 62676-4:2025 (OODPCVS)" : "DORI 2014"} planning estimate`,
  };
}

// ── Export Helpers ──

export function exportAsHtml(report: ReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.title)} — ${escapeHtml(report.siteName)}</title>
  <style>
    @page { margin: 20mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    .cover { text-align: center; padding: 60px 0 40px; page-break-after: always; }
    .cover h1 { font-size: 26pt; margin-bottom: 8px; }
    .cover .subtitle { font-size: 11pt; color: #64748b; margin-bottom: 24px; }
    .cover .meta { font-size: 10pt; color: #94a3b8; }
    .cover .standards-badge {
      display: inline-block;
      border: 1px solid #2563eb;
      color: #2563eb;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 9pt;
      margin-top: 16px;
    }
    h2 { font-size: 14pt; margin-top: 28px; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #1e293b; page-break-after: avoid; }
    h3 { font-size: 11pt; margin-top: 18px; margin-bottom: 6px; color: #334155; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .summary-card .value { font-size: 18pt; font-weight: 700; }
    .summary-card .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; margin-top: 3px; }
    .issue { padding: 10px 12px; margin: 6px 0; border-radius: 6px; font-size: 10pt; page-break-inside: avoid; }
    .issue.critical { background: #fef2f2; border-left: 4px solid #ef4444; }
    .issue.high { background: #fff7ed; border-left: 4px solid #f97316; }
    .issue.medium { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .issue.low { background: #f8fafc; border-left: 4px solid #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt; page-break-inside: auto; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    tr { page-break-inside: avoid; }
    .pass { color: #16a34a; font-weight: 600; }
    .fail { color: #dc2626; font-weight: 600; }
    .warning { color: #f59e0b; font-weight: 600; }
    .rec { padding: 8px 10px; margin: 6px 0; border-radius: 6px; font-size: 10pt; page-break-inside: avoid; }
    .rec.verified { background: #f0fdf4; border-left: 3px solid #22c55e; }
    .rec.unverified { background: #fffbeb; border-left: 3px solid #f59e0b; }
    .rec.rec-cost { float: right; font-size: 8pt; color: #64748b; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; text-align: center; }
    .delta-positive { color: #16a34a; }
    .delta-negative { color: #dc2626; }
    .delta-neutral { color: #64748b; }
    .assumptions-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; font-size: 10pt; }
    .assumptions-box table { margin: 0; }
    .assumptions-box th { background: transparent; border: none; padding: 4px 8px 4px 0; width: 200px; }
    .assumptions-box td { border: none; padding: 4px 0; }
    @media print {
      body { padding: 0; }
      .cover { padding: 40px 0 20px; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(report.title)}</h1>
    <div class="subtitle">${escapeHtml(report.siteName)}</div>
    <div class="meta">
      Generated: ${new Date(report.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      &middot; ${report.dimensions.width}m × ${report.dimensions.depth}m × ${report.dimensions.height}m
    </div>
    <div class="standards-badge">${escapeHtml(report.standardsRef)}</div>
  </div>

  <h2>Executive Summary</h2>
  <p>This report evaluates the security camera coverage for <strong>${escapeHtml(report.siteName)}</strong>
  (${report.dimensions.width}m × ${report.dimensions.depth}m, ${report.cameras.length} cameras)
  using ${escapeHtml(report.standardsRef)} as a planning-oriented configuration reference.</p>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="value" style="color:${report.summary.totalCoveragePct >= 80 ? "#16a34a" : report.summary.totalCoveragePct >= 50 ? "#f59e0b" : "#dc2626"}">
        ${report.summary.totalCoveragePct.toFixed(1)}%
      </div>
      <div class="label">Total Coverage</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color:${report.summary.recognitionAreaPct >= 50 ? "#16a34a" : "#f59e0b"}">
        ${report.summary.recognitionAreaPct.toFixed(1)}%
      </div>
      <div class="label">Recognition Area</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color:${report.summary.identificationAreaPct >= 25 ? "#16a34a" : "#f59e0b"}">
        ${report.summary.identificationAreaPct.toFixed(1)}%
      </div>
      <div class="label">Identification Area</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color:${report.summary.zonesPassing === report.summary.zonesTotal ? "#16a34a" : "#dc2626"}">
        ${report.summary.zonesPassing}/${report.summary.zonesTotal}
      </div>
      <div class="label">Zones Passing</div>
    </div>
  </div>

  <h2>Assumptions</h2>
  <div class="assumptions-box">
    <table>
      <tr><th>DORI Standard</th><td>${escapeHtml(report.assumptions.doriStandard)}</td></tr>
      <tr><th>Person Height</th><td>${report.assumptions.personHeightM}m</td></tr>
      <tr><th>Vehicle Height</th><td>${report.assumptions.vehicleHeightM}m</td></tr>
      <tr><th>Time of Day</th><td>${report.assumptions.timeOfDay}</td></tr>
      <tr><th>PPM Thresholds</th><td>${report.assumptions.ppm.detection} / ${report.assumptions.ppm.observation} / ${report.assumptions.ppm.recognition} / ${report.assumptions.ppm.identification}</td></tr>
    </table>
    <p style="margin-top:10px; color:#475569;">
      Simulation outputs are planning estimates under the assumptions above and should not be interpreted
      as legal, forensic, or compliance guarantees.
    </p>
  </div>

  <h2>Provenance</h2>
  <div class="assumptions-box">
    <table>
      <tr><th>Scene Source</th><td>${escapeHtml(report.provenance.sceneSourceLabel)} (${escapeHtml(report.provenance.sceneSource)})</td></tr>
      <tr><th>Scene Graph Nodes</th><td>${report.provenance.nodeCount}</td></tr>
      <tr><th>Scene Graph Edges</th><td>${report.provenance.edgeCount}</td></tr>
      <tr><th>Revision Depth</th><td>${report.provenance.revisionDepth}</td></tr>
      <tr><th>Snapshots Tracked</th><td>${report.provenance.snapshotCount}</td></tr>
    </table>
    <div style="margin-top:10px;">
      <strong>Source counts</strong>
      <p>${Object.entries(report.provenance.sourceCounts).map(([source, count]) => `${escapeHtml(source)}: ${count}`).join(" · ")}</p>
    </div>
    ${report.provenance.sourceNotes.length > 0 ? `
    <div style="margin-top:10px;">
      <strong>Source history</strong>
      <ul style="margin-left:18px;">
        ${report.provenance.sourceNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </div>
    ` : ""}
    ${report.provenance.confidenceNotes.length > 0 ? `
    <div style="margin-top:10px;">
      <strong>Confidence history</strong>
      <ul style="margin-left:18px;">
        ${report.provenance.confidenceNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </div>
    ` : ""}
  </div>

  <h2>Zone Analysis</h2>
  ${report.zones.length > 0 ? `
  <table>
    <thead><tr><th>Zone</th><th>Required</th><th>Actual</th><th>Status</th><th>Coverage</th><th>Cameras</th></tr></thead>
    <tbody>
      ${report.zones.map((z) => `
        <tr>
          <td>${escapeHtml(z.label)}</td>
          <td>${z.requiredQuality}</td>
          <td>${z.actualQuality}</td>
          <td class="${z.status}">${z.status.toUpperCase()}</td>
          <td>${z.coveragePct.toFixed(1)}%</td>
          <td>${z.coveringCameras.join(", ") || "none"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ` : "<p>No critical zones defined.</p>"}

  <h2>Camera Analysis</h2>
  ${report.cameras.length > 0 ? `
  <table>
    <thead><tr><th>Camera</th><th>Coverage</th><th>Zones Covered</th></tr></thead>
    <tbody>
      ${report.cameras.map((c) => `
        <tr>
          <td>${escapeHtml(c.name)}</td>
          <td>${c.coveragePct.toFixed(1)}%</td>
          <td>${c.zonesCovered.join(", ") || "none"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ` : "<p>No cameras configured.</p>"}

  ${report.redundancyMatrix ? `
  <h2>Redundancy Matrix</h2>
  <p>Rows show how each camera contributes to zone coverage. Single-point zones are the cells most likely to fail if a camera goes offline.</p>
  <table>
    <thead>
      <tr><th>Cameras</th><th>Zones</th><th>Redundant</th><th>SPOF</th><th>Uncovered</th><th>Vulnerable Rows</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${report.redundancyMatrix.cameraCount}</td>
        <td>${report.redundancyMatrix.zoneCount}</td>
        <td>${report.redundancyMatrix.redundantZoneCount}</td>
        <td>${report.redundancyMatrix.spofZoneCount}</td>
        <td>${report.redundancyMatrix.uncoveredZoneCount}</td>
        <td>${report.redundancyMatrix.vulnerableZones.length}</td>
      </tr>
    </tbody>
  </table>
  ${report.redundancyMatrix.vulnerableZones.length > 0 ? `
  <h3>Vulnerable Zones</h3>
  <table>
    <thead><tr><th>Zone</th><th>Status</th><th>Cameras</th></tr></thead>
    <tbody>
      ${report.redundancyMatrix.vulnerableZones.map((zone) => `
        <tr>
          <td>${escapeHtml(zone.label)}</td>
          <td>${escapeHtml(zone.status.replace(/_/g, " "))}</td>
          <td>${zone.coveringCameraNames.length > 0 ? zone.coveringCameraNames.map((name) => escapeHtml(name)).join(", ") : "none"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ` : ""}
  <table>
    <thead><tr><th>Camera</th><th>Status</th><th>Coverage</th><th>Criticality</th><th>Single-point zones</th><th>Covered zones</th></tr></thead>
    <tbody>
      ${report.redundancyMatrix.cameraRows.map((row) => `
        <tr>
          <td>${escapeHtml(row.cameraName)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${row.coveragePct.toFixed(1)}%</td>
          <td>${escapeHtml(row.criticalityLabel)} (${row.criticalityScore}/10)</td>
          <td>${row.soleCoverageZones.map((zone) => escapeHtml(zone.label)).join(", ") || "none"}</td>
          <td>${row.coveredZones.map((zone) => escapeHtml(zone.label + (zone.isSole ? " ⚠" : ""))).join(", ") || "none"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ` : ""}

  <h2>Issues Found (${report.issues.length})</h2>
  ${report.issues.length > 0
    ? report.issues.map((i) => `
      <div class="issue ${i.severity}">
        <strong>${i.severity.toUpperCase()}</strong>: ${escapeHtml(i.description)}
        ${i.recommendation ? `<br><small>Recommendation: ${escapeHtml(i.recommendation)}</small>` : ""}
      </div>
    `).join("")
    : "<p>No issues found. Coverage meets all defined requirements.</p>"}

  <h2>Recommendations (${report.recommendations.length})</h2>
  ${report.recommendations.length > 0
    ? report.recommendations.map((r) => `
      <div class="rec ${r.verified ? "verified" : "unverified"}">
        <strong>${r.verified ? "✓" : "○"} ${escapeHtml(r.description)}</strong>
        <span class="rec-cost">${r.costCategory} cost</span>
        <br><small>${escapeHtml(r.estimatedImpact)}</small>
      </div>
    `).join("")
    : "<p>No recommendations at this time.</p>"}

  ${report.temporalProfile ? `
  <h2>Temporal Security Profile</h2>
  <p>Coverage varies across the 24-hour cycle due to lighting and occupancy changes.</p>
  <table>
    <tr><th>Vulnerability Windows</th><td>${report.temporalProfile.vulnerabilityWindowCount}</td></tr>
    <tr><th>Worst Coverage</th><td>${report.temporalProfile.worstCoverage.toFixed(1)}%</td></tr>
    ${report.temporalProfile.safestPeriods.length > 0 ? `
    <tr><th>Safest Periods</th><td>${report.temporalProfile.safestPeriods.map((p) => `${formatHour(p.startHour)}–${formatHour(p.endHour)}`).join(", ")}</td></tr>
    ` : ""}
  </table>
  ` : ""}

  ${report.adversarialPath ? `
  <h2>Coverage Failure Replay</h2>
  <p>Defensive coverage-failure route analysis under current assumptions (hardening aid, not attacker guidance).</p>
  <table>
    <tr><th>Exposure Score</th><td>${report.adversarialPath.exposureScore.toFixed(1)}</td></tr>
    <tr><th>Detection Probability</th><td>${(report.adversarialPath.detectionProbability * 100).toFixed(0)}%</td></tr>
    <tr><th>Path Distance</th><td>${report.adversarialPath.totalDistance.toFixed(1)}m</td></tr>
  </table>
  ` : ""}

  ${report.novelAlgorithms ? `
  <h2>Novel Algorithms</h2>
  <table>
    <tr><th>Coverage Fragility</th><td>${report.novelAlgorithms.coverageFragility ? `${(report.novelAlgorithms.coverageFragility.meanFragility * 100).toFixed(1)}% mean · ${report.novelAlgorithms.coverageFragility.fragileCellCount}/${report.novelAlgorithms.coverageFragility.totalCells} fragile cells` : "Not computed"}</td></tr>
    <tr><th>Coverage Uncertainty</th><td>${report.novelAlgorithms.coverageUncertainty ? `${report.novelAlgorithms.coverageUncertainty.sampleCount} samples · ${report.novelAlgorithms.coverageUncertainty.meanCoveragePct.toFixed(1)}% mean (${report.novelAlgorithms.coverageUncertainty.p5CoveragePct.toFixed(1)}%–${report.novelAlgorithms.coverageUncertainty.p95CoveragePct.toFixed(1)}%)` : "Not computed"}</td></tr>
    <tr><th>Coverage Posture Variation</th><td>${report.novelAlgorithms.postureVariation ? `${report.novelAlgorithms.postureVariation.profiles.length} profiles · worst ${report.novelAlgorithms.postureVariation.worstProfileLabel ?? "—"} ${report.novelAlgorithms.postureVariation.worstProfileCoveragePct != null ? `${report.novelAlgorithms.postureVariation.worstProfileCoveragePct.toFixed(1)}%` : ""} · largest drop ${report.novelAlgorithms.postureVariation.largestDropProfileLabel ?? "—"} (${formatSignedDelta(report.novelAlgorithms.postureVariation.largestDropDeltaPct)})` : "Not computed"}</td></tr>
    <tr><th>Blind Spot Topology</th><td>${report.novelAlgorithms.blindRegions ? `${report.novelAlgorithms.blindRegionCount ?? report.novelAlgorithms.blindRegions.length} regions · ${report.novelAlgorithms.blindRegions.filter((region) => region.severity === "critical").length} critical · ${report.novelAlgorithms.blindRegions.filter((region) => region.touchesCriticalZone).length} touching critical zones` : "Not computed"}</td></tr>
    <tr><th>Blind Spot Fingerprint</th><td>${report.novelAlgorithms.blindSpotFingerprint ? `${report.novelAlgorithms.blindSpotFingerprint.fingerprint} · ${report.novelAlgorithms.blindSpotFingerprint.regionCount} regions` : "Not computed"}</td></tr>
    <tr><th>Reflective Bounce</th><td>${report.novelAlgorithms.reflectiveBounce ? `${report.novelAlgorithms.reflectiveBounce.reflectiveWindowCount} reflective windows · ${report.novelAlgorithms.reflectiveBounce.affectedCellCount} affected cells` : "Not computed"}</td></tr>
    <tr><th>K-Robustness</th><td>${report.novelAlgorithms.kRobustness ? `K=${report.novelAlgorithms.kRobustness.kRobustness} / ${report.novelAlgorithms.kRobustness.totalCameras} (${report.novelAlgorithms.kRobustness.isRobust ? "robust" : "not robust"})` : "Not computed"}</td></tr>
    <tr><th>Placement Oracle</th><td>${report.novelAlgorithms.placementOracle ? `${report.novelAlgorithms.placementOracle.candidateCount} candidates · best ${report.novelAlgorithms.placementOracle.bestCandidateMountType} @ ${report.novelAlgorithms.placementOracle.bestCandidatePosition[0].toFixed(1)}, ${report.novelAlgorithms.placementOracle.bestCandidatePosition[2].toFixed(1)} · score ${report.novelAlgorithms.placementOracle.bestCandidateScore.toFixed(1)}` : "Not computed"}</td></tr>
    <tr><th>Temporal Anomalies</th><td>${report.novelAlgorithms.temporalAnomalies ? `${report.novelAlgorithms.temporalAnomalies.anomalyWindowCount} windows` : "Not computed"}</td></tr>
    <tr><th>Occlusion Blame</th><td>${report.novelAlgorithms.occlusionBlame ? `${report.novelAlgorithms.occlusionBlame.length} zones · ${report.novelAlgorithms.occlusionBlame[0] ? report.novelAlgorithms.occlusionBlame[0].obstructions.length : 0} top blockers in first zone` : `${report.novelAlgorithms.occlusionBlameCount ?? 0} groups`}</td></tr>
  </table>
  ${report.novelAlgorithms.kRobustness?.criticalSets?.length ? `
  <h3>K-Robustness Critical Sets</h3>
  <table>
    <thead><tr><th>K</th><th>Cameras</th><th>Exposure</th><th>Waypoints</th></tr></thead>
    <tbody>
      ${report.novelAlgorithms.kRobustness.criticalSets.slice(0, 5).map((set) => `
        <tr>
          <td>${set.k}</td>
          <td>${escapeHtml(set.cameraNames.join(", "))}</td>
          <td>${set.exposureScore.toFixed(1)}</td>
          <td>${set.waypointCount}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ` : ""}
  ` : ""}

  ${report.novelAlgorithms?.blindRegions && report.novelAlgorithms.blindRegions.length > 0 ? `
  <h2>Blind Spot Topology</h2>
  <p>Blind regions are grouped connected areas of zero-visibility cells. Severity reflects whether they connect entries to critical zones or remain isolated.</p>
  <table>
    <thead><tr><th>Region</th><th>Severity</th><th>Class</th><th>Area</th><th>Touching Critical</th><th>Affected Zones</th></tr></thead>
    <tbody>
      ${report.novelAlgorithms.blindRegions.map((region) => `
        <tr>
          <td>${escapeHtml(region.description)}</td>
          <td>${region.severity}</td>
          <td>${region.classification}</td>
          <td>${region.areaSqM.toFixed(1)}m²</td>
          <td>${region.touchesCriticalZone ? "Yes" : "No"}</td>
          <td>${region.affectedZoneIds.join(", ") || "none"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ` : ""}

  ${report.novelAlgorithms?.blindSpotFingerprint ? `
  <h2>Blind Spot Fingerprint</h2>
  <p>A deterministic fingerprint for the scene's blind-region pattern. Use it to recognize when two layouts share the same blind-spot shape.</p>
  <table>
    <tr><th>Fingerprint</th><td>${report.novelAlgorithms.blindSpotFingerprint.fingerprint}</td></tr>
    <tr><th>Regions</th><td>${report.novelAlgorithms.blindSpotFingerprint.regionCount}</td></tr>
    <tr><th>Critical / Entry-linked / Isolated</th><td>${report.novelAlgorithms.blindSpotFingerprint.criticalRegionCount} / ${report.novelAlgorithms.blindSpotFingerprint.entryConnectedRegionCount} / ${report.novelAlgorithms.blindSpotFingerprint.isolatedRegionCount}</td></tr>
    <tr><th>Total blind area</th><td>${report.novelAlgorithms.blindSpotFingerprint.totalBlindAreaSqM.toFixed(1)} m²</td></tr>
    <tr><th>Largest region</th><td>${report.novelAlgorithms.blindSpotFingerprint.largestRegionAreaSqM.toFixed(1)} m²</td></tr>
    <tr><th>Affected zones</th><td>${report.novelAlgorithms.blindSpotFingerprint.affectedZoneCount}</td></tr>
  </table>
  ` : ""}

  ${report.novelAlgorithms?.reflectiveBounce ? `
  <h2>Reflective Bounce Vision</h2>
  <p>Reflective windows can act as deterministic mirror proxies when they improve the visible quality of cells on the far side of the reflective surface.</p>
  <table>
    <tr><th>Reflective windows</th><td>${report.novelAlgorithms.reflectiveBounce.reflectiveWindowCount}</td></tr>
    <tr><th>Affected cells</th><td>${report.novelAlgorithms.reflectiveBounce.affectedCellCount}</td></tr>
    <tr><th>Affected cameras</th><td>${report.novelAlgorithms.reflectiveBounce.affectedCameraCount}</td></tr>
  </table>
  ` : ""}

  ${report.novelAlgorithms?.occlusionBlame && report.novelAlgorithms.occlusionBlame.length > 0 ? `
  <h2>Occlusion Blame</h2>
  <p>When a zone fails, this section attributes the quality loss to the specific obstructions that improve the zone when removed.</p>
  ${report.novelAlgorithms.occlusionBlame.map((zone) => `
    <h3>${escapeHtml(zone.zoneLabel)} (${zone.baselineQuality})</h3>
    <table>
      <thead><tr><th>Obstruction</th><th>Blame</th><th>Quality Without</th><th>Improvement</th></tr></thead>
      <tbody>
        ${zone.obstructions.map((obstruction) => `
          <tr>
            <td>${escapeHtml(obstruction.label)}</td>
            <td>${(obstruction.blameFraction * 100).toFixed(0)}%</td>
            <td>${obstruction.qualityWithout}</td>
            <td>+${obstruction.qualityImprovement.toFixed(1)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `).join("")}
  ` : ""}

  ${report.novelAlgorithms?.placementOracle ? `
  <h2>Placement Oracle</h2>
  <p>The placement oracle scores wall and ceiling mount candidates to highlight the next best camera location.</p>
  <table>
    <tr><th>Candidate Count</th><td>${report.novelAlgorithms.placementOracle.candidateCount}</td></tr>
    <tr><th>Best Candidate</th><td>${report.novelAlgorithms.placementOracle.bestCandidateMountType} @ ${report.novelAlgorithms.placementOracle.bestCandidatePosition[0].toFixed(1)}, ${report.novelAlgorithms.placementOracle.bestCandidatePosition[2].toFixed(1)}</td></tr>
    <tr><th>Best Score</th><td>${report.novelAlgorithms.placementOracle.bestCandidateScore.toFixed(1)}</td></tr>
  </table>
  ` : ""}

  <h2>Modeling scope and requirement checks</h2>
  <p>
    <strong style="color:${report.meetsModeledZoneRequirements ? "#16a34a" : "#dc2626"}">
      ${report.meetsModeledZoneRequirements ? "✓ Meets modeled zone requirements" : "○ Does not fully meet modeled zone requirements"}
    </strong>
    &mdash; ${report.summary.zonesPassing}/${report.summary.zonesTotal} zones meet required quality levels under current assumptions.
  </p>
  <p>
    This is a planning-oriented estimate and not a legal, forensic, or certified compliance ruling.
  </p>

  <footer>
    Generated by SentinelTwin Studio &middot; ${new Date(report.generatedAt).toISOString()} &middot;
    ${escapeHtml(report.standardsRef)} • planning estimate (not certified)
  </footer>
</body>
</html>`;
}

export function exportAsMarkdown(report: ReportData): string {
  const lines = [
    `# ${report.title}`,
    "",
    `**Site:** ${report.siteName}`,
    `**Date:** ${new Date(report.generatedAt).toLocaleDateString()}`,
    `**Dimensions:** ${report.dimensions.width}m × ${report.dimensions.depth}m × ${report.dimensions.height}m`,
    `**Standard:** ${report.standardsRef}`,
    "",
    "## Executive Summary",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Coverage | ${report.summary.totalCoveragePct.toFixed(1)}% |`,
    `| Recognition Area | ${report.summary.recognitionAreaPct.toFixed(1)}% |`,
    `| Identification Area | ${report.summary.identificationAreaPct.toFixed(1)}% |`,
    `| Zones Passing | ${report.summary.zonesPassing}/${report.summary.zonesTotal} |`,
    `| Issues Found | ${report.summary.issuesCount} |`,
    `| Verified Recommendations | ${report.summary.verifiedRecommendationsCount}/${report.summary.recommendationsCount} |`,
    "",
    "## Assumptions",
    `- DORI Standard: ${report.assumptions.doriStandard}`,
    `- Person Height: ${report.assumptions.personHeightM}m`,
    `- Vehicle Height: ${report.assumptions.vehicleHeightM}m`,
    `- Time of Day: ${report.assumptions.timeOfDay}`,
    `- PPM Thresholds: ${report.assumptions.ppm.detection} / ${report.assumptions.ppm.observation} / ${report.assumptions.ppm.recognition} / ${report.assumptions.ppm.identification}`,
    "",
    "_These outputs are estimated planning indicators under current assumptions, not legal or forensic guarantees._",
    "",
    "## Provenance",
    `- Scene Source: ${report.provenance.sceneSourceLabel} (${report.provenance.sceneSource})`,
    `- Graph Nodes: ${report.provenance.nodeCount}`,
    `- Graph Edges: ${report.provenance.edgeCount}`,
    `- Revision Depth: ${report.provenance.revisionDepth}`,
    `- Snapshots Tracked: ${report.provenance.snapshotCount}`,
    `- Source Counts: ${Object.entries(report.provenance.sourceCounts).map(([source, count]) => `${source}:${count}`).join(" · ")}`,
    ...(report.provenance.sourceNotes.length > 0 ? [
      "- Source History:",
      ...report.provenance.sourceNotes.map((note) => `  - ${note}`),
    ] : []),
    ...(report.provenance.confidenceNotes.length > 0 ? [
      "- Confidence History:",
      ...report.provenance.confidenceNotes.map((note) => `  - ${note}`),
    ] : []),
    "",
    "## Zone Analysis",
    "",
    ...(report.zones.length > 0
      ? ["| Zone | Required | Actual | Status | Cameras |",
         "|------|----------|--------|--------|---------|",
         ...report.zones.map((z) =>
           `| ${z.label} | ${z.requiredQuality} | ${z.actualQuality} | ${z.status} | ${z.coveringCameras.join(", ") || "none"} |`,
         )]
      : ["No critical zones defined."]),
    "",
    "## Issues",
    "",
    ...(report.issues.length > 0
      ? report.issues.map((i) => `- **[${i.severity.toUpperCase()}]** ${i.description}`)
      : ["No issues found."]),
    "",
    "## Recommendations",
    "",
    ...(report.recommendations.length > 0
      ? report.recommendations.map((r) =>
          `- [${r.verified ? "x" : " "}] ${r.description} (${r.costCategory}) — ${r.estimatedImpact}`,
        )
      : ["No recommendations."]),
    "",
    ...(report.redundancyMatrix
      ? [
          "## Redundancy Matrix",
          `- Cameras: ${report.redundancyMatrix.cameraCount}`,
          `- Zones: ${report.redundancyMatrix.zoneCount}`,
          `- Redundant zones: ${report.redundancyMatrix.redundantZoneCount}`,
          `- SPOF zones: ${report.redundancyMatrix.spofZoneCount}`,
          `- Uncovered zones: ${report.redundancyMatrix.uncoveredZoneCount}`,
          ...(report.redundancyMatrix.vulnerableZones.length > 0
            ? [
                "- Vulnerable zones:",
                ...report.redundancyMatrix.vulnerableZones.map((zone) =>
                  `  - ${zone.label}: ${zone.status.replace(/_/g, " ")}${zone.coveringCameraNames.length > 0 ? ` (${zone.coveringCameraNames.join(", ")})` : ""}`,
                ),
              ]
            : []),
          "- Camera matrix:",
          ...report.redundancyMatrix.cameraRows.map(
            (row) =>
              `  - ${row.cameraName} (${row.status}, ${row.coveragePct.toFixed(1)}%, ${row.criticalityLabel} ${row.criticalityScore}/10) | single-point: ${row.soleCoverageZones.map((zone) => zone.label).join(", ") || "none"} | covered: ${row.coveredZones.map((zone) => `${zone.label}${zone.isSole ? " ⚠" : ""}`).join(", ") || "none"}`,
          ),
          "",
        ]
      : []),
    ...(report.temporalProfile
      ? [
          "## Temporal Profile",
          `- Vulnerability windows: ${report.temporalProfile.vulnerabilityWindowCount}`,
          `- Safest periods: ${report.temporalProfile.safestPeriods.map((p) => `${formatHour(p.startHour)}–${formatHour(p.endHour)}`).join(", ")}`,
          "",
        ]
      : []),
    ...(report.adversarialPath
      ? [
          "## Coverage Failure Replay",
          "- Defensive route-risk analysis for coverage hardening (not attacker guidance)",
          `- Exposure score: ${report.adversarialPath.exposureScore.toFixed(1)}`,
          `- Detection probability: ${(report.adversarialPath.detectionProbability * 100).toFixed(0)}%`,
          "",
        ]
      : []),
    ...(report.novelAlgorithms
      ? [
          "## Novel Algorithms",
          `- Coverage Fragility: ${report.novelAlgorithms.coverageFragility ? `${(report.novelAlgorithms.coverageFragility.meanFragility * 100).toFixed(1)}% mean · ${report.novelAlgorithms.coverageFragility.fragileCellCount}/${report.novelAlgorithms.coverageFragility.totalCells} fragile cells` : "Not computed"}`,
          `- Coverage Uncertainty: ${report.novelAlgorithms.coverageUncertainty ? `${report.novelAlgorithms.coverageUncertainty.sampleCount} samples · ${report.novelAlgorithms.coverageUncertainty.meanCoveragePct.toFixed(1)}% mean (${report.novelAlgorithms.coverageUncertainty.p5CoveragePct.toFixed(1)}%–${report.novelAlgorithms.coverageUncertainty.p95CoveragePct.toFixed(1)}%)` : "Not computed"}`,
          `- Coverage Posture Variation: ${report.novelAlgorithms.postureVariation ? `${report.novelAlgorithms.postureVariation.profiles.length} profiles · worst ${report.novelAlgorithms.postureVariation.worstProfileLabel ?? "—"} ${report.novelAlgorithms.postureVariation.worstProfileCoveragePct != null ? `${report.novelAlgorithms.postureVariation.worstProfileCoveragePct.toFixed(1)}%` : ""} · largest drop ${report.novelAlgorithms.postureVariation.largestDropProfileLabel ?? "—"} (${formatSignedDelta(report.novelAlgorithms.postureVariation.largestDropDeltaPct)})` : "Not computed"}`,
          `- Blind Spot Topology: ${report.novelAlgorithms.blindRegions ? `${report.novelAlgorithms.blindRegionCount ?? report.novelAlgorithms.blindRegions.length} regions · ${report.novelAlgorithms.blindRegions.filter((region) => region.severity === "critical").length} critical` : "Not computed"}`,
          `- Blind Spot Fingerprint: ${report.novelAlgorithms.blindSpotFingerprint ? `${report.novelAlgorithms.blindSpotFingerprint.fingerprint} · ${report.novelAlgorithms.blindSpotFingerprint.regionCount} regions` : "Not computed"}`,
          `- Reflective Bounce: ${report.novelAlgorithms.reflectiveBounce ? `${report.novelAlgorithms.reflectiveBounce.reflectiveWindowCount} reflective windows · ${report.novelAlgorithms.reflectiveBounce.affectedCellCount} affected cells` : "Not computed"}`,
          `- K-Robustness: ${report.novelAlgorithms.kRobustness ? `K=${report.novelAlgorithms.kRobustness.kRobustness} / ${report.novelAlgorithms.kRobustness.totalCameras}` : "Not computed"}`,
          `- Placement Oracle: ${report.novelAlgorithms.placementOracle ? `${report.novelAlgorithms.placementOracle.candidateCount} candidates · best ${report.novelAlgorithms.placementOracle.bestCandidateMountType} @ ${report.novelAlgorithms.placementOracle.bestCandidatePosition[0].toFixed(1)}, ${report.novelAlgorithms.placementOracle.bestCandidatePosition[2].toFixed(1)} · score ${report.novelAlgorithms.placementOracle.bestCandidateScore.toFixed(1)}` : "Not computed"}`,
          `- Temporal Anomalies: ${report.novelAlgorithms.temporalAnomalies ? `${report.novelAlgorithms.temporalAnomalies.anomalyWindowCount} windows` : "Not computed"}`,
          `- Occlusion Blame: ${report.novelAlgorithms.occlusionBlame ? `${report.novelAlgorithms.occlusionBlame.length} zones` : `${report.novelAlgorithms.occlusionBlameCount ?? 0} groups`}`,
          `- Blind Regions: ${report.novelAlgorithms.blindRegionCount ?? 0} regions`,
          "",
        ]
      : []),
    ...(report.novelAlgorithms?.occlusionBlame && report.novelAlgorithms.occlusionBlame.length > 0
      ? [
          "## Occlusion Blame",
          ...report.novelAlgorithms.occlusionBlame.map((zone) => [
            `- ${zone.zoneLabel} (${zone.baselineQuality})`,
            ...zone.obstructions.map(
              (obstruction) =>
                `  - ${obstruction.label}: ${(obstruction.blameFraction * 100).toFixed(0)}% blame, ${obstruction.qualityWithout} without, +${obstruction.qualityImprovement.toFixed(1)} improvement`,
            ),
          ]).flat(),
          "",
        ]
      : []),
    ...(report.novelAlgorithms?.blindRegions && report.novelAlgorithms.blindRegions.length > 0
      ? [
          "## Blind Spot Topology",
          ...report.novelAlgorithms.blindRegions.map(
            (region) =>
              `- [${region.severity.toUpperCase()}] ${region.description} (${region.classification}, ${region.areaSqM.toFixed(1)}m²)${region.affectedZoneIds.length > 0 ? ` — zones: ${region.affectedZoneIds.join(", ")}` : ""}`,
          ),
          "",
        ]
      : []),
    ...(report.novelAlgorithms?.blindSpotFingerprint
      ? [
          "## Blind Spot Fingerprint",
          `- Fingerprint: ${report.novelAlgorithms.blindSpotFingerprint.fingerprint}`,
          `- Regions: ${report.novelAlgorithms.blindSpotFingerprint.regionCount}`,
          `- Critical / Entry-linked / Isolated: ${report.novelAlgorithms.blindSpotFingerprint.criticalRegionCount} / ${report.novelAlgorithms.blindSpotFingerprint.entryConnectedRegionCount} / ${report.novelAlgorithms.blindSpotFingerprint.isolatedRegionCount}`,
          `- Total blind area: ${report.novelAlgorithms.blindSpotFingerprint.totalBlindAreaSqM.toFixed(1)} m²`,
          "",
        ]
      : []),
    ...(report.novelAlgorithms?.reflectiveBounce
      ? [
          "## Reflective Bounce Vision",
          `- Reflective windows: ${report.novelAlgorithms.reflectiveBounce.reflectiveWindowCount}`,
          `- Affected cells: ${report.novelAlgorithms.reflectiveBounce.affectedCellCount}`,
          `- Affected cameras: ${report.novelAlgorithms.reflectiveBounce.affectedCameraCount}`,
          "",
        ]
      : []),
    ...(report.novelAlgorithms?.placementOracle
      ? [
          "## Placement Oracle",
          `- Candidate count: ${report.novelAlgorithms.placementOracle.candidateCount}`,
          `- Best candidate: ${report.novelAlgorithms.placementOracle.bestCandidateMountType} @ ${report.novelAlgorithms.placementOracle.bestCandidatePosition[0].toFixed(1)}, ${report.novelAlgorithms.placementOracle.bestCandidatePosition[2].toFixed(1)}`,
          `- Best score: ${report.novelAlgorithms.placementOracle.bestCandidateScore.toFixed(1)}`,
          "",
        ]
      : []),
    ...(report.novelAlgorithms?.kRobustness?.criticalSets?.length
      ? [
          "## K-Robustness Critical Sets",
          ...report.novelAlgorithms.kRobustness.criticalSets.slice(0, 5).map(
            (set) => `- K=${set.k}: ${set.cameraNames.join(", ")} (exposure ${set.exposureScore.toFixed(1)}, ${set.waypointCount} waypoints)`,
          ),
          "",
        ]
      : []),
    "## Modeling scope and requirement checks",
    `**${report.meetsModeledZoneRequirements ? "Meets modeled zone requirements" : "Does not fully meet modeled zone requirements"}** — ${report.summary.zonesPassing}/${report.summary.zonesTotal} zones meet requirements under current assumptions.`,
    "This report is planning-grade and does not confer legal, forensic, or compliance certification.",
    "",
    `---`,
    `*Generated by SentinelTwin Studio. Standards: ${report.standardsRef}*`,
  ];
  return lines.join("\n");
}

export function exportAsText(report: ReportData): string {
  const lines = [
    `${report.title}`,
    `${"=".repeat(report.title.length)}`,
    "",
    `Site: ${report.siteName}`,
    `Date: ${new Date(report.generatedAt).toLocaleDateString()}`,
    `Dimensions: ${report.dimensions.width}m x ${report.dimensions.depth}m x ${report.dimensions.height}m`,
    `Standard: ${report.standardsRef}`,
    "",
    "ASSUMPTIONS",
    `DORI Standard: ${report.assumptions.doriStandard}`,
    `Person Height: ${report.assumptions.personHeightM}m`,
    `Vehicle Height: ${report.assumptions.vehicleHeightM}m`,
    `Time of Day: ${report.assumptions.timeOfDay}`,
    `PPM Thresholds: ${report.assumptions.ppm.detection} / ${report.assumptions.ppm.observation} / ${report.assumptions.ppm.recognition} / ${report.assumptions.ppm.identification}`,
    "",
    "PROVENANCE",
    `${"-".repeat(30)}`,
    `  Scene Source:              ${report.provenance.sceneSourceLabel} (${report.provenance.sceneSource})`,
    `  Graph Nodes:               ${report.provenance.nodeCount}`,
    `  Graph Edges:               ${report.provenance.edgeCount}`,
    `  Revision Depth:            ${report.provenance.revisionDepth}`,
    `  Snapshots Tracked:         ${report.provenance.snapshotCount}`,
    `  Source Counts:             ${Object.entries(report.provenance.sourceCounts).map(([source, count]) => `${source}:${count}`).join(" · ")}`,
    ...(report.provenance.sourceNotes.length > 0 ? [
      "  Source History:",
      ...report.provenance.sourceNotes.map((note) => `    - ${note}`),
    ] : []),
    ...(report.provenance.confidenceNotes.length > 0 ? [
      "  Confidence History:",
      ...report.provenance.confidenceNotes.map((note) => `    - ${note}`),
    ] : []),
    "",
    "SUMMARY",
    `${"-".repeat(30)}`,
    `  Total Coverage:          ${report.summary.totalCoveragePct.toFixed(1)}%`,
    `  Blindspot:               ${report.summary.blindspotPct.toFixed(1)}%`,
    `  Recognition Area:        ${report.summary.recognitionAreaPct.toFixed(1)}%`,
    `  Identification Area:     ${report.summary.identificationAreaPct.toFixed(1)}%`,
    `  Average Quality:         ${report.summary.averageWalkableQuality.toFixed(2)}`,
    `  Zones Passing:           ${report.summary.zonesPassing}/${report.summary.zonesTotal}`,
    `  Issues Found:            ${report.summary.issuesCount}`,
    `  Recommendations:         ${report.summary.recommendationsCount} (${report.summary.verifiedRecommendationsCount} verified)`,
    "",
    ...(report.zones.length > 0
      ? [
          "ZONE ANALYSIS",
          `${"-".repeat(30)}`,
          ...report.zones.map(
            (z) => `  ${z.label.padEnd(20)} ${z.requiredQuality.padEnd(12)} ${z.actualQuality.padEnd(12)} ${z.status}`,
          ),
          "",
        ]
      : []),
    ...(report.issues.length > 0
      ? [
          "ISSUES",
          `${"-".repeat(30)}`,
          ...report.issues.map((i) => `  [${i.severity.toUpperCase().padEnd(8)}] ${i.description}`),
          "",
        ]
      : []),
    ...(report.recommendations.length > 0
      ? [
          "RECOMMENDATIONS",
          `${"-".repeat(30)}`,
          ...report.recommendations.map((r) =>
            `  [${r.verified ? "✓" : "○"}] ${r.description} (${r.costCategory})`,
          ),
          "",
        ]
      : []),
    ...(report.redundancyMatrix
      ? [
          "REDUNDANCY MATRIX",
          `${"-".repeat(30)}`,
          `  Cameras:               ${report.redundancyMatrix.cameraCount}`,
          `  Zones:                 ${report.redundancyMatrix.zoneCount}`,
          `  Redundant zones:       ${report.redundancyMatrix.redundantZoneCount}`,
          `  SPOF zones:            ${report.redundancyMatrix.spofZoneCount}`,
          `  Uncovered zones:       ${report.redundancyMatrix.uncoveredZoneCount}`,
          ...(report.redundancyMatrix.vulnerableZones.length > 0
            ? [
                "  Vulnerable zones:",
                ...report.redundancyMatrix.vulnerableZones.map(
                  (zone) => `    - ${zone.label}: ${zone.status.replace(/_/g, " ")}${zone.coveringCameraNames.length > 0 ? ` (${zone.coveringCameraNames.join(", ")})` : ""}`,
                ),
              ]
            : []),
          "  Camera matrix:",
          ...report.redundancyMatrix.cameraRows.map(
            (row) =>
              `    - ${row.cameraName} (${row.status}, ${row.coveragePct.toFixed(1)}%, ${row.criticalityLabel} ${row.criticalityScore}/10) | single-point: ${row.soleCoverageZones.map((zone) => zone.label).join(", ") || "none"} | covered: ${row.coveredZones.map((zone) => `${zone.label}${zone.isSole ? " ⚠" : ""}`).join(", ") || "none"}`,
          ),
          "",
        ]
      : []),
    ...(report.novelAlgorithms
      ? [
          "NOVEL ALGORITHMS",
          `${"-".repeat(30)}`,
          `  Coverage Fragility:    ${report.novelAlgorithms.coverageFragility ? `${(report.novelAlgorithms.coverageFragility.meanFragility * 100).toFixed(1)}% mean · ${report.novelAlgorithms.coverageFragility.fragileCellCount}/${report.novelAlgorithms.coverageFragility.totalCells} fragile cells` : "Not computed"}`,
          `  Coverage Uncertainty:   ${report.novelAlgorithms.coverageUncertainty ? `${report.novelAlgorithms.coverageUncertainty.sampleCount} samples · ${report.novelAlgorithms.coverageUncertainty.meanCoveragePct.toFixed(1)}% mean (${report.novelAlgorithms.coverageUncertainty.p5CoveragePct.toFixed(1)}%–${report.novelAlgorithms.coverageUncertainty.p95CoveragePct.toFixed(1)}%)` : "Not computed"}`,
          `  Coverage Posture Variation: ${report.novelAlgorithms.postureVariation ? `${report.novelAlgorithms.postureVariation.profiles.length} profiles · worst ${report.novelAlgorithms.postureVariation.worstProfileLabel ?? "—"} ${report.novelAlgorithms.postureVariation.worstProfileCoveragePct != null ? `${report.novelAlgorithms.postureVariation.worstProfileCoveragePct.toFixed(1)}%` : ""} · largest drop ${report.novelAlgorithms.postureVariation.largestDropProfileLabel ?? "—"} (${formatSignedDelta(report.novelAlgorithms.postureVariation.largestDropDeltaPct)})` : "Not computed"}`,
          `  Blind Spot Topology:   ${report.novelAlgorithms.blindRegions ? `${report.novelAlgorithms.blindRegionCount ?? report.novelAlgorithms.blindRegions.length} regions · ${report.novelAlgorithms.blindRegions.filter((region) => region.severity === "critical").length} critical` : "Not computed"}`,
          `  Blind Spot Fingerprint: ${report.novelAlgorithms.blindSpotFingerprint ? `${report.novelAlgorithms.blindSpotFingerprint.fingerprint} · ${report.novelAlgorithms.blindSpotFingerprint.regionCount} regions` : "Not computed"}`,
          ...(report.novelAlgorithms.reflectiveBounce
            ? [
                `  Reflective Bounce Vision:`,
                `    Reflective windows: ${report.novelAlgorithms.reflectiveBounce.reflectiveWindowCount}`,
                `    Affected cells: ${report.novelAlgorithms.reflectiveBounce.affectedCellCount}`,
                `    Affected cameras: ${report.novelAlgorithms.reflectiveBounce.affectedCameraCount}`,
              ]
            : [`  Reflective Bounce Vision: Not computed`]),
          `  K-Robustness:           ${report.novelAlgorithms.kRobustness ? `K=${report.novelAlgorithms.kRobustness.kRobustness} / ${report.novelAlgorithms.kRobustness.totalCameras}` : "Not computed"}`,
          ...(report.novelAlgorithms.kRobustness?.criticalSets?.length
            ? [
                "  K-Robustness Critical Sets:",
                ...report.novelAlgorithms.kRobustness.criticalSets.slice(0, 5).map(
                  (set) => `    - K=${set.k}: ${set.cameraNames.join(", ")} (exposure ${set.exposureScore.toFixed(1)}, ${set.waypointCount} waypoints)`,
                ),
              ]
            : []),
          `  Placement Oracle:       ${report.novelAlgorithms.placementOracle ? `${report.novelAlgorithms.placementOracle.candidateCount} candidates · best ${report.novelAlgorithms.placementOracle.bestCandidateMountType} @ ${report.novelAlgorithms.placementOracle.bestCandidatePosition[0].toFixed(1)}, ${report.novelAlgorithms.placementOracle.bestCandidatePosition[2].toFixed(1)} · score ${report.novelAlgorithms.placementOracle.bestCandidateScore.toFixed(1)}` : "Not computed"}`,
          `  Temporal Anomalies:     ${report.novelAlgorithms.temporalAnomalies ? `${report.novelAlgorithms.temporalAnomalies.anomalyWindowCount} windows` : "Not computed"}`,
          `  Occlusion Blame:        ${report.novelAlgorithms.occlusionBlame ? `${report.novelAlgorithms.occlusionBlame.length} zones` : `${report.novelAlgorithms.occlusionBlameCount ?? 0} groups`}`,
          `  Blind Regions:          ${report.novelAlgorithms.blindRegionCount ?? 0} regions`,
          "",
        ]
      : []),
    "",
    `Modeled requirements: ${report.meetsModeledZoneRequirements ? "MET" : "NOT MET"}`,
    "Planning estimate only; not a compliance certification.",
    `--- Generated by SentinelTwin Studio ---`,
  ];
  return lines.join("\n");
}

// ── Compare Report Export ──

export function exportCompareAsHtml(
  compare: CompareReportData,
  visuals?: { beforeImageDataUrl?: string; afterImageDataUrl?: string },
): string {
  const deltaClass = (val: number) =>
    val > 0 ? "delta-positive" : val < 0 ? "delta-negative" : "delta-neutral";
  const deltaSign = (val: number) => (val > 0 ? "+" : "") + val.toFixed(1);
  const beforeEvidence = visuals?.beforeImageDataUrl ?? scenarioEvidenceDataUri({
    label: "Before",
    coverage: compare.before.summary.totalCoveragePct,
    recognition: compare.before.summary.recognitionAreaPct,
    zonesPassing: compare.before.summary.zonesPassing,
    zonesTotal: compare.before.summary.zonesTotal,
    issues: compare.before.summary.issuesCount,
    accent: "#64748b",
  });
  const afterEvidence = visuals?.afterImageDataUrl ?? scenarioEvidenceDataUri({
    label: "After",
    coverage: compare.after.summary.totalCoveragePct,
    recognition: compare.after.summary.recognitionAreaPct,
    zonesPassing: compare.after.summary.zonesPassing,
    zonesTotal: compare.after.summary.zonesTotal,
    issues: compare.after.summary.issuesCount,
    accent: "#16a34a",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compare Report — ${escapeHtml(compare.before.siteName)}</title>
  <style>
    @page { margin: 20mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    h1 { font-size: 20pt; margin-bottom: 4px; }
    h2 { font-size: 14pt; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
    .delta-positive { color: #16a34a; }
    .delta-negative { color: #dc2626; }
    .delta-neutral { color: #64748b; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .before-card, .after-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .before-card h3 { color: #64748b; margin-bottom: 8px; }
    .after-card h3 { color: #16a34a; margin-bottom: 8px; }
    .evidence {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      margin-bottom: 10px;
    }
    .delta-summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin: 16px 0; }
    .delta-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .delta-card .value { font-size: 16pt; font-weight: 700; }
    .delta-card .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
    th { background: #f1f5f9; }
    .changed { background: #fffbeb; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>Before/After Comparison</h1>
  <p>${escapeHtml(compare.before.siteName)} &middot; ${new Date().toLocaleDateString()}</p>

  <h2>Delta Summary</h2>
  <div class="delta-summary">
    <div class="delta-card"><div class="value ${deltaClass(compare.deltas.totalCoveragePctDelta)}">${deltaSign(compare.deltas.totalCoveragePctDelta)}%</div><div class="label">Coverage Delta</div></div>
    <div class="delta-card"><div class="value ${deltaClass(-compare.deltas.blindspotPctDelta)}">${deltaSign(-compare.deltas.blindspotPctDelta)}%</div><div class="label">Blindspot Reduction</div></div>
    <div class="delta-card"><div class="value ${deltaClass(compare.deltas.zonesPassedDelta)}">${deltaSign(compare.deltas.zonesPassedDelta)}</div><div class="label">Zones Added</div></div>
    <div class="delta-card"><div class="value ${deltaClass(-compare.deltas.issuesDelta)}">${deltaSign(-compare.deltas.issuesDelta)}</div><div class="label">Issues Resolved</div></div>
  </div>

  <h2>Side-by-Side</h2>
  <div class="grid-2">
    <div class="before-card">
      <h3>Before</h3>
      <img class="evidence" src="${beforeEvidence}" alt="Before scenario visual evidence" />
      <table>
        <tr><td>Coverage</td><td>${compare.before.summary.totalCoveragePct.toFixed(1)}%</td></tr>
        <tr><td>Recognition</td><td>${compare.before.summary.recognitionAreaPct.toFixed(1)}%</td></tr>
        <tr><td>Zones Passing</td><td>${compare.before.summary.zonesPassing}/${compare.before.summary.zonesTotal}</td></tr>
        <tr><td>Issues</td><td>${compare.before.summary.issuesCount}</td></tr>
      </table>
    </div>
    <div class="after-card">
      <h3>After</h3>
      <img class="evidence" src="${afterEvidence}" alt="After scenario visual evidence" />
      <table>
        <tr><td>Coverage</td><td>${compare.after.summary.totalCoveragePct.toFixed(1)}%</td></tr>
        <tr><td>Recognition</td><td>${compare.after.summary.recognitionAreaPct.toFixed(1)}%</td></tr>
        <tr><td>Zones Passing</td><td>${compare.after.summary.zonesPassing}/${compare.after.summary.zonesTotal}</td></tr>
        <tr><td>Issues</td><td>${compare.after.summary.issuesCount}</td></tr>
      </table>
    </div>
  </div>

  <h2>Provenance</h2>
  <table>
    <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
    <tbody>
      <tr><td>Scene Source</td><td>${escapeHtml(compare.before.provenance.sceneSourceLabel)}</td><td>${escapeHtml(compare.after.provenance.sceneSourceLabel)}</td></tr>
      <tr><td>Graph Nodes</td><td>${compare.before.provenance.nodeCount}</td><td>${compare.after.provenance.nodeCount}</td></tr>
      <tr><td>Graph Edges</td><td>${compare.before.provenance.edgeCount}</td><td>${compare.after.provenance.edgeCount}</td></tr>
      <tr><td>Revision Depth</td><td>${compare.before.provenance.revisionDepth}</td><td>${compare.after.provenance.revisionDepth}</td></tr>
      <tr><td>Snapshots Tracked</td><td>${compare.before.provenance.snapshotCount}</td><td>${compare.after.provenance.snapshotCount}</td></tr>
    </tbody>
  </table>

  ${compare.zoneChanges.some((z) => z.changed) ? `
  <h2>Zone Status Changes</h2>
  <table>
    <thead><tr><th>Zone</th><th>Before</th><th>After</th></tr></thead>
    <tbody>
      ${compare.zoneChanges.map((z) => `
        <tr class="${z.changed ? "changed" : ""}">
          <td>${escapeHtml(z.label)}</td>
          <td>${z.beforeStatus.toUpperCase()}</td>
          <td>${z.afterStatus.toUpperCase()}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ` : ""}

  <footer>Generated by SentinelTwin Studio &middot; ${new Date().toISOString()}</footer>
</body>
</html>`;
}

export function exportCompareAsMarkdown(compare: CompareReportData): string {
  const lines = [
    "# Before/After Comparison",
    "",
    `**Site:** ${compare.before.siteName}`,
    "",
    "## Deltas",
    `| Metric | Delta |`,
    `|--------|-------|`,
    `| Total Coverage | ${compare.deltas.totalCoveragePctDelta > 0 ? "+" : ""}${compare.deltas.totalCoveragePctDelta.toFixed(1)}% |`,
    `| Blindspot | ${compare.deltas.blindspotPctDelta > 0 ? "+" : ""}${compare.deltas.blindspotPctDelta.toFixed(1)}% |`,
    `| Recognition Area | ${compare.deltas.recognitionAreaPctDelta > 0 ? "+" : ""}${compare.deltas.recognitionAreaPctDelta.toFixed(1)}% |`,
    `| Zones Passing | ${compare.deltas.zonesPassedDelta > 0 ? "+" : ""}${compare.deltas.zonesPassedDelta} |`,
    `| Issues | ${compare.deltas.issuesDelta > 0 ? "+" : ""}${compare.deltas.issuesDelta} |`,
    "",
    "## Zone Changes",
    ...compare.zoneChanges
      .filter((z) => z.changed)
      .map((z) => `- **${z.label}**: ${z.beforeStatus} → ${z.afterStatus}`),
    "",
    "## Before",
    `- Coverage: ${compare.before.summary.totalCoveragePct.toFixed(1)}%`,
    `- Recognition: ${compare.before.summary.recognitionAreaPct.toFixed(1)}%`,
    `- Zones Passing: ${compare.before.summary.zonesPassing}/${compare.before.summary.zonesTotal}`,
    `- Issues: ${compare.before.summary.issuesCount}`,
    "",
    "## After",
    `- Coverage: ${compare.after.summary.totalCoveragePct.toFixed(1)}%`,
    `- Recognition: ${compare.after.summary.recognitionAreaPct.toFixed(1)}%`,
    `- Zones Passing: ${compare.after.summary.zonesPassing}/${compare.after.summary.zonesTotal}`,
    `- Issues: ${compare.after.summary.issuesCount}`,
    "",
    "## Provenance",
    `| Field | Before | After |`,
    `|------|--------|-------|`,
    `| Scene Source | ${compare.before.provenance.sceneSourceLabel} | ${compare.after.provenance.sceneSourceLabel} |`,
    `| Graph Nodes | ${compare.before.provenance.nodeCount} | ${compare.after.provenance.nodeCount} |`,
    `| Graph Edges | ${compare.before.provenance.edgeCount} | ${compare.after.provenance.edgeCount} |`,
    `| Revision Depth | ${compare.before.provenance.revisionDepth} | ${compare.after.provenance.revisionDepth} |`,
    `| Snapshots Tracked | ${compare.before.provenance.snapshotCount} | ${compare.after.provenance.snapshotCount} |`,
    "",
    `--- *Generated by SentinelTwin Studio*`,
  ];
  return lines.join("\n");
}

// ── Compare Report (compatibility re-exports) ──

export function buildCompareReport(
  beforeScene: SecurityScene,
  beforeResult: SimulationResult,
  afterScene: SecurityScene,
  afterResult: SimulationResult,
): CompareReportData {
  return buildCompareReportData(beforeScene, beforeResult, afterScene, afterResult);
}

// ── Helpers ──

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatHour(hour: number): string {
  if (hour >= 24) return "Midnight";
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:00 ${period}`;
}

function formatSignedDelta(delta: number | null | undefined) {
  if (delta == null || Number.isNaN(delta)) return "—";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function scenarioEvidenceDataUri(input: {
  label: string;
  coverage: number;
  recognition: number;
  zonesPassing: number;
  zonesTotal: number;
  issues: number;
  accent: string;
}): string {
  const width = 520;
  const height = 170;
  const coverageW = Math.max(0, Math.min(100, input.coverage)) * 4.2;
  const recognitionW = Math.max(0, Math.min(100, input.recognition)) * 4.2;
  const zonesPct = input.zonesTotal > 0 ? (input.zonesPassing / input.zonesTotal) * 100 : 0;
  const zonesW = Math.max(0, Math.min(100, zonesPct)) * 4.2;
  const issueSeverity = Math.min(100, input.issues * 12);
  const issueW = issueSeverity * 4.2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f8fafc"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="13" fill="#0f172a" font-weight="700">${escapeForSvg(input.label)} Visual Evidence</text>
  <text x="16" y="40" font-family="Arial, sans-serif" font-size="10" fill="#64748b">Modeled summary profile (coverage, recognition, zones, issues)</text>
  <text x="16" y="67" font-family="Arial, sans-serif" font-size="10" fill="#334155">Coverage</text>
  <rect x="100" y="58" width="420" height="12" rx="6" fill="#e2e8f0"/>
  <rect x="100" y="58" width="${coverageW}" height="12" rx="6" fill="${input.accent}"/>
  <text x="100" y="95" font-family="Arial, sans-serif" font-size="10" fill="#334155">Recognition</text>
  <rect x="100" y="86" width="420" height="12" rx="6" fill="#e2e8f0"/>
  <rect x="100" y="86" width="${recognitionW}" height="12" rx="6" fill="#2563eb"/>
  <text x="100" y="123" font-family="Arial, sans-serif" font-size="10" fill="#334155">Zones Passing</text>
  <rect x="100" y="114" width="420" height="12" rx="6" fill="#e2e8f0"/>
  <rect x="100" y="114" width="${zonesW}" height="12" rx="6" fill="#16a34a"/>
  <text x="100" y="151" font-family="Arial, sans-serif" font-size="10" fill="#334155">Issue Pressure</text>
  <rect x="100" y="142" width="420" height="12" rx="6" fill="#e2e8f0"/>
  <rect x="100" y="142" width="${issueW}" height="12" rx="6" fill="#dc2626"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeForSvg(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
