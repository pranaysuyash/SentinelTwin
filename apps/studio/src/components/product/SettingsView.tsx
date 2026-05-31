"use client";

import { ArrowLeft, Camera, Monitor, ShieldCheck, Sun, Moon, Settings2, LayoutDashboard, RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { useProductViewStore } from "@/store/product-view-store";
import { useStudioStore } from "@/store/studio-store";
import { AI_PROVIDER_OPTIONS, describeAiProviderSelection, getProviderOption, normalizeAiProviderSelection } from "@/agents/provider-selection";
import { CAMERA_PRESETS } from "@/components/workspace/camera-preset-utils";

const UI_DENSITIES = [
  { id: "compact" as const, label: "Compact", description: "Maximum information density." },
  { id: "normal" as const, label: "Normal", description: "Balanced readability." },
  { id: "comfortable" as const, label: "Comfortable", description: "Larger readable chrome." },
];

const UI_THEMES = [
  { id: "dark" as const, label: "Dark", icon: Moon },
  { id: "light" as const, label: "Light", icon: Sun },
];

const CANVAS_MODES = [
  { id: "orbit_3d" as const, label: "3D Orbit", description: "Explore the scene with orbit controls." },
  { id: "topdown_2d" as const, label: "2D Top Down", description: "Flatten the scene for map-style review." },
];

export function SettingsView() {
  const navigate = useProductViewStore((s) => s.navigate);

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
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const setCanvasMode = useStudioStore((s) => s.setCanvasMode);
  const resetCanvasView = useStudioStore((s) => s.resetCanvasView);
  const toggleViewSettingsOpen = useStudioStore((s) => s.toggleViewSettingsOpen);

  const providerInfo = useMemo(() => describeAiProviderSelection(aiProviderSelection), [aiProviderSelection]);
  const providerOption = useMemo(() => getProviderOption(aiProviderSelection.providerId), [aiProviderSelection.providerId]);

  return (
    <div className="flex h-full w-full flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-[#1f2536] px-5 py-4">
        <button
          type="button"
          onClick={() => navigate("product_home")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-sky-400/30 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Product Home
        </button>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Settings</div>
          <h1 className="mt-0.5 text-lg font-semibold text-white">Product preferences</h1>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto max-w-5xl space-y-5">
          <section className="rounded-[24px] border border-sky-400/20 bg-sky-500/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-sky-200">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Workspace View Settings
                </div>
                <p className="mt-2 max-w-2xl text-sm text-[#c8d4ea]">
                  Open the live Studio layout panel for component visibility, saved layouts, analysis modules, and workspace presets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  toggleViewSettingsOpen();
                  navigate("studio");
                }}
                className="rounded-xl border border-sky-300/30 bg-sky-400 px-4 py-2 text-xs font-bold text-[#031424] transition-colors hover:bg-sky-300"
              >
                Open View Settings
              </button>
            </div>
          </section>

          {/* Readability */}
          <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
              <Monitor className="h-3.5 w-3.5 text-cyan-300" />
              Readability
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#61708f]">Density</div>
                <div className="flex gap-2">
                  {UI_DENSITIES.map((density) => (
                    <button
                      key={density.id}
                      type="button"
                      onClick={() => setUiDensity(density.id)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5 text-left text-[11px] transition-colors",
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
              </div>
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#61708f]">Theme</div>
                <div className="flex gap-2">
                  {UI_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setUiTheme(theme.id)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5 text-[11px] transition-colors",
                        uiTheme === theme.id
                          ? "border-cyan-400/30 bg-cyan-500/12 text-cyan-100"
                          : "border-[#22314b] bg-[#0b0f17] text-[#d7deed] hover:border-[#31405a] hover:bg-[#101725]",
                      )}
                    >
                      <div className="flex items-center justify-center gap-2 font-medium">
                        {theme.id === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                        {theme.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* AI Provider */}
          <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              AI Provider
            </div>
            <div className="mt-4">
              <div className="rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3">
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
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {AI_PROVIDER_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAiProviderSelection(normalizeAiProviderSelection({ providerId: option.id, model: option.defaultModel }))}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-colors",
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
                <div className="mt-4">
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
                <label className="mt-4 flex items-start gap-3 rounded-xl border border-[#22314b] bg-[#101827] px-3 py-3">
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
            </div>
          </section>

          {/* Camera Presets */}
          <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
              <Camera className="h-3.5 w-3.5 text-cyan-300" />
              Camera Preset Library
            </div>
            <div className="mt-4 rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">Quick placement presets</div>
                  <div className="mt-1 text-[11px] text-[#7e8aa4]">
                    Choose a default camera spec before placing a node.
                  </div>
                </div>
                <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[8px] uppercase tracking-[0.18em] text-cyan-300">
                  {CAMERA_PRESETS.length} presets
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
                        {preset.icon}
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
            </div>
          </section>

          {/* Canvas Mode */}
          <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
              <Monitor className="h-3.5 w-3.5 text-emerald-300" />
              Canvas Mode
            </div>
            <div className="mt-4 flex gap-2">
              {CANVAS_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setCanvasMode(mode.id)}
                  className={cn(
                    "flex-1 rounded-2xl border px-4 py-3 text-left transition-colors",
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
                onClick={() => resetCanvasView()}
                className="flex-1 rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3 text-left text-[#d7deed] transition-colors hover:border-[#31405a] hover:bg-[#101725]"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <RotateCcw className="h-3.5 w-3.5 text-sky-300" />
                  Reset View
                </div>
                <div className="mt-1 text-[11px] text-[#7e8aa4]">Return to current scene framing.</div>
              </button>
            </div>
          </section>

          {/* About section */}
          <section className="rounded-[24px] border border-[#1f2536] bg-[#0d121c] p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#6d7892]">
              <Settings2 className="h-3.5 w-3.5 text-violet-300" />
              About
            </div>
            <div className="mt-4 space-y-2 rounded-2xl border border-[#22314b] bg-[#0b0f17] px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#7e8aa4]">Product</span>
                <span className="text-white">SentinelTwin Studio</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7e8aa4]">Version</span>
                <span className="text-white">0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7e8aa4]">Engine</span>
                <span className="text-white">@sentineltwin/simulation</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7e8aa4]">Runtime</span>
                <span className="text-white">Next.js + Three.js</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-[#7e8aa4]">
              View Settings (layout, components, analysis modules, saved layouts) are available inside the Security Twin Studio workspace.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
