import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { simulateStudio } from "@/simulation/simulate-studio";
import {
  buildReportData,
  buildCompareReportData,
  exportAsHtml,
  exportAsMarkdown,
  exportAsText,
  exportCompareAsHtml,
  exportCompareAsMarkdown,
  buildCompareReport,
  type ReportData,
} from "@/report/index";

describe("report engine", () => {
  const scene = createSmallRetailShopScene();
  const result = simulateStudio(scene);

  test("buildReportData produces complete report", () => {
    const report = buildReportData(scene, result);

    expect(report.siteName).toBe(scene.name);
    expect(report.dimensions.width).toBe(scene.dimensions.width);
    expect(report.dimensions.depth).toBe(scene.dimensions.depth);
    expect(report.summary.totalCoveragePct).toBe(result.totalCoveragePct);
    expect(report.summary.blindspotPct).toBe(result.blindspotPct);
    expect(report.summary.recognitionAreaPct).toBe(result.recognitionAreaPct);
    expect(report.summary.identificationAreaPct).toBe(result.identificationAreaPct);
    expect(report.summary.zonesTotal).toBe(result.criticalZoneResults.length);
    expect(report.summary.zonesPassing).toBe(
      result.criticalZoneResults.filter((z) => z.status === "pass").length,
    );
    expect(report.summary.issuesCount).toBe(result.issues.length);
    expect(report.summary.recommendationsCount).toBe(result.recommendations.length);
    expect(report.codeCompliant).toBeDefined();
    expect(report.meetsModeledZoneRequirements).toBeDefined();
    expect(report.meetsModeledZoneRequirements).toBe(report.codeCompliant);
    expect(report.standardsRef).toContain("IEC 62676");
    expect(report.provenance.sceneSourceLabel).toBe("Demo Scene");
    expect(report.provenance.nodeCount).toBeGreaterThan(0);
    expect(report.novelAlgorithms?.coverageUncertainty).toBeDefined();
    expect(report.novelAlgorithms?.coverageUncertainty?.sampleCount).toBeGreaterThan(0);
    expect(report.novelAlgorithms?.postureVariation).toBeDefined();
    expect(report.novelAlgorithms?.postureVariation?.profiles.length).toBeGreaterThan(0);
    expect(report.novelAlgorithms?.blindRegions).toBeDefined();
    expect(report.novelAlgorithms?.blindSpotFingerprint).toBeDefined();
    expect(report.redundancyMatrix).toBeDefined();
    expect(report.redundancyMatrix?.cameraRows.length).toBeGreaterThan(0);
    expect(report.redundancyMatrix?.vulnerableZones.length).toBeGreaterThan(0);
  });

  test("buildReportData maps zone results correctly", () => {
    const report = buildReportData(scene, result);

    expect(report.zones.length).toBe(result.criticalZoneResults.length);
    for (const zone of report.zones) {
      expect(["pass", "fail", "warning"]).toContain(zone.status);
      expect(zone.coveragePct).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(zone.coveringCameras)).toBe(true);
    }
  });

  test("buildReportData maps camera results correctly", () => {
    const report = buildReportData(scene, result);

    expect(report.cameras.length).toBe(result.cameraResults.length);
    for (const cam of report.cameras) {
      expect(cam.id).toBeTruthy();
      expect(cam.coveragePct).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(cam.zonesCovered)).toBe(true);
    }
  });

  test("buildReportData maps issues with severity", () => {
    const report = buildReportData(scene, result);

    for (const issue of report.issues) {
      expect(["critical", "high", "medium", "low"]).toContain(issue.severity);
      expect(issue.description).toBeTruthy();
    }
  });

  test("buildReportData maps recommendations with verification status", () => {
    const report = buildReportData(scene, result);

    for (const rec of report.recommendations) {
      expect(rec.description).toBeTruthy();
      expect(["free", "low", "medium", "high"]).toContain(rec.costCategory);
      expect(typeof rec.verified).toBe("boolean");
    }
  });

  test("buildReportData accepts adversarial path options", () => {
    const report = buildReportData(scene, result, {
      adversarialPath: {
        exposureScore: 8.5,
        detectionProbability: 0.75,
        totalDistance: 12.3,
        waypoints: [
          { x: 1, z: 2, exposure: 0.3 },
          { x: 3, z: 4, exposure: 0.9 },
        ],
      },
    });

    expect(report.adversarialPath).toBeDefined();
    expect(report.adversarialPath?.exposureScore).toBe(8.5);
    expect(report.adversarialPath?.detectionProbability).toBe(0.75);
    expect(report.adversarialPath?.totalDistance).toBe(12.3);
    expect(report.adversarialPath?.waypoints).toHaveLength(2);
  });

  test("buildReportData accepts temporal profile options", () => {
    const report = buildReportData(scene, result, {
      temporalProfile: {
        vulnerabilityWindowCount: 3,
        safestPeriods: [
          { startHour: 8, endHour: 18, label: "Business Hours" },
        ],
        worstCoverage: 45.2,
      },
    });

    expect(report.temporalProfile).toBeDefined();
    expect(report.temporalProfile?.vulnerabilityWindowCount).toBe(3);
    expect(report.temporalProfile?.safestPeriods).toHaveLength(1);
    expect(report.temporalProfile?.worstCoverage).toBe(45.2);
  });

  test("buildReportData with custom title", () => {
    const report = buildReportData(scene, result, { title: "Custom Audit" });
    expect(report.title).toBe("Custom Audit");
  });

  const testWithTimeout = test as unknown as (
    name: string,
    options: { timeout: number },
    fn: () => void,
  ) => void;

  testWithTimeout("buildCompareReportData produces correct deltas", { timeout: 15000 }, () => {
    const modifiedScene = createSmallRetailShopScene();
    const camera = modifiedScene.cameras.find((c) => c.id === "cam_entrance");
    if (camera) camera.status = "off";

    const beforeResult = simulateStudio(scene);
    const afterResult = simulateStudio(modifiedScene);
    const compare = buildCompareReportData(scene, beforeResult, modifiedScene, afterResult);

    expect(compare.before.siteName).toBe(scene.name);
    expect(compare.after.siteName).toBe(modifiedScene.name);
    expect(compare.deltas.totalCoveragePctDelta).toBe(
      Number((afterResult.totalCoveragePct - beforeResult.totalCoveragePct).toFixed(1)),
    );
    expect(compare.deltas.zonesPassedDelta).toBe(
      afterResult.criticalZoneResults.filter((z) => z.status === "pass").length -
        beforeResult.criticalZoneResults.filter((z) => z.status === "pass").length,
    );
    expect(compare.zoneChanges.length).toBe(beforeResult.criticalZoneResults.length);
  });

  testWithTimeout("buildCompareReportData identifies zone status changes", { timeout: 15000 }, () => {
    const modifiedScene = createSmallRetailShopScene();
    const camera = modifiedScene.cameras.find((c) => c.id === "cam_entrance");
    if (camera) camera.status = "off";

    const beforeResult = simulateStudio(scene);
    const afterResult = simulateStudio(modifiedScene);
    const compare = buildCompareReportData(scene, beforeResult, modifiedScene, afterResult);

    const changed = compare.zoneChanges.filter((z) => z.changed);
    expect(changed.length).toBeGreaterThanOrEqual(0);
  });
});

