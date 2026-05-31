import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { cloneSecurityScene, safeParseSecurityScene, type SecurityScene } from "@/schema/security-scene";

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
  | "handoff"
  | "activated";

export type DraftAssumption = {
  label: string;
  value: string;
  source: "user" | "default" | "estimated" | "model" | "imported";
  confidence?: number;
};

export type ActionableWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
  suggestedAction?: string;
  affectedNodeIds?: string[];
};

export type MissingPrerequisite = {
  code: string;
  message: string;
  requiredFor: "baseline_simulation" | "report" | "replay" | "verification";
};

export type SuggestedNextAction = {
  label: string;
  action: "edit" | "approve" | "run_baseline" | "add_camera" | "add_zone" | "add_path" | "open_studio";
  enabled: boolean;
  reason?: string;
};

export type EntityCounts = {
  walls: number;
  doors: number;
  windows: number;
  cameras: number;
  lights: number;
  obstructions: number;
  criticalZones: number;
  privacyZones: number;
  entryPoints: number;
  paths: number;
  sensors: number;
};

export type SiteTwinDraft = {
  id: string;
  source: SiteIntakeSource;
  scene: SecurityScene;
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  entityCounts: EntityCounts;
  assumptions: DraftAssumption[];
  warnings: ActionableWarning[];
  missingPrerequisites: MissingPrerequisite[];
  provenance: {
    sourceLabel: string;
    sourceArtifacts: string[];
    notes: string[];
    createdAt: number;
  };
  suggestedNextActions: SuggestedNextAction[];
};

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
  draft?: SiteTwinDraft;
};

export type SiteCompilerWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
  suggestedAction?: string;
  affectedNodeIds?: string[];
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

const LEGACY_SOURCE_ALIASES: Record<string, SiteIntakeSource> = {
  scan: "scan",
  guided_scan: "scan",
  reconstructed: "scan",
  reconstruction: "scan",
  ai_prompt: "ai_prompt",
  floor_plan: "floor_plan",
  json: "json",
  json_import: "json",
  manual: "manual",
  camera_evidence: "camera_evidence",
  footage_verify: "camera_evidence",
};

export function normalizeSiteIntakeSource(
  value: string,
): { source: SiteIntakeSource | null; warning: SiteCompilerWarning | null } {
  const normalized = LEGACY_SOURCE_ALIASES[value];
  if (!normalized) {
    return {
      source: null,
      warning: {
        code: "UNSUPPORTED_SITE_SOURCE",
        message: `Unsupported site source "${value}". Use scan, ai_prompt, floor_plan, json, manual, or camera_evidence.`,
        severity: "blocking",
        suggestedAction: "Choose a supported site source and retry compile.",
      },
    };
  }
  if (value !== normalized) {
    return {
      source: normalized,
      warning: {
        code: "SITE_SOURCE_NORMALIZED",
        message: `Legacy source "${value}" normalized to "${normalized}".`,
        severity: "info",
      },
    };
  }
  return { source: normalized, warning: null };
}

function countEntities(scene: SecurityScene): EntityCounts {
  return {
    walls: scene.walls.length,
    doors: scene.doors.length,
    windows: scene.windows.length,
    cameras: scene.cameras.length,
    lights: scene.securityLights.length,
    obstructions: scene.obstructions.length,
    criticalZones: scene.criticalZones.length,
    privacyZones: scene.privacyZones.length,
    entryPoints: scene.entryPoints.length,
    paths: scene.paths.length,
    sensors: scene.sensors.length,
  };
}

function collectSceneProvenanceNotes(scene: SecurityScene, prefixes: string[]): string[] {
  const notes = scene.changeLog ?? [];
  if (prefixes.length === 0) return notes.slice(0, 4);
  return notes.filter((note) => prefixes.some((prefix) => note.startsWith(prefix))).slice(0, 6);
}

