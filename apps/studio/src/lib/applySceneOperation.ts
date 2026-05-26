import type { SceneOperation } from "@/schema/SceneOperation";
import type { SecurityScene } from "@/schema/security-scene";
import { createSecurityLightNode } from "./node-factory";

export interface ApplyResult {
  success: boolean;
  description: string;
  error?: string;
}

/**
 * Apply a single SceneOperation to an in-memory SecurityScene clone.
 * Returns a description of what was applied, or an error.
 */
export function applySceneOperation(scene: SecurityScene, op: SceneOperation): ApplyResult {
  switch (op.type) {
    case "move_camera": {
      const cam = scene.cameras.find((c) => c.id === op.cameraId);
      if (!cam) return { success: false, description: "", error: `Camera "${op.cameraId}" not found` };
      cam.position = op.newPosition;
      return { success: true, description: `Moved "${cam.name}" to (${op.newPosition.join(", ")})` };
    }

    case "rotate_camera": {
      const cam = scene.cameras.find((c) => c.id === op.cameraId);
      if (!cam) return { success: false, description: "", error: `Camera "${op.cameraId}" not found` };
      cam.yawDeg = op.yawDeg;
      if (op.pitchDeg !== undefined) cam.pitchDeg = op.pitchDeg;
      return { success: true, description: `Rotated "${cam.name}" to yaw ${op.yawDeg}°${op.pitchDeg !== undefined ? `, pitch ${op.pitchDeg}°` : ""}` };
    }

    case "change_camera_fov": {
      const cam = scene.cameras.find((c) => c.id === op.cameraId);
      if (!cam) return { success: false, description: "", error: `Camera "${op.cameraId}" not found` };
      cam.fovHorizontalDeg = op.fovHorizontalDeg;
      return { success: true, description: `Changed "${cam.name}" FOV to ${op.fovHorizontalDeg}°` };
    }

    case "toggle_camera": {
      const cam = scene.cameras.find((c) => c.id === op.cameraId);
      if (!cam) return { success: false, description: "", error: `Camera "${op.cameraId}" not found` };
      cam.status = op.status;
      return { success: true, description: `Turned ${op.status === "on" ? "on" : "off"} "${cam.name}"` };
    }

    case "move_obstruction": {
      const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
      if (!obs) return { success: false, description: "", error: `Obstruction "${op.obstructionId}" not found` };
      obs.position = op.newPosition;
      return { success: true, description: `Moved "${obs.label}" to (${op.newPosition.join(", ")})` };
    }

    case "resize_obstruction": {
      const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
      if (!obs) return { success: false, description: "", error: `Obstruction "${op.obstructionId}" not found` };
      obs.dimensions = op.newDimensions;
      return { success: true, description: `Resized "${obs.label}" to ${op.newDimensions.join(" × ")}` };
    }

    case "rotate_obstruction": {
      const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
      if (!obs) return { success: false, description: "", error: `Obstruction "${op.obstructionId}" not found` };
      obs.rotationYDeg = op.rotationYDeg;
      return { success: true, description: `Rotated "${obs.label}" to ${op.rotationYDeg}°` };
    }

    case "add_light": {
      const light = createSecurityLightNode(op.position);
      if (op.name) light.name = op.name;
      if (op.lightType) light.lightType = op.lightType;
      if (op.brightness) light.brightness = op.brightness;
      scene.securityLights.push(light);
      return { success: true, description: `Added light "${light.name}" at (${op.position.join(", ")})` };
    }

    case "toggle_light": {
      const light = scene.securityLights.find((l) => l.id === op.lightId);
      if (!light) return { success: false, description: "", error: `Light "${op.lightId}" not found` };
      light.status = op.status;
      return { success: true, description: `Turned ${op.status === "on" ? "on" : "off"} "${light.name}"` };
    }

    case "set_time_of_day": {
      // assumptions.timeOfDay uses "custom" instead of "dusk"
      scene.assumptions.timeOfDay = op.timeOfDay === "dusk" ? "custom" : op.timeOfDay;
      return { success: true, description: `Set time of day to ${op.timeOfDay}` };
    }

    case "replay_path": {
      const path = scene.paths.find((p) => p.id === op.pathId);
      if (!path) return { success: false, description: "", error: `Path "${op.pathId}" not found` };
      return { success: true, description: `Preparing to replay path "${path.label}"` };
    }

    case "run_adversarial": {
      return { success: true, description: "Running adversarial path analysis" };
    }

    case "save_snapshot": {
      return { success: true, description: `Saved snapshot: "${op.label}"` };
    }

    case "generate_report": {
      return { success: true, description: "Generating report" };
    }

    default:
      return { success: false, description: "", error: `Unknown operation type: ${(op as SceneOperation).type}` };
  }
}

/**
 * Apply multiple SceneOperations to a scene clone.
 * Returns the mutated clone and a summary of results.
 */
export function applySceneOperations<const T extends SceneOperation[]>(
  scene: SecurityScene,
  ops: T,
): { scene: SecurityScene; results: ApplyResult[] } {
  const cloned = structuredClone(scene);
  const results = ops.map((op) => applySceneOperation(cloned, op));
  cloned.updatedAt = Date.now();
  return { scene: cloned, results };
}