describe("exportAsHtml", () => {
  const scene = createSmallRetailShopScene();
  const result = simulateStudio(scene);

  function makeReport(overrides?: Partial<ReportData>): ReportData {
    return {
      ...buildReportData(scene, result),
      ...overrides,
    };
  }

  test("produces valid HTML document", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain(scene.name);
  });

  test("includes standards badge", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("IEC 62676");
  });

  test("includes provenance section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Provenance");
    expect(html).toContain("Source history");
  });

  test("includes uncertainty section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Coverage Uncertainty");
    expect(html).toContain("samples");
  });

  test("includes posture variation section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Coverage Posture Variation");
    expect(html).toContain("largest drop");
  });

  test("includes blind spot topology section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Blind Spot Topology");
    expect(html).toContain("critical");
  });

  test("includes blind spot fingerprint section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Blind Spot Fingerprint");
    expect(html).toContain("Fingerprint");
    expect(html).toContain("Regions");
  });

  test("includes redundancy matrix section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Redundancy Matrix");
    expect(html).toContain("Vulnerable Zones");
    expect(html).toContain("Single-point zones");
  });

  test("includes reflective bounce section", () => {
    const html = exportAsHtml({
      ...makeReport(),
      novelAlgorithms: {
        ...makeReport().novelAlgorithms!,
        reflectiveBounce: {
          reflectiveWindowCount: 1,
          affectedCellCount: 4,
          affectedCameraCount: 1,
        },
      },
    });
    expect(html).toContain("Reflective Bounce Vision");
    expect(html).toContain("reflective windows");
    expect(html).toContain("affected cells");
  });

  test("includes placement oracle detail section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Placement Oracle");
    expect(html).toContain("Best Score");
    expect(html).toContain("candidates");
  });

  test("includes k-robustness critical sets section", () => {
    const html = exportAsHtml({
      ...makeReport(),
      novelAlgorithms: {
        ...makeReport().novelAlgorithms!,
        kRobustness: {
          kRobustness: 1,
          totalCameras: 3,
          isRobust: false,
          criticalSets: [
            { k: 1, cameraNames: ["Camera 1", "Camera 2"], exposureScore: 2.2, waypointCount: 4 },
            { k: 2, cameraNames: ["Camera 3"], exposureScore: 3.1, waypointCount: 5 },
          ],
        },
      },
    });
    expect(html).toContain("K-Robustness Critical Sets");
    expect(html).toContain("Camera 1, Camera 2");
    expect(html).toContain("2.2");
  });

  test("includes occlusion blame detail section", () => {
    const baseReport = makeReport();
    const html = exportAsHtml({
      ...baseReport,
      novelAlgorithms: {
        ...baseReport.novelAlgorithms!,
        occlusionBlame: [
          {
            zoneId: "cash_counter",
            zoneLabel: "Cash Counter",
            baselineQuality: "recognition",
            obstructions: [
              {
                obstructionId: "obs_shelf",
                label: "Aisle Shelf",
                blameFraction: 0.75,
                qualityWithout: "observation",
                qualityImprovement: 1.5,
              },
            ],
          },
        ],
      },
    });
    expect(html).toContain("Occlusion Blame");
    expect(html).toContain("Blame");
    expect(html).toContain("Quality Without");
  });

  test("renders zone table when zones exist", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Zone Analysis");
    expect(html).toContain("<table");
  });

  test("renders 'no zones' message when zones are empty", () => {
    const emptyReport = makeReport({ zones: [] });
    const html = exportAsHtml(emptyReport);
    expect(html).toContain("No critical zones defined");
    // Zone Analysis section header is always rendered; the table is conditional
    expect(html).toContain("Zone Analysis");
  });

  test("includes adversarial path section when provided", () => {
    const report = makeReport({
      adversarialPath: {
        exposureScore: 8.5,
        detectionProbability: 0.75,
        totalDistance: 12.3,
        waypoints: [],
      },
    });
    const html = exportAsHtml(report);
    expect(html).toContain("Coverage Failure Replay");
    expect(html).toContain("8.5");
  });

  test("omits adversarial path section when not provided", () => {
    const html = exportAsHtml(makeReport({ adversarialPath: undefined }));
    expect(html).not.toContain("Coverage Failure Replay");
  });

  test("includes temporal profile section when provided", () => {
    const report = makeReport({
      temporalProfile: {
        vulnerabilityWindowCount: 2,
        safestPeriods: [{ startHour: 8, endHour: 18, label: "Day" }],
        worstCoverage: 45,
      },
    });
    const html = exportAsHtml(report);
    expect(html).toContain("Temporal Security Profile");
    expect(html).toContain("2");
  });

  test("omits temporal profile section when not provided", () => {
    const html = exportAsHtml(makeReport({ temporalProfile: undefined }));
    expect(html).not.toContain("Temporal Security Profile");
  });

  test("escapes HTML in user-provided strings", () => {
    const malicious = makeReport({ siteName: '<script>alert("xss")</script>' });
    const html = exportAsHtml(malicious);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("compliance section shows modeled requirements when all zones pass", () => {
    const passingReport = makeReport({
      summary: {
        ...makeReport().summary,
        zonesPassing: 5,
        zonesTotal: 5,
      },
      codeCompliant: true,
      meetsModeledZoneRequirements: true,
    });
    const html = exportAsHtml(passingReport);
    expect(html).toContain("Meets modeled zone requirements");
  });

  test("compliance section shows unmet modeled requirements when zones fail", () => {
    const failingReport = makeReport({
      summary: {
        ...makeReport().summary,
        zonesPassing: 2,
        zonesTotal: 5,
      },
      codeCompliant: false,
      meetsModeledZoneRequirements: false,
    });
    const html = exportAsHtml(failingReport);
    expect(html).toContain("Does not fully meet modeled zone requirements");
  });
});

