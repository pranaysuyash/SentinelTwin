import type {
  CameraNode,
  Recommendation,
  ScenarioPath,
  SecurityIssue,
  SecurityScene,
  SimulationResult,
} from "@/schema/security-scene";
import { sortIssuesBySeverity } from "./security-outcome-severity";

export type SecurityOutcomeStatus = "not_run" | "pass" | "needs_attention" | "high_risk" | "incomplete";

export type OutcomeIssueCard = {
  id: string;
  severity: SecurityIssue["severity"];
  category: SecurityIssue["category"];
  description: string;
  affectedZones: string[];
  affectedCameras: string[];
};

export type OutcomeRecommendationCard = Recommendation & {
  id: string;
};

export type SecurityOutcomeSummary = {
  status: SecurityOutcomeStatus;
  headline: string;
  coveragePct: number | null;
  blindspotPct: number | null;
  criticalZonesPassing: number;
  criticalZonesTotal: number;
  worstIssue: OutcomeIssueCard | null;
  issueCount: number;
  nightReadiness: "unknown" | "good" | "weak" | "fails";
  redundancyStatus: "unknown" | "robust" | "single_point_failure" | "fails";
};

export type SecurityOutcomeModel = {
  summary: SecurityOutcomeSummary;
  topIssues: OutcomeIssueCard[];
  allIssues: OutcomeIssueCard[];
  recommendations: OutcomeRecommendationCard[];
  pathOutcome:
    | {
        pathLabel: string;
        totalDurationS: number;
        visibleDurationS: number;
        lostDurationS: number;
      }
    | null;
};

function deriveNightReadiness(scene: SecurityScene, result: SimulationResult): SecurityOutcomeSummary["nightReadiness"] {
  const nightIssues = result.issues.filter((issue) => issue.category === "night");
  if (nightIssues.some((issue) => issue.severity === "critical" || issue.severity === "high")) return "fails";
  if (nightIssues.length > 0) return "weak";
  if (scene.assumptions.timeOfDay === "night") return "good";
  return "unknown";
}

function deriveRedundancyStatus(result: SimulationResult): SecurityOutcomeSummary["redundancyStatus"] {
  if (result.cameraResults.length === 0) return "unknown";
  let hasFailure = false;
  let hasSinglePoint = false;
  for (const camera of result.cameraResults) {
    const details = camera.offlineImpactDetail ?? [];
    for (const detail of details) {
      if (detail.afterStatus === "fail" || detail.afterQuality === "none") hasFailure = true;
      if (detail.afterStatus !== detail.beforeStatus || detail.afterQuality !== detail.beforeQuality) {
        hasSinglePoint = true;
      }
    }
    if (camera.offlineImpact.length > 0) hasSinglePoint = true;
  }
  if (hasFailure) return "fails";
  if (hasSinglePoint) return "single_point_failure";
  return "robust";
}

function buildHeadline(status: SecurityOutcomeStatus, issue: OutcomeIssueCard | null): string {
  if (status === "not_run") return "Run simulation to compute the security outcome.";
  if (status === "pass") return "Modeled requirements currently pass under active assumptions.";
  if (issue) return issue.description;
  if (status === "high_risk") return "High-risk findings detected in current configuration.";
  if (status === "incomplete") return "Outcome is incomplete due to missing modeled inputs.";
  return "Security outcome needs attention.";
}

function toIssueCards(issues: SecurityIssue[]): OutcomeIssueCard[] {
  return sortIssuesBySeverity(issues).map((issue, index) => ({
    id: `issue_${index}_${issue.category}`,
    severity: issue.severity,
    category: issue.category,
    description: issue.description,
    affectedZones: issue.affectedZones,
    affectedCameras: issue.affectedCameras,
  }));
}

export function buildSecurityOutcomeModel(
  scene: SecurityScene,
  result: SimulationResult | null,
  activePath: ScenarioPath | null,
): SecurityOutcomeModel {
  if (!result) {
    return {
      summary: {
        status: "not_run",
        headline: "Run simulation to compute the security outcome.",
        coveragePct: null,
        blindspotPct: null,
        criticalZonesPassing: 0,
        criticalZonesTotal: scene.criticalZones.length,
        worstIssue: null,
        issueCount: 0,
        nightReadiness: "unknown",
        redundancyStatus: "unknown",
      },
      topIssues: [],
      allIssues: [],
      recommendations: [],
      pathOutcome: null,
    };
  }

  const issueCards = toIssueCards(result.issues);
  const worstIssue = issueCards[0] ?? null;
  const passCount = result.criticalZoneResults.filter((zone) => zone.status === "pass").length;
  const totalZones = result.criticalZoneResults.length;
  const hasCriticalFailure = issueCards.some((issue) => issue.severity === "critical") || result.criticalZoneResults.some((zone) => zone.status === "fail");
  const hasAnyFailure = issueCards.length > 0 || result.criticalZoneResults.some((zone) => zone.status !== "pass");
  const status: SecurityOutcomeStatus =
    totalZones === 0 ? "incomplete"
      : hasCriticalFailure ? "high_risk"
        : hasAnyFailure ? "needs_attention"
          : "pass";

  const pathResult = activePath ? result.pathResults.find((entry) => entry.pathId === activePath.id) ?? null : null;

  return {
    summary: {
      status,
      headline: buildHeadline(status, worstIssue),
      coveragePct: result.totalCoveragePct,
      blindspotPct: result.blindspotPct,
      criticalZonesPassing: passCount,
      criticalZonesTotal: totalZones,
      worstIssue,
      issueCount: issueCards.length,
      nightReadiness: deriveNightReadiness(scene, result),
      redundancyStatus: deriveRedundancyStatus(result),
    },
    topIssues: issueCards.slice(0, 5),
    allIssues: issueCards,
    recommendations: result.recommendations.map((rec, index) => ({ ...rec, id: `rec_${index}_${rec.type}` })),
    pathOutcome: pathResult
      ? {
          pathLabel: activePath?.label ?? pathResult.pathId,
          totalDurationS: pathResult.totalDurationS,
          visibleDurationS: pathResult.visibleDurationS,
          lostDurationS: pathResult.lostDurationS,
        }
      : null,
  };
}

export function buildSecurityOutcomeDelta(before: SimulationResult | null, after: SimulationResult | null) {
  if (!before || !after) return null;
  const beforePass = before.criticalZoneResults.filter((zone) => zone.status === "pass").length;
  const afterPass = after.criticalZoneResults.filter((zone) => zone.status === "pass").length;
  return {
    coverageDeltaPct: after.totalCoveragePct - before.totalCoveragePct,
    blindspotDeltaPct: after.blindspotPct - before.blindspotPct,
    issuesDelta: after.issues.length - before.issues.length,
    criticalZonesPassingBefore: beforePass,
    criticalZonesPassingAfter: afterPass,
    criticalZonesTotal: Math.max(before.criticalZoneResults.length, after.criticalZoneResults.length),
  };
}

export function recommendationTargetNode(scene: SecurityScene, recommendation: Recommendation): CameraNode | null {
  if (!recommendation.affectedNodeId) return null;
  return scene.cameras.find((camera) => camera.id === recommendation.affectedNodeId) ?? null;
}

