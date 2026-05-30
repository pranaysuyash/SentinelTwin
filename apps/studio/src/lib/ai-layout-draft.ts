import type { SecurityScene } from "@/schema/security-scene";
import { SCENE_TEMPLATES } from "@/lib/scene-templates";
import { PROMPT_REGISTRY } from "@/agents/prompt-registry";
import type { ModelProvider } from "@/agents/providers/ModelProvider";
import { z } from "zod";
import { createCameraNode, createCriticalZoneNode, createEntryPointNode, createObstructionNode, createScenarioPathNode, createSecurityLightNode } from "@/lib/node-factory";
import type { SiteCompilerResult, SiteCompilerWarning } from "@/lib/site-compiler";
import { compileAiDraftToSiteResult } from "@/lib/site-compiler";

type DraftResult = {
  scene: SecurityScene;
  warnings: string[];
  provenance: DraftProvenance;
};

export type DraftPreviewSummary = {
  sceneName: string;
  sizeLabel: string;
  sourceLabel: string;
  modeLabel: string;
  confidenceLabel: string;
  summary: string;
  warnings: string[];
  counts: {
    entryPoints: number;
    cameras: number;
    securityLights: number;
    obstructions: number;
    criticalZones: number;
    paths: number;
  };
};

type DraftProvenance = {
  source: SecurityScene["source"];
  mode: "model" | "heuristic";
  confidenceLevel: "high" | "medium" | "low";
  summary: string;
  warnings: string[];
};

const DIMENSION_PATTERN = /(\d+(?:\.\d+)?)\s*m?\s*[x×]\s*(\d+(?:\.\d+)?)\s*m?/i;
const TEMPLATE_IDS = SCENE_TEMPLATES.map((item) => item.id) as [string, ...string[]];

const layoutDraftSchema = z.object({
  templateId: z.enum(TEMPLATE_IDS),
  widthM: z.number().min(3).max(200),
  depthM: z.number().min(3).max(200),
  heightM: z.number().min(2.4).max(12).default(3),
  sceneName: z.string().min(3).max(90),
  assumptions: z.array(z.string()).default([]),
});

const draftPoint2Schema = z.object({
  x: z.number().min(0).max(200),
  z: z.number().min(0).max(200),
});

const draftPoint3Schema = z.object({
  x: z.number().min(0).max(200),
  y: z.number().min(0).max(20),
  z: z.number().min(0).max(200),
});

const cameraDraftSchema = z.object({
  name: z.string().min(1).max(60),
  position: draftPoint3Schema,
  yawDeg: z.number().min(-180).max(180),
  pitchDeg: z.number().min(-89).max(0),
  mountType: z.enum(["wall", "ceiling", "pole", "corner", "desk"]).default("ceiling"),
  mountHeightM: z.number().min(1).max(6).default(2.8),
  fovHorizontalDeg: z.number().min(10).max(180).default(90),
  fovVerticalDeg: z.number().min(10).max(180).default(60),
  rangeM: z.number().min(1).max(50).default(12),
  resolutionMP: z.number().min(0.3).max(32).default(4),
  nightMode: z.enum(["none", "ir", "low_light", "thermal"]).default("none"),
  clarity: z.enum(["poor", "average", "good", "excellent"]).default("good"),
  status: z.enum(["on", "off", "blocked", "dirty", "malfunctioning"]).default("on"),
});

const lightDraftSchema = z.object({
  name: z.string().min(1).max(60),
  position: draftPoint3Schema,
  lightType: z.enum(["ceiling", "wall", "flood", "street", "emergency", "ir_flood"]).default("ceiling"),
  status: z.enum(["on", "off", "failed"]).default("on"),
  brightness: z.enum(["dim", "low", "medium", "high", "very_high"]).default("medium"),
  rangeM: z.number().min(1).max(30).default(6),
});

const obstructionDraftSchema = z.object({
  label: z.string().min(1).max(60),
  position: draftPoint3Schema,
  dimensions: z.object({
    width: z.number().min(0.1).max(20).default(1),
    depth: z.number().min(0.1).max(20).default(0.5),
    height: z.number().min(0.1).max(6).default(2),
  }),
  obstructionType: z.enum(["shelf", "cupboard", "counter", "pillar", "partition", "vehicle", "tree", "gate", "signboard", "storage_boxes", "glass_display", "curtain", "other"]).default("other"),
  rotationYDeg: z.number().min(-180).max(180).default(0),
  material: z.enum(["solid", "glass", "grill", "mesh", "curtain", "reflective", "partial"]).default("solid"),
  visionTransmission: z.number().min(0).max(1).default(0),
});

