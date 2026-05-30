import { describe, expect, test } from "bun:test";
import {
  compileToSiteTwinDraft,
  canRunBaselineSimulation,
  makeSiteCompilerWarnings,
  SITE_SOURCE_MATURITY,
  compileBlankToSiteResult,
  compileScanToSiteResult,
  compileAiDraftToSiteResult,
  compileFloorPlanToSiteResult,
  compileJsonToSiteResult,
} from "@/lib/site-compiler";
import type { SecurityScene, ScenarioPath, DoorNode } from "@/schema/security-scene";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

function makeScene(overrides?: Partial<SecurityScene>): SecurityScene {
  const scene = createBlankSecurityScene();
  if (overrides) Object.assign(scene, overrides);
  return scene;
}

function addCamera(scene: SecurityScene) {
  scene.cameras.push({
    id: "cam_1", nodeType: "camera", name: "Camera 1", position: [5, 3, 2] as [number, number, number],
    yawDeg: 0, pitchDeg: 0, rollDeg: 0, mountHeightM: 3, mountType: "wall",
    fovHorizontalDeg: 90, fovVerticalDeg: 60, rangeM: 30, resolutionMP: 8,
    resolutionWidth: 3840, resolutionHeight: 2160, lensType: "fixed", focalLengthMm: 4,
    status: "on", nightMode: "ir", irRangeM: 30, thermalCapable: false, ptz: false,
    clarity: "good", source: "manual", reviewStatus: "unreviewed", sourceTrace: "",
    geometryValidity: "valid", ndaaCompliant: true, privacyMaskingEnabled: false, tags: [],
  });
}

function addZone(scene: SecurityScene) {
  scene.criticalZones.push({
    id: "zone_1", nodeType: "critical_zone", label: "Entry Zone",
    targetType: "person_detection", priority: "medium", requiredQuality: "detection",
    polygon: [[0, 0] as [number, number], [2, 0] as [number, number], [2, 2] as [number, number], [0, 2] as [number, number]], heightM: 2.5, source: "manual",
    reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid",
    nightRequired: false, redundancyRequired: false, privacyZone: false,
  });
}

function addEntryPoint(scene: SecurityScene) {
  scene.entryPoints.push({
    id: "entry_1", nodeType: "entry_point", label: "Main Door", position: [1, 1] as [number, number],
    source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid",
  });
}

function addPath(scene: SecurityScene) {
  scene.paths.push({
    id: "path_1", nodeType: "path", label: "Entry Route",
    actorType: "person", speedMps: 1.4, heightM: 1.7, timeOfDay: "day", intent: "authorized",
    points: [{ position: [1, 1] }, { position: [3, 3] }],
    source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid",
  } as unknown as ScenarioPath);
}