export function makeSiteCompilerWarnings(scene: SecurityScene, extra: string[] = []): ActionableWarning[] {
  const warnings: ActionableWarning[] = [];
  if (scene.cameras.length === 0) {
    warnings.push({
      code: "NO_CAMERA",
      message: "No cameras found.",
      severity: "blocking",
      suggestedAction: "Add a camera marker, or continue without baseline simulation.",
    });
  }
  if (scene.criticalZones.length === 0) {
    warnings.push({
      code: "NO_CRITICAL_ZONE",
      message: "No critical zones found.",
      severity: "warning",
      suggestedAction: "Mark cash counter, entry, storage, parking gate, or another protected area.",
    });
  }
  if (scene.entryPoints.length === 0) {
    warnings.push({
      code: "NO_ENTRY",
      message: "No entry points defined.",
      severity: "info",
      suggestedAction: "Add at least one entry point for route analysis and replay.",
    });
  }
  if (scene.walls.length === 0) {
    warnings.push({
      code: "NO_WALL",
      message: "No walls defined. Spatial analysis may be unreliable.",
      severity: "warning",
      suggestedAction: "Draw walls to enclose the space, or mark the scene as open-area.",
    });
  }
  if (scene.paths.length === 0) {
    warnings.push({
      code: "NO_PATH",
      message: "No paths defined.",
      severity: "info",
      suggestedAction: "Add path points for replay analysis, or auto-create an entry-to-zone path.",
    });
  }
  for (const door of scene.doors) {
    const nearWall = scene.walls.some((wall) => {
      const wLen = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
      if (wLen === 0) return false;
      const t = Math.max(0, Math.min(1,
        ((door.position[0] - wall.start[0]) * (wall.end[0] - wall.start[0]) +
         (door.position[2] - wall.start[1]) * (wall.end[1] - wall.start[1])) / (wLen * wLen)));
      const closestX = wall.start[0] + t * (wall.end[0] - wall.start[0]);
      const closestY = wall.start[1] + t * (wall.end[1] - wall.start[1]);
      const dist = Math.hypot(door.position[0] - closestX, door.position[2] - closestY);
      return dist < 0.6;
    });
    if (!nearWall) {
      warnings.push({
        code: "DOOR_NOT_NEAR_WALL",
        message: `Door "${door.label || door.id}" is not near any wall.`,
        severity: "info",
        suggestedAction: "Snap to nearest wall or edit position.",
        affectedNodeIds: [door.id],
      });
    }
  }
  for (const camera of scene.cameras) {
    if (!camera.fovHorizontalDeg || camera.fovHorizontalDeg <= 0) {
      warnings.push({
        code: "CAMERA_FOV_UNKNOWN",
        message: `Camera "${camera.name || camera.id}" has unknown FOV.`,
        severity: "info",
        suggestedAction: "Choose a camera preset or keep default assumption.",
        affectedNodeIds: [camera.id],
      });
    }
  }
  for (const extraWarning of extra) {
    warnings.push({ code: "EXTRA", message: extraWarning, severity: "info" });
  }
  return warnings;
}

function deriveMissingPrerequisites(scene: SecurityScene): MissingPrerequisite[] {
  const missing: MissingPrerequisite[] = [];
  if (scene.cameras.length === 0) {
    missing.push({
      code: "NEED_CAMERA",
      message: "At least 1 camera is required for baseline simulation.",
      requiredFor: "baseline_simulation",
    });
  }
  if (scene.criticalZones.length === 0) {
    missing.push({
      code: "NEED_ZONE",
      message: "At least 1 critical zone is required for baseline simulation.",
      requiredFor: "baseline_simulation",
    });
  }
  if (scene.entryPoints.length === 0) {
    missing.push({
      code: "NEED_ENTRY",
      message: "Entry points are required for route analysis.",
      requiredFor: "replay",
    });
  }
  if (scene.paths.length === 0) {
    missing.push({
      code: "NEED_PATH",
      message: "At least 1 path is required for replay.",
      requiredFor: "replay",
    });
  }
  return missing;
}

function deriveAssumptions(scene: SecurityScene, source: SiteIntakeSource): DraftAssumption[] {
  const assumptions: DraftAssumption[] = [];
  assumptions.push({
    label: "Source",
    value: SOURCE_LABELS[source],
    source: source === "ai_prompt" ? "model" : source === "scan" || source === "manual" ? "user" : "imported",
  });
  assumptions.push({
    label: "Room dimensions",
    value: `${scene.dimensions.width}m × ${scene.dimensions.depth}m × ${scene.dimensions.height}m`,
    source: source === "scan" || source === "manual" ? "user" : "estimated",
    confidence: source === "scan" || source === "manual" ? 0.9 : 0.6,
  });
  assumptions.push({
    label: "Wall height",
    value: `${scene.assumptions.wallHeightM}m`,
    source: scene.assumptions.wallHeightM === 3 ? "default" : "user",
    confidence: 0.7,
  });
  assumptions.push({
    label: "Time of day",
    value: scene.assumptions.timeOfDay,
    source: scene.assumptions.timeOfDay === "day" ? "default" : "user",
  });
  assumptions.push({
    label: "DORI standard",
    value: scene.assumptions.doriStandard ?? "dori_2014",
    source: "default",
  });
  if (source === "ai_prompt") {
    assumptions.push({
      label: "Layout accuracy",
      value: "Approximate — AI-generated layouts require manual review",
      source: "model",
      confidence: 0.5,
    });
  }
  if (source === "floor_plan") {
    assumptions.push({
      label: "Extraction accuracy",
      value: "Best-effort wall detection; furniture and fixtures not extracted",
      source: "estimated",
      confidence: 0.65,
    });
  }
  return assumptions;
}

