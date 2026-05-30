import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import type { SimulationResult } from "@/schema/security-scene";
import { buildSecurityOutcomeModel, buildSecurityOutcomeDelta, CAUSE_CATEGORY_PRODUCT_LABELS } from "@/lib/security-outcome/security-outcome-model";
import {
  explainFailureReason,
  explainQualityGap,
  explainCameraOfflineImpact,
  explainPrivacyIssue,
  explainPathLoss,
  explainPathEmpty,
  explainNoZones,
  explainNoCameras,
  qualityIsBelow,
  verificationLabel,
  costLabel,
} from "@/lib/security-outcome/security-outcome-copy";

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    computedAt: Date.now(),
    totalCoveragePct: 68,
    blindspotPct: 32,
    averageWalkableQuality: 2.1,
    worstAreaQuality: "detection",
    recognitionAreaPct: 34,
    identificationAreaPct: 12,
    coverageByQuality: { detection: 42, observation: 20, recognition: 28, identification: 10 },
    coverageCells: [],
    criticalZoneResults: [],
    cameraResults: [],
    pathResults: [],
    issues: [],
    recommendations: [],
    ...overrides,
  };
}

describe("security outcome model — enriched", () => {
  test("returns not_run when simulation is missing", () => {
    const scene = createSmallRetailShopScene();
    const model = buildSecurityOutcomeModel(scene, null, null);
    expect(model.summary.status).toBe("not_run");
    expect(model.summary.coveragePct).toBeNull();
    expect(model.summary.primaryRisk).toBeNull();
    expect(model.summary.recommendedNextAction).toBeTruthy();
    expect(model.zoneFindings).toEqual([]);
    expect(model.failedZones).toEqual([]);
    expect(model.cameraFindings).toEqual([]);
    expect(model.pathFindings).toEqual([]);
    expect(model.privacyFindings).toEqual([]);
    expect(model.assumptions.length).toBeGreaterThan(0);
    expect(model.limitations.length).toBeGreaterThan(0);
    expect(model.missingPrerequisites).toBeDefined();
  });

  test("returns pass when critical zones pass and no issues", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "recognition",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "pass",
        failureReasons: [],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.summary.status).toBe("pass");
    expect(model.zoneFindings.length).toBe(1);
    expect(model.zoneFindings[0].status).toBe("pass");
    expect(model.zoneFindings[0].causeSummary).toBe("");
    expect(model.failedZones).toHaveLength(0);
  });

  test("returns high_risk when zone fails with obstruction issue", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Blocked by shelf"],
      }],
      issues: [{
        severity: "critical",
        category: "quality_fail",
        description: "Cash counter below recognition",
        affectedZones: ["z1"],
        affectedCameras: ["cam_1"],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.summary.status).toBe("high_risk");
    expect(model.summary.worstIssue?.description).toContain("Cash counter");
    expect(model.summary.primaryRisk).toBeTruthy();
    expect(model.failedZones[0].causeSummary).toBeTruthy();
    expect(model.failedZones[0].productFailureReasons.length).toBeGreaterThan(0);
  });

  test("derives summary metrics from result", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "recognition",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "pass",
        failureReasons: [],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.summary.coveragePct).toBe(68);
    expect(model.summary.blindspotPct).toBe(32);
    expect(model.summary.criticalZonesPassing).toBe(1);
    expect(model.summary.criticalZonesTotal).toBe(1);
    expect(model.summary.recognitionAreaPct).toBe(34);
    expect(model.summary.identificationAreaPct).toBe(12);
    expect(model.summary.averageQualityLabel).toBeTruthy();
  });

  test("builds camera findings with role summaries", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      cameraResults: [{
        cameraId: "cam_1",
        coveragePct: 44,
        qualityByZone: {},
        criticalZonesCovered: ["z1"],
        criticalZonesFailed: ["z2"],
        offlineImpact: ["Cash Counter degrades"],
        offlineImpactDetail: [{
          zoneId: "z1",
          label: "Cash Counter",
          beforeQuality: "recognition",
          afterQuality: "none",
          beforeStatus: "pass",
          afterStatus: "fail",
          reason: "Single point failure",
        }],
      }],
      criticalZoneResults: [
        { zoneId: "z1", label: "Cash Counter", requiredQuality: "recognition", actualQuality: "recognition", coveringCameras: ["cam_1"], redundancyCameraCount: 1, status: "pass", failureReasons: [] },
        { zoneId: "z2", label: "Entry Door", requiredQuality: "identification", actualQuality: "observation", coveringCameras: ["cam_1"], redundancyCameraCount: 1, status: "fail", failureReasons: ["Too far"] },
      ],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.cameraFindings.length).toBe(1);
    expect(model.cameraFindings[0].cameraName).toBeTruthy();
    expect(model.cameraFindings[0].roleSummary).toBeTruthy();
    expect(model.cameraFindings[0].offlineImpactSummary).toBeTruthy();
    expect(model.cameraFindings[0].zonesPassed.length).toBe(1);
    expect(model.cameraFindings[0].zonesFailed.length).toBe(1);
  });

  test("builds path findings with detail", () => {
    const scene = createSmallRetailShopScene();
    const activePath = scene.paths[0] ?? null;
    const pathId = activePath?.id ?? "path_1";
    const result = makeResult({
      pathResults: [{
        pathId,
        totalDurationS: 12,
        visibleDurationS: 7.2,
        lostDurationS: 4.8,
        visibilityByCamera: {
          cam_1: { cameraId: "cam_1", visibleS: 7.2, maxQuality: "recognition" },
        },
        timeline: [
          { timeS: 0, event: "visible", cameraId: "cam_1" },
          { timeS: 4.3, event: "lost", reason: "Behind shelf" },
          { timeS: 5.8, event: "visible", cameraId: "cam_1" },
          { timeS: 6.0, event: "quality_change", quality: "detection", reason: "Obstruction" },
        ],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, activePath);
    expect(model.pathFindings.length).toBe(1);
    expect(model.pathFindings[0].visiblePct).toBe(60);
    expect(model.pathFindings[0].lostSegments).toBe(1);
    expect(model.pathFindings[0].bestQuality).toBeTruthy();
    expect(model.pathFindings[0].lostSegmentLabels.length).toBeGreaterThan(0);
  });

  test("builds privacy findings from issues", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      issues: [{
        severity: "medium",
        category: "privacy",
        description: "Camera sees into private area",
        affectedZones: ["priv_1"],
        affectedCameras: ["cam_1"],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.privacyFindings.length).toBe(1);
    expect(model.privacyFindings[0].cameras).toEqual(["cam_1"]);
    expect(model.privacyFindings[0].issue).toContain("privacy");
  });

  test("builds structured assumptions", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.assumptions.length).toBeGreaterThanOrEqual(3);
    const labels = model.assumptions.map((a) => a.label);
    expect(labels.some((l) => l.toLowerCase().includes("quality") || l.toLowerCase().includes("standard"))).toBe(true);
    expect(model.assumptions[0].impact).toBeTruthy();
  });

  test("builds limitations", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.limitations.length).toBeGreaterThanOrEqual(3);
    const allText = model.limitations.join(" ").toLowerCase();
    expect(allText).toContain("planning");
    expect(allText).toContain("grid");
  });

  test("summary has recommendedNextAction when verified rec exists", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Blocked by shelf"],
      }],
      issues: [{
        severity: "high",
        category: "quality_fail",
        description: "Cash counter below recognition",
        affectedZones: ["z1"],
        affectedCameras: ["cam_1"],
      }],
      recommendations: [{
        type: "rotate_camera",
        description: "Rotate Camera 2 toward counter",
        estimatedImpact: "Observation to Recognition",
        costCategory: "free",
        verified: true,
        affectedNodeId: "cam_1",
        suggestedYawDeg: 12,
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.summary.recommendedNextAction).toBe("Rotate Camera 2 toward counter");
  });

  test("derives camera offline redundancy status", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      cameraResults: [{
        cameraId: "cam_1",
        coveragePct: 44,
        qualityByZone: {},
        criticalZonesCovered: ["z1"],
        criticalZonesFailed: [],
        offlineImpact: ["Cash Counter degrades"],
        offlineImpactDetail: [{
          zoneId: "z1",
          label: "Cash Counter",
          beforeQuality: "recognition",
          afterQuality: "none",
          beforeStatus: "pass",
          afterStatus: "fail",
          reason: "Single point failure",
        }],
      }],
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "recognition",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "pass",
        failureReasons: [],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.summary.redundancyStatus).toBe("fails");
  });

  test("delta computes before/after changes", () => {
    const before = makeResult({
      totalCoveragePct: 50,
      blindspotPct: 40,
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: [],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "fail", affectedZones: ["z1"], affectedCameras: [] }],
    });
    const after = makeResult({
      totalCoveragePct: 70,
      blindspotPct: 25,
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "recognition",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "pass",
        failureReasons: [],
      }],
    });
    const delta = buildSecurityOutcomeDelta(before, after);
    expect(delta).not.toBeNull();
    expect(delta!.coverageDeltaPct).toBe(20);
    expect(delta!.blindspotDeltaPct).toBe(-15);
    expect(delta!.issuesDelta).toBe(-1);
    expect(delta!.criticalZonesPassingAfter).toBe(1);
    expect(delta!.criticalZonesPassingBefore).toBe(0);
  });

  test("failed zone with no covering cameras has actionable cause", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Storage Door",
        requiredQuality: "detection",
        actualQuality: "none",
        coveringCameras: [],
        redundancyCameraCount: 0,
        status: "fail",
        failureReasons: [],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    const failedZone = model.failedZones[0];
    expect(failedZone.causeSummary).toBeTruthy();
    expect(failedZone.causeSummary.toLowerCase()).toContain("no camera");
    expect(failedZone.productFailureReasons.length).toBeGreaterThan(0);
  });

  test("issue cards include product explanation for quality_fail", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: [],
      }],
      issues: [{
        severity: "high",
        category: "quality_fail",
        description: "Cash counter below recognition",
        affectedZones: ["z1"],
        affectedCameras: ["cam_1"],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.allIssues[0].productExplanation).toBeTruthy();
    expect(model.allIssues[0].productExplanation.toLowerCase()).not.toBe("Cash counter below recognition");
  });

  test("recommendations have verification labels", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: [],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "fail", affectedZones: ["z1"], affectedCameras: [] }],
      recommendations: [{
        type: "rotate_camera",
        description: "Rotate Camera 2",
        estimatedImpact: "Better quality",
        costCategory: "free",
        verified: true,
        affectedNodeId: "cam_1",
        suggestedYawDeg: 12,
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.recommendations[0].verificationLabel).toBe("verified_by_simulation");
  });

  test("recommendation fixesFinding maps rotate_camera to camera_angle", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: [],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "fail", affectedZones: ["z1"], affectedCameras: [] }],
      recommendations: [{
        type: "rotate_camera",
        description: "Re-aim Camera 2 toward Cash Counter",
        estimatedImpact: "Zone quality improves from observation to recognition",
        costCategory: "low",
        verified: true,
        affectedNodeId: "cam_1",
        suggestedYawDeg: 12,
        suggestedPitchDeg: -30,
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.recommendations[0].fixesFinding).toBe("camera_angle");
  });

  test("recommendation fixesFinding maps move_object to occlusion", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Blocked by Shelf"],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "fail", affectedZones: ["z1"], affectedCameras: [] }],
      recommendations: [{
        type: "move_object",
        description: "Move Shelf away from Cash Counter",
        estimatedImpact: "Simulated zone quality changes from observation to recognition.",
        costCategory: "free",
        verified: true,
        affectedNodeId: "obs_1",
        suggestedPosition: [3, 0, 4] as [number, number, number],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.recommendations[0].fixesFinding).toBe("occlusion");
  });

  test("recommendation fixesFinding is null for unknown type", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [],
      recommendations: [{
        type: "other",
        description: "Review camera placement",
        estimatedImpact: "N/A",
        costCategory: "free",
        verified: false,
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.recommendations[0].fixesFinding).toBeNull();
  });

  test("recommendation scorecardDelta uses estimated impact text", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: [],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "fail", affectedZones: ["z1"], affectedCameras: [] }],
      recommendations: [{
        type: "rotate_camera",
        description: "Rotate Camera 2",
        estimatedImpact: "Simulated zone quality changes from observation to recognition.",
        costCategory: "free",
        verified: true,
        affectedNodeId: "cam_1",
        suggestedYawDeg: 12,
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.recommendations[0].scorecardDelta).not.toBeNull();
    expect(model.recommendations[0].scorecardDelta!.description).toContain("observation → recognition");
    expect(model.recommendations[0].scorecardDelta!.estimatedChange).toBe("improvement");
  });

  test("recommendation scorecardDelta is null for unknown impact", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [],
      recommendations: [{
        type: "other",
        description: "Review",
        estimatedImpact: "",
        costCategory: "free",
        verified: false,
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.recommendations[0].scorecardDelta).toBeNull();
  });

  test("all recommendations have fixesFinding and scorecardDelta fields", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Blocked by Shelf"],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "fail", affectedZones: ["z1"], affectedCameras: [] }],
      recommendations: [
        {
          type: "move_object",
          description: "Move Shelf away",
          estimatedImpact: "Simulated improvement.",
          costCategory: "free",
          verified: true,
          affectedNodeId: "obs_1",
        },
        {
          type: "rotate_camera",
          description: "Rotate Camera 2",
          estimatedImpact: "Improvement expected",
          costCategory: "low",
          verified: true,
          affectedNodeId: "cam_1",
        },
      ],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    for (const rec of model.recommendations) {
      expect(rec).toHaveProperty("fixesFinding");
      expect(rec).toHaveProperty("scorecardDelta");
    }
  });

  test("missing prerequisites surface when no cameras", () => {
    const scene = createSmallRetailShopScene();
    scene.cameras = [];
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    const camMissing = model.missingPrerequisites.find((m) => m.toLowerCase().includes("camera"));
    expect(camMissing).toBeTruthy();
  });
});

