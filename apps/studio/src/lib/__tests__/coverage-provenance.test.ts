import { describe, expect, test } from "bun:test";
import { buildCoverageProvenance, formatProvenanceMarkdown } from "../coverage-provenance";
import type { SimulationResult, SecurityScene } from "@/schema/security-scene";

function makeScene(overrides?: Partial<SecurityScene>): SecurityScene {
  return {
    id: "scene-1",
    name: "Test Facility",
    source: "manual",
    cameras: [
      { id: "cam-1", nodeType: "camera", name: "Front Door", position: [0, 3, 0], yawDeg: 0, pitchDeg: -30, rollDeg: 0, mountType: "wall", mountHeightM: 3, fovHorizontalDeg: 90, fovVerticalDeg: 50, rangeM: 20, resolutionMP: 4, lensType: "fixed", status: "on", nightMode: "ir", irRangeM: 15, thermalCapable: false, ptz: false, clarity: "good", ndaaCompliant: true, privacyMaskingEnabled: false, source: "manual", tags: [], lprCapable: false, reviewStatus: "reviewed", sourceTrace: "", geometryValidity: "valid", viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] } },
      { id: "cam-2", nodeType: "camera", name: "Loading Dock", position: [10, 3, 10], yawDeg: 180, pitchDeg: -30, rollDeg: 0, mountType: "wall", mountHeightM: 4, fovHorizontalDeg: 110, fovVerticalDeg: 60, rangeM: 30, resolutionMP: 8, lensType: "fixed", status: "on", nightMode: "ir", irRangeM: 20, thermalCapable: false, ptz: false, clarity: "good", ndaaCompliant: true, privacyMaskingEnabled: false, source: "manual", tags: [], lprCapable: false, reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "suspect", viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] } },
    ],
    obstructions: [{ id: "obs-1", nodeType: "obstruction", label: "Shelf Unit", position: [5, 0, 5], dimensions: { width: 2, height: 2.5, depth: 0.5 } }],
    criticalZones: [
      { id: "z-1", label: "Main Entrance", targetType: "entrance", requiredQuality: "recognition" },
    ],
    paths: [],
    sensors: [],
    entryPoints: [],
    privacyZones: [],
    dimensions: { width: 40, depth: 30, height: 4 },
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
    totalCoveragePct: 78.5,
    recognitionAreaPct: 42.3,
    identificationAreaPct: 15.8,
    averageWalkableQuality: 2.1,
    worstAreaQuality: "detection",
    issues: [
      { severity: "high", category: "blindspot", description: "Shelf blocks camera view" },
    ],
    criticalZoneResults: [
      { zoneId: "z-1", label: "Main Entrance", requiredQuality: "recognition", actualQuality: "recognition", status: "pass", coveringCameras: ["cam-1"] },
    ],
    cameraResults: [
      { cameraId: "cam-1", coveragePct: 38.2, criticalZonesCovered: ["z-1"], criticalZonesFailed: [], qualityByZone: {} },
      { cameraId: "cam-2", coveragePct: 50.1, criticalZonesCovered: [], criticalZonesFailed: [], qualityByZone: {} },
    ],
    adversarialPath: {
      totalExposureScore: 0.65,
      waypoints: [
        { position: [0, 0, 0], timeS: 0, detectionQuality: "detection", detectionProbability: 0.5 },
        { position: [10, 0, 10], timeS: 5, detectionQuality: "observation", detectionProbability: 0.8 },
      ],
    },
    kRobustness: { kRobustness: 1, isRobust: false, totalCameras: 2, criticalSets: [["cam-1"]] },
    recommendations: [],
    coverageCells: [],
    fragilitySummary: null,
    ...overrides,
  } as unknown as SimulationResult;
}

