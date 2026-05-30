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
  fixesFinding: CauseCategory | null;
  scorecardDelta: {
    description: string;
    estimatedChange: "improvement" | "neutral" | "unknown";
  } | null;
};

export type CauseCategory =
  | "occlusion"
  | "distance"
  | "fov"
  | "camera_angle"
  | "lighting"
  | "night_mode"
  | "camera_status"
  | "material_glare"
  | "privacy"
  | "redundancy";

export type CauseSeverity = "critical" | "high" | "medium" | "low";

export type CauseFinding = {
  category: CauseCategory;
  label: string;
  description: string;
  productExplanation: string;
  affectedZoneIds: string[];
  affectedCameraIds: string[];
  severity: CauseSeverity;
};

export type SecurityScorecardDimension = {
  score: number;
  label: string;
  detail?: string;
};

export type SecurityScorecard = {
  overall: number;
  overallLabel: string;
  dimensions: {
    coverage: SecurityScorecardDimension;
    zoneCompliance: SecurityScorecardDimension & { passing: number; total: number };
    redundancy: SecurityScorecardDimension;
    nightReadiness: SecurityScorecardDimension;
    pathVisibility: SecurityScorecardDimension;
    privacy: SecurityScorecardDimension;
  };
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
  causeCategories: CauseCategory[];
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
  scorecard: SecurityScorecard;
  topIssues: OutcomeIssueCard[];
  allIssues: OutcomeIssueCard[];
  causeTaxonomy: CauseFinding[];
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

    const causeCategories: CauseCategory[] = zone.status !== "pass"
      ? deriveCauseCategoriesForZone(zone, result.cameraResults)
      : [];

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
      causeCategories,
      recommendedActionIds: recIds,
    };
  });
}