describe("security outcome — language mapping", () => {
  test("explainFailureReason maps technical reasons to product language", () => {
    expect(explainFailureReason("Blocked by Shelf 1")).toContain("blocks the camera's line of sight");
    expect(explainFailureReason("Night penalty applied")).toContain("Night conditions reduce useful detail");
    expect(explainFailureReason("Camera out of range")).toContain("too far from this zone");
    expect(explainFailureReason("Out of FOV")).toContain("falls outside the camera's field of view");
    expect(explainFailureReason("No redundancy")).toContain("No backup camera");
    expect(explainFailureReason("Backlight from window")).toContain("backlighting");
    expect(explainFailureReason("Glare on glass")).toContain("Glare or reflections");
    expect(explainFailureReason("Glass material penalty")).toContain("semi-transparent material");
    expect(explainFailureReason("No coverage in zone")).toContain("No camera covers this zone");
  });

  test("explainQualityGap explains quality shortfall", () => {
    expect(explainQualityGap("recognition", "observation")).toContain("not clear enough for recognition");
    expect(explainQualityGap("recognition", "none")).toContain("not visible at all");
    expect(explainQualityGap("recognition", "detection")).toContain("Only presence is detectable");
    expect(explainQualityGap("recognition", "recognition")).toContain("Meets the required quality");
  });

  test("explainCameraOfflineImpact formats offline impact", () => {
    const result = explainCameraOfflineImpact("Camera 1", "Cash Counter", "none");
    expect(result).toContain("Camera 1 goes offline");
    expect(result).toContain("loses all coverage");
    const partial = explainCameraOfflineImpact("Camera 2", "Entry Door", "detection");
    expect(partial).toContain("drops to Detection quality");
  });

  test("explainPrivacyIssue formats privacy finding", () => {
    const single = explainPrivacyIssue(["Camera 1"], "Restroom");
    expect(single).toContain("Camera 1 sees into a privacy-marked area");
    const dual = explainPrivacyIssue(["Camera 1", "Camera 2"], "Restroom");
    expect(dual).toContain("see into a privacy-marked area");
  });

  test("explainPathLoss formats path visibility", () => {
    expect(explainPathLoss("Entry Route", 0)).toContain("not visible to any camera");
    expect(explainPathLoss("Entry Route", 30)).toContain("only 30%");
    expect(explainPathLoss("Entry Route", 70)).toContain("70%");
    expect(explainPathLoss("Entry Route", 70)).toContain("gaps");
  });

  test("explainPathEmpty returns next-action guidance", () => {
    expect(explainPathEmpty()).toContain("No incident path defined");
    expect(explainPathEmpty()).toContain("Add a route");
  });

  test("explainNoZones returns next-action guidance", () => {
    expect(explainNoZones()).toContain("No critical zones defined");
  });

  test("explainNoCameras returns next-action guidance", () => {
    expect(explainNoCameras()).toContain("No cameras placed");
  });

  test("qualityIsBelow compares quality levels correctly", () => {
    expect(qualityIsBelow("observation", "recognition")).toBe(true);
    expect(qualityIsBelow("recognition", "recognition")).toBe(false);
    expect(qualityIsBelow("recognition", "observation")).toBe(false);
    expect(qualityIsBelow("none", "detection")).toBe(true);
  });

  test("verificationLabel returns correct labels", () => {
    expect(verificationLabel(true).label).toBe("Verified by simulation");
    expect(verificationLabel(true).tone).toBe("emerald");
    expect(verificationLabel(false).label).toBe("Not yet tested");
    expect(verificationLabel(false).tone).toBe("amber");
  });

  test("costLabel formats cost categories", () => {
    expect(costLabel("free")).toBe("Free");
    expect(costLabel("low")).toBe("Low cost");
    expect(costLabel("medium")).toBe("Medium cost");
    expect(costLabel("high")).toBe("High cost");
  });
});

