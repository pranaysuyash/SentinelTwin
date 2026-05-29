import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { simulateStudio } from "@/simulation/simulate-studio";
import { buildCompareReportData, buildReportData } from "@/report";
import { buildReportEvidenceBundle, stringifyReportEvidenceBundle } from "@/lib/report-evidence-bundle";

describe("report evidence bundle", () => {
  test("packages a single report with its evidence trail", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);
    const report = buildReportData(scene, result);
    const bundle = buildReportEvidenceBundle({
      scene,
      report,
      simulationResult: result,
    });

    expect(bundle.version).toBe("1");
    expect(bundle.mode).toBe("single");
    expect(bundle.scene.id).toBe(scene.id);
    expect(bundle.report.siteName).toBe(scene.name);
    expect(bundle.evidenceTrail.evidenceEntryCount).toBeGreaterThanOrEqual(0);
    expect(stringifyReportEvidenceBundle(bundle)).toContain("\"mode\": \"single\"");
  });

  test("packages a compare report with compare context", () => {
    const beforeScene = createSmallRetailShopScene();
    const afterScene = createSmallRetailShopScene();
    const camera = afterScene.cameras.find((entry) => entry.id === "cam_entrance");
    if (camera) camera.status = "off";

    const beforeResult = simulateStudio(beforeScene);
    const afterResult = simulateStudio(afterScene);
    const compare = buildCompareReportData(beforeScene, beforeResult, afterScene, afterResult);
    const bundle = buildReportEvidenceBundle({
      scene: afterScene,
      report: compare.after,
      simulationResult: afterResult,
      compare,
    });

    expect(bundle.mode).toBe("compare");
    expect(bundle.compare?.deltas.totalCoveragePctDelta).toBeDefined();
    expect(bundle.report.siteName).toBe(afterScene.name);
    expect(stringifyReportEvidenceBundle(bundle)).toContain("\"mode\": \"compare\"");
  });
});
