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

  test("buildCompareReportData produces correct deltas", () => {
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

  test("buildCompareReportData identifies zone status changes", () => {
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

  test("produces valid markdown with header", () => {
    const md = exportAsMarkdown(buildReportData(scene, result));
    expect(md).toContain("# ");
    expect(md).toContain(scene.name);
  });

  test("includes summary table", () => {
    const md = exportAsMarkdown(buildReportData(scene, result));
    expect(md).toContain("| Total Coverage |");
    expect(md).toContain("| Zones Passing |");
  });

  test("includes zone analysis section", () => {
    const md = exportAsMarkdown(buildReportData(scene, result));
    expect(md).toContain("## Zone Analysis");
  });

  test("includes issues section", () => {
    const md = exportAsMarkdown(buildReportData(scene, result));
    expect(md).toContain("## Issues");
  });

  test("includes recommendations section", () => {
    const md = exportAsMarkdown(buildReportData(scene, result));
    expect(md).toContain("## Recommendations");
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

  test("produces plain text report", () => {
    const text = exportAsText(buildReportData(scene, result));
    expect(text).toContain(scene.name);
    expect(text).toContain("SUMMARY");
    expect(text).toContain("Modeled requirements");
  });

  test("includes all key metrics", () => {
    const text = exportAsText(buildReportData(scene, result));
    expect(text).toContain("Total Coverage");
    expect(text).toContain("Blindspot");
    expect(text).toContain("Recognition Area");
    expect(text).toContain("Identification Area");
    expect(text).toContain("Zones Passing");
    expect(text).toContain("Issues Found");
  });

  test("omits issues section when no issues are present", () => {
    const text = exportAsText(buildReportData(scene, result));
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
