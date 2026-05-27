import { create } from "zustand";

import { createSmallRetailShopScene, smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import {
  type AnyEditableNode,
  type CameraNode,
  type CriticalZoneNode,
  type SecurityScene,
  type SimulationResult,
  type SceneSnapshot,
  cloneSecurityScene,
  parseSecurityScene,
  safeParseSecurityScene,
} from "@/schema/security-scene";
import { simulateStudio } from "@/simulation/simulate-studio";
import { computeTemporalProfile } from "@/simulation/temporal";
import type { TemporalSecurityProfile } from "@/schema/security-scene";

export type ViewMode = "map" | "wall" | "replay" | "camera_view" | "compare";
export type DockSide = "left" | "right" | "bottom";
export type WorkspacePreset =
  | "edit"
  | "coverage"
  | "camera_wall"
  | "replay"
  | "compare"
  | "report"
  | "debug"
  | "focus";

type DockSnapshot = {
  workspacePreset: WorkspacePreset;
  leftDockCollapsed: boolean;
  rightDockCollapsed: boolean;
  bottomDockCollapsed: boolean;
  leftDockSizePx: number;
  rightDockSizePx: number;
  bottomDockSizePx: number;
};

export type ActiveTool =
  | "select" | "camera" | "obstruction" | "light"
  | "path" | "zone" | "door_window" | "wall" | "measure" | "comment";

export type EditorMode =
  | "idle"
  | "placing"
  | "drawing_wall"
  | "drawing_polygon"
  | "drawing_path"
  | "transforming";

export type EditorDraft = {
  editorMode: EditorMode;
  draftWallStart?: [number, number];
  draftPolygonPoints: [number, number][];
  draftPathPoints: [number, number][];
  hoverPoint?: [number, number];
  snapEnabled: boolean;
  snapDistanceM: number;
  gridSnapM: number;
  selectedHandle?: string;
};

export type BottomTab = "metrics" | "issues" | "timeline" | "beforeafter" | "report" | "debug" | "counterfactual" | "threat" | "redundancy" | "temporal" | "assumptions";

export type InspectorTab = "properties" | "view" | "status" | "analytics" | "failures";

export type LayerId =
  | "cameras" | "camera_cones" | "obstructions" | "lights"
  | "critical_zones" | "privacy_zones" | "paths" | "heatmap"
  | "grid" | "walls_floors" | "labels";

export type LayerVisibility = Record<LayerId, boolean>;

type MapViewportTarget = "minimap" | "pathMap";

export type MapViewportState = {
  zoom: number;
  pan: [number, number];
};

export type MapState = {
  minimap: MapViewportState;
  pathMap: MapViewportState;
};

const DEFAULT_MAP_STATE: MapState = {
  minimap: { zoom: 1, pan: [0, 0] },
  pathMap: { zoom: 1, pan: [0, 0] },
};

function cloneDefaultMapState(): MapState {
  return {
    minimap: { zoom: DEFAULT_MAP_STATE.minimap.zoom, pan: [...DEFAULT_MAP_STATE.minimap.pan] as [number, number] },
    pathMap: { zoom: DEFAULT_MAP_STATE.pathMap.zoom, pan: [...DEFAULT_MAP_STATE.pathMap.pan] as [number, number] },
  };
}

export type FocusScenePointRequest = {
  point: [number, number];
  source: MapViewportTarget;
};

const SCENE_STORAGE_KEY = "sentineltwin_saved_scenes";

function loadSavedScenesFromStorage(): SecurityScene[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCENE_STORAGE_KEY);
    if (!raw) return [];
    const scenes = JSON.parse(raw);
    if (!Array.isArray(scenes)) return [];
    // Validate each scene — keep only valid ones
    return scenes.filter((s: unknown) => {
      const result = safeParseSecurityScene(s);
      return result.success;
    });
  } catch {
    return [];
  }
}

function appendSavedScene(scene: SecurityScene) {
  const scenes = loadSavedScenesFromStorage();
  // Replace if same id exists, else append
  const idx = scenes.findIndex((s) => s.id === scene.id);
  const cloned = cloneSecurityScene(scene);
  if (idx >= 0) {
    scenes[idx] = cloned;
  } else {
    scenes.push(cloned);
  }
  try {
    localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(scenes));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

function removeSavedScene(sceneId: string) {
  const scenes = loadSavedScenesFromStorage().filter((s) => s.id !== sceneId);
  try {
    localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(scenes));
  } catch {
    // silently fail
  }
}

