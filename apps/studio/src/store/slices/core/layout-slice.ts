import {
  getPresetLayoutSnapshot,
  DEFAULT_LAYERS,
  isWorkspaceLayoutModified,
  PRESET_BOTTOM_DRAWER_MODES,
  PRESET_CANVAS_MODES,
  PRESET_LAYOUT_SIZES,
  PRESET_PINNED_MODULES,
  PRESET_RIGHT_PANEL_MODES,
  PRESET_VIEW_MODES,
  type WorkspaceLayoutSnapshot,
} from "@/lib/workspace-layouts";

export type ViewMode = "map" | "wall" | "replay" | "camera_view" | "compare" | "report" | "analytics";
export type CanvasMode = "orbit_3d" | "topdown_2d";
export type DockSide = "left" | "right" | "bottom";
export type RightPanelMode =
  | "inspector"
  | "security_status"
  | "issues"
  | "recommendations"
  | "assumptions"
  | "camera_controls"
  | "bulk_camera"
  | "governance";
export type BottomDrawerMode = "tabs" | "single_module" | "hidden";
export type WorkspacePreset =
  | "edit"
  | "coverage"
  | "camera_wall"
  | "replay"
  | "compare"
  | "report"
  | "debug"
  | "focus";
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
export type BottomTab =
  | "outcome"
  | "metrics"
  | "issues"
  | "sensors"
  | "timeline"
  | "beforeafter"
  | "report"
  | "help"
  | "debug"
  | "counterfactual"
  | "threat"
  | "redundancy"
  | "temporal"
  | "assumptions"
  | "governance"
  | "provenance"
  | "novel"
  | "budgeting";
export type OverlayDensity = "all" | "compact" | "minimal";
export type UiDensity = "compact" | "normal" | "comfortable";
export type UiTheme = "dark" | "light";
export type OverlayFilterId = "cameraLabels" | "zoneLabels" | "obstructionWarnings" | "entryChips" | "pathLabels";
export type OverlayFilters = Record<OverlayFilterId, boolean>;
export type LayerId =
  | "cameras"
  | "camera_cones"
  | "obstructions"
  | "lights"
  | "critical_zones"
  | "privacy_zones"
  | "paths"
  | "heatmap"
  | "grid"
  | "walls_floors"
  | "labels";
export type LayerVisibility = Record<LayerId, boolean>;

type DockSnapshot = WorkspaceLayoutSnapshot;

// ── Storage keys ──

const UI_THEME_STORAGE_KEY = "sentineltwin_ui_theme";
const UI_DENSITY_STORAGE_KEY = "sentineltwin_ui_density";

// ── Module-level constants ──

const DEFAULT_DOCK_SIZES = PRESET_LAYOUT_SIZES.edit;

const ANALYSIS_TAB_ORDER: BottomTab[] = [
  "metrics",
  "issues",
  "sensors",
  "timeline",
  "temporal",
  "beforeafter",
  "assumptions",
  "governance",
  "provenance",
  "redundancy",
  "counterfactual",
  "threat",
  "report",
  "debug",
  "novel",
];

// ── Storage helpers ──

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

// ── Pure helper functions ──

function clampDockSize(side: DockSide, sizePx: number): number {
  const min = side === "bottom" ? 160 : 180;
  const max = side === "bottom" ? 480 : 520;
  return Math.max(min, Math.min(max, Math.round(sizePx)));
}

function buildPresetDockLayout(preset: WorkspacePreset): DockSnapshot {
  const layout = getPresetLayoutSnapshot(preset, DEFAULT_LAYERS);
  return { ...layout };
}

function viewModeToPreset(mode: ViewMode): WorkspacePreset {
  // Analytics reuses the analysis-first coverage layout; it has no dedicated preset.
  if (mode === "analytics") return "coverage";
  const match = (Object.entries(PRESET_VIEW_MODES) as [WorkspacePreset, ViewMode][]).find(
    ([, presetViewMode]) => presetViewMode === mode,
  );
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
    case "analytics":
      return "metrics";
    case "wall":
    default:
      return "metrics";
  }
}

