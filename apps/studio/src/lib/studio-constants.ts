import type { ActiveTool, ViewMode, WorkspacePreset } from "@/store/studio-store";

/** Map keyboard digit 1–5 to view mode. Used in StudioShell keyboard handler. */
export const VIEW_MODE_KEYS: Record<string, ViewMode> = {
  "1": "map",
  "2": "camera_view",
  "3": "wall",
  "4": "replay",
  "5": "compare",
  "6": "report",
};

/** Canonical view-mode → workspace-preset mapping. Used by ViewModeBar and StudioShell. */
export const VIEW_MODE_PRESETS: Record<ViewMode, WorkspacePreset> = {
  map: "edit",
  camera_view: "coverage",
  wall: "camera_wall",
  replay: "replay",
  compare: "compare",
  report: "report",
};

/** Single-key tool shortcuts used in StudioShell keyboard handler. */
export const TOOL_SHORTCUTS: Record<string, ActiveTool> = {
  v: "select",
  c: "camera",
  b: "obstruction",
  l: "light",
  p: "path",
  z: "zone",
  d: "door_window",
  w: "wall",
  m: "measure",
  t: "comment",
};
