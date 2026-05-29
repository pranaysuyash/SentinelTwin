import { sceneOperationArraySchema } from "@/schema/SceneOperation";
import type { SceneOperation } from "@/schema/SceneOperation";
import { PROMPT_REGISTRY } from "@/agents/prompt-registry";
import type { ModelProvider } from "./providers/ModelProvider";

/**
 * Lightweight summary of the current scene — never send full SecurityScene JSON
 * to the model for command parsing (too large, mostly irrelevant).
 */
export interface SceneContextSummary {
  cameraNames: string[];
  obstructionLabels: string[];
  lightNames: string[];
  zoneLabels: string[];
  activeCameraCount: number;
  /** Matches simulationAssumptionsSchema.timeOfDay */
  currentTimeOfDay: "day" | "night" | "custom";
  dimensions: { width: number; depth: number; height: number };
}

const SYSTEM_PROMPT = PROMPT_REGISTRY.find((entry) => entry.id === "command_parse")?.systemPrompt ?? "";

/**
 * Parse a natural language command into structured scene operations.
 */
export async function parseCommand(
  userText: string,
  sceneContext: SceneContextSummary,
  provider: ModelProvider,
): Promise<SceneOperation[]> {
  const sceneSummary = buildSceneSummary(sceneContext);

  const prompt = {
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: `Current scene: ${sceneSummary}\nUser says: ${userText}\n\nReturn: { "operations": SceneOperation[] }`,
      },
    ],
  };

  const result = await provider.completeStructured(prompt, sceneOperationArraySchema);
  return result.operations;
}

function buildSceneSummary(ctx: SceneContextSummary): string {
  return [
    `Cameras: ${ctx.cameraNames.join(", ")} (${ctx.activeCameraCount} active)`,
    `Obstructions: ${ctx.obstructionLabels.join(", ")}`,
    `Lights: ${ctx.lightNames.join(", ")}`,
    `Zones: ${ctx.zoneLabels.join(", ")}`,
    `Time: ${ctx.currentTimeOfDay}`,
    `Room: ${ctx.dimensions.width}m × ${ctx.dimensions.depth}m × ${ctx.dimensions.height}m`,
  ].join(" | ");
}