describe("security outcome — truth checks", () => {
  test("limitations contain planning indicator disclaimer", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    const allText = model.limitations.join(" ").toLowerCase();
    expect(allText).toContain("planning");
    expect(allText).toContain("not forensic guarantees");
  });

  test("limitations contain grid disclaimer", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    const allText = model.limitations.join(" ").toLowerCase();
    expect(allText).toContain("grid");
  });

  test("limitations contain preset disclaimer", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    const allText = model.limitations.join(" ").toLowerCase();
    expect(allText).toContain("preset");
  });

  test("limitations contain night assumption disclaimer", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    const allText = model.limitations.join(" ").toLowerCase();
    expect(allText).toContain("night");
  });

  test("verification label never claims certainty for unverified recs", () => {
    const label = verificationLabel(false);
    expect(label.label).not.toContain("verified");
    expect(label.label).not.toContain("certain");
  });

  test("verified recs get simulation label, not AI certainty", () => {
    const label = verificationLabel(true);
    expect(label.label).toContain("simulation");
    expect(label.label).not.toContain("AI");
    expect(label.label).not.toContain("certain");
  });

  test("model does not produce AI certainty language in any string field", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "recognition",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "pass",
        failureReasons: [],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    const strings = [
      model.summary.headline,
      model.summary.summary,
      ...model.limitations,
      ...model.assumptions.map((a) => a.impact),
    ];
    for (const str of strings) {
      expect(str.toLowerCase()).not.toContain("ai certainty");
      expect(str.toLowerCase()).not.toContain("100% guaranteed");
    }
  });

  test("model does not produce evasion guidance language", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    const allStrings = [
      ...model.limitations,
      ...model.assumptions.map((a) => a.impact),
      ...model.failedZones.flatMap((z) => [z.causeSummary, ...z.productFailureReasons]),
    ];
    for (const str of allStrings) {
      expect(str.toLowerCase()).not.toContain("avoid cameras");
      expect(str.toLowerCase()).not.toContain("optimal evasion");
      expect(str.toLowerCase()).not.toContain("bypass security");
    }
  });
});

