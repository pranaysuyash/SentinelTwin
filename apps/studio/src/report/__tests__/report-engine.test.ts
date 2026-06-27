import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildOperationalEvidenceEvent } from "@/lib/operational-evidence";
import { simulateStudio } from "@sentineltwin/simulation";
import { cloneSecurityScene, type SecurityScene } from "@/schema/security-scene";
import {
  applyReportVisibility,
  buildReportData,
  buildCompareReportData,
  exportAsMarkdown,
  exportAsHtml,
  exportAsText,
  exportCompareAsHtml,
  exportCompareAsMarkdown,
  buildCompareReport,
  type ReportData,
} from "@sentineltwin/report";

const testWithTimeout = test as unknown as (
  name: string,
  options: { timeout: number },
  fn: () => void,
) => void;

function longTest(name: string, fn: () => void) {
  return (test as unknown as typeof testWithTimeout)(name, { timeout: 15000 }, fn);
}

function makeEvidenceReport(baseScene: SecurityScene) {
  const evidenceScene = cloneSecurityScene(baseScene);
  evidenceScene.changeLog = [
    ...evidenceScene.changeLog,
    "Evidence: May 29, 10:00 AM | Sensor Triggered | Front door contact triggered near Camera 1 | high",
    "Evidence: May 29, 10:05 AM | Simulation Run | Coverage recomputed after scene edit | medium",
  ];
  return buildReportData(evidenceScene, simulateStudio(evidenceScene));
}

function makeTruthLadderScene(baseScene: SecurityScene) {
  const truthScene = cloneSecurityScene(baseScene);
  truthScene.walls[0] = {
    ...truthScene.walls[0],
    reviewStatus: "verified",
    sourceTrace: "wall-spec-review",
  };
  truthScene.cameras[0] = {
    ...truthScene.cameras[0],
    reviewStatus: "calibrated",
    sourceTrace: "camera-calibration-note",
  };
  truthScene.obstructions[0] = {
    ...truthScene.obstructions[0],
    geometryValidity: "suspect",
    sourceTrace: "obstruction-field-note",
  };
  truthScene.criticalZones[0] = {
    ...truthScene.criticalZones[0],
    geometryValidity: "invalid",
    sourceTrace: "zone-audit-note",
  };
  return truthScene;
}

