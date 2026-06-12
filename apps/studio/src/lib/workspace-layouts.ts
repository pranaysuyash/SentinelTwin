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
  "budgeting",
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

export type WorkspaceLayoutRecord = WorkspaceLayoutSnapshot & {
  id: string;
  name: string;
  createdAt: number;
  schemaVersion: number;
};

export const LAYOUT_STORAGE_VERSION = 2;

type UnknownRecord = Record<string, unknown>;

const WORKSPACE_PRESETS: WorkspacePreset[] = [
  "edit",
  "coverage",
  "camera_wall",
  "replay",
  "compare",
  "report",
  "debug",
  "focus",
];

const PRESET_NAME_BY_KEY: Record<WorkspacePreset, string> = {
  edit: "Edit",
  coverage: "Coverage",
  camera_wall: "Camera Wall",
  replay: "Replay",
  compare: "Compare",
  report: "Report",
  debug: "Debug",
  focus: "Focus",
};

function isPlainObject(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isWorkspacePreset(value: unknown): value is WorkspacePreset {
  return typeof value === "string" && (WORKSPACE_PRESETS as readonly string[]).includes(value);
}

function isViewMode(value: unknown): value is ViewMode {
  return value === "map" || value === "wall" || value === "replay" || value === "camera_view" || value === "compare" || value === "report";
}

function isCanvasMode(value: unknown): value is CanvasMode {
  return value === "orbit_3d" || value === "topdown_2d";
}

function isBottomTab(value: unknown): value is BottomTab {
  return typeof value === "string" && ANALYSIS_MODULE_IDS.includes(value as BottomTab);
}

function isBottomDrawer(value: unknown): value is BottomDrawerMode {
  return value === "tabs" || value === "single_module" || value === "hidden";
}

function isRightPanelMode(value: unknown): value is RightPanelMode {
  return value === "inspector"
    || value === "security_status"
    || value === "issues"
    || value === "recommendations"
    || value === "assumptions"
    || value === "camera_controls"
    || value === "bulk_camera"
    || value === "governance";
}

function isOverlayDensity(value: unknown): value is OverlayDensity {
  return value === "all" || value === "compact" || value === "minimal";
}

function clampNumber(value: unknown, fallback: number): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function coerceNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function cloneRecordMap<T extends string>(baseline: Record<T, boolean>, raw?: UnknownRecord): Record<T, boolean> {
  const next = { ...baseline } as Record<T, boolean>;
  if (!isPlainObject(raw)) return next;
  for (const key of Object.keys(next) as T[]) {
    if (typeof raw[key] === "boolean") next[key] = raw[key];
  }
  return next;
}

function normalizeWorkspaceLayoutRecordCandidate(candidate: UnknownRecord): WorkspaceLayoutRecord | null {
  const preset = isWorkspacePreset(candidate.workspacePreset) ? candidate.workspacePreset : "edit";
  const presetSnapshot = getPresetLayoutSnapshot(preset, DEFAULT_LAYERS);
  const normalized = {
    viewMode: isViewMode(candidate.viewMode) ? candidate.viewMode : presetSnapshot.viewMode,
    workspacePreset: preset,
    canvasMode: isCanvasMode(candidate.canvasMode) ? candidate.canvasMode : presetSnapshot.canvasMode,
    leftDockCollapsed: coerceBoolean(candidate.leftDockCollapsed, presetSnapshot.leftDockCollapsed),
    rightDockCollapsed: coerceBoolean(candidate.rightDockCollapsed, presetSnapshot.rightDockCollapsed),
    bottomDockCollapsed: coerceBoolean(candidate.bottomDockCollapsed, presetSnapshot.bottomDockCollapsed),
    leftDockSizePx: Math.round(clampNumber(candidate.leftDockSizePx, presetSnapshot.leftDockSizePx)),
    rightDockSizePx: Math.round(clampNumber(candidate.rightDockSizePx, presetSnapshot.rightDockSizePx)),
    bottomDockSizePx: Math.round(clampNumber(candidate.bottomDockSizePx, presetSnapshot.bottomDockSizePx)),
    visibleComponents: cloneRecordMap(presetSnapshot.visibleComponents, candidate.visibleComponents as UnknownRecord),
    enabledAnalysisModules: cloneRecordMap(presetSnapshot.enabledAnalysisModules, candidate.enabledAnalysisModules as UnknownRecord),
    layerVisibility: cloneRecordMap(presetSnapshot.layerVisibility, candidate.layerVisibility as UnknownRecord),
    rightPanelMode: isRightPanelMode(candidate.rightPanelMode) ? candidate.rightPanelMode : presetSnapshot.rightPanelMode,
    bottomDrawerMode: isBottomDrawer(candidate.bottomDrawerMode) ? candidate.bottomDrawerMode : presetSnapshot.bottomDrawerMode,
    pinnedAnalysisModule: isBottomTab(candidate.pinnedAnalysisModule) ? candidate.pinnedAnalysisModule : presetSnapshot.pinnedAnalysisModule,
    overlayDensity: isOverlayDensity(candidate.overlayDensity) ? candidate.overlayDensity : presetSnapshot.overlayDensity,
    showDebugOverlays: coerceBoolean(candidate.showDebugOverlays, presetSnapshot.showDebugOverlays),
    clientDemoOptions: {
      hideDebugModules: coerceBoolean((candidate.clientDemoOptions as UnknownRecord)?.hideDebugModules, presetSnapshot.clientDemoOptions.hideDebugModules),
      simplifiedLabels: coerceBoolean((candidate.clientDemoOptions as UnknownRecord)?.simplifiedLabels, presetSnapshot.clientDemoOptions.simplifiedLabels),
      criticalIssuesOnly: coerceBoolean((candidate.clientDemoOptions as UnknownRecord)?.criticalIssuesOnly, presetSnapshot.clientDemoOptions.criticalIssuesOnly),
      lockLayout: coerceBoolean((candidate.clientDemoOptions as UnknownRecord)?.lockLayout, presetSnapshot.clientDemoOptions.lockLayout),
    },
  };
  const id = coerceNonEmptyString(candidate.id, `layout_${Math.random().toString(36).slice(2, 9)}`);
  const createdAt = clampNumber(candidate.createdAt, Date.now());
  const createdName = coerceNonEmptyString(candidate.name, PRESET_NAME_BY_KEY[normalized.workspacePreset]);
  return {
    ...normalized,
    id,
    name: createdName,
    createdAt,
    schemaVersion: typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : LAYOUT_STORAGE_VERSION,
  };
}

export function normalizeSavedLayoutRecords(raw: unknown): WorkspaceLayoutRecord[] {
  if (!isPlainObject(raw) && !Array.isArray(raw)) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => (isPlainObject(entry) ? normalizeWorkspaceLayoutRecordCandidate(entry) : null))
      .filter((layout): layout is WorkspaceLayoutRecord => layout !== null);
  }

  const payload = raw as UnknownRecord;
  if (Array.isArray(payload.layouts)) {
    return payload.layouts
      .map((entry) => (isPlainObject(entry) ? normalizeWorkspaceLayoutRecordCandidate(entry) : null))
      .filter((layout): layout is WorkspaceLayoutRecord => layout !== null);
  }

  return [];
}

