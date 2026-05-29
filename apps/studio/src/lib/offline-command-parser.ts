import type { ViewMode, BottomTab } from "@/store/studio-store";
import type { SceneOperation } from "@/schema/SceneOperation";
import type { SecurityScene } from "@/schema/security-scene";
import { selectCounterCriticalZone } from "@/lib/critical-zone-selection";

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
  requiresTargetSelection?: boolean;
  unresolvedTarget?: string;
  candidateTargets?: string[];
};

type TargetMatch<T extends { id: string; name?: string; label?: string }> = {
  node: T | null;
  ambiguous: boolean;
  candidates: T[];
};

function formatTargetList(candidates: Array<{ name?: string; label?: string }>, fallbackPrefix: string) {
  return candidates.map((candidate, index) => candidate.name ?? candidate.label ?? `${fallbackPrefix} ${index + 1}`);
}

function cameraTarget(scene: SecurityScene, token?: string | null): TargetMatch<(typeof scene.cameras)[number]> {
  const normalized = token?.trim().toLowerCase() ?? "";
  if (!normalized) return { node: null, ambiguous: false, candidates: [] };

  const exactMatches = scene.cameras.filter((camera) => camera.name.toLowerCase() === normalized);
  if (exactMatches.length === 1) return { node: exactMatches[0] ?? null, ambiguous: false, candidates: exactMatches };
  if (exactMatches.length > 1) return { node: null, ambiguous: true, candidates: exactMatches };

  const match = normalized.match(/^camera\s*(\d+)$/);
  if (match) {
    const index = Number(match[1]) - 1;
    const candidate = scene.cameras[index] ?? null;
    return { node: candidate, ambiguous: false, candidates: candidate ? [candidate] : [] };
  }

  const partial = scene.cameras.filter((camera) => camera.name.toLowerCase().includes(normalized));
  if (partial.length === 1) return { node: partial[0] ?? null, ambiguous: false, candidates: partial };
  if (partial.length > 1) return { node: null, ambiguous: true, candidates: partial };
  return { node: null, ambiguous: false, candidates: [] };
}

function lightTarget(scene: SecurityScene, token?: string | null): TargetMatch<(typeof scene.securityLights)[number]> {
  const normalized = token?.trim().toLowerCase() ?? "";
  if (!normalized) return { node: null, ambiguous: false, candidates: [] };

  const exactMatches = scene.securityLights.filter((light) => light.name.toLowerCase() === normalized);
  if (exactMatches.length === 1) return { node: exactMatches[0] ?? null, ambiguous: false, candidates: exactMatches };
  if (exactMatches.length > 1) return { node: null, ambiguous: true, candidates: exactMatches };

  const match = normalized.match(/^light\s*(\d+)$/);
  if (match) {
    const index = Number(match[1]) - 1;
    const candidate = scene.securityLights[index] ?? null;
    return { node: candidate, ambiguous: false, candidates: candidate ? [candidate] : [] };
  }

  const partial = scene.securityLights.filter((light) => light.name.toLowerCase().includes(normalized));
  if (partial.length === 1) return { node: partial[0] ?? null, ambiguous: false, candidates: partial };
  if (partial.length > 1) return { node: null, ambiguous: true, candidates: partial };
  return { node: null, ambiguous: false, candidates: [] };
}