export type StudioStoreState = {
  scene: SecurityScene;
  simulationResult: SimulationResult | null;
  simulationDirty: boolean;
  simulationRunning: boolean;
  snapshots: SceneSnapshot[];
  lastRunMs: number | null;
  savedScenes: SecurityScene[];

  selectedNodeId: string | null;
  selectedNodeIds: string[];
  activeTool: ActiveTool;
  editor: EditorDraft;
  bottomTab: BottomTab;
  inspectorTab: InspectorTab;
  workspacePreset: WorkspacePreset;
  focusMode: boolean;
  leftDockCollapsed: boolean;
  rightDockCollapsed: boolean;
  bottomDockCollapsed: boolean;
  leftDockSizePx: number;
  rightDockSizePx: number;
  bottomDockSizePx: number;
  previousLayout: DockSnapshot | null;
  layerVisibility: LayerVisibility;
  heatmapMode: "quality" | "fragility";
  environmentMode: "day" | "night" | "dusk";
  showDebugOverlays: boolean;
  autoRecompute: boolean;
  temporalProfile: TemporalSecurityProfile | null;
  temporalScrubHour: number;
  temporalScrubMinute: number;
  activePathId: string | null;
  mapState: MapState;
  hoveredMapNodeId: string | null;
  focusScenePointRequest: FocusScenePointRequest | null;
  setTemporalProfile: (profile: TemporalSecurityProfile | null) => void;
  setTemporalScrub: (hour: number, minute: number) => void;
  computeTemporalProfile: () => void;
  demoMode: boolean;
  demoStep: number;
  setDemoMode: (active: boolean) => void;
  setDemoStep: (step: number) => void;

  pathReplay: { playing: boolean; progress: number; speed: number; followActor: boolean };
  setPathReplayPlaying: (playing: boolean) => void;
  setPathReplayProgress: (progress: number) => void;
  setPathReplaySpeed: (speed: number) => void;
  setPathReplayFollowActor: (followActor: boolean) => void;
  setActivePathId: (id: string | null) => void;
  setMapZoom: (target: MapViewportTarget, zoom: number) => void;
  setMapPan: (target: MapViewportTarget, pan: [number, number]) => void;
  fitMap: (target: MapViewportTarget) => void;
  setHoveredMapNodeId: (id: string | null) => void;
  setFocusScenePointRequest: (request: FocusScenePointRequest | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  setDraftWallStart: (start?: [number, number]) => void;
  setDraftPolygonPoints: (points: [number, number][]) => void;
  setDraftPathPoints: (points: [number, number][]) => void;
  setEditorHoverPoint: (point?: [number, number]) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapDistanceM: (value: number) => void;
  setGridSnapM: (value: number) => void;
  setSelectedHandle: (handle?: string) => void;
  cameraPresetId: string | null;
  setCameraPresetId: (presetId: string | null) => void;
  setSelectedNodes: (ids: string[]) => void;
  addSelectedNode: (id: string) => void;
  toggleSelectedNode: (id: string) => void;
  clearSelection: () => void;
  translateSelectedNodes: (delta: [number, number]) => void;
  removeSelectedNodes: (ids?: string[]) => void;

  selectNode: (id: string | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  setWorkspacePreset: (preset: WorkspacePreset) => void;
  toggleDock: (side: DockSide) => void;
  setDockCollapsed: (side: DockSide, collapsed: boolean) => void;
  setDockSize: (side: DockSide, sizePx: number) => void;
  enterFocusMode: () => void;
  restorePreviousLayout: () => void;

  setActiveTool: (tool: ActiveTool) => void;
  setBottomTab: (tab: BottomTab) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  toggleLayer: (layer: LayerId) => void;
  setLayerVisibility: (layer: LayerId, visible: boolean) => void;
  setHeatmapMode: (mode: "quality" | "fragility") => void;
  setEnvironmentMode: (mode: "day" | "night" | "dusk") => void;
  setAllZoneTargetTypes: (targetType: CriticalZoneNode["targetType"]) => void;
  toggleAutoRecompute: () => void;

  addNode: (node: AnyEditableNode) => void;
  updateNode: (id: string, patch: Partial<AnyEditableNode>) => void;
  duplicateNode: (id: string) => void;
  removeNode: (id: string) => void;
  updateAssumptions: (patch: Partial<import("@/schema/security-scene").SimulationAssumptions>) => void;

  commitSceneChange: (updater: (scene: SecurityScene) => SecurityScene, label?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  historyPast: SecurityScene[];
  historyFuture: SecurityScene[];

  setSimulationRunning: (running: boolean) => void;
  setSimulationResult: (result: SimulationResult, durationMs: number) => void;
  markDirty: () => void;

  counterfactualResult: SimulationResult | null;
  counterfactualObsId: string | null;
  runCounterfactual: (obstructionId: string) => void;
  clearCounterfactual: () => void;

  addSnapshot: (label: string, result: SimulationResult) => void;
  saveSnapshot: (label: string) => void;
  importScene: (json: unknown) => { success: boolean; error?: string };
  exportScene: () => SecurityScene;

  // Scene management
  setScene: (scene: SecurityScene) => void;
  createNewScene: () => void;
  saveSceneToStorage: () => void;
  loadScenesFromStorage: () => SecurityScene[];
  refreshSavedScenesList: () => void;
  deleteSavedScene: (sceneId: string) => void;
  getSceneStorageKey: () => string;

  getSelectedCamera: () => CameraNode | null;
};

const collectionKeys = [
  "walls", "doors", "windows", "cameras", "securityLights",
  "obstructions", "criticalZones", "privacyZones", "entryPoints", "paths",
] as const;

function patchNode(scene: SecurityScene, id: string, patch: Partial<AnyEditableNode>): SecurityScene {
  const next = cloneSecurityScene(scene);
  for (const key of collectionKeys) {
    const idx = next[key].findIndex((n) => n.id === id);
    if (idx !== -1) {
      (next as unknown as Record<string, AnyEditableNode[]>)[key][idx] = { ...(next[key][idx] as AnyEditableNode), ...patch } as unknown as AnyEditableNode;
      next.updatedAt = Date.now();
      return next;
    }
  }
  return next;
}

function removeNode(scene: SecurityScene, id: string): SecurityScene {
  const next = cloneSecurityScene(scene);
  for (const key of collectionKeys) {
    const before = next[key].length;
    (next[key] as AnyEditableNode[]) = next[key].filter((n) => n.id !== id) as typeof next[typeof key];
    if (next[key].length !== before) { next.updatedAt = Date.now(); return next; }
  }
  return next;
}

function insertNode(scene: SecurityScene, node: AnyEditableNode): SecurityScene {
  const next = cloneSecurityScene(scene);
  switch (node.nodeType) {
    case "wall":           next.walls.push(node);           break;
    case "door":           next.doors.push(node);           break;
    case "window":         next.windows.push(node);         break;
    case "camera":         next.cameras.push(node);         break;
    case "security_light": next.securityLights.push(node);  break;
    case "obstruction":    next.obstructions.push(node);    break;
    case "critical_zone":  next.criticalZones.push(node);   break;
    case "privacy_zone":   next.privacyZones.push(node);    break;
    case "entry_point":    next.entryPoints.push(node);     break;
    case "path":           next.paths.push(node);           break;
  }
  next.updatedAt = Date.now();
  return next;
}

function duplicateNodeInScene(scene: SecurityScene, id: string): { scene: SecurityScene; duplicatedId: string | null } {
  const next = cloneSecurityScene(scene);
  const duplicateOffset = [0.4, 0.4] as const;
  const prefixMap: Record<AnyEditableNode["nodeType"], string> = {
    camera: "cam",
    obstruction: "obs",
    security_light: "light",
    wall: "wall",
    door: "door",
    window: "window",
    critical_zone: "zone",
    privacy_zone: "privacy",
    entry_point: "entry",
    path: "path",
  };

  const makeDuplicateId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const duplicateScenePoint = (point: [number, number]) => [point[0] + duplicateOffset[0], point[1] + duplicateOffset[1]] as [number, number];
  const duplicateScenePoint3 = (point: [number, number, number]) => [point[0] + duplicateOffset[0], point[1], point[2] + duplicateOffset[1]] as [number, number, number];

  for (const key of collectionKeys) {
    const index = next[key].findIndex((entry) => entry.id === id);
    if (index === -1) continue;

    const original = structuredClone(next[key][index] as AnyEditableNode);
    const duplicatedId = makeDuplicateId(prefixMap[original.nodeType]);
    const duplicate = original as AnyEditableNode;

    if ("label" in duplicate && typeof duplicate.label === "string") {
      duplicate.label = duplicate.label.endsWith(" Copy") ? duplicate.label : `${duplicate.label} Copy`;
    }
    if ("name" in duplicate && typeof duplicate.name === "string") {
      duplicate.name = duplicate.name.endsWith(" Copy") ? duplicate.name : `${duplicate.name} Copy`;
    }

    switch (duplicate.nodeType) {
      case "camera":
      case "security_light":
      case "obstruction":
      case "door":
      case "window":
      case "entry_point":
        duplicate.position = duplicateScenePoint3((duplicate as { position: [number, number, number] }).position);
        break;
      case "wall":
        duplicate.start = duplicateScenePoint((duplicate as { start: [number, number] }).start);
        duplicate.end = duplicateScenePoint((duplicate as { end: [number, number] }).end);
        break;
      case "critical_zone":
      case "privacy_zone":
        duplicate.polygon = (duplicate as { polygon: [number, number][] }).polygon.map(duplicateScenePoint);
        break;
      case "path":
        duplicate.points = (duplicate as { points: { position: [number, number] }[] }).points.map((point) => ({
          ...point,
          position: duplicateScenePoint(point.position),
        }));
        break;
    }

    if ("source" in duplicate) {
      duplicate.source = "manual";
    }
    duplicate.id = duplicatedId;
    (next[key] as unknown as AnyEditableNode[]).push(duplicate as AnyEditableNode);
    next.updatedAt = Date.now();
    return { scene: next, duplicatedId };
  }

  return { scene: next, duplicatedId: null };
}

function duplicateNodesInScene(scene: SecurityScene, ids: string[]): { scene: SecurityScene; duplicatedIds: string[] } {
  let next = cloneSecurityScene(scene);
  const duplicatedIds: string[] = [];

  ids.forEach((id) => {
    const result = duplicateNodeInScene(next, id);
    next = result.scene;
    if (result.duplicatedId) {
      duplicatedIds.push(result.duplicatedId);
    }
  });

  return { scene: next, duplicatedIds };
}

function sceneNodeIds(scene: SecurityScene) {
  return [
    ...scene.walls,
    ...scene.doors,
    ...scene.windows,
    ...scene.cameras,
    ...scene.securityLights,
    ...scene.obstructions,
    ...scene.criticalZones,
    ...scene.privacyZones,
    ...scene.entryPoints,
    ...scene.paths,
  ].map((entry) => entry.id);
}

function purgeInvalidSelection(scene: SecurityScene, selectedNodeIds: string[]) {
  const ids = new Set(sceneNodeIds(scene));
  return selectedNodeIds.filter((id) => ids.has(id));
}

function primarySelection(selectedNodeIds: string[]) {
  return selectedNodeIds[0] ?? null;
}

function setSelectionState(scene: SecurityScene, selectedNodeIds: string[]) {
  const next = purgeInvalidSelection(scene, selectedNodeIds);
  return {
    selectedNodeIds: next,
    selectedNodeId: primarySelection(next),
  };
}

function translateNode(node: AnyEditableNode, delta: [number, number]): AnyEditableNode {
  const [dx, dz] = delta;
  const next = structuredClone(node) as AnyEditableNode;

  if (next.nodeType === "camera" || next.nodeType === "security_light" || next.nodeType === "obstruction" || next.nodeType === "door" || next.nodeType === "window") {
    next.position = [next.position[0] + dx, next.position[1], next.position[2] + dz] as typeof next.position;
    return next;
  }

  if (next.nodeType === "entry_point") {
    next.position = [next.position[0] + dx, next.position[1] + dz];
    return next;
  }

  if (next.nodeType === "wall") {
    next.start = [next.start[0] + dx, next.start[1] + dz];
    next.end = [next.end[0] + dx, next.end[1] + dz];
    return next;
  }

  if (next.nodeType === "critical_zone" || next.nodeType === "privacy_zone") {
    next.polygon = next.polygon.map(([x, z]) => [x + dx, z + dz]);
    return next;
  }

  if (next.nodeType === "path") {
    next.points = next.points.map((point) => ({
      ...point,
      position: [point.position[0] + dx, point.position[1] + dz] as [number, number],
    }));
    return next;
  }

  return next;
}

function translateNodesInScene(scene: SecurityScene, ids: string[], delta: [number, number]): SecurityScene {
  const next = cloneSecurityScene(scene);
  const idSet = new Set(ids);
  const collections: Array<keyof Pick<SecurityScene, "walls" | "doors" | "windows" | "cameras" | "securityLights" | "obstructions" | "criticalZones" | "privacyZones" | "entryPoints" | "paths">> = [
    "walls",
    "doors",
    "windows",
    "cameras",
    "securityLights",
    "obstructions",
    "criticalZones",
    "privacyZones",
    "entryPoints",
    "paths",
  ];

  collections.forEach((key) => {
    next[key] = next[key].map((node) => (idSet.has(node.id) ? translateNode(node as AnyEditableNode, delta) : node)) as never;
  });

  next.updatedAt = Date.now();
  return next;
}

function cloneAndSetActivePath(scene: SecurityScene, activePathId: string | null): string | null {
  if (!activePathId) return null;
  return scene.paths.some((path) => path.id === activePathId) ? activePathId : null;
}

const DEFAULT_LAYERS: LayerVisibility = {
  cameras: true, camera_cones: true, obstructions: true, lights: true,
  critical_zones: true, privacy_zones: true, paths: true, heatmap: true,
  grid: true, walls_floors: true, labels: true,
};

const DEFAULT_DOCK_SIZES = {
  left: 248,
  right: 344,
  bottom: 360,
} as const;

const PRESET_LAYOUTS: Record<WorkspacePreset, Omit<DockSnapshot, "workspacePreset">> = {
  edit: {
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: DEFAULT_DOCK_SIZES.right,
    bottomDockSizePx: 360,
  },
  coverage: {
    leftDockCollapsed: true,
    rightDockCollapsed: true,
    bottomDockCollapsed: true,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 372,
    bottomDockSizePx: 40,
  },
  camera_wall: {
    leftDockCollapsed: true,
    rightDockCollapsed: true,
    bottomDockCollapsed: true,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: DEFAULT_DOCK_SIZES.right,
    bottomDockSizePx: 40,
  },
  replay: {
    leftDockCollapsed: true,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 360,
    bottomDockSizePx: 360,
  },
  compare: {
    leftDockCollapsed: true,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 368,
    bottomDockSizePx: 360,
  },
  report: {
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 368,
    bottomDockSizePx: 360,
  },
  debug: {
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 368,
    bottomDockSizePx: 360,
  },
  focus: {
    leftDockCollapsed: true,
    rightDockCollapsed: true,
    bottomDockCollapsed: true,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: DEFAULT_DOCK_SIZES.right,
    bottomDockSizePx: 40,
  },
};

const VIEW_MODE_PRESETS: Record<ViewMode, WorkspacePreset> = {
  map: "edit",
  wall: "camera_wall",
  replay: "replay",
  camera_view: "coverage",
  compare: "compare",
};

const clampDockSize = (side: DockSide, sizePx: number) => {
  const min = side === "bottom" ? 160 : 180;
  const max = side === "bottom" ? 480 : 520;
  return Math.max(min, Math.min(max, Math.round(sizePx)));
};

function snapshotLayout(state: Pick<
  StudioStoreState,
  | "workspacePreset"
  | "leftDockCollapsed"
  | "rightDockCollapsed"
  | "bottomDockCollapsed"
  | "leftDockSizePx"
  | "rightDockSizePx"
  | "bottomDockSizePx"
>): DockSnapshot {
  return {
    workspacePreset: state.workspacePreset,
    leftDockCollapsed: state.leftDockCollapsed,
    rightDockCollapsed: state.rightDockCollapsed,
    bottomDockCollapsed: state.bottomDockCollapsed,
    leftDockSizePx: state.leftDockSizePx,
    rightDockSizePx: state.rightDockSizePx,
    bottomDockSizePx: state.bottomDockSizePx,
  };
}

function dockSizeKey(side: DockSide) {
  return side === "left"
    ? "leftDockSizePx"
    : side === "right"
      ? "rightDockSizePx"
      : "bottomDockSizePx";
}

function dockCollapsedKey(side: DockSide) {
  return side === "left"
    ? "leftDockCollapsed"
    : side === "right"
      ? "rightDockCollapsed"
      : "bottomDockCollapsed";
}

const DEMO_SNAPSHOT_BASE_TS = smallRetailShopScene.createdAt + 18 * 60_000;

function createSnapshotVariant(
  label: string,
  minutesAgo: number,
  mutate?: (scene: SecurityScene) => void,
): SceneSnapshot {
  const scene = createSmallRetailShopScene();
  mutate?.(scene);
  const simulation = simulateStudio(scene);
  scene.simulation = simulation;
  scene.updatedAt = DEMO_SNAPSHOT_BASE_TS - minutesAgo * 60_000;

  return {
    id: `snap_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    label,
    createdAt: DEMO_SNAPSHOT_BASE_TS - minutesAgo * 60_000,
    scene: cloneSecurityScene(scene),
    simulation,
  };
}

function buildDemoSnapshots() {
  const movePrimaryObstruction = (scene: SecurityScene) => {
    const target =
      scene.obstructions.find((obs) => obs.id === "obs_cupboard_blocker")
      ?? scene.obstructions.find((obs) => obs.movable)
      ?? scene.obstructions[0];
    if (target) {
      target.position = [3.2, target.position[1], 2.4];
    }
  };

  return [
    createSnapshotVariant("Baseline", 18),
    createSnapshotVariant("Moved Obstruction", 14, movePrimaryObstruction),
    createSnapshotVariant("Cam 2 Rotated", 10, (scene) => {
      const cam2 = scene.cameras.find((camera) => camera.id === "cam_counter");
      if (cam2) {
        cam2.yawDeg = 305;
        cam2.pitchDeg = -20;
      }
    }),
    createSnapshotVariant("Night Mode", 7, (scene) => {
      scene.assumptions.timeOfDay = "night";
    }),
  ];
}

const INITIAL_SNAPSHOTS = buildDemoSnapshots();
const INITIAL_SCENE = createSmallRetailShopScene();
INITIAL_SCENE.snapshots = INITIAL_SNAPSHOTS.map((snapshot) => ({
  ...snapshot,
  scene: structuredClone(snapshot.scene),
}));

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "map";
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "wall" || mode === "replay" || mode === "camera_view" || mode === "compare" || mode === "map") {
    return mode;
  }
  return "map";
}

function viewModeToPreset(mode: ViewMode): WorkspacePreset {
  switch (mode) {
    case "wall":
      return "camera_wall";
    case "replay":
      return "replay";
    case "camera_view":
      return "coverage";
    case "compare":
      return "compare";
    case "map":
    default:
      return "edit";
  }
}

function viewModeToBottomTab(mode: ViewMode): BottomTab {
  switch (mode) {
    case "replay":
    case "camera_view":
      return "timeline";
    case "compare":
      return "beforeafter";
    case "wall":
    case "map":
    default:
      return "metrics";
  }
}

const INITIAL_VIEW_MODE = getInitialViewMode();
const INITIAL_WORKSPACE_PRESET = viewModeToPreset(INITIAL_VIEW_MODE);

export const useStudioStore = create<StudioStoreState>()((set, get) => ({
  scene: INITIAL_SCENE,
  simulationResult: null,
  simulationDirty: true,
  simulationRunning: false,
  snapshots: INITIAL_SNAPSHOTS,
  lastRunMs: null,
  savedScenes: [],

  selectedNodeId: "cam_entrance",
  selectedNodeIds: ["cam_entrance"],
  activeTool: "select",
  editor: {
    editorMode: "idle",
    draftWallStart: undefined,
    draftPolygonPoints: [],
    draftPathPoints: [],
    hoverPoint: undefined,
    snapEnabled: true,
    snapDistanceM: 0.25,
    gridSnapM: 0.5,
    selectedHandle: undefined,
  },
  viewMode: INITIAL_VIEW_MODE,
  bottomTab: viewModeToBottomTab(INITIAL_VIEW_MODE),
  inspectorTab: "properties",
  workspacePreset: INITIAL_WORKSPACE_PRESET,
  focusMode: false,
  leftDockCollapsed: false,
  rightDockCollapsed: false,
  bottomDockCollapsed: false,
  leftDockSizePx: DEFAULT_DOCK_SIZES.left,
  rightDockSizePx: DEFAULT_DOCK_SIZES.right,
  bottomDockSizePx: DEFAULT_DOCK_SIZES.bottom,
  previousLayout: null,
  layerVisibility: { ...DEFAULT_LAYERS },
  heatmapMode: "quality",
  environmentMode: "day",
  showDebugOverlays: false,
  autoRecompute: true,
  temporalProfile: null,
  temporalScrubHour: 10,
  temporalScrubMinute: 0,
  demoMode: false,
  demoStep: 0,
  activePathId: INITIAL_SCENE.paths[0]?.id ?? null,
  mapState: cloneDefaultMapState(),
  hoveredMapNodeId: null,
  focusScenePointRequest: null,
  cameraPresetId: null,
  historyPast: [],
  historyFuture: [],

  pathReplay: { playing: false, progress: 0, speed: 1, followActor: true },
  setPathReplayPlaying: (playing) => set((s) => ({ pathReplay: { ...s.pathReplay, playing } })),
  setPathReplayProgress: (progress) => set((s) => ({ pathReplay: { ...s.pathReplay, progress } })),
  setPathReplaySpeed: (speed) => set((s) => ({ pathReplay: { ...s.pathReplay, speed } })),
  setPathReplayFollowActor: (followActor) => set((s) => ({ pathReplay: { ...s.pathReplay, followActor } })),
  setActivePathId: (id) => set({ activePathId: id }),
  setMapZoom: (target, zoom) => {
    const nextZoom = Math.max(0.05, Math.min(6, zoom));
    if (target === "minimap") {
      set((state) => ({ mapState: { ...state.mapState, minimap: { ...state.mapState.minimap, zoom: nextZoom } } }));
      return;
    }

    set((state) => ({ mapState: { ...state.mapState, pathMap: { ...state.mapState.pathMap, zoom: nextZoom } } }));
  },
  setMapPan: (target, pan) => {
    const nextPan = [pan[0], pan[1]] as [number, number];
    if (target === "minimap") {
      set((state) => ({ mapState: { ...state.mapState, minimap: { ...state.mapState.minimap, pan: nextPan } } }));
      return;
    }

    set((state) => ({ mapState: { ...state.mapState, pathMap: { ...state.mapState.pathMap, pan: nextPan } } }));
  },
  fitMap: (target) => {
    if (target === "minimap") {
      set((state) => ({ mapState: { ...state.mapState, minimap: { zoom: 1, pan: [0, 0] } } }));
      return;
    }

    set((state) => ({ mapState: { ...state.mapState, pathMap: { zoom: 1, pan: [0, 0] } } }));
  },
  setHoveredMapNodeId: (id) => set({ hoveredMapNodeId: id }),
  setFocusScenePointRequest: (request) => set({ focusScenePointRequest: request }),

  setEditorMode: (mode) => set((s) => ({
    editor: {
      ...s.editor,
      editorMode: mode,
      draftWallStart: mode === "drawing_wall" ? s.editor.draftWallStart : s.editor.draftWallStart,
      draftPolygonPoints: mode === "drawing_polygon" ? s.editor.draftPolygonPoints : s.editor.draftPolygonPoints,
      draftPathPoints: mode === "drawing_path" ? s.editor.draftPathPoints : s.editor.draftPathPoints,
    },
  })),
  setDraftWallStart: (start) => set((s) => ({
    editor: { ...s.editor, editorMode: start ? "drawing_wall" : s.editor.editorMode, draftWallStart: start },
  })),
  setDraftPolygonPoints: (points) => set((s) => ({
    editor: { ...s.editor, editorMode: points.length ? "drawing_polygon" : s.editor.editorMode, draftPolygonPoints: points },
  })),
  setDraftPathPoints: (points) => set((s) => ({
    editor: { ...s.editor, editorMode: points.length ? "drawing_path" : s.editor.editorMode, draftPathPoints: points },
  })),
  setEditorHoverPoint: (point) => set((s) => ({ editor: { ...s.editor, hoverPoint: point } })),
  setSnapEnabled: (enabled) => set((s) => ({ editor: { ...s.editor, snapEnabled: enabled } })),
  setSnapDistanceM: (value) => set((s) => ({ editor: { ...s.editor, snapDistanceM: value } })),
  setGridSnapM: (value) => set((s) => ({ editor: { ...s.editor, gridSnapM: value } })),
  setSelectedHandle: (handle) => set((s) => ({ editor: { ...s.editor, selectedHandle: handle } })),
  setCameraPresetId: (presetId) => set({ cameraPresetId: presetId }),

  commitSceneChange: (updater, label) =>
    set((s) => {
      void label;
      const next = updater(cloneSecurityScene(s.scene));
      return {
        scene: next,
        simulationDirty: true,
        ...setSelectionState(next, s.selectedNodeIds),
        activePathId: cloneAndSetActivePath(next, s.activePathId),
        historyPast: [...s.historyPast, cloneSecurityScene(s.scene)],
        historyFuture: [],
      };
    }),

  undo: () => set((s) => {
    if (s.historyPast.length === 0) return s;
    const previous = s.historyPast[s.historyPast.length - 1];
    if (!previous) return s;
    return {
      scene: cloneSecurityScene(previous),
      activePathId: cloneAndSetActivePath(previous, s.activePathId),
      ...setSelectionState(previous, s.selectedNodeIds),
      simulationDirty: true,
      historyPast: s.historyPast.slice(0, -1),
      historyFuture: [cloneSecurityScene(s.scene), ...s.historyFuture],
    };
  }),
  redo: () => set((s) => {
    if (s.historyFuture.length === 0) return s;
    const nextScene = s.historyFuture[0];
    if (!nextScene) return s;
    return {
      scene: cloneSecurityScene(nextScene),
      activePathId: cloneAndSetActivePath(nextScene, s.activePathId),
      ...setSelectionState(nextScene, s.selectedNodeIds),
      simulationDirty: true,
      historyPast: [...s.historyPast, cloneSecurityScene(s.scene)],
      historyFuture: s.historyFuture.slice(1),
    };
  }),
  canUndo: () => {
    return get().historyPast.length > 0;
  },
  canRedo: () => {
    return get().historyFuture.length > 0;
  },

  selectNode: (id) => set({
    selectedNodeId: id,
    selectedNodeIds: id ? [id] : [],
  }),
  setSelectedNodes: (ids) => set((state) => {
    const next = purgeInvalidSelection(state.scene, ids);
    return {
      selectedNodeIds: next,
      selectedNodeId: primarySelection(next),
    };
  }),
  addSelectedNode: (id) => set((state) => {
    if (state.selectedNodeIds.includes(id)) return state;
    const next = purgeInvalidSelection(state.scene, [...state.selectedNodeIds, id]);
    return {
      selectedNodeIds: next,
      selectedNodeId: primarySelection(next),
    };
  }),
  toggleSelectedNode: (id) => set((state) => {
    const next = state.selectedNodeIds.includes(id)
      ? state.selectedNodeIds.filter((entry) => entry !== id)
      : [...state.selectedNodeIds, id];
    const filtered = purgeInvalidSelection(state.scene, next);
    return {
      selectedNodeIds: filtered,
      selectedNodeId: primarySelection(filtered),
    };
  }),
  clearSelection: () => set({ selectedNodeId: null, selectedNodeIds: [] }),
  setActiveTool: (tool) => set((s) => ({
    activeTool: tool,
    editor: {
      ...s.editor,
      editorMode: "idle",
      draftWallStart: undefined,
      draftPolygonPoints: [],
      draftPathPoints: [],
      hoverPoint: undefined,
      selectedHandle: undefined,
    },
  })),
  setViewMode: (mode) => {
    const TAB_FOR_MODE: Partial<Record<ViewMode, BottomTab>> = {
      replay: "timeline",
      camera_view: "timeline",
      compare: "beforeafter",
      map: "metrics",
      wall: "metrics",
    };
    const preset = VIEW_MODE_PRESETS[mode];
    const layout = PRESET_LAYOUTS[preset];
    const autoTab = TAB_FOR_MODE[mode];
    set({
      viewMode: mode,
      workspacePreset: preset,
      focusMode: false,
      previousLayout: null,
      leftDockCollapsed: layout.leftDockCollapsed,
      rightDockCollapsed: layout.rightDockCollapsed,
      bottomDockCollapsed: layout.bottomDockCollapsed,
      leftDockSizePx: layout.leftDockSizePx,
      rightDockSizePx: layout.rightDockSizePx,
      bottomDockSizePx: layout.bottomDockSizePx,
      ...(autoTab ? { bottomTab: autoTab } : {}),
    });
  },
  setWorkspacePreset: (preset) =>
    set((state) => {
      if (preset === "focus") {
        if (state.focusMode) return state;
        return {
          previousLayout: snapshotLayout(state),
          workspacePreset: preset,
          focusMode: true,
          leftDockCollapsed: true,
          rightDockCollapsed: true,
          bottomDockCollapsed: true,
        };
      }

      const layout = PRESET_LAYOUTS[preset];
      return {
        workspacePreset: preset,
        focusMode: false,
        previousLayout: null,
        leftDockCollapsed: layout.leftDockCollapsed,
        rightDockCollapsed: layout.rightDockCollapsed,
        bottomDockCollapsed: layout.bottomDockCollapsed,
        leftDockSizePx: layout.leftDockSizePx,
        rightDockSizePx: layout.rightDockSizePx,
        bottomDockSizePx: layout.bottomDockSizePx,
      };
    }),
  toggleDock: (side) =>
    set((state) => {
      if (state.focusMode) return state;
      const key = dockCollapsedKey(side);
      return { [key]: !state[key] } as Pick<StudioStoreState, typeof key>;
    }),
  setDockCollapsed: (side, collapsed) =>
    set((state) => {
      if (state.focusMode) return state;
      const key = dockCollapsedKey(side);
      return { [key]: collapsed } as Pick<StudioStoreState, typeof key>;
    }),
  setDockSize: (side, sizePx) =>
    set((state) => {
      if (state.focusMode) return state;
      const key = dockSizeKey(side);
      return { [key]: clampDockSize(side, sizePx) } as Pick<StudioStoreState, typeof key>;
    }),
  enterFocusMode: () =>
    set((state) => {
      if (state.focusMode) return state;
      return {
        previousLayout: snapshotLayout(state),
        workspacePreset: "focus",
        focusMode: true,
        leftDockCollapsed: true,
        rightDockCollapsed: true,
        bottomDockCollapsed: true,
      };
    }),
  restorePreviousLayout: () =>
    set((state) => {
      if (!state.previousLayout) return state;
      const layout = state.previousLayout;
      return {
        workspacePreset: layout.workspacePreset,
        focusMode: false,
        leftDockCollapsed: layout.leftDockCollapsed,
        rightDockCollapsed: layout.rightDockCollapsed,
        bottomDockCollapsed: layout.bottomDockCollapsed,
        leftDockSizePx: layout.leftDockSizePx,
        rightDockSizePx: layout.rightDockSizePx,
        bottomDockSizePx: layout.bottomDockSizePx,
        previousLayout: null,
      };
    }),
  setBottomTab: (tab) => set({ bottomTab: tab }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  toggleLayer: (layer) =>
    set((s) => ({ layerVisibility: { ...s.layerVisibility, [layer]: !s.layerVisibility[layer] } })),
  setLayerVisibility: (layer, visible) =>
    set((s) => ({ layerVisibility: { ...s.layerVisibility, [layer]: visible } })),
  setHeatmapMode: (mode) => set({ heatmapMode: mode }),
  setEnvironmentMode: (mode) => set({ environmentMode: mode }),
  setAllZoneTargetTypes: (targetType) =>
    set((s) => ({
      scene: {
        ...s.scene,
        criticalZones: s.scene.criticalZones.map((z) => ({ ...z, targetType })),
      },
    })),
  toggleAutoRecompute: () => set((s) => ({ autoRecompute: !s.autoRecompute })),

  setTemporalProfile: (profile) => set({ temporalProfile: profile }),
  setTemporalScrub: (hour, minute) => {
    // Auto-switch environment mode based on time of day
    const envMode = (hour < 6 || hour >= 19) ? "night" : hour >= 17 ? "dusk" : "day";
    set({ temporalScrubHour: hour, temporalScrubMinute: minute, environmentMode: envMode });
  },
  computeTemporalProfile: () => {
    const { scene } = get();
    const profile = computeTemporalProfile(scene);
    set({ temporalProfile: profile });
  },

  setDemoMode: (active) => set({ demoMode: active }),
  setDemoStep: (step) => set({ demoStep: step }),

  addNode: (node) => {
    useStudioStore.getState().commitSceneChange((scene) => insertNode(scene, node));
  },
  updateNode: (id, patch) => {
    useStudioStore.getState().commitSceneChange((scene) => patchNode(scene, id, patch));
  },
  duplicateNode: (id) => {
    const { scene: currentScene, selectedNodeIds } = get();
    const idsToDuplicate = selectedNodeIds.length > 1 && selectedNodeIds.includes(id)
      ? selectedNodeIds
      : [id];
    const { scene: next, duplicatedIds } = duplicateNodesInScene(currentScene, idsToDuplicate);
    if (duplicatedIds.length === 0) return;
    set((state) => ({
      scene: next,
      simulationDirty: true,
      selectedNodeId: duplicatedIds[0] ?? null,
      selectedNodeIds: duplicatedIds,
      activePathId: cloneAndSetActivePath(next, state.activePathId),
      historyPast: [...state.historyPast, cloneSecurityScene(state.scene)],
      historyFuture: [],
    }));
  },
  removeNode: (id) => {
    useStudioStore.getState().commitSceneChange((scene) => removeNode(scene, id));
  },
  removeSelectedNodes: (ids) => {
    const { selectedNodeIds } = get();
    const idsToRemove = ids && ids.length > 0 ? ids : selectedNodeIds;
    if (idsToRemove.length === 0) return;
    useStudioStore.getState().commitSceneChange((scene) => {
      let next = cloneSecurityScene(scene);
      idsToRemove.forEach((id) => {
        next = removeNode(next, id);
      });
      return next;
    });
  },
  translateSelectedNodes: (delta) => {
    const { selectedNodeIds } = get();
    if (selectedNodeIds.length === 0) return;
    useStudioStore.getState().commitSceneChange((scene) => translateNodesInScene(scene, selectedNodeIds, delta));
  },
  updateAssumptions: (patch) =>
    useStudioStore.getState().commitSceneChange((scene) => ({
      ...scene,
      assumptions: {
        ...scene.assumptions,
        ...patch,
      },
    })),

  setSimulationRunning: (running) => set({ simulationRunning: running }),
  setSimulationResult: (result, durationMs) =>
    set((s) => {
      const scene = cloneSecurityScene(s.scene);
      scene.simulation = result;
      scene.updatedAt = Date.now();
      return { scene, simulationResult: result, simulationDirty: false, simulationRunning: false, lastRunMs: durationMs };
    }),
  markDirty: () => set({ simulationDirty: true }),

  counterfactualResult: null,
  counterfactualObsId: null,
  runCounterfactual: (obstructionId) => {
    const { scene } = get();
    const patched: import("@/schema/security-scene").SecurityScene = {
      ...cloneSecurityScene(scene),
      obstructions: scene.obstructions.filter((o) => o.id !== obstructionId),
    };
    const result = simulateStudio(patched);
    set({ counterfactualResult: result, counterfactualObsId: obstructionId });
  },
  clearCounterfactual: () => set({ counterfactualResult: null, counterfactualObsId: null }),

  addSnapshot: (label: string, result) =>
    set((s) => {
      const parsed = parseSecurityScene(s.scene);
      const snapshot: SceneSnapshot = {
        id: `snap_${Date.now().toString(36)}`,
        label,
        createdAt: Date.now(),
        scene: cloneSecurityScene(parsed),
        simulation: result,
      };
      return { snapshots: [...s.snapshots, snapshot] };
    }),

  saveSnapshot: (label) =>
    set((s) => {
      const parsed = parseSecurityScene(s.scene);
      const snapshot: SceneSnapshot = {
        id: `snap_${Date.now().toString(36)}`,
        label,
        createdAt: Date.now(),
        scene: cloneSecurityScene(parsed),
        simulation: s.simulationResult ?? undefined,
      };
      const snapshots = [...s.snapshots, snapshot];
      const scene = cloneSecurityScene(parsed);
      scene.snapshots = snapshots;
      return { snapshots, scene };
    }),

  importScene: (json) => {
    const result = safeParseSecurityScene(json);
    if (!result.success) {
      return { success: false, error: result.error.issues.map((i) => i.message).join(", ") };
    }
    const scene = cloneSecurityScene(result.data);
    set({
      scene,
      snapshots: scene.snapshots,
      historyPast: [],
      historyFuture: [],
      selectedNodeId: null,
      selectedNodeIds: [],
      editor: {
        editorMode: "idle",
        draftWallStart: undefined,
        draftPolygonPoints: [],
        draftPathPoints: [],
        hoverPoint: undefined,
        snapEnabled: true,
        snapDistanceM: 0.25,
        gridSnapM: 0.5,
        selectedHandle: undefined,
      },
      simulationDirty: true,
      simulationResult: null,
      activePathId: scene.paths[0]?.id ?? null,
      focusScenePointRequest: null,
      mapState: cloneDefaultMapState(),
    });
    return { success: true };
  },

  exportScene: () => cloneSecurityScene(get().scene),

  // Scene management
  setScene: (scene) =>
    set({
      scene: cloneSecurityScene(scene),
      snapshots: structuredClone(scene.snapshots ?? []),
      simulationDirty: true,
      simulationResult: null,
      selectedNodeId: null,
      selectedNodeIds: [],
      activePathId: scene.paths[0]?.id ?? null,
      focusScenePointRequest: null,
      mapState: cloneDefaultMapState(),
      viewMode: "map",
      bottomTab: "metrics",
      inspectorTab: "properties",
      activeTool: "select",
      historyPast: [],
      historyFuture: [],
      editor: {
        editorMode: "idle",
        draftWallStart: undefined,
        draftPolygonPoints: [],
        draftPathPoints: [],
        hoverPoint: undefined,
        snapEnabled: true,
        snapDistanceM: 0.25,
        gridSnapM: 0.5,
        selectedHandle: undefined,
      },
    }),

  createNewScene: () => {
    const blank = createBlankSecurityScene();
    set({
      scene: blank,
      snapshots: [],
      simulationResult: null,
      simulationDirty: true,
      selectedNodeId: null,
      selectedNodeIds: [],
      activePathId: null,
      focusScenePointRequest: null,
      mapState: cloneDefaultMapState(),
      viewMode: "map",
      bottomTab: "metrics",
      inspectorTab: "properties",
      activeTool: "select",
      editor: {
        editorMode: "idle",
        draftWallStart: undefined,
        draftPolygonPoints: [],
        draftPathPoints: [],
        hoverPoint: undefined,
        snapEnabled: true,
        snapDistanceM: 0.25,
        gridSnapM: 0.5,
        selectedHandle: undefined,
      },
      historyPast: [],
      historyFuture: [],
    });
  },

  saveSceneToStorage: () => {
    const scene = get().scene;
    appendSavedScene(scene);
    get().refreshSavedScenesList();
  },

  loadScenesFromStorage: () => {
    return loadSavedScenesFromStorage();
  },

  refreshSavedScenesList: () => {
    set({ savedScenes: loadSavedScenesFromStorage() });
  },

  deleteSavedScene: (sceneId) => {
    removeSavedScene(sceneId);
    get().refreshSavedScenesList();
  },

  getSceneStorageKey: () => SCENE_STORAGE_KEY,

  getSelectedCamera: () => {
    const { scene, selectedNodeId } = get();
    if (!selectedNodeId) return null;
    return scene.cameras.find((c) => c.id === selectedNodeId) ?? null;
  },
}));

declare global {
  interface Window {
    __sentineltwinStore?: typeof useStudioStore;
    __sentineltwinSetViewMode?: (mode: ViewMode) => void;
  }
}

if (typeof window !== "undefined") {
  window.__sentineltwinStore = useStudioStore;
  window.__sentineltwinSetViewMode = (mode: ViewMode) => {
    useStudioStore.getState().setViewMode(mode);
  };
}
