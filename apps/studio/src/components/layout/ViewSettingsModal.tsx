"use client";

import { LayoutDashboard, Monitor, RotateCcw, Save, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useStudioStore, type BottomTab, type ViewMode, type WorkspacePreset } from "@/store/studio-store";
import { AI_PROVIDER_OPTIONS, describeAiProviderSelection, getProviderOption, normalizeAiProviderSelection } from "@/agents/provider-selection";
import { CAMERA_PRESETS, cameraPresetIcon } from "@/components/workspace/camera-preset-utils";

type ViewOption = {
  id: string;
  label: string;
  description: string;
  viewMode: ViewMode;
  preset: WorkspacePreset;
};

const MAIN_VIEWS: ViewOption[] = [
  { id: "edit", label: "Studio Home / Edit", description: "Balanced workspace for scene building.", viewMode: "map", preset: "edit" },
  { id: "coverage", label: "Coverage Review", description: "Canvas-first analysis with inspector and issues.", viewMode: "camera_view", preset: "coverage" },
  { id: "wall", label: "Camera Wall", description: "Dense multi-feed review and camera health.", viewMode: "wall", preset: "camera_wall" },
  { id: "replay", label: "Route Replay", description: "Timeline-first path replay and visibility analysis.", viewMode: "replay", preset: "replay" },
  { id: "compare", label: "Before / After", description: "Baseline vs fix comparison workflow.", viewMode: "compare", preset: "compare" },
  { id: "report", label: "Report Workspace", description: "Client-facing report and evidence summary.", viewMode: "report", preset: "report" },
  { id: "analytics", label: "Analytics Dashboard", description: "Interactive KPI, temporal, and resilience analytics.", viewMode: "analytics", preset: "coverage" },
  { id: "focus", label: "Focus / Reference", description: "Minimal chrome presentation layout.", viewMode: "map", preset: "focus" },
];

const PRESET_OPTIONS: Array<{ id: WorkspacePreset; label: string; description: string }> = [
  { id: "edit", label: "Edit", description: "Scene building and layout tuning" },
  { id: "coverage", label: "Coverage", description: "Analysis-first review" },
  { id: "camera_wall", label: "Camera Wall", description: "Feed grid and live status" },
  { id: "replay", label: "Replay", description: "Path replay and timeline focus" },
  { id: "compare", label: "Compare", description: "Before/after inspection" },
  { id: "report", label: "Report", description: "Client handoff and evidence summary" },
  { id: "debug", label: "Debug", description: "Dense diagnostics and overlays" },
  { id: "focus", label: "Focus", description: "Minimal chrome workspace mode" },
];

const CANVAS_MODES = [
  { id: "orbit_3d" as const, label: "3D Orbit", description: "Explore the scene with orbit controls." },
  { id: "topdown_2d" as const, label: "2D Top Down", description: "Flatten the scene for map-style review." },
];
const UI_DENSITIES = [
  { id: "compact" as const, label: "Compact", description: "Maximum information density." },
  { id: "normal" as const, label: "Normal", description: "Balanced readability." },
  { id: "comfortable" as const, label: "Comfortable", description: "Larger readable chrome." },
];
const UI_THEMES = [
  { id: "dark" as const, label: "Dark" },
  { id: "light" as const, label: "Light" },
];

const PANEL_TOGGLES = [
  { id: "left", label: "Left Tools", description: "Tools and scene layers" },
  { id: "right", label: "Right Inspector", description: "Object inspector and assumptions" },
  { id: "bottom", label: "Bottom Analysis", description: "Metrics, issues, timeline, report" },
] as const;

const COMPONENT_TOGGLES = [
  { key: "left_dock", label: "Left Dock", description: "Scene tools panel" },
  { key: "right_dock", label: "Right Dock", description: "Inspector panel" },
  { key: "bottom_dock", label: "Bottom Dock", description: "Analysis drawer" },
  { key: "view_mode_bar", label: "View Mode Bar", description: "Workspace view selector" },
  { key: "command_bar", label: "Command Bar", description: "AI command prompt" },
  { key: "status_bar", label: "Status Bar", description: "Simulation status strip" },
  { key: "coverage_legend", label: "Coverage Legend", description: "Heatmap legend" },
  { key: "north_compass", label: "Compass", description: "Scene orientation" },
  { key: "viewport_controls", label: "Viewport Controls", description: "3D / 2D / reset / layers" },
  { key: "control_hint_bar", label: "Control Hints", description: "Interaction hints" },
  { key: "camera_preset_picker", label: "Camera Presets", description: "Quick camera placement presets" },
  { key: "minimap", label: "Minimap", description: "Mini scene navigator" },
] as const;

