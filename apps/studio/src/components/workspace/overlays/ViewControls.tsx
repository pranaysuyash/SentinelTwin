"use client";

import { Layers, RefreshCcw } from "lucide-react";

import { MAP_COLORS } from "@/components/map/map-colors";
import { cn } from "@/lib/cn";
import { UI_EXPOSURE_PRESETS, nextUiExposure } from "@/lib/ui-exposure";
import { useStudioStore } from "@/store/studio-store";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
export function ViewControls() {
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const setCanvasMode = useStudioStore((s) => s.setCanvasMode);
  const resetCanvasView = useStudioStore((s) => s.resetCanvasView);
  const toggleViewSettingsOpen = useStudioStore((s) => s.toggleViewSettingsOpen);
  const uiExposure = useStudioStore((s) => s.uiExposure);
  const setUiExposure = useStudioStore((s) => s.setUiExposure);
  const exposurePreset = UI_EXPOSURE_PRESETS[uiExposure];

  return (
    <div className="absolute right-3 top-16 z-10 flex flex-col gap-1">
      {/* UI exposure dial (D-326): cycles Showcase → Focused → Full. Composes
          the existing chrome toggles; nothing is removed, only re-defaulted. */}
      <button
        type="button"
        onClick={() => setUiExposure(nextUiExposure(uiExposure))}
        aria-label={`UI exposure: ${exposurePreset.label}. Click to cycle.`}
        title={`${exposurePreset.label} — ${exposurePreset.description}`}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border UI_SURFACES.borderDark UI_SURFACES.bgDeep/90 text-[7px] font-bold tracking-wide UI_SURFACES.hoverTextSoft transition-colors UI_SURFACES.hoverBgMuted UI_SURFACES.hoverText`}
      >
        {exposurePreset.shortLabel}
      </button>
      <button
        type="button"
        onClick={() => setCanvasMode("orbit_3d")}
        aria-label="Switch to 3D orbit"
        title="Switch to 3D orbit"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-bold transition-colors",
           canvasMode === "orbit_3d"
             ? "border-sky-400 text-sky-100"
             : "UI_SURFACES.borderDark UI_SURFACES.bgDeep/90 UI_SURFACES.textSoftMid UI_SURFACES.hoverBgMuted UI_SURFACES.hoverText",
        )}
        style={canvasMode === "orbit_3d"
          ? {
              borderColor: MAP_COLORS.viewport,
              backgroundColor: "rgba(59, 130, 246, 0.14)",
            }
          : undefined}
      >
        3D
      </button>
      <button
        type="button"
        onClick={() => setCanvasMode("topdown_2d")}
        aria-label="Switch to 2.5D top-down"
        title="Switch to 2.5D top-down (orthographic over 3D geometry)"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border text-[8px] font-bold transition-colors",
           canvasMode === "topdown_2d"
             ? "border-emerald-400 text-emerald-100"
             : "UI_SURFACES.borderDark UI_SURFACES.bgDeep/90 UI_SURFACES.textSoftMid UI_SURFACES.hoverBgMuted UI_SURFACES.hoverText",
        )}
        style={canvasMode === "topdown_2d"
          ? {
              borderColor: MAP_COLORS.viewport,
              backgroundColor: "rgba(16, 185, 129, 0.14)",
            }
          : undefined}
      >
        2.5D
      </button>
      <button
        type="button"
        onClick={() => setCanvasMode("plan_2d")}
        aria-label="Switch to 2D plan"
        title="Switch to 2D architectural plan"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-bold transition-colors",
           canvasMode === "plan_2d"
             ? "border-amber-400 text-amber-100"
             : "UI_SURFACES.borderDark UI_SURFACES.bgDeep/90 UI_SURFACES.textSoftMid UI_SURFACES.hoverBgMuted UI_SURFACES.hoverText",
        )}
        style={canvasMode === "plan_2d"
          ? {
              borderColor: MAP_COLORS.viewport,
              backgroundColor: "rgba(245, 158, 11, 0.14)",
            }
          : undefined}
      >
        2D
      </button>
      <button
        type="button"
        onClick={resetCanvasView}
        aria-label="Reset canvas view"
        title="Reset canvas view"
        className={`flex h-8 w-8 items-center justify-center rounded-lg border UI_SURFACES.borderDark UI_SURFACES.bgDeep/90 UI_SURFACES.hoverBgMuted`}
      >
        <RefreshCcw className={`h-3.5 w-3.5 UI_SURFACES.textSoftMid UI_SURFACES.hoverText`} />
      </button>
      <button
        type="button"
        onClick={() => toggleViewSettingsOpen()}
        aria-label="Open View Settings"
        title="Open View Settings"
        className={`flex h-8 w-8 items-center justify-center rounded-lg border UI_SURFACES.borderDark UI_SURFACES.bgDeep/90 UI_SURFACES.hoverBgMuted`}
      >
        <Layers className={`h-3.5 w-3.5 UI_SURFACES.textSoftMid UI_SURFACES.hoverText`} />
      </button>
    </div>
  );
}
