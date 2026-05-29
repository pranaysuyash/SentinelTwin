import type { CameraNode } from "@/schema/security-scene";
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
    icon: null,
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
    icon: null,
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
    icon: null,
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
    icon: null,
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

function matchPresetScore(camera: CameraNode, preset: CameraPreset): number {
  let score = 0;
  if (camera.mountType === preset.mountType) score += 4;
  if (camera.lensType === preset.lensType) score += 3;
  if (camera.nightMode === preset.nightMode) score += 2;
  if (camera.ptz === preset.ptz) score += 2;
  const fovDelta = Math.abs(camera.fovHorizontalDeg - preset.fovHorizontalDeg);
  score += Math.max(0, 3 - Math.min(3, fovDelta / 30));
  const rangeDelta = Math.abs(camera.rangeM - preset.rangeM);
  score += Math.max(0, 2 - Math.min(2, rangeDelta / 20));
  const resolutionDelta = Math.abs(camera.resolutionMP - preset.resolutionMP);
  score += Math.max(0, 2 - Math.min(2, resolutionDelta / 4));
  return score;
}

export function findBestCameraPreset(camera: CameraNode): CameraPreset | null {
  if (!CAMERA_PRESETS.length) return null;
  return CAMERA_PRESETS
    .map((preset) => ({ preset, score: matchPresetScore(camera, preset) }))
    .sort((a, b) => b.score - a.score)[0]?.preset ?? null;
}

export function describeCameraPreset(preset: CameraPreset): string {
  return `${preset.resolutionMP}MP · ${preset.fovHorizontalDeg}° · ${preset.mountType} · ${preset.nightMode === "none" ? "day only" : preset.nightMode}`;
}

export function getCameraPreset(cameraPresetId: string | null = useStudioStore.getState().cameraPresetId) {
  if (!cameraPresetId) return null;
  return CAMERA_PRESETS.find((preset) => preset.id === cameraPresetId) ?? null;
}

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
