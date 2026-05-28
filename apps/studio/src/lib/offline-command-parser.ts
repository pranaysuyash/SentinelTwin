import type { ViewMode, BottomTab } from "@/store/studio-store";
import type { SceneOperation } from "@/schema/SceneOperation";
import type { SecurityScene } from "@/schema/security-scene";

export type OfflineCommandAction =
  | { type: "set_environment_mode"; mode: "day" | "night" | "dusk" }
  | { type: "set_view_mode"; mode: ViewMode }
  | { type: "set_bottom_tab"; tab: BottomTab }
  | { type: "set_layer_visibility"; layer: "privacy_zones"; visible: boolean }
  | { type: "run_simulation" }
  | { type: "save_snapshot"; label: string };

export type OfflineCommandPlan = {
  message: string;
  operations: SceneOperation[];
  action?: OfflineCommandAction;
};

function cameraTarget(scene: SecurityScene, token?: string | null) {
  const normalized = token?.trim().toLowerCase() ?? "";
  if (!normalized) return scene.cameras[0] ?? null;

  const byName = scene.cameras.find((camera) => camera.name.toLowerCase() === normalized);
  if (byName) return byName;

  const match = normalized.match(/^camera\s*(\d+)$/);
  if (match) {
    const index = Number(match[1]) - 1;
    return scene.cameras[index] ?? null;
  }

  return scene.cameras.find((camera) => camera.name.toLowerCase().includes(normalized)) ?? scene.cameras[0] ?? null;
}

function lightTarget(scene: SecurityScene, token?: string | null) {
  const normalized = token?.trim().toLowerCase() ?? "";
  if (!normalized) return scene.securityLights[0] ?? null;

  const byName = scene.securityLights.find((light) => light.name.toLowerCase() === normalized);
  if (byName) return byName;

  const match = normalized.match(/^light\s*(\d+)$/);
  if (match) {
    const index = Number(match[1]) - 1;
    return scene.securityLights[index] ?? null;
  }

  return scene.securityLights.find((light) => light.name.toLowerCase().includes(normalized)) ?? scene.securityLights[0] ?? null;
}

function roomCenter(scene: SecurityScene): [number, number, number] {
  return [scene.dimensions.width / 2, Math.max(2.4, scene.assumptions.wallHeightM - 0.2), scene.dimensions.depth / 2];
}

function entryFocus(scene: SecurityScene): [number, number, number] {
  const entry = scene.entryPoints[0];
  if (!entry) return roomCenter(scene);
  return [entry.position[0], Math.max(2.4, scene.assumptions.wallHeightM - 0.2), entry.position[1]];
}

function counterFocus(scene: SecurityScene): [number, number, number] {
  const zone = scene.criticalZones[0];
  if (!zone) return roomCenter(scene);
  const centroid = zone.polygon.reduce(
    (acc, [x, z]) => {
      acc.x += x;
      acc.z += z;
      return acc;
    },
    { x: 0, z: 0 },
  );
  const count = Math.max(zone.polygon.length, 1);
  return [centroid.x / count, Math.max(2.4, scene.assumptions.wallHeightM - 0.2), centroid.z / count];
}

function yawToward(from: [number, number, number], target: [number, number, number]) {
  const dx = target[0] - from[0];
  const dz = target[2] - from[2];
  return Math.round(Math.atan2(dx, dz) * (180 / Math.PI));
}