function dockSizeKey(side: DockSide): "leftDockSizePx" | "rightDockSizePx" | "bottomDockSizePx" {
  return side === "left"
    ? "leftDockSizePx"
    : side === "right"
      ? "rightDockSizePx"
      : "bottomDockSizePx";
}

function dockCollapsedKey(side: DockSide): "leftDockCollapsed" | "rightDockCollapsed" | "bottomDockCollapsed" {
  return side === "left"
    ? "leftDockCollapsed"
    : side === "right"
      ? "rightDockCollapsed"
      : "bottomDockCollapsed";
}

function getFirstEnabledAnalysisTab(
  enabledAnalysisModules: Record<BottomTab, boolean>,
  preferred?: BottomTab | null,
): BottomTab {
  if (preferred && enabledAnalysisModules[preferred]) return preferred;
  return ANALYSIS_TAB_ORDER.find((tab) => enabledAnalysisModules[tab]) ?? "metrics";
}

function snapshotLayout(state: {
  viewMode: ViewMode;
  workspacePreset: WorkspacePreset;
  canvasMode: CanvasMode;
  leftDockCollapsed: boolean;
  rightDockCollapsed: boolean;
  bottomDockCollapsed: boolean;
  leftDockSizePx: number;
  rightDockSizePx: number;
  bottomDockSizePx: number;
  visibleComponents: Record<WorkspaceComponentId, boolean>;
  enabledAnalysisModules: Record<BottomTab, boolean>;
  rightPanelMode: RightPanelMode;
  bottomDrawerMode: BottomDrawerMode;
  pinnedAnalysisModule: BottomTab | null;
  layerVisibility: LayerVisibility;
  overlayDensity: OverlayDensity;
  showDebugOverlays: boolean;
  clientDemoOptions: { hideDebugModules: boolean; simplifiedLabels: boolean; criticalIssuesOnly: boolean; lockLayout: boolean };
}): DockSnapshot {
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

function buildLayoutStatePatch(layout: DockSnapshot): {
  viewMode: ViewMode;
  workspacePreset: WorkspacePreset;
  canvasMode: CanvasMode;
  leftDockCollapsed: boolean;
  rightDockCollapsed: boolean;
  bottomDockCollapsed: boolean;
  leftDockSizePx: number;
  rightDockSizePx: number;
  bottomDockSizePx: number;
  visibleComponents: Record<WorkspaceComponentId, boolean>;
  enabledAnalysisModules: Record<BottomTab, boolean>;
  rightPanelMode: RightPanelMode;
  bottomDrawerMode: BottomDrawerMode;
  pinnedAnalysisModule: BottomTab | null;
  overlayDensity: OverlayDensity;
  showDebugOverlays: boolean;
  clientDemoOptions: { hideDebugModules: boolean; simplifiedLabels: boolean; criticalIssuesOnly: boolean; lockLayout: boolean };
  layerVisibility: LayerVisibility;
} {
  return {
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
    layerVisibility: { ...layout.layerVisibility },
  };
}

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "map";
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "wall" || mode === "replay" || mode === "camera_view" || mode === "compare" || mode === "report" || mode === "analytics" || mode === "map") {
    return mode;
  }
  return "map";
}

// ── Initial values (computed once at module scope via lazy init) ──

let _initialized = false;
let _initialViewMode: ViewMode = "map";
let _initialWorkspacePreset: WorkspacePreset = "edit";
let _initialLayout: DockSnapshot = null!;

function ensureInitialized() {
  if (_initialized) return;
  _initialViewMode = getInitialViewMode();
  _initialWorkspacePreset = viewModeToPreset(_initialViewMode);
  _initialLayout = buildPresetDockLayout(_initialWorkspacePreset);
  _initialized = true;
}

