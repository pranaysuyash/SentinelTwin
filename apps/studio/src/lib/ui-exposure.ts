/**
 * UI Exposure Levels — SentinelTwin Studio
 *
 * One dial that composes the existing chrome controls (visibleComponents,
 * dock collapse, client-demo options, overlay density) into three coherent
 * postures. This is the lesson from pascalorg/editor's shell: their entire
 * editor chrome is one toolbar + contextual tooltips, and everything else is
 * progressive disclosure. SentinelTwin has ~12 chrome regions that were all
 * on by default; the exposure dial makes the DEFAULT quiet while keeping
 * every feature one gesture away.
 *
 * Levels:
 *  - showcase — sales/demo posture: canvas-first, docks docked-but-collapsed,
 *    simplified labels, no hint bar, no debug modules. Nothing is removed —
 *    every dock/panel still opens on click or contextual attention.
 *  - focused — default working posture: contextual chrome, hints on, debug
 *    modules hidden until asked for.
 *  - full — power posture: everything pinned open, debug lanes included.
 *
 * Setting a level APPLIES a preset to the existing store keys; the user can
 * still override any individual toggle afterwards (the dial is a composer,
 * not a lock — clientDemoOptions.lockLayout remains a separate choice).
 */

import type { WorkspaceComponentId } from "@/store/slices/core/layout-slice";

export type UiExposureLevel = "showcase" | "focused" | "full";

export interface UiExposurePreset {
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  /** Merged over current visibleComponents; absent keys stay user-controlled. */
  readonly visibleComponents: Partial<Record<WorkspaceComponentId, boolean>>;
  readonly dockCollapsed: { left: boolean; right: boolean; bottom: boolean };
  readonly clientDemoOptions: {
    hideDebugModules: boolean;
    simplifiedLabels: boolean;
  };
}

export const UI_EXPOSURE_ORDER: readonly UiExposureLevel[] = ["showcase", "focused", "full"];

export const UI_EXPOSURE_PRESETS: Readonly<Record<UiExposureLevel, UiExposurePreset>> =
  Object.freeze({
    showcase: {
      label: "Showcase",
      shortLabel: "DEMO",
      description:
        "Canvas-first for client demos: docks collapsed, simplified labels, hints and debug chrome quiet. Everything reopens on click.",
      visibleComponents: {
        coverage_legend: true,
        viewport_controls: true,
        view_mode_bar: true,
        command_bar: true,
        status_bar: true,
        camera_preset_picker: true,
        north_compass: false,
        control_hint_bar: false,
        minimap: false,
        level_switcher: false,
      },
      dockCollapsed: { left: true, right: true, bottom: true },
      clientDemoOptions: { hideDebugModules: true, simplifiedLabels: true },
    },
    focused: {
      label: "Focused",
      shortLabel: "WORK",
      description:
        "Default working posture: contextual docks, hints on, debug modules hidden until needed.",
      visibleComponents: {
        coverage_legend: true,
        viewport_controls: true,
        view_mode_bar: true,
        command_bar: true,
        status_bar: true,
        camera_preset_picker: true,
        north_compass: true,
        control_hint_bar: true,
        minimap: true,
        level_switcher: true,
      },
      dockCollapsed: { left: true, right: false, bottom: true },
      clientDemoOptions: { hideDebugModules: true, simplifiedLabels: false },
    },
    full: {
      label: "Full",
      shortLabel: "PRO",
      description:
        "Everything pinned open, including debug and provider-governance lanes.",
      visibleComponents: {
        coverage_legend: true,
        viewport_controls: true,
        view_mode_bar: true,
        command_bar: true,
        status_bar: true,
        camera_preset_picker: true,
        north_compass: true,
        control_hint_bar: true,
        minimap: true,
        level_switcher: true,
        left_dock: true,
        right_dock: true,
        bottom_dock: true,
      },
      dockCollapsed: { left: false, right: false, bottom: false },
      clientDemoOptions: { hideDebugModules: false, simplifiedLabels: false },
    },
  });

export function nextUiExposure(level: UiExposureLevel): UiExposureLevel {
  const index = UI_EXPOSURE_ORDER.indexOf(level);
  return UI_EXPOSURE_ORDER[(index + 1) % UI_EXPOSURE_ORDER.length]!;
}

export const UI_EXPOSURE_STORAGE_KEY = "sentineltwin_ui_exposure_v1";

export function readPersistedUiExposure(): UiExposureLevel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UI_EXPOSURE_STORAGE_KEY);
    return raw === "showcase" || raw === "focused" || raw === "full" ? raw : null;
  } catch {
    return null;
  }
}

export function persistUiExposure(level: UiExposureLevel): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_EXPOSURE_STORAGE_KEY, level);
  } catch {
    // Persistence is best-effort; the in-memory level still applies.
  }
}
