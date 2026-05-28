import { create } from "zustand";

import { createSmallRetailShopScene, smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { DEFAULT_AI_PROVIDER_SELECTION, normalizeAiProviderSelection, type AiProviderSelection } from "@/agents/provider-selection";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { createCameraNode, createCriticalZoneNode, createObstructionNode, createSecurityLightNode, createWallNode } from "@/lib/node-factory";
import { buildSceneIntelligenceGraph, type SceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import {
  createDefaultEnabledAnalysisModules,
  createDefaultVisibleComponents,
  getPresetLayoutSnapshot,
  isWorkspaceLayoutModified,
  PRESET_VIEW_MODES,
  PRESET_CANVAS_MODES,
  PRESET_RIGHT_PANEL_MODES,
  PRESET_BOTTOM_DRAWER_MODES,
  PRESET_PINNED_MODULES,
  PRESET_LAYOUT_SIZES,
  type WorkspaceLayoutSnapshot,
} from "@/lib/workspace-layouts";
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

export type ViewMode = "map" | "wall" | "replay" | "camera_view" | "compare" | "report";
export type CanvasMode = "orbit_3d" | "topdown_2d";
export type DockSide = "left" | "right" | "bottom";
export type RightPanelMode =
  | "inspector"
  | "security_status"
  | "issues"
  | "recommendations"
  | "assumptions"
  | "camera_controls";
export type BottomDrawerMode = "tabs" | "single_module" | "hidden";
export type WorkspaceComponentId =
  | "coverage_legend"
  | "north_compass"
  | "viewport_controls"
  | "control_hint_bar"
  | "camera_preset_picker"
  | "view_mode_bar"
  | "command_bar"
  | "status_bar"
  | "left_dock"
  | "right_dock"
  | "bottom_dock"
  | "minimap";
export type WorkspacePreset =
  | "edit"
  | "coverage"
  | "camera_wall"
  | "replay"
  | "compare"
  | "report"
  | "debug"
  | "focus";

type DockSnapshot = WorkspaceLayoutSnapshot;

type WorkspaceLayoutRecord = WorkspaceLayoutSnapshot & {
  id: string;
  name: string;
  createdAt: number;
};

type DemoSceneSnapshot = Omit<SceneSnapshot, "scene"> & {
  scene: SecurityScene;
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

export type BottomTab = "outcome" | "metrics" | "issues" | "timeline" | "beforeafter" | "report" | "help" | "debug" | "counterfactual" | "threat" | "redundancy" | "temporal" | "assumptions" | "provenance" | "novel";

export type InspectorTab = "properties" | "view" | "status" | "analytics" | "failures";

export type OverlayDensity = "all" | "compact" | "minimal";
export type UiDensity = "compact" | "normal" | "comfortable";
export type UiTheme = "dark" | "light";
export type OverlayFilterId = "cameraLabels" | "zoneLabels" | "obstructionWarnings" | "entryChips" | "pathLabels";
export type OverlayFilters = Record<OverlayFilterId, boolean>;

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

const PROJECT_STORAGE_KEY = "sentineltwin_saved_projects_v2";
const LEGACY_SCENE_STORAGE_KEY = "sentineltwin_saved_scenes";
const LAYOUT_STORAGE_KEY = "sentineltwin_workspace_layouts";
const LEGACY_LAYOUT_STORAGE_KEY = "sentineltwin_saved_layouts_v1";
const UI_THEME_STORAGE_KEY = "sentineltwin_ui_theme";
const UI_DENSITY_STORAGE_KEY = "sentineltwin_ui_density";
const AI_PROVIDER_STORAGE_KEY = "sentineltwin_ai_provider_selection";

export type SavedProjectRecord = {
  scene: SecurityScene;
  folder: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
};

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8);
}

function normalizeFolder(folder: unknown): string {
  const value = typeof folder === "string" ? folder.trim() : "";
  return value || "Unsorted";
}

function normalizeSavedProjectRecord(input: unknown): SavedProjectRecord | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<SavedProjectRecord> & { scene?: unknown };
  const sceneResult = safeParseSecurityScene(candidate.scene ?? input);
  if (!sceneResult.success) return null;

  const now = Date.now();
  return {
    scene: cloneSecurityScene(sceneResult.data),
    folder: normalizeFolder(candidate.folder),
    tags: sanitizeTags(candidate.tags),
    pinned: Boolean(candidate.pinned),
    createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : now,
    lastOpenedAt: typeof candidate.lastOpenedAt === "number" ? candidate.lastOpenedAt : null,
  };
}

function normalizeSavedProjectList(raw: unknown): SavedProjectRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const record = normalizeSavedProjectRecord(item);
    return record ? [record] : [];
  });
}

function dedupeSavedProjectList(records: SavedProjectRecord[]): SavedProjectRecord[] {
  const bySceneId = new Map<string, SavedProjectRecord>();
  for (const record of records) {
    bySceneId.set(record.scene.id, record);
  }
  return [...bySceneId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

function loadSavedProjectsFromStorage(): SavedProjectRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const modernRaw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (modernRaw) {
      return dedupeSavedProjectList(normalizeSavedProjectList(JSON.parse(modernRaw)));
    }

    const legacyRaw = localStorage.getItem(LEGACY_SCENE_STORAGE_KEY);
    if (!legacyRaw) return [];
    const legacyScenes = JSON.parse(legacyRaw);
    if (!Array.isArray(legacyScenes)) return [];
    return dedupeSavedProjectList(legacyScenes.flatMap((scene: unknown) => {
      const parsed = safeParseSecurityScene(scene);
      if (!parsed.success) return [];
      return [{
        scene: cloneSecurityScene(parsed.data),
        folder: "Unsorted",
        tags: [],
        pinned: false,
        createdAt: parsed.data.createdAt ?? Date.now(),
        updatedAt: parsed.data.updatedAt ?? Date.now(),
        lastOpenedAt: null,
      }];
    }));
  } catch {
    return [];
  }
}

