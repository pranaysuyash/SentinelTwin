"use client";

import { Crosshair, Expand, Maximize, RotateCw } from "lucide-react";

import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";

export interface CameraPreset {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  fovHorizontalDeg: number;
  mountType: "wall" | "ceiling" | "pole";
  lensType: "fixed" | "varifocal" | "fisheye";
  resolutionMP: number;
  rangeM: number;
  nightMode: "none" | "ir" | "low_light" | "thermal";
  ptz: boolean;
  irRangeM: number;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "dome_indoor",
    label: "Indoor Dome",
    description: "2MP, 90° FOV, ceiling mount, 15m range",
    icon: <Expand className="h-3.5 w-3.5" />,
    fovHorizontalDeg: 90,
    mountType: "ceiling",
    lensType: "varifocal",
    resolutionMP: 2,
    rangeM: 15,
    nightMode: "ir",
    ptz: false,
    irRangeM: 10,
  },
  {
    id: "bullet_outdoor",
    label: "Bullet",
    description: "5MP, 60° FOV, wall mount, 30m range, IR",
    icon: <Crosshair className="h-3.5 w-3.5" />,
    fovHorizontalDeg: 60,
    mountType: "wall",
    lensType: "fixed",
    resolutionMP: 5,
    rangeM: 30,
    nightMode: "ir",
    ptz: false,
    irRangeM: 25,
  },
  {
    id: "ptz_professional",
    label: "PTZ",
    description: "8MP, 55°–4.5° zoom, pan/tilt/zoom, pole mount",
    icon: <RotateCw className="h-3.5 w-3.5" />,
    fovHorizontalDeg: 55,
    mountType: "pole",
    lensType: "varifocal",
    resolutionMP: 8,
    rangeM: 50,
    nightMode: "low_light",
    ptz: true,
    irRangeM: 30,
  },
  {
    id: "fisheye_360",
    label: "Fisheye 360°",
    description: "12MP, 180° FOV, ceiling mount, 12m range",
    icon: <Maximize className="h-3.5 w-3.5" />,
    fovHorizontalDeg: 180,
    mountType: "ceiling",
    lensType: "fisheye",
    resolutionMP: 12,
    rangeM: 12,
    nightMode: "ir",
    ptz: false,
    irRangeM: 8,
  },
];

export function CameraPresetPicker() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const [selectedPreset, setSelectedPreset] = useCameraPreset();

  if (activeTool !== "camera") return null;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#1f2536] bg-[#0d1017]/90 px-1.5 py-1 backdrop-blur-md">
      <span className="mr-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">
        Camera
      </span>
      {CAMERA_PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() =>
            setSelectedPreset(
              selectedPreset?.id === preset.id ? null : preset,
            )
          }
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] transition-colors",
            selectedPreset?.id === preset.id
              ? "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/25"
              : "text-[#68738a] hover:bg-[#171c2b] hover:text-[#c7d0e4]",
          )}
        >
          <span className={cn(
            "opacity-60",
            selectedPreset?.id === preset.id && "opacity-100",
          )}>
            {preset.icon}
          </span>
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Hook to get/set the currently selected camera preset.
 * Stores the preset ID in a URL-hash-friendly format.
 */
let _currentPresetId: string | null = null;

function useCameraPreset(): [CameraPreset | null, (preset: CameraPreset | null) => void] {
  const preset = _currentPresetId
    ? CAMERA_PRESETS.find((p) => p.id === _currentPresetId) ?? null
    : null;

  const setPreset = (next: CameraPreset | null) => {
    _currentPresetId = next?.id ?? null;
  };

  return [preset, setPreset];
}

/**
 * Synchronous getter for the currently selected preset (callable from callbacks).
 * Returns null if the user hasn't explicitly selected a preset — preserves default
 * createCameraNode() behavior.
 */
export function getCameraPreset(): CameraPreset | null {
  if (!_currentPresetId) return null;
  return CAMERA_PRESETS.find((p) => p.id === _currentPresetId) ?? null;
}

/**
 * Applies the selected camera preset to a default camera node.
 * Called from ToolPlacementFloor when placing a camera.
 */
export function applyCameraPreset(
  preset: CameraPreset | null,
): Partial<import("@/schema/security-scene").CameraNode> {
  if (!preset) return {};
  return {
    fovHorizontalDeg: preset.fovHorizontalDeg,
    mountType: preset.mountType as "wall" | "ceiling" | "pole" | "corner" | "desk",
    lensType: preset.lensType as "fixed" | "varifocal" | "fisheye" | "panoramic",
    resolutionMP: preset.resolutionMP,
    rangeM: preset.rangeM,
    nightMode: preset.nightMode,
    ptz: preset.ptz,
    irRangeM: preset.irRangeM,
  };
}
