import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { safeParseSecurityScene, type SecurityScene } from "@/schema/security-scene";

export type SiteIntakeSource =
  | "scan"
  | "ai_prompt"
  | "floor_plan"
  | "json"
  | "manual"
  | "camera_evidence";

export type SiteIntakeStage =
  | "choose_source"
  | "capture_or_upload"
  | "mark_or_generate"
  | "review"
  | "compile"
  | "validated"
  | "handoff";

export type SiteIntakeSession = {
  id: string;
  source: SiteIntakeSource;
  stage: SiteIntakeStage;
  sceneDraftId?: string;
  warnings: string[];
  confidence?: number;
  provenanceNotes: string[];
  createdAt: number;
  result?: SiteCompilerResult;
};

export type SiteCompilerWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type SiteCompilerProvenance = {
  source: SiteIntakeSource;
  label: string;
  notes: string[];
  confidence: number | null;
};

export type SiteCompilerResult = {
  source: SiteIntakeSource;
  scene: SecurityScene;
  warnings: SiteCompilerWarning[];
  confidence: number | null;
  provenance: SiteCompilerProvenance;
};

const SOURCE_LABELS: Record<SiteIntakeSource, string> = {
  scan: "Manual-Assisted Scan",
  ai_prompt: "AI Prompt Draft",
  floor_plan: "Floor Plan Import",
  json: "SecurityScene JSON Import",
  manual: "Manual Build",
  camera_evidence: "Camera Evidence Preview",
};

function countEntities(scene: SecurityScene) {
  return {
    walls: scene.walls.length,
    doors: scene.doors.length,
    windows: scene.windows.length,
    cameras: scene.cameras.length,
    lights: scene.securityLights.length,
    obstructions: scene.obstructions.length,
    zones: scene.criticalZones.length,
    paths: scene.paths.length,
    entries: scene.entryPoints.length,
  };
}

export function makeSiteCompilerWarnings(scene: SecurityScene, extra: string[] = []): SiteCompilerWarning[] {
  const warnings: SiteCompilerWarning[] = [];
  if (scene.cameras.length === 0) {
    warnings.push({ code: "NO_CAMERA", message: "No cameras in scene; add at least one for coverage simulation.", severity: "blocking" });
  }
  if (scene.criticalZones.length === 0) {
    warnings.push({ code: "NO_CRITICAL_ZONE", message: "No critical zones defined; coverage outcome will be limited.", severity: "warning" });
  }
  if (scene.entryPoints.length === 0) {
    warnings.push({ code: "NO_ENTRY", message: "No entry points; path replay and entry risk analysis will be limited.", severity: "info" });
  }
  if (scene.walls.length === 0) {
    warnings.push({ code: "NO_WALL", message: "No walls defined; spatial analysis may be unreliable.", severity: "warning" });
  }
  if (scene.paths.length === 0) {
    warnings.push({ code: "NO_PATH", message: "No paths defined; path replay unavailable.", severity: "info" });
  }
  for (const extraWarning of extra) {
    warnings.push({ code: "EXTRA", message: extraWarning, severity: "info" });
  }
  return warnings;
}

function sourceToSceneSource(source: SiteIntakeSource): SecurityScene["source"] {
  switch (source) {
    case "scan": return "scan";
    case "ai_prompt": return "ai";
    case "floor_plan": return "import";
    case "json": return "import";
    case "manual": return "manual";
    case "camera_evidence": return "import";
  }
}

export function calculateConfidence(warnings: SiteCompilerWarning[]): number | null {
  const blocking = warnings.filter((w) => w.severity === "blocking").length;
  const warningsCount = warnings.filter((w) => w.severity === "warning").length;
  if (blocking > 0) return 0.15;
  if (warningsCount > 3) return 0.4;
  if (warningsCount > 1) return 0.65;
  if (warningsCount === 0) return 0.92;
  return 0.78;
}

export function compileBlankToSiteResult(name?: string): SiteCompilerResult {
  const scene = createBlankSecurityScene();
  if (name) scene.name = name;
  scene.source = sourceToSceneSource("manual");
  const warnings = makeSiteCompilerWarnings(scene, ["Blank scene created. Add cameras, zones, and paths before running simulation."]);
  return {
    source: "manual",
    scene,
    warnings,
    confidence: calculateConfidence(warnings),
    provenance: {
      source: "manual",
      label: SOURCE_LABELS.manual,
      notes: ["Blank scene shell created from scratch."],
      confidence: calculateConfidence(warnings),
    },
  };
}