function loadSavedLayoutsFromStorage(): WorkspaceLayoutRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    const source = raw ?? localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY);
    if (!source) return [];
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<WorkspaceLayoutRecord>;
      if (
        typeof candidate.id !== "string"
        || typeof candidate.name !== "string"
        || typeof candidate.workspacePreset !== "string"
      ) {
        return [];
      }

      const workspacePreset = candidate.workspacePreset as WorkspacePreset;
      const presetLayout = buildPresetDockLayout(workspacePreset);
      const layerVisibility = candidate.layerVisibility && typeof candidate.layerVisibility === "object"
        ? { ...DEFAULT_LAYERS, ...(candidate.layerVisibility as Partial<LayerVisibility>) }
        : { ...DEFAULT_LAYERS };
      const visibleComponents = candidate.visibleComponents && typeof candidate.visibleComponents === "object"
        ? { ...presetLayout.visibleComponents, ...(candidate.visibleComponents as Partial<Record<WorkspaceComponentId, boolean>>) }
        : { ...presetLayout.visibleComponents };
      const enabledAnalysisModules = candidate.enabledAnalysisModules && typeof candidate.enabledAnalysisModules === "object"
        ? { ...presetLayout.enabledAnalysisModules, ...(candidate.enabledAnalysisModules as Partial<Record<BottomTab, boolean>>) }
        : { ...presetLayout.enabledAnalysisModules };
      const rightPanelMode = candidate.rightPanelMode === "inspector" || candidate.rightPanelMode === "security_status" || candidate.rightPanelMode === "issues" || candidate.rightPanelMode === "recommendations" || candidate.rightPanelMode === "assumptions" || candidate.rightPanelMode === "camera_controls"
        ? candidate.rightPanelMode
        : presetLayout.rightPanelMode;
      const bottomDrawerMode = candidate.bottomDrawerMode === "tabs" || candidate.bottomDrawerMode === "single_module" || candidate.bottomDrawerMode === "hidden"
        ? candidate.bottomDrawerMode
        : presetLayout.bottomDrawerMode;
      const pinnedAnalysisModule = candidate.pinnedAnalysisModule && typeof candidate.pinnedAnalysisModule === "string" && candidate.pinnedAnalysisModule in enabledAnalysisModules
        ? candidate.pinnedAnalysisModule as BottomTab
        : presetLayout.pinnedAnalysisModule;
      const overlayDensity = candidate.overlayDensity === "minimal" || candidate.overlayDensity === "compact" ? candidate.overlayDensity : presetLayout.overlayDensity;
      const showDebugOverlays = Boolean(candidate.showDebugOverlays ?? presetLayout.showDebugOverlays);
      const viewMode = candidate.viewMode === "map" || candidate.viewMode === "wall" || candidate.viewMode === "replay" || candidate.viewMode === "camera_view" || candidate.viewMode === "compare" || candidate.viewMode === "report"
        ? candidate.viewMode
        : PRESET_VIEW_MODES[workspacePreset] ?? "map";
      const canvasMode = candidate.canvasMode === "orbit_3d" || candidate.canvasMode === "topdown_2d"
        ? candidate.canvasMode
        : presetLayout.canvasMode;

      return [{
        id: candidate.id,
        name: candidate.name,
        viewMode,
        canvasMode,
        workspacePreset,
        leftDockCollapsed: typeof candidate.leftDockCollapsed === "boolean" ? candidate.leftDockCollapsed : presetLayout.leftDockCollapsed,
        rightDockCollapsed: typeof candidate.rightDockCollapsed === "boolean" ? candidate.rightDockCollapsed : presetLayout.rightDockCollapsed,
        bottomDockCollapsed: typeof candidate.bottomDockCollapsed === "boolean" ? candidate.bottomDockCollapsed : presetLayout.bottomDockCollapsed,
        leftDockSizePx: typeof candidate.leftDockSizePx === "number" ? candidate.leftDockSizePx : presetLayout.leftDockSizePx,
        rightDockSizePx: typeof candidate.rightDockSizePx === "number" ? candidate.rightDockSizePx : presetLayout.rightDockSizePx,
        bottomDockSizePx: typeof candidate.bottomDockSizePx === "number" ? candidate.bottomDockSizePx : presetLayout.bottomDockSizePx,
        visibleComponents,
        enabledAnalysisModules,
        rightPanelMode,
        bottomDrawerMode,
        pinnedAnalysisModule,
        layerVisibility,
        clientDemoOptions: {
          hideDebugModules: Boolean(candidate.clientDemoOptions && typeof candidate.clientDemoOptions === "object" && "hideDebugModules" in candidate.clientDemoOptions ? (candidate.clientDemoOptions as WorkspaceLayoutRecord["clientDemoOptions"]).hideDebugModules : presetLayout.clientDemoOptions.hideDebugModules),
          simplifiedLabels: Boolean(candidate.clientDemoOptions && typeof candidate.clientDemoOptions === "object" && "simplifiedLabels" in candidate.clientDemoOptions ? (candidate.clientDemoOptions as WorkspaceLayoutRecord["clientDemoOptions"]).simplifiedLabels : presetLayout.clientDemoOptions.simplifiedLabels),
          criticalIssuesOnly: Boolean(candidate.clientDemoOptions && typeof candidate.clientDemoOptions === "object" && "criticalIssuesOnly" in candidate.clientDemoOptions ? (candidate.clientDemoOptions as WorkspaceLayoutRecord["clientDemoOptions"]).criticalIssuesOnly : presetLayout.clientDemoOptions.criticalIssuesOnly),
          lockLayout: Boolean(candidate.clientDemoOptions && typeof candidate.clientDemoOptions === "object" && "lockLayout" in candidate.clientDemoOptions ? (candidate.clientDemoOptions as WorkspaceLayoutRecord["clientDemoOptions"]).lockLayout : presetLayout.clientDemoOptions.lockLayout),
        },
        overlayDensity,
        showDebugOverlays,
        createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now(),
      }];
    });
  } catch {
    return [];
  }
}

function loadUiTheme(): UiTheme {
  if (typeof window === "undefined") return "dark";
  const raw = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
  return raw === "light" ? "light" : "dark";
}

function loadUiDensity(): UiDensity {
  if (typeof window === "undefined") return "normal";
  const raw = window.localStorage.getItem(UI_DENSITY_STORAGE_KEY);
  if (raw === "compact" || raw === "comfortable") return raw;
  return "normal";
}

function loadAiProviderSelection(): AiProviderSelection {
  if (typeof window === "undefined") return { ...DEFAULT_AI_PROVIDER_SELECTION };
  try {
    const raw = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_PROVIDER_SELECTION };
    return normalizeAiProviderSelection(JSON.parse(raw) as Partial<AiProviderSelection>);
  } catch {
    return { ...DEFAULT_AI_PROVIDER_SELECTION };
  }
}

function persistSavedLayouts(layouts: WorkspaceLayoutRecord[]) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

