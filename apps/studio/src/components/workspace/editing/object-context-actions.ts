import {
  snapCameraToMount,
  type CameraMountSnapMode,
} from "@/components/inspector/camera-mount-snap";
import { snapDoorWindowToWall } from "@/components/inspector/door-window-snap";
import {
  clampToScene,
  nearestPointOnWall,
  pointDistance,
} from "@/components/workspace/editing/editor-geometry";
import type {
  AnyEditableNode,
  CameraNode,
  CriticalZoneNode,
  DoorNode,
  EntryPointNode,
  ObstructionNode,
  PrivacyZoneNode,
  ScenarioPath,
  SecurityLightNode,
  SecurityScene,
  WallNode,
  WindowNode,
} from "@/schema/security-scene";

export type ContextActionId =
  | "focus"
  | "duplicate"
  | "delete"
  | "open_camera_view"
  | "aim_at_selected_zone"
  | "snap_camera_wall"
  | "snap_camera_ceiling"
  | "snap_camera_pole"
  | "move_forward"
  | "move_back"
  | "move_left"
  | "move_right"
  | "move_up"
  | "move_down"
  | "rotate_left"
  | "rotate_right"
  | "flip"
  | "snap_to_wall"
  | "door_toggle_open_close"
  | "door_toggle_lock"
  | "window_toggle_open_close"
  | "wall_reverse"
  | "path_reverse";

export type ContextActionTone = "default" | "neutral" | "danger" | "accent";

export type ContextAction = {
  id: ContextActionId;
  label: string;
  hint?: string;
  tone?: ContextActionTone;
  enabled: boolean;
  disabledReason?: string;
};

export type ContextActionGroup = {
  id: string;
  label: string;
  actions: ContextAction[];
};

export type ContextMenuModel = {
  title: string;
  subtitle: string;
  accent: string;
  groups: ContextActionGroup[];
};

export type ContextActionPlan =
  | { kind: "none"; message?: string }
  | { kind: "patch"; patch: Partial<AnyEditableNode>; message?: string }
  | { kind: "duplicate"; message?: string }
  | { kind: "delete"; message?: string }
  | { kind: "focus"; point: [number, number]; message?: string }
  | { kind: "camera_view"; cameraId: string; message?: string };

export interface ContextActionPlanHandlers {
  patchNode: (nodeId: string, patch: Partial<AnyEditableNode>) => void;
  duplicateNode: (nodeId: string) => void;
  removeNode: (nodeId: string) => void;
  focusPoint: (point: [number, number]) => void;
  openCameraView: (cameraId: string) => void;
  showMessage: (message: string | null) => void;
}

/**
 * Canonical executor for a contextual action plan. Shared by the right-click
 * menu and the floating selection task bar so both surfaces apply identical
 * behavior for the same plan.
 */
export function applyContextActionPlan(
  nodeId: string,
  plan: ContextActionPlan,
  handlers: ContextActionPlanHandlers,
) {
  switch (plan.kind) {
    case "patch":
      handlers.patchNode(nodeId, plan.patch);
      break;
    case "duplicate":
      handlers.duplicateNode(nodeId);
      break;
    case "delete":
      handlers.removeNode(nodeId);
      break;
    case "focus":
      handlers.focusPoint(plan.point);
      break;
    case "camera_view":
      handlers.openCameraView(plan.cameraId);
      break;
    case "none":
    default:
      break;
  }
  handlers.showMessage(plan.message ?? null);
}

const MOVE_STEP_M = 0.25;
const HEIGHT_STEP_M = 0.15;
const ROTATE_STEP_DEG = 15;

function getNodeLabel(node: AnyEditableNode) {
  if ("name" in node) return node.name;
  if ("label" in node) return node.label;
  return "Object";
}

function getNodeKindLabel(node: AnyEditableNode) {
  switch (node.nodeType) {
    case "camera":
      return "Camera";
    case "security_light":
      return "Light";
    case "sensor":
      return "Sensor";
    case "obstruction":
      return "Obstruction";
    case "wall":
      return "Wall";
    case "door":
      return "Door";
    case "window":
      return "Window";
    case "critical_zone":
      return "Critical Zone";
    case "privacy_zone":
      return "Privacy Zone";
    case "entry_point":
      return "Entry Point";
    case "path":
      return "Path";
    default:
      return "Object";
  }
}