// ── Layout Slice Interface ──

export interface LayoutSlice {
  viewMode: ViewMode;
  canvasMode: CanvasMode;
  workspacePreset: WorkspacePreset;
  canvasViewResetTick: number;
  focusMode: boolean;
  leftDockCollapsed: boolean;
  rightDockCollapsed: boolean;
  bottomDockCollapsed: boolean;
  dockAttention: Record<DockSide, boolean>;
  leftDockSizePx: number;
  rightDockSizePx: number;
  bottomDockSizePx: number;
  bottomTab: BottomTab;
  rightPanelMode: RightPanelMode;
  bottomDrawerMode: BottomDrawerMode;
  pinnedAnalysisModule: BottomTab | null;
  previousLayout: DockSnapshot | null;
  visibleComponents: Record<WorkspaceComponentId, boolean>;
  enabledAnalysisModules: Record<BottomTab, boolean>;
  layerVisibility: LayerVisibility;
  overlayDensity: OverlayDensity;
  uiDensity: UiDensity;
  uiTheme: UiTheme;
  overlayFilters: OverlayFilters;
  showDebugOverlays: boolean;
  clientDemoOptions: { hideDebugModules: boolean; simplifiedLabels: boolean; criticalIssuesOnly: boolean; lockLayout: boolean };
  viewSettingsOpen: boolean;

  setViewMode: (mode: ViewMode) => void;
  setWorkspacePreset: (preset: WorkspacePreset) => void;
  setCanvasMode: (mode: CanvasMode) => void;
  resetCanvasView: () => void;
  toggleDock: (side: DockSide) => void;
  setDockCollapsed: (side: DockSide, collapsed: boolean) => void;
  clearDockAttention: (side: DockSide) => void;
  setDockSize: (side: DockSide, sizePx: number) => void;
  setRightPanelMode: (mode: RightPanelMode) => void;
  setBottomDrawerMode: (mode: BottomDrawerMode) => void;
  setPinnedAnalysisModule: (moduleId: BottomTab | null) => void;
  enterFocusMode: () => void;
  restorePreviousLayout: () => void;
  setBottomTab: (tab: BottomTab) => void;
  toggleLayer: (layer: LayerId) => void;
  setLayerVisibility: (layer: LayerId, visible: boolean) => void;
  setShowDebugOverlays: (enabled: boolean) => void;
  setVisibleComponent: (component: WorkspaceComponentId, visible: boolean) => void;
  toggleVisibleComponent: (component: WorkspaceComponentId) => void;
  setAnalysisModuleEnabled: (moduleId: BottomTab, enabled: boolean) => void;
  toggleAnalysisModule: (moduleId: BottomTab) => void;
  setOverlayDensity: (density: OverlayDensity) => void;
  setUiDensity: (density: UiDensity) => void;
  setUiTheme: (theme: UiTheme) => void;
  setOverlayFilter: (filter: OverlayFilterId, visible: boolean) => void;
  setViewSettingsOpen: (open: boolean) => void;
  toggleViewSettingsOpen: () => void;
}

// ── Slice creator ──

