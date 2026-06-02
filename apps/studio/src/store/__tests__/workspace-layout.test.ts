import { beforeEach, describe, expect, test } from "bun:test";

import { DEFAULT_LAYERS, getPresetLayoutSnapshot, isWorkspaceLayoutModified, LAYOUT_STORAGE_VERSION } from "@/lib/workspace-layouts";
import { useStudioStore } from "@/store/studio-store";

const LAYOUT_STORAGE_KEY = "sentineltwin_workspace_layouts";
const LEGACY_LAYOUT_STORAGE_KEY = "sentineltwin_saved_layouts_v1";

if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage == null) {
  const memory: Record<string, string> = {};
  const storage: Storage = {
    getItem: (key: string) => memory[key] ?? null,
    setItem: (key: string, value: string) => { memory[key] = value; },
    removeItem: (key: string) => { delete memory[key]; },
    clear: () => { for (const key of Object.keys(memory)) delete memory[key]; },
    key: (index: number) => Object.keys(memory)[index] ?? null,
    length: 0,
  };
  try {
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });
  } catch {
    (globalThis as any).localStorage = storage;
  }
}

describe("workspace layout state", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    useStudioStore.setState(useStudioStore.getInitialState(), true);
  });

  test("seeds demo workspaces and layout presets on first load", () => {
    const state = useStudioStore.getState();

    expect(Array.isArray(state.savedProjects)).toBe(true);
    expect(Array.isArray(state.savedScenes)).toBe(true);
    expect(state.savedLayouts.length).toBeGreaterThan(0);
    expect(state.canvasMode).toBe("orbit_3d");
    expect(state.viewSettingsOpen).toBe(false);
  });

  test("saves and reapplies a custom layout snapshot", () => {
    const initial = useStudioStore.getState();

    useStudioStore.setState({
      canvasMode: "topdown_2d",
      workspacePreset: "coverage",
      leftDockCollapsed: true,
      rightDockCollapsed: false,
      bottomDockCollapsed: true,
      showDebugOverlays: true,
      overlayDensity: "compact",
    });

    const saved = useStudioStore.getState().saveCurrentLayoutAs("QA Layout");
    expect(saved?.name).toBe("QA Layout");

    useStudioStore.setState({
      canvasMode: "orbit_3d",
      workspacePreset: "edit",
      leftDockCollapsed: false,
      rightDockCollapsed: true,
      bottomDockCollapsed: false,
      showDebugOverlays: false,
      overlayDensity: "all",
    });

    expect(useStudioStore.getState().savedLayouts.some((layout) => layout.name === "QA Layout")).toBe(true);
    useStudioStore.getState().applySavedLayout(saved?.id ?? "");

    const state = useStudioStore.getState();
    expect(state.canvasMode).toBe("topdown_2d");
    expect(state.workspacePreset).toBe("coverage");
    expect(state.leftDockCollapsed).toBe(true);
    expect(state.rightDockCollapsed).toBe(false);
    expect(state.bottomDockCollapsed).toBe(true);
    expect(state.showDebugOverlays).toBe(true);
    expect(state.overlayDensity).toBe("compact");

    useStudioStore.getState().deleteSavedLayout(saved?.id ?? "");
    expect(useStudioStore.getState().savedLayouts.some((layout) => layout.name === "QA Layout")).toBe(false);
    expect(initial.savedLayouts.length).toBeGreaterThan(0);
  });

  test("applies report workspace defaults when switching to report view", () => {
    useStudioStore.getState().setViewMode("report");

    const state = useStudioStore.getState();
    const expected = getPresetLayoutSnapshot("report", DEFAULT_LAYERS);

    expect(state.workspacePreset).toBe("report");
    expect(state.viewMode).toBe("report");
    expect(state.canvasMode).toBe(expected.canvasMode);
    expect(state.rightPanelMode).toBe(expected.rightPanelMode);
    expect(state.bottomDrawerMode).toBe(expected.bottomDrawerMode);
    expect(state.pinnedAnalysisModule).toBe(expected.pinnedAnalysisModule);
    expect(state.visibleComponents.command_bar).toBe(false);
    expect(state.bottomTab).toBe("report");
  });

  test("focus layout switches to the focused map workspace and preserves the previous layout for restore", () => {
    useStudioStore.getState().setViewMode("compare");
    useStudioStore.getState().setWorkspacePreset("focus");

    const focusedState = useStudioStore.getState();
    expect(focusedState.workspacePreset).toBe("focus");
    expect(focusedState.viewMode).toBe("map");
    expect(focusedState.focusMode).toBe(true);
    expect(focusedState.previousLayout?.workspacePreset).toBe("compare");

    useStudioStore.getState().restorePreviousLayout();
    const restored = useStudioStore.getState();
    expect(restored.workspacePreset).toBe("compare");
    expect(restored.viewMode).toBe("compare");
    expect(restored.focusMode).toBe(false);
  });

  test("disables active analysis modules safely and falls back to a valid tab", () => {
    useStudioStore.getState().setBottomDrawerMode("single_module");
    useStudioStore.getState().setPinnedAnalysisModule("report");
    useStudioStore.getState().setBottomTab("report");

    useStudioStore.getState().setAnalysisModuleEnabled("report", false);

    const state = useStudioStore.getState();
    expect(state.enabledAnalysisModules.report).toBe(false);
    expect(state.bottomTab).not.toBe("report");
    expect(state.pinnedAnalysisModule).not.toBe("report");
  });

  test("resetting the current preset restores the preset baseline", () => {
    useStudioStore.getState().setWorkspacePreset("coverage");
    useStudioStore.setState({
      leftDockCollapsed: false,
      rightDockCollapsed: true,
      bottomDockCollapsed: false,
      showDebugOverlays: true,
      visibleComponents: {
        ...useStudioStore.getState().visibleComponents,
        command_bar: false,
      },
    });

    useStudioStore.getState().setWorkspacePreset("coverage");

    const state = useStudioStore.getState();
    const baseline = getPresetLayoutSnapshot("coverage", DEFAULT_LAYERS);

    expect(state.leftDockCollapsed).toBe(baseline.leftDockCollapsed);
    expect(state.rightDockCollapsed).toBe(baseline.rightDockCollapsed);
    expect(state.bottomDockCollapsed).toBe(baseline.bottomDockCollapsed);
    expect(state.showDebugOverlays).toBe(baseline.showDebugOverlays);
    expect(state.visibleComponents.command_bar).toBe(baseline.visibleComponents.command_bar);
  });

  test("flags modified layouts against the preset baseline", () => {
    const baseline = getPresetLayoutSnapshot("edit", DEFAULT_LAYERS);
    expect(isWorkspaceLayoutModified(baseline, baseline)).toBe(false);
    expect(isWorkspaceLayoutModified(
      {
        ...baseline,
        canvasMode: "topdown_2d",
      },
      baseline,
    )).toBe(true);
  });

  test("normalizes malformed persisted layouts and rewrites canonical storage format", () => {
    localStorage.clear();
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify([
      {
        id: "legacy_bad",
        name: "   ",
        workspacePreset: "coverage",
        viewMode: "invalid-view",
        leftDockCollapsed: "not-a-bool",
        rightDockCollapsed: 123,
        // intentionally omit schema fields to force fallback behavior
      },
    ]));

    useStudioStore.getState().refreshSavedLayoutsList();

    const state = useStudioStore.getState();
    expect(state.savedLayouts.some((layout) => layout.id === "legacy_bad")).toBe(true);
    const legacy = state.savedLayouts.find((layout) => layout.id === "legacy_bad");
    expect(legacy).toBeDefined();
    expect(legacy?.name).toBe("Coverage");
    expect(legacy?.workspacePreset).toBe("coverage");
    expect(legacy?.viewMode).toBe("camera_view");
    expect(legacy?.schemaVersion).toBe(LAYOUT_STORAGE_VERSION);

    const persisted = localStorage.getItem(LAYOUT_STORAGE_KEY);
    expect(persisted).not.toBeNull();
    const parsed = persisted ? JSON.parse(persisted) : null;
    expect(parsed).not.toBeNull();
    expect(parsed?.schemaVersion).toBe(LAYOUT_STORAGE_VERSION);
    expect(Array.isArray(parsed?.layouts)).toBe(true);
    expect(parsed?.layouts?.some((layout: any) => layout.id === "legacy_bad")).toBe(true);
    expect(localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  test("migrates legacy saved-layout list into schema-versioned envelope", () => {
    localStorage.clear();
    localStorage.setItem(
      LEGACY_LAYOUT_STORAGE_KEY,
      JSON.stringify([{
        ...getPresetLayoutSnapshot("report", DEFAULT_LAYERS),
        id: "legacy_report",
        name: "Legacy report",
      }]),
    );

    useStudioStore.getState().refreshSavedLayoutsList();
    const state = useStudioStore.getState();

    expect(state.savedLayouts.some((layout) => layout.id === "legacy_report")).toBe(true);
    expect(state.savedLayouts.find((layout) => layout.id === "legacy_report")?.schemaVersion).toBe(LAYOUT_STORAGE_VERSION);
    expect(state.savedLayouts.find((layout) => layout.id === "legacy_report")?.id).toBe("legacy_report");

    const modernRaw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    expect(modernRaw).not.toBeNull();
    const parsed = modernRaw ? JSON.parse(modernRaw) : null;
    expect(Array.isArray(parsed?.layouts)).toBe(true);
    expect(parsed?.layouts?.some((layout: any) => layout.id === "legacy_report")).toBe(true);
    expect(localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY)).toBeNull();
  });
});
