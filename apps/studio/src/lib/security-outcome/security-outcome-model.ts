import type {
  CameraNode,
  CriticalZoneNode,
  DoriQuality,
  Recommendation,
  ScenarioPath,
  SecurityIssue,
  SecurityScene,
  SimulationResult,
} from "@/schema/security-scene";
import { qualityToScore } from "@/simulation/dori";
import { sortIssuesBySeverity } from "./security-outcome-severity";

export type SecurityOutcomeStatus = "not_run" | "pass" | "needs_attention" | "high_risk" | "incomplete";

export type OutcomeIssueCard = {
  id: string;
  severity: SecurityIssue["severity"];
  category: SecurityIssue["category"];
  description: string;
  affectedZones: string[];
  affectedCameras: string[];
  productExplanation: string;
};

export type VerificationLabel = "verified_by_simulation" | "not_yet_tested" | "requires_user_input" | "assumption_based";

export type OutcomeRecommendationCard = Recommendation & {
  id: string;
  verificationLabel: VerificationLabel;
  beforeAfterSummary: string | null;
};

export type FailedZoneDetail = {
  zoneId: string;
  label: string;
  priority: CriticalZoneNode["priority"];
  requiredQuality: DoriQuality;
  actualQuality: DoriQuality;
  status: "pass" | "fail" | "partial";
  targetType: string;
  coveringCameras: string[];
  failureReasons: string[];
  productFailureReasons: string[];
  causeSummary: string;
  recommendedActionIds: string[];
};

export type CameraFinding = {
  cameraId: string;
  cameraName: string;
  status: string;
  coveragePct: number;
  zonesPassed: string[];
  zonesFailed: string[];
  offlineImpactSummary: string | null;
  roleSummary: string;
};

export type PathFinding = {
  pathId: string;
  label: string;
  visiblePct: number;
  lostSegments: number;
  bestQuality: DoriQuality;
  worstMomentSummary: string | null;
  lostSegmentLabels: string[];
};

export type PrivacyFinding = {
  zoneId: string;
  label: string;
  cameras: string[];
  issue: string;
};

export type AssumptionEntry = {
  label: string;
  value: string;
  impact: string;
};

export type SecurityOutcomeSummary = {
  status: SecurityOutcomeStatus;
  headline: string;
  summary: string;
  primaryRisk: string | null;
  recommendedNextAction: string | null;
  coveragePct: number | null;
  blindspotPct: number | null;
  criticalZonesPassing: number;
  criticalZonesTotal: number;
  recognitionAreaPct: number | null;
  identificationAreaPct: number | null;
  averageQualityLabel: string;
  worstAreaQuality: string;
  worstIssue: OutcomeIssueCard | null;
  issueCount: number;
  nightReadiness: "unknown" | "good" | "weak" | "fails";
  redundancyStatus: "unknown" | "robust" | "single_point_failure" | "fails";
};