describe("security outcome — cause taxonomy", () => {
  test("includes cause taxonomy as a top-level field", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Blocked by Shelf 1"],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "Cash counter below recognition", affectedZones: ["z1"], affectedCameras: ["cam_1"] }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(Array.isArray(model.causeTaxonomy)).toBe(true);
  });

  test("classifies occlusion cause from blocked reason", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Blocked by Shelf 1"],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "Cash counter below recognition", affectedZones: ["z1"], affectedCameras: ["cam_1"] }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    const occlusionFinding = model.causeTaxonomy.find((c) => c.category === "occlusion");
    expect(occlusionFinding).toBeDefined();
    expect(["medium", "high"]).toContain(occlusionFinding!.severity);
    expect(occlusionFinding!.affectedZoneIds).toContain("z1");
  });

  test("classifies distance cause from range reason", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Entry Door",
        requiredQuality: "recognition",
        actualQuality: "detection",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Out of range"],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "Entry door below recognition", affectedZones: ["z1"], affectedCameras: ["cam_1"] }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    const distanceFinding = model.causeTaxonomy.find((c) => c.category === "distance");
    expect(distanceFinding).toBeDefined();
  });

  test("classifies night_mode cause", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Night penalty applied"],
      }],
      issues: [
        { severity: "high", category: "quality_fail", description: "Cash counter below recognition", affectedZones: ["z1"], affectedCameras: ["cam_1"] },
        { severity: "high", category: "night", description: "Night degrades coverage", affectedZones: ["z1"], affectedCameras: ["cam_1"] },
      ],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    const nightFinding = model.causeTaxonomy.find((c) => c.category === "night_mode");
    expect(nightFinding).toBeDefined();
    expect(["medium", "high"]).toContain(nightFinding!.severity);
  });

  test("classifies redundancy cause for single-camera zone", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "detection",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: [],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "Cash counter below recognition", affectedZones: ["z1"], affectedCameras: ["cam_1"] }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    const redundancyFinding = model.causeTaxonomy.find((c) => c.category === "redundancy");
    expect(redundancyFinding).toBeDefined();
    expect(redundancyFinding!.affectedZoneIds).toContain("z1");
  });

  test("classifies privacy cause", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      issues: [{
        severity: "medium",
        category: "privacy",
        description: "Camera sees into privacy zone",
        affectedZones: ["priv_1"],
        affectedCameras: ["cam_1"],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    const privacyFinding = model.causeTaxonomy.find((c) => c.category === "privacy");
    expect(privacyFinding).toBeDefined();
  });

  test("cause findings include product explanation in product language", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Blocked by Shelf 1"],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "Cash counter below recognition", affectedZones: ["z1"], affectedCameras: ["cam_1"] }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    const occlusionFinding = model.causeTaxonomy.find((c) => c.category === "occlusion");
    expect(occlusionFinding).toBeDefined();
    expect(occlusionFinding!.productExplanation.length).toBeGreaterThan(0);
    expect(occlusionFinding!.productExplanation.toLowerCase()).toContain("block");
  });

  test("cause taxonomy is empty when no result", () => {
    const scene = createSmallRetailShopScene();
    const model = buildSecurityOutcomeModel(scene, null, null);
    expect(model.causeTaxonomy).toEqual([]);
  });

  test("cause taxonomy sorted by severity", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [
        {
          zoneId: "z1",
          label: "Critical Safe",
          requiredQuality: "identification",
          actualQuality: "none",
          coveringCameras: [],
          redundancyCameraCount: 0,
          status: "fail",
          failureReasons: ["No camera coverage"],
        },
        {
          zoneId: "z2",
          label: "Entry Door",
          requiredQuality: "recognition",
          actualQuality: "observation",
          coveringCameras: ["cam_1"],
          redundancyCameraCount: 1,
          status: "fail",
          failureReasons: ["Blocked by Plant"],
        },
      ],
      issues: [
        { severity: "critical", category: "quality_fail", description: "Critical safe has no coverage", affectedZones: ["z1"], affectedCameras: [] },
        { severity: "high", category: "quality_fail", description: "Entry door blocked", affectedZones: ["z2"], affectedCameras: ["cam_1"] },
      ],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.causeTaxonomy.length).toBeGreaterThanOrEqual(2);
    const severityRank = model.causeTaxonomy.map((c) => c.severity);
    const severityOrder = ["critical", "high", "medium", "low"];
    const ranks = severityRank.map((s) => severityOrder.indexOf(s));
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });

  test("failed zone includes causeCategories", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "observation",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 1,
        status: "fail",
        failureReasons: ["Blocked by Shelf 1"],
      }],
      issues: [{ severity: "high", category: "quality_fail", description: "Cash counter below recognition", affectedZones: ["z1"], affectedCameras: ["cam_1"] }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.failedZones[0].causeCategories).toBeDefined();
    expect(Array.isArray(model.failedZones[0].causeCategories)).toBe(true);
    expect(model.failedZones[0].causeCategories.length).toBeGreaterThan(0);
  });

  test("zoneFindings includes pass zones while failedZones excludes them", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [
        {
          zoneId: "z1",
          label: "Cash Counter",
          requiredQuality: "recognition",
          actualQuality: "recognition",
          coveringCameras: ["cam_1"],
          redundancyCameraCount: 2,
          status: "pass",
          failureReasons: [],
        },
        {
          zoneId: "z2",
          label: "Storage",
          requiredQuality: "recognition",
          actualQuality: "observation",
          coveringCameras: ["cam_2"],
          redundancyCameraCount: 1,
          status: "fail",
          failureReasons: ["Blocked by shelf"],
        },
      ],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.zoneFindings.length).toBe(2);
    expect(model.failedZones.length).toBe(1);
    expect(model.failedZones[0].zoneId).toBe("z2");
  });
});