function persistSavedProjects(projects: SavedProjectRecord[]) {
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

function persistAiProviderSelection(selection: AiProviderSelection) {
  try {
    localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

function removeSavedScene(sceneId: string) {
  const projects = loadSavedProjectsFromStorage().filter((record) => record.scene.id !== sceneId);
  persistSavedProjects(projects);
}

function upsertSavedScene(scene: SecurityScene) {
  const projects = loadSavedProjectsFromStorage();
  const idx = projects.findIndex((record) => record.scene.id === scene.id);
  const cloned = cloneSecurityScene(scene);
  const now = Date.now();
  if (idx >= 0) {
    const existing = projects[idx];
    projects[idx] = {
      ...existing,
      scene: cloned,
      updatedAt: now,
      folder: normalizeFolder(existing.folder),
      tags: sanitizeTags(existing.tags),
    };
  } else {
    projects.push({
      scene: cloned,
      folder: "Unsorted",
      tags: [scene.source === "demo" ? "demo" : scene.source === "manual" ? "manual" : "workspace"],
      pinned: false,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
    });
  }
  persistSavedProjects(projects);
}

function updateSavedSceneMetadata(sceneId: string, patch: Partial<Pick<SavedProjectRecord, "folder" | "tags" | "pinned" | "lastOpenedAt">>) {
  const projects = loadSavedProjectsFromStorage();
  const idx = projects.findIndex((record) => record.scene.id === sceneId);
  if (idx < 0) return;
  const existing = projects[idx];
  projects[idx] = {
    ...existing,
    folder: patch.folder !== undefined ? normalizeFolder(patch.folder) : existing.folder,
    tags: patch.tags !== undefined ? sanitizeTags(patch.tags) : existing.tags,
    pinned: patch.pinned !== undefined ? Boolean(patch.pinned) : existing.pinned,
    lastOpenedAt: patch.lastOpenedAt !== undefined ? patch.lastOpenedAt : existing.lastOpenedAt,
    updatedAt: Date.now(),
  };
  persistSavedProjects(projects);
}

export type StudioStoreState = {
  scene: SecurityScene;
  simulationResult: SimulationResult | null;
  simulationDirty: boolean;
  simulationRunning: boolean;
  snapshots: SceneSnapshot[];
  lastRunMs: number | null;
  savedScenes: SecurityScene[];
  savedProjects: SavedProjectRecord[];
  launchNotice: string | null;
  simulationError?: string | null;
  sceneModified?: boolean;
  savedSceneName?: string | null;
  compareVisualEvidence: {
    snapshotAId: string;
    snapshotBId: string;
    beforeImageDataUrl: string;
    afterImageDataUrl: string;
    capturedAt: number;
  } | null;
  compareReportSelection: { snapshotAId: string; snapshotBId: string } | null;
  cameraViewVerificationIntent: { source: "launcher_preview" | "other"; openPanel: boolean } | null;
  cameraVerificationSnapshots: Record<string, Array<{
    id: string;
    fileName: string;
    imageUrl: string;
    mode: "overlay" | "split";
    opacity: number;
    split: number;
    offsetX: number;
    offsetY: number;
    alignmentScore: number | null;
    createdAt: number;
  }>>;

  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedCameraId: string | null;
  activeTool: ActiveTool;
  editor: EditorDraft;
  bottomTab: BottomTab;
  inspectorTab: InspectorTab;
  workspacePreset: WorkspacePreset;
  canvasMode: CanvasMode;
  canvasViewResetTick: number;
  focusMode: boolean;
  leftDockCollapsed: boolean;
  rightDockCollapsed: boolean;
  rightPanelMode: RightPanelMode;
  bottomDockCollapsed: boolean;
  leftDockSizePx: number;
  rightDockSizePx: number;
  bottomDockSizePx: number;
  visibleComponents: Record<WorkspaceComponentId, boolean>;
  enabledAnalysisModules: Record<BottomTab, boolean>;
  bottomDrawerMode: BottomDrawerMode;
  pinnedAnalysisModule: BottomTab | null;
  previousLayout: DockSnapshot | null;
  layerVisibility: LayerVisibility;
  heatmapMode: "quality" | "fragility";
  environmentMode: "day" | "night" | "dusk";
  showDebugOverlays: boolean;
  clientDemoOptions: {
    hideDebugModules: boolean;
    simplifiedLabels: boolean;
    criticalIssuesOnly: boolean;
    lockLayout: boolean;
  };
  autoRecompute: boolean;
  cameraFailures: string[];
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
  setLaunchNotice: (launchNotice: string | null) => void;
  setCompareVisualEvidence: (evidence: StudioStoreState["compareVisualEvidence"]) => void;
  setCompareReportSelection: (selection: StudioStoreState["compareReportSelection"]) => void;
  setCameraViewVerificationIntent: (intent: StudioStoreState["cameraViewVerificationIntent"]) => void;
  upsertCameraVerificationSnapshot: (
    cameraId: string,
    snapshot: StudioStoreState["cameraVerificationSnapshots"][string][number],
  ) => void;
  removeCameraVerificationSnapshot: (cameraId: string, snapshotId: string) => void;

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
  setSelectedCameraId: (id: string | null) => void;
  clearSelection: () => void;
  translateSelectedNodes: (delta: [number, number]) => void;
  removeSelectedNodes: (ids?: string[]) => void;

  selectNode: (id: string | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  setWorkspacePreset: (preset: WorkspacePreset) => void;
  setCanvasMode: (mode: CanvasMode) => void;
  resetCanvasView: () => void;
  toggleDock: (side: DockSide) => void;
  setDockCollapsed: (side: DockSide, collapsed: boolean) => void;
  setDockSize: (side: DockSide, sizePx: number) => void;
  setRightPanelMode: (mode: RightPanelMode) => void;
  setBottomDrawerMode: (mode: BottomDrawerMode) => void;
  setPinnedAnalysisModule: (moduleId: BottomTab | null) => void;
  enterFocusMode: () => void;
  restorePreviousLayout: () => void;

  setActiveTool: (tool: ActiveTool) => void;
  setBottomTab: (tab: BottomTab) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  toggleLayer: (layer: LayerId) => void;
  setLayerVisibility: (layer: LayerId, visible: boolean) => void;
  setHeatmapMode: (mode: "quality" | "fragility") => void;
  setEnvironmentMode: (mode: "day" | "night" | "dusk") => void;
  setShowDebugOverlays: (enabled: boolean) => void;
  setVisibleComponent: (component: WorkspaceComponentId, visible: boolean) => void;
  toggleVisibleComponent: (component: WorkspaceComponentId) => void;
  setAnalysisModuleEnabled: (moduleId: BottomTab, enabled: boolean) => void;
  toggleAnalysisModule: (moduleId: BottomTab) => void;
  overlayDensity: OverlayDensity;
  uiDensity: UiDensity;
  uiTheme: UiTheme;
  aiProviderSelection: AiProviderSelection;
  overlayFilters: OverlayFilters;
  setOverlayDensity: (density: OverlayDensity) => void;
  setUiDensity: (density: UiDensity) => void;
  setUiTheme: (theme: UiTheme) => void;
  setAiProviderSelection: (selection: AiProviderSelection) => void;
  setOverlayFilter: (filter: OverlayFilterId, visible: boolean) => void;
  viewSettingsOpen: boolean;
  setViewSettingsOpen: (open: boolean) => void;
  toggleViewSettingsOpen: () => void;
  savedLayouts: WorkspaceLayoutRecord[];
  refreshSavedLayoutsList: () => void;
  saveCurrentLayoutAs: (name: string) => WorkspaceLayoutRecord | null;
  applySavedLayout: (layoutId: string) => void;
  deleteSavedLayout: (layoutId: string) => void;
  setAllZoneTargetTypes: (targetType: CriticalZoneNode["targetType"]) => void;
  toggleAutoRecompute: () => void;
  toggleCameraFailure: (cameraId: string) => void;
  clearAllCameraFailures: () => void;

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
  runSimulation: () => void;
  simulateSnapshot: (snapshotId: string) => boolean;
  markDirty: () => void;
  logChange: (entry: string) => void;
  clearChangeLog: () => void;

  counterfactualResult: SimulationResult | null;
  counterfactualObsId: string | null;
  sceneIntelligenceGraph: SceneIntelligenceGraph;
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
  updateSavedSceneMetadata: (sceneId: string, patch: Partial<Pick<SavedProjectRecord, "folder" | "tags" | "pinned" | "lastOpenedAt">>) => void;
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

function buildSimulationState(
  scene: SecurityScene,
  result: SimulationResult,
  durationMs: number,
  revisionDepth: number,
  snapshotCount: number,
) {
  const nextScene = cloneSecurityScene(scene);
  nextScene.simulation = result;
  nextScene.updatedAt = Date.now();
  const temporalProfile = computeTemporalProfile(nextScene);

  return {
    scene: nextScene,
    simulationResult: result,
    temporalProfile,
    simulationDirty: false,
    simulationRunning: false,
    lastRunMs: durationMs,
    sceneIntelligenceGraph: buildGraphState(nextScene, result, revisionDepth, snapshotCount),
  };
}

function buildGraphState(
  scene: SecurityScene,
  simulationResult: SimulationResult | null,
  revisionDepth = 0,
  snapshotCount = scene.snapshots.length,
): SceneIntelligenceGraph {
  return buildSceneIntelligenceGraph(scene, {
    simulationResult,
    revisionDepth,
    snapshotCount,
  });
}

const DEFAULT_LAYERS: LayerVisibility = {
  cameras: true, camera_cones: true, obstructions: true, lights: true,
  critical_zones: true, privacy_zones: true, paths: true, heatmap: true,
  grid: true, walls_floors: true, labels: true,
};

const DEFAULT_DOCK_SIZES = PRESET_LAYOUT_SIZES.edit;

const clampDockSize = (side: DockSide, sizePx: number) => {
  const min = side === "bottom" ? 160 : 180;
  const max = side === "bottom" ? 480 : 520;
  return Math.max(min, Math.min(max, Math.round(sizePx)));
};

function buildPresetDockLayout(preset: WorkspacePreset): DockSnapshot {
  const layout = getPresetLayoutSnapshot(preset, DEFAULT_LAYERS);
  return {
    ...layout,
  };
}

function snapshotLayout(state: Pick<
  StudioStoreState,
  | "viewMode"
  | "workspacePreset"
  | "canvasMode"
  | "leftDockCollapsed"
  | "rightDockCollapsed"
  | "bottomDockCollapsed"
  | "leftDockSizePx"
  | "rightDockSizePx"
  | "bottomDockSizePx"
  | "visibleComponents"
  | "enabledAnalysisModules"
  | "rightPanelMode"
  | "bottomDrawerMode"
  | "pinnedAnalysisModule"
  | "layerVisibility"
  | "overlayDensity"
  | "showDebugOverlays"
  | "clientDemoOptions"
>): DockSnapshot {
  return {
    viewMode: state.viewMode,
    workspacePreset: state.workspacePreset,
    canvasMode: state.canvasMode,
    leftDockCollapsed: state.leftDockCollapsed,
    rightDockCollapsed: state.rightDockCollapsed,
    bottomDockCollapsed: state.bottomDockCollapsed,
    leftDockSizePx: state.leftDockSizePx,
    rightDockSizePx: state.rightDockSizePx,
    bottomDockSizePx: state.bottomDockSizePx,
    visibleComponents: { ...state.visibleComponents },
    enabledAnalysisModules: { ...state.enabledAnalysisModules },
    layerVisibility: { ...state.layerVisibility },
    rightPanelMode: state.rightPanelMode,
    bottomDrawerMode: state.bottomDrawerMode,
    pinnedAnalysisModule: state.pinnedAnalysisModule,
    overlayDensity: state.overlayDensity,
    showDebugOverlays: state.showDebugOverlays,
    clientDemoOptions: { ...state.clientDemoOptions },
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

const ANALYSIS_TAB_ORDER: BottomTab[] = [
  "metrics",
  "issues",
  "timeline",
  "temporal",
  "beforeafter",
  "assumptions",
  "provenance",
  "redundancy",
  "counterfactual",
  "threat",
  "report",
  "debug",
  "novel",
];

function getFirstEnabledAnalysisTab(enabledAnalysisModules: Record<BottomTab, boolean>, preferred?: BottomTab | null): BottomTab {
  if (preferred && enabledAnalysisModules[preferred]) return preferred;
  return ANALYSIS_TAB_ORDER.find((tab) => enabledAnalysisModules[tab]) ?? "metrics";
}

const DEMO_SNAPSHOT_BASE_TS = smallRetailShopScene.createdAt + 18 * 60_000;
const SEEDED_WORKSPACE_BASE_TS = smallRetailShopScene.createdAt + 24 * 60_000;
const SEEDED_LAYOUT_BASE_TS = smallRetailShopScene.createdAt + 30 * 60_000;

function createSnapshotVariant(
  label: string,
  minutesAgo: number,
  mutate?: (scene: SecurityScene) => void,
): DemoSceneSnapshot {
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
const INITIAL_SIMULATION = simulateStudio(INITIAL_SCENE);
INITIAL_SCENE.simulation = INITIAL_SIMULATION;
const INITIAL_SCENE_INTELLIGENCE_GRAPH = buildGraphState(INITIAL_SCENE, INITIAL_SIMULATION, 0, INITIAL_SNAPSHOTS.length);

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "map";
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "wall" || mode === "replay" || mode === "camera_view" || mode === "compare" || mode === "report" || mode === "map") {
    return mode;
  }
  return "map";
}

function viewModeToPreset(mode: ViewMode): WorkspacePreset {
  const match = (Object.entries(PRESET_VIEW_MODES) as [WorkspacePreset, ViewMode][])
    .find(([, presetViewMode]) => presetViewMode === mode);
  return match?.[0] ?? "edit";
}

function viewModeToBottomTab(mode: ViewMode): BottomTab {
  switch (mode) {
    case "map":
      return "metrics";
    case "replay":
    case "camera_view":
      return "timeline";
    case "compare":
      return "beforeafter";
    case "report":
      return "report";
    case "wall":
    default:
      return "metrics";
  }
}

const INITIAL_VIEW_MODE = getInitialViewMode();
const INITIAL_WORKSPACE_PRESET = viewModeToPreset(INITIAL_VIEW_MODE);
const INITIAL_LAYOUT = buildPresetDockLayout(INITIAL_WORKSPACE_PRESET);
const INITIAL_SAVED_PROJECTS = loadSavedProjectsFromStorage();
const INITIAL_SAVED_LAYOUTS = loadSavedLayoutsFromStorage();
const INITIAL_SEEDED_PROJECTS = buildSeededWorkspaceProjects();
const INITIAL_SEEDED_LAYOUTS = buildSeededLayouts();

function buildSeededDemoProjects(): SavedProjectRecord[] {
  return INITIAL_SNAPSHOTS.map((snapshot, index) => {
    const variantName = snapshot.label === "Baseline" ? "Open Studio" : snapshot.label;
    const scene = cloneSecurityScene({
      ...snapshot.scene,
      snapshots: snapshot.scene.snapshots ?? [],
      scenarios: snapshot.scene.scenarios ?? [],
    });
    scene.id = `${scene.id}_${snapshot.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    scene.name = `${scene.name} · ${variantName}`;
    const baseTs = snapshot.createdAt ?? Date.now();
    return {
      scene,
      folder: index === 0 ? "Featured" : "Recent",
      tags: ["demo", "workspace", snapshot.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
      pinned: index === 0,
      createdAt: baseTs,
      updatedAt: baseTs,
      lastOpenedAt: baseTs,
    };
  });
}

function buildSeededWorkspaceProjects(): SavedProjectRecord[] {
  const blankWorkspace = createBlankSecurityScene();
  const baseTs = SEEDED_WORKSPACE_BASE_TS;
  blankWorkspace.name = "Shop Layout Draft";
  blankWorkspace.walls = [
    createWallNode([0, 0], [10, 0], { wallHeightM: 3, thicknessM: 0.18, material: "solid" }),
    createWallNode([10, 0], [10, 8], { wallHeightM: 3, thicknessM: 0.18, material: "solid" }),
    createWallNode([10, 8], [0, 8], { wallHeightM: 3, thicknessM: 0.18, material: "solid" }),
    createWallNode([0, 8], [0, 0], { wallHeightM: 3, thicknessM: 0.18, material: "solid" }),
  ];
  blankWorkspace.cameras = [
    createCameraNode([2.2, 2.8, 1.2]),
  ];
  blankWorkspace.securityLights = [
    createSecurityLightNode([5.2, 2.8, 4.3]),
  ];
  blankWorkspace.obstructions = [
    createObstructionNode([4.8, 0.4, 3.2], "counter"),
  ];
  blankWorkspace.criticalZones = [
    createCriticalZoneNode([
      [6.0, 2.0],
      [8.4, 2.0],
      [8.4, 4.0],
      [6.0, 4.0],
    ]),
  ];
  blankWorkspace.entryPoints = [
    { id: "entry_manual_draft", nodeType: "entry_point", label: "Front Entry", position: [1.0, 0.5] },
  ];
  blankWorkspace.paths = [
    {
      id: "path_manual_draft",
      nodeType: "path",
      label: "Entry to Counter",
      actorType: "person",
      points: [
        { position: [1.0, 0.5], timestamp: 0, action: "enter" },
        { position: [3.5, 2.0], timestamp: 12 },
        { position: [6.6, 3.0], timestamp: 24, action: "wait" },
      ],
      speedMps: 1.2,
      heightM: 1.75,
      timeOfDay: "day",
      intent: "authorized",
    },
  ];
  const seededDraftResult = simulateStudio(blankWorkspace);
  blankWorkspace.simulation = seededDraftResult;
  blankWorkspace.updatedAt = baseTs;
  blankWorkspace.createdAt = baseTs;

  return [
    {
      scene: cloneSecurityScene(blankWorkspace),
      folder: "Drafts",
      tags: ["manual", "draft", "workspace"],
      pinned: true,
      createdAt: baseTs,
      updatedAt: baseTs,
      lastOpenedAt: baseTs,
    },
    ...buildSeededDemoProjects(),
  ];
}

function buildSeededLayouts(): WorkspaceLayoutRecord[] {
  const coverage = buildPresetDockLayout("coverage");
  const cameraWall = buildPresetDockLayout("camera_wall");
  return [
    {
      id: "layout_coverage_focus",
      name: "Coverage Focus",
      ...coverage,
      layerVisibility: { ...DEFAULT_LAYERS },
      clientDemoOptions: {
        hideDebugModules: false,
        simplifiedLabels: false,
        criticalIssuesOnly: false,
        lockLayout: false,
      },
      createdAt: SEEDED_LAYOUT_BASE_TS,
    },
    {
      id: "layout_camera_wall",
      name: "Camera Wall Review",
      ...cameraWall,
      layerVisibility: { ...DEFAULT_LAYERS, heatmap: false, grid: false },
      clientDemoOptions: {
        hideDebugModules: true,
        simplifiedLabels: true,
        criticalIssuesOnly: false,
        lockLayout: false,
      },
      createdAt: SEEDED_LAYOUT_BASE_TS + 60_000,
    },
  ];
}

export const useStudioStore = create<StudioStoreState>()((set, get) => ({
  scene: INITIAL_SCENE,
  simulationResult: INITIAL_SIMULATION,
  simulationDirty: false,
  simulationRunning: false,
  snapshots: INITIAL_SNAPSHOTS,
  lastRunMs: 0,
  savedScenes: INITIAL_SAVED_PROJECTS.length > 0 ? INITIAL_SAVED_PROJECTS.map((record) => record.scene) : INITIAL_SEEDED_PROJECTS.map((record) => record.scene),
  savedProjects: INITIAL_SAVED_PROJECTS.length > 0 ? INITIAL_SAVED_PROJECTS : INITIAL_SEEDED_PROJECTS,
  launchNotice: null,
  compareVisualEvidence: null,
  compareReportSelection: null,
  cameraViewVerificationIntent: null,
  cameraVerificationSnapshots: {},

  selectedNodeId: "cam_entrance",
  selectedNodeIds: ["cam_entrance"],
  selectedCameraId: "cam_entrance",
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
  viewMode: INITIAL_LAYOUT.viewMode,
  bottomTab: viewModeToBottomTab(INITIAL_LAYOUT.viewMode),
  inspectorTab: "properties",
  workspacePreset: INITIAL_LAYOUT.workspacePreset,
  canvasMode: INITIAL_LAYOUT.canvasMode,
  canvasViewResetTick: 0,
  focusMode: false,
  leftDockCollapsed: INITIAL_LAYOUT.leftDockCollapsed,
  rightDockCollapsed: INITIAL_LAYOUT.rightDockCollapsed,
  rightPanelMode: INITIAL_LAYOUT.rightPanelMode,
  bottomDockCollapsed: INITIAL_LAYOUT.bottomDockCollapsed,
  leftDockSizePx: INITIAL_LAYOUT.leftDockSizePx,
  rightDockSizePx: INITIAL_LAYOUT.rightDockSizePx,
  bottomDockSizePx: INITIAL_LAYOUT.bottomDockSizePx,
  previousLayout: null,
  layerVisibility: { ...DEFAULT_LAYERS },
  heatmapMode: "quality",
  environmentMode: "day",
  showDebugOverlays: INITIAL_LAYOUT.showDebugOverlays,
  autoRecompute: true,
  cameraFailures: [],
  temporalProfile: computeTemporalProfile(INITIAL_SCENE),
  temporalScrubHour: 10,
  temporalScrubMinute: 0,
  demoMode: false,
  demoStep: 0,
  activePathId: INITIAL_SCENE.paths[0]?.id ?? null,
  mapState: cloneDefaultMapState(),
  hoveredMapNodeId: null,
  overlayDensity: INITIAL_LAYOUT.overlayDensity,
  uiDensity: loadUiDensity(),
  uiTheme: loadUiTheme(),
  aiProviderSelection: loadAiProviderSelection(),
  overlayFilters: {
    cameraLabels: true,
    zoneLabels: true,
    obstructionWarnings: true,
    entryChips: true,
    pathLabels: true,
  },
  focusScenePointRequest: null,
  cameraPresetId: null,
  sceneIntelligenceGraph: INITIAL_SCENE_INTELLIGENCE_GRAPH,
  historyPast: [],
  historyFuture: [],
  viewSettingsOpen: false,
  savedLayouts: INITIAL_SAVED_LAYOUTS.length > 0 ? INITIAL_SAVED_LAYOUTS : INITIAL_SEEDED_LAYOUTS,
  visibleComponents: INITIAL_LAYOUT.visibleComponents,
  enabledAnalysisModules: INITIAL_LAYOUT.enabledAnalysisModules,
  bottomDrawerMode: INITIAL_LAYOUT.bottomDrawerMode,
  pinnedAnalysisModule: INITIAL_LAYOUT.pinnedAnalysisModule,
  clientDemoOptions: INITIAL_LAYOUT.clientDemoOptions,

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
  setViewSettingsOpen: (open) => set({ viewSettingsOpen: open }),
  toggleViewSettingsOpen: () => set((state) => ({ viewSettingsOpen: !state.viewSettingsOpen })),
  refreshSavedLayoutsList: () => {
    const savedLayouts = loadSavedLayoutsFromStorage();
    if (savedLayouts.length === 0) {
      const seededLayouts = buildSeededLayouts();
      persistSavedLayouts(seededLayouts);
      set({ savedLayouts: seededLayouts });
      return;
    }
    set({ savedLayouts });
  },
  saveCurrentLayoutAs: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const state = get();
    const next: WorkspaceLayoutRecord = {
      id: `layout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      viewMode: state.viewMode,
      canvasMode: state.canvasMode,
      workspacePreset: state.workspacePreset,
      leftDockCollapsed: state.leftDockCollapsed,
      rightDockCollapsed: state.rightDockCollapsed,
      bottomDockCollapsed: state.bottomDockCollapsed,
      leftDockSizePx: state.leftDockSizePx,
      rightDockSizePx: state.rightDockSizePx,
      bottomDockSizePx: state.bottomDockSizePx,
      visibleComponents: { ...state.visibleComponents },
      enabledAnalysisModules: { ...state.enabledAnalysisModules },
      rightPanelMode: state.rightPanelMode,
      bottomDrawerMode: state.bottomDrawerMode,
      pinnedAnalysisModule: state.pinnedAnalysisModule,
      layerVisibility: { ...state.layerVisibility },
      overlayDensity: state.overlayDensity,
      showDebugOverlays: state.showDebugOverlays,
      clientDemoOptions: { ...state.clientDemoOptions },
      createdAt: Date.now(),
    };
    const savedLayouts = [next, ...state.savedLayouts.filter((layout) => layout.id !== next.id)];
    persistSavedLayouts(savedLayouts);
    set({ savedLayouts });
    return next;
  },
  applySavedLayout: (layoutId) => {
    const layout = get().savedLayouts.find((entry) => entry.id === layoutId);
    if (!layout) return;
    set({
      viewMode: layout.viewMode,
      canvasMode: layout.canvasMode,
      workspacePreset: layout.workspacePreset,
      focusMode: layout.workspacePreset === "focus",
      previousLayout: null,
      leftDockCollapsed: layout.leftDockCollapsed,
      rightDockCollapsed: layout.rightDockCollapsed,
      bottomDockCollapsed: layout.bottomDockCollapsed,
      leftDockSizePx: layout.leftDockSizePx,
      rightDockSizePx: layout.rightDockSizePx,
      bottomDockSizePx: layout.bottomDockSizePx,
      visibleComponents: { ...layout.visibleComponents },
      enabledAnalysisModules: { ...layout.enabledAnalysisModules },
      rightPanelMode: layout.rightPanelMode,
      bottomDrawerMode: layout.bottomDrawerMode,
      pinnedAnalysisModule: layout.pinnedAnalysisModule,
      layerVisibility: { ...layout.layerVisibility },
      overlayDensity: layout.overlayDensity,
      showDebugOverlays: layout.showDebugOverlays,
      clientDemoOptions: { ...layout.clientDemoOptions },
      bottomTab: layout.pinnedAnalysisModule && layout.enabledAnalysisModules[layout.pinnedAnalysisModule]
        ? layout.pinnedAnalysisModule
        : viewModeToBottomTab(layout.viewMode),
    });
  },
  deleteSavedLayout: (layoutId) => {
    const savedLayouts = get().savedLayouts.filter((layout) => layout.id !== layoutId);
    persistSavedLayouts(savedLayouts);
    set({ savedLayouts });
  },

  commitSceneChange: (updater, label) =>
    set((s) => {
      void label;
      const next = updater(cloneSecurityScene(s.scene));
      return {
        scene: next,
        simulationDirty: true,
        sceneIntelligenceGraph: buildGraphState(next, s.simulationResult, s.historyPast.length + 1, s.snapshots.length),
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
      sceneIntelligenceGraph: buildGraphState(previous, s.simulationResult, s.historyPast.length - 1, s.snapshots.length),
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
      sceneIntelligenceGraph: buildGraphState(nextScene, s.simulationResult, s.historyPast.length + 1, s.snapshots.length),
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

  selectNode: (id) => set((state) => ({
    selectedNodeId: id,
    selectedNodeIds: id ? [id] : [],
    selectedCameraId:
      id && state.scene.cameras.some((camera) => camera.id === id)
        ? id
        : state.selectedCameraId,
  })),
  setSelectedNodes: (ids) => set((state) => {
    const next = purgeInvalidSelection(state.scene, ids);
    const nextPrimary = primarySelection(next);
    return {
      selectedNodeIds: next,
      selectedNodeId: nextPrimary,
      selectedCameraId:
        nextPrimary && state.scene.cameras.some((camera) => camera.id === nextPrimary)
          ? nextPrimary
          : state.selectedCameraId,
    };
  }),
  addSelectedNode: (id) => set((state) => {
    if (state.selectedNodeIds.includes(id)) return state;
    const next = purgeInvalidSelection(state.scene, [...state.selectedNodeIds, id]);
    const nextPrimary = primarySelection(next);
    return {
      selectedNodeIds: next,
      selectedNodeId: nextPrimary,
      selectedCameraId:
        nextPrimary && state.scene.cameras.some((camera) => camera.id === nextPrimary)
          ? nextPrimary
          : state.selectedCameraId,
    };
  }),
  toggleSelectedNode: (id) => set((state) => {
    const next = state.selectedNodeIds.includes(id)
      ? state.selectedNodeIds.filter((entry) => entry !== id)
      : [...state.selectedNodeIds, id];
    const filtered = purgeInvalidSelection(state.scene, next);
    const nextPrimary = primarySelection(filtered);
    return {
      selectedNodeIds: filtered,
      selectedNodeId: nextPrimary,
      selectedCameraId:
        nextPrimary && state.scene.cameras.some((camera) => camera.id === nextPrimary)
          ? nextPrimary
          : state.selectedCameraId,
    };
  }),
  setSelectedCameraId: (id) => set({ selectedCameraId: id }),
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
    const preset = viewModeToPreset(mode);
    const layout = buildPresetDockLayout(preset);
    const autoTab = getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, viewModeToBottomTab(mode));
    set({
      viewMode: mode,
      workspacePreset: preset,
      canvasMode: layout.canvasMode,
      focusMode: false,
      previousLayout: null,
      leftDockCollapsed: layout.leftDockCollapsed,
      rightDockCollapsed: layout.rightDockCollapsed,
      bottomDockCollapsed: layout.bottomDockCollapsed,
      leftDockSizePx: layout.leftDockSizePx,
      rightDockSizePx: layout.rightDockSizePx,
      bottomDockSizePx: layout.bottomDockSizePx,
      visibleComponents: { ...layout.visibleComponents },
      enabledAnalysisModules: { ...layout.enabledAnalysisModules },
      rightPanelMode: layout.rightPanelMode,
      bottomDrawerMode: layout.bottomDrawerMode,
      pinnedAnalysisModule: layout.pinnedAnalysisModule,
      overlayDensity: layout.overlayDensity,
      showDebugOverlays: layout.showDebugOverlays,
      clientDemoOptions: { ...layout.clientDemoOptions },
      bottomTab: autoTab,
    });
  },
  setWorkspacePreset: (preset) =>
    set((state) => {
      if (preset === "focus") {
        if (state.focusMode) return state;
        const layout = buildPresetDockLayout("focus");
        return {
          previousLayout: snapshotLayout(state),
          workspacePreset: preset,
          viewMode: layout.viewMode,
          focusMode: true,
          leftDockCollapsed: layout.leftDockCollapsed,
          rightDockCollapsed: layout.rightDockCollapsed,
          bottomDockCollapsed: layout.bottomDockCollapsed,
          leftDockSizePx: layout.leftDockSizePx,
          rightDockSizePx: layout.rightDockSizePx,
          bottomDockSizePx: layout.bottomDockSizePx,
          visibleComponents: { ...layout.visibleComponents },
          enabledAnalysisModules: { ...layout.enabledAnalysisModules },
          rightPanelMode: layout.rightPanelMode,
          bottomDrawerMode: layout.bottomDrawerMode,
          pinnedAnalysisModule: layout.pinnedAnalysisModule,
          overlayDensity: layout.overlayDensity,
          showDebugOverlays: layout.showDebugOverlays,
          clientDemoOptions: { ...layout.clientDemoOptions },
          bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, state.bottomTab),
        };
      }

      const layout = buildPresetDockLayout(preset);
      return {
        workspacePreset: preset,
        viewMode: layout.viewMode,
        canvasMode: layout.canvasMode,
        focusMode: false,
        previousLayout: null,
        leftDockCollapsed: layout.leftDockCollapsed,
        rightDockCollapsed: layout.rightDockCollapsed,
        bottomDockCollapsed: layout.bottomDockCollapsed,
        leftDockSizePx: layout.leftDockSizePx,
        rightDockSizePx: layout.rightDockSizePx,
        bottomDockSizePx: layout.bottomDockSizePx,
        visibleComponents: { ...layout.visibleComponents },
        enabledAnalysisModules: { ...layout.enabledAnalysisModules },
        rightPanelMode: layout.rightPanelMode,
        bottomDrawerMode: layout.bottomDrawerMode,
        pinnedAnalysisModule: layout.pinnedAnalysisModule,
        overlayDensity: layout.overlayDensity,
        showDebugOverlays: layout.showDebugOverlays,
        clientDemoOptions: { ...layout.clientDemoOptions },
        bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, viewModeToBottomTab(layout.viewMode)),
      };
    }),
  setCanvasMode: (mode) => set({ canvasMode: mode }),
  resetCanvasView: () => set((state) => ({ canvasViewResetTick: state.canvasViewResetTick + 1 })),
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
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
  setBottomDrawerMode: (mode) => set({ bottomDrawerMode: mode }),
  setPinnedAnalysisModule: (moduleId) => set({ pinnedAnalysisModule: moduleId }),
  enterFocusMode: () =>
    set((state) => {
      if (state.focusMode) return state;
      const layout = buildPresetDockLayout("focus");
      return {
        previousLayout: snapshotLayout(state),
        workspacePreset: "focus",
        viewMode: layout.viewMode,
        focusMode: true,
        leftDockCollapsed: layout.leftDockCollapsed,
        rightDockCollapsed: layout.rightDockCollapsed,
        bottomDockCollapsed: layout.bottomDockCollapsed,
        leftDockSizePx: layout.leftDockSizePx,
        rightDockSizePx: layout.rightDockSizePx,
        bottomDockSizePx: layout.bottomDockSizePx,
        visibleComponents: { ...layout.visibleComponents },
        enabledAnalysisModules: { ...layout.enabledAnalysisModules },
        rightPanelMode: layout.rightPanelMode,
        bottomDrawerMode: layout.bottomDrawerMode,
        pinnedAnalysisModule: layout.pinnedAnalysisModule,
        overlayDensity: layout.overlayDensity,
        showDebugOverlays: layout.showDebugOverlays,
        clientDemoOptions: { ...layout.clientDemoOptions },
        bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, state.bottomTab),
      };
    }),
  restorePreviousLayout: () =>
    set((state) => {
      if (!state.previousLayout) return state;
      const layout = state.previousLayout;
      return {
        viewMode: layout.viewMode,
        workspacePreset: layout.workspacePreset,
        canvasMode: layout.canvasMode,
        focusMode: false,
        leftDockCollapsed: layout.leftDockCollapsed,
        rightDockCollapsed: layout.rightDockCollapsed,
        bottomDockCollapsed: layout.bottomDockCollapsed,
        leftDockSizePx: layout.leftDockSizePx,
        rightDockSizePx: layout.rightDockSizePx,
        bottomDockSizePx: layout.bottomDockSizePx,
        visibleComponents: { ...layout.visibleComponents },
        enabledAnalysisModules: { ...layout.enabledAnalysisModules },
        rightPanelMode: layout.rightPanelMode,
        bottomDrawerMode: layout.bottomDrawerMode,
        pinnedAnalysisModule: layout.pinnedAnalysisModule,
        overlayDensity: layout.overlayDensity,
        showDebugOverlays: layout.showDebugOverlays,
        clientDemoOptions: { ...layout.clientDemoOptions },
        bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, layout.pinnedAnalysisModule),
        previousLayout: null,
      };
    }),
  setBottomTab: (tab) => set((state) => ({
    bottomTab: getFirstEnabledAnalysisTab(state.enabledAnalysisModules, tab),
    pinnedAnalysisModule: state.bottomDrawerMode === "single_module" ? getFirstEnabledAnalysisTab(state.enabledAnalysisModules, tab) : state.pinnedAnalysisModule,
  })),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  toggleLayer: (layer) =>
    set((s) => ({ layerVisibility: { ...s.layerVisibility, [layer]: !s.layerVisibility[layer] } })),
  setLayerVisibility: (layer, visible) =>
    set((s) => ({ layerVisibility: { ...s.layerVisibility, [layer]: visible } })),
  setHeatmapMode: (mode) => set({ heatmapMode: mode }),
  setEnvironmentMode: (mode) => set({ environmentMode: mode }),
  setShowDebugOverlays: (enabled) => set({ showDebugOverlays: enabled }),
  setVisibleComponent: (component, visible) => set((state) => ({ visibleComponents: { ...state.visibleComponents, [component]: visible } })),
  toggleVisibleComponent: (component) => set((state) => ({ visibleComponents: { ...state.visibleComponents, [component]: !state.visibleComponents[component] } })),
  setAnalysisModuleEnabled: (moduleId, enabled) =>
    set((state) => {
      const enabledAnalysisModules = { ...state.enabledAnalysisModules, [moduleId]: enabled };
      const bottomTab = enabledAnalysisModules[state.bottomTab] ? state.bottomTab : getFirstEnabledAnalysisTab(enabledAnalysisModules, state.pinnedAnalysisModule);
      const pinnedAnalysisModule = state.bottomDrawerMode === "single_module"
        ? getFirstEnabledAnalysisTab(enabledAnalysisModules, state.pinnedAnalysisModule)
        : state.pinnedAnalysisModule;
      return {
        enabledAnalysisModules,
        bottomTab,
        pinnedAnalysisModule,
      };
    }),
  toggleAnalysisModule: (moduleId) => set((state) => {
    const enabled = !state.enabledAnalysisModules[moduleId];
    const enabledAnalysisModules = { ...state.enabledAnalysisModules, [moduleId]: enabled };
    const bottomTab = enabledAnalysisModules[state.bottomTab] ? state.bottomTab : getFirstEnabledAnalysisTab(enabledAnalysisModules, state.pinnedAnalysisModule);
    const pinnedAnalysisModule = state.bottomDrawerMode === "single_module"
      ? getFirstEnabledAnalysisTab(enabledAnalysisModules, state.pinnedAnalysisModule)
      : state.pinnedAnalysisModule;
    return {
      enabledAnalysisModules,
      bottomTab,
      pinnedAnalysisModule,
    };
  }),
  setOverlayDensity: (density) => set({ overlayDensity: density }),
  setUiDensity: (uiDensity) => set({ uiDensity }),
  setUiTheme: (uiTheme) => set({ uiTheme }),
  setAiProviderSelection: (selection) => {
    const next = normalizeAiProviderSelection(selection);
    persistAiProviderSelection(next);
    set({ aiProviderSelection: next });
  },
  setOverlayFilter: (filter, visible) => set((s) => ({ overlayFilters: { ...s.overlayFilters, [filter]: visible } })),
  setAllZoneTargetTypes: (targetType) =>
    useStudioStore.getState().commitSceneChange((scene) => ({
      ...scene,
      criticalZones: scene.criticalZones.map((z) => ({ ...z, targetType })),
    }), `Set all critical zones target type to ${targetType}`),
  toggleAutoRecompute: () => set((s) => ({ autoRecompute: !s.autoRecompute })),

  toggleCameraFailure: (cameraId) =>
    set((s) => {
      const failures = s.cameraFailures.includes(cameraId)
        ? s.cameraFailures.filter((id) => id !== cameraId)
        : [...s.cameraFailures, cameraId];
      return { cameraFailures: failures, simulationDirty: true };
    }),
  clearAllCameraFailures: () => set({ cameraFailures: [], simulationDirty: true }),

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
  setLaunchNotice: (launchNotice) => set({ launchNotice }),
  setCompareVisualEvidence: (compareVisualEvidence) => set({ compareVisualEvidence }),
  setCompareReportSelection: (compareReportSelection) => set({ compareReportSelection }),
  setCameraViewVerificationIntent: (cameraViewVerificationIntent) => set({ cameraViewVerificationIntent }),
  upsertCameraVerificationSnapshot: (cameraId, snapshot) =>
    set((state) => {
      const existing = state.cameraVerificationSnapshots[cameraId] ?? [];
      const idx = existing.findIndex((entry) => entry.id === snapshot.id);
      const next = idx >= 0
        ? existing.map((entry, index) => (index === idx ? snapshot : entry))
        : [snapshot, ...existing].slice(0, 20);
      return { cameraVerificationSnapshots: { ...state.cameraVerificationSnapshots, [cameraId]: next } };
    }),
  removeCameraVerificationSnapshot: (cameraId, snapshotId) =>
    set((state) => {
      const existing = state.cameraVerificationSnapshots[cameraId] ?? [];
      return {
        cameraVerificationSnapshots: {
          ...state.cameraVerificationSnapshots,
          [cameraId]: existing.filter((entry) => entry.id !== snapshotId),
        },
      };
    }),

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
      sceneIntelligenceGraph: buildGraphState(next, state.simulationResult, state.historyPast.length + 1, state.snapshots.length),
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
    set((s) => buildSimulationState(s.scene, result, durationMs, s.historyPast.length, s.snapshots.length)),
  runSimulation: () => {
    const state = get();
    if (state.simulationRunning) return;

    const sceneVersion = state.scene.updatedAt;
    const sceneSnapshot = cloneSecurityScene(state.scene);

    set({ simulationRunning: true });

    setTimeout(() => {
      try {
        const start = performance.now();
        const result = simulateStudio(sceneSnapshot);
        const durationMs = Math.round(performance.now() - start);

        if (get().scene.updatedAt !== sceneVersion) {
          console.warn("[simulation] discarded stale result because the scene changed mid-run");
          set({ simulationRunning: false });
          return;
        }

        const current = get();
        set(buildSimulationState(current.scene, result, durationMs, current.historyPast.length, current.snapshots.length));
      } catch (err) {
        console.error("[simulation] failed:", err);
        set({ simulationRunning: false });
      }
    }, 30);
  },
  simulateSnapshot: (snapshotId) => {
    const current = get();
    const index = current.snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
    if (index === -1) return false;
    const target = current.snapshots[index];
    const fullScene = cloneSecurityScene(target.scene as unknown as SecurityScene);
    const result = simulateStudio(fullScene);

    set((state) => {
      const nextSnapshots = state.snapshots.map((snapshot, i) =>
        i === index
          ? {
            ...snapshot,
            simulation: result,
          }
          : snapshot);
      const nextScene = cloneSecurityScene(state.scene);
      nextScene.snapshots = structuredClone(nextSnapshots);
      return {
        snapshots: nextSnapshots,
        scene: nextScene,
      };
    });

    return true;
  },
  markDirty: () => set({ simulationDirty: true }),
  logChange: (entry) =>
    set((state) => ({
      scene: { ...state.scene, changeLog: [...state.scene.changeLog, entry] },
    })),
  clearChangeLog: () =>
    set((state) => ({
      scene: { ...state.scene, changeLog: [] },
    })),

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
      const snapshots = [...s.snapshots, snapshot];
      return {
        snapshots,
        sceneIntelligenceGraph: buildGraphState(parsed, s.simulationResult, s.historyPast.length, snapshots.length),
      };
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
      return {
        snapshots,
        scene,
        sceneIntelligenceGraph: buildGraphState(scene, s.simulationResult, s.historyPast.length, snapshots.length),
      };
    }),

  importScene: (json) => {
    const result = safeParseSecurityScene(json);
    if (!result.success) {
      return { success: false, error: result.error.issues.map((i) => i.message).join(", ") };
    }
    const scene = cloneSecurityScene(result.data);
    const layout = buildPresetDockLayout("edit");
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
      focusMode: false,
      previousLayout: null,
      viewMode: layout.viewMode,
      workspacePreset: layout.workspacePreset,
      canvasMode: layout.canvasMode,
      leftDockCollapsed: layout.leftDockCollapsed,
      rightDockCollapsed: layout.rightDockCollapsed,
      bottomDockCollapsed: layout.bottomDockCollapsed,
      leftDockSizePx: layout.leftDockSizePx,
      rightDockSizePx: layout.rightDockSizePx,
      bottomDockSizePx: layout.bottomDockSizePx,
      visibleComponents: { ...layout.visibleComponents },
      enabledAnalysisModules: { ...layout.enabledAnalysisModules },
      rightPanelMode: layout.rightPanelMode,
      bottomDrawerMode: layout.bottomDrawerMode,
      pinnedAnalysisModule: layout.pinnedAnalysisModule,
      overlayDensity: layout.overlayDensity,
      showDebugOverlays: layout.showDebugOverlays,
      clientDemoOptions: { ...layout.clientDemoOptions },
      bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, viewModeToBottomTab(layout.viewMode)),
      sceneIntelligenceGraph: buildGraphState(scene, null, 0, scene.snapshots.length),
      compareVisualEvidence: null,
      compareReportSelection: null,
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
      focusMode: false,
      previousLayout: null,
      ...buildPresetDockLayout("edit"),
      bottomTab: "metrics",
      inspectorTab: "properties",
      activeTool: "select",
      historyPast: [],
      historyFuture: [],
      sceneIntelligenceGraph: buildGraphState(scene, null, 0, (scene.snapshots ?? []).length),
      compareVisualEvidence: null,
      compareReportSelection: null,
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
    const layout = buildPresetDockLayout("edit");
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
      focusMode: false,
      previousLayout: null,
      viewMode: layout.viewMode,
      workspacePreset: layout.workspacePreset,
      canvasMode: layout.canvasMode,
      leftDockCollapsed: layout.leftDockCollapsed,
      rightDockCollapsed: layout.rightDockCollapsed,
      bottomDockCollapsed: layout.bottomDockCollapsed,
      leftDockSizePx: layout.leftDockSizePx,
      rightDockSizePx: layout.rightDockSizePx,
      bottomDockSizePx: layout.bottomDockSizePx,
      visibleComponents: { ...layout.visibleComponents },
      enabledAnalysisModules: { ...layout.enabledAnalysisModules },
      rightPanelMode: layout.rightPanelMode,
      bottomDrawerMode: layout.bottomDrawerMode,
      pinnedAnalysisModule: layout.pinnedAnalysisModule,
      overlayDensity: layout.overlayDensity,
      showDebugOverlays: layout.showDebugOverlays,
      clientDemoOptions: { ...layout.clientDemoOptions },
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
      sceneIntelligenceGraph: buildGraphState(blank, null, 0, 0),
      compareVisualEvidence: null,
      compareReportSelection: null,
    });
  },

  saveSceneToStorage: () => {
    const scene = get().scene;
    upsertSavedScene(scene);
    get().refreshSavedScenesList();
  },

  loadScenesFromStorage: () => {
    return loadSavedProjectsFromStorage().map((record) => record.scene);
  },

  refreshSavedScenesList: () => {
    const savedProjects = loadSavedProjectsFromStorage();
    const nextProjects = savedProjects.length > 0 ? savedProjects : buildSeededWorkspaceProjects();
    if (savedProjects.length === 0) {
      persistSavedProjects(nextProjects);
    }
    set({
      savedProjects: nextProjects,
      savedScenes: nextProjects.map((record) => record.scene),
    });
  },

  deleteSavedScene: (sceneId) => {
    removeSavedScene(sceneId);
    get().refreshSavedScenesList();
  },

  updateSavedSceneMetadata: (sceneId, patch) => {
    updateSavedSceneMetadata(sceneId, patch);
    get().refreshSavedScenesList();
  },

  getSceneStorageKey: () => PROJECT_STORAGE_KEY,


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