describe("compileToSiteTwinDraft", () => {
  test("scan source produces a complete draft with all fields", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    const result = compileScanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result, ["photo1.jpg"]);

    expect(draft.source).toBe("scan");
    expect(draft.confidence).toBeGreaterThan(0);
    expect(draft.confidenceLabel).toMatch(/^(high|medium|low)$/);
    expect(draft.entityCounts.cameras).toBe(1);
    expect(draft.entityCounts.criticalZones).toBe(1);
    expect(draft.entityCounts.walls).toBe(4);
    expect(draft.assumptions.length).toBeGreaterThan(0);
    expect(draft.warnings).toBeInstanceOf(Array);
    expect(draft.missingPrerequisites).toBeInstanceOf(Array);
    expect(draft.provenance.sourceLabel).toBe("Manual-Assisted Scan");
    expect(draft.provenance.sourceArtifacts).toContain("photo1.jpg");
    expect(draft.suggestedNextActions.length).toBeGreaterThan(0);
    expect(draft.id).toMatch(/^draft_/);
  });

  test("AI draft source marks assumptions as model-sourced", () => {
    const scene = makeScene();
    const result = compileAiDraftToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);

    expect(draft.source).toBe("ai_prompt");
    const layoutAssumption = draft.assumptions.find((a) => a.label === "Layout accuracy");
    expect(layoutAssumption).toBeDefined();
    expect(layoutAssumption!.source).toBe("model");
  });

  test("floor plan source includes extraction accuracy assumption", () => {
    const scene = makeScene();
    const result = compileFloorPlanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);

    const extraction = draft.assumptions.find((a) => a.label === "Extraction accuracy");
    expect(extraction).toBeDefined();
    expect(extraction!.source).toBe("estimated");
  });

  test("JSON import source produces valid draft", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    const result = compileJsonToSiteResult(scene, "export.json");
    const draft = compileToSiteTwinDraft(result, ["export.json"]);

    expect(draft.source).toBe("json");
    expect(draft.provenance.sourceArtifacts).toContain("export.json");
  });

  test("manual build source produces valid draft", () => {
    const result = compileBlankToSiteResult("Test Build");
    const draft = compileToSiteTwinDraft(result);

    expect(draft.source).toBe("manual");
    expect(draft.confidenceLabel).toBe("low");
    expect(draft.entityCounts.cameras).toBe(0);
  });

  test("scene with no cameras has NO_CAMERA blocking warning with suggestedAction", () => {
    const scene = makeScene();
    const result = compileScanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);

    const noCamera = draft.warnings.find((w) => w.code === "NO_CAMERA");
    expect(noCamera).toBeDefined();
    expect(noCamera!.severity).toBe("blocking");
    expect(noCamera!.suggestedAction).toContain("Add a camera");
  });

  test("scene with no zones has NO_CRITICAL_ZONE warning with suggestedAction", () => {
    const scene = makeScene();
    addCamera(scene);
    const result = compileScanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);

    const noZone = draft.warnings.find((w) => w.code === "NO_CRITICAL_ZONE");
    expect(noZone).toBeDefined();
    expect(noZone!.suggestedAction).toContain("cash counter");
  });
});

describe("canRunBaselineSimulation", () => {
  test("returns false when no camera exists", () => {
    const scene = makeScene();
    addZone(scene);
    const result = compileScanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);
    expect(canRunBaselineSimulation(draft)).toBe(false);
  });

  test("returns false when no zone exists", () => {
    const scene = makeScene();
    addCamera(scene);
    const result = compileScanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);
    expect(canRunBaselineSimulation(draft)).toBe(false);
  });

  test("returns true when camera and zone exist and no blocking warnings", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    addEntryPoint(scene);
    const result = compileScanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);
    expect(canRunBaselineSimulation(draft)).toBe(true);
  });
});

describe("missing prerequisites", () => {
  test("empty scene has baseline_simulation prerequisites", () => {
    const scene = makeScene();
    const result = compileBlankToSiteResult();
    const draft = compileToSiteTwinDraft(result);

    const baselinePrereqs = draft.missingPrerequisites.filter((p) => p.requiredFor === "baseline_simulation");
    expect(baselinePrereqs.length).toBe(2);
    expect(baselinePrereqs.some((p) => p.code === "NEED_CAMERA")).toBe(true);
    expect(baselinePrereqs.some((p) => p.code === "NEED_ZONE")).toBe(true);
  });

  test("scene with camera+zone but no paths has replay prerequisite only", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    const result = compileScanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);

    const baseline = draft.missingPrerequisites.filter((p) => p.requiredFor === "baseline_simulation");
    expect(baseline).toHaveLength(0);
    const replay = draft.missingPrerequisites.filter((p) => p.requiredFor === "replay");
    expect(replay.length).toBeGreaterThan(0);
  });
});

describe("suggested next actions", () => {
  test("empty scene suggests adding camera and zone", () => {
    const result = compileBlankToSiteResult();
    const draft = compileToSiteTwinDraft(result);

    expect(draft.suggestedNextActions.some((a) => a.action === "add_camera")).toBe(true);
    expect(draft.suggestedNextActions.some((a) => a.action === "add_zone")).toBe(true);
  });

  test("complete scene suggests run_baseline and approve", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    addEntryPoint(scene);
    addPath(scene);
    const result = compileScanToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);

    expect(draft.suggestedNextActions.some((a) => a.action === "run_baseline")).toBe(true);
    expect(draft.suggestedNextActions.some((a) => a.action === "approve")).toBe(true);
  });

  test("AI draft includes regenerate option", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    const result = compileAiDraftToSiteResult(scene);
    const draft = compileToSiteTwinDraft(result);

    expect(draft.suggestedNextActions.some((a) => a.label.includes("Regenerate"))).toBe(true);
  });
});

