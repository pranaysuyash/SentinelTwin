import type { CameraNode } from "@/schema/security-scene";

export type CameraPresetCategory = "generic" | "manufacturer";

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
  category: CameraPresetCategory;
  manufacturer?: string;
  modelNumber?: string;
  focalLengthMm?: number;
}

export const GENERIC_PRESET_IDS = [
  "dome_indoor",
  "bullet_outdoor",
  "ptz_professional",
  "fisheye_360",
  "thermal_perimeter",
  "low_light_indoor",
  "license_plate",
  "panoramic_wide",
] as const;

export const MANUFACTURER_PRESET_IDS = [
  "hik_ds2cd2143g2is",
  "hik_ds2cd2t85fwd_i5",
  "hik_ds2de4425iw_de",
  "dahua_hdbw3441e",
  "dahua_hfw2841t_zas",
  "dahua_sd49425gbn",
  "axis_p3245v",
  "axis_q6135le",
  "axis_m3116lve",
  "hanwha_xnv8080r",
  "hanwha_xno8080r",
  "hanwha_pnm9000vq",
  "bosch_flexidome5100i",
  "bosch_dinion7100i",
  "vivotek_fd9391ehtv",
] as const;

export const CAMERA_PRESET_IDS = [
  ...GENERIC_PRESET_IDS,
  ...MANUFACTURER_PRESET_IDS,
] as const;

export type CameraPresetId = (typeof CAMERA_PRESET_IDS)[number];

const GENERIC_PRESETS: ReadonlyArray<CameraPreset> = [
  {
    id: "dome_indoor",
    label: "2MP Indoor Dome",
    description: "2MP, 90° FOV, ceiling mount, 15m range",
    fovHorizontalDeg: 90,
    mountType: "ceiling",
    lensType: "varifocal",
    resolutionMP: 2,
    rangeM: 15,
    nightMode: "ir",
    ptz: false,
    irRangeM: 10,
    category: "generic",
  },
  {
    id: "panoramic_wide",
    label: "4MP Wide Dome",
    description: "4MP, 110° FOV, ceiling mount, 18m range, wide-angle",
    fovHorizontalDeg: 110,
    mountType: "ceiling",
    lensType: "varifocal",
    resolutionMP: 4,
    rangeM: 18,
    nightMode: "ir",
    ptz: false,
    irRangeM: 12,
    category: "generic",
  },
  {
    id: "bullet_outdoor",
    label: "8MP Bullet",
    description: "8MP, 60° FOV, wall mount, 30m range, IR",
    fovHorizontalDeg: 60,
    mountType: "wall",
    lensType: "fixed",
    resolutionMP: 8,
    rangeM: 30,
    nightMode: "ir",
    ptz: false,
    irRangeM: 25,
    category: "generic",
  },
  {
    id: "ptz_professional",
    label: "PTZ Outdoor",
    description: "8MP, 55°–4.5° zoom, pan/tilt/zoom, pole mount, outdoor rated",
    fovHorizontalDeg: 55,
    mountType: "pole",
    lensType: "varifocal",
    resolutionMP: 8,
    rangeM: 50,
    nightMode: "low_light",
    ptz: true,
    irRangeM: 30,
    category: "generic",
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
    category: "generic",
  },
  {
    id: "low_light_indoor",
    label: "Low-Light Camera",
    description: "6MP, 100° FOV, corner mount, 20m range, low-light sensor",
    fovHorizontalDeg: 100,
    mountType: "corner",
    lensType: "varifocal",
    resolutionMP: 6,
    rangeM: 20,
    nightMode: "low_light",
    ptz: false,
    irRangeM: 12,
    category: "generic",
  },
  {
    id: "fisheye_360",
    label: "Fisheye 360",
    description: "12MP, 180° FOV, ceiling mount, 12m range",
    fovHorizontalDeg: 180,
    mountType: "ceiling",
    lensType: "fisheye",
    resolutionMP: 12,
    rangeM: 12,
    nightMode: "ir",
    ptz: false,
    irRangeM: 8,
    category: "generic",
  },
  {
    id: "license_plate",
    label: "License Plate Camera",
    description: "8MP, 30° telephoto, wall mount, 25m range, LPR-optimized",
    fovHorizontalDeg: 30,
    mountType: "wall",
    lensType: "fixed",
    resolutionMP: 8,
    rangeM: 25,
    nightMode: "ir",
    ptz: false,
    irRangeM: 20,
    category: "generic",
  },
];

