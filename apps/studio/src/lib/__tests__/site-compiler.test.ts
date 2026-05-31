import { describe, expect, test } from "bun:test";

import {
  compileBlankToSiteResult,
  compileScanToSiteResult,
  compileAiDraftToSiteResult,
  compileFloorPlanToSiteResult,
  compileJsonToSiteResult,
  compileCameraEvidenceToSiteResult,
  compileFootageVerifyToSiteResult,
  compileToSiteTwinDraft,
  createSiteIntakeSession,
  canRunBaselineSimulation,
  makeSiteCompilerWarnings,
  calculateConfidence,
  formatCompilerSummary,
  countSiteEntities,
  SITE_SOURCE_MATURITY,
  SITE_INTAKE_SOURCE_LABELS,
  normalizeSiteIntakeSource,
} from "@/lib/site-compiler";
import type { SecurityScene } from "@/schema/security-scene";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

function makeScene(overrides?: Partial<SecurityScene>): SecurityScene {
  const scene = createBlankSecurityScene();
  if (overrides) Object.assign(scene, overrides);
  return scene;
}

function addCamera(scene: SecurityScene) {
  scene.cameras.push({
    id: "cam_1",
    nodeType: "camera",
    name: "Camera 1",
    position: [5, 3, 2],
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    mountHeightM: 3,
    mountType: "wall",
    fovHorizontalDeg: 90,
    fovVerticalDeg: 60,
    rangeM: 30,
    resolutionMP: 8,
    resolutionWidth: 3840,
    resolutionHeight: 2160,
    lensType: "fixed",
    focalLengthMm: 4,
    status: "on",
    nightMode: "ir",
    irRangeM: 30,
    thermalCapable: false,
    ptz: false,
    clarity: "good",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    ndaaCompliant: true,
    privacyMaskingEnabled: false,
    tags: []
  });
}

function addWall(scene: SecurityScene) {
  scene.walls.push({
    id: "wall_1",
    nodeType: "wall",
    label: "Wall 1",
    start: [0, 0],
    end: [10, 0],
    thicknessM: 0.2,
    heightM: 3,
    material: "solid",
    visionTransmission: 0,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  });
}

function addZone(scene: SecurityScene) {
  scene.criticalZones.push({
    id: "zone_1",
    nodeType: "critical_zone",
    label: "Entry Zone",
    targetType: "person_detection",
    priority: "medium",
    requiredQuality: "detection",
    polygon: [[0, 0], [2, 0], [2, 2], [0, 2]],
    heightM: 2.5,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    nightRequired: false,
    redundancyRequired: false,
    privacyZone: false,
  });
}

describe("makeSiteCompilerWarnings", () => {
  test("returns blocking warning when scene has no cameras", () => {
    const scene = makeScene();
    addWall(scene);
    const warnings = makeSiteCompilerWarnings(scene);
    expect(warnings.some((w) => w.code === "NO_CAMERA" && w.severity === "blocking")).toBe(true);
  });

  test("returns info warning when scene has no critical zones", () => {
    const scene = makeScene();
    const warnings = makeSiteCompilerWarnings(scene);
    expect(warnings.some((w) => w.code === "NO_CRITICAL_ZONE")).toBe(true);
  });

  test("produces no warnings when scene is well-equipped", () => {
    const scene = makeScene();
    addCamera(scene);
    addWall(scene);
    scene.criticalZones.push({
      id: "zone_1",
      nodeType: "critical_zone",
      label: "Entry Zone",
      targetType: "person_detection",
      priority: "medium",
      requiredQuality: "detection",
      polygon: [[0, 0], [2, 0], [2, 2], [0, 2]],
      heightM: 2.5,
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
      nightRequired: false,
      redundancyRequired: false,
      privacyZone: false,
    });
    scene.entryPoints.push({
      id: "entry_1",
      nodeType: "entry_point",
      label: "Main Door",
      position: [1, 1],
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    });
    const warnings = makeSiteCompilerWarnings(scene);
    const blocking = warnings.filter((w) => w.severity === "blocking");
    expect(blocking).toHaveLength(0);
  });

  test("includes extra warnings passed as second argument", () => {
    const scene = makeScene();
    const warnings = makeSiteCompilerWarnings(scene, ["Custom warning"]);
    expect(warnings.some((w) => w.message === "Custom warning")).toBe(true);
  });
});