const criticalZoneDraftSchema = z.object({
  label: z.string().min(1).max(80),
  polygon: z.array(draftPoint2Schema).min(3),
  requiredQuality: z.enum(["detection", "observation", "recognition", "identification"]).default("recognition"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("high"),
  targetType: z.enum(["person_detection", "face_recognition", "face_identification", "cash_counter_activity", "door_entry_exit", "vehicle_detection", "license_plate", "package_detection", "perimeter_breach"]).default("person_detection"),
  nightRequired: z.boolean().default(false),
  redundancyRequired: z.boolean().default(false),
  privacyZone: z.boolean().default(false),
});

const pathPointDraftSchema = z.object({
  position: draftPoint2Schema,
  timestamp: z.number().min(0).optional(),
  action: z.enum(["enter", "wait", "run", "crouch", "exit"]).optional(),
});

const pathDraftSchema = z.object({
  label: z.string().min(1).max(60),
  actorType: z.enum(["person", "vehicle", "guard", "crowd"]).default("person"),
  intent: z.enum(["authorized", "suspicious", "incident_replay"]).default("authorized"),
  speedMps: z.number().min(0.1).max(6).default(1.2),
  heightM: z.number().min(0.5).max(3).default(1.75),
  timeOfDay: z.enum(["day", "night", "dusk", "dawn"]).default("day"),
  points: z.array(pathPointDraftSchema).min(2),
});

const sceneBlueprintSchema = z.object({
  entryPoints: z.array(z.object({
    label: z.string().min(1).max(60),
    position: draftPoint2Schema,
  })).default([]),
  cameras: z.array(cameraDraftSchema).default([]),
  securityLights: z.array(lightDraftSchema).default([]),
  obstructions: z.array(obstructionDraftSchema).default([]),
  criticalZones: z.array(criticalZoneDraftSchema).default([]),
  paths: z.array(pathDraftSchema).default([]),
});

const modelDraftSchema = layoutDraftSchema.extend({
  blueprint: sceneBlueprintSchema.default({
    entryPoints: [],
    cameras: [],
    securityLights: [],
    obstructions: [],
    criticalZones: [],
    paths: [],
  }),
});
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

function pickTemplateId(prompt: string): string {
  const text = prompt.toLowerCase();
  if (text.includes("warehouse") || text.includes("industrial") || text.includes("factory")) return "warehouse";
  if (text.includes("office")) return "open-office";
  if (text.includes("school") || text.includes("classroom")) return "classroom";
  if (text.includes("home") || text.includes("apartment") || text.includes("residential")) return "residential-house";
  return "retail-shop";
}

export function draftSceneFromPrompt(prompt: string): DraftResult {
  const templateId = pickTemplateId(prompt);
  const template = SCENE_TEMPLATES.find((item) => item.id === templateId) ?? SCENE_TEMPLATES[0]!;
  const warnings: string[] = [];

  const dimensionsMatch = prompt.match(DIMENSION_PATTERN);
  const widthM = dimensionsMatch ? Number(dimensionsMatch[1]) : template.suggestedDimensions.widthM;
  const depthM = dimensionsMatch ? Number(dimensionsMatch[2]) : template.suggestedDimensions.depthM;
  const heightM = template.suggestedDimensions.heightM;

  if (!dimensionsMatch) {
    warnings.push("No explicit dimensions found in prompt; using template defaults.");
  }

  const scene = template.create({ widthM, depthM, heightM });
  enrichSceneFromPrompt(scene, prompt);
  scene.name = prompt.trim().length > 0
    ? `AI Draft — ${prompt.trim().slice(0, 52)}${prompt.trim().length > 52 ? "..." : ""}`
    : `AI Draft — ${template.name}`;
  scene.source = "ai";
  const provenance: DraftProvenance = {
    source: scene.source,
    mode: "heuristic",
    confidenceLevel: dimensionsMatch ? "medium" : "low",
    summary: `Heuristic AI draft from prompt using ${template.name} template${dimensionsMatch ? "" : " with default dimensions"}.`,
    warnings: [...warnings],
  };
  scene.changeLog = [...scene.changeLog, `Provenance: ${provenance.summary}`, `Provenance confidence: ${provenance.confidenceLevel}`];
  scene.updatedAt = Date.now();

  return { scene, warnings, provenance };
}

export async function draftSceneFromPromptWithModel(
  prompt: string,
  provider: ModelProvider,
): Promise<DraftResult> {
  const structured = await provider.completeStructured(
    {
      system:
        PROMPT_REGISTRY.find((entry) => entry.id === "model_layout_draft")?.systemPrompt ?? "",
      messages: [
        {
          role: "user",
          content: `Create a scene draft from this request: ${prompt}`,
        },
      ],
    },
    modelDraftSchema,
  );

  const template = SCENE_TEMPLATES.find((item) => item.id === structured.templateId) ?? SCENE_TEMPLATES[0]!;
  const scene = template.create({
    widthM: structured.widthM,
    depthM: structured.depthM,
    heightM: structured.heightM,
  });
  applyDraftBlueprint(scene, structured.blueprint);
  enrichSceneFromPrompt(scene, prompt);

  scene.name = structured.sceneName;
  scene.source = "ai";
  const blueprintElementCount =
    structured.blueprint.entryPoints.length +
    structured.blueprint.cameras.length +
    structured.blueprint.securityLights.length +
    structured.blueprint.obstructions.length +
    structured.blueprint.criticalZones.length +
    structured.blueprint.paths.length;
  const confidenceLevel: DraftProvenance["confidenceLevel"] =
    structured.assumptions.length === 0 && blueprintElementCount > 0
      ? "high"
      : blueprintElementCount > 0
        ? "medium"
        : "low";
  const provenance: DraftProvenance = {
    source: scene.source,
    mode: "model",
    confidenceLevel,
    summary: `Model-backed AI draft from structured prompt output using ${template.name}${blueprintElementCount > 0 ? " with explicit element placements" : ""}.`,
    warnings: [...structured.assumptions],
  };
  scene.changeLog = [...scene.changeLog, `Provenance: ${provenance.summary}`, `Provenance confidence: ${provenance.confidenceLevel}`];
  scene.updatedAt = Date.now();

  const warnings = structured.assumptions.length > 0 ? structured.assumptions : [];
  return { scene, warnings, provenance };
}

export function summarizeDraftResult(result: DraftResult): DraftPreviewSummary {
  const { scene, provenance } = result;
  return {
    sceneName: scene.name,
    sizeLabel: `${scene.dimensions.width}m × ${scene.dimensions.depth}m × ${scene.dimensions.height}m`,
    sourceLabel: scene.source === "ai" ? "AI Draft" : "Draft Scene",
    modeLabel: provenance.mode === "model" ? "Model-backed" : "Heuristic fallback",
    confidenceLabel: `${provenance.confidenceLevel} confidence`,
    summary: provenance.summary,
    warnings: Array.from(new Set([...(result.warnings ?? []), ...(provenance.warnings ?? [])])),
    counts: {
      entryPoints: scene.entryPoints.length,
      cameras: scene.cameras.length,
      securityLights: scene.securityLights.length,
      obstructions: scene.obstructions.length,
      criticalZones: scene.criticalZones.length,
      paths: scene.paths.length,
    },
  };
}

function parseCount(promptLower: string, token: string): number | null {
  const wordPattern = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\s+${token}\\b`, "i");
  const digitPattern = new RegExp(`\\b(\\d+)\\s+${token}\\b`, "i");
  const wordMatch = promptLower.match(wordPattern);
  if (wordMatch) return NUMBER_WORDS[wordMatch[1].toLowerCase()] ?? null;
  const digitMatch = promptLower.match(digitPattern);
  if (digitMatch) return Number(digitMatch[1]);
  return null;
}

function ensureCameraCount(scene: SecurityScene, desiredCount: number) {
  const { width, depth, height } = scene.dimensions;
  const clamped = Math.max(1, Math.min(desiredCount, 12));
  if (scene.cameras.length > clamped) {
    scene.cameras = scene.cameras.slice(0, clamped);
    return;
  }
  while (scene.cameras.length < clamped) {
    const idx = scene.cameras.length + 1;
    const x = (width / (clamped + 1)) * idx;
    const z = depth * 0.15;
    const camera = createCameraNode([x, height - 0.2, z]);
    camera.name = `Camera ${idx}`;
    camera.source = "ai";
    scene.cameras.push(camera);
  }
}

function ensureObstructionCount(
  scene: SecurityScene,
  type: "shelf" | "counter",
  desiredCount: number,
  opts?: { side?: "left" | "right"; back?: boolean },
) {
  const current = scene.obstructions.filter((obs) => obs.obstructionType === type);
  if (current.length >= desiredCount) return;
  const needed = desiredCount - current.length;
  const { width, depth } = scene.dimensions;
  for (let i = 0; i < needed; i += 1) {
    const xBase = opts?.side === "right" ? width * 0.78 : width * 0.22;
    const zBase = opts?.back ? depth * 0.78 : depth * (0.3 + i * 0.16);
    const obstruction = createObstructionNode([xBase, 0, Math.min(depth - 0.6, zBase)], type);
    obstruction.source = "ai";
    obstruction.label =
      type === "counter"
        ? `Cash Counter ${current.length + i + 1}`
        : `Shelf ${current.length + i + 1}`;
    scene.obstructions.push(obstruction);
  }
}

function ensureBackStorageZone(scene: SecurityScene) {
  const hasStorage = scene.criticalZones.some((z) => z.label.toLowerCase().includes("storage"));
  if (hasStorage) return;
  const { width, depth } = scene.dimensions;
  const zone = createCriticalZoneNode([
    [width * 0.3, depth * 0.78],
    [width * 0.7, depth * 0.78],
    [width * 0.7, depth * 0.95],
    [width * 0.3, depth * 0.95],
  ]);
  zone.label = "Back Storage";
  zone.requiredQuality = "recognition";
  zone.priority = "high";
  zone.targetType = "person_detection";
  scene.criticalZones.push(zone);
}

function ensureFrontEntry(scene: SecurityScene) {
  if (scene.entryPoints.length > 0) {
    scene.entryPoints[0]!.label = "Front Entry";
    return scene.entryPoints[0]!;
  }
  const { width } = scene.dimensions;
  const entry = createEntryPointNode([width / 2, 0]);
  entry.label = "Front Entry";
  scene.entryPoints.push(entry);
  return entry;
}

function ensureBasicPath(scene: SecurityScene, prompt: string) {
  if (scene.paths.length > 0) return;
  const hasFrontEntry = /front\s+entry|entrance|entry|door/i.test(prompt);
  const hasCounter = /cash counter|checkout counter|counter/i.test(prompt);
  if (!hasFrontEntry || !hasCounter) return;

  const { width, depth } = scene.dimensions;
  const path = createScenarioPathNode([
    { position: [width / 2, 0.5], timestamp: 0 },
    { position: [width / 2, depth * 0.35], timestamp: 3 },
    { position: [width * 0.65, depth * 0.55], timestamp: 6 },
  ]);
  path.label = "Entry to Counter";
  path.actorType = "person";
  path.intent = "authorized";
  path.timeOfDay = "day";
  scene.paths.push(path);
}

function ensurePromptLighting(scene: SecurityScene, prompt: string) {
  const lower = prompt.toLowerCase();
  if (!lower.includes("light") && !lower.includes("bright") && !lower.includes("dark")) return;

  const { width, depth, height } = scene.dimensions;
  if (scene.securityLights.length === 0) {
    scene.securityLights.push(createSecurityLightNode([width / 2, height - 0.2, depth / 2]));
  }
  if (lower.includes("dark") || lower.includes("night")) {
    scene.securityLights[0]!.brightness = "high";
    scene.securityLights[0]!.rangeM = Math.max(scene.securityLights[0]!.rangeM, Math.max(width, depth) * 0.9);
  }
}

function applyDraftBlueprint(scene: SecurityScene, blueprint: z.infer<typeof sceneBlueprintSchema>) {
  if (blueprint.entryPoints.length > 0) {
    scene.entryPoints = blueprint.entryPoints.map((entry) => {
      const node = createEntryPointNode([entry.position.x, entry.position.z]);
      node.label = entry.label;
      return node;
    });
  }

  if (blueprint.cameras.length > 0) {
    scene.cameras = blueprint.cameras.map((camera) => {
      const node = createCameraNode([camera.position.x, camera.position.y, camera.position.z]);
      node.name = camera.name;
      node.yawDeg = camera.yawDeg;
      node.pitchDeg = camera.pitchDeg;
      node.mountType = camera.mountType;
      node.mountHeightM = camera.mountHeightM;
      node.fovHorizontalDeg = camera.fovHorizontalDeg;
      node.fovVerticalDeg = camera.fovVerticalDeg;
      node.rangeM = camera.rangeM;
      node.resolutionMP = camera.resolutionMP;
      node.status = camera.status;
      node.nightMode = camera.nightMode;
      node.clarity = camera.clarity;
      node.source = "ai";
      return node;
    });
  }

  if (blueprint.securityLights.length > 0) {
    scene.securityLights = blueprint.securityLights.map((light) => {
      const node = createSecurityLightNode([light.position.x, light.position.y, light.position.z]);
      node.name = light.name;
      node.lightType = light.lightType;
      node.status = light.status;
      node.brightness = light.brightness;
      node.rangeM = light.rangeM;
      node.source = "ai";
      return node;
    });
  }

  if (blueprint.obstructions.length > 0) {
    scene.obstructions = blueprint.obstructions.map((obstruction) => {
      const dims: [number, number, number] = [
        obstruction.dimensions.width,
        obstruction.dimensions.depth,
        obstruction.dimensions.height,
      ];
      const node = createObstructionNode([obstruction.position.x, obstruction.position.y, obstruction.position.z], obstruction.obstructionType);
      node.label = obstruction.label;
      node.dimensions = dims;
      node.rotationYDeg = obstruction.rotationYDeg;
      node.material = obstruction.material;
      node.visionTransmission = obstruction.visionTransmission;
      node.source = "ai";
      return node;
    });
  }

  if (blueprint.criticalZones.length > 0) {
    scene.criticalZones = blueprint.criticalZones.map((zone) => {
      const node = createCriticalZoneNode(zone.polygon.map((point) => [point.x, point.z] as [number, number]));
      node.label = zone.label;
      node.requiredQuality = zone.requiredQuality;
      node.priority = zone.priority;
      node.targetType = zone.targetType;
      node.nightRequired = zone.nightRequired;
      node.redundancyRequired = zone.redundancyRequired;
      node.privacyZone = zone.privacyZone;
      return node;
    });
  }

  if (blueprint.paths.length > 0) {
    scene.paths = blueprint.paths.map((path) => {
      const node = createScenarioPathNode(path.points.map((point) => ({
        position: [point.position.x, point.position.z] as [number, number],
        timestamp: point.timestamp,
        action: point.action,
      })));
      node.label = path.label;
      node.actorType = path.actorType;
      node.intent = path.intent;
      node.speedMps = path.speedMps;
      node.heightM = path.heightM;
      node.timeOfDay = path.timeOfDay;
      return node;
    });
  }
}

function enrichSceneFromPrompt(scene: SecurityScene, prompt: string) {
  const lower = prompt.toLowerCase();

  if (lower.includes("entry") || lower.includes("entrance") || lower.includes("front door")) {
    ensureFrontEntry(scene);
  }

  const cameraCount = parseCount(lower, "camera(?:s)?");
  if (cameraCount) ensureCameraCount(scene, cameraCount);

  const shelfCount = parseCount(lower, "shel(?:f|ves)");
  if (shelfCount) ensureObstructionCount(scene, "shelf", shelfCount);

  if (lower.includes("cash counter") || lower.includes("checkout counter") || lower.includes("counter")) {
    ensureObstructionCount(scene, "counter", 1, { side: lower.includes("right") ? "right" : "left" });
  }

  if (lower.includes("back storage") || lower.includes("storage room") || lower.includes("back room")) {
    ensureBackStorageZone(scene);
  }

  ensureBasicPath(scene, prompt);
  ensurePromptLighting(scene, prompt);
}

export function draftSceneToCompilerResult(draft: DraftResult): SiteCompilerResult {
  const warnings: SiteCompilerWarning[] = [
    ...draft.warnings.map((w): SiteCompilerWarning => ({
      code: "AI_DRAFT_WARNING",
      message: w,
      severity: "info",
    })),
  ];
  if (draft.provenance.mode === "heuristic") {
    warnings.push({
      code: "HEURISTIC_DRAFT",
      message: "Generated via heuristic fallback instead of model. Review layout carefully.",
      severity: "warning",
    });
  }
  return compileAiDraftToSiteResult(draft.scene, draft.provenance.warnings, warnings);
}