describe("buildCoverageProvenance", () => {
  test("produces a complete provenance summary", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult(), { engineVersion: "1.0.0", calibrated: false });
    expect(prov.sceneId).toBe("scene-1");
    expect(prov.sceneName).toBe("Test Facility");
    expect(prov.engineVersion).toBe("1.0.0");
    expect(prov.calibrated).toBe(false);
    expect(prov.sceneSource).toBe("manual");
    expect(prov.generatedAt).toBeGreaterThan(0);
  });

  test("generates claims for total coverage, quality, zones, adversarial path, and k-robustness", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    const claimIds = prov.claims.map((c) => c.claimId);
    expect(claimIds).toContain("total-coverage");
    expect(claimIds).toContain("quality-distribution");
    expect(claimIds).toContain("zone-z-1");
    expect(claimIds).toContain("adversarial-path");
    expect(claimIds).toContain("k-robustness");
  });

  test("includes posture score claim when provided", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult(), {
      postureScore: {
        score: 650,
        band: "good",
        factors: { coverageCompleteness: 0.7, temporalResilience: 0.6, adversarialPathResistance: 0.6, redundancyDepth: 0.5, responseWindow: 0.7 },
        factorScores: { coverageCompleteness: 685, temporalResilience: 630, adversarialPathResistance: 630, redundancyDepth: 575, responseWindow: 685 },
        delta: null,
      },
    });
    const postureClaim = prov.claims.find((c) => c.claimId === "posture-score");
    expect(postureClaim).toBeTruthy();
    expect(postureClaim!.value).toContain("650/850");
    expect(postureClaim!.evidenceSources).toHaveLength(5);
  });

  test("total coverage claim lists all active cameras as evidence sources", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    const totalClaim = prov.claims.find((c) => c.claimId === "total-coverage")!;
    const cameraSources = totalClaim.evidenceSources.filter((s) => s.type === "camera");
    expect(cameraSources).toHaveLength(2);
    expect(cameraSources[0].label).toBe("Front Door");
    expect(cameraSources[0].contribution).toContain("90° FOV");
  });

  test("total coverage claim includes obstructions as evidence source", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    const totalClaim = prov.claims.find((c) => c.claimId === "total-coverage")!;
    const obsSources = totalClaim.evidenceSources.filter((s) => s.type === "obstruction");
    expect(obsSources).toHaveLength(1);
    expect(obsSources[0].contribution).toContain("line-of-sight");
  });

  test("zone claims reference covering cameras", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    const zoneClaim = prov.claims.find((c) => c.claimId === "zone-z-1")!;
    expect(zoneClaim.evidenceSources).toHaveLength(1);
    expect(zoneClaim.evidenceSources[0].nodeId).toBe("cam-1");
  });

  test("camera chain captures review status and geometry validity", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    expect(prov.cameraChain).toHaveLength(2);
    const cam1 = prov.cameraChain.find((c) => c.cameraId === "cam-1")!;
    expect(cam1.reviewStatus).toBe("reviewed");
    expect(cam1.geometryValidity).toBe("valid");
    const cam2 = prov.cameraChain.find((c) => c.cameraId === "cam-2")!;
    expect(cam2.reviewStatus).toBe("unreviewed");
    expect(cam2.geometryValidity).toBe("suspect");
  });

  test("zone chain maps covering camera names", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    expect(prov.zoneChain).toHaveLength(1);
    expect(prov.zoneChain[0].coveringCameraNames).toContain("Front Door");
  });

  test("audit notes flag unreviewed cameras", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    expect(prov.auditNotes.some((n) => n.includes("not been reviewed"))).toBe(true);
  });

  test("audit notes flag suspect geometry", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    expect(prov.auditNotes.some((n) => n.includes("suspect geometry"))).toBe(true);
  });

  test("audit notes flag uncalibrated scene", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    expect(prov.auditNotes.some((n) => n.includes("not been calibrated"))).toBe(true);
  });

  test("audit notes flag AI-extracted source", () => {
    const prov = buildCoverageProvenance(makeScene({ source: "ai" } as never), makeResult());
    expect(prov.auditNotes.some((n) => n.includes("AI-extracted"))).toBe(true);
  });

  test("no audit notes for fully reviewed calibrated manual scene", () => {
    const scene = makeScene({
      cameras: [
        { ...makeScene().cameras[0], reviewStatus: "reviewed", geometryValidity: "valid" } as never,
      ],
      obstructions: [],
    } as never);
    const result = makeResult();
    const prov = buildCoverageProvenance(scene, result, { calibrated: true });
    expect(prov.auditNotes).toHaveLength(0);
  });
});

describe("formatProvenanceMarkdown", () => {
  test("produces valid markdown with all sections", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult());
    const md = formatProvenanceMarkdown(prov);
    expect(md).toContain("# Coverage Provenance Audit Trail");
    expect(md).toContain("## Coverage Claims");
    expect(md).toContain("## Camera Evidence Chain");
    expect(md).toContain("## Zone Evidence Chain");
    expect(md).toContain("## Audit Notes");
    expect(md).toContain("| Front Door |");
    expect(md).toContain("| Main Entrance |");
  });

  test("includes engine version and calibration status", () => {
    const prov = buildCoverageProvenance(makeScene(), makeResult(), { engineVersion: "1.0.0", calibrated: false });
    const md = formatProvenanceMarkdown(prov);
    expect(md).toContain("**Engine:** 1.0.0");
    expect(md).toContain("**Calibrated:** No");
  });
});