describe("calculateConfidence", () => {
  test("returns 0.92 for an empty warnings array", () => {
    expect(calculateConfidence([])).toBe(0.92);
  });

  test("returns 0.15 for blocking warnings", () => {
    const warnings = [
      { code: "NO_CAMERA", message: "No cameras", severity: "blocking" as const },
    ];
    expect(calculateConfidence(warnings)).toBe(0.15);
  });

  test("returns lower value for serious warnings", () => {
    const warnings = [
      { code: "NO_CAMERA", message: "No cameras", severity: "blocking" as const },
      { code: "NO_WALL", message: "No walls", severity: "warning" as const },
    ];
    const confidence = calculateConfidence(warnings);
    expect(confidence).toBe(0.15);
  });
});

describe("countSiteEntities", () => {
  test("counts entity types from a scene", () => {
    const scene = makeScene();
    addCamera(scene);
    addWall(scene);
    const counts = countSiteEntities(scene);
    expect(counts.cameras).toBe(1);
    expect(counts.walls).toBe(5);
    expect(counts.criticalZones).toBe(0);
  });
});

describe("formatCompilerSummary", () => {
  test("returns summary with entity counts and source", () => {
    const result = compileBlankToSiteResult("Test");
    const summary = formatCompilerSummary(result);
    expect(summary).toContain("walls");
    expect(summary).toContain("Manual Build");
    expect(summary).toContain("Confidence");
  });
});

describe("compileBlankToSiteResult", () => {
  test("creates a new blank scene with manual source", () => {
    const result = compileBlankToSiteResult("My Blank Scene");
    expect(result.source).toBe("manual");
    expect(result.scene.name).toBe("My Blank Scene");
    expect(result.scene.cameras).toHaveLength(0);
  });
});

describe("compileScanToSiteResult", () => {
  test("wraps existing scene with scan source", () => {
    const scene = makeScene();
    addCamera(scene);
    scene.changeLog.push("Scan evidence: camera marker accepted.");
    const result = compileScanToSiteResult(scene);
    expect(result.source).toBe("scan");
    expect(result.scene.source).toBe("scan");
    expect(result.scene.cameras).toHaveLength(1);
    expect(result.provenance.notes).toContain("Scan evidence: camera marker accepted.");
  });

  test("includes extra notes", () => {
    const scene = makeScene();
    const result = compileScanToSiteResult(scene, ["User added notes"]);
    expect(result.provenance.notes).toContain("User added notes");
  });
});

describe("compileAiDraftToSiteResult", () => {
  test("wraps existing scene with ai_prompt source", () => {
    const scene = makeScene();
    const result = compileAiDraftToSiteResult(scene);
    expect(result.source).toBe("ai_prompt");
    expect(result.scene.source).toBe("ai");
  });
});

describe("compileFloorPlanToSiteResult", () => {
  test("wraps existing scene with floor_plan source", () => {
    const scene = makeScene();
    addWall(scene);
    scene.changeLog.push("Floor plan import: 4 walls, 1 door, 0 windows at 85% confidence.");
    const result = compileFloorPlanToSiteResult(scene, 0.85);
    expect(result.source).toBe("floor_plan");
    expect(result.scene.source).toBe("import");
    expect(result.confidence).toBe(0.85);
    expect(result.provenance.notes).toContain("Floor plan import: 4 walls, 1 door, 0 windows at 85% confidence.");
  });
});