describe("SITE_SOURCE_MATURITY", () => {
  test("every source has truthful maturity description", () => {
    for (const [key, mat] of Object.entries(SITE_SOURCE_MATURITY)) {
      expect(mat.label.length).toBeGreaterThan(0);
      expect(mat.status).toMatch(/^(Working|Preview|Planned|Scaffolded|Working prototype)$/);
      expect(mat.description.length).toBeGreaterThan(10);
    }
  });

  test("scan does not claim automatic segmentation/depth/reconstruction", () => {
    const scanDesc = SITE_SOURCE_MATURITY.scan.description.toLowerCase();
    expect(scanDesc).toContain("no automatic segmentation");
  });

  test("footage verification does not claim product-grade video understanding", () => {
    const footDesc = SITE_SOURCE_MATURITY.camera_evidence.description.toLowerCase();
    expect(footDesc).toContain("no product-grade");
  });

  test("AI draft says review required", () => {
    const aiDesc = SITE_SOURCE_MATURITY.ai_prompt.description.toLowerCase();
    expect(aiDesc).toContain("review required");
  });

  test("floor plan says best-effort or manual correction", () => {
    const fpDesc = SITE_SOURCE_MATURITY.floor_plan.description.toLowerCase();
    expect(fpDesc.includes("best-effort") || fpDesc.includes("manual correction")).toBe(true);
  });
});

describe("actionable warnings", () => {
  test("door not near wall produces a warning with suggestedAction", () => {
    const scene = makeScene();
    scene.walls.push({
      id: "wall_1", nodeType: "wall", label: "North Wall",
      start: [0, 0] as [number, number], end: [10, 0] as [number, number], thicknessM: 0.2, heightM: 3,
      material: "solid", visionTransmission: 0, source: "manual",
      reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid",
    });
    scene.doors.push({
      id: "door_1", nodeType: "door", label: "Far Door",
      position: [50, 0, 50] as [number, number, number], state: "closed", dimensions: [1, 2.1, 0.1] as [number, number, number],
      source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid",
    } as unknown as DoorNode);
    const warnings = makeSiteCompilerWarnings(scene);
    const doorWarning = warnings.find((w) => w.code === "DOOR_NOT_NEAR_WALL");
    expect(doorWarning).toBeDefined();
    expect(doorWarning!.suggestedAction).toContain("Snap");
    expect(doorWarning!.affectedNodeIds).toContain("door_1");
  });

  test("camera with no FOV produces a warning", () => {
    const scene = makeScene();
    scene.cameras.push({
      id: "cam_nolens", nodeType: "camera", name: "Mystery Cam", position: [5, 3, 2] as [number, number, number],
      yawDeg: 0, pitchDeg: 0, rollDeg: 0, mountHeightM: 3, mountType: "wall",
      fovHorizontalDeg: 0, fovVerticalDeg: 0, rangeM: 30, resolutionMP: 8,
      resolutionWidth: 3840, resolutionHeight: 2160, lensType: "fixed", focalLengthMm: 4,
      status: "on", nightMode: "ir", irRangeM: 30, thermalCapable: false, ptz: false,
      clarity: "good", source: "manual", reviewStatus: "unreviewed", sourceTrace: "",
      geometryValidity: "valid", ndaaCompliant: true, privacyMaskingEnabled: false, tags: [],
    });
    const warnings = makeSiteCompilerWarnings(scene);
    const fovWarning = warnings.find((w) => w.code === "CAMERA_FOV_UNKNOWN");
    expect(fovWarning).toBeDefined();
    expect(fovWarning!.suggestedAction).toContain("preset");
  });
});
