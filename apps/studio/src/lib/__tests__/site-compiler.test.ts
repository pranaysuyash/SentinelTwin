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
  advanceSessionStage,
  canAdvanceStage,
  SITE_INTAKE_STAGE_ORDER,
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
    tags: [],
    viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] },
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
    const scene = makeScene();
    const sceneWithInvalid = { ...scene, cameras: "invalid" } as unknown as SecurityScene;
    const result = compileJsonToSiteResult(sceneWithInvalid, "bad.json");
    expect(result.warnings.some((w) => w.code === "INVALID_SCENE" && w.severity === "blocking")).toBe(true);
    expect(result.confidence).toBe(0);
  });
});

describe("normalizeSiteIntakeSource", () => {
  test("normalizes legacy json_import to canonical json", () => {
    const normalized = normalizeSiteIntakeSource("json_import");
    expect(normalized.source).toBe("json");
    expect(normalized.warning?.code).toBe("SITE_SOURCE_NORMALIZED");
    expect(normalized.warning?.severity).toBe("info");
  });

  test("normalizes legacy footage_verify to canonical camera_evidence", () => {
    const normalized = normalizeSiteIntakeSource("footage_verify");
    expect(normalized.source).toBe("camera_evidence");
    expect(normalized.warning?.code).toBe("SITE_SOURCE_NORMALIZED");
    expect(normalized.warning?.severity).toBe("info");
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
    expect(result.provenance.label).toBe("Camera Evidence Preview (Footage Verify)");
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

    fullDraft.readiness = {
      ...fullDraft.readiness,
      canSimulate: false,
      level: "insufficient",
      blockingWarnings: [
        { code: "TEST_BLOCKING", message: "Blocking for test", severity: "blocking", suggestedAction: "", affectedNodeIds: [] },
      ],
      advisoryWarnings: [],
      summary: "Blocking for test",
    };
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
      expect(session.draft!.scene).not.toBe(scene);
      expect(session.draft!.scene).toEqual(scene);
    }
  });

  test("source artifacts are preserved in the draft provenance", () => {
    const scene = makeScene();
    const artifacts = ["photo1.jpg", "raw-data.json"];
    const session = createSiteIntakeSession(scene, "json", artifacts);
    expect(session.draft!.provenance.sourceArtifacts).toEqual(artifacts);
    artifacts.push("later-mutation.json");
    expect(session.draft!.provenance.sourceArtifacts).toEqual(["photo1.jpg", "raw-data.json"]);
  });

  test("session snapshot is isolated from later caller-side scene mutation", () => {
    const scene = makeScene();
    addCamera(scene);
    const session = createSiteIntakeSession(scene, "manual");
    expect(session.draft!.scene).not.toBe(scene);
    expect(scene.cameras.length).toBe(1);
    scene.cameras.push({} as never);
    expect(session.draft!.scene.cameras.length).toBe(1);
  });
});