export const createLayoutSlice = (set: any, get: any, store: any): LayoutSlice => {
  ensureInitialized();

  return {
    viewMode: _initialViewMode,
    bottomTab: viewModeToBottomTab(_initialViewMode),
    workspacePreset: _initialLayout.workspacePreset,
    canvasMode: _initialLayout.canvasMode,
    canvasViewResetTick: 0,
    focusMode: false,
    leftDockCollapsed: _initialLayout.leftDockCollapsed,
    rightDockCollapsed: _initialLayout.rightDockCollapsed,
    bottomDockCollapsed: _initialLayout.bottomDockCollapsed,
    dockAttention: { left: false, right: false, bottom: false },
    leftDockSizePx: _initialLayout.leftDockSizePx,
    rightDockSizePx: _initialLayout.rightDockSizePx,
    bottomDockSizePx: _initialLayout.bottomDockSizePx,
    rightPanelMode: _initialLayout.rightPanelMode,
    bottomDrawerMode: _initialLayout.bottomDrawerMode,
    pinnedAnalysisModule: _initialLayout.pinnedAnalysisModule,
    previousLayout: null,
    layerVisibility: { ...DEFAULT_LAYERS },
    showDebugOverlays: _initialLayout.showDebugOverlays,
    overlayDensity: _initialLayout.overlayDensity,
    uiDensity: loadUiDensity(),
    uiTheme: loadUiTheme(),
    overlayFilters: {
      cameraLabels: true,
      zoneLabels: true,
      obstructionWarnings: true,
      entryChips: true,
      pathLabels: true,
    },
    viewSettingsOpen: false,
    visibleComponents: _initialLayout.visibleComponents,
    enabledAnalysisModules: _initialLayout.enabledAnalysisModules,
    clientDemoOptions: _initialLayout.clientDemoOptions,

    setViewMode: (mode) => {
      const preset = viewModeToPreset(mode);
      const layout = buildPresetDockLayout(preset);
      const patch = buildLayoutStatePatch(layout);
      const autoTab = getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, viewModeToBottomTab(mode));
      set({
        ...patch,
        // The preset supplies the dock layout, but the requested mode always wins.
        viewMode: mode,
        focusMode: false,
        previousLayout: null,
        bottomTab: autoTab,
      });
    },

    setWorkspacePreset: (preset) =>
      set((state: any) => {
        if (preset === "focus") {
          if (state.focusMode) return state;
          const layout = buildPresetDockLayout("focus");
          const patch = buildLayoutStatePatch(layout);
          return {
            previousLayout: snapshotLayout(state),
            ...patch,
            focusMode: true,
            bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, state.bottomTab),
          };
        }
        const layout = buildPresetDockLayout(preset);
        const patch = buildLayoutStatePatch(layout);
        return {
          ...patch,
          focusMode: false,
          previousLayout: null,
          bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, viewModeToBottomTab(layout.viewMode)),
        };
      }),

    setCanvasMode: (mode) => set({ canvasMode: mode }),

    resetCanvasView: () => set((state: any) => ({ canvasViewResetTick: state.canvasViewResetTick + 1 })),

    toggleDock: (side) =>
      set((state: any) => {
        if (state.focusMode) return state;
        const key = dockCollapsedKey(side);
        return { [key]: !state[key] };
      }),

    setDockCollapsed: (side, collapsed) =>
      set((state: any) => {
        if (state.focusMode) return state;
        const key = dockCollapsedKey(side);
        return {
          [key]: collapsed,
          dockAttention: collapsed
            ? state.dockAttention
            : { ...state.dockAttention, [side]: false },
        };
      }),

    clearDockAttention: (side) =>
      set((state: any) => ({
        dockAttention: { ...state.dockAttention, [side]: false },
      })),

    setDockSize: (side, sizePx) =>
      set((state: any) => {
        if (state.focusMode) return state;
        const key = dockSizeKey(side);
        return { [key]: clampDockSize(side, sizePx) };
      }),

    setRightPanelMode: (mode) =>
      set((state: any) => ({
        rightPanelMode: mode,
        dockAttention: state.rightDockCollapsed
          ? { ...state.dockAttention, right: true }
          : state.dockAttention,
      })),

    setBottomDrawerMode: (mode) => set({ bottomDrawerMode: mode }),

    setPinnedAnalysisModule: (moduleId) => set({ pinnedAnalysisModule: moduleId }),

    enterFocusMode: () =>
      set((state: any) => {
        if (state.focusMode) return state;
        const layout = buildPresetDockLayout("focus");
        const patch = buildLayoutStatePatch(layout);
        return {
          previousLayout: snapshotLayout(state),
          ...patch,
          focusMode: true,
          bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, state.bottomTab),
        };
      }),

    restorePreviousLayout: () =>
      set((state: any) => {
        if (!state.previousLayout) return state;
        const layout = state.previousLayout;
        const patch = buildLayoutStatePatch(layout);
        return {
          ...patch,
          focusMode: false,
          previousLayout: null,
          bottomTab: getFirstEnabledAnalysisTab(layout.enabledAnalysisModules, layout.pinnedAnalysisModule),
        };
      }),

    setBottomTab: (tab) =>
      set((state: any) => ({
        bottomTab: getFirstEnabledAnalysisTab(state.enabledAnalysisModules, tab),
        pinnedAnalysisModule:
          state.bottomDrawerMode === "single_module"
            ? getFirstEnabledAnalysisTab(state.enabledAnalysisModules, tab)
            : state.pinnedAnalysisModule,
        dockAttention: state.bottomDockCollapsed
          ? { ...state.dockAttention, bottom: true }
          : state.dockAttention,
      })),

    toggleLayer: (layer) =>
      set((s: any) => ({ layerVisibility: { ...s.layerVisibility, [layer]: !s.layerVisibility[layer] } })),

    setLayerVisibility: (layer, visible) =>
      set((s: any) => ({ layerVisibility: { ...s.layerVisibility, [layer]: visible } })),

    setShowDebugOverlays: (enabled) => set({ showDebugOverlays: enabled }),

    setVisibleComponent: (component, visible) =>
      set((state: any) => ({
        visibleComponents: { ...state.visibleComponents, [component]: visible },
      })),

    toggleVisibleComponent: (component) =>
      set((state: any) => ({
        visibleComponents: { ...state.visibleComponents, [component]: !state.visibleComponents[component] },
      })),

    setAnalysisModuleEnabled: (moduleId, enabled) =>
      set((state: any) => {
        const enabledAnalysisModules = { ...state.enabledAnalysisModules, [moduleId]: enabled };
        const bottomTab = enabledAnalysisModules[state.bottomTab]
          ? state.bottomTab
          : getFirstEnabledAnalysisTab(enabledAnalysisModules, state.pinnedAnalysisModule);
        const pinnedAnalysisModule =
          state.bottomDrawerMode === "single_module"
            ? getFirstEnabledAnalysisTab(enabledAnalysisModules, state.pinnedAnalysisModule)
            : state.pinnedAnalysisModule;
        return { enabledAnalysisModules, bottomTab, pinnedAnalysisModule };
      }),

    toggleAnalysisModule: (moduleId) =>
      set((state: any) => {
        const enabled = !state.enabledAnalysisModules[moduleId];
        const enabledAnalysisModules = { ...state.enabledAnalysisModules, [moduleId]: enabled };
        const bottomTab = enabledAnalysisModules[state.bottomTab]
          ? state.bottomTab
          : getFirstEnabledAnalysisTab(enabledAnalysisModules, state.pinnedAnalysisModule);
        const pinnedAnalysisModule =
          state.bottomDrawerMode === "single_module"
            ? getFirstEnabledAnalysisTab(enabledAnalysisModules, state.pinnedAnalysisModule)
            : state.pinnedAnalysisModule;
        return { enabledAnalysisModules, bottomTab, pinnedAnalysisModule };
      }),

    setOverlayDensity: (density) => set({ overlayDensity: density }),

    setUiDensity: (uiDensity) => set({ uiDensity }),

    setUiTheme: (uiTheme) => set({ uiTheme }),

    setOverlayFilter: (filter, visible) =>
      set((s: any) => ({ overlayFilters: { ...s.overlayFilters, [filter]: visible } })),

    setViewSettingsOpen: (open) => set({ viewSettingsOpen: open }),

    toggleViewSettingsOpen: () => set((state: any) => ({ viewSettingsOpen: !state.viewSettingsOpen })),
  };
};