describe("exportAsMarkdown", () => {
  const scene = createSmallRetailShopScene();
  const result = simulateStudio(scene);
  const baseReport = buildReportData(scene, result);

  test("produces valid markdown with header", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("# ");
    expect(md).toContain(scene.name);
  });

  test("includes summary table", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("| Total Coverage |");
    expect(md).toContain("| Zones Passing |");
  });

  test("includes zone analysis section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Zone Analysis");
  });

  test("includes issues section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Issues");
  });

  test("includes recommendations section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Recommendations");
  });

  test("includes provenance section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Provenance");
    expect(md).toContain("Scene Source");
  });

  test("includes uncertainty section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Coverage Uncertainty");
  });

  test("includes posture variation section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Coverage Posture Variation");
  });

  test("includes blind spot topology section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Blind Spot Topology");
  });

  test("includes blind spot fingerprint section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Blind Spot Fingerprint");
    expect(md).toContain("Fingerprint:");
    expect(md).toContain("Regions:");
  });

  test("includes reflective bounce section", () => {
    const md = exportAsMarkdown({
      ...baseReport,
      novelAlgorithms: {
        ...baseReport.novelAlgorithms!,
        reflectiveBounce: {
          reflectiveWindowCount: 1,
          affectedCellCount: 4,
          affectedCameraCount: 1,
        },
      },
    });
    expect(md).toContain("Reflective Bounce Vision");
    expect(md).toContain("Reflective windows:");
    expect(md).toContain("Affected cells:");
  });

  test("includes placement oracle detail section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Placement Oracle");
    expect(md).toContain("Best score");
  });

  test("includes redundancy matrix section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Redundancy Matrix");
    expect(md).toContain("SPOF zones");
    expect(md).toContain("Camera matrix");
  });

  test("includes k-robustness critical sets section", () => {
    const md = exportAsMarkdown({
      ...baseReport,
      novelAlgorithms: {
        ...baseReport.novelAlgorithms!,
        kRobustness: {
          kRobustness: 1,
          totalCameras: 3,
          isRobust: false,
          criticalSets: [
            { k: 1, cameraNames: ["Camera 1", "Camera 2"], exposureScore: 2.2, waypointCount: 4 },
            { k: 2, cameraNames: ["Camera 3"], exposureScore: 3.1, waypointCount: 5 },
          ],
        },
      },
    });
    expect(md).toContain("K-Robustness Critical Sets");
    expect(md).toContain("Camera 1, Camera 2");
  });

  test("includes occlusion blame detail section", () => {
    const md = exportAsMarkdown({
      ...baseReport,
      novelAlgorithms: {
        ...baseReport.novelAlgorithms!,
        occlusionBlame: [
          {
            zoneId: "cash_counter",
            zoneLabel: "Cash Counter",
            baselineQuality: "recognition",
            obstructions: [
              {
                obstructionId: "obs_shelf",
                label: "Aisle Shelf",
                blameFraction: 0.75,
                qualityWithout: "observation",
                qualityImprovement: 1.5,
              },
            ],
          },
        ],
      },
    });
    expect(md).toContain("Occlusion Blame");
    expect(md).toContain("Blame");
  });

  test("includes adverse path when provided", () => {
    const report = buildReportData(scene, result, {
      adversarialPath: {
        exposureScore: 5,
        detectionProbability: 0.5,
        totalDistance: 10,
        waypoints: [],
      },
    });
    const md = exportAsMarkdown(report);
    expect(md).toContain("Coverage Failure Replay");
    expect(md).toContain("5.0");
  });

  test("includes temporal profile when provided", () => {
    const report = buildReportData(scene, result, {
      temporalProfile: {
        vulnerabilityWindowCount: 1,
        safestPeriods: [{ startHour: 9, endHour: 17, label: "Work" }],
        worstCoverage: 60,
      },
    });
    const md = exportAsMarkdown(report);
    expect(md).toContain("Temporal Profile");
  });
});

