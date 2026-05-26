import { create } from "zustand";

import { createSmallRetailShopScene, smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import {
  type AnyEditableNode,
  type CameraNode,
  type SecurityScene,
  type SimulationResult,
  type SceneSnapshot,
  cloneSecurityScene,
  parseSecurityScene,
  safeParseSecurityScene,
} from "@/schema/security-scene";
import { simulateStudio } from "@/simulation/simulate-studio";

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

export type BottomTab = "metrics" | "issues" | "timeline" | "beforeafter" | "counterfactual" | "report" | "debug" | "threat";

export type InspectorTab = "properties" | "view" | "status" | "analytics" | "failures";

export type LayerId =
  | "cameras" | "camera_cones" | "obstructions" | "lights"
  | "critical_zones" | "privacy_zones" | "paths" | "heatmap"
  | "grid" | "walls_floors" | "labels";

export type LayerVisibility = Record<LayerId, boolean>;

export type StudioStoreState = {
  scene: SecurityScene;
  simulationResult: SimulationResult | null;
  simulationDirty: boolean;
  simulationRunning: boolean;
  snapshots: SceneSnapshot[];
  lastRunMs: number | null;

  selectedNodeId: string | null;
  activeTool: ActiveTool;
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
  environmentMode: "day" | "night" | "dusk";
  showDebugOverlays: boolean;
  autoRecompute: boolean;
  demoMode: boolean;
  demoStep: number;
  setDemoMode: (active: boolean) => void;
  setDemoStep: (step: number) => void;

  pathReplay: { playing: boolean; progress: number; speed: number };
  setPathReplayPlaying: (playing: boolean) => void;
  setPathReplayProgress: (progress: number) => void;
  setPathReplaySpeed: (speed: number) => void;

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
  setEnvironmentMode: (mode: "day" | "night" | "dusk") => void;
  toggleAutoRecompute: () => void;

  addNode: (node: AnyEditableNode) => void;
  updateNode: (id: string, patch: Partial<AnyEditableNode>) => void;
  removeNode: (id: string) => void;

  setSimulationRunning: (running: boolean) => void;
  setSimulationResult: (result: SimulationResult, durationMs: number) => void;
  markDirty: () => void;

  addSnapshot: (label: string, result: SimulationResult) => void;
  saveSnapshot: (label: string) => void;
  importScene: (json: unknown) => { success: boolean; error?: string };
  exportScene: () => SecurityScene;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[key][idx] = { ...(next[key][idx] as AnyEditableNode), ...patch };
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

const DEFAULT_LAYERS: LayerVisibility = {
  cameras: true, camera_cones: true, obstructions: true, lights: true,
  critical_zones: true, privacy_zones: true, paths: true, heatmap: true,
  grid: true, walls_floors: true, labels: true,
};

const DEFAULT_DOCK_SIZES = {
  left: 248,
  right: 344,
  bottom: 248,
} as const;

const PRESET_LAYOUTS: Record<WorkspacePreset, Omit<DockSnapshot, "workspacePreset">> = {
  edit: {
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: DEFAULT_DOCK_SIZES.right,
    bottomDockSizePx: 248,
  },
  coverage: {
    leftDockCollapsed: true,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 372,
    bottomDockSizePx: 240,
  },
  camera_wall: {
    leftDockCollapsed: true,
    rightDockCollapsed: true,
    bottomDockCollapsed: true,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: DEFAULT_DOCK_SIZES.right,
    bottomDockSizePx: 216,
  },
  replay: {
    leftDockCollapsed: true,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 360,
    bottomDockSizePx: 324,
  },
  compare: {
    leftDockCollapsed: true,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 368,
    bottomDockSizePx: 280,
  },
  report: {
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 368,
    bottomDockSizePx: 240,
  },
  debug: {
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    bottomDockCollapsed: false,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: 368,
    bottomDockSizePx: 280,
  },
  focus: {
    leftDockCollapsed: true,
    rightDockCollapsed: true,
    bottomDockCollapsed: true,
    leftDockSizePx: DEFAULT_DOCK_SIZES.left,
    rightDockSizePx: DEFAULT_DOCK_SIZES.right,
    bottomDockSizePx: DEFAULT_DOCK_SIZES.bottom,
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
  return [
    createSnapshotVariant("Baseline", 18),
    createSnapshotVariant("Moved Cupboard", 14, (scene) => {
      const cupboard = scene.obstructions.find((obs) => obs.id === "obs_cupboard_blocker");
      if (cupboard) {
        cupboard.position = [3.2, cupboard.position[1], 2.4];
      }
    }),
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

export const useStudioStore = create<StudioStoreState>()((set, get) => ({
  scene: INITIAL_SCENE,
  simulationResult: null,
  simulationDirty: true,
  simulationRunning: false,
  snapshots: INITIAL_SNAPSHOTS,
  lastRunMs: null,

  selectedNodeId: "cam_entrance",
  activeTool: "select",
  viewMode: "map",
  bottomTab: "metrics",
  inspectorTab: "properties",
  workspacePreset: "edit",
  focusMode: false,
  leftDockCollapsed: false,
  rightDockCollapsed: false,
  bottomDockCollapsed: false,
  leftDockSizePx: DEFAULT_DOCK_SIZES.left,
  rightDockSizePx: DEFAULT_DOCK_SIZES.right,
  bottomDockSizePx: DEFAULT_DOCK_SIZES.bottom,
  previousLayout: null,
  layerVisibility: { ...DEFAULT_LAYERS },
  environmentMode: "day",
  showDebugOverlays: false,
  autoRecompute: true,
  demoMode: false,
  demoStep: 0,

  pathReplay: { playing: false, progress: 0, speed: 1 },
  setPathReplayPlaying: (playing) => set((s) => ({ pathReplay: { ...s.pathReplay, playing } })),
  setPathReplayProgress: (progress) => set((s) => ({ pathReplay: { ...s.pathReplay, progress } })),
  setPathReplaySpeed: (speed) => set((s) => ({ pathReplay: { ...s.pathReplay, speed } })),

  selectNode: (id) => set({ selectedNodeId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setViewMode: (mode) => {
    // Auto-switch the bottom tab to the most contextually relevant tab for each view mode
    const TAB_FOR_MODE: Partial<Record<ViewMode, BottomTab>> = {
      replay:      "timeline",
      camera_view: "timeline",
      compare:     "beforeafter",
      map:         "metrics",
    };
    const autoTab = TAB_FOR_MODE[mode];
    set({ viewMode: mode, ...(autoTab ? { bottomTab: autoTab } : {}) });
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
  setEnvironmentMode: (mode) => set({ environmentMode: mode }),
  toggleAutoRecompute: () => set((s) => ({ autoRecompute: !s.autoRecompute })),
  setDemoMode: (active) => set({ demoMode: active }),
  setDemoStep: (step) => set({ demoStep: step }),

  addNode: (node) =>
    set((s) => ({ scene: insertNode(s.scene, node), simulationDirty: true })),
  updateNode: (id, patch) =>
    set((s) => ({ scene: patchNode(s.scene, id, patch), simulationDirty: true })),
  removeNode: (id) =>
    set((s) => ({ scene: removeNode(s.scene, id), simulationDirty: true })),

  setSimulationRunning: (running) => set({ simulationRunning: running }),
  setSimulationResult: (result, durationMs) =>
    set((s) => {
      const scene = cloneSecurityScene(s.scene);
      scene.simulation = result;
      scene.updatedAt = Date.now();
      return { scene, simulationResult: result, simulationDirty: false, simulationRunning: false, lastRunMs: durationMs };
    }),
  markDirty: () => set({ simulationDirty: true }),

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
    set({ scene, snapshots: scene.snapshots, simulationDirty: true, simulationResult: null });
    return { success: true };
  },

  exportScene: () => cloneSecurityScene(get().scene),

  getSelectedCamera: () => {
    const { scene, selectedNodeId } = get();
    if (!selectedNodeId) return null;
    return scene.cameras.find((c) => c.id === selectedNodeId) ?? null;
  },
}));
