import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildOperationalEvidenceEvent } from "@/lib/operational-evidence";
import { simulateStudio } from "@sentineltwin/simulation";
import { buildCompareReportData, buildReportData } from "@sentineltwin/report";
import { buildReportEvidenceBundle, stringifyReportEvidenceBundle } from "@/lib/report-evidence-bundle";

describe("report evidence bundle", () => {
  test("packages a single report with its evidence trail", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);
    const report = buildReportData(scene, result, {
      operationalEvidenceEvents: [
        buildOperationalEvidenceEvent({
          kind: "scene_published",
          title: "Scene published",
          details: "Promoted the current scene state to the published branch.",
          actor: "user",
          source: scene.source,
          sceneId: scene.id,
          sceneName: scene.name,
          revisionDepth: scene.changeLog.length,
          affectedNodeIds: [],
          confidence: 0.98,
          branchLabel: "published",
          lifecycleStage: "published",
          published: true,
          beforeSummary: "Before publish",
          afterSummary: "After publish",
          sceneSnapshot: scene,
        }),
      ],
    });
    const bundle = buildReportEvidenceBundle({
      scene,
      report,
      simulationResult: result,
    });

    expect(bundle.version).toBe("1");
    expect(bundle.mode).toBe("single");
    expect(bundle.scene.id).toBe(scene.id);
    expect(bundle.report.siteName).toBe(scene.name);
    expect(bundle.report.temporalTwin?.publishedCheckpointCount).toBe(1);
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