function deriveNextActions(
  scene: SecurityScene,
  warnings: ActionableWarning[],
  source: SiteIntakeSource,
): SuggestedNextAction[] {
  const hasCamera = scene.cameras.length > 0;
  const hasZone = scene.criticalZones.length > 0;
  const hasBlocking = warnings.some((w) => w.severity === "blocking");
  const canBaseline = hasCamera && hasZone;

  const actions: SuggestedNextAction[] = [];

  if (hasBlocking) {
    actions.push({
      label: "Fix blocking issues before continuing",
      action: "edit",
      enabled: true,
      reason: "Blocking warnings must be resolved before the draft can be approved.",
    });
  }

  if (!hasCamera) {
    actions.push({
      label: "Add a camera",
      action: "add_camera",
      enabled: true,
      reason: "At least one camera is required for coverage simulation.",
    });
  }

  if (!hasZone) {
    actions.push({
      label: "Mark a critical zone",
      action: "add_zone",
      enabled: true,
      reason: "Critical zones define what the security system must protect.",
    });
  }

  if (scene.entryPoints.length === 0) {
    actions.push({
      label: "Add an entry point",
      action: "edit",
      enabled: true,
      reason: "Entry points enable route analysis and path replay.",
    });
  }

  if (scene.paths.length === 0 && hasCamera) {
    actions.push({
      label: "Add a path for replay",
      action: "add_path",
      enabled: true,
    });
  }

  if (canBaseline && !hasBlocking) {
    actions.push({
      label: "Run baseline simulation",
      action: "run_baseline",
      enabled: true,
      reason: "Prerequisites met: camera and critical zone exist.",
    });
  }

  if (!hasBlocking) {
    actions.push({
      label: "Approve and open in Studio",
      action: "approve",
      enabled: true,
      reason: source === "ai_prompt"
        ? "AI draft review required before trusting as canonical scene."
        : "Review complete. Scene can become the active site twin.",
    });
  }

  if (source === "ai_prompt") {
    actions.push({
      label: "Regenerate AI draft",
      action: "edit",
      enabled: true,
      reason: "Low-confidence AI layouts can be improved with a revised prompt.",
    });
  }

  return actions;
}

function confidenceToLabel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

