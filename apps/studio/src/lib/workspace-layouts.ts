import type {
  BottomDrawerMode,
  BottomTab,
  CanvasMode,
  LayerVisibility,
  OverlayDensity,
  RightPanelMode,
  ViewMode,
  WorkspaceComponentId,
  WorkspacePreset,
} from "@/store/studio-store";

export const WORKSPACE_COMPONENT_IDS: WorkspaceComponentId[] = [
  "coverage_legend",
  "north_compass",
  "viewport_controls",
  "control_hint_bar",
  "camera_preset_picker",
  "view_mode_bar",
  "command_bar",
  "status_bar",
  "left_dock",
  "right_dock",
  "bottom_dock",
  "minimap",
];

export const ANALYSIS_MODULE_IDS: BottomTab[] = [
  "outcome",
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
  "help",
  "debug",
  "novel",
];

export type WorkspaceLayoutSnapshot = {
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
  layerVisibility: LayerVisibility;
  rightPanelMode: RightPanelMode;
  bottomDrawerMode: BottomDrawerMode;
  pinnedAnalysisModule: BottomTab | null;
  overlayDensity: OverlayDensity;
  showDebugOverlays: boolean;
  clientDemoOptions: {
    hideDebugModules: boolean;
    simplifiedLabels: boolean;
    criticalIssuesOnly: boolean;
    lockLayout: boolean;
  };
};

const BASE_COMPONENT_VISIBILITY: Record<WorkspaceComponentId, boolean> = {
  coverage_legend: true,
  north_compass: true,
  viewport_controls: true,
  control_hint_bar: true,
  camera_preset_picker: true,
  view_mode_bar: true,
  command_bar: true,
  status_bar: true,
  left_dock: true,
  right_dock: true,
  bottom_dock: true,
  minimap: true,
};

export const DEFAULT_LAYERS: LayerVisibility = {
  cameras: true,
  camera_cones: true,
  obstructions: true,
  lights: true,
  critical_zones: true,
  privacy_zones: true,
  paths: true,
  heatmap: true,
  grid: true,
  walls_floors: true,
  labels: true,
};

const BASE_ANALYSIS_MODULE_VISIBILITY: Record<BottomTab, boolean> = {
  outcome: true,
  metrics: true,
  issues: true,
  sensors: true,
  timeline: true,
  temporal: true,
  beforeafter: true,
  assumptions: true,
  governance: true,
  provenance: true,
  redundancy: true,
  counterfactual: true,
  threat: true,
  report: true,
  help: true,
  debug: false,
  novel: false,
};

export const PRESET_VIEW_MODES: Record<WorkspacePreset, ViewMode> = {
  edit: "map",
  coverage: "camera_view",
  camera_wall: "wall",
  replay: "replay",
  compare: "compare",
  report: "report",
  debug: "map",
  focus: "map",
};

export const PRESET_CANVAS_MODES: Record<WorkspacePreset, CanvasMode> = {
  edit: "orbit_3d",
  coverage: "orbit_3d",
  camera_wall: "topdown_2d",
  replay: "orbit_3d",
  compare: "orbit_3d",
  report: "orbit_3d",
  debug: "orbit_3d",
  focus: "orbit_3d",
};

export const PRESET_RIGHT_PANEL_MODES: Record<WorkspacePreset, RightPanelMode> = {
  edit: "inspector",
  coverage: "security_status",
  camera_wall: "security_status",
  replay: "issues",
  compare: "recommendations",
  report: "assumptions",
  debug: "inspector",
  focus: "security_status",
};

export const PRESET_BOTTOM_DRAWER_MODES: Record<WorkspacePreset, BottomDrawerMode> = {
  edit: "tabs",
  coverage: "tabs",
  camera_wall: "hidden",
  replay: "tabs",
  compare: "single_module",
  report: "single_module",
  debug: "tabs",
  focus: "hidden",
};

export const PRESET_PINNED_MODULES: Record<WorkspacePreset, BottomTab | null> = {
  edit: null,
  coverage: null,
  camera_wall: null,
  replay: "timeline",
  compare: "beforeafter",
  report: "report",
  debug: "debug",
  focus: null,
};

