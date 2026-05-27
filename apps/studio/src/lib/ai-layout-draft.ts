import type { SecurityScene } from "@/schema/security-scene";
import { SCENE_TEMPLATES } from "@/lib/scene-templates";
import type { ModelProvider } from "@/agents/providers/ModelProvider";
import { z } from "zod";
import { createCameraNode, createCriticalZoneNode, createObstructionNode } from "@/lib/node-factory";

type DraftResult = {
  scene: SecurityScene;
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
  scene.source = "ai_generated";
  scene.updatedAt = Date.now();

  return { scene, warnings };
}

export async function draftSceneFromPromptWithModel(
  prompt: string,
  provider: ModelProvider,
): Promise<DraftResult> {
  const structured = await provider.completeStructured(
    {
      system:
        "You generate security planning scene drafts. Return concise structured values only. Prefer realistic template choice and dimensions.",
      messages: [
        {
          role: "user",
          content: `Create a scene draft from this request: ${prompt}`,
        },
      ],
    },
    layoutDraftSchema,
  );

  const template = SCENE_TEMPLATES.find((item) => item.id === structured.templateId) ?? SCENE_TEMPLATES[0]!;
  const scene = template.create({
    widthM: structured.widthM,
    depthM: structured.depthM,
    heightM: structured.heightM,
  });
  enrichSceneFromPrompt(scene, prompt);

  scene.name = structured.sceneName;
  scene.source = "ai_generated";
  scene.updatedAt = Date.now();

  const warnings = structured.assumptions.length > 0 ? structured.assumptions : [];
  return { scene, warnings };
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

function enrichSceneFromPrompt(scene: SecurityScene, prompt: string) {
  const lower = prompt.toLowerCase();

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
}