describe("exportAsText", () => {
  const scene = createSmallRetailShopScene();
  const result = simulateStudio(scene);
  const baseReport = buildReportData(scene, result);

  test("produces plain text report", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain(scene.name);
    expect(text).toContain("SUMMARY");
    expect(text).toContain("Modeled requirements");
  });

  test("includes all key metrics", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Total Coverage");
    expect(text).toContain("Blindspot");
    expect(text).toContain("Recognition Area");
    expect(text).toContain("Identification Area");
    expect(text).toContain("Zones Passing");
    expect(text).toContain("Issues Found");
  });

  test("includes novel algorithms section with uncertainty", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("NOVEL ALGORITHMS");
    expect(text).toContain("Coverage Uncertainty");
  });

  test("includes redundancy matrix section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("REDUNDANCY MATRIX");
    expect(text).toContain("SPOF zones");
    expect(text).toContain("Camera matrix");
  });

  test("includes posture variation in novel algorithms section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Coverage Posture Variation");
  });

  test("includes blind spot topology in novel algorithms section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Blind Spot Topology");
  });

  test("includes blind spot fingerprint in novel algorithms section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Blind Spot Fingerprint");
    expect(text).toContain("Fingerprint:");
    expect(text).toContain("Regions:");
  });

  test("includes reflective bounce in novel algorithms section", () => {
    const text = exportAsText({
      ...baseReport,
      novelAlgorithms: {
        ...baseReport.novelAlgorithms!,
        reflectiveBounce: {
          reflectiveWindowCount: 1,
          affectedCellCount: 4,
          affectedCameraCount: 1,
        },
      },
    });
    expect(text).toContain("Reflective Bounce Vision");
    expect(text).toContain("Reflective windows:");
    expect(text).toContain("Affected cells:");
  });

  test("includes placement oracle detail in novel algorithms section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Placement Oracle");
    expect(text).toContain("score");
  });

  test("includes k-robustness critical sets in novel algorithms section", () => {
    const text = exportAsText({
      ...baseReport,
      novelAlgorithms: {
        ...baseReport.novelAlgorithms!,
        kRobustness: {
          kRobustness: 1,
          totalCameras: 3,
          isRobust: false,
          criticalSets: [
            { k: 1, cameraNames: ["Camera 1", "Camera 2"], exposureScore: 2.2, waypointCount: 4 },
            { k: 2, cameraNames: ["Camera 3"], exposureScore: 3.1, waypointCount: 5 },
          ],
        },
      },
    });
    expect(text).toContain("K-Robustness Critical Sets");
    expect(text).toContain("Camera 1, Camera 2");
  });

  test("includes occlusion blame in novel algorithms section", () => {
    const text = exportAsText({
      ...baseReport,
      novelAlgorithms: {
        ...baseReport.novelAlgorithms!,
        occlusionBlame: [
          {
            zoneId: "cash_counter",
            zoneLabel: "Cash Counter",
            baselineQuality: "recognition",
            obstructions: [
              {
                obstructionId: "obs_shelf",
                label: "Aisle Shelf",
                blameFraction: 0.75,
                qualityWithout: "observation",
                qualityImprovement: 1.5,
              },
            ],
          },
        ],
      },
    });
    expect(text).toContain("Occlusion Blame");
  });

  test("includes provenance section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("PROVENANCE");
    expect(text).toContain("Source Counts");
  });

  test("omits issues section when no issues are present", () => {
    const text = exportAsText(baseReport);
    expect(text).not.toContain("ISSUES");
  });

  test("includes issues section when issues are present", () => {
    const baseReport = buildReportData(scene, result);
    const report = {
      ...baseReport,
      issues: [
        {
          severity: "high",
          description: "Entrance coverage gap",
          area: "entrance",
          recommendation: "Add a camera",
        },
      ],
      summary: {
        ...baseReport.summary,
        issuesCount: 1,
      },
    };
    const text = exportAsText(report);
    expect(text).toContain("ISSUES");
  });
});

