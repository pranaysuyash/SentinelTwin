import type { CameraNode } from "@/schema/security-scene";

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  description: string;
  fovHorizontalDeg: number;
  mountType: "wall" | "ceiling" | "pole" | "corner";
  lensType: "fixed" | "varifocal" | "fisheye" | "panoramic";
  resolutionMP: number;
  rangeM: number;
  nightMode: "none" | "ir" | "low_light" | "thermal";
  ptz: boolean;
  irRangeM: number;
}

export const CAMERA_PRESET_IDS = [
  "dome_indoor",
  "bullet_outdoor",
  "ptz_professional",
  "fisheye_360",
  "thermal_perimeter",
  "low_light_indoor",
  "license_plate",
  "panoramic_wide",
] as const;

export type CameraPresetId = (typeof CAMERA_PRESET_IDS)[number];

export const CAMERA_PRESETS = [
  {
    id: "dome_indoor",
    label: "Indoor Dome",
    description: "2MP, 90° FOV, ceiling mount, 15m range",
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
    fovHorizontalDeg: 180,
    mountType: "ceiling",
    lensType: "fisheye",
    resolutionMP: 12,
    rangeM: 12,
    nightMode: "ir",
    ptz: false,
    irRangeM: 8,
  },
  {
    id: "thermal_perimeter",
    label: "Thermal Perimeter",
    description: "0.3MP thermal, 24° FOV, pole mount, 100m range",
    fovHorizontalDeg: 24,
    mountType: "pole",
    lensType: "fixed",
    resolutionMP: 0.3,
    rangeM: 100,
    nightMode: "thermal",
    ptz: false,
    irRangeM: 0,
  },
  {
    id: "low_light_indoor",
    label: "Low-Light Indoor",
    description: "6MP, 100° FOV, corner mount, 20m range, low-light sensor",
    fovHorizontalDeg: 100,
    mountType: "corner",
    lensType: "varifocal",
    resolutionMP: 6,
    rangeM: 20,
    nightMode: "low_light",
    ptz: false,
    irRangeM: 12,
  },
  {
    id: "license_plate",
    label: "License Plate",
    description: "8MP, 30° telephoto, wall mount, 25m range, LPR-optimized",
    fovHorizontalDeg: 30,
    mountType: "wall",
    lensType: "fixed",
    resolutionMP: 8,
    rangeM: 25,
    nightMode: "ir",
    ptz: false,
    irRangeM: 20,
  },
  {
    id: "panoramic_wide",
    label: "Panoramic Wide",
    description: "20MP, 360° panoramic, ceiling mount, 15m range",
    fovHorizontalDeg: 360,
    mountType: "ceiling",
    lensType: "panoramic",
    resolutionMP: 20,
    rangeM: 15,
    nightMode: "ir",
    ptz: false,
    irRangeM: 10,
  },
] as const satisfies ReadonlyArray<CameraPreset>;

const CAMERA_PRESET_BY_ID = CAMERA_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = preset;
  return acc;
}, {} as Record<CameraPresetId, CameraPreset>);

const SCORE_WEIGHTS = {
  mountType: 4,
  lensType: 3,
  nightMode: 2,
  ptz: 2,
  fov: 3,
  range: 2,
  resolution: 2,
} as const;

function proximityScore(candidate: number, target: number, bucket: number) {
  const delta = Math.abs(candidate - target);
  return Math.max(0, bucket - Math.min(bucket, delta / (bucket * 10)));
}

function matchPresetScore(camera: CameraNode, preset: CameraPreset): number {
  let score = 0;
  if (camera.mountType === preset.mountType) score += SCORE_WEIGHTS.mountType;
  if (camera.lensType === preset.lensType) score += SCORE_WEIGHTS.lensType;
  if (camera.nightMode === preset.nightMode) score += SCORE_WEIGHTS.nightMode;
  if (camera.ptz === preset.ptz) score += SCORE_WEIGHTS.ptz;
  score += proximityScore(camera.fovHorizontalDeg, preset.fovHorizontalDeg, SCORE_WEIGHTS.fov);
  score += proximityScore(camera.rangeM, preset.rangeM, SCORE_WEIGHTS.range);
  score += proximityScore(camera.resolutionMP, preset.resolutionMP, SCORE_WEIGHTS.resolution);
  return score;
}

export function findBestCameraPreset(camera: CameraNode): CameraPreset | null {
  if (!CAMERA_PRESETS.length) return null;
  return CAMERA_PRESETS
    .reduce<{ preset: CameraPreset; score: number } | null>((best, preset) => {
      const score = matchPresetScore(camera, preset);
      if (!best) return { preset, score };
      if (score > best.score) return { preset, score };
      if (score < best.score) return best;
      return preset.id < best.preset.id ? { preset, score } : best;
    }, null)?.preset ?? null;
}

export function cameraPresetIcon(presetId: CameraPresetId): string {
  const icons: Record<CameraPresetId, string> = {
    dome_indoor: "\u25D4",
    bullet_outdoor: "\u25B6",
    ptz_professional: "\u2699",
    fisheye_360: "\u25C9",
    thermal_perimeter: "\u26A1",
    low_light_indoor: "\u263E",
    license_plate: "\u2691",
    panoramic_wide: "\u2B21",
  };
  return icons[presetId] ?? "\u25CB";
}

export function describeCameraPreset(preset: CameraPreset): string {
  const nightModeLabel = preset.nightMode === "none" ? "day only" : preset.nightMode;
  return `${preset.resolutionMP}MP · ${preset.fovHorizontalDeg}° FOV · ${preset.mountType} · ${nightModeLabel}`;
}

export function getCameraPreset(cameraPresetId: CameraPresetId | null | undefined) {
  if (!cameraPresetId) return null;
  return CAMERA_PRESET_BY_ID[cameraPresetId] ?? null;
}

export function applyCameraPreset(preset: CameraPreset | null): Partial<CameraNode> {
  if (!preset) return {};
  return {
    presetId: preset.id,
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