describe("compileJsonToSiteResult", () => {
  test("validates a valid scene and returns success", () => {
    const scene = makeScene();
    const result = compileJsonToSiteResult(scene, "export.json");
    expect(result.source).toBe("json");
    expect(result.scene.source).toBe("import");
    expect(result.warnings.some((w) => w.code === "INVALID_SCENE")).toBe(false);
  });

  test("returns blocking warning for invalid scene", () => {
    const result = compileJsonToSiteResult({ invalid: true } as unknown as SecurityScene, "bad.json");
    expect(result.warnings.some((w) => w.code === "INVALID_SCENE" && w.severity === "blocking")).toBe(true);
    expect(result.confidence).toBe(0);
  });
});

describe("normalizeSiteIntakeSource", () => {
  test("normalizes supported legacy keys", () => {
    expect(normalizeSiteIntakeSource("json_import").source).toBe("json");
    expect(normalizeSiteIntakeSource("footage_verify").source).toBe("camera_evidence");
  });

  test("rejects unsupported source keys", () => {
    const normalized = normalizeSiteIntakeSource("random_source");
    expect(normalized.source).toBeNull();
    expect(normalized.warning?.code).toBe("UNSUPPORTED_SITE_SOURCE");
    expect(normalized.warning?.severity).toBe("blocking");
  });
});

describe("compileCameraEvidenceToSiteResult", () => {
  test("wraps scene with camera_evidence source", () => {
    const scene = makeScene();
    addCamera(scene);
    const result = compileCameraEvidenceToSiteResult(scene);
    expect(result.source).toBe("camera_evidence");
    expect(result.scene.source).toBe("import");
    expect(result.provenance.label).toBe("Camera Evidence Preview");
  });

  test("includes extra notes", () => {
    const scene = makeScene();
    const result = compileCameraEvidenceToSiteResult(scene, ["Aligned reference frame"]);
    expect(result.provenance.notes).toContain("Aligned reference frame");
  });
});

describe("compileFootageVerifyToSiteResult", () => {
  test("normalizes legacy footage_verify input to canonical camera_evidence source", () => {
    const scene = makeScene();
    addCamera(scene);
    const result = compileFootageVerifyToSiteResult(scene);
    expect(result.source).toBe("camera_evidence");
    expect(result.scene.source).toBe("import");
    expect(result.provenance.label).toBe("Camera Evidence Preview");
  });
});

describe("compileToSiteTwinDraft pipeline completeness", () => {
  function addZone(scene: SecurityScene) {
    scene.criticalZones.push({
      id: "zone_1", nodeType: "critical_zone", label: "Entry Zone",
      targetType: "person_detection", priority: "medium", requiredQuality: "detection",
      polygon: [[0, 0], [2, 0], [2, 2], [0, 2]], heightM: 2.5, source: "manual",
      reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid",
      nightRequired: false, redundancyRequired: false, privacyZone: false,
    });
  }

  test("every source produces a valid draft without throwing", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    const sources = [
      { label: "scan", result: compileScanToSiteResult(scene) },
      { label: "ai_prompt", result: compileAiDraftToSiteResult(scene) },
      { label: "floor_plan", result: compileFloorPlanToSiteResult(scene) },
      { label: "json", result: compileJsonToSiteResult(scene, "test.json") },
      { label: "manual", result: compileBlankToSiteResult("test") },
      { label: "camera_evidence", result: compileCameraEvidenceToSiteResult(scene) },
    ];
    for (const entry of sources) {
      const draft = compileToSiteTwinDraft(entry.result);
      expect(draft.id).toMatch(/^draft_/);
      expect(draft.entityCounts).toBeDefined();
      expect(draft.assumptions.length).toBeGreaterThanOrEqual(1);
      expect(draft.warnings).toBeInstanceOf(Array);
      expect(draft.missingPrerequisites).toBeInstanceOf(Array);
      expect(draft.suggestedNextActions.length).toBeGreaterThanOrEqual(1);
      expect(draft.provenance.sourceLabel.length).toBeGreaterThan(0);
    }
  });

  test("pipeline: compile -> draft -> canRunBaselineSimulation is consistent", () => {
    const scene = makeScene();
    const emptyResult = compileBlankToSiteResult();
    const emptyDraft = compileToSiteTwinDraft(emptyResult);
    expect(canRunBaselineSimulation(emptyDraft)).toBe(false);

    addCamera(scene);
    const camOnlyResult = compileScanToSiteResult(scene);
    const camOnlyDraft = compileToSiteTwinDraft(camOnlyResult);
    expect(canRunBaselineSimulation(camOnlyDraft)).toBe(false);

    addZone(scene);
    const fullResult = compileScanToSiteResult(scene);
    const fullDraft = compileToSiteTwinDraft(fullResult);
    expect(canRunBaselineSimulation(fullDraft)).toBe(true);

    fullDraft.warnings.push({
      code: "TEST_BLOCKING",
      message: "Blocking for test",
      severity: "blocking",
    });
    expect(canRunBaselineSimulation(fullDraft)).toBe(false);
  });

  test("pipeline: compile -> draft -> approve produces schema-valid scene for all sources", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    const sources = [
      compileScanToSiteResult(scene),
      compileAiDraftToSiteResult(scene),
      compileFloorPlanToSiteResult(scene),
      compileJsonToSiteResult(scene, "test.json"),
      compileCameraEvidenceToSiteResult(scene),
    ];
    for (const result of sources) {
      const draft = compileToSiteTwinDraft(result);
      expect(draft.scene.cameras.length).toBe(1);
      expect(draft.scene.criticalZones.length).toBe(1);
      expect(draft.scene.source).not.toBe("manual");
      expect(draft.scene.updatedAt).toBeGreaterThan(0);
    }
  });
});

