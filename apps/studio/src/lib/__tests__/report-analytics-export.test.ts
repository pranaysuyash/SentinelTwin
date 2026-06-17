import { describe, expect, it } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import type { SecurityScene } from "@/schema/security-scene";
import { simulateStudio } from "@sentineltwin/simulation";
import { buildSecurityAnalyticsModel } from "@/lib/security-analytics";
import { buildAnalyticsReportSection } from "@/lib/report-analytics-export";

function demoScene(): SecurityScene {
  return createSmallRetailShopScene();
}

describe("buildAnalyticsReportSection", () => {
  it("returns an empty fragment when there is no simulation", () => {
    const scene = demoScene();
    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: null,
      temporalProfile: null,
      evidenceEvents: [],
      snapshots: [],
    });

    expect(buildAnalyticsReportSection(model)).toBe("");
  });

  it("embeds KPI cards, DORI distribution, issue bars, and camera leaderboard for a simulated scene", () => {
    const scene = demoScene();
    const result = simulateStudio(scene);
    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: result,
      temporalProfile: null,
      evidenceEvents: [],
      snapshots: [],
    });

    const html = buildAnalyticsReportSection(model);

    expect(html).toContain("Security Analytics Overview");
    expect(html).toContain("analytics-kpi-grid");
    expect(html).toContain("DORI Quality Distribution");
    expect(html).toContain("Open Issues by Severity");
    expect(html).toContain("Camera Leaderboard");
    // Coverage trend requires >= 2 snapshot points; absent here.
    expect(html).not.toContain("Coverage Trend (Snapshots)");
  });

  it("renders a coverage trend chart when snapshots are present", () => {
    const scene = demoScene();
    const result = simulateStudio(scene);
    const model = buildSecurityAnalyticsModel({
      scene,
      simulationResult: result,
      temporalProfile: null,
      evidenceEvents: [],
      snapshots: [
        {
          id: "snap-1",
          label: "Baseline",
          createdAt: result.computedAt - 1000,
          scene,
          simulation: result,
        } as never,
      ],
    });

    const html = buildAnalyticsReportSection(model);
    expect(html).toContain("Coverage Trend (Snapshots)");
  });
});