export type SecurityOutcomeModel = {
  summary: SecurityOutcomeSummary;
  topIssues: OutcomeIssueCard[];
  allIssues: OutcomeIssueCard[];
  failedZones: FailedZoneDetail[];
  cameraFindings: CameraFinding[];
  pathFindings: PathFinding[];
  privacyFindings: PrivacyFinding[];
  recommendations: OutcomeRecommendationCard[];
  pathOutcome:
    | {
        pathLabel: string;
        totalDurationS: number;
        visibleDurationS: number;
        lostDurationS: number;
      }
    | null;
  assumptions: AssumptionEntry[];
  limitations: string[];
  missingPrerequisites: string[];
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

function buildHeadline(
  status: SecurityOutcomeStatus,
  issue: OutcomeIssueCard | null,
  result: SimulationResult | null,
  scene: SecurityScene,
): string {
  if (status === "not_run") return "Run simulation to compute the security outcome.";
  if (status === "pass") return "All modeled requirements pass under active assumptions.";
  if (status === "incomplete") return "Outcome is incomplete due to missing modeled inputs.";
  if (issue) return issue.description;

  const failedZoneCount = result?.criticalZoneResults.filter((z) => z.status !== "pass").length ?? 0;
  if (failedZoneCount > 0) {
    return `${failedZoneCount} critical zone${failedZoneCount > 1 ? "s" : ""} ${failedZoneCount > 1 ? "fail" : "fails"} current requirements.`;
  }
  if (status === "high_risk") return "High-risk findings detected in current configuration.";
  return "Security outcome needs attention.";
}

function buildSummary(
  status: SecurityOutcomeStatus,
  result: SimulationResult | null,
  scene: SecurityScene,
): string {
  if (status === "not_run") return "Simulation has not been run yet.";
  if (!result) return "No simulation data available.";

  const totalZones = result.criticalZoneResults.length;
  const passZones = result.criticalZoneResults.filter((z) => z.status === "pass").length;
  const coverage = Math.round(result.totalCoveragePct);

  if (status === "pass") {
    return `${passZones}/${totalZones} critical zones pass. Overall coverage: ${coverage}%.`;
  }

  const failedZones = result.criticalZoneResults.filter((z) => z.status !== "pass");
  const failedNames = failedZones.slice(0, 3).map((z) => z.label).join(", ");
  const suffix = failedZones.length > 3 ? ` and ${failedZones.length - 3} more` : "";

  return `${failedZones.length} zone${failedZones.length > 1 ? "s" : ""} failing: ${failedNames}${suffix}. Coverage: ${coverage}%.`;
}

function buildPrimaryRisk(
  result: SimulationResult | null,
  issue: OutcomeIssueCard | null,
): string | null {
  if (!result) return null;
  if (issue && (issue.severity === "critical" || issue.severity === "high")) {
    return issue.description;
  }
  const criticalZoneFail = result.criticalZoneResults.find((z) => z.status === "fail");
  if (criticalZoneFail) {
    return `${criticalZoneFail.label} fails ${criticalZoneFail.requiredQuality} requirement with current coverage quality.`;
  }
  return null;
}

function buildRecommendedNextAction(
  result: SimulationResult | null,
  recommendations: OutcomeRecommendationCard[],
  scene: SecurityScene,
): string | null {
  if (!result) return "Run the simulation to compute the security outcome.";
  if (result.criticalZoneResults.length === 0 && scene.criticalZones.length === 0) {
    return "Add critical zones to the scene to measure security requirements.";
  }
  if (scene.cameras.length === 0) {
    return "Add at least one camera to compute coverage.";
  }
  const verified = recommendations.find((r) => r.verificationLabel === "verified_by_simulation");
  if (verified) return verified.description;
  const unverified = recommendations.find((r) => r.verificationLabel === "not_yet_tested");
  if (unverified) return unverified.description;
  return null;
}

function translateFailureReasonToProductLanguage(
  technicalReason: string,
  zoneLabel: string,
  coveringCameras: string[],
  requiredQuality: DoriQuality,
  actualQuality: DoriQuality,
  scene: SecurityScene,
): string[] {
  const productReasons: string[] = [];

  if (qualityToScore(actualQuality) < qualityToScore(requiredQuality)) {
    const reqLabel = qualityLabelPlain(requiredQuality);
    const actLabel = qualityLabelPlain(actualQuality);
    if (actualQuality === "none") {
      productReasons.push(`${zoneLabel} has no camera coverage at all.`);
    } else {
      productReasons.push(`The area is visible, but not clear enough for ${reqLabel}. Current quality: ${actLabel}.`);
    }
  }

  const blockedByMatch = technicalReason.match(/blocked by[:\s]+(.+)/i);
  if (blockedByMatch) {
    const blockers = blockedByMatch[1].split(",").map((s) => s.trim());
    for (const blocker of blockers) {
      if (blocker) {
        productReasons.push(`${blocker} blocks the camera's line of sight.`);
      }
    }
  }

  if (technicalReason.toLowerCase().includes("no camera") || coveringCameras.length === 0) {
    productReasons.push("No camera can currently see this zone.");
  }

  if (technicalReason.toLowerCase().includes("night")) {
    productReasons.push("Night conditions reduce useful detail in this zone.");
  }

  if (productReasons.length === 0 && technicalReason) {
    productReasons.push(technicalReason);
  }

  return productReasons;
}

function buildCauseSummary(
  zone: { label: string; failureReasons: string[]; coveringCameras: string[]; actualQuality: DoriQuality },
  result: SimulationResult,
  scene: SecurityScene,
): string {
  const parts: string[] = [];

  const obstructionMatch = zone.failureReasons
    .find((r) => r.toLowerCase().includes("blocked by"));
  if (obstructionMatch) {
    const blockedByMatch = obstructionMatch.match(/blocked by[:\s]+(.+)/i);
    if (blockedByMatch) {
      parts.push(`${blockedByMatch[1]} obstructs coverage`);
    }
  }

  if (zone.actualQuality === "none") {
    parts.push("no camera covers this area");
  } else if (zone.coveringCameras.length === 1) {
    parts.push("single camera coverage");
  }

  const offlineImpact = result.cameraResults.find(
    (c) => c.criticalZonesFailed.includes(zone.label),
  );
  if (offlineImpact && offlineImpact.offlineImpact.length > 0) {
    parts.push(`${offlineImpact.cameraId} is a single point of failure`);
  }

  return parts.length > 0 ? parts.join("; ") + "." : "Coverage is below the required quality threshold.";
}

function deriveFailedZones(
  result: SimulationResult,
  scene: SecurityScene,
  recommendations: OutcomeRecommendationCard[],
): FailedZoneDetail[] {
  const zonePriorityMap = new Map(
    scene.criticalZones.map((z) => [z.id, z]),
  );

  return result.criticalZoneResults.map((zone) => {
    const zoneNode = zonePriorityMap.get(zone.zoneId);
    const priority = zoneNode?.priority ?? "medium";
    const targetType = zoneNode?.targetType ?? "person_detection";

    const productReasons = zone.status !== "pass"
      ? translateFailureReasonToProductLanguage(
          zone.failureReasons.join(" "),
          zone.label,
          zone.coveringCameras,
          zone.requiredQuality,
          zone.actualQuality,
          scene,
        )
      : [];

    const causeSummary = zone.status !== "pass"
      ? buildCauseSummary(zone, result, scene)
      : "";

    const recIds = recommendations
      .filter((rec) => {
        if (!rec.affectedNodeId) return false;
        return zone.coveringCameras.includes(rec.affectedNodeId)
          || zone.failureReasons.some((r) =>
            r.toLowerCase().includes(rec.description.toLowerCase().split('"')[1] ?? ""),
          );
      })
      .map((r) => r.id);

    return {
      zoneId: zone.zoneId,
      label: zone.label,
      priority,
      requiredQuality: zone.requiredQuality,
      actualQuality: zone.actualQuality,
      status: zone.status,
      targetType,
      coveringCameras: zone.coveringCameras,
      failureReasons: zone.failureReasons,
      productFailureReasons: productReasons,
      causeSummary,
      recommendedActionIds: recIds,
    };
  });
}

function deriveCameraFindings(
  result: SimulationResult,
  scene: SecurityScene,
): CameraFinding[] {
  return result.cameraResults.map((camera) => {
    const cameraNode = scene.cameras.find((c) => c.id === camera.cameraId);

    const offlineImpactSummary = camera.offlineImpactDetail && camera.offlineImpactDetail.length > 0
      ? `If ${cameraNode?.name ?? camera.cameraId} goes offline, ${camera.offlineImpactDetail
          .map((d) => `${d.label} drops to ${qualityLabelPlain(d.afterQuality)}`)
          .join("; ")}.`
      : null;

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (camera.criticalZonesCovered.length > 0) {
      strengths.push(`strong coverage of ${camera.criticalZonesCovered.join(", ")}`);
    }
    if (camera.criticalZonesFailed.length > 0) {
      weaknesses.push(`insufficient for ${camera.criticalZonesFailed.join(", ")}`);
    }
    if (camera.coveragePct < 10) {
      weaknesses.push("very low overall coverage");
    }

    const roleSummary = [...strengths, ...weaknesses].join("; ") || "no critical zone role";

    return {
      cameraId: camera.cameraId,
      cameraName: cameraNode?.name ?? camera.cameraId,
      status: cameraNode?.status ?? "on",
      coveragePct: camera.coveragePct,
      zonesPassed: camera.criticalZonesCovered,
      zonesFailed: camera.criticalZonesFailed,
      offlineImpactSummary,
      roleSummary,
    };
  });
}

function derivePathFindings(
  result: SimulationResult,
  scene: SecurityScene,
): PathFinding[] {
  return result.pathResults.map((pathResult) => {
    const pathNode = scene.paths.find((p) => p.id === pathResult.pathId);
    const label = pathNode?.label ?? pathResult.pathId;

    const totalDuration = pathResult.totalDurationS || 1;
    const visiblePct = Math.round((pathResult.visibleDurationS / totalDuration) * 100);

    const lostEvents = pathResult.timeline.filter((e) => e.event === "lost");
    const qualityDrops = pathResult.timeline.filter((e) => e.event === "quality_change");

    const lostSegmentLabels: string[] = [];
    for (const event of lostEvents) {
      if (event.reason) {
        lostSegmentLabels.push(event.reason);
      } else if (event.cameraId) {
        lostSegmentLabels.push(`lost ${event.cameraId}`);
      }
    }

    let bestQuality: DoriQuality = "none";
    for (const cameraVis of Object.values(pathResult.visibilityByCamera)) {
      if (qualityToScore(cameraVis.maxQuality) > qualityToScore(bestQuality)) {
        bestQuality = cameraVis.maxQuality;
      }
    }

    const worstDrop = qualityDrops.length > 0
      ? qualityDrops[qualityDrops.length - 1]
      : null;

    const worstMomentSummary = worstDrop
      ? `Quality drops to ${qualityLabelPlain(worstDrop.quality ?? "none")} at ${worstDrop.timeS.toFixed(1)}s${worstDrop.reason ? ` (${worstDrop.reason})` : ""}.`
      : null;

    return {
      pathId: pathResult.pathId,
      label,
      visiblePct,
      lostSegments: lostEvents.length,
      bestQuality,
      worstMomentSummary,
      lostSegmentLabels,
    };
  });
}

function derivePrivacyFindings(
  result: SimulationResult,
  scene: SecurityScene,
): PrivacyFinding[] {
  const findings: PrivacyFinding[] = [];
  const privacyIssues = result.issues.filter((issue) => issue.category === "privacy");

  for (const issue of privacyIssues) {
    for (const zoneId of issue.affectedZones) {
      const zoneNode = scene.privacyZones.find((z) => z.id === zoneId || z.label === zoneId);
      findings.push({
        zoneId,
        label: zoneNode?.label ?? zoneId,
        cameras: issue.affectedCameras,
        issue: `${issue.affectedCameras.length > 0 ? issue.affectedCameras.join(", ") : "Camera"} sees into privacy-marked area "${zoneNode?.label ?? zoneId}".`,
      });
    }
  }

  return findings;
}

function deriveAssumptions(
  scene: SecurityScene,
  result: SimulationResult | null,
): AssumptionEntry[] {
  const assumptions: AssumptionEntry[] = [];
  const a = scene.assumptions;

  assumptions.push({
    label: "Quality standard",
    value: a.doriStandard === "oodpcvs_2025" ? "IEC 62676-4:2025 OODPCVS (7 levels)" : "DORI 2014 (4 levels)",
    impact: "Determines which PPM thresholds define detection, observation, recognition, and identification.",
  });

  assumptions.push({
    label: "Person height",
    value: `${a.personHeightM}m`,
    impact: "Coverage quality is evaluated at this target height.",
  });

  assumptions.push({
    label: "Time of day",
    value: a.timeOfDay,
    impact: a.timeOfDay === "night"
      ? "Night conditions apply IR and lighting penalties."
      : "Daytime conditions assumed; night coverage is estimated from IR/light configuration.",
  });

  if (result) {
    assumptions.push({
      label: "Grid sampling",
      value: `${result.coverageCells.length} cells`,
      impact: "Coverage is sampled on a discrete grid, not continuous certification.",
    });
  }

  if (a.backlightIntensity !== "none") {
    assumptions.push({
      label: "Backlight",
      value: a.backlightIntensity,
      impact: "Backlight from windows/doors behind subject reduces face/body contrast.",
    });
  }

  if (a.glareIntensity !== "none") {
    assumptions.push({
      label: "Glare",
      value: a.glareIntensity,
      impact: "Reflective surfaces or wet floors may reduce effective quality.",
    });
  }

  return assumptions;
}

function deriveLimitations(): string[] {
  return [
    "Recognition and identification are estimated planning labels, not forensic guarantees.",
    "Night mode uses configured IR and light assumptions, not measured illuminance.",
    "Coverage is sampled on a grid, not a continuous surface certification.",
    "Real camera footage has not been verified unless a reference frame is attached.",
    "Camera specs use selected presets; actual sensor performance may differ.",
  ];
}

function deriveVerificationLabel(rec: Recommendation): VerificationLabel {
  if (rec.verified) return "verified_by_simulation";
  if (rec.type === "add_camera" || rec.type === "add_light") return "requires_user_input";
  if (!rec.affectedNodeId) return "assumption_based";
  return "not_yet_tested";
}

function buildBeforeAfterSummary(
  rec: Recommendation,
  result: SimulationResult | null,
): string | null {
  if (!rec.estimatedImpact) return null;
  if (rec.estimatedImpact.toLowerCase().includes("simulated")) {
    return rec.estimatedImpact;
  }
  return null;
}

function toIssueCards(
  issues: SecurityIssue[],
  result: SimulationResult | null,
  scene: SecurityScene,
): OutcomeIssueCard[] {
  return sortIssuesBySeverity(issues).map((issue, index) => {
    let productExplanation = issue.description;

    if (issue.category === "quality_fail") {
      const affectedZone = result?.criticalZoneResults.find((z) =>
        issue.affectedZones.includes(z.label) || issue.affectedZones.includes(z.zoneId),
      );
      if (affectedZone && affectedZone.actualQuality !== "none") {
        productExplanation = `${affectedZone.label} is visible but not at the required ${qualityLabelPlain(affectedZone.requiredQuality)} level. Current quality: ${qualityLabelPlain(affectedZone.actualQuality)}.`;
      } else if (affectedZone) {
        productExplanation = `${affectedZone.label} has no camera coverage. No camera can currently see this zone.`;
      }
    }

    if (issue.category === "blindspot") {
      productExplanation = issue.description.replace(/is obstructing coverage in:/i, "blocks the camera's line of sight in:");
    }

    if (issue.category === "privacy") {
      productExplanation = issue.description.replace(
        /is visible in \d+ sampled cells/i,
        "sees into a privacy-marked area",
      );
    }

    if (issue.category === "night") {
      productExplanation = issue.description.includes("degrad")
        ? `Night conditions reduce useful detail: ${issue.description}`
        : issue.description;
    }

    if (issue.category === "redundancy") {
      productExplanation = issue.description.includes("single")
        ? `${issue.description} If this camera goes offline, the zone loses required-quality coverage.`
        : issue.description;
    }

    return {
      id: `issue_${index}_${issue.category}`,
      severity: issue.severity,
      category: issue.category,
      description: issue.description,
      affectedZones: issue.affectedZones,
      affectedCameras: issue.affectedCameras,
      productExplanation,
    };
  });
}

function deriveMissingPrerequisites(scene: SecurityScene, result: SimulationResult | null): string[] {
  const missing: string[] = [];
  if (scene.cameras.length === 0) {
    missing.push("No cameras placed. Add cameras to compute coverage.");
  }
  if (scene.criticalZones.length === 0) {
    missing.push("No critical zones defined. Add zones with quality requirements to measure pass/fail.");
  }
  if (scene.paths.length === 0 && result) {
    missing.push("No incident path defined. Add a route from entry to critical zone to test whether a subject remains visible.");
  }
  if (scene.entryPoints.length === 0) {
    missing.push("No entry points defined. Mark doors and gates to enable adversarial path analysis.");
  }
  return missing;
}

function qualityLabelPlain(quality: DoriQuality): string {
  return quality.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function qualityLabel(quality: DoriQuality): string {
  return qualityLabelPlain(quality);
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
        summary: "Simulation has not been run yet.",
        primaryRisk: null,
        recommendedNextAction: "Run the simulation to compute the security outcome.",
        coveragePct: null,
        blindspotPct: null,
        criticalZonesPassing: 0,
        criticalZonesTotal: scene.criticalZones.length,
        recognitionAreaPct: null,
        identificationAreaPct: null,
        averageQualityLabel: "N/A",
        worstAreaQuality: "N/A",
        worstIssue: null,
        issueCount: 0,
        nightReadiness: "unknown",
        redundancyStatus: "unknown",
      },
      topIssues: [],
      allIssues: [],
      failedZones: [],
      cameraFindings: [],
      pathFindings: [],
      privacyFindings: [],
      recommendations: [],
      pathOutcome: null,
      assumptions: deriveAssumptions(scene, null),
      limitations: deriveLimitations(),
      missingPrerequisites: deriveMissingPrerequisites(scene, null),
    };
  }

  const issueCards = toIssueCards(result.issues, result, scene);
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

  const recommendations: OutcomeRecommendationCard[] = result.recommendations.map((rec, index) => ({
    ...rec,
    id: `rec_${index}_${rec.type}`,
    verificationLabel: deriveVerificationLabel(rec),
    beforeAfterSummary: buildBeforeAfterSummary(rec, result),
  }));

  const pathResult = activePath ? result.pathResults.find((entry) => entry.pathId === activePath.id) ?? null : null;

  const avgQuality = result.averageWalkableQuality;
  const avgQualityLabel = avgQuality === 0 ? "None"
    : avgQuality < 1.5 ? "Detection"
    : avgQuality < 3 ? "Observation"
    : avgQuality < 5 ? "Recognition"
    : "Identification";

  return {
    summary: {
      status,
      headline: buildHeadline(status, worstIssue, result, scene),
      summary: buildSummary(status, result, scene),
      primaryRisk: buildPrimaryRisk(result, worstIssue),
      recommendedNextAction: buildRecommendedNextAction(result, recommendations, scene),
      coveragePct: result.totalCoveragePct,
      blindspotPct: result.blindspotPct,
      criticalZonesPassing: passCount,
      criticalZonesTotal: totalZones,
      recognitionAreaPct: result.recognitionAreaPct,
      identificationAreaPct: result.identificationAreaPct,
      averageQualityLabel: avgQualityLabel,
      worstAreaQuality: qualityLabelPlain(result.worstAreaQuality),
      worstIssue,
      issueCount: issueCards.length,
      nightReadiness: deriveNightReadiness(scene, result),
      redundancyStatus: deriveRedundancyStatus(result),
    },
    topIssues: issueCards.slice(0, 5),
    allIssues: issueCards,
    failedZones: deriveFailedZones(result, scene, recommendations),
    cameraFindings: deriveCameraFindings(result, scene),
    pathFindings: derivePathFindings(result, scene),
    privacyFindings: derivePrivacyFindings(result, scene),
    recommendations,
    pathOutcome: pathResult
      ? {
          pathLabel: activePath?.label ?? pathResult.pathId,
          totalDurationS: pathResult.totalDurationS,
          visibleDurationS: pathResult.visibleDurationS,
          lostDurationS: pathResult.lostDurationS,
        }
      : null,
    assumptions: deriveAssumptions(scene, result),
    limitations: deriveLimitations(),
    missingPrerequisites: deriveMissingPrerequisites(scene, result),
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
