import { sceneOperationArraySchema } from "@/schema/SceneOperation";
import type { SceneOperation } from "@/schema/SceneOperation";
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

const SYSTEM_PROMPT = `You are SentinelTwin's command interpreter. Convert the user's natural language request into structured scene operations.

You can perform these operations:
- move_camera: Change a camera's position (x, y, z)
- rotate_camera: Change a camera's yaw (horizontal) and/or pitch (vertical) in degrees
- change_camera_fov: Change a camera's horizontal field of view (1-180 degrees)
- toggle_camera: Turn a camera on or off
- move_obstruction: Move an obstruction/shelf to a new position (x, y, z)
- resize_obstruction: Change an obstruction's dimensions (width, height, depth)
- rotate_obstruction: Rotate an obstruction horizontally
- add_light: Add a new security light at a position
- toggle_light: Turn a light on or off
- set_time_of_day: Switch between day, night, or dusk
- save_snapshot: Save the current state with a label
- generate_report: Generate a security audit report
- run_adversarial: Run adversarial path analysis

Output ONLY valid JSON matching the schema. Do not explain, do not add commentary.`;

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