function sourceToSceneSource(source: SiteIntakeSource): SecurityScene["source"] {
  switch (source) {
    case "scan":
      return "scan";
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

export function compileToSiteTwinDraft(
  result: SiteCompilerResult,
  sourceArtifacts: string[] = [],
): SiteTwinDraft {
  const scene = result.scene;
  const warnings = result.warnings.map((w) => ({
    code: w.code,
    message: w.message,
    severity: w.severity,
    suggestedAction: w.suggestedAction,
    affectedNodeIds: w.affectedNodeIds,
  }));
  const confidence = result.confidence ?? 0.5;

  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: result.source,
    scene,
    confidence,
    confidenceLabel: confidenceToLabel(confidence),
    entityCounts: countEntities(scene),
    assumptions: deriveAssumptions(scene, result.source),
    warnings,
    missingPrerequisites: deriveMissingPrerequisites(scene),
    provenance: {
      sourceLabel: result.provenance.label,
      sourceArtifacts,
      notes: result.provenance.notes,
      createdAt: Date.now(),
    },
    suggestedNextActions: deriveNextActions(scene, warnings, result.source),
  };
}

export function canRunBaselineSimulation(draft: SiteTwinDraft): boolean {
  return draft.entityCounts.cameras > 0 && draft.entityCounts.criticalZones > 0
    && !draft.warnings.some((w) => w.severity === "blocking");
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
  scene = cloneSecurityScene(scene);
  scene.source = sourceToSceneSource("scan");
  const warnings = overrideWarnings ?? makeSiteCompilerWarnings(scene);
  const provenanceNotes = collectSceneProvenanceNotes(scene, ["Provenance:", "Scan evidence:", "Scan path:"]);
  const notes = ["Scene compiled from manual-assisted scan intake.", ...provenanceNotes, ...extraNotes];
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
  scene = cloneSecurityScene(scene);
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
  scene = cloneSecurityScene(scene);
  scene.source = sourceToSceneSource("floor_plan");
  const warnings = overrideWarnings ?? makeSiteCompilerWarnings(scene);
  const provenanceNotes = collectSceneProvenanceNotes(scene, ["Floor plan import:", "Floor plan diagnostics:"]);
  const notes = ["Scene extracted from floor plan image.", ...provenanceNotes, ...extraNotes];
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

export function compileCameraEvidenceToSiteResult(
  scene: SecurityScene,
  extraNotes: string[] = [],
  overrideWarnings: SiteCompilerWarning[] | null = null,
): SiteCompilerResult {
  scene = cloneSecurityScene(scene);
  scene.source = sourceToSceneSource("camera_evidence");
  const warnings = overrideWarnings ?? makeSiteCompilerWarnings(scene);
  const notes = ["Scene compiled from camera evidence verification.", ...extraNotes];
  return {
    source: "camera_evidence",
    scene,
    warnings,
    confidence: calculateConfidence(warnings),
    provenance: {
      source: "camera_evidence",
      label: SOURCE_LABELS.camera_evidence,
      notes,
      confidence: calculateConfidence(warnings),
    },
  };
}

export function compileFootageVerifyToSiteResult(
  scene: SecurityScene,
  extraNotes: string[] = [],
  overrideWarnings: SiteCompilerWarning[] | null = null,
): SiteCompilerResult {
  scene = cloneSecurityScene(scene);
  scene.source = sourceToSceneSource("camera_evidence");
  const warnings = overrideWarnings ?? makeSiteCompilerWarnings(scene);
  const notes = [
    "Scene updated from footage verification alignment.",
    "Footage verification: scenes prior to this edit are identified as pre-verification baselines; scenes after this edit should be treated as verified site evidence.",
    ...extraNotes,
  ];
  return {
    source: "camera_evidence",
    scene,
    warnings,
    confidence: Math.min(1, (calculateConfidence(warnings) ?? 0.5) * 1.1),
    provenance: {
      source: "camera_evidence",
      label: `${SOURCE_LABELS.camera_evidence} (Footage Verify)`,
      notes,
      confidence: Math.min(1, (calculateConfidence(warnings) ?? 0.5) * 1.1),
    },
  };
}

export function formatCompilerSummary(result: SiteCompilerResult): string {
  const counts = countEntities(result.scene);
  const countParts = [
    `${counts.walls} wall${counts.walls !== 1 ? "s" : ""}`,
    `${counts.cameras} camera${counts.cameras !== 1 ? "s" : ""}`,
    `${counts.criticalZones} zone${counts.criticalZones !== 1 ? "s" : ""}`,
  ];
  return `Created: ${countParts.join(", ")} · Source: ${result.provenance.label} · Confidence: ${result.confidence != null ? `${Math.round(result.confidence * 100)}%` : "N/A"}`;
}

export const SITE_SOURCE_MATURITY: Record<SiteIntakeSource, { label: string; status: string; description: string }> = {
  scan: {
    label: "Scan Site Photos",
    status: "Working",
    description: "Manual-assisted photo marking. No automatic segmentation or depth yet.",
  },
  ai_prompt: {
    label: "AI Layout Draft",
    status: "Preview",
    description: "Model or heuristic draft. Review required before trust.",
  },
  floor_plan: {
    label: "Floor Plan Upload",
    status: "Working prototype",
    description: "Best-effort wall/opening extraction. Manual correction required.",
  },
  json: {
    label: "JSON Import",
    status: "Working",
    description: "Schema-backed import.",
  },
  manual: {
    label: "Manual Build",
    status: "Working",
    description: "User-authored scene truth.",
  },
  camera_evidence: {
    label: "Camera Evidence Preview",
    status: "Preview",
    description: "Static/reference-frame alignment only. No product-grade video/stream verification yet.",
  },
};

/**
 * Create a SiteIntakeSession from a candidate scene and source without
 * touching any store or mutating the active scene.
 *
 * This is the single entry point for all creation/import flows that
 * must pass through SiteDraftReview before activation.
 */
export function createSiteIntakeSession(
  scene: SecurityScene,
  source: SiteIntakeSource,
  sourceArtifacts: string[] = [],
): SiteIntakeSession {
  const candidateScene = cloneSecurityScene(scene);
  const warnings = makeSiteCompilerWarnings(candidateScene);
  const confidence = calculateConfidence(warnings);
  const artifacts = sourceArtifacts.slice();
  const result: SiteCompilerResult = {
    source,
    scene: candidateScene,
    warnings,
    confidence,
    provenance: {
      source,
      label: SOURCE_LABELS[source],
      notes: artifacts,
      confidence,
    },
  };
  const draft = compileToSiteTwinDraft(result, artifacts);
  return {
    id: `intake_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    stage: "review",
    result,
    draft,
    warnings: [],
    provenanceNotes: [],
    createdAt: Date.now(),
  };
}

/**
 * Stage progression order for site intake sessions.
 * Each stage represents a phase in the intake lifecycle.
 */
export const SITE_INTAKE_STAGE_ORDER: readonly SiteIntakeStage[] = [
  "choose_source",
  "capture_or_upload",
  "mark_or_generate",
  "review",
  "compile",
  "validated",
  "handoff",
  "activated",
] as const;

/**
 * Advance a SiteIntakeSession to its next stage with validation gates.
 *
 * Each stage transition enforces preconditions:
 * - review → compile: requires a compiled draft with no blocking warnings
 * - compile → validated: requires no blocking warnings
 * - validated → handoff: requires at least one camera and one critical zone
 * - choose_source/capture/mark: no hard gates, always pass
 *
 * Returns the updated session and optionally an error message if the
 * transition is blocked by unmet preconditions.
 */
export function advanceSessionStage(
  session: SiteIntakeSession,
): { session: SiteIntakeSession; error?: string } {
  const currentIndex = SITE_INTAKE_STAGE_ORDER.indexOf(session.stage);
  if (currentIndex === -1) {
    return { session, error: `Unknown stage "${session.stage}". Cannot advance.` };
  }
  if (currentIndex >= SITE_INTAKE_STAGE_ORDER.length - 1) {
    return { session, error: `Already at final stage "${session.stage}". No further stage to advance to.` };
  }

  const nextStage = SITE_INTAKE_STAGE_ORDER[currentIndex + 1]!;

  // --- Validation gates ---

  if (session.stage === "handoff" && nextStage === "activated") {
    return {
      session,
      error: "Cannot advance from handoff to activated via direct stage advance. Use promoteToActiveScene() to activate a draft.",
    };
  }

  if (session.stage === "review" && nextStage === "compile") {
    if (!session.draft) {
      return {
        session,
        error: "Cannot advance from review: no draft compiled. Use createSiteIntakeSession or compile the scene first.",
      };
    }
    if (session.draft.warnings.some((w) => w.severity === "blocking")) {
      return {
        session,
        error: "Cannot advance from review: blocking warnings must be resolved before compile.",
      };
    }
  }

  if (session.stage === "compile" && nextStage === "validated") {
    if (!session.draft) {
      return {
        session,
        error: "Cannot advance to validated: no draft compiled.",
      };
    }
    if (session.draft.warnings.some((w) => w.severity === "blocking")) {
      return {
        session,
        error: "Cannot advance to validated: blocking warnings remain. Resolve before validation.",
      };
    }
  }

  if (session.stage === "validated" && nextStage === "handoff") {
    if (!session.draft) {
      return {
        session,
        error: "Cannot advance to handoff: no draft to promote.",
      };
    }
    if (session.draft.entityCounts.cameras === 0) {
      return {
        session,
        error: "Cannot advance to handoff: at least one camera is required.",
      };
    }
    if (session.draft.entityCounts.criticalZones === 0) {
      return {
        session,
        error: "Cannot advance to handoff: at least one critical zone is required.",
      };
    }
  }

  // Stage transition notes for provenance
  const transitionNote = `Stage advanced: ${session.stage} → ${nextStage}`;

  return {
    session: {
      ...session,
      stage: nextStage,
      provenanceNotes: [...session.provenanceNotes, transitionNote],
      warnings: session.draft
        ? session.draft.warnings
            .filter((w) => w.severity === "blocking" || w.severity === "warning")
            .map((w) => `[${w.severity}] ${w.message}`)
        : session.warnings,
    },
  };
}

/**
 * Check whether a stage transition is permitted without applying it.
 * Returns the same error message that advanceSessionStage would produce,
 * or null if the transition would succeed.
 */
export function canAdvanceStage(session: SiteIntakeSession): string | null {
  const result = advanceSessionStage(session);
  return result.error ?? null;
}

export { countEntities as countSiteEntities, SOURCE_LABELS as SITE_INTAKE_SOURCE_LABELS };
