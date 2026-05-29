"use client";

import { Crosshair, Expand, Maximize, RotateCw } from "lucide-react";

import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";

import {
  CAMERA_PRESETS,
  describeCameraPreset,
  getCameraPreset as getCameraPresetImpl,
  type CameraPreset,
} from "./camera-preset-utils";

const PRESET_ICONS: Record<CameraPreset["id"], React.ReactNode> = {
  dome_indoor: <Expand className="h-3.5 w-3.5" />,
  bullet_outdoor: <Crosshair className="h-3.5 w-3.5" />,
  ptz_professional: <RotateCw className="h-3.5 w-3.5" />,
  fisheye_360: <Maximize className="h-3.5 w-3.5" />,
};

function presetTags(preset: CameraPreset): string[] {
  return [
    `${preset.resolutionMP}MP`,
    `${preset.fovHorizontalDeg}° FOV`,
    preset.mountType,
    preset.lensType,
    preset.nightMode === "none" ? "Day only" : preset.nightMode === "ir" ? "IR" : preset.nightMode === "low_light" ? "Low light" : "Thermal",
    preset.ptz ? "PTZ" : "Fixed",
  ];
}

export function CameraPresetPicker() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const selectedPresetId = useStudioStore((s) => s.cameraPresetId);
  const setSelectedPresetId = useStudioStore((s) => s.setCameraPresetId);
  const selectedPreset = getCameraPresetImpl(selectedPresetId);

  if (activeTool !== "camera") return null;

  return (
    <div className="w-[560px] rounded-2xl border border-[#1f2536] bg-[#0d1017]/96 p-2.5 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">
            Camera placement presets
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-[#7b889f]">
            Pick the camera profile before placing a new camera. The preset rail stays canonical, and the same preset can also be applied to the selected camera from the inspector.
          </div>
        </div>
        <div className="shrink-0 rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1 text-right">
          <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active</div>
          <div className="mt-0.5 text-[10px] font-semibold text-[#d2d9e8]">
            {selectedPreset ? selectedPreset.label : "Custom camera"}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {CAMERA_PRESETS.map((preset) => {
          const isSelected = selectedPreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedPresetId(isSelected ? null : preset.id)}
              aria-pressed={isSelected}
              className={cn(
                "group rounded-xl border px-3 py-2.5 text-left transition-all",
                isSelected
                  ? "border-blue-400/50 bg-blue-500/10 shadow-[0_0_0_1px_rgba(96,165,250,0.2)]"
                  : "border-[#1f2536] bg-[#0b0f17] hover:border-[#2d3750] hover:bg-[#111521]",
              )}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    isSelected ? "border-blue-400/30 bg-blue-500/12 text-blue-200" : "border-[#24314a] bg-[#101622] text-[#93a4bf]",
                  )}
                >
                  {PRESET_ICONS[preset.id] ?? null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[11px] font-semibold text-[#e6ebf7]">{preset.label}</div>
                    {isSelected ? (
                      <span className="rounded-full border border-blue-400/25 bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-blue-200">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[9px] leading-relaxed text-[#74829d]">
                    {preset.description}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {presetTags(preset).map((tag) => (
                  <span key={tag} className="rounded-full border border-[#1f2536] bg-[#111521] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[#7d8aa4]">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] px-3 py-2">
        {selectedPreset ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Selected preset</div>
              <div className="mt-0.5 text-[11px] font-semibold text-[#d2d9e8]">{selectedPreset.label}</div>
              <div className="mt-0.5 text-[9px] text-[#7b889f]">{describeCameraPreset(selectedPreset)}</div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPresetId(null)}
              className="shrink-0 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
            >
              Clear selection
            </button>
          </div>
        ) : (
          <div className="text-[9px] leading-relaxed text-[#7b889f]">
            No preset selected. Choose a profile above to place the next camera with the correct optics, range, and night mode assumptions.
          </div>
        )}
      </div>
    </div>
  );
}