const RIGHT_PANEL_MODES = [
  { id: "inspector" as const, label: "Inspector" },
  { id: "security_status" as const, label: "Security Status" },
  { id: "issues" as const, label: "Issues" },
  { id: "recommendations" as const, label: "Recommendations" },
  { id: "assumptions" as const, label: "Assumptions" },
  { id: "camera_controls" as const, label: "Camera Controls" },
] as const;

const BOTTOM_DRAWER_MODES = [
  { id: "tabs" as const, label: "Tabs", description: "Multi-tab analysis drawer" },
  { id: "single_module" as const, label: "Single Module", description: "One pinned analysis module" },
  { id: "hidden" as const, label: "Hidden", description: "Minimized analysis drawer" },
] as const;

const ANALYSIS_MODULES: Array<{ id: BottomTab; label: string; description: string }> = [
  { id: "outcome", label: "Security Outcome", description: "Overall status summary" },
  { id: "metrics", label: "Metrics", description: "Coverage and quality metrics" },
  { id: "issues", label: "Issues", description: "Coverage failures and blockers" },
  { id: "timeline", label: "Timeline", description: "Event timeline and sequence" },
  { id: "temporal", label: "24H Profile", description: "Time-of-day profile" },
  { id: "beforeafter", label: "Before / After", description: "Comparison module" },
  { id: "assumptions", label: "Assumptions", description: "Simulation assumptions" },
  { id: "governance", label: "Governance", description: "Role and approval control plane" },
  { id: "provenance", label: "Evidence Trail", description: "Sources and traceability" },
  { id: "redundancy", label: "Redundancy", description: "Coverage resilience" },
  { id: "counterfactual", label: "Fix Options", description: "Before/after fix testing" },
  { id: "threat", label: "Route Exposure", description: "Authorized route visibility" },
  { id: "report", label: "Report Lite", description: "Client-ready report summary" },
  { id: "help", label: "Help", description: "Onboarding and contextual guidance" },
  { id: "debug", label: "Diagnostics", description: "Implementation diagnostics" },
  { id: "novel", label: "Advanced Risk Signals", description: "Stability and backup signals" },
];

const LAYER_TOGGLES = [
  { key: "cameras", label: "Cameras" },
  { key: "camera_cones", label: "Camera Cones" },
  { key: "obstructions", label: "Obstructions" },
  { key: "lights", label: "Lights" },
  { key: "critical_zones", label: "Critical Zones" },
  { key: "privacy_zones", label: "Privacy Zones" },
  { key: "paths", label: "Paths" },
  { key: "heatmap", label: "Heatmap" },
  { key: "grid", label: "Grid" },
  { key: "walls_floors", label: "Walls / Floors" },
  { key: "labels", label: "Labels" },
] as const;