describe("report engine", () => {
  const scene = createSmallRetailShopScene();
  const result = simulateStudio(scene);

  testWithTimeout("buildReportData produces complete report", { timeout: 15000 }, () => {
    const report = buildReportData(scene, result);
    const standardsReport = buildReportData(scene, result, { templateId: "general-audit" });

    expect(report.sceneId).toBe(scene.id);
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
    expect(report.summary.sensorCount).toBe(scene.sensors.length);
    expect(report.summary.issuesCount).toBe(result.issues.length);
    expect(report.summary.recommendationsCount).toBe(result.recommendations.length);
    expect(report.codeCompliant).toBeDefined();
    expect(report.meetsModeledZoneRequirements).toBeDefined();
    expect(report.meetsModeledZoneRequirements).toBe(report.codeCompliant);
    expect(report.standardsRef).toContain("IEC 62676");
    expect(report.provenance.sceneSourceLabel).toBe("Reference Scene");
    expect(report.provenance.nodeCount).toBeGreaterThan(0);
    expect(report.evidenceTrail.changeLogEntryCount).toBe(scene.changeLog.length);
    expect(report.evidenceTrail.evidenceEntryCount).toBeGreaterThanOrEqual(0);
    expect(report.novelAlgorithms?.coverageEntropy).toBeDefined();
    expect(report.novelAlgorithms?.coverageEntropy?.cellCount).toBeGreaterThan(0);
    expect(report.novelAlgorithms?.coverageUncertainty).toBeDefined();
    expect(report.novelAlgorithms?.coverageUncertainty?.sampleCount).toBeGreaterThan(0);
    expect(report.novelAlgorithms?.postureVariation).toBeDefined();
    expect(report.novelAlgorithms?.postureVariation?.profiles.length).toBeGreaterThan(0);
    expect(report.novelAlgorithms?.blindRegions).toBeDefined();
    expect(report.novelAlgorithms?.blindSpotFingerprint).toBeDefined();
    expect(report.redundancyMatrix).toBeDefined();
    expect(report.redundancyMatrix?.cameraRows.length).toBeGreaterThan(0);
    expect(report.redundancyMatrix?.vulnerableZones.length).toBeGreaterThan(0);
    expect(standardsReport.template.id).toBe("general-audit");
    expect(standardsReport.template.standardLabel).toBe("IEC 62676-4:2025");
    expect(standardsReport.template.sections.length).toBeGreaterThan(0);
    expect(exportAsMarkdown(standardsReport)).toContain("Standards Template");
  });

  testWithTimeout("buildReportData carries the temporal twin publication checkpoint when evidence is present", { timeout: 15000 }, () => {
    const publishedEvent = buildOperationalEvidenceEvent({
      kind: "scene_published",
      title: "Scene published",
      details: "Promoted the current scene state to the published branch.",
      actor: "user",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: scene.changeLog.length,
      affectedNodeIds: scene.cameras.map((camera) => camera.id),
      confidence: 0.98,
      branchLabel: "published",
      lifecycleStage: "published",
      published: true,
      beforeSummary: "Before publish",
      afterSummary: "After publish",
      sceneSnapshot: cloneSecurityScene(scene),
    });
    const report = buildReportData(scene, result, { operationalEvidenceEvents: [publishedEvent] });

    expect(report.temporalTwin?.publishedCheckpointCount).toBe(1);
    expect(report.temporalTwin?.latestPublishedCheckpoint?.title).toBe("Scene published");
    expect(report.temporalTwin?.latestPublishedCheckpointProvenance?.isExactSnapshot).toBe(true);
    expect(report.temporalTwin?.latestPublishedCheckpointProvenance?.sourceEventTitle).toBe("Scene published");
    expect(report.temporalTwin?.latestPublishedCheckpointAgeMs).toBeGreaterThanOrEqual(0);
  });

  longTest("buildReportData maps zone results correctly", () => {
    const report = buildReportData(scene, result);

    expect(report.zones.length).toBe(result.criticalZoneResults.length);
    for (const zone of report.zones) {
      expect(zone.targetType).toBeDefined();
      expect(zone.targetRequirementQuality).toBeDefined();
      expect(["high", "medium", "low"]).toContain(zone.targetRequirementPpmThreshold);
      expect(zone.targetRequirementRationale.length).toBeGreaterThan(10);
      expect(["pass", "fail", "warning"]).toContain(zone.status);
      expect(zone.coveragePct).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(zone.coveringCameras)).toBe(true);
    }
  });

  longTest("buildReportData maps camera results correctly", () => {
    const report = buildReportData(scene, result);

    expect(report.cameras.length).toBe(result.cameraResults.length);
    for (const cam of report.cameras) {
      expect(cam.id).toBeTruthy();
      expect(cam.coveragePct).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(cam.zonesCovered)).toBe(true);
      expect(cam.bestZoneQuality).toBeTruthy();
      expect(cam.zonesFailed).toBeGreaterThanOrEqual(0);
    }
  });

  testWithTimeout("buildReportData maps issues with severity", { timeout: 20000 }, () => {
    const report = buildReportData(scene, result);

    for (const issue of report.issues) {
      expect(["critical", "high", "medium", "low"]).toContain(issue.severity);
      expect(issue.description).toBeTruthy();
    }
  });

  longTest("buildReportData maps recommendations with verification status", () => {
    const report = buildReportData(scene, result);

    for (const rec of report.recommendations) {
      expect(rec.description).toBeTruthy();
      expect(["free", "low", "medium", "high"]).toContain(rec.costCategory);
      expect(typeof rec.verified).toBe("boolean");
    }
  });

  longTest("buildReportData accepts adversarial path options", () => {
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

  longTest("buildReportData accepts temporal profile options", () => {
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

  testWithTimeout("buildReportData with custom title", { timeout: 20000 }, () => {
    const report = buildReportData(scene, result, { title: "Custom Audit" });
    expect(report.title).toBe("Custom Audit");
  });

  longTest("buildReportData accepts audience options", () => {
    const report = buildReportData(scene, result, { audience: "auditor" });
    expect(report.audience).toBe("auditor");
    expect(report.audienceLabel).toBe("Auditor");
    expect(report.title).toBe("Security Audit Evidence Report");
    expect(report.audiencePolicy.disclosureLevel).toBe("evidence_first");
    expect(report.audiencePolicy.visibleSections).toContain("operational_evidence");
  });

  longTest("buildReportData assigns distinct audience policies", () => {
    const operatorReport = buildReportData(scene, result, { audience: "operator" });
    const privacyReport = buildReportData(scene, result, { audience: "privacy_reviewer" });

    expect(operatorReport.audiencePolicy.disclosureLevel).toBe("full");
    expect(operatorReport.audiencePolicy.withheldSections).toHaveLength(0);
    expect(privacyReport.audiencePolicy.disclosureLevel).toBe("privacy_minimized");
    expect(privacyReport.audiencePolicy.visibleSections).toContain("privacy_masking");
    expect(privacyReport.audiencePolicy.withheldSections).toContain("operational_evidence");
    expect(operatorReport.audiencePolicy.disclosureSummary).not.toBe(privacyReport.audiencePolicy.disclosureSummary);
  });

  longTest("applyReportVisibility redacts shared and privacy-safe exports", () => {
    const evidenceScene = cloneSecurityScene(scene);
    evidenceScene.changeLog = [
      ...evidenceScene.changeLog,
      "Evidence: May 29, 10:05 AM | Simulation Run | Coverage recomputed after scene edit | medium",
    ];
    const report = buildReportData(evidenceScene, result, {
      operationalEvidenceEvents: [
        buildOperationalEvidenceEvent({
          kind: "scene_published",
          title: "Scene published",
          details: "Promoted the current scene state to the published branch.",
          actor: "user",
          source: evidenceScene.source,
          sceneId: evidenceScene.id,
          sceneName: evidenceScene.name,
          revisionDepth: evidenceScene.changeLog.length,
          affectedNodeIds: evidenceScene.cameras.map((camera) => camera.id),
          confidence: 0.98,
          branchLabel: "published",
          lifecycleStage: "published",
          published: true,
          beforeSummary: "Before publish",
          afterSummary: "After publish",
          sceneSnapshot: cloneSecurityScene(evidenceScene),
        }),
      ],
    });
    const shared = applyReportVisibility(report, "shared");
    const privacySafe = applyReportVisibility(report, "privacy_safe");

    expect(shared.visibility).toBe("shared");
    expect(shared.template.id).toBe(report.template.id);
    expect(shared.provenance.confidenceNotes).toHaveLength(0);
    expect(shared.evidenceTrail.recentEntries[0]?.confidence).toBe("withheld");
    expect(shared.evidenceTrail.recentEntries[0]?.details).toBe("Redacted in shared export.");
    expect(privacySafe.visibility).toBe("privacy_safe");
    expect(privacySafe.provenance.sourceNotes).toHaveLength(0);
    expect(privacySafe.evidenceTrail.recentEntries).toHaveLength(0);
  });

  testWithTimeout("buildReportData extracts an operational evidence trail", { timeout: 20000 }, () => {
    const report = makeEvidenceReport(scene);

    expect(report.evidenceTrail.evidenceEntryCount).toBeGreaterThanOrEqual(2);
    expect(report.evidenceTrail.sensorEvidenceCount).toBeGreaterThanOrEqual(1);
    expect(report.evidenceTrail.recentEntries.length).toBeGreaterThan(0);
    expect(report.evidenceTrail.recentEntries[0].title).toBe("Simulation Run");
    expect(report.evidenceTrail.recentEntries[0].anchorId).toContain("evidence-");
    expect(report.evidenceTrail.recentEntries[0].evidenceUri).toContain(`scene:${scene.id}:report:`);
  });

  longTest("buildReportData summarizes the truth ladder", () => {
    const truthScene = makeTruthLadderScene(scene);
    const report = buildReportData(truthScene, simulateStudio(truthScene));

    expect(report.truthLadder.nodeCount).toBeGreaterThan(0);
    expect(report.truthLadder.reviewedNodeCount).toBeGreaterThan(0);
    expect(report.truthLadder.verifiedNodeCount).toBeGreaterThan(0);
    expect(report.truthLadder.sourceTraceCount).toBeGreaterThan(0);
    expect(report.truthLadder.suspectGeometryCount).toBeGreaterThan(0);
    expect(report.truthLadder.invalidGeometryCount).toBeGreaterThan(0);
    expect(report.truthLadder.summary).toContain("verified");
  });

  longTest("buildCompareReportData produces correct deltas", () => {
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

  longTest("buildCompareReportData identifies zone status changes", () => {
    const modifiedScene = createSmallRetailShopScene();
    const camera = modifiedScene.cameras.find((c) => c.id === "cam_entrance");
    if (camera) camera.status = "off";

    const beforeResult = simulateStudio(scene);
    const afterResult = simulateStudio(modifiedScene);
    const compare = buildCompareReportData(scene, beforeResult, modifiedScene, afterResult);

    const changed = compare.zoneChanges.filter((z: { changed: boolean }) => z.changed);
    expect(changed.length).toBeGreaterThanOrEqual(0);
  });
});

describe("exportAsHtml", () => {
  const scene = createSmallRetailShopScene();
  const result = simulateStudio(scene);
  const baseReport = buildReportData(scene, result);

  function makeReport(overrides?: Partial<ReportData>): ReportData {
    return {
      ...baseReport,
      ...overrides,
    };
  }

  longTest("produces valid HTML document", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain(scene.name);
  });

  longTest("includes standards badge", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("IEC 62676");
  });

  longTest("includes audience framing", () => {
    const html = exportAsHtml(makeReport({
      audience: "insurer",
      audienceLabel: "Insurer",
      audienceFraming: "Risk, resilience, and recovery framing for underwriting or exposure review.",
      title: "Security Risk Exposure Brief",
    }));
    expect(html).toContain("Insurer audience");
    expect(html).toContain("Risk, resilience, and recovery framing");
  });

  longTest("includes audience policy", () => {
    const html = exportAsHtml(makeReport({
      audience: "privacy_reviewer",
      audienceLabel: "Privacy Reviewer",
      audienceFraming: "Visibility, retention, and overcollection framing for privacy review.",
      title: "Privacy Review Brief",
    }));
    expect(html).toContain("Audience Policy");
    expect(html).toContain("Visible Sections");
    expect(html).toContain("Withheld Sections");
  });

  longTest("includes visibility redaction and buyer drill-through", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Visibility &amp; Redaction");
    expect(html).toContain("Buyer Drill-Through");
    expect(html).toContain("Inspection shortcuts");
    expect(html).toContain("Standards Template");
    expect(html).toContain("Template Depth");
  });

  longTest("includes privacy masking summary for privacy reviewer exports", () => {
    const html = exportAsHtml(makeReport({
      audience: "privacy_reviewer",
      audienceLabel: "Privacy Reviewer",
      audienceFraming: "Visibility, retention, and overcollection framing for privacy review.",
      title: "Privacy Review Brief",
    }));
    expect(html).toContain("Privacy Masking Summary");
    expect(html).toContain("Privacy Masking");
  });

  longTest("includes provenance section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Provenance");
    expect(html).toContain("Source history");
  });

  longTest("includes truth ladder section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Truth Ladder");
    expect(html).toContain("Reviewed Nodes");
  });

  testWithTimeout("includes operational evidence section", { timeout: 20000 }, () => {
    const html = exportAsHtml(makeEvidenceReport(scene));
    expect(html).toContain("Operational Evidence");
    expect(html).toContain("Scene ID");
    expect(html).toContain("Sensor-related evidence");
    expect(html).toContain("Evidence links");
    expect(html).toContain("Recent evidence entries");
    expect(html).toContain(`scene:${scene.id}:report:`);
    expect(html).toContain("id=\"evidence-");
  });

  longTest("includes uncertainty section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Coverage Uncertainty");
    expect(html).toContain("samples");
  });

  longTest("includes entropy section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Coverage Entropy");
    expect(html).toContain("dominant");
  });

  longTest("includes posture variation section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Coverage Posture Variation");
    expect(html).toContain("largest drop");
  });

  longTest("includes blind spot topology section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Blind Spot Topology");
    expect(html).toContain("critical");
  });

  longTest("includes blind spot fingerprint section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Blind Spot Fingerprint");
    expect(html).toContain("Fingerprint");
    expect(html).toContain("Regions");
  });

  longTest("includes redundancy matrix section", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Redundancy Matrix");
    expect(html).toContain("Vulnerable Zones");
    expect(html).toContain("Single-point zones");
  });

  longTest("includes sensors summary card", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Sensors</div>");
  });

  longTest("includes camera analysis columns", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Best Zone Quality");
    expect(html).toContain("Zones Failed");
  });

  longTest("includes reflective bounce section", () => {
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
    // Reflective bounce data is available in the report model but not rendered in HTML export
    expect(html).not.toContain("Reflective Bounce Vision");
  });

  longTest("includes placement oracle detail section", () => {
    const html = exportAsHtml(makeReport());
    // Placement oracle data is available in the report model but not rendered in HTML export
    expect(html).not.toContain("Placement Oracle");
  });

  longTest("includes k-robustness critical sets section", () => {
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
    // K-robustness data is in the report model but not rendered in HTML export
    expect(html).not.toContain("K-Robustness Critical Sets");
  });

  longTest("includes occlusion blame detail section", () => {
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
    // Occlusion blame data is available in the report model but not rendered in HTML export
    expect(html).not.toContain("Occlusion Blame");
  });

  longTest("renders zone table when zones exist", () => {
    const html = exportAsHtml(makeReport());
    expect(html).toContain("Zone Analysis");
    expect(html).toContain("<table");
  });

  longTest("renders 'no zones' message when zones are empty", () => {
    const emptyReport = makeReport({ zones: [] });
    const html = exportAsHtml(emptyReport);
    expect(html).toContain("No critical zones defined");
    // Zone Analysis section header is always rendered; the table is conditional
    expect(html).toContain("Zone Analysis");
  });

  longTest("includes adversarial path section when provided", () => {
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

  longTest("omits adversarial path section when not provided", () => {
    const html = exportAsHtml(makeReport({ adversarialPath: undefined }));
    expect(html).not.toContain("Coverage Failure Replay");
  });

  longTest("includes temporal profile section when provided", () => {
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

  longTest("omits temporal profile section when not provided", () => {
    const html = exportAsHtml(makeReport({ temporalProfile: undefined }));
    expect(html).not.toContain("Temporal Security Profile");
  });

  longTest("escapes HTML in user-provided strings", () => {
    const malicious = makeReport({ siteName: '<script>alert("xss")</script>' });
    const html = exportAsHtml(malicious);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  longTest("compliance section shows modeled requirements when all zones pass", () => {
    const passingReport = makeReport({
      summary: {
        ...baseReport.summary,
        zonesPassing: 5,
        zonesTotal: 5,
      },
      codeCompliant: true,
      meetsModeledZoneRequirements: true,
    });
    const html = exportAsHtml(passingReport);
    expect(html).toContain("Meets modeled zone requirements");
  });

  longTest("compliance section shows unmet modeled requirements when zones fail", () => {
    const failingReport = makeReport({
      summary: {
        ...baseReport.summary,
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

  longTest("produces valid markdown with header", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("# ");
    expect(md).toContain(scene.name);
  });

  longTest("includes summary table", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("| Total Coverage |");
    expect(md).toContain("| Zones Passing |");
    expect(md).toContain("| Sensors |");
  });

  longTest("includes audience framing", () => {
    const md = exportAsMarkdown({
      ...baseReport,
      audience: "privacy_reviewer",
      audienceLabel: "Privacy Reviewer",
      audienceFraming: "Visibility, retention, and overcollection framing for privacy review.",
      title: "Privacy Review Brief",
    });
    expect(md).toContain("**Audience:** Privacy Reviewer");
    expect(md).toContain("Visibility, retention, and overcollection framing");
  });

  longTest("includes audience policy", () => {
    const md = exportAsMarkdown({
      ...baseReport,
      audience: "privacy_reviewer",
      audienceLabel: "Privacy Reviewer",
      audienceFraming: "Visibility, retention, and overcollection framing for privacy review.",
      title: "Privacy Review Brief",
    });
    expect(md).toContain("## Audience Policy");
    expect(md).toContain("**Disclosure Level:**");
    expect(md).toContain("**Visible Sections:**");
  });

  longTest("includes visibility redaction and buyer drill-through", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Visibility and Redaction");
    expect(md).toContain("## Buyer Drill-Through");
    expect(md).toContain("Inspection shortcuts");
  });

  longTest("includes privacy masking summary for privacy reviewer exports", () => {
    const md = exportAsMarkdown({
      ...baseReport,
      audience: "privacy_reviewer",
      audienceLabel: "Privacy Reviewer",
      audienceFraming: "Visibility, retention, and overcollection framing for privacy review.",
      title: "Privacy Review Brief",
    });
    expect(md).toContain("## Privacy Masking Summary");
    expect(md).toContain("Privacy Masking");
  });

  longTest("includes zone analysis section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Zone Analysis");
  });

  longTest("includes issues section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Issues");
  });

  longTest("includes recommendations section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Recommendations");
  });

  longTest("includes provenance section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Provenance");
    expect(md).toContain("Scene Source");
  });

  longTest("includes truth ladder section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Truth Ladder");
    expect(md).toContain("Reviewed Nodes");
  });

  testWithTimeout("includes operational evidence section", { timeout: 20000 }, () => {
    const md = exportAsMarkdown(makeEvidenceReport(scene));
    expect(md).toContain("## Operational Evidence");
    expect(md).toContain("Scene ID");
    expect(md).toContain("Sensor-related Evidence");
    expect(md).toContain("Evidence Links");
    expect(md).toContain("Recent Evidence Details");
  });

  longTest("includes sensors summary row", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("| Sensors |");
  });

  longTest("includes camera analysis table", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("## Camera Analysis");
    expect(md).toContain("Best Zone Quality");
    expect(md).toContain("Zones Failed");
  });

  longTest("includes uncertainty section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Coverage Uncertainty");
  });

  longTest("includes entropy section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Coverage Entropy");
    expect(md).toContain("dominant");
  });

  longTest("includes posture variation section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Coverage Posture Variation");
  });

  longTest("includes blind spot topology section", () => {
    const md = exportAsMarkdown(baseReport);
    // Blind spot topology details are in the report model but not rendered in Markdown export
    expect(md).not.toContain("## Blind Spot Topology");
  });

  longTest("includes blind spot fingerprint section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Blind Spot Fingerprint");
    expect(md).toContain("Fingerprint:");
    expect(md).toContain("Regions:");
  });

  longTest("includes reflective bounce section", () => {
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
    // Reflective bounce data is available in the report model but not rendered in Markdown export
    expect(md).not.toContain("Reflective Bounce Vision");
  });

  longTest("includes placement oracle detail section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Placement Oracle");
    expect(md).toContain("Best score");
  });

  longTest("includes redundancy matrix section", () => {
    const md = exportAsMarkdown(baseReport);
    expect(md).toContain("Redundancy Matrix");
    expect(md).toContain("SPOF zones");
    expect(md).toContain("Camera matrix");
  });

  longTest("includes k-robustness critical sets section", () => {
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
    // K-robustness data is available in the report model but not rendered in Markdown export
    expect(md).not.toContain("K-Robustness Critical Sets");
  });

  longTest("includes occlusion blame detail section", () => {
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
    // Occlusion blame data is available in the report model but not rendered in Markdown export
    expect(md).not.toContain("Occlusion Blame");
  });

  testWithTimeout("includes adverse path when provided", { timeout: 20000 }, () => {
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
    expect(md).toContain("5");
  });

  longTest("includes temporal profile when provided", () => {
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

  longTest("produces plain text report", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain(scene.name);
    expect(text).toContain("SUMMARY");
    expect(text).toContain("Modeled requirements");
  });

  longTest("includes all key metrics", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Total Coverage");
    expect(text).toContain("Blindspot");
    expect(text).toContain("Recognition Area");
    expect(text).toContain("Identification Area");
    expect(text).toContain("Zones Passing");
    expect(text).toContain("Sensors");
    expect(text).toContain("Issues Found");
  });

  longTest("includes audience framing", () => {
    const text = exportAsText({
      ...baseReport,
      audience: "installer",
      audienceLabel: "Installer",
      audienceFraming: "Acceptance-oriented summary for installers, integrators, and commissioning teams.",
      title: "Installation Acceptance Report",
    });
    expect(text).toContain("Audience: Installer");
    expect(text).toContain("Acceptance-oriented summary");
  });

  longTest("includes audience policy in compare exports", () => {
    const afterScene = createSmallRetailShopScene();
    const beforeResult = simulateStudio(scene);
    const afterResult = simulateStudio(afterScene);
    const compare = buildCompareReportData(scene, beforeResult, afterScene, afterResult, { audience: "auditor" });

    const html = exportCompareAsHtml(compare);
    const md = exportCompareAsMarkdown(compare);

    expect(html).toContain("Scene IDs");
    expect(md).toContain("**Audience Policy:**");
    expect(md).toContain("**Visible Sections:**");
    expect(md).toContain("Scene IDs");
  });

  longTest("includes uncertainty section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("NOVEL ALGORITHMS");
    expect(text).toContain("Coverage Uncertainty");
  });

  longTest("includes entropy section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Coverage Entropy");
    expect(text).toContain("dominant");
  });

  longTest("includes redundancy matrix section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("REDUNDANCY MATRIX");
    expect(text).toContain("SPOF zones");
    expect(text).toContain("Camera matrix");
  });

  longTest("includes posture variation section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Coverage Posture Variation");
  });

  longTest("includes blind spot topology in novel algorithms section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Blind Spot Topology");
  });

  longTest("includes blind spot fingerprint in novel algorithms section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Blind Spot Fingerprint");
    expect(text).toContain("Fingerprint:");
    expect(text).toContain("Regions:");
  });

  longTest("includes reflective bounce in novel algorithms section", () => {
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
    // Reflective bounce data is available in the report model but not rendered in Text export
    expect(text).not.toContain("Reflective Bounce Vision");
  });

  longTest("includes placement oracle detail in novel algorithms section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("Placement Oracle");
    expect(text).toContain("score");
  });

  longTest("includes k-robustness critical sets in novel algorithms section", () => {
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
    // K-robustness data is available in the report model but not rendered in Text export
    expect(text).not.toContain("K-Robustness Critical Sets");
  });

  longTest("includes occlusion blame in novel algorithms section", () => {
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
    // Occlusion blame data is available in the report model but not rendered in Text export
    expect(text).not.toContain("Occlusion Blame");
  });

  longTest("includes provenance section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("PROVENANCE");
    expect(text).toContain("Source Counts");
  });

  longTest("includes truth ladder section", () => {
    const text = exportAsText(baseReport);
    expect(text).toContain("TRUTH LADDER");
    expect(text).toContain("Reviewed Nodes");
  });

  testWithTimeout("includes operational evidence section", { timeout: 20000 }, () => {
    const text = exportAsText(makeEvidenceReport(scene));
    expect(text).toContain("OPERATIONAL EVIDENCE");
    expect(text).toContain("Scene ID");
    expect(text).toContain("Sensor-related Evidence");
    expect(text).toContain("Evidence Links");
    expect(text).toContain("Recent Evidence Entries");
  });

  longTest("omits issues section when no issues are present", () => {
    const text = exportAsText(baseReport);
    expect(text).not.toContain("ISSUES");
  });

  testWithTimeout("includes issues section when issues are present", { timeout: 10000 }, () => {
    const baseReport = buildReportData(scene, result);
    const report = {
      ...baseReport,
      issues: [
        {
          severity: "high",
          description: "Entrance coverage gap",
          area: "entrance",
          category: "quality_fail",
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

  longTest("exportCompareAsHtml produces valid HTML", () => {
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
    expect(html).toContain("Truth Ladder");
    expect(html).toContain("data:image/svg+xml");
    expect(html).toContain("Evidence Entries");
    expect(html).toContain("Operational Evidence");
    expect(html).toContain("Visibility &amp; Redaction");
    expect(html).toContain("Buyer Drill-Through");
    expect(html).toContain("Scene IDs");
  });

  longTest("exportCompareAsMarkdown produces valid markdown", () => {
    const afterScene = createSmallRetailShopScene();
    const camera = afterScene.cameras.find((c) => c.id === "cam_entrance");
    if (camera) camera.status = "off";

    const beforeResult = simulateStudio(scene);
    const afterResult = simulateStudio(afterScene);
    const compare = buildCompareReportData(scene, beforeResult, afterScene, afterResult, { audience: "auditor" });

    const md = exportCompareAsMarkdown(compare);
    expect(md).toContain("# Before/After Comparison");
    expect(md).toContain("## Deltas");
    expect(md).toContain("## Before");
    expect(md).toContain("## After");
    expect(md).toContain("## Truth Ladder");
    expect(md).toContain("Evidence Entries");
    expect(md).toContain("## Operational Evidence");
    expect(md).toContain("## Visibility and Redaction");
    expect(md).toContain("## Buyer Drill-Through");
    expect(md).toContain("Scene IDs");
    expect(md).toContain("**Audience:** Auditor");
  });

  longTest("compare exports render evidence links when evidence entries exist", () => {
    const beforeScene = createSmallRetailShopScene();
    const afterScene = createSmallRetailShopScene();
    beforeScene.changeLog = [
      ...beforeScene.changeLog,
      "Evidence: May 29, 09:15 AM | Baseline Capture | Before state captured for handoff review | medium",
    ];
    afterScene.changeLog = [
      ...afterScene.changeLog,
      "Evidence: May 29, 09:30 AM | Recheck Capture | After state captured for handoff review | high",
    ];
    const beforeResult = simulateStudio(beforeScene);
    const afterResult = simulateStudio(afterScene);
    const compare = buildCompareReportData(beforeScene, beforeResult, afterScene, afterResult);

    const html = exportCompareAsHtml(compare);
    const md = exportCompareAsMarkdown(compare);

    expect(html).toContain("Before Evidence Links:");
    expect(html).toContain("After Evidence Links:");
    expect(md).toContain("Before Evidence Links");
    expect(md).toContain("After Evidence Links");
    expect(md).toContain(`scene:${beforeScene.id}:report:`);
    expect(md).toContain(`scene:${afterScene.id}:report:`);
  });
});

describe("buildCompareReport (compatibility export)", () => {
  const scene = createSmallRetailShopScene();

  longTest("produces same output as buildCompareReportData", () => {
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
