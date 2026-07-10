"use client";

import {
  ChevronDown,
  LayoutGrid,
  Monitor,
  PencilRuler,
  Play,
  Shield,
  Sparkles,
  Columns3,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { DEFAULT_LAYERS } from "@/lib/workspace-layouts";
import { getPresetLayoutSnapshot, isWorkspaceLayoutModified } from "@/lib/workspace-layouts";
import { useStudioStore, type WorkspacePreset } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const PRESETS: Array<{
  id: WorkspacePreset;
  label: string;
  icon: ReactNode;
  hint: string;
}> = [
  { id: "edit", label: "Build", icon: <PencilRuler className="h-3.5 w-3.5" />, hint: "Draw the site and place cameras, zones, paths, and obstructions." },
  { id: "coverage", label: "Verify", icon: <LayoutGrid className="h-3.5 w-3.5" />, hint: "Review coverage quality, critical zones, and camera responsibility." },
  { id: "camera_wall", label: "Camera Wall", icon: <Monitor className="h-3.5 w-3.5" />, hint: "Check simulated feeds side by side." },
  { id: "replay", label: "Replay", icon: <Play className="h-3.5 w-3.5" />, hint: "Review an authorized route and where coverage is lost." },
  { id: "compare", label: "Compare", icon: <Columns3 className="h-3.5 w-3.5" />, hint: "Measure before/after impact before applying a fix." },
  { id: "report", label: "Report", icon: <FileText className="h-3.5 w-3.5" />, hint: "Prepare the evidence-backed audit handoff." },
  { id: "debug", label: "Diagnostics", icon: <Sparkles className="h-3.5 w-3.5" />, hint: "Inspect detailed signals used by the simulation." },
  { id: "focus", label: "Focus", icon: <Shield className="h-3.5 w-3.5" />, hint: "Hide panels for uninterrupted site review." },
];

export function WorkspacePresetSwitcher() {
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const viewMode = useStudioStore((s) => s.viewMode);
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const leftDockCollapsed = useStudioStore((s) => s.leftDockCollapsed);
  const rightDockCollapsed = useStudioStore((s) => s.rightDockCollapsed);
  const bottomDockCollapsed = useStudioStore((s) => s.bottomDockCollapsed);
  const leftDockSizePx = useStudioStore((s) => s.leftDockSizePx);
  const rightDockSizePx = useStudioStore((s) => s.rightDockSizePx);
  const bottomDockSizePx = useStudioStore((s) => s.bottomDockSizePx);
  const visibleComponents = useStudioStore((s) => s.visibleComponents);
  const enabledAnalysisModules = useStudioStore((s) => s.enabledAnalysisModules);
  const layerVisibility = useStudioStore((s) => s.layerVisibility);
  const rightPanelMode = useStudioStore((s) => s.rightPanelMode);
  const bottomDrawerMode = useStudioStore((s) => s.bottomDrawerMode);
  const pinnedAnalysisModule = useStudioStore((s) => s.pinnedAnalysisModule);
  const overlayDensity = useStudioStore((s) => s.overlayDensity);
  const showDebugOverlays = useStudioStore((s) => s.showDebugOverlays);
  const clientDemoOptions = useStudioStore((s) => s.clientDemoOptions);
  const focusMode = useStudioStore((s) => s.focusMode);
  const bottomTab = useStudioStore((s) => s.bottomTab);
  const setPreset = useStudioStore((s) => s.setWorkspacePreset);
  const restore = useStudioStore((s) => s.restorePreviousLayout);
  const setViewSettingsOpen = useStudioStore((s) => s.setViewSettingsOpen);
  const savedLayouts = useStudioStore((s) => s.savedLayouts);
  const applySavedLayout = useStudioStore((s) => s.applySavedLayout);
  const deleteSavedLayout = useStudioStore((s) => s.deleteSavedLayout);
  const [open, setOpen] = useState(false);

  const current = useMemo(() => ({
    workspacePreset,
    viewMode,
    canvasMode,
    leftDockCollapsed,
    rightDockCollapsed,
    bottomDockCollapsed,
    leftDockSizePx,
    rightDockSizePx,
    bottomDockSizePx,
    visibleComponents,
    enabledAnalysisModules,
    layerVisibility,
    rightPanelMode,
    bottomDrawerMode,
    pinnedAnalysisModule,
    overlayDensity,
    showDebugOverlays,
    clientDemoOptions,
    focusMode,
    bottomTab,
  }), [
    workspacePreset,
    viewMode,
    canvasMode,
    leftDockCollapsed,
    rightDockCollapsed,
    bottomDockCollapsed,
    leftDockSizePx,
    rightDockSizePx,
    bottomDockSizePx,
    visibleComponents,
    enabledAnalysisModules,
    layerVisibility,
    rightPanelMode,
    bottomDrawerMode,
    pinnedAnalysisModule,
    overlayDensity,
    showDebugOverlays,
    clientDemoOptions,
    focusMode,
    bottomTab,
  ]);

  const active = PRESETS.find((entry) => entry.id === workspacePreset) ?? PRESETS[0]!;

  const isModified = useMemo(() => {
    const baseline = getPresetLayoutSnapshot(workspacePreset, DEFAULT_LAYERS);
    return isWorkspaceLayoutModified(
      {
        ...current,
        clientDemoOptions: current.clientDemoOptions,
      },
      baseline,
    );
  }, [current, workspacePreset]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-7 min-w-[126px] items-center gap-1.5 rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2.5 text-[11px] font-medium ${UI_SURFACES.textBody} transition-colors hover:border-[#32384d] ${UI_SURFACES.hoverText}`}
      >
        {active.icon}
        <span>{active.label}</span>
        {isModified ? (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-300">
            Modified
          </span>
        ) : null}
        <ChevronDown className="h-3 w-3 text-[#546078]" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-2 py-1 text-[9px] uppercase tracking-[0.22em] text-[#4d566b]">
            Workspaces
          </div>
          <div className="grid gap-1">
            {PRESETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  if (entry.id === "focus") {
                    if (current.focusMode) restore();
                    else setPreset("focus");
                  } else {
                    setPreset(entry.id);
                  }
                  setOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${UI_SURFACES.hoverBgMuted}",
                  current.workspacePreset === entry.id ? "bg-[#171c2b] text-emerald-300" : "${UI_SURFACES.textBody}",
                )}
              >
                <span className="mt-0.5 text-[#8da0c5]">{entry.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium">{entry.label}</span>
                  <span className="block text-[9px] leading-snug text-[#6c768f]">{entry.hint}</span>
                </span>
              </button>
            ))}
          </div>

          <div className={`{mt-2 border-t ${UI_SURFACES.borderPanel} pt-2}`}>
            <div className="px-2 py-1 text-[9px] uppercase tracking-[0.22em] text-[#4d566b]">
              Layout actions
            </div>
            <div className="grid gap-1">
              <button
                type="button"
                onClick={() => {
                  setViewSettingsOpen(true);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] ${UI_SURFACES.textBody} transition-colors ${UI_SURFACES.hoverBgMuted} ${UI_SURFACES.hoverText}`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-sky-300" />
                Customize current layout...
              </button>
              <button
                type="button"
                onClick={() => {
                  if (current.focusMode) {
                    restore();
                  } else {
                    setPreset(current.workspacePreset);
                  }
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] ${UI_SURFACES.textBody} transition-colors ${UI_SURFACES.hoverBgMuted} ${UI_SURFACES.hoverText}`}
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-300" />
                Reset current preset
              </button>
            </div>
          </div>

          <div className={`{mt-2 border-t ${UI_SURFACES.borderPanel} pt-2}`}>
            <div className="px-2 py-1 text-[9px] uppercase tracking-[0.22em] text-[#4d566b]">
              Saved layouts
            </div>
            {savedLayouts.length > 0 ? (
              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {savedLayouts.map((layout) => (
                  <div key={layout.id} className={`flex items-center gap-1 rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-1.5`}>
                    <button
                      type="button"
                      onClick={() => {
                        applySavedLayout(layout.id);
                        setOpen(false);
                      }}
                      className={`min-w-0 flex-1 text-left text-[11px] ${UI_SURFACES.textNear} transition-colors ${UI_SURFACES.hoverText}`}
                    >
                      <span className="block truncate font-medium">{layout.name}</span>
                      <span className="block truncate text-[9px] text-[#6c768f]">
                        {layout.workspacePreset.replace(/_/g, " ")} · {layout.viewMode.replace(/_/g, " ")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSavedLayout(layout.id)}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} text-[#7f8aa3] transition-colors hover:border-red-400/25 hover:text-red-200`}
                      title={`Delete ${layout.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`rounded-lg border border-dashed ${UI_SURFACES.borderStandard} px-2.5 py-2 text-[10px] text-[#72809a]`}>
                No custom layouts saved yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