export function compileScanToSiteResult(
  scene: SecurityScene,
  extraNotes: string[] = [],
  overrideWarnings: SiteCompilerWarning[] | null = null,
): SiteCompilerResult {
  scene.source = sourceToSceneSource("scan");
  const warnings = overrideWarnings ?? makeSiteCompilerWarnings(scene);
  const notes = ["Scene compiled from manual-assisted scan intake.", ...extraNotes];
  return {
    source: "scan",
    scene,
    warnings,
    confidence: calculateConfidence(warnings),
    provenance: {
      source: "scan",
      label: SOURCE_LABELS.scan,
      notes,
      confidence: calculateConfidence(warnings),
    },
  };
}

export function compileAiDraftToSiteResult(
  scene: SecurityScene,
  extraNotes: string[] = [],
  overrideWarnings: SiteCompilerWarning[] | null = null,
): SiteCompilerResult {
  scene.source = sourceToSceneSource("ai_prompt");
  const warnings = overrideWarnings ?? makeSiteCompilerWarnings(scene);
  const notes = ["Scene generated from AI prompt draft.", ...extraNotes];
  return {
    source: "ai_prompt",
    scene,
    warnings,
    confidence: calculateConfidence(warnings),
    provenance: {
      source: "ai_prompt",
      label: SOURCE_LABELS.ai_prompt,
      notes,
      confidence: calculateConfidence(warnings),
    },
  };
}

export function compileFloorPlanToSiteResult(
  scene: SecurityScene,
  floorConfidence?: number,
  extraNotes: string[] = [],
  overrideWarnings: SiteCompilerWarning[] | null = null,
): SiteCompilerResult {
  scene.source = sourceToSceneSource("floor_plan");
  const warnings = overrideWarnings ?? makeSiteCompilerWarnings(scene);
  const notes = ["Scene extracted from floor plan image.", ...extraNotes];
  return {
    source: "floor_plan",
    scene,
    warnings,
    confidence: floorConfidence ?? calculateConfidence(warnings),
    provenance: {
      source: "floor_plan",
      label: SOURCE_LABELS.floor_plan,
      notes,
      confidence: floorConfidence ?? calculateConfidence(warnings),
    },
  };
}

export function compileJsonToSiteResult(
  scene: SecurityScene,
  fileName?: string,
  extraNotes: string[] = [],
  overrideWarnings: SiteCompilerWarning[] | null = null,
): SiteCompilerResult {
  const parsed = safeParseSecurityScene(scene);
  if (!parsed.success) {
    return {
      source: "json",
      scene,
      warnings: [{ code: "INVALID_SCENE", message: `Imported SecurityScene failed schema validation: ${parsed.error.issues[0]?.message ?? "unknown error"}`, severity: "blocking" }],
      confidence: 0,
      provenance: {
        source: "json",
        label: SOURCE_LABELS.json,
        notes: ["JSON import failed validation."],
        confidence: 0,
      },
    };
  }
  const validScene = parsed.data;
  validScene.source = sourceToSceneSource("json");
  const fileNote = fileName ? `Imported from file: ${fileName}.` : "Imported from SecurityScene JSON.";
  const warnings = overrideWarnings ?? makeSiteCompilerWarnings(validScene);
  const notes = [fileNote, ...extraNotes];
  return {
    source: "json",
    scene: validScene,
    warnings,
    confidence: calculateConfidence(warnings),
    provenance: {
      source: "json",
      label: SOURCE_LABELS.json,
      notes,
      confidence: calculateConfidence(warnings),
    },
  };
}

export function formatCompilerSummary(result: SiteCompilerResult): string {
  const counts = countEntities(result.scene);
  const countParts = [
    `${counts.walls} wall${counts.walls !== 1 ? "s" : ""}`,
    `${counts.cameras} camera${counts.cameras !== 1 ? "s" : ""}`,
    `${counts.zones} zone${counts.zones !== 1 ? "s" : ""}`,
  ];
  return `Created: ${countParts.join(", ")} · Source: ${result.provenance.label} · Confidence: ${result.confidence != null ? `${Math.round(result.confidence * 100)}%` : "N/A"}`;
}

export { countEntities as countSiteEntities, SOURCE_LABELS as SITE_INTAKE_SOURCE_LABELS };