function getAccent(node: AnyEditableNode) {
  switch (node.nodeType) {
    case "camera":
      return "#60a5fa";
    case "security_light":
      return "#facc15";
    case "sensor":
      return "#22d3ee";
    case "obstruction":
      return "#fb923c";
    case "wall":
      return "#22c55e";
    case "door":
      return "#f59e0b";
    case "window":
      return "#8b5cf6";
    case "critical_zone":
      return "#34d399";
    case "privacy_zone":
      return "#a855f7";
    case "entry_point":
      return "#38bdf8";
    case "path":
      return "#f97316";
    default:
      return "#60a5fa";
  }
}

function getNodeAnchor(node: AnyEditableNode): [number, number] {
  switch (node.nodeType) {
    case "wall":
      return [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    case "critical_zone":
    case "privacy_zone": {
      const centroid = node.polygon.reduce(
        (acc, [x, z]) => {
          acc[0] += x;
          acc[1] += z;
          return acc;
        },
        [0, 0] as [number, number],
      );
      return [centroid[0] / Math.max(1, node.polygon.length), centroid[1] / Math.max(1, node.polygon.length)];
    }
    case "path": {
      const centroid = node.points.reduce(
        (acc, point) => {
          acc[0] += point.position[0];
          acc[1] += point.position[1];
          return acc;
        },
        [0, 0] as [number, number],
      );
      return [centroid[0] / Math.max(1, node.points.length), centroid[1] / Math.max(1, node.points.length)];
    }
    case "entry_point":
      return [node.position[0], node.position[1]];
    case "fence_segment":
    case "bollard_line":
      return [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    case "gate_node":
      return [node.position[0], node.position[1]];
    default:
      return [node.position[0], node.position[2]];
  }
}

function getSelectedCriticalZone(scene: SecurityScene, selectedNodeIds: string[]) {
  return scene.criticalZones.find((zone) => selectedNodeIds.includes(zone.id)) ?? null;
}

function getFallbackCriticalZone(scene: SecurityScene, selectedNodeIds: string[]) {
  return getSelectedCriticalZone(scene, selectedNodeIds) ?? scene.criticalZones[0] ?? null;
}

function moveVectorFromOrientation(angleDeg: number, direction: "forward" | "back" | "left" | "right") {
  const angle = (angleDeg * Math.PI) / 180;
  const forward: [number, number] = [Math.sin(angle), Math.cos(angle)];
  const right: [number, number] = [Math.cos(angle), -Math.sin(angle)];
  if (direction === "forward") return forward;
  if (direction === "back") return [-forward[0], -forward[1]];
  if (direction === "right") return right;
  return [-right[0], -right[1]];
}

function wallAxes(wall: WallNode) {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const length = Math.max(Number.EPSILON, Math.hypot(dx, dz));
  const tangent: [number, number] = [dx / length, dz / length];
  const normal: [number, number] = [-tangent[1], tangent[0]];
  return { tangent, normal };
}

function moveWallNode(scene: SecurityScene, node: WallNode, direction: "forward" | "back" | "left" | "right") {
  const { tangent, normal } = wallAxes(node);
  const axis = direction === "forward"
    ? normal
    : direction === "back"
      ? [-normal[0], -normal[1]]
      : direction === "right"
        ? tangent
        : [-tangent[0], -tangent[1]];
  const nextStart = clampToScene(
    [node.start[0] + axis[0] * MOVE_STEP_M, node.start[1] + axis[1] * MOVE_STEP_M],
    scene.dimensions.width,
    scene.dimensions.depth,
    0.05,
  );
  const nextEnd = clampToScene(
    [node.end[0] + axis[0] * MOVE_STEP_M, node.end[1] + axis[1] * MOVE_STEP_M],
    scene.dimensions.width,
    scene.dimensions.depth,
    0.05,
  );
  return {
    start: nextStart,
    end: nextEnd,
  };
}

function rotateWallNode(scene: SecurityScene, node: WallNode, deltaDeg: number) {
  const center: [number, number] = [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
  const currentAngle = Math.atan2(node.end[1] - node.start[1], node.end[0] - node.start[0]);
  const nextAngle = currentAngle + (deltaDeg * Math.PI) / 180;
  const halfLength = pointDistance(node.start, node.end) / 2;
  const dx = Math.cos(nextAngle) * halfLength;
  const dz = Math.sin(nextAngle) * halfLength;
  const nextStart = clampToScene([center[0] - dx, center[1] - dz], scene.dimensions.width, scene.dimensions.depth, 0.05);
  const nextEnd = clampToScene([center[0] + dx, center[1] + dz], scene.dimensions.width, scene.dimensions.depth, 0.05);
  return {
    start: nextStart,
    end: nextEnd,
  };
}

function moveDoorOrWindow(node: DoorNode | WindowNode, scene: SecurityScene, direction: "forward" | "back" | "left" | "right") {
  const nearest = nearestPointOnWall([node.position[0], node.position[2]], scene.walls);
  const wall = nearest.wallIndex >= 0 ? scene.walls[nearest.wallIndex] ?? null : null;
  const wallDirection = wall ? wallAxes(wall).tangent : [1, 0] as [number, number];
  const axis = direction === "forward"
    ? wallDirection
    : direction === "back"
      ? [-wallDirection[0], -wallDirection[1]]
      : direction === "right"
        ? [-wallDirection[1], wallDirection[0]]
        : [wallDirection[1], -wallDirection[0]];
  const moved = [
    node.position[0] + axis[0] * MOVE_STEP_M,
    node.position[1],
    node.position[2] + axis[1] * MOVE_STEP_M,
  ] as [number, number, number];
  const clamped = clampToScene([moved[0], moved[2]], scene.dimensions.width, scene.dimensions.depth, 0.05);
  const snapped = snapDoorWindowToWall({ ...node, position: [clamped[0], moved[1], clamped[1]] }, scene);
  return snapped ?? { position: [clamped[0], moved[1], clamped[1]] as [number, number, number] };
}

function moveNodePosition(scene: SecurityScene, node: AnyEditableNode, direction: "forward" | "back" | "left" | "right") {
  const moveAxis = (n: { position: [number, number, number] }, deltaX: number, deltaZ: number) => {
    const clamped = clampToScene(
      [n.position[0] + deltaX, n.position[2] + deltaZ],
      scene.dimensions.width,
      scene.dimensions.depth,
      0.05,
    );
    return {
      position: [clamped[0], n.position[1], clamped[1]] as [number, number, number],
    };
  };

  switch (node.nodeType) {
    case "camera": {
      const { yawDeg } = node;
      const vector = moveVectorFromOrientation(yawDeg, direction);
      return moveAxis(node, vector[0] * MOVE_STEP_M, vector[1] * MOVE_STEP_M);
    }
    case "obstruction": {
      const vector = moveVectorFromOrientation(node.rotationYDeg, direction);
      return moveAxis(node, vector[0] * MOVE_STEP_M, vector[1] * MOVE_STEP_M);
    }
    case "security_light": {
      const vector = "yawDeg" in node && typeof node.yawDeg === "number"
        ? moveVectorFromOrientation(node.yawDeg, direction)
        : direction === "forward"
          ? [0, -1]
          : direction === "back"
            ? [0, 1]
            : direction === "right"
              ? [1, 0]
              : [-1, 0];
      return moveAxis(node, vector[0] * MOVE_STEP_M, vector[1] * MOVE_STEP_M);
    }
    case "door":
    case "window":
      return moveDoorOrWindow(node, scene, direction);
    case "wall":
      return moveWallNode(scene, node, direction);
    case "critical_zone":
    case "privacy_zone": {
      const vector = direction === "forward"
        ? [0, -1]
        : direction === "back"
          ? [0, 1]
          : direction === "right"
            ? [1, 0]
            : [-1, 0];
      return {
        polygon: node.polygon.map(([x, z]) => clampToScene(
          [x + vector[0] * MOVE_STEP_M, z + vector[1] * MOVE_STEP_M],
          scene.dimensions.width,
          scene.dimensions.depth,
          0.05,
        )),
      };
    }
    case "path": {
      const vector = direction === "forward"
        ? [0, -1]
        : direction === "back"
          ? [0, 1]
          : direction === "right"
            ? [1, 0]
            : [-1, 0];
      return {
        points: node.points.map((point) => ({
          ...point,
          position: clampToScene(
            [point.position[0] + vector[0] * MOVE_STEP_M, point.position[1] + vector[1] * MOVE_STEP_M],
            scene.dimensions.width,
            scene.dimensions.depth,
            0.05,
          ),
        })),
      };
    }
    case "entry_point":
      return {
        position: clampToScene(
          [
            node.position[0] + (direction === "right" ? MOVE_STEP_M : direction === "left" ? -MOVE_STEP_M : 0),
            node.position[1] + (direction === "back" ? MOVE_STEP_M : direction === "forward" ? -MOVE_STEP_M : 0),
          ],
          scene.dimensions.width,
          scene.dimensions.depth,
          0.05,
        ) as [number, number],
      };
    default:
      return {};
  }
}

function moveUpDown(node: AnyEditableNode, direction: "up" | "down") {
  const delta = direction === "up" ? HEIGHT_STEP_M : -HEIGHT_STEP_M;

  switch (node.nodeType) {
    case "camera":
      return {
        position: [node.position[0], Math.max(0.4, node.position[1] + delta), node.position[2]] as [number, number, number],
        mountHeightM: Math.max(0.4, node.mountHeightM + delta),
      };
    case "security_light":
      return {
        position: [node.position[0], Math.max(0.3, node.position[1] + delta), node.position[2]] as [number, number, number],
      };
    case "obstruction":
      return {
        position: [node.position[0], Math.max(0.2, node.position[1] + delta), node.position[2]] as [number, number, number],
      };
    case "door":
    case "window":
      return {
        position: [node.position[0], Math.max(0.2, node.position[1] + delta), node.position[2]] as [number, number, number],
      };
    case "wall":
      return {
        heightM: Math.max(1.2, node.heightM + delta),
      };
    case "entry_point":
      return {
        position: [node.position[0], Math.max(0, node.position[1] + delta)] as [number, number],
      };
    default:
      return {};
  }
}

function rotateNode(scene: SecurityScene, node: AnyEditableNode, direction: "left" | "right") {
  const delta = direction === "left" ? -ROTATE_STEP_DEG : ROTATE_STEP_DEG;
  switch (node.nodeType) {
    case "camera":
      return { yawDeg: node.yawDeg + delta };
    case "obstruction":
      return { rotationYDeg: node.rotationYDeg + delta };
    case "security_light":
      return typeof node.yawDeg === "number" ? { yawDeg: (node.yawDeg ?? 0) + delta } : {};
    case "wall":
      return rotateWallNode(scene, node, delta);
    default:
      return {};
  }
}

function flipNode(node: AnyEditableNode) {
  switch (node.nodeType) {
    case "camera":
      return { yawDeg: node.yawDeg + 180 };
    case "obstruction":
      return { rotationYDeg: node.rotationYDeg + 180 };
    case "security_light":
      return typeof node.yawDeg === "number" ? { yawDeg: (node.yawDeg ?? 0) + 180 } : {};
    case "wall":
      return { start: node.end, end: node.start };
    case "path":
      return { points: [...node.points].reverse() };
    default:
      return {};
  }
}

function toggleDoorState(node: DoorNode): Partial<DoorNode> {
  if (node.state === "open") return { state: "closed" };
  return { state: "open" };
}

function toggleDoorLock(node: DoorNode): Partial<DoorNode> {
  if (node.state === "locked") return { state: "closed" };
  return { state: "locked" };
}

function toggleWindowState(node: WindowNode): Partial<WindowNode> {
  if (node.state === "open") return { state: "closed_glass" };
  return { state: "open" };
}

export function findContextualNode(scene: SecurityScene, nodeId: string) {
  return [
    ...scene.cameras,
    ...scene.securityLights,
    ...scene.sensors,
    ...scene.obstructions,
    ...scene.walls,
    ...scene.doors,
    ...scene.windows,
    ...scene.criticalZones,
    ...scene.privacyZones,
    ...scene.entryPoints,
    ...scene.paths,
  ].find((node) => node.id === nodeId) ?? null;
}

export function buildContextualMenuModel(
  scene: SecurityScene,
  node: AnyEditableNode,
  selectedNodeIds: string[],
): ContextMenuModel {
  const title = getNodeLabel(node);
  const subtitle = getNodeKindLabel(node);
  const accent = getAccent(node);
  const selectedZone = getSelectedCriticalZone(scene, selectedNodeIds);

  const moveGroup: ContextAction[] = [];
  moveGroup.push(
    { id: "move_forward", label: "Front", hint: "W", enabled: true },
    { id: "move_back", label: "Back", hint: "S", enabled: true },
    { id: "move_left", label: "Left", hint: "A", enabled: true },
    { id: "move_right", label: "Right", hint: "D", enabled: true },
  );

  const verticalGroup: ContextAction[] = [];
  if (node.nodeType === "camera" || node.nodeType === "security_light" || node.nodeType === "obstruction" || node.nodeType === "door" || node.nodeType === "window" || node.nodeType === "entry_point") {
    verticalGroup.push(
      { id: "move_up", label: "Up", hint: "R", enabled: true },
      { id: "move_down", label: "Down", hint: "F", enabled: true },
    );
  }

  const rotateGroup: ContextAction[] = [];
  if (["camera", "security_light", "obstruction", "wall"].includes(node.nodeType)) {
    rotateGroup.push(
      { id: "rotate_left", label: "Rotate", hint: "Q", enabled: true },
      { id: "rotate_right", label: "Rotate", hint: "E", enabled: true },
      { id: "flip", label: "Flip", hint: "X", enabled: true },
    );
  }

  const alignGroup: ContextAction[] = [];
  if (node.nodeType === "camera") {
    alignGroup.push(
      {
        id: "snap_camera_wall",
        label: "Wall Mount",
        enabled: scene.walls.length > 0,
        disabledReason: "No walls available",
      },
      {
        id: "snap_camera_ceiling",
        label: "Ceiling Mount",
        enabled: true,
      },
      {
        id: "snap_camera_pole",
        label: "Pole Mount",
        enabled: scene.obstructions.some((obstruction) => obstruction.obstructionType === "pillar" || obstruction.label.toLowerCase().includes("pillar")),
        disabledReason: "No pillar available",
      },
      {
        id: "aim_at_selected_zone",
        label: "Aim at Zone",
        enabled: scene.criticalZones.length > 0,
        disabledReason: "No critical zones in scene",
      },
      { id: "open_camera_view", label: "Open Camera", enabled: true },
    );
  }

  if (node.nodeType === "door" || node.nodeType === "window") {
    alignGroup.push({
      id: "snap_to_wall",
      label: "Snap to Wall",
      enabled: scene.walls.length > 0,
      disabledReason: "No walls available",
    });
  }

  const stateGroup: ContextAction[] = [];
  if (node.nodeType === "door") {
    stateGroup.push(
      { id: "door_toggle_open_close", label: node.state === "open" ? "Close Door" : "Open Door", enabled: true },
      { id: "door_toggle_lock", label: node.state === "locked" ? "Unlock Door" : "Lock Door", enabled: true },
    );
  }

  if (node.nodeType === "window") {
    stateGroup.push(
      { id: "window_toggle_open_close", label: node.state === "open" ? "Close Window" : "Open Window", enabled: true },
    );
  }

  const structureGroup: ContextAction[] = [];
  if (node.nodeType === "wall") {
    structureGroup.push({ id: "wall_reverse", label: "Flip Ends", enabled: true });
  }
  if (node.nodeType === "path") {
    structureGroup.push({ id: "path_reverse", label: "Reverse Path", enabled: true });
  }

  const sceneGroup: ContextAction[] = [
    { id: "focus", label: "Focus", enabled: true },
    { id: "duplicate", label: "Duplicate", hint: "Cmd/Ctrl+D", enabled: true },
    { id: "delete", label: "Delete", hint: "Del", tone: "danger", enabled: true },
  ];

  const groups: ContextActionGroup[] = [
    ...(moveGroup.length > 0 ? [{ id: "move", label: "Move", actions: moveGroup }] : []),
    ...(verticalGroup.length > 0 ? [{ id: "height", label: "Height", actions: verticalGroup }] : []),
    ...(rotateGroup.length > 0 ? [{ id: "rotate", label: "Rotate", actions: rotateGroup }] : []),
    ...(alignGroup.length > 0 ? [{ id: "align", label: "Align", actions: alignGroup }] : []),
    ...(stateGroup.length > 0 ? [{ id: "state", label: "State", actions: stateGroup }] : []),
    ...(structureGroup.length > 0 ? [{ id: "structure", label: "Structure", actions: structureGroup }] : []),
    { id: "scene", label: "Scene", actions: sceneGroup },
  ];

  return { title, subtitle, accent, groups };
}

export function planContextualAction(
  scene: SecurityScene,
  node: AnyEditableNode,
  actionId: ContextActionId,
  selectedNodeIds: string[],
): ContextActionPlan {
  switch (actionId) {
    case "focus":
      return { kind: "focus", point: getNodeAnchor(node), message: `Focused ${getNodeKindLabel(node).toLowerCase()}` };
    case "duplicate":
      return { kind: "duplicate", message: `Duplicated ${getNodeKindLabel(node).toLowerCase()}` };
    case "delete":
      return { kind: "delete", message: `Deleted ${getNodeKindLabel(node).toLowerCase()}` };
    case "open_camera_view":
      return node.nodeType === "camera"
        ? { kind: "camera_view", cameraId: node.id, message: "Opened camera view" }
        : { kind: "none" };
    case "aim_at_selected_zone": {
      if (node.nodeType !== "camera") return { kind: "none" };
      const zone = getFallbackCriticalZone(scene, selectedNodeIds);
      if (!zone) return { kind: "none", message: "Select a critical zone first" };
      const centroid = zone.polygon.reduce(
        (acc, [x, z]) => {
          acc[0] += x;
          acc[1] += z;
          return acc;
        },
        [0, 0] as [number, number],
      );
      const point: [number, number] = [centroid[0] / zone.polygon.length, centroid[1] / zone.polygon.length];
      const yaw = Math.atan2(point[0] - node.position[0], point[1] - node.position[2]) * (180 / Math.PI);
      return {
        kind: "patch",
        patch: { yawDeg: Math.round(yaw), pitchDeg: -30 },
        message: `Aimed at ${zone.label}`,
      };
    }
    case "snap_camera_wall":
    case "snap_camera_ceiling":
    case "snap_camera_pole": {
      if (node.nodeType !== "camera") return { kind: "none" };
      const mode = actionId === "snap_camera_wall" ? "wall" : actionId === "snap_camera_ceiling" ? "ceiling" : "pole";
      const patch = snapCameraToMount(node, scene, mode as CameraMountSnapMode);
      return patch ? { kind: "patch", patch, message: `Snapped to ${mode} mount` } : { kind: "none", message: `No ${mode} mount available` };
    }
    case "snap_to_wall": {
      if (node.nodeType !== "door" && node.nodeType !== "window") return { kind: "none" };
      const patch = snapDoorWindowToWall(node, scene);
      return patch ? { kind: "patch", patch, message: "Snapped to nearest wall" } : { kind: "none", message: "No wall available" };
    }
    case "move_forward":
    case "move_back":
    case "move_left":
    case "move_right":
    case "move_up":
    case "move_down": {
      if (actionId === "move_up" || actionId === "move_down") {
        const patch = moveUpDown(node, actionId === "move_up" ? "up" : "down");
        return { kind: "patch", patch, message: `${getNodeKindLabel(node)} moved ${actionId === "move_up" ? "up" : "down"}` };
      }

      const direction = actionId === "move_forward"
        ? "forward"
        : actionId === "move_back"
          ? "back"
          : actionId === "move_right"
            ? "right"
            : "left";
      const patch = moveNodePosition(scene, node, direction);
      if (node.nodeType === "door" || node.nodeType === "window") {
        const snapped = snapDoorWindowToWall({ ...node, ...patch } as DoorNode | WindowNode, scene);
        return { kind: "patch", patch: snapped ?? patch, message: `${getNodeKindLabel(node)} nudged ${direction}` };
      }
      return { kind: "patch", patch, message: `${getNodeKindLabel(node)} nudged ${direction}` };
    }
    case "rotate_left":
    case "rotate_right": {
      const patch = rotateNode(scene, node, actionId === "rotate_left" ? "left" : "right");
      return { kind: "patch", patch, message: `${getNodeKindLabel(node)} rotated ${actionId === "rotate_left" ? "left" : "right"}` };
    }
    case "flip": {
      const patch = flipNode(node);
      return { kind: "patch", patch, message: `${getNodeKindLabel(node)} flipped` };
    }
    case "door_toggle_open_close":
      return node.nodeType === "door"
        ? { kind: "patch", patch: toggleDoorState(node), message: node.state === "open" ? "Door closed" : "Door opened" }
        : { kind: "none" };
    case "door_toggle_lock":
      return node.nodeType === "door"
        ? { kind: "patch", patch: toggleDoorLock(node), message: node.state === "locked" ? "Door unlocked" : "Door locked" }
        : { kind: "none" };
    case "window_toggle_open_close":
      return node.nodeType === "window"
        ? { kind: "patch", patch: toggleWindowState(node), message: node.state === "open" ? "Window closed" : "Window opened" }
        : { kind: "none" };
    case "wall_reverse":
      return node.nodeType === "wall"
        ? { kind: "patch", patch: { start: node.end, end: node.start }, message: "Wall reversed" }
        : { kind: "none" };
    case "path_reverse":
      return node.nodeType === "path"
        ? { kind: "patch", patch: { points: [...node.points].reverse() }, message: "Path reversed" }
        : { kind: "none" };
    default:
      return { kind: "none" };
  }
}
