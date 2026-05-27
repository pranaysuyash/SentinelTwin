import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { detectTemporalAnomalies } from "@/simulation/temporal-anomaly";
import { simulateStudio } from "@/simulation/simulate-studio";
import type { TemporalSecurityProfile } from "@/schema/security-scene";

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
});
