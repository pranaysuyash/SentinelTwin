import { describe, expect, it } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import { simulateStudio } from "@sentineltwin/simulation";
import { buildCoverageRegressionReport } from "@/lib/coverage-regression";

function simulatedScene(): { scene: SecurityScene; result: SimulationResult } {
  const scene = createSmallRetailShopScene();
  const result = simulateStudio(scene);
  return { scene, result };
}

describe("buildCoverageRegressionReport", () => {
  it("returns an empty-but-honest report when there is no baseline", () => {
    const { result } = simulatedScene();
    const report = buildCoverageRegressionReport(result, null, null);

    expect(report.hasBaseline).toBe(false);
    expect(report.checks).toEqual([]);
    expect(report.overallStatus).toBe("pass");
  });

  it("reports pass for an unchanged scene compared against itself", () => {
    const { result } = simulatedScene();
    const report = buildCoverageRegressionReport(result, result, { label: "Baseline", timestamp: 0 });

    expect(report.hasBaseline).toBe(true);
    expect(report.overallStatus).toBe("pass");
    for (const check of report.checks) {
      expect(check.status).toBe("pass");
    }
  });

  it("flags a coverage regression when total coverage drops significantly", () => {
    const { result } = simulatedScene();
    const baseline: SimulationResult = { ...result, totalCoveragePct: result.totalCoveragePct + 10 };

    const report = buildCoverageRegressionReport(result, baseline, { label: "Baseline", timestamp: 0 });
    const coverageCheck = report.checks.find((c) => c.id === "total_coverage");

    expect(coverageCheck).toBeDefined();
    expect(coverageCheck!.status).toBe("fail");
    expect(report.overallStatus).toBe("fail");
  });

  it("flags new critical issues as a failure", () => {
    const { result } = simulatedScene();
    const baseline: SimulationResult = { ...result, issues: [] };
    const current: SimulationResult = {
      ...result,
      issues: [
        ...result.issues,
        {
          id: "issue_synthetic_critical",
          severity: "critical",
          category: "coverage",
          description: "Synthetic critical issue for regression test",
          affectedZoneIds: [],
          affectedCameraIds: [],
        } as never,
      ],
    };

    const report = buildCoverageRegressionReport(current, baseline, { label: "Baseline", timestamp: 0 });
    const issuesCheck = report.checks.find((c) => c.id === "open_issues");

    expect(issuesCheck!.status).toBe("fail");
    expect(report.overallStatus).toBe("fail");
  });
});