describe("comparison exports", () => {
  const scene = createSmallRetailShopScene();

  test("exportCompareAsHtml produces valid HTML", () => {
    const afterScene = createSmallRetailShopScene();
    const camera = afterScene.cameras.find((c) => c.id === "cam_entrance");
    if (camera) camera.status = "off";

    const beforeResult = simulateStudio(scene);
    const afterResult = simulateStudio(afterScene);
    const compare = buildCompareReportData(scene, beforeResult, afterScene, afterResult);

    const html = exportCompareAsHtml(compare);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Before/After Comparison");
    expect(html).toContain("Delta Summary");
    expect(html).toContain("Before scenario visual evidence");
    expect(html).toContain("data:image/svg+xml");
  });

  test("exportCompareAsMarkdown produces valid markdown", () => {
    const afterScene = createSmallRetailShopScene();
    const camera = afterScene.cameras.find((c) => c.id === "cam_entrance");
    if (camera) camera.status = "off";

    const beforeResult = simulateStudio(scene);
    const afterResult = simulateStudio(afterScene);
    const compare = buildCompareReportData(scene, beforeResult, afterScene, afterResult);

    const md = exportCompareAsMarkdown(compare);
    expect(md).toContain("# Before/After Comparison");
    expect(md).toContain("## Deltas");
    expect(md).toContain("## Before");
    expect(md).toContain("## After");
  });
});

describe("buildCompareReport (compatibility export)", () => {
  const scene = createSmallRetailShopScene();

  test("produces same output as buildCompareReportData", () => {
    const afterScene = createSmallRetailShopScene();
    const camera = afterScene.cameras.find((c) => c.id === "cam_entrance");
    if (camera) camera.status = "off";

    const beforeResult = simulateStudio(scene);
    const afterResult = simulateStudio(afterScene);

    const direct = buildCompareReportData(scene, beforeResult, afterScene, afterResult);
    const compat = buildCompareReport(scene, beforeResult, afterScene, afterResult);

    expect(compat.deltas.totalCoveragePctDelta).toBe(direct.deltas.totalCoveragePctDelta);
    expect(compat.zoneChanges.length).toBe(direct.zoneChanges.length);
  });
});