export function parseOfflineCommand(userText: string, scene: SecurityScene): OfflineCommandPlan | null {
  const normalized = userText.trim().toLowerCase();
  if (!normalized) return null;

  if (/(^|\b)(run simulation|simulate|recompute|refresh results)(\b|$)/.test(normalized)) {
    return { message: "Simulation started", operations: [], action: { type: "run_simulation" } };
  }

  if (/(^|\b)(generate report|open report|report lite)(\b|$)/.test(normalized)) {
    return { message: "Opened report panel", operations: [], action: { type: "set_bottom_tab", tab: "report" } };
  }

  if (/(^|\b)(night mode|set to night|switch to night|turn on night)(\b|$)/.test(normalized)) {
    return { message: "Switched to night mode", operations: [], action: { type: "set_environment_mode", mode: "night" } };
  }

  if (/(^|\b)(dusk mode|set to dusk|switch to dusk)(\b|$)/.test(normalized)) {
    return { message: "Switched to dusk mode", operations: [], action: { type: "set_environment_mode", mode: "dusk" } };
  }

  if (/(^|\b)(day mode|set to day|switch to day)(\b|$)/.test(normalized)) {
    return { message: "Switched to day mode", operations: [], action: { type: "set_environment_mode", mode: "day" } };
  }

  if (/(^|\b)(privacy on|show privacy|enable privacy)(\b|$)/.test(normalized)) {
    return { message: "Privacy zones enabled", operations: [], action: { type: "set_layer_visibility", layer: "privacy_zones", visible: true } };
  }

  if (/(^|\b)(privacy off|hide privacy|disable privacy)(\b|$)/.test(normalized)) {
    return { message: "Privacy zones hidden", operations: [], action: { type: "set_layer_visibility", layer: "privacy_zones", visible: false } };
  }

  if (/(^|\b)(save snapshot|take snapshot|snapshot)(\b|$)/.test(normalized)) {
    return {
      message: "Snapshot saved",
      operations: [],
      action: { type: "save_snapshot", label: `Snapshot ${new Date().toLocaleTimeString()}` },
    };
  }

  const cameraTargetMatch = normalized.match(/(?:turn\s+(on|off)|enable|disable)\s+camera\s+(.+)$/)
    ?? normalized.match(/camera\s+(.+?)\s+(?:turn\s+(on|off)|on|off|enable|disable)$/);
  if (cameraTargetMatch) {
    const statusToken = cameraTargetMatch[1] ?? cameraTargetMatch[0];
    const isOn = /on|enable/.test(statusToken);
    const targetToken = cameraTargetMatch[2] ?? cameraTargetMatch[1];
    const camera = cameraTarget(scene, targetToken);
    if (camera) {
      return {
        message: `${isOn ? "Turned on" : "Turned off"} ${camera.name}`,
        operations: [{ type: "toggle_camera", cameraId: camera.id, status: isOn ? "on" : "off" }],
      };
    }
  }

  const lightTargetMatch = normalized.match(/(?:turn\s+(on|off)|enable|disable)\s+light\s+(.+)$/)
    ?? normalized.match(/light\s+(.+?)\s+(?:turn\s+(on|off)|on|off|enable|disable)$/);
  if (lightTargetMatch) {
    const statusToken = lightTargetMatch[1] ?? lightTargetMatch[0];
    const isOn = /on|enable/.test(statusToken);
    const targetToken = lightTargetMatch[2] ?? lightTargetMatch[1];
    const light = lightTarget(scene, targetToken);
    if (light) {
      return {
        message: `${isOn ? "Turned on" : "Turned off"} ${light.name}`,
        operations: [{ type: "toggle_light", lightId: light.id, status: isOn ? "on" : "off" }],
      };
    }
  }

  const moveCameraTo = normalized.match(/move\s+camera\s+(.+?)\s+to\s+(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (moveCameraTo) {
    const camera = cameraTarget(scene, moveCameraTo[1]);
    if (camera) {
      return {
        message: `Moved ${camera.name}`,
        operations: [{
          type: "move_camera",
          cameraId: camera.id,
          newPosition: [Number(moveCameraTo[2]), Number(moveCameraTo[3]), Number(moveCameraTo[4])] as [number, number, number],
        }],
      };
    }
  }

  const rotateCamera = normalized.match(/rotate\s+camera\s+(.+?)\s+(?:to\s+)?(-?\d+(?:\.\d+)?)(?:\s*(?:deg|°))?(?:\s+pitch\s+(-?\d+(?:\.\d+)?))?/);
  if (rotateCamera) {
    const camera = cameraTarget(scene, rotateCamera[1]);
    if (camera) {
      return {
        message: `Rotated ${camera.name}`,
        operations: [{
          type: "rotate_camera",
          cameraId: camera.id,
          yawDeg: Number(rotateCamera[2]),
          ...(rotateCamera[3] != null ? { pitchDeg: Number(rotateCamera[3]) } : {}),
        }],
      };
    }
  }

  const aimCamera = normalized.match(/(?:aim|point|turn|rotate|move)\s+camera\s+(.+?)\s+(?:toward|towards|at)\s+(?:the\s+)?(entry|counter|center)/);
  if (aimCamera) {
    const camera = cameraTarget(scene, aimCamera[1]);
    if (camera) {
      const target =
        aimCamera[2] === "entry"
          ? entryFocus(scene)
          : aimCamera[2] === "counter"
            ? counterFocus(scene)
            : roomCenter(scene);
      return {
        message: `Aimed ${camera.name} at ${aimCamera[2]}`,
        operations: [{
          type: "rotate_camera",
          cameraId: camera.id,
          yawDeg: yawToward(camera.position, target),
        }],
      };
    }
  }

  const changeFov = normalized.match(/(?:change|set)\s+fov\s+camera\s+(.+?)\s+to\s+(-?\d+(?:\.\d+)?)/)
    ?? normalized.match(/camera\s+(.+?)\s+fov\s+to\s+(-?\d+(?:\.\d+)?)/);
  if (changeFov) {
    const camera = cameraTarget(scene, changeFov[1]);
    if (camera) {
      const fov = Math.max(15, Math.min(180, Number(changeFov[2])));
      return {
        message: `Changed FOV on ${camera.name}`,
        operations: [{ type: "change_camera_fov", cameraId: camera.id, fovHorizontalDeg: fov }],
      };
    }
  }

  const addLight = normalized.match(/add\s+light(?:\s+near\s+(counter|entry|center))?/);
  if (addLight) {
    const location = addLight[1] === "entry"
      ? entryFocus(scene)
      : addLight[1] === "counter"
        ? counterFocus(scene)
        : roomCenter(scene);
    return {
      message: "Added light",
      operations: [{
        type: "add_light",
        position: location,
        lightType: "ceiling",
        brightness: "medium",
      }],
    };
  }

  return null;
}