describe("security outcome — scorecard", () => {
  test("includes scorecard as a top-level field", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "recognition",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 2,
        status: "pass",
        failureReasons: [],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.scorecard).toBeDefined();
    expect(typeof model.scorecard.overall).toBe("number");
    expect(model.scorecard.overall).toBeGreaterThanOrEqual(0);
    expect(model.scorecard.overall).toBeLessThanOrEqual(100);
  });

  test("scorecard has six dimensions", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult();
    const model = buildSecurityOutcomeModel(scene, result, null);
    const dims = model.scorecard.dimensions;
    expect(dims).toHaveProperty("coverage");
    expect(dims).toHaveProperty("zoneCompliance");
    expect(dims).toHaveProperty("redundancy");
    expect(dims).toHaveProperty("nightReadiness");
    expect(dims).toHaveProperty("pathVisibility");
    expect(dims).toHaveProperty("privacy");
    expect(typeof dims.coverage.score).toBe("number");
    expect(typeof dims.zoneCompliance.passing).toBe("number");
    expect(typeof dims.zoneCompliance.total).toBe("number");
  });

  test("scorecard reflects passing zones with high score", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      totalCoveragePct: 90,
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "recognition",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 2,
        status: "pass",
        failureReasons: [],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.scorecard.dimensions.coverage.score).toBe(90);
    expect(model.scorecard.dimensions.zoneCompliance.score).toBe(100);
    expect(model.scorecard.dimensions.zoneCompliance.passing).toBe(1);
    expect(model.scorecard.dimensions.zoneCompliance.total).toBe(1);
  });

  test("scorecard reflects failing zones with lower compliance", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      totalCoveragePct: 30,
      criticalZoneResults: [
        {
          zoneId: "z1",
          label: "Cash Counter",
          requiredQuality: "recognition",
          actualQuality: "recognition",
          coveringCameras: ["cam_1"],
          redundancyCameraCount: 1,
          status: "pass",
          failureReasons: [],
        },
        {
          zoneId: "z2",
          label: "Entry Door",
          requiredQuality: "recognition",
          actualQuality: "none",
          coveringCameras: [],
          redundancyCameraCount: 0,
          status: "fail",
          failureReasons: [],
        },
      ],
      issues: [{ severity: "critical", category: "quality_fail", description: "Entry door fails", affectedZones: ["z2"], affectedCameras: [] }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(model.scorecard.dimensions.zoneCompliance.score).toBe(50);
    expect(model.scorecard.dimensions.zoneCompliance.passing).toBe(1);
    expect(model.scorecard.dimensions.zoneCompliance.total).toBe(2);
  });

  test("scorecard is zero for not_run", () => {
    const scene = createSmallRetailShopScene();
    const model = buildSecurityOutcomeModel(scene, null, null);
    expect(model.scorecard.overall).toBe(0);
    expect(model.scorecard.overallLabel).toBe("No data");
  });

  test("scorecard overall is weighted average of all dimensions", () => {
    const scene = createSmallRetailShopScene();
    const sceneWithPaths = { ...scene, paths: [] as typeof scene.paths };
    const result = makeResult({
      totalCoveragePct: 100,
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "recognition",
        coveringCameras: ["cam_1"],
        redundancyCameraCount: 2,
        status: "pass",
        failureReasons: [],
      }],
    });
    const model = buildSecurityOutcomeModel(sceneWithPaths, result, null);
    expect(model.scorecard.overall).toBeGreaterThan(0);
    expect(model.scorecard.overall).toBeLessThanOrEqual(100);
  });

  test("scorecard label reflects overall range", () => {
    const scene = createSmallRetailShopScene();
    const result = makeResult({
      totalCoveragePct: 10,
      criticalZoneResults: [{
        zoneId: "z1",
        label: "Cash Counter",
        requiredQuality: "recognition",
        actualQuality: "none",
        coveringCameras: [],
        redundancyCameraCount: 0,
        status: "fail",
        failureReasons: ["No camera coverage"],
      }],
      issues: [{ severity: "critical", category: "quality_fail", description: "No coverage", affectedZones: ["z1"], affectedCameras: [] }],
    });
    const model = buildSecurityOutcomeModel(scene, result, null);
    expect(["Poor", "At risk"]).toContain(model.scorecard.overallLabel);
  });
});
