import { z } from "zod";

/**
 * SceneOperation — a discriminated union of all operations the AI command layer
 * can apply to a SecurityScene.
 *
 * See Docs/architecture/05_AI_AGENT_ARCHITECTURE.md for the full design.
 */
export const sceneOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move_camera"),
    cameraId: z.string(),
    newPosition: z.tuple([z.number(), z.number(), z.number()]),
  }),
  z.object({
    type: z.literal("rotate_camera"),
    cameraId: z.string(),
    yawDeg: z.number(),
    pitchDeg: z.number().optional(),
  }),
  z.object({
    type: z.literal("change_camera_fov"),
    cameraId: z.string(),
    fovHorizontalDeg: z.number().min(1).max(180),
  }),
  z.object({
    type: z.literal("toggle_camera"),
    cameraId: z.string(),
    status: z.enum(["on", "off"]),
  }),
  z.object({
    type: z.literal("move_obstruction"),
    obstructionId: z.string(),
    newPosition: z.tuple([z.number(), z.number(), z.number()]),
  }),
  z.object({
    type: z.literal("resize_obstruction"),
    obstructionId: z.string(),
    newDimensions: z.tuple([z.number(), z.number(), z.number()]),
  }),
  z.object({
    type: z.literal("rotate_obstruction"),
    obstructionId: z.string(),
    rotationYDeg: z.number(),
  }),
  z.object({
    type: z.literal("add_light"),
    position: z.tuple([z.number(), z.number(), z.number()]),
    name: z.string().optional(),
    lightType: z.enum(["ceiling", "wall", "flood", "street", "emergency", "ir_flood"]).optional(),
    brightness: z.enum(["dim", "low", "medium", "high", "very_high"]).optional(),
  }),
  z.object({
    type: z.literal("toggle_light"),
    lightId: z.string(),
    status: z.enum(["on", "off"]),
  }),
  z.object({
    type: z.literal("set_time_of_day"),
    timeOfDay: z.enum(["day", "night", "dusk"]),
  }),
  z.object({
    type: z.literal("replay_path"),
    pathId: z.string(),
  }),
  z.object({
    type: z.literal("run_adversarial"),
  }),
  z.object({
    type: z.literal("save_snapshot"),
    label: z.string(),
  }),
  z.object({
    type: z.literal("generate_report"),
  }),
]);

export type SceneOperation = z.infer<typeof sceneOperationSchema>;

/** Wrapper schema for the agent response array */
export const sceneOperationArraySchema = z.object({
  operations: z.array(sceneOperationSchema),
});

export type SceneOperationArray = z.infer<typeof sceneOperationArraySchema>;