function deriveCauseCategoriesForZone(
  zone: { label: string; failureReasons: string[]; coveringCameras: string[]; actualQuality: DoriQuality },
  cameraResults: SimulationResult["cameraResults"],
): CauseCategory[] {
  const categories = new Set<CauseCategory>();

  for (const reason of zone.failureReasons) {
    const cause = classifyCauseFromText(reason);
    if (cause) categories.add(cause);
  }

  if (zone.actualQuality === "none" && !categories.has("distance") && !categories.has("fov") && !categories.has("occlusion")) {
    categories.add("camera_angle");
  }

  if (zone.coveringCameras.length <= 1) {
    categories.add("redundancy");
  }

  return CAUSE_CATEGORY_ORDER.filter((c) => categories.has(c));
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

const RECOMMENDATION_TYPE_TO_CAUSE: Record<string, CauseCategory> = {
  move_object: "occlusion",
  rotate_camera: "camera_angle",
  add_camera: "fov",
  add_light: "lighting",
  change_fov: "fov",
};

function deriveRecommendationFixingCause(
  rec: Recommendation,
  result: SimulationResult,
): CauseCategory | null {
  const fromType = RECOMMENDATION_TYPE_TO_CAUSE[rec.type];
  if (fromType) return fromType;

  const lower = rec.description.toLowerCase();
  const causePatterns: { pattern: RegExp; cause: CauseCategory }[] = [
    { pattern: /blocked|obstruction|shelf|cupboard/i, cause: "occlusion" },
    { pattern: /re-aim|rotate|angle|position|pan|tilt/i, cause: "camera_angle" },
    { pattern: /light|illuminat|bright/i, cause: "lighting" },
    { pattern: /night|ir|thermal|low.light/i, cause: "night_mode" },
    { pattern: /add.*camera|new camera|extra camera/i, cause: "redundancy" },
    { pattern: /fov|field.of.view|zoom|lens/i, cause: "fov" },
    { pattern: /privacy|mask/i, cause: "privacy" },
    { pattern: /glare|reflection|glass/i, cause: "material_glare" },
    { pattern: /range|distance|far/i, cause: "distance" },
    { pattern: /restore|fix|repair|replace.*camera/i, cause: "camera_status" },
  ];

  for (const entry of causePatterns) {
    if (entry.pattern.test(lower)) return entry.cause;
  }

  return null;
}

function deriveRecommendationScorecardDelta(
  rec: Recommendation,
): { description: string; estimatedChange: "improvement" | "neutral" | "unknown" } | null {
  if (!rec.estimatedImpact) return null;
  const lower = rec.estimatedImpact.toLowerCase();

  if (lower.includes("improve") || lower.includes("change")) {
    const qualityMatch = lower.match(/(\w+)\s+to\s+(\w+)/);
    if (qualityMatch) {
      return {
        description: `Quality improves: ${qualityMatch[1]} → ${qualityMatch[2]}`,
        estimatedChange: "improvement",
      };
    }
    if (lower.includes("improve")) {
      return {
        description: "Simulated improvement expected",
        estimatedChange: "improvement",
      };
    }
  }

  if (lower.includes("simulated")) {
    return {
      description: rec.estimatedImpact,
      estimatedChange: "improvement",
    };
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

export const CAUSE_CATEGORY_PRODUCT_LABELS: Record<CauseCategory, string> = {
  occlusion: "Line of sight is blocked",
  distance: "Camera is too far away",
  fov: "Area falls outside camera field of view",
  camera_angle: "Camera angle reduces usable detail",
  lighting: "Lighting conditions reduce image quality",
  night_mode: "Night conditions reduce useful detail",
  camera_status: "Camera is off, blocked, or degraded",
  material_glare: "Glass, reflections, or glare reduce quality",
  privacy: "Camera sees a privacy-marked area",
  redundancy: "No backup camera at required quality",
};

export const CAUSE_CATEGORY_ORDER: CauseCategory[] = [
  "occlusion",
  "distance",
  "fov",
  "camera_angle",
  "lighting",
  "night_mode",
  "camera_status",
  "material_glare",
  "privacy",
  "redundancy",
];

const REASON_CODE_TO_CAUSE: Record<string, CauseCategory> = {
  CAMERA_OFF: "camera_status",
  OUT_OF_RANGE: "distance",
  OUT_OF_FOV: "fov",
  BLOCKED_BY_SOLID: "occlusion",
  EDGE_OF_FOV: "camera_angle",
  DIRTY_CAMERA: "camera_status",
  MOUNT_TILT_EXCEEDED: "camera_angle",
  BLIND_SPOT_UNDER_CAMERA: "camera_angle",
  PARTIAL_MATERIAL: "material_glare",
  GLARE_RISK: "material_glare",
  LOW_PPM: "distance",
  LOW_LIGHT: "lighting",
  IR_RANGE: "night_mode",
  THERMAL_MODE: "night_mode",
  REFLECTIVE_BOUNCE: "material_glare",
};

const FAILURE_CAUSE_PATTERNS: { pattern: RegExp; category: CauseCategory }[] = [
  { pattern: /blocked by/i, category: "occlusion" },
  { pattern: /out of range|too far|range limit/i, category: "distance" },
  { pattern: /out of fov|field of view/i, category: "fov" },
  { pattern: /night penalty|night mode|night condition/i, category: "night_mode" },
  { pattern: /low light|lighting penalty|backlight|overexposed/i, category: "lighting" },
  { pattern: /ir not active|camera off|blocked camera|dirty|malfunctioning/i, category: "camera_status" },
  { pattern: /glare|reflection|glass penalty|partial material|reflective/i, category: "material_glare" },
  { pattern: /privacy|private zone/i, category: "privacy" },
  { pattern: /no redundancy|single point|no backup/i, category: "redundancy" },
];

function classifyCauseFromText(text: string): CauseCategory | null {
  for (const entry of FAILURE_CAUSE_PATTERNS) {
    if (entry.pattern.test(text)) return entry.category;
  }
  return null;
}

function deriveCauseTaxonomy(
  result: SimulationResult,
  scene: SecurityScene,
  issues: OutcomeIssueCard[],
  failedZones: FailedZoneDetail[],
): CauseFinding[] {
  const findingsByCategory = new Map<CauseCategory, CauseFinding>();

  const addFinding = (
    category: CauseCategory,
    description: string,
    severity: CauseSeverity,
    zoneIds: string[],
    cameraIds: string[],
  ) => {
    const existing = findingsByCategory.get(category);
    if (existing) {
      for (const zid of zoneIds) {
        if (!existing.affectedZoneIds.includes(zid)) existing.affectedZoneIds.push(zid);
      }
      for (const cid of cameraIds) {
        if (!existing.affectedCameraIds.includes(cid)) existing.affectedCameraIds.push(cid);
      }
      if (CAUSE_CATEGORY_ORDER.indexOf(category) < CAUSE_CATEGORY_ORDER.indexOf(CAUSE_CATEGORY_ORDER.find((c) => findingsByCategory.get(c)?.severity === severity) ?? category)) {
        existing.severity = severity;
      }
      return;
    }
    findingsByCategory.set(category, {
      category,
      label: CAUSE_CATEGORY_PRODUCT_LABELS[category],
      description,
      productExplanation: "",
      affectedZoneIds: zoneIds,
      affectedCameraIds: cameraIds,
      severity,
    });
  };

  for (const zone of failedZones) {
    if (zone.status === "pass") continue;

    const categories = new Set<CauseCategory>();

    for (const reason of zone.failureReasons) {
      const cause = classifyCauseFromText(reason);
      if (cause) {
        categories.add(cause);
        const severity: CauseSeverity = zone.priority === "critical" ? "critical" : zone.actualQuality === "none" ? "high" : "medium";
        addFinding(cause, reason, severity, [zone.zoneId], zone.coveringCameras);
      }
    }

    if (zone.actualQuality === "none" && !categories.has("distance") && !categories.has("fov") && !categories.has("occlusion")) {
      addFinding("camera_angle", `${zone.label} has no camera coverage`, "high", [zone.zoneId], zone.coveringCameras);
    }

    if (zone.coveringCameras.length <= 1) {
      addFinding("redundancy", `${zone.label} has no backup at required quality`, "medium", [zone.zoneId], zone.coveringCameras);
    }
  }

  for (const issue of issues) {
    if (issue.category === "privacy") {
      addFinding("privacy", issue.description, "medium", issue.affectedZones, issue.affectedCameras);
    }
    if (issue.category === "night") {
      addFinding("night_mode", issue.description, issue.severity === "critical" ? "critical" : "high", issue.affectedZones, issue.affectedCameras);
    }
  }

  for (const camera of result.cameraResults) {
    const coverageCells = result.coverageCells.filter((cell) => cell.coveringCameras.includes(camera.cameraId));
    for (const cell of coverageCells) {
      const evalData = cell.cameraEvaluations?.[camera.cameraId];
      if (!evalData) continue;
      for (const code of evalData.reasonCodes ?? []) {
        const baseCode = code.split(":")[0];
        const cause = REASON_CODE_TO_CAUSE[baseCode];
        if (cause && !findingsByCategory.has(cause)) {
          const cameraNode = scene.cameras.find((c) => c.id === camera.cameraId);
          addFinding(cause, `${baseCode} for ${cameraNode?.name ?? camera.cameraId}`, "low", [], [camera.cameraId]);
        }
      }
    }
  }

  for (const privacyFinding of result.issues.filter((i) => i.category === "privacy")) {
    addFinding("privacy", privacyFinding.description, "medium", privacyFinding.affectedZones, privacyFinding.affectedCameras);
  }

  const sorted = CAUSE_CATEGORY_ORDER
    .map((cat) => findingsByCategory.get(cat))
    .filter((f): f is CauseFinding => !!f);

  const severityRank: Record<CauseSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  for (const finding of sorted) {
    finding.productExplanation = buildCauseProductExplanation(finding);
  }

  return sorted.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function buildCauseProductExplanation(finding: CauseFinding): string {
  const zoneCount = finding.affectedZoneIds.length;
  const cameraCount = finding.affectedCameraIds.length;
  const zoneSuffix = zoneCount === 1 ? "1 zone" : `${zoneCount} zones`;
  const cameraSuffix = cameraCount === 1 ? "1 camera" : `${cameraCount} cameras`;

  switch (finding.category) {
    case "occlusion":
      return `An obstruction blocks the camera's line of sight, affecting ${zoneSuffix} and ${cameraSuffix}.`;
    case "distance":
      return `Cameras are too far from ${zoneSuffix} to provide the required level of detail.`;
    case "fov":
      return `${cameraSuffix} cannot physically see ${zoneSuffix} — they fall outside the camera's field of view.`;
    case "camera_angle":
      return `Camera angle or position limits useful detail for ${zoneSuffix}.`;
    case "lighting":
      return `Poor lighting reduces image quality in ${zoneSuffix} — adding lights or switching camera night mode may help.`;
    case "night_mode":
      return `Night conditions reduce useful camera detail. IR illuminators or low-light cameras can improve coverage in ${zoneSuffix}.`;
    case "camera_status":
      return `${cameraSuffix} is off, blocked, or degraded. Restoring or replacing the camera affects ${zoneSuffix}.`;
    case "material_glare":
      return `Glass, reflections, or glare between ${cameraSuffix} and ${zoneSuffix} reduce effective image quality.`;
    case "privacy":
      return `${cameraSuffix} can see into a privacy-marked area. Configure privacy masking to restrict the field of view in applicable zones.`;
    case "redundancy":
      return `${zoneSuffix} relies on ${cameraSuffix}. If that camera goes offline, the zone loses required-quality coverage. Add overlapping coverage.`;
  }
}

function deriveScorecard(
  result: SimulationResult,
  scene: SecurityScene,
  summary: SecurityOutcomeSummary,
  privacyFindings: PrivacyFinding[],
  pathFindings: PathFinding[],
): SecurityScorecard {
  const coverageScore = Math.round(Math.min(100, Math.max(0, result.totalCoveragePct)));
  const zonesTotal = result.criticalZoneResults.length;
  const zonesPassing = result.criticalZoneResults.filter((z) => z.status === "pass").length;
  const zoneComplianceScore = zonesTotal > 0 ? Math.round((zonesPassing / zonesTotal) * 100) : 100;

  const redundancyScore = (() => {
    if (summary.redundancyStatus === "robust") return 100;
    if (summary.redundancyStatus === "single_point_failure") return 50;
    if (summary.redundancyStatus === "fails") return 0;
    return 50;
  })();

  const nightReadinessScore = (() => {
    if (summary.nightReadiness === "good") return 100;
    if (summary.nightReadiness === "weak") return 40;
    if (summary.nightReadiness === "fails") return 0;
    return 75;
  })();

  const pathVisibilityScore = (() => {
    if (pathFindings.length === 0) return 50;
    const avgVisible = pathFindings.reduce((sum, p) => sum + p.visiblePct, 0) / pathFindings.length;
    if (avgVisible >= 80) return 100;
    if (avgVisible >= 50) return 60;
    if (avgVisible > 0) return 30;
    return 0;
  })();

  const privacyScore = (() => {
    if (privacyFindings.length === 0) return 100;
    if (privacyFindings.length <= 2) return 50;
    return 20;
  })();

  const allScores = [
    coverageScore,
    zoneComplianceScore,
    redundancyScore,
    nightReadinessScore,
    pathVisibilityScore,
    privacyScore,
  ];
  const overall = Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length);

  const overallLabel = (() => {
    if (overall >= 85) return "Good";
    if (overall >= 60) return "Needs improvement";
    if (overall >= 35) return "At risk";
    return "Poor";
  })();

  return {
    overall,
    overallLabel,
    dimensions: {
      coverage: {
        score: coverageScore,
        label: coverageScore >= 80 ? "Adequate" : coverageScore >= 50 ? "Partial" : "Insufficient",
        detail: `${coverageScore}% of walkable area covered`,
      },
      zoneCompliance: {
        score: zoneComplianceScore,
        label: zonesPassing === zonesTotal ? "All passing" : `${zonesPassing}/${zonesTotal} passing`,
        passing: zonesPassing,
        total: zonesTotal,
        detail: `${zonesPassing}/${zonesTotal} critical zones meet their quality requirements`,
      },
      redundancy: {
        score: redundancyScore,
        label: summary.redundancyStatus === "robust" ? "Adequate overlap" : summary.redundancyStatus === "single_point_failure" ? "Single points of failure" : "Redundancy failures",
        detail: summary.redundancyStatus.replace(/_/g, " "),
      },
      nightReadiness: {
        score: nightReadinessScore,
        label: summary.nightReadiness === "good" ? "Night-ready" : summary.nightReadiness === "weak" ? "Night-weak" : summary.nightReadiness === "fails" ? "Night-fails" : "Unknown",
        detail: `Assumption: ${scene.assumptions.timeOfDay}`,
      },
      pathVisibility: {
        score: pathVisibilityScore,
        label: pathFindings.length === 0 ? "No paths" : pathVisibilityScore >= 80 ? "Good path visibility" : pathVisibilityScore >= 50 ? "Partial path visibility" : "Poor path visibility",
        detail: `${pathFindings.length} path(s) modeled`,
      },
      privacy: {
        score: privacyScore,
        label: privacyFindings.length === 0 ? "No privacy issues" : `${privacyFindings.length} privacy finding(s)`,
        detail: `Privacy zones: ${scene.privacyZones.length}`,
      },
    },
  };
}

export function buildSecurityOutcomeModel(
  scene: SecurityScene,
  result: SimulationResult | null,
  activePath: ScenarioPath | null,
): SecurityOutcomeModel {
  if (!result) {
    const emptyScorecard: SecurityScorecard = {
      overall: 0,
      overallLabel: "No data",
      dimensions: {
        coverage: { score: 0, label: "No data", detail: "Run simulation" },
        zoneCompliance: { score: 0, label: "No data", passing: 0, total: scene.criticalZones.length, detail: "Run simulation" },
        redundancy: { score: 0, label: "No data", detail: "Run simulation" },
        nightReadiness: { score: 0, label: "No data", detail: "Run simulation" },
        pathVisibility: { score: 0, label: "No data", detail: "Run simulation" },
        privacy: { score: 0, label: "No data", detail: "Run simulation" },
      },
    };

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
      scorecard: emptyScorecard,
      topIssues: [],
      allIssues: [],
      causeTaxonomy: [],
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
    fixesFinding: deriveRecommendationFixingCause(rec, result),
    scorecardDelta: deriveRecommendationScorecardDelta(rec),
  }));

  const pathResult = activePath ? result.pathResults.find((entry) => entry.pathId === activePath.id) ?? null : null;

  const avgQuality = result.averageWalkableQuality;
  const avgQualityLabel = avgQuality === 0 ? "None"
    : avgQuality < 1.5 ? "Detection"
    : avgQuality < 3 ? "Observation"
    : avgQuality < 5 ? "Recognition"
    : "Identification";

  const failedZoneResults = deriveFailedZones(result, scene, recommendations);
  const pathFindings = derivePathFindings(result, scene);
  const privacyFindings = derivePrivacyFindings(result, scene);
  const cameraFindings = deriveCameraFindings(result, scene);

  const causeTaxonomy = deriveCauseTaxonomy(result, scene, issueCards, failedZoneResults);

  const scorecard = deriveScorecard(result, scene, {
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
  }, privacyFindings, pathFindings);

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
    scorecard,
    topIssues: issueCards.slice(0, 5),
    allIssues: issueCards,
    causeTaxonomy,
    failedZones: failedZoneResults,
    cameraFindings,
    pathFindings,
    privacyFindings,
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
