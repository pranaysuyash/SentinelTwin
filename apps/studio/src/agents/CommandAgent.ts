import { sceneOperationArraySchema } from "@/schema/SceneOperation";
import type { SceneOperation } from "@/schema/SceneOperation";
import { PROMPT_REGISTRY } from "@/agents/prompt-registry";
import { validateSceneOperationsAgainstScene } from "@/lib/scene-operation-validator";
import type { SecurityScene } from "@/schema/security-scene";
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

const commandPromptEntry = PROMPT_REGISTRY.find((entry) => entry.id === "command_parse");
if (!commandPromptEntry) {
  throw new Error("Missing command_parse prompt registry entry.");
}
const SYSTEM_PROMPT = commandPromptEntry.systemPrompt;

export type CommandParseResult = {
  operations: SceneOperation[];
  confidence: number;
  warnings: string[];
  requiresConfirmation: boolean;
};

/**
 * Parse a natural language command into structured scene operations.
 */
export async function parseCommand(
  userText: string,
  sceneContext: SceneContextSummary,
  provider: ModelProvider,
): Promise<SceneOperation[]> {
  const result = await parseCommandDetailed(userText, sceneContext, provider);
  return result.operations;
}

export async function parseCommandDetailed(
  userText: string,
  sceneContext: SceneContextSummary,
  provider: ModelProvider,
  semanticScene?: SecurityScene,
): Promise<CommandParseResult> {
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
  const parsedOperations = result.operations;
  if (!semanticScene) {
    return {
      operations: parsedOperations,
      confidence: parsedOperations.length > 0 ? 0.7 : 0.25,
      warnings: parsedOperations.length > 0 ? [] : ["No structured scene operation was produced."],
      requiresConfirmation: parsedOperations.length > 0,
    };
  }
  const semantic = validateSceneOperationsAgainstScene(parsedOperations, semanticScene);
  return {
    operations: semantic.validOperations,
    confidence: semantic.issues.length === 0 ? 0.82 : 0.58,
    warnings: semantic.issues.map((issue) => issue.message),
    requiresConfirmation: true,
  };
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
