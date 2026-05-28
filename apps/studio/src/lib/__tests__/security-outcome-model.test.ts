import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import type { SimulationResult } from "@/schema/security-scene";
import { buildSecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";

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

describe("security outcome model", () => {
  test("returns not_run when simulation is missing", () => {
    const scene = createSmallRetailShopScene();
    const model = buildSecurityOutcomeModel(scene, null, null);
    expect(model.summary.status).toBe("not_run");
    expect(model.summary.coveragePct).toBeNull();
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
  });

  test("includes recommendations and path outcomes", () => {
    const scene = createSmallRetailShopScene();
    const activePath = scene.paths[0] ?? null;
    const pathId = activePath?.id ?? "path_1";
    const result = makeResult({
      recommendations: [{
        type: "rotate_camera",
        description: "Rotate Camera 2",
        estimatedImpact: "Observation to Recognition",
        costCategory: "free",
        verified: true,
        affectedNodeId: "cam_2",
        suggestedYawDeg: 12,
      }],
      pathResults: [{
        pathId,
        totalDurationS: 12,
        visibleDurationS: 7.2,
        lostDurationS: 4.8,
        visibilityByCamera: {},
        timeline: [],
      }],
    });
    const model = buildSecurityOutcomeModel(scene, result, activePath);
    expect(model.recommendations.length).toBe(1);
    expect(model.pathOutcome?.lostDurationS).toBe(4.8);
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
});
