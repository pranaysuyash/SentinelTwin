import { describe, expect, test } from "bun:test";
import { buildPlainLanguageReport, formatPlainLanguageMarkdown } from "../report-plain-language";
import type { SimulationResult, SecurityScene } from "@/schema/security-scene";

function makeScene(overrides?: Partial<SecurityScene>): SecurityScene {
  return {
    id: "scene-1",
    name: "Office Building",
    source: "manual",
    cameras: [
      { id: "cam1", nodeType: "camera", name: "Lobby", position: [0, 3, 0], yawDeg: 0, pitchDeg: -30, rollDeg: 0, mountType: "ceiling", mountHeightM: 3, fovHorizontalDeg: 90, fovVerticalDeg: 50, rangeM: 20, resolutionMP: 4, lensType: "fixed", status: "on", nightMode: "ir", irRangeM: 15, thermalCapable: false, ptz: false, clarity: "good", ndaaCompliant: true, privacyMaskingEnabled: false, source: "manual", tags: [], lprCapable: false, reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid", viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] } },
      { id: "cam2", nodeType: "camera", name: "Rear Door", position: [10, 3, 10], yawDeg: 180, pitchDeg: -30, rollDeg: 0, mountType: "wall", mountHeightM: 3, fovHorizontalDeg: 90, fovVerticalDeg: 50, rangeM: 20, resolutionMP: 4, lensType: "fixed", status: "on", nightMode: "ir", irRangeM: 15, thermalCapable: false, ptz: false, clarity: "good", ndaaCompliant: true, privacyMaskingEnabled: false, source: "manual", tags: [], lprCapable: false, reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid", viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] } },
    ],
    obstructions: [],
    criticalZones: [],
    paths: [],
    sensors: [],
    entryPoints: [],
    privacyZones: [],
    dimensions: { width: 20, depth: 20, height: 4 },
    assumptions: { doriStandard: "iec_62676_4_2024", environmentMode: "day", crowdDensity: "low" },
    changeLog: [],
    snapshots: [],
    scenarios: [],
    updatedAt: Date.now(),
    ...overrides,
  } as unknown as SecurityScene;
}

function makeResult(overrides?: Partial<SimulationResult>): SimulationResult {
  return {
    totalCoveragePct: 72,
    recognitionAreaPct: 45,
    identificationAreaPct: 20,
    averageWalkableQuality: 2.1,
    worstAreaQuality: "detection",
    issues: [],
    criticalZoneResults: [],
    cameraResults: [],
    coverageCells: [],
    recommendations: [],
    ...overrides,
  } as unknown as SimulationResult;
}

describe("plain-language report", () => {
  test("generates headline, overview, and coverage narrative", () => {
    const report = buildPlainLanguageReport(makeScene(), makeResult());
    expect(report.headline).toContain("Office Building");
    expect(report.overallAssessment).toContain("2 cameras are active");
    expect(report.coverageNarrative).toContain("72%");
    expect(report.coverageNarrative).toContain("recognize");
  });

  test("handles failing zones in plain language", () => {
    const result = makeResult({
      criticalZoneResults: [
        { zoneId: "z1", label: "Main Entrance", requiredQuality: "recognition", actualQuality: "detection", status: "fail", coveringCameras: ["cam1"], criticalZoneTotalCount: 1, criticalZonePassCount: 0 },
        { zoneId: "z2", label: "Server Room", requiredQuality: "identification", actualQuality: "observation", status: "fail", coveringCameras: [], criticalZoneTotalCount: 1, criticalZonePassCount: 0 },
      ],
    });
    const report = buildPlainLanguageReport(makeScene(), result);
    expect(report.zoneNarrative).toContain("0 of 2");
    expect(report.zoneNarrative).toContain("Main Entrance");
    expect(report.zoneNarrative).toContain("recognize a known person");
  });

  test("generates action items for offline cameras", () => {
    const scene = makeScene({
      cameras: [
        ...makeScene().cameras,
        { id: "cam3", nodeType: "camera", name: "Offline Cam", status: "off" } as never,
      ],
    });
    const report = buildPlainLanguageReport(scene, makeResult());
    expect(report.actionItems.some((item) => item.includes("offline"))).toBe(true);
  });

  test("includes posture score narrative when provided", () => {
    const report = buildPlainLanguageReport(makeScene(), makeResult(), {
      postureScore: {
        score: 520,
        band: "fair",
        factors: { coverageCompleteness: 0.5, temporalResilience: 0.4, adversarialPathResistance: 0.3, redundancyDepth: 0.2, responseWindow: 0.6 },
        factorScores: { coverageCompleteness: 575, temporalResilience: 520, adversarialPathResistance: 465, redundancyDepth: 410, responseWindow: 630 },
        delta: -15,
      },
    });
    expect(report.postureNarrative).toContain("520");
    expect(report.postureNarrative).toContain("needs improvement");
    expect(report.postureNarrative).toContain("15 points lower");
  });

  test("formats complete markdown document", () => {
    const report = buildPlainLanguageReport(makeScene(), makeResult(), {
      postureScore: {
        score: 720,
        band: "excellent",
        factors: { coverageCompleteness: 0.8, temporalResilience: 0.7, adversarialPathResistance: 0.6, redundancyDepth: 0.5, responseWindow: 0.9 },
        factorScores: { coverageCompleteness: 740, temporalResilience: 685, adversarialPathResistance: 630, redundancyDepth: 575, responseWindow: 795 },
        delta: null,
      },
    });
    const md = formatPlainLanguageMarkdown(report);
    expect(md).toContain("# ");
    expect(md).toContain("## Overview");
    expect(md).toContain("## Camera Coverage");
    expect(md).toContain("## Security Posture Score");
    expect(md).toContain("camera geometry only");
  });

  test("produces crowd narrative when crowd occlusion data is present", () => {
    const result = makeResult({
      crowdOcclusion: {
        effectiveCoveragePct: 65,
        geometricCoveragePct: 72,
        agentCount: 30,
        occlusionByCamera: {},
        chokepoints: [{ position: [5, 0, 5], occlusionPct: 15, agentDensity: 0.3 }],
      } as never,
    });
    const report = buildPlainLanguageReport(makeScene(), result);
    expect(report.crowdNarrative).toContain("drops by about 7");
    expect(report.crowdNarrative).toContain("block camera sightlines");
  });

  test("returns null crowd narrative when no crowd data", () => {
    const report = buildPlainLanguageReport(makeScene(), makeResult());
    expect(report.crowdNarrative).toBeNull();
  });

  test("no critical zones produces guidance message", () => {
    const report = buildPlainLanguageReport(makeScene(), makeResult());
    expect(report.zoneNarrative).toContain("No critical zones have been defined");
  });

  test("all zones passing produces positive narrative", () => {
    const result = makeResult({
      criticalZoneResults: [
        { zoneId: "z1", label: "Entrance", requiredQuality: "detection", actualQuality: "recognition", status: "pass", coveringCameras: ["cam1"], criticalZoneTotalCount: 1, criticalZonePassCount: 1 },
      ],
    });
    const report = buildPlainLanguageReport(makeScene(), result);
    expect(report.zoneNarrative).toContain("meets the required");
  });
});