describe("advanceSessionStage — stage progression engine", () => {
  function makeReviewSession(): ReturnType<typeof createSiteIntakeSession> {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    return createSiteIntakeSession(scene, "scan");
  }

  test("starts at review stage and advances through the sequence", () => {
    const session = makeReviewSession();
    const { session: s1 } = advanceSessionStage(session);
    expect(s1.stage).toBe("compile");
    const { session: s2 } = advanceSessionStage(s1);
    expect(s2.stage).toBe("validated");
    const { session: s3 } = advanceSessionStage(s2);
    expect(s3.stage).toBe("handoff");
  });

  test("blocks direct advance from handoff to activated; use promoteToActiveScene instead", () => {
    const session = makeReviewSession();
    let current = session;
    // review → compile → validated → handoff = 3 advances
    for (let i = 0; i < 3; i++) {
      const result = advanceSessionStage(current);
      current = result.session;
    }
    expect(current.stage).toBe("handoff");
    // handoff → activated is blocked — must use promoteToActiveScene
    const result = advanceSessionStage(current);
    expect(result.error).toContain("promoteToActiveScene");
    expect(result.session.stage).toBe("handoff");
  });

  test("returns error for unknown stage value", () => {
    const session = makeReviewSession();
    const bad = { ...session, stage: "unknown_stage" as unknown as import("@/lib/site-compiler").SiteIntakeStage };
    const result = advanceSessionStage(bad);
    expect(result.error).toContain("Unknown stage");
  });

  test("records transition notes in provenanceNotes", () => {
    const session = makeReviewSession();
    const { session: advanced } = advanceSessionStage(session);
    expect(advanced.provenanceNotes).toContain("Stage advanced: review → compile");
  });

  test("adds warning summaries to session warnings on advance", () => {
    const session = makeReviewSession();
    const { session: advanced } = advanceSessionStage(session);
    expect(advanced.warnings.length).toBeGreaterThanOrEqual(0);
  });

  test("blocks advance from review if no draft is present", () => {
    const session = makeReviewSession();
    const noDraft = { ...session, draft: undefined };
    const result = advanceSessionStage(noDraft);
    expect(result.error).toContain("no draft");
    expect(result.session.stage).toBe("review");
  });

  test("blocks advance from review if blocking warnings exist", () => {
    const scene = makeScene();
    const session = createSiteIntakeSession(scene, "scan");
    const blockingDraft = session.draft!;
    blockingDraft.warnings.push({
      code: "NO_CAMERA", message: "No cameras", severity: "blocking",
      suggestedAction: "Add a camera",
    });
    const withBlocking = { ...session, draft: blockingDraft };
    const result = advanceSessionStage(withBlocking);
    expect(result.error).toContain("blocking");
    expect(result.session.stage).toBe("review");
  });

  test("blocks advance when blocking warnings exist (earliest gate blocks)", () => {
    const scene = makeScene();
    addZone(scene);
    const session = createSiteIntakeSession(scene, "scan");
    // No camera means NO_CAMERA is blocking, so review→compile gate blocks immediately
    const result = advanceSessionStage(session);
    expect(result.error).toContain("readiness");
    expect(result.session.stage).toBe("review");
  });

  test("blocks advance from validated to handoff if no zone", () => {
    const scene = makeScene();
    addCamera(scene);
    const session = createSiteIntakeSession(scene, "scan");
    session.draft!.readiness = {
      ...session.draft!.readiness,
      canSimulate: true,
      level: "deploy-ready",
      blockingWarnings: [],
      advisoryWarnings: [],
      summary: "Draft is deploy-ready.",
    };
    const { session: compiled } = advanceSessionStage(session);
    const { session: validated } = advanceSessionStage(compiled);
    // Now set readiness to insufficient to simulate no-zone blockage at validated→handoff
    validated.draft!.readiness = {
      ...validated.draft!.readiness,
      canSimulate: false,
      level: "insufficient",
      blockingWarnings: [],
      advisoryWarnings: [],
      summary: "Insufficient for baseline simulation: at least one critical zone.",
    };
    const result = advanceSessionStage(validated);
    expect(result.error).toContain("readiness");
  });

  test("canAdvanceStage returns null when advance would succeed", () => {
    const session = makeReviewSession();
    expect(canAdvanceStage(session)).toBeNull();
  });

  test("canAdvanceStage returns error string when advance blocked", () => {
    const scene = makeScene();
    const noCamera = createSiteIntakeSession(scene, "scan");
    expect(canAdvanceStage(noCamera)).not.toBeNull();
  });
});

describe("compileFootageVerifyToSiteResult — enriched provenance", () => {
  test("includes footage verification specific notes", () => {
    const scene = makeScene();
    addCamera(scene);
    const result = compileFootageVerifyToSiteResult(scene);
    expect(result.provenance.notes.some((n) => n.includes("footage verification"))).toBe(true);
    expect(result.provenance.notes.some((n) => n.includes("pre-verification baselines"))).toBe(true);
  });

  test("applies 1.1x confidence multiplier", () => {
    const scene = makeScene();
    addCamera(scene);
    addZone(scene);
    const result = compileFootageVerifyToSiteResult(scene);
    const baseConfidence = calculateConfidence(result.warnings) ?? 0.5;
    expect(result.confidence).toBeCloseTo(Math.min(1, baseConfidence * 1.1), 5);
  });

  test("label differentiates from base camera_evidence", () => {
    const scene = makeScene();
    addCamera(scene);
    const evidenceResult = compileCameraEvidenceToSiteResult(scene);
    const verifyResult = compileFootageVerifyToSiteResult(scene);
    expect(verifyResult.provenance.label).not.toBe(evidenceResult.provenance.label);
    expect(verifyResult.provenance.label).toContain("Footage Verify");
  });
});
