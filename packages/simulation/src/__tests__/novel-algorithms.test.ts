import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "./fixtures/small-retail-shop";
import { detectTemporalAnomalies } from "@sentineltwin/simulation";
import { simulateStudio } from "@sentineltwin/simulation";
import type { TemporalSecurityProfile } from "@sentineltwin/core";
import { createTestCamera, createTestScene } from "./helpers";

describe("novel algorithms", () => {
  test("simulation publishes k-robustness, placement oracle, occlusion blame, and fragility outputs", () => {
    const result = simulateStudio(createSmallRetailShopScene());

    expect(result.fragilitySummary).toBeDefined();
    expect(result.kRobustness).toBeDefined();
    expect(result.placementOracle).toBeDefined();
    expect(result.occlusionBlame).toBeDefined();

    expect(result.kRobustness?.totalCameras).toBe(
      createSmallRetailShopScene().cameras.filter((camera) => camera.status === "on").length,
    );
    expect(result.placementOracle?.candidates.length).toBeGreaterThan(0);
    expect(result.placementOracle?.bestCandidate).toBeDefined();
    expect(result.blindSpotFingerprint).toBeDefined();
    expect(result.placementOracle?.bestCandidate?.score).toBeGreaterThanOrEqual(
      result.placementOracle?.candidates.at(-1)?.score ?? Number.NEGATIVE_INFINITY,
    );
  });

  test("temporal profile includes derived anomaly windows", () => {
    const profile: TemporalSecurityProfile = {
      hoursAnalyzed: 24,
      resolutionMinutes: 15,
      hourlySnapshots: [
        {
          hour: 0,
          minute: 0,
          overallCoveragePct: 90,
          criticalZonePassCount: 1,
          criticalZoneTotalCount: 1,
          criticalZoneStatuses: { "Temporal Zone": "pass" },
          activeCameraCount: 1,
          activeLightCount: 1,
          adversarialPathExposureScore: 1,
          issues: [],
          stateLabel: "Day",
        },
        {
          hour: 0,
          minute: 15,
          overallCoveragePct: 52,
          criticalZonePassCount: 0,
          criticalZoneTotalCount: 1,
          criticalZoneStatuses: { "Temporal Zone": "fail" },
          activeCameraCount: 1,
          activeLightCount: 0,
          adversarialPathExposureScore: 6,
          issues: ["Coverage dropped"],
          stateLabel: "Night",
        },
        {
          hour: 0,
          minute: 30,
          overallCoveragePct: 50,
          criticalZonePassCount: 0,
          criticalZoneTotalCount: 1,
          criticalZoneStatuses: { "Temporal Zone": "fail" },
          activeCameraCount: 1,
          activeLightCount: 0,
          adversarialPathExposureScore: 6.5,
          issues: ["Coverage dropped"],
          stateLabel: "Night",
        },
      ],
      peakVulnerabilityWindows: [],
      safestPeriods: [],
      criticalZoneCoverageByHour: {
        "Temporal Zone": [100, 0, 0],
      },
      anomalyWindows: [],
      anomalySummary: {
        totalAnomalies: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
        worstCoverageDropPct: 0,
        worstExposureJump: 0,
      },
      computedAt: 0,
    };

    const analysis = detectTemporalAnomalies(profile);

    expect(analysis.windows.length).toBeGreaterThan(0);
    expect(analysis.summary.totalAnomalies).toBe(analysis.windows.length);
    expect(
      analysis.summary.highSeverityCount +
        analysis.summary.mediumSeverityCount +
        analysis.summary.lowSeverityCount,
    ).toBe(analysis.windows.length);
  });

  test("simulation publishes reflective bounce outputs when reflective windows are present", () => {
    const scene = createTestScene({
      width: 8,
      depth: 8,
      cameras: [
        createTestCamera({
          position: [4, 2.5, 1],
          yawDeg: 180,
          pitchDeg: -25,
          fovHorizontalDeg: 70,
          rangeM: 12,
          clarity: "poor",
          resolutionMP: 0.3,
          resolutionWidth: 640,
          resolutionHeight: 360,
        }),
      ],
    });

    scene.windows = [
      {
        id: "window_reflective",
        nodeType: "window",
        label: "Reflective Window",
        position: [4, 1.2, 3],
        dimensions: [2.5, 1.8, 0.1],
        state: "reflective",
        visionTransmission: 0.4,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const result = simulateStudio(scene);

    expect(result.reflectiveBounce).toBeDefined();
    expect(result.reflectiveBounce?.reflectiveWindowCount).toBe(1);
    expect(result.reflectiveBounce?.affectedCellCount).toBeGreaterThan(0);
    expect(result.reflectiveBounce?.affectedCameraCount).toBeGreaterThan(0);
  });
});