export function buildSeededLayouts(baseTime = Date.now()): WorkspaceLayoutRecord[] {
  return (["edit", "coverage", "camera_wall", "replay", "compare", "report"] as const).map((preset, index) => {
    const layout = getPresetLayoutSnapshot(preset, DEFAULT_LAYERS);
    return {
      id: `seeded_layout_${preset}`,
      name: PRESET_NAME_BY_KEY[preset],
      schemaVersion: LAYOUT_STORAGE_VERSION,
      createdAt: baseTime + index * 60_000,
      ...layout,
    };
  });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const out: UnknownRecord = {};
    keys.forEach((key) => {
      out[key] = canonicalize(value[key]);
    });
    return out;
  }
  return value;
}

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
  novel: true,
  budgeting: true,
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
    // Default to minimized docks; users expand intentionally as needed.
    leftDockCollapsed: true,
    rightDockCollapsed: true,
    bottomDockCollapsed: true,
    leftDockSizePx: sizes.left,
    rightDockSizePx: sizes.right,
    bottomDockSizePx: sizes.bottom,
    visibleComponents: createDefaultVisibleComponents(preset),
    enabledAnalysisModules: createDefaultEnabledAnalysisModules(preset),
    layerVisibility: { ...layerVisibility },
    rightPanelMode: PRESET_RIGHT_PANEL_MODES[preset],
    bottomDrawerMode: PRESET_BOTTOM_DRAWER_MODES[preset],
    pinnedAnalysisModule: PRESET_PINNED_MODULES[preset],
    overlayDensity: preset === "debug" ? "all" : "compact",
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
  return JSON.stringify(canonicalize(current)) !== JSON.stringify(canonicalize(baseline));
}
