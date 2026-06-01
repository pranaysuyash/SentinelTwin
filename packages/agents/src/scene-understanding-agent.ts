import { z } from "zod";
import type { ModelProvider } from "./providers/ModelProvider";
import { PROMPT_REGISTRY } from "./prompt-registry";

export interface SceneUnderstandingResult {
  sceneType: string;
  occupancy: { estimated: string; confidence: string; peakHours: string[] };
  lighting: { overall: string; problemAreas: string[] };
  obstructions: Array<{ label: string; impact: string; recommendation: string }>;
  cameraAssessment: Array<{
    label: string;
    position: string;
    suitability: string;
    gaps: string[];
    recommendation: string;
  }>;
  criticalZones: Array<{
    label: string;
    currentCoverage: string;
    risk: string;
    recommendedQuality: string;
  }>;
  overallRecommendations: string[];
  complianceNotes: string[];
  defensiveDisclaimer: string;
}

const understandingSchema = z.object({
  sceneType: z.string().min(2),
  occupancy: z.object({
    estimated: z.string(),
    confidence: z.string(),
    peakHours: z.array(z.string()),
  }),
  lighting: z.object({
    overall: z.string(),
    problemAreas: z.array(z.string()),
  }),
  obstructions: z.array(z.object({
    label: z.string(),
    impact: z.string(),
    recommendation: z.string(),
  })),
  cameraAssessment: z.array(z.object({
    label: z.string(),
    position: z.string(),
    suitability: z.string(),
    gaps: z.array(z.string()),
    recommendation: z.string(),
  })),
  criticalZones: z.array(z.object({
    label: z.string(),
    currentCoverage: z.string(),
    risk: z.string(),
    recommendedQuality: z.string(),
  })),
  overallRecommendations: z.array(z.string()).min(1),
  complianceNotes: z.array(z.string()),
  defensiveDisclaimer: z.string(),
});

const understandingPromptEntry = PROMPT_REGISTRY.find((entry) => entry.id === "scene_understanding");
const UNDERSTANDING_SYSTEM_PROMPT = understandingPromptEntry?.systemPrompt ?? `You are a security assessment analyst. Analyze the provided scene description and simulation data to produce a structured security understanding.

Evaluate:
- The type of facility and its inherent risk profile
- Occupancy patterns and their security implications
- Lighting conditions and problem areas
- How obstructions affect camera coverage
- Per-camera placement suitability and gaps
- Critical zone coverage and risk levels

Output ONLY valid JSON matching the schema. Frame findings defensively: "coverage gaps," "hardening recommendations," "authorized incident replay analysis." Never include "evasion," "bypass," or "defeat."`;

export async function analyzeSceneUnderstanding(
  sceneDescription: string,
  simulationSummary: string,
  provider: ModelProvider,
): Promise<SceneUnderstandingResult> {
  const prompt = {
    system: UNDERSTANDING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: [
          `Scene: ${sceneDescription}`,
          `Simulation: ${simulationSummary}`,
          "\nAnalyze the security posture, identify coverage gaps, and provide hardening recommendations.",
        ].join("\n"),
      },
    ],
  };

  const result = await provider.completeStructured(prompt, understandingSchema);

  return {
    ...result,
    defensiveDisclaimer: result.defensiveDisclaimer || "This analysis is intended for authorized security assessment and hardening purposes only.",
  };
}

export function buildSceneUnderstandingSummary(scene: {
  name?: string;
  dimensions?: { width: number; depth: number; height: number };
  cameras?: unknown[];
  obstructions?: unknown[];
  criticalZones?: unknown[];
  entryPoints?: unknown[];
  securityLights?: unknown[];
  paths?: unknown[];
}): string {
  return JSON.stringify({
    name: scene.name ?? "Unnamed scene",
    dimensions: scene.dimensions ?? { width: 10, depth: 10, height: 3 },
    cameraCount: scene.cameras?.length ?? 0,
    obstructionCount: scene.obstructions?.length ?? 0,
    zoneCount: scene.criticalZones?.length ?? 0,
    entryPoints: scene.entryPoints?.length ?? 0,
    lightCount: scene.securityLights?.length ?? 0,
    pathCount: scene.paths?.length ?? 0,
  }, null, 2);
}
