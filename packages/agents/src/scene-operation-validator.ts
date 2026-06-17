import type { SceneOperation, SecurityScene } from "@sentineltwin/core";

export type SemanticValidationIssue = {
  code:
    | "UNKNOWN_CAMERA"
    | "UNKNOWN_OBSTRUCTION"
    | "UNKNOWN_LIGHT"
    | "UNKNOWN_PATH"
    | "OUT_OF_BOUNDS"
    | "INVALID_RANGE";
  message: string;
  operationIndex: number;
};

export type SemanticValidationResult = {
  validOperations: SceneOperation[];
  issues: SemanticValidationIssue[];
};

function pointInsideScene([x, , z]: [number, number, number], scene: SecurityScene) {
  return x >= 0 && z >= 0 && x <= scene.dimensions.width && z <= scene.dimensions.depth;
}

function pushIssue(
  issues: SemanticValidationIssue[],
  issue: SemanticValidationIssue,
) {
  issues.push(issue);
}

export function validateSceneOperationsAgainstScene(
  operations: SceneOperation[],
  scene: SecurityScene,
): SemanticValidationResult {
  const issues: SemanticValidationIssue[] = [];
  const validOperations: SceneOperation[] = [];

  for (const [index, operation] of operations.entries()) {
    let valid = true;

    switch (operation.type) {
      case "move_camera":
      case "rotate_camera":
      case "change_camera_fov":
      case "toggle_camera": {
        const exists = scene.cameras.some((camera) => camera.id === operation.cameraId);
        if (!exists) {
          pushIssue(issues, {
            code: "UNKNOWN_CAMERA",
            message: `Camera id \"${operation.cameraId}\" does not exist in the current scene.`,
            operationIndex: index,
          });
          valid = false;
        }
        if (operation.type === "move_camera" && !pointInsideScene(operation.newPosition, scene)) {
          pushIssue(issues, {
            code: "OUT_OF_BOUNDS",
            message: `Camera position is outside current scene bounds (${scene.dimensions.width}m x ${scene.dimensions.depth}m).`,
            operationIndex: index,
          });
          valid = false;
        }
        break;
      }
      case "move_obstruction":
      case "resize_obstruction":
      case "rotate_obstruction": {
        const exists = scene.obstructions.some((entry) => entry.id === operation.obstructionId);
        if (!exists) {
          pushIssue(issues, {
            code: "UNKNOWN_OBSTRUCTION",
            message: `Obstruction id \"${operation.obstructionId}\" does not exist in the current scene.`,
            operationIndex: index,
          });
          valid = false;
        }
        if (operation.type === "move_obstruction" && !pointInsideScene(operation.newPosition, scene)) {
          pushIssue(issues, {
            code: "OUT_OF_BOUNDS",
            message: "Obstruction position is outside current scene bounds.",
            operationIndex: index,
          });
          valid = false;
        }
        if (operation.type === "resize_obstruction") {
          const [w, h, d] = operation.newDimensions;
          if (w <= 0 || h <= 0 || d <= 0) {
            pushIssue(issues, {
              code: "INVALID_RANGE",
              message: "Obstruction dimensions must all be positive.",
              operationIndex: index,
            });
            valid = false;
          }
        }
        break;
      }
      case "add_obstruction":
      case "add_light": {
        if (!pointInsideScene(operation.position, scene)) {
          pushIssue(issues, {
            code: "OUT_OF_BOUNDS",
            message: `${operation.type === "add_light" ? "Light" : "Obstruction"} position is outside current scene bounds.`,
            operationIndex: index,
          });
          valid = false;
        }
        break;
      }
      case "toggle_light": {
        const exists = scene.securityLights.some((entry) => entry.id === operation.lightId);
        if (!exists) {
          pushIssue(issues, {
            code: "UNKNOWN_LIGHT",
            message: `Light id \"${operation.lightId}\" does not exist in the current scene.`,
            operationIndex: index,
          });
          valid = false;
        }
        break;
      }
      case "replay_path": {
        const exists = scene.paths.some((entry) => entry.id === operation.pathId);
        if (!exists) {
          pushIssue(issues, {
            code: "UNKNOWN_PATH",
            message: `Path id \"${operation.pathId}\" does not exist in the current scene.`,
            operationIndex: index,
          });
          valid = false;
        }
        break;
      }
      case "set_time_of_day":
      case "run_adversarial":
      case "run_coverage_failure_analysis":
      case "save_snapshot":
      case "generate_report":
        break;
      default: {
        const _never: never = operation;
        void _never;
      }
    }

    if (valid) validOperations.push(operation);
  }

  return { validOperations, issues };
}