describe("createSiteIntakeSession — activation gate contract", () => {
  test("creates a session at stage review without mutating any store state", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    const originalId = scene.id;
    const session = createSiteIntakeSession(scene, "scan", ["photo1.jpg"]);
    expect(session.stage).toBe("review");
    expect(session.source).toBe("scan");
    expect(session.draft).toBeDefined();
    expect(session.result).toBeDefined();
    expect(session.id).toMatch(/^intake_/);
    expect(scene.id).toBe(originalId);
    expect(scene.cameras.length).toBe(1);
  });

  test("session contains a full draft with correct source provenance", () => {
    const scene = makeScene();
    addCamera(scene);
    const session = createSiteIntakeSession(scene, "ai_prompt");
    expect(session.draft!.source).toBe("ai_prompt");
    expect(session.draft!.confidence).toBeGreaterThan(0);
    expect(session.draft!.scene.name).toBe(scene.name);
    expect(session.draft!.provenance.sourceArtifacts).toEqual([]);
  });

  test("every intake source produces a valid session with review stage", () => {
    const scene = makeScene();
    addCamera(scene);
    const sources: Array<import("@/lib/site-compiler").SiteIntakeSource> = [
      "scan", "ai_prompt", "floor_plan", "json", "manual", "camera_evidence",
    ];
    for (const source of sources) {
      const session = createSiteIntakeSession(scene, source);
      expect(session.stage).toBe("review");
      expect(session.result!.source).toBe(source);
      expect(session.draft!.source).toBe(source);
      expect(session.draft!.scene).toBe(scene);
    }
  });

  test("source artifacts are preserved in the draft provenance", () => {
    const scene = makeScene();
    const artifacts = ["photo1.jpg", "raw-data.json"];
    const session = createSiteIntakeSession(scene, "json", artifacts);
    expect(session.draft!.provenance.sourceArtifacts).toEqual(artifacts);
  });

  test("session does not reference or modify the active scene — scene reference is unchanged", () => {
    const scene = makeScene();
    const sceneRefBefore = scene;
    addCamera(scene);
    const session = createSiteIntakeSession(scene, "manual");
    expect(session.draft!.scene).toBe(sceneRefBefore);
    expect(scene.cameras.length).toBe(1);
    scene.cameras.push({} as never);
    expect(session.draft!.scene.cameras.length).toBe(2);
  });
});