export const PRESET_LAYOUT_SIZES: Record<WorkspacePreset, { left: number; right: number; bottom: number }> = {
  edit: { left: 248, right: 344, bottom: 360 },
  coverage: { left: 232, right: 372, bottom: 360 },
  camera_wall: { left: 48, right: 48, bottom: 36 },
  replay: { left: 48, right: 360, bottom: 360 },
  compare: { left: 48, right: 368, bottom: 360 },
  report: { left: 48, right: 368, bottom: 320 },
  debug: { left: 248, right: 368, bottom: 360 },
  focus: { left: 48, right: 48, bottom: 36 },
};

function cloneVisibilityMap<T extends string>(map: Record<T, boolean>): Record<T, boolean> {
  return { ...map };
}

export function createDefaultVisibleComponents(preset: WorkspacePreset): Record<WorkspaceComponentId, boolean> {
  const visible = cloneVisibilityMap(BASE_COMPONENT_VISIBILITY);
  if (preset === "camera_wall" || preset === "focus") {
    visible.left_dock = false;
    visible.right_dock = false;
    visible.bottom_dock = false;
    visible.command_bar = false;
    visible.control_hint_bar = false;
    visible.camera_preset_picker = false;
  }
  if (preset === "report") {
    visible.command_bar = false;
  }
  if (preset === "debug") {
    visible.minimap = true;
  }
  return visible;
}

export function createDefaultEnabledAnalysisModules(preset: WorkspacePreset): Record<BottomTab, boolean> {
  const enabled = cloneVisibilityMap(BASE_ANALYSIS_MODULE_VISIBILITY);
  if (preset === "focus") {
    enabled.timeline = false;
    enabled.temporal = false;
    enabled.beforeafter = false;
    enabled.provenance = false;
    enabled.redundancy = false;
    enabled.counterfactual = false;
    enabled.threat = false;
    enabled.debug = false;
    enabled.novel = false;
  }
  if (preset === "camera_wall") {
    enabled.timeline = false;
    enabled.temporal = false;
    enabled.beforeafter = false;
    enabled.assumptions = false;
    enabled.provenance = false;
    enabled.redundancy = false;
    enabled.counterfactual = false;
    enabled.threat = false;
    enabled.debug = false;
    enabled.novel = false;
  }
  if (preset === "report") {
    enabled.debug = false;
    enabled.novel = false;
  }
  if (preset === "compare") {
    enabled.debug = false;
    enabled.novel = false;
  }
  return enabled;
}

export function getPresetLayoutSnapshot(preset: WorkspacePreset, layerVisibility: LayerVisibility): WorkspaceLayoutSnapshot {
  const sizes = PRESET_LAYOUT_SIZES[preset];
  return {
    viewMode: PRESET_VIEW_MODES[preset],
    workspacePreset: preset,
    canvasMode: PRESET_CANVAS_MODES[preset],
    leftDockCollapsed: preset === "camera_wall" || preset === "replay" || preset === "compare" || preset === "report" || preset === "focus",
    rightDockCollapsed: preset === "camera_wall" || preset === "focus",
    bottomDockCollapsed: preset === "camera_wall" || preset === "focus",
    leftDockSizePx: sizes.left,
    rightDockSizePx: sizes.right,
    bottomDockSizePx: sizes.bottom,
    visibleComponents: createDefaultVisibleComponents(preset),
    enabledAnalysisModules: createDefaultEnabledAnalysisModules(preset),
    layerVisibility: { ...layerVisibility },
    rightPanelMode: PRESET_RIGHT_PANEL_MODES[preset],
    bottomDrawerMode: PRESET_BOTTOM_DRAWER_MODES[preset],
    pinnedAnalysisModule: PRESET_PINNED_MODULES[preset],
    overlayDensity: preset === "debug" ? "all" : preset === "focus" ? "compact" : "all",
    showDebugOverlays: preset === "debug",
    clientDemoOptions: {
      hideDebugModules: preset === "focus" || preset === "camera_wall",
      simplifiedLabels: preset === "focus" || preset === "camera_wall" || preset === "report",
      criticalIssuesOnly: preset === "focus",
      lockLayout: preset === "focus",
    },
  };
}

export function isWorkspaceLayoutModified(
  current: WorkspaceLayoutSnapshot,
  baseline: WorkspaceLayoutSnapshot,
) {
  return JSON.stringify(current) !== JSON.stringify(baseline);
}