const MANUFACTURER_PRESETS: ReadonlyArray<CameraPreset> = [
  // ── Hikvision ──────────────────────────────────────────────────────────
  {
    id: "hik_ds2cd2143g2is",
    label: "Hikvision DS-2CD2143G2-IS",
    description: "4MP AcuSense dome, 2.8mm fixed, 103° HFOV, 30m IR, ceiling mount",
    manufacturer: "Hikvision",
    modelNumber: "DS-2CD2143G2-IS",
    fovHorizontalDeg: 103,
    focalLengthMm: 2.8,
    mountType: "ceiling",
    lensType: "fixed",
    resolutionMP: 4,
    rangeM: 20,
    nightMode: "ir",
    ptz: false,
    irRangeM: 30,
    category: "manufacturer",
  },
  {
    id: "hik_ds2cd2t85fwd_i5",
    label: "Hikvision DS-2CD2T85FWD-I5",
    description: "8MP bullet, 2.8mm fixed, 102° HFOV, 50m IR, wall mount",
    manufacturer: "Hikvision",
    modelNumber: "DS-2CD2T85FWD-I5",
    fovHorizontalDeg: 102,
    focalLengthMm: 2.8,
    mountType: "wall",
    lensType: "fixed",
    resolutionMP: 8,
    rangeM: 35,
    nightMode: "ir",
    ptz: false,
    irRangeM: 50,
    category: "manufacturer",
  },
  {
    id: "hik_ds2de4425iw_de",
    label: "Hikvision DS-2DE4425IW-DE",
    description: "4MP PTZ, 4.8–120mm 25× zoom, 57.6°–2.4° HFOV, 100m IR",
    manufacturer: "Hikvision",
    modelNumber: "DS-2DE4425IW-DE",
    fovHorizontalDeg: 57.6,
    focalLengthMm: 4.8,
    mountType: "pole",
    lensType: "varifocal",
    resolutionMP: 4,
    rangeM: 60,
    nightMode: "ir",
    ptz: true,
    irRangeM: 100,
    category: "manufacturer",
  },
  // ── Dahua ──────────────────────────────────────────────────────────────
  {
    id: "dahua_hdbw3441e",
    label: "Dahua DH-IPC-HDBW3441E-AS",
    description: "4MP AI dome, 2.8mm fixed, 101° HFOV, 30m IR, ceiling mount",
    manufacturer: "Dahua",
    modelNumber: "DH-IPC-HDBW3441E-AS",
    fovHorizontalDeg: 101,
    focalLengthMm: 2.8,
    mountType: "ceiling",
    lensType: "fixed",
    resolutionMP: 4,
    rangeM: 20,
    nightMode: "ir",
    ptz: false,
    irRangeM: 30,
    category: "manufacturer",
  },
  {
    id: "dahua_hfw2841t_zas",
    label: "Dahua DH-IPC-HFW2841T-ZAS",
    description: "8MP bullet, 2.7–13.5mm motorized, 106°–30° HFOV, 60m IR",
    manufacturer: "Dahua",
    modelNumber: "DH-IPC-HFW2841T-ZAS",
    fovHorizontalDeg: 106,
    focalLengthMm: 2.7,
    mountType: "wall",
    lensType: "varifocal",
    resolutionMP: 8,
    rangeM: 40,
    nightMode: "ir",
    ptz: false,
    irRangeM: 60,
    category: "manufacturer",
  },
  {
    id: "dahua_sd49425gbn",
    label: "Dahua SD49425GB-HNR",
    description: "4MP PTZ, 5–125mm 25× zoom, 58°–2.5° HFOV, 100m IR",
    manufacturer: "Dahua",
    modelNumber: "SD49425GB-HNR",
    fovHorizontalDeg: 58,
    focalLengthMm: 5,
    mountType: "pole",
    lensType: "varifocal",
    resolutionMP: 4,
    rangeM: 60,
    nightMode: "ir",
    ptz: true,
    irRangeM: 100,
    category: "manufacturer",
  },
  // ── Axis ───────────────────────────────────────────────────────────────
  {
    id: "axis_p3245v",
    label: "Axis P3245-V",
    description: "2MP indoor dome, 3–9mm varifocal, 100°–34° HFOV, Lightfinder 2.0",
    manufacturer: "Axis",
    modelNumber: "P3245-V",
    fovHorizontalDeg: 100,
    focalLengthMm: 3,
    mountType: "ceiling",
    lensType: "varifocal",
    resolutionMP: 2,
    rangeM: 20,
    nightMode: "low_light",
    ptz: false,
    irRangeM: 0,
    category: "manufacturer",
  },
  {
    id: "axis_q6135le",
    label: "Axis Q6135-LE",
    description: "2MP PTZ, 4.3–129mm 30× zoom, 59.5°–2.3° HFOV, 250m OptimizedIR",
    manufacturer: "Axis",
    modelNumber: "Q6135-LE",
    fovHorizontalDeg: 59.5,
    focalLengthMm: 4.3,
    mountType: "pole",
    lensType: "varifocal",
    resolutionMP: 2,
    rangeM: 80,
    nightMode: "ir",
    ptz: true,
    irRangeM: 250,
    category: "manufacturer",
  },
  {
    id: "axis_m3116lve",
    label: "Axis M3116-LVE",
    description: "4MP mini dome, 2.4mm fixed, 105° HFOV, 20m IR, outdoor",
    manufacturer: "Axis",
    modelNumber: "M3116-LVE",
    fovHorizontalDeg: 105,
    focalLengthMm: 2.4,
    mountType: "ceiling",
    lensType: "fixed",
    resolutionMP: 4,
    rangeM: 15,
    nightMode: "ir",
    ptz: false,
    irRangeM: 20,
    category: "manufacturer",
  },
  // ── Hanwha (Wisenet) ───────────────────────────────────────────────────
  {
    id: "hanwha_xnv8080r",
    label: "Hanwha XNV-8080R",
    description: "5MP vandal dome, 3.7mm fixed, 97.5° HFOV, 30m IR, IK10",
    manufacturer: "Hanwha",
    modelNumber: "XNV-8080R",
    fovHorizontalDeg: 97.5,
    focalLengthMm: 3.7,
    mountType: "ceiling",
    lensType: "fixed",
    resolutionMP: 5,
    rangeM: 25,
    nightMode: "ir",
    ptz: false,
    irRangeM: 30,
    category: "manufacturer",
  },
  {
    id: "hanwha_xno8080r",
    label: "Hanwha XNO-8080R",
    description: "5MP bullet, 3.7mm fixed, 97.5° HFOV, 30m IR, outdoor",
    manufacturer: "Hanwha",
    modelNumber: "XNO-8080R",
    fovHorizontalDeg: 97.5,
    focalLengthMm: 3.7,
    mountType: "wall",
    lensType: "fixed",
    resolutionMP: 5,
    rangeM: 25,
    nightMode: "ir",
    ptz: false,
    irRangeM: 30,
    category: "manufacturer",
  },
  {
    id: "hanwha_pnm9000vq",
    label: "Hanwha PNM-9000VQ",
    description: "4×5MP multi-sensor panoramic, 4×2.8mm, 4×108° HFOV, 30m IR",
    manufacturer: "Hanwha",
    modelNumber: "PNM-9000VQ",
    fovHorizontalDeg: 108,
    focalLengthMm: 2.8,
    mountType: "ceiling",
    lensType: "panoramic",
    resolutionMP: 20,
    rangeM: 20,
    nightMode: "ir",
    ptz: false,
    irRangeM: 30,
    category: "manufacturer",
  },
  // ── Bosch ──────────────────────────────────────────────────────────────
  {
    id: "bosch_flexidome5100i",
    label: "Bosch FLEXIDOME IP 5100i",
    description: "2MP indoor dome, 3–10mm varifocal, 95°–31° HFOV, 30m IR",
    manufacturer: "Bosch",
    modelNumber: "FLEXIDOME IP 5100i",
    fovHorizontalDeg: 95,
    focalLengthMm: 3,
    mountType: "ceiling",
    lensType: "varifocal",
    resolutionMP: 2,
    rangeM: 20,
    nightMode: "ir",
    ptz: false,
    irRangeM: 30,
    category: "manufacturer",
  },
  {
    id: "bosch_dinion7100i",
    label: "Bosch DINION IP 7100i",
    description: "2MP bullet, 3.2–10mm varifocal, 99°–31° HFOV, 30m IR, outdoor",
    manufacturer: "Bosch",
    modelNumber: "DINION IP 7100i",
    fovHorizontalDeg: 99,
    focalLengthMm: 3.2,
    mountType: "wall",
    lensType: "varifocal",
    resolutionMP: 2,
    rangeM: 25,
    nightMode: "ir",
    ptz: false,
    irRangeM: 30,
    category: "manufacturer",
  },
  // ── Vivotek ────────────────────────────────────────────────────────────
  {
    id: "vivotek_fd9391ehtv",
    label: "Vivotek FD9391-EHTV",
    description: "8MP dome, 3.9–10mm motorized, 86°–38° HFOV, 30m IR, -50°C rated",
    manufacturer: "Vivotek",
    modelNumber: "FD9391-EHTV",
    fovHorizontalDeg: 86,
    focalLengthMm: 3.9,
    mountType: "ceiling",
    lensType: "varifocal",
    resolutionMP: 8,
    rangeM: 25,
    nightMode: "ir",
    ptz: false,
    irRangeM: 30,
    category: "manufacturer",
  },
];

