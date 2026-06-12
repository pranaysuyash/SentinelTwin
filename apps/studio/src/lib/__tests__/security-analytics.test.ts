import { describe, expect, it } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import { simulateStudio, computeTemporalProfile } from "@sentineltwin/simulation";
import { buildSecurityAnalyticsModel } from "@/lib/security-analytics";
import { buildOperationalEvidenceEvent } from "@/lib/operational-evidence";

function demoScene(): SecurityScene {
  return createSmallRetailShopScene();
}

function simulatedScene(): { scene: SecurityScene; result: SimulationResult } {
  const scene = demoScene();
  const result = simulateStudio(scene);
  return { scene, result };
}

describe("buildSecurityAnalyticsModel", () => {
  it("returns an empty-but-honest model when no simulation exists", () => {
    const scene = demoScene();
    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: null,
      temporalProfile: null,
      evidenceEvents: [],
      snapshots: [],
    });

    expect(model.hasSimulation).toBe(false);
    expect(model.kpis).toHaveLength(0);
    expect(model.doriDistribution).toHaveLength(0);
    expect(model.zoneStatus.total).toBe(0);
    expect(model.resilience.totalCameras).toBe(scene.cameras.length);
    expect(model.placementSuggestion).toBeNull();
  });

  it("derives KPIs and distributions from a real simulation result", () => {
    const { scene, result } = simulatedScene();
    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: result,
      temporalProfile: null,
      evidenceEvents: [],
      snapshots: [],
    });

    expect(model.hasSimulation).toBe(true);
    expect(model.computedAt).toBe(result.computedAt);

    const coverageKpi = model.kpis.find((kpi) => kpi.id === "coverage");
    expect(coverageKpi).toBeDefined();
    expect(coverageKpi!.value).toBe(`${result.totalCoveragePct.toFixed(1)}%`);

    // DORI distribution covers identification/recognition/observation/detection/blind and sums near 100.
    expect(model.doriDistribution.map((band) => band.band)).toEqual([
      "identification",
      "recognition",
      "observation",
      "detection",
      "blind",
    ]);
    const totalPct = model.doriDistribution.reduce((sum, band) => sum + band.pct, 0);
    expect(totalPct).toBeGreaterThan(99);
    expect(totalPct).toBeLessThan(101);

    // Zone status matches the simulation's critical zone results.
    expect(model.zoneStatus.total).toBe(result.criticalZoneResults.length);
    expect(model.zoneStatus.pass + model.zoneStatus.partial + model.zoneStatus.fail).toBe(model.zoneStatus.total);

    // Issue breakdown counts every simulation issue exactly once.
    const issueTotal = model.issueBreakdown.reduce((sum, entry) => sum + entry.count, 0);
    expect(issueTotal).toBe(result.issues.length);

    // Camera leaderboard is sorted by coverage and resolves scene camera names.
    expect(model.cameraLeaderboard.length).toBeGreaterThan(0);
    for (let i = 1; i < model.cameraLeaderboard.length; i += 1) {
      expect(model.cameraLeaderboard[i - 1].coveragePct).toBeGreaterThanOrEqual(model.cameraLeaderboard[i].coveragePct);
    }
    const sceneCameraNames = new Set(scene.cameras.map((camera) => camera.name));
    expect(sceneCameraNames.has(model.cameraLeaderboard[0].name)).toBe(true);
  });

  it("summarizes the temporal profile into a 24h series with vulnerability counts", () => {
    const { scene, result } = simulatedScene();
    const profile = computeTemporalProfile(scene);
    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: result,
      temporalProfile: profile,
      evidenceEvents: [],
      snapshots: [],
    });

    expect(model.temporal).not.toBeNull();
    expect(model.temporal!.series).toHaveLength(profile.hourlySnapshots.length);
    expect(model.temporal!.worstPoint).not.toBeNull();
    expect(model.temporal!.bestPoint!.coveragePct).toBeGreaterThanOrEqual(model.temporal!.worstPoint!.coveragePct);

    const windowTotal =
      model.temporal!.vulnerabilityCounts.high +
      model.temporal!.vulnerabilityCounts.medium +
      model.temporal!.vulnerabilityCounts.low;
    expect(windowTotal).toBe(profile.peakVulnerabilityWindows.length);

    const temporalKpi = model.kpis.find((kpi) => kpi.id === "vulnerability_windows");
    expect(temporalKpi).toBeDefined();
  }, 30_000);

  it("builds a coverage trend from snapshots plus the current result", () => {
    const { scene, result } = simulatedScene();
    const snapshot = {
      id: "snap_trend_1",
      label: "Baseline",
      createdAt: result.computedAt - 10_000,
      scene,
      simulation: result,
    };
    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: result,
      temporalProfile: null,
      evidenceEvents: [],
      snapshots: [snapshot],
    });

    expect(model.coverageTrend).toHaveLength(2);
    expect(model.coverageTrend[0].label).toBe("Baseline");
    expect(model.coverageTrend[1].isCurrent).toBe(true);
    expect(model.coverageTrend[1].coveragePct).toBe(result.totalCoveragePct);
  });

  it("aggregates evidence ledger activity by kind", () => {
    const { scene, result } = simulatedScene();
    const makeEvent = (title: string) =>
      buildOperationalEvidenceEvent({
        kind: "simulation_completed",
        title,
        details: "test event",
        actor: "system",
        source: scene.source,
        sceneId: scene.id,
        sceneName: scene.name,
        revisionDepth: 0,
        affectedNodeIds: [],
        confidence: 0.9,
      });
    const events = [makeEvent("First run"), makeEvent("Second run")];

    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: result,
      temporalProfile: null,
      evidenceEvents: events,
      snapshots: [],
    });

    expect(model.evidenceActivity.totalEvents).toBe(2);
    expect(model.evidenceActivity.countsByKind[0]).toEqual({ kind: "simulation_completed", count: 2 });
    expect(model.evidenceActivity.lastEventTitle).toBe("Second run");
  });

  it("aggregates occlusion blame across zones per obstruction", () => {
    const { scene, result } = simulatedScene();
    const patched: SimulationResult = {
      ...result,
      occlusionBlame: [
        {
          zoneId: "zone_a",
          zoneLabel: "Cash Counter",
          baselineQuality: "detection",
          obstructions: [
            { obstructionId: "obs_1", label: "Cupboard", blameFraction: 0.6, qualityWithout: "recognition", qualityImprovement: 2 },
          ],
        },
        {
          zoneId: "zone_b",
          zoneLabel: "Back Door",
          baselineQuality: "observation",
          obstructions: [
            { obstructionId: "obs_1", label: "Cupboard", blameFraction: 0.2, qualityWithout: "recognition", qualityImprovement: 1 },
            { obstructionId: "obs_2", label: "Shelf", blameFraction: 0.4, qualityWithout: "observation", qualityImprovement: 1 },
          ],
        },
      ],
    };

    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: patched,
      temporalProfile: null,
      evidenceEvents: [],
      snapshots: [],
    });

    expect(model.occlusionOffenders[0].obstructionId).toBe("obs_1");
    expect(model.occlusionOffenders[0].totalBlame).toBeCloseTo(0.8);
    expect(model.occlusionOffenders[0].affectedZoneCount).toBe(2);
    expect(model.occlusionOffenders[0].worstZoneLabel).toBe("Cash Counter");
    expect(model.occlusionOffenders[1].obstructionId).toBe("obs_2");
  });
});