function obstructionTarget(scene: SecurityScene, token?: string | null): TargetMatch<(typeof scene.obstructions)[number]> {
  const normalized = token?.trim().toLowerCase() ?? "";
  if (!normalized) return { node: null, ambiguous: false, candidates: [] };

  const exactMatches = scene.obstructions.filter((obstruction) => obstruction.label.toLowerCase() === normalized);
  if (exactMatches.length === 1) return { node: exactMatches[0] ?? null, ambiguous: false, candidates: exactMatches };
  if (exactMatches.length > 1) return { node: null, ambiguous: true, candidates: exactMatches };

  const partial = scene.obstructions.filter((obstruction) => obstruction.label.toLowerCase().includes(normalized));
  if (partial.length === 1) return { node: partial[0] ?? null, ambiguous: false, candidates: partial };
  if (partial.length > 1) return { node: null, ambiguous: true, candidates: partial };

  return { node: null, ambiguous: false, candidates: [] };
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
  const zone = selectCounterCriticalZone(scene);
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

function defaultObstructionPosition(scene: SecurityScene) {
  const center = roomCenter(scene);
  return [center[0], 0.5, center[2]] as [number, number, number];
}

function parseAnchorPosition(scene: SecurityScene, anchor?: string) {
  if (anchor === "entry") {
    const entry = entryFocus(scene);
    return [entry[0], 0.5, entry[2]] as [number, number, number];
  }
  if (anchor === "counter") {
    const counter = counterFocus(scene);
    return [counter[0], 0.5, counter[2]] as [number, number, number];
  }
  if (anchor === "center") {
    return defaultObstructionPosition(scene);
  }
  return defaultObstructionPosition(scene);
}

function parseObstructionType(rawType?: string) {
  const normalized = rawType?.trim().toLowerCase();
  if (!normalized) return "partition" as const;
  if (normalized.includes("shelf")) return "shelf" as const;
  if (normalized.includes("cupboard")) return "cupboard" as const;
  if (normalized.includes("counter")) return "counter" as const;
  if (normalized.includes("pillar")) return "pillar" as const;
  if (normalized.includes("vehicle")) return "vehicle" as const;
  if (normalized.includes("tree")) return "tree" as const;
  if (normalized.includes("gate")) return "gate" as const;
  if (normalized.includes("sign")) return "signboard" as const;
  if (normalized.includes("storage") || normalized.includes("box")) return "storage_boxes" as const;
  if (normalized.includes("glass")) return "glass_display" as const;
  if (normalized.includes("curtain")) return "curtain" as const;
  if (normalized.includes("partition") || normalized.includes("divider") || normalized.includes("obstruction") || normalized.includes("block")) {
    return "partition" as const;
  }
  return "other" as const;
}

function parsePositionCoordinates(match: RegExpMatchArray, startIndex = 1) {
  const x = Number(match[startIndex]);
  const y = Number(match[startIndex + 1]);
  const z = Number(match[startIndex + 2]);
  return [x, y, z] as [number, number, number];
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

  if (/(^|\b)(show|open|focus)\s+(the\s+)?(worst\s+)?blind\s*spot(s)?(\b|$)/.test(normalized)) {
    return {
      message: "Opened issue panel to review the worst blind spot.",
      operations: [],
      action: { type: "set_bottom_tab", tab: "issues" },
    };
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
    const cameraMatch = cameraTarget(scene, targetToken);
    if (cameraMatch.ambiguous) {
      return {
        message: `Multiple cameras match "${targetToken?.trim() ?? "camera"}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: targetToken?.trim() ?? "camera",
        candidateTargets: formatTargetList(cameraMatch.candidates, "Camera"),
      };
    }
    if (cameraMatch.node) {
      return {
        message: `${isOn ? "Turned on" : "Turned off"} ${cameraMatch.node.name}`,
        operations: [{ type: "toggle_camera", cameraId: cameraMatch.node.id, status: isOn ? "on" : "off" }],
      };
    }
  }

  const lightTargetMatch = normalized.match(/(?:turn\s+(on|off)|enable|disable)\s+light\s+(.+)$/)
    ?? normalized.match(/light\s+(.+?)\s+(?:turn\s+(on|off)|on|off|enable|disable)$/);
  if (lightTargetMatch) {
    const statusToken = lightTargetMatch[1] ?? lightTargetMatch[0];
    const isOn = /on|enable/.test(statusToken);
    const targetToken = lightTargetMatch[2] ?? lightTargetMatch[1];
    const lightMatch = lightTarget(scene, targetToken);
    if (lightMatch.ambiguous) {
      return {
        message: `Multiple lights match "${targetToken?.trim() ?? "light"}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: targetToken?.trim() ?? "light",
        candidateTargets: formatTargetList(lightMatch.candidates, "Light"),
      };
    }
    if (lightMatch.node) {
      return {
        message: `${isOn ? "Turned on" : "Turned off"} ${lightMatch.node.name}`,
        operations: [{ type: "toggle_light", lightId: lightMatch.node.id, status: isOn ? "on" : "off" }],
      };
    }
  }

  const moveCameraTo = normalized.match(/move\s+camera\s+(.+?)\s+to\s+(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (moveCameraTo) {
    const cameraMatch = cameraTarget(scene, moveCameraTo[1]);
    if (cameraMatch.ambiguous) {
      return {
        message: `Multiple cameras match "${moveCameraTo[1]}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: moveCameraTo[1],
        candidateTargets: formatTargetList(cameraMatch.candidates, "Camera"),
      };
    }
    if (cameraMatch.node) {
      return {
        message: `Moved ${cameraMatch.node.name}`,
        operations: [{
          type: "move_camera",
          cameraId: cameraMatch.node.id,
          newPosition: [Number(moveCameraTo[2]), Number(moveCameraTo[3]), Number(moveCameraTo[4])] as [number, number, number],
        }],
      };
    }
  }

  const rotateCamera = normalized.match(/rotate\s+camera\s+(.+?)\s+(?:to\s+)?(-?\d+(?:\.\d+)?)(?:\s*(?:deg|°))?(?:\s+pitch\s+(-?\d+(?:\.\d+)?))?/);
  if (rotateCamera) {
    const cameraMatch = cameraTarget(scene, rotateCamera[1]);
    if (cameraMatch.ambiguous) {
      return {
        message: `Multiple cameras match "${rotateCamera[1]}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: rotateCamera[1],
        candidateTargets: formatTargetList(cameraMatch.candidates, "Camera"),
      };
    }
    if (cameraMatch.node) {
      return {
        message: `Rotated ${cameraMatch.node.name}`,
        operations: [{
          type: "rotate_camera",
          cameraId: cameraMatch.node.id,
          yawDeg: Number(rotateCamera[2]),
          ...(rotateCamera[3] != null ? { pitchDeg: Number(rotateCamera[3]) } : {}),
        }],
      };
    }
  }

  const tiltCamera = normalized.match(/tilt\s+camera\s+(.+?)\s+(?:to\s+)?(-?\d+(?:\.\d+)?)(?:\s*(?:deg|°))?/)
    ?? normalized.match(/camera\s+(.+?)\s+tilt\s+(?:to\s+)?(-?\d+(?:\.\d+)?)(?:\s*(?:deg|°))?/);
  if (tiltCamera) {
    const cameraMatch = cameraTarget(scene, tiltCamera[1]);
    if (cameraMatch.ambiguous) {
      return {
        message: `Multiple cameras match "${tiltCamera[1]}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: tiltCamera[1],
        candidateTargets: formatTargetList(cameraMatch.candidates, "Camera"),
      };
    }
    if (cameraMatch.node) {
      return {
        message: `Tilted ${cameraMatch.node.name} to ${Number(tiltCamera[2])}°`,
        operations: [{
          type: "rotate_camera",
          cameraId: cameraMatch.node.id,
          yawDeg: cameraMatch.node.yawDeg,
          pitchDeg: Number(tiltCamera[2]),
        }],
      };
    }
  }

  const aimCamera = normalized.match(/(?:aim|point|turn|rotate|move)\s+camera\s+(.+?)\s+(?:toward|towards|at)\s+(?:the\s+)?(entry|counter|center)/);
  if (aimCamera) {
    const cameraMatch = cameraTarget(scene, aimCamera[1]);
    if (cameraMatch.ambiguous) {
      return {
        message: `Multiple cameras match "${aimCamera[1]}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: aimCamera[1],
        candidateTargets: formatTargetList(cameraMatch.candidates, "Camera"),
      };
    }
    if (cameraMatch.node) {
      const target =
        aimCamera[2] === "entry"
          ? entryFocus(scene)
          : aimCamera[2] === "counter"
            ? counterFocus(scene)
            : roomCenter(scene);
      return {
        message: `Aimed ${cameraMatch.node.name} at ${aimCamera[2]}`,
        operations: [{
          type: "rotate_camera",
          cameraId: cameraMatch.node.id,
          yawDeg: yawToward(cameraMatch.node.position, target),
        }],
      };
    }
  }

  const changeFov = normalized.match(/(?:change|set)\s+fov\s+camera\s+(.+?)\s+to\s+(-?\d+(?:\.\d+)?)/)
    ?? normalized.match(/camera\s+(.+?)\s+fov\s+to\s+(-?\d+(?:\.\d+)?)/);
  if (changeFov) {
    const cameraMatch = cameraTarget(scene, changeFov[1]);
    if (cameraMatch.ambiguous) {
      return {
        message: `Multiple cameras match "${changeFov[1]}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: changeFov[1],
        candidateTargets: formatTargetList(cameraMatch.candidates, "Camera"),
      };
    }
    if (cameraMatch.node) {
      const fov = Math.max(15, Math.min(180, Number(changeFov[2])));
      return {
        message: `Changed FOV on ${cameraMatch.node.name}`,
        operations: [{ type: "change_camera_fov", cameraId: cameraMatch.node.id, fovHorizontalDeg: fov }],
      };
    }
  }

  const addObstructionAtPosition = normalized.match(/add\s+(.+?)\s+obstruction\s+(?:at|to)\s+(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/)
    ?? normalized.match(/add\s+obstruction\s+(?:at|to)\s+(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (addObstructionAtPosition) {
    const hasType = addObstructionAtPosition.length === 5;
    const rawType = hasType ? addObstructionAtPosition[1] : undefined;
    const coordinateStart = hasType ? 2 : 1;
    const position = parsePositionCoordinates(addObstructionAtPosition, coordinateStart);
    const obstructionType = parseObstructionType(rawType);
    return {
      message: `Added ${obstructionType.replace(/_/g, " ")} obstruction`,
      operations: [{
        type: "add_obstruction",
        obstructionType,
        position,
        label: `AI ${obstructionType.replace(/_/g, " ")} obstruction`,
      }],
    };
  }

  const addObstructionNear = normalized.match(/add\s+(.+?)\s+obstruction(?:\s+near\s+(entry|counter|center))?/)
    ?? normalized.match(/add\s+obstruction(?:\s+near\s+(entry|counter|center))?/);
  if (addObstructionNear && normalized.includes("add") && normalized.includes("obstruction")) {
    const rawType = addObstructionNear.length === 3 ? addObstructionNear[1] : undefined;
    const anchor = addObstructionNear[addObstructionNear.length - 1];
    const obstructionType = parseObstructionType(rawType);
    const position = parseAnchorPosition(scene, anchor);
    return {
      message: `Added ${obstructionType.replace(/_/g, " ")} obstruction${anchor ? ` near ${anchor}` : ""}`,
      operations: [{
        type: "add_obstruction",
        obstructionType,
        position,
        label: `AI ${obstructionType.replace(/_/g, " ")} obstruction`,
      }],
    };
  }

  const moveObstructionTo = normalized.match(/move\s+obstruction\s+(.+?)\s+to\s+(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (moveObstructionTo) {
    const match = obstructionTarget(scene, moveObstructionTo[1]);
    if (match.ambiguous) {
      return {
        message: `Multiple obstructions match "${moveObstructionTo[1]}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: moveObstructionTo[1],
        candidateTargets: formatTargetList(match.candidates, "Obstruction"),
      };
    }
    if (match.node) {
      return {
        message: `Moved obstruction ${match.node.label}`,
        operations: [{
          type: "move_obstruction",
          obstructionId: match.node.id,
          newPosition: parsePositionCoordinates(moveObstructionTo),
        }],
      };
    }
  }

  const moveObstructionNear = normalized.match(/move\s+obstruction\s+(.+?)\s+near\s+(entry|counter|center)/);
  if (moveObstructionNear) {
    const match = obstructionTarget(scene, moveObstructionNear[1]);
    if (match.ambiguous) {
      return {
        message: `Multiple obstructions match "${moveObstructionNear[1]}". Select one in the scene and retry.`,
        operations: [],
        action: { type: "set_view_mode", mode: "map" },
        requiresTargetSelection: true,
        unresolvedTarget: moveObstructionNear[1],
        candidateTargets: formatTargetList(match.candidates, "Obstruction"),
      };
    }
    if (match.node) {
      return {
        message: `Moved obstruction ${match.node.label} near ${moveObstructionNear[2]}`,
        operations: [{
          type: "move_obstruction",
          obstructionId: match.node.id,
          newPosition: parseAnchorPosition(scene, moveObstructionNear[2]),
        }],
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