export const CAMERA_PRESETS: ReadonlyArray<CameraPreset> = [
  ...GENERIC_PRESETS,
  ...MANUFACTURER_PRESETS,
];

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
  const icons: Partial<Record<CameraPresetId, string>> = {
    dome_indoor: "\u25D4",
    bullet_outdoor: "\u25B6",
    ptz_professional: "\u2699",
    fisheye_360: "\u25C9",
    thermal_perimeter: "\u26A1",
    low_light_indoor: "\u263E",
    license_plate: "\u2691",
    panoramic_wide: "\u2B21",
  };
  if (icons[presetId]) return icons[presetId]!;
  const preset = CAMERA_PRESETS.find((p) => p.id === presetId);
  if (!preset) return "\u25CB";
  if (preset.ptz) return "\u2699";
  if (preset.nightMode === "thermal") return "\u26A1";
  if (preset.lensType === "fisheye") return "\u25C9";
  if (preset.mountType === "ceiling") return "\u25D4";
  if (preset.mountType === "wall") return "\u25B6";
  return "\u25CB";
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
  const patch: Partial<CameraNode> = {
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
  if (preset.focalLengthMm != null) patch.focalLengthMm = preset.focalLengthMm;
  return patch;
}

export function getGenericPresets(): ReadonlyArray<CameraPreset> {
  return GENERIC_PRESETS;
}

export function getManufacturerPresets(): ReadonlyArray<CameraPreset> {
  return MANUFACTURER_PRESETS;
}

export function getManufacturerNames(): string[] {
  const names = new Set<string>();
  for (const p of MANUFACTURER_PRESETS) {
    if (p.manufacturer) names.add(p.manufacturer);
  }
  return Array.from(names).sort();
}

export function getPresetsByManufacturer(manufacturer: string): ReadonlyArray<CameraPreset> {
  return MANUFACTURER_PRESETS.filter((p) => p.manufacturer === manufacturer);
}