export function ViewSettingsModal() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = useStudioStore((s) => s.viewSettingsOpen);
  const setOpen = useStudioStore((s) => s.setViewSettingsOpen);
  const toggleDock = useStudioStore((s) => s.toggleDock);
  const setDockCollapsed = useStudioStore((s) => s.setDockCollapsed);
  const leftDockCollapsed = useStudioStore((s) => s.leftDockCollapsed);
  const rightDockCollapsed = useStudioStore((s) => s.rightDockCollapsed);
  const bottomDockCollapsed = useStudioStore((s) => s.bottomDockCollapsed);
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const focusMode = useStudioStore((s) => s.focusMode);
  const restorePreviousLayout = useStudioStore((s) => s.restorePreviousLayout);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const viewMode = useStudioStore((s) => s.viewMode);
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const setCanvasMode = useStudioStore((s) => s.setCanvasMode);
  const resetCanvasView = useStudioStore((s) => s.resetCanvasView);
  const layerVisibility = useStudioStore((s) => s.layerVisibility);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);
  const visibleComponents = useStudioStore((s) => s.visibleComponents);
  const setVisibleComponent = useStudioStore((s) => s.setVisibleComponent);
  const showDebugOverlays = useStudioStore((s) => s.showDebugOverlays);
  const setShowDebugOverlays = useStudioStore((s) => s.setShowDebugOverlays);
  const rightPanelMode = useStudioStore((s) => s.rightPanelMode);
  const setRightPanelMode = useStudioStore((s) => s.setRightPanelMode);
  const uiDensity = useStudioStore((s) => s.uiDensity);
  const setUiDensity = useStudioStore((s) => s.setUiDensity);
  const uiTheme = useStudioStore((s) => s.uiTheme);
  const setUiTheme = useStudioStore((s) => s.setUiTheme);
  const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);
  const setAiProviderSelection = useStudioStore((s) => s.setAiProviderSelection);
  const localOnlyMode = useStudioStore((s) => s.localOnlyMode);
  const setLocalOnlyMode = useStudioStore((s) => s.setLocalOnlyMode);
  const cameraPresetId = useStudioStore((s) => s.cameraPresetId);
  const setCameraPresetId = useStudioStore((s) => s.setCameraPresetId);
  const bottomDrawerMode = useStudioStore((s) => s.bottomDrawerMode);
  const setBottomDrawerMode = useStudioStore((s) => s.setBottomDrawerMode);
  const pinnedAnalysisModule = useStudioStore((s) => s.pinnedAnalysisModule);
  const setPinnedAnalysisModule = useStudioStore((s) => s.setPinnedAnalysisModule);
  const enabledAnalysisModules = useStudioStore((s) => s.enabledAnalysisModules);
  const toggleAnalysisModule = useStudioStore((s) => s.toggleAnalysisModule);
  const clientDemoOptions = useStudioStore((s) => s.clientDemoOptions);
  const savedLayouts = useStudioStore((s) => s.savedLayouts);
  const saveCurrentLayoutAs = useStudioStore((s) => s.saveCurrentLayoutAs);
  const applySavedLayout = useStudioStore((s) => s.applySavedLayout);
  const deleteSavedLayout = useStudioStore((s) => s.deleteSavedLayout);
  const [layoutName, setLayoutName] = useState("");

  const activeView = useMemo(
    () => MAIN_VIEWS.find((entry) => entry.preset === workspacePreset)
      ?? MAIN_VIEWS.find((entry) => entry.viewMode === viewMode)
      ?? MAIN_VIEWS[0]!,
    [viewMode, workspacePreset],
  );
  const providerInfo = useMemo(() => describeAiProviderSelection(aiProviderSelection), [aiProviderSelection]);
  const providerOption = useMemo(() => getProviderOption(aiProviderSelection.providerId), [aiProviderSelection.providerId]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  if (!open) return null;

  const handleApplyMainView = (view: ViewOption) => {
    setWorkspacePreset(view.preset);
    setOpen(false);
  };

  return (
    <div
      data-testid="view-settings-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-md"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-settings-title"
        aria-describedby="view-settings-description"
        tabIndex={-1}
        className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#20273a] bg-[#0b0f17] shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#1f2536] px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/12 text-sky-200">
            <Settings2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div id="view-settings-title" className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7a86a0]">View Settings</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Workspace Layout and Viewport Components</h2>
            <p id="view-settings-description" className="mt-1 max-w-2xl text-sm text-[#8d98b0]">
              Choose what you want to see, what should stay hidden, and which workspace layout should open by default.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto rounded-full border border-[#24283a] bg-[#111521] p-2 text-[#93a1bd] transition-colors hover:border-[#39445d] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Monitor className="h-3.5 w-3.5 text-cyan-300" />
                Readability
              </div>
              <div className="mt-3 grid gap-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#61708f]">Density</div>
                <div className="grid grid-cols-3 gap-2">
                  {UI_DENSITIES.map((density) => (
                    <button
                      key={density.id}
                      type="button"
                      onClick={() => setUiDensity(density.id)}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-left text-[11px] transition-colors",
                        uiDensity === density.id
                          ? "border-cyan-400/30 bg-cyan-500/12 text-cyan-100"
                          : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                      )}
                    >
                      <div className="font-medium">{density.label}</div>
                      <div className="mt-1 text-[9px] text-[#6f7c98]">{density.description}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#61708f]">Theme</div>
                <div className="grid grid-cols-2 gap-2">
                  {UI_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setUiTheme(theme.id)}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-left text-[11px] transition-colors",
                        uiTheme === theme.id
                          ? "border-cyan-400/30 bg-cyan-500/12 text-cyan-100"
                          : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                      )}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Monitor className="h-3.5 w-3.5 text-emerald-300" />
                AI Provider
              </div>
              <div className="mt-3 rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{providerInfo.providerLabel}</div>
                    <div className="mt-1 text-[11px] text-[#7e8aa4]">{providerInfo.description}</div>
                  </div>
                  <div className={cn(
                    "rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.18em]",
                    providerInfo.cloudAvailable
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-400/20 bg-amber-500/10 text-amber-300",
                  )}>
                    {providerInfo.cloudAvailable ? "Cloud-backed" : "Local-only"}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {AI_PROVIDER_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAiProviderSelection(normalizeAiProviderSelection({ providerId: option.id, model: option.defaultModel }))}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-left transition-colors",
                        aiProviderSelection.providerId === option.id
                          ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                          : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                      )}
                    >
                      <div className="text-sm font-semibold">{option.name}</div>
                      <div className="mt-1 text-[9px] text-[#6f7c98]">{option.description}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2">
                  <label className="text-[10px] uppercase tracking-[0.16em] text-[#61708f]">
                    Model
                    <select
                      value={aiProviderSelection.model || providerOption.defaultModel}
                      onChange={(event) => setAiProviderSelection({ providerId: aiProviderSelection.providerId, model: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-[#22314b] bg-[#0b0f17] px-3 py-2 text-[11px] text-white outline-none transition-colors focus:border-emerald-400/30"
                    >
                      {providerOption.models.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-3 flex items-start gap-3 rounded-xl border border-[#22314b] bg-[#101827] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={localOnlyMode}
                    onChange={(event) => setLocalOnlyMode(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#31405a] bg-[#0b0f17] text-cyan-500 focus:ring-cyan-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">Local Only Mode</div>
                    <div className="mt-1 text-[11px] text-[#7e8aa4]">
                      Keep AI parsing, counterfactuals, and report generation on-device. Cloud-backed provider calls are disabled by policy.
                    </div>
                  </div>
                </label>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Monitor className="h-3.5 w-3.5 text-cyan-300" />
                Camera Preset Library
              </div>
              <div className="mt-3 rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">Quick placement presets</div>
                    <div className="mt-1 text-[11px] text-[#7e8aa4]">
                      Choose a default camera spec before placing a node, or keep the current manual values.
                    </div>
                  </div>
                  <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[8px] uppercase tracking-[0.18em] text-cyan-300">
                    {CAMERA_PRESETS.length} presets
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {CAMERA_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCameraPresetId(cameraPresetId === preset.id ? null : preset.id)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition-colors",
                        cameraPresetId === preset.id
                          ? "border-cyan-400/30 bg-cyan-500/12 text-cyan-100"
                          : "border-[#22314b] bg-[#0f1320] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-[#26314a] bg-[#121829] p-1 text-cyan-300">
                          {cameraPresetIcon(preset.id)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{preset.label}</div>
                          <div className="truncate text-[9px] text-[#6f7c98]">{preset.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-[#7e8aa4]">
                  Current preset: <span className="text-[#d7deed]">{cameraPresetId ?? "none selected"}</span>
                </div>
                <div className="mt-3 rounded-xl border border-dashed border-[#24324c] bg-[#0a0e17] px-3 py-2 text-[11px] text-[#8d98b0]">
                  The canvas picker appears automatically when the camera tool is active, but these presets are now visible here too so the library is discoverable before placement.
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <LayoutDashboard className="h-3.5 w-3.5 text-sky-300" />
                Main View
              </div>
              <div className="mt-3 grid gap-2">
                {MAIN_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => handleApplyMainView(view)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      activeView.id === view.id
                        ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
                        : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                    )}
                  >
                    <div className="text-sm font-semibold">{view.label}</div>
                    <div className="mt-1 text-[11px] text-[#7e8aa4]">{view.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Monitor className="h-3.5 w-3.5 text-emerald-300" />
                Canvas Mode
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {CANVAS_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setCanvasMode(mode.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      canvasMode === mode.id
                        ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                        : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                    )}
                  >
                    <div className="text-sm font-semibold">{mode.label}</div>
                    <div className="mt-1 text-[11px] text-[#7e8aa4]">{mode.description}</div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    resetCanvasView();
                    setOpen(false);
                  }}
                  className="rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3 text-left text-[#d7deed] transition-colors hover:border-[#31405a] hover:bg-[#101725]"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <RotateCcw className="h-3.5 w-3.5 text-sky-300" />
                    Reset View
                  </div>
                  <div className="mt-1 text-[11px] text-[#7e8aa4]">Return to the current scene framing.</div>
                </button>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Settings2 className="h-3.5 w-3.5 text-violet-300" />
                Scene Layers
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {LAYER_TOGGLES.map((layer) => (
                  <button
                    key={layer.key}
                    type="button"
                    onClick={() => toggleLayer(layer.key)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-[11px] transition-colors",
                      layerVisibility[layer.key]
                        ? "border-violet-400/25 bg-violet-500/12 text-violet-100"
                        : "border-[#22314b] bg-[#0b0f17] text-[#9aa6bd] hover:border-[#31405a] hover:text-white",
                    )}
                  >
                    {layer.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Settings2 className="h-3.5 w-3.5 text-amber-300" />
                Layout
              </div>
              <div className="mt-3 grid gap-2">
                {PANEL_TOGGLES.map((panel) => {
                  const collapsed = panel.id === "left" ? leftDockCollapsed : panel.id === "right" ? rightDockCollapsed : bottomDockCollapsed;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      onClick={() => toggleDock(panel.id)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition-colors",
                        collapsed
                          ? "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]"
                          : "border-amber-400/25 bg-amber-500/12 text-amber-100",
                      )}
                    >
                      <div className="text-sm font-semibold">{panel.label}</div>
                      <div className="mt-1 text-[11px] text-[#7e8aa4]">{panel.description}</div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowDebugOverlays(!showDebugOverlays)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-colors",
                    showDebugOverlays
                      ? "border-amber-400/25 bg-amber-500/12 text-amber-100"
                      : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                  )}
                >
                  <div className="text-sm font-semibold">Debug Overlays</div>
                  <div className="mt-1 text-[11px] text-[#7e8aa4]">Show extra diagnostics and developer aids.</div>
                </button>
                <div className="rounded-2xl border border-[#22314b] bg-[#0b0f17] p-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#61708f]">Right Panel Mode</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {RIGHT_PANEL_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setRightPanelMode(mode.id)}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-left text-[11px] transition-colors",
                          rightPanelMode === mode.id
                            ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
                            : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                        )}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#22314b] bg-[#0b0f17] p-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#61708f]">Bottom Drawer Mode</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {BOTTOM_DRAWER_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setBottomDrawerMode(mode.id)}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-left text-[11px] transition-colors",
                          bottomDrawerMode === mode.id
                            ? "border-amber-400/30 bg-amber-500/12 text-amber-100"
                            : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                        )}
                      >
                        <div className="font-medium">{mode.label}</div>
                        <div className="mt-1 text-[9px] text-[#6f7c98]">{mode.description}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-[9px] uppercase tracking-[0.18em] text-[#61708f]">Pinned Module</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {ANALYSIS_MODULES.filter((module) => enabledAnalysisModules[module.id]).slice(0, 6).map((module) => (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => setPinnedAnalysisModule(module.id)}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-left text-[11px] transition-colors",
                          pinnedAnalysisModule === module.id
                            ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                            : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                        )}
                      >
                        {module.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDockCollapsed("left", false);
                      setDockCollapsed("right", false);
                      setDockCollapsed("bottom", false);
                    }}
                    className="rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3 text-left text-sm text-[#d7deed] transition-colors hover:border-[#31405a] hover:bg-[#101725]"
                  >
                    Show All Panels
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDockCollapsed("left", true);
                      setDockCollapsed("right", true);
                      setDockCollapsed("bottom", true);
                    }}
                    className="rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3 text-left text-sm text-[#d7deed] transition-colors hover:border-[#31405a] hover:bg-[#101725]"
                  >
                    Hide All Panels
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Settings2 className="h-3.5 w-3.5 text-cyan-300" />
                View Components
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {COMPONENT_TOGGLES.map((component) => (
                  <button
                    key={component.key}
                    type="button"
                    onClick={() => setVisibleComponent(component.key, !visibleComponents[component.key])}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      visibleComponents[component.key]
                        ? "border-cyan-400/30 bg-cyan-500/12 text-cyan-100"
                        : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                    )}
                  >
                    <div className="text-sm font-semibold">{component.label}</div>
                    <div className="mt-1 text-[11px] text-[#7e8aa4]">{component.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Settings2 className="h-3.5 w-3.5 text-fuchsia-300" />
                Analysis Modules
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ANALYSIS_MODULES.map((module) => (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => toggleAnalysisModule(module.id)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      enabledAnalysisModules[module.id]
                        ? "border-fuchsia-400/30 bg-fuchsia-500/12 text-fuchsia-100"
                        : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                    )}
                  >
                    <div className="text-sm font-semibold">{module.label}</div>
                    <div className="mt-1 text-[11px] text-[#7e8aa4]">{module.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Settings2 className="h-3.5 w-3.5 text-rose-300" />
                Client / Reference Options
              </div>
              <div className="mt-3 grid gap-2">
                {([
                  ["hideDebugModules", "Hide debug modules"],
                  ["simplifiedLabels", "Simplified labels"],
                  ["criticalIssuesOnly", "Critical issues only"],
                  ["lockLayout", "Lock layout"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      useStudioStore.setState({
                        clientDemoOptions: {
                          ...clientDemoOptions,
                          [key]: !clientDemoOptions[key],
                        },
                      });
                    }}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      clientDemoOptions[key]
                        ? "border-rose-400/30 bg-rose-500/12 text-rose-100"
                        : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                    )}
                  >
                    <div className="text-sm font-semibold">{label}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Settings2 className="h-3.5 w-3.5 text-sky-300" />
                Workspace Presets
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (focusMode) {
                      restorePreviousLayout();
                    } else {
                      setWorkspacePreset(workspacePreset);
                    }
                    setOpen(false);
                  }}
                  className="rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-2 text-sm text-[#d7deed] transition-colors hover:border-[#31405a] hover:bg-[#101725] hover:text-white"
                >
                  Reset Current Preset
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PRESET_OPTIONS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setWorkspacePreset(preset.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      workspacePreset === preset.id
                        ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
                        : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                    )}
                  >
                    <div className="text-sm font-semibold">{preset.label}</div>
                    <div className="mt-1 text-[11px] text-[#7e8aa4]">{preset.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Save className="h-3.5 w-3.5 text-emerald-300" />
                Saved Layouts
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={layoutName}
                    onChange={(event) => setLayoutName(event.target.value)}
                    placeholder="Custom layout name"
                    className="min-w-0 flex-1 rounded-2xl border border-[#22314b] bg-[#0b0f17] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[#607089] focus:border-sky-400/35 focus:bg-[#101725]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const saved = saveCurrentLayoutAs(layoutName || `${activeView.label} Layout`);
                      if (saved) {
                        setLayoutName("");
                      }
                    }}
                    className="rounded-2xl border border-emerald-400/25 bg-emerald-500/12 px-4 py-2 text-sm font-medium text-emerald-100 transition-colors hover:border-emerald-300/35 hover:bg-emerald-500/16"
                  >
                    Save
                  </button>
                </div>

                {savedLayouts.length > 0 ? (
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {savedLayouts.map((layout) => (
                      <div key={layout.id} className="rounded-2xl border border-[#22314b] bg-[#0b0f17] px-3 py-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-white">{layout.name}</div>
                            <div className="mt-1 text-[11px] text-[#7e8aa4]">
                              {layout.workspacePreset.replace(/_/g, " ")} · {layout.canvasMode === "orbit_3d" ? "3D orbit" : "2D top-down"} · {layout.layerVisibility.heatmap ? "heatmap on" : "heatmap off"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => applySavedLayout(layout.id)}
                            className="rounded-full border border-[#2c374c] bg-[#101725] px-3 py-1.5 text-[11px] text-[#d7deed] transition-colors hover:border-sky-400/30 hover:text-white"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedLayout(layout.id)}
                            className="rounded-full border border-[#2c374c] bg-[#101725] px-2.5 py-1.5 text-[11px] text-[#d7deed] transition-colors hover:border-red-400/25 hover:text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#22314b] px-3 py-4 text-sm text-[#7e8aa4]">
                    Save the current workspace layout to reuse it later.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
                <Settings2 className="h-3.5 w-3.5 text-violet-300" />
                View Snapshot
              </div>
              <div className="mt-3 rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3 text-sm text-[#d7deed]">
                {activeView.label}
              </div>
              <div className="mt-2 text-[11px] text-[#7e8aa4]">
                The current homepage and studio layout can be switched instantly without leaving the workspace.
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
