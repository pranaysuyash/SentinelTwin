import { describe, expect, test } from "bun:test";

import {
  compileBlankToSiteResult,
  compileScanToSiteResult,
  compileAiDraftToSiteResult,
  compileFloorPlanToSiteResult,
  compileJsonToSiteResult,
  makeSiteCompilerWarnings,
  calculateConfidence,
  formatCompilerSummary,
  countSiteEntities,
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
    expect(counts.zones).toBe(0);
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
    const result = compileScanToSiteResult(scene);
    expect(result.source).toBe("scan");
    expect(result.scene.cameras).toHaveLength(1);
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
  });
});

describe("compileFloorPlanToSiteResult", () => {
  test("wraps existing scene with floor_plan source", () => {
    const scene = makeScene();
    addWall(scene);
    const result = compileFloorPlanToSiteResult(scene, 0.85);
    expect(result.source).toBe("floor_plan");
    expect(result.confidence).toBe(0.85);
  });
});

describe("compileJsonToSiteResult", () => {
  test("validates a valid scene and returns success", () => {
    const scene = makeScene();
    const result = compileJsonToSiteResult(scene, "export.json");
    expect(result.source).toBe("json");
    expect(result.warnings.some((w) => w.code === "INVALID_SCENE")).toBe(false);
  });

  test("returns blocking warning for invalid scene", () => {
    const result = compileJsonToSiteResult({ invalid: true } as unknown as SecurityScene, "bad.json");
    expect(result.warnings.some((w) => w.code === "INVALID_SCENE" && w.severity === "blocking")).toBe(true);
    expect(result.confidence).toBe(0);
  });
});
