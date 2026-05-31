import type {
  CalibrationCameraPreset,
  CalibrationConstants,
  CameraNode,
  SecurityScene,
} from "@sentineltwin/core";

/**
 * Default calibration constants — production defaults from Thread 2b.
 *
 * These are the canonical calibration values used when the scene has no
 * custom calibrationConstants. They encode:
 * - Camera preset library (7 common security camera profiles)
 * - Lux-to-light-level thresholds
 * - Night mode PPM retention factors (per IEC 62676-4:2025 guidance)
 * - Mount tilt realism limits (by mount type)
 * - Lens edge falloff defaults (by lens type)
 *
 * Source: Combined manufacturer spec sheets, IPVM benchmarks,
 * and IEC 62676-4:2025 annex guidance. Confidence: medium.
 * Calibration dataset needs expansion (see OPEN_QUESTIONS.md Q-NEW).
 */
export const DEFAULT_CALIBRATION: CalibrationConstants = {
  cameraPresets: {
    "indoor_dome_2mp": {
      name: "Indoor Dome 2MP",
      resolutionWidthPx: 1920,
      resolutionHeightPx: 1080,
      fovHorizontalDeg: 92,
      fovVerticalDeg: 52,
      rangeM: 25,
      nightMode: "low_light",
      irRangeM: 0,
      mountTypes: ["wall", "ceiling"],
      lensType: "fixed",
      focalLengthMm: 3.6,
      source: "spec_sheet",
      confidence: "high",
      edgeFalloffFactor: 0.42,
    },
    "wide_dome_5mp": {
      name: "Wide Dome 5MP",
      resolutionWidthPx: 2592,
      resolutionHeightPx: 1944,
      fovHorizontalDeg: 106,
      fovVerticalDeg: 78,
      rangeM: 30,
      nightMode: "low_light",
      irRangeM: 0,
      mountTypes: ["ceiling", "wall"],
      lensType: "varifocal",
      source: "spec_sheet",
      confidence: "high",
      edgeFalloffFactor: 0.35,
    },
    "bullet_5mp": {
      name: "Bullet 5MP",
      resolutionWidthPx: 2592,
      resolutionHeightPx: 1944,
      fovHorizontalDeg: 60,
      fovVerticalDeg: 34,
      rangeM: 50,
      nightMode: "ir",
      irRangeM: 30,
      mountTypes: ["wall", "pole", "corner"],
      lensType: "fixed",
      focalLengthMm: 6.0,
      source: "spec_sheet",
      confidence: "high",
      edgeFalloffFactor: 0.42,
    },
    "ptz_8mp": {
      name: "PTZ 8MP",
      resolutionWidthPx: 3840,
      resolutionHeightPx: 2160,
      fovHorizontalDeg: 60,
      fovVerticalDeg: 34,
      rangeM: 100,
      nightMode: "ir",
      irRangeM: 60,
      mountTypes: ["wall", "ceiling", "pole", "corner"],
      lensType: "varifocal",
      source: "spec_sheet",
      confidence: "medium",
      edgeFalloffFactor: 0.35,
    },
    "thermal_640": {
      name: "Thermal 640×512",
      resolutionWidthPx: 640,
      resolutionHeightPx: 512,
      fovHorizontalDeg: 24,
      fovVerticalDeg: 18,
      rangeM: 150,
      nightMode: "thermal",
      irRangeM: 0,
      mountTypes: ["wall", "ceiling", "pole"],
      lensType: "fixed",
      focalLengthMm: 25,
      source: "spec_sheet",
      confidence: "medium",
      edgeFalloffFactor: 0.50,
    },
    "low_light_4mp": {
      name: "Low-Light 4MP",
      resolutionWidthPx: 2688,
      resolutionHeightPx: 1520,
      fovHorizontalDeg: 80,
      fovVerticalDeg: 44,
      rangeM: 40,
      nightMode: "low_light",
      irRangeM: 0,
      mountTypes: ["ceiling", "wall"],
      lensType: "varifocal",
      source: "spec_sheet",
      confidence: "high",
      edgeFalloffFactor: 0.38,
    },
    "lpr_2mp": {
      name: "License Plate Reader 2MP",
      resolutionWidthPx: 1920,
      resolutionHeightPx: 1080,
      fovHorizontalDeg: 28,
      fovVerticalDeg: 16,
      rangeM: 25,
      nightMode: "ir",
      irRangeM: 20,
      mountTypes: ["pole", "corner"],
      lensType: "fixed",
      focalLengthMm: 12,
      source: "spec_sheet",
      confidence: "medium",
      edgeFalloffFactor: 0.45,
    },
  },
  luxThresholds: { bright: 50, normal: 10, dim: 3, dark: 0.5 },
  nightModeRetention: { thermal: 0.92, low_light: 0.82, ir: 0.68, none: 0.12 },
  mountTiltLimits: { wall: 60, ceiling: 45, pole: 55, corner: 50, desk: 35 },
  lensEdgeFalloff: { fixed: 0.42, varifocal: 0.35, fisheye: 0.15, panoramic: 0.20 },
  version: "0.1.0",
  notes: "Default calibration constants. Calibrated against manufacturer spec sheets only. Not yet field-verified against real camera footage.",
};

/**
 * Get effective calibration constants for a scene.
 * Falls back to DEFAULT_CALIBRATION if no custom calibration is set.
 */
export function getCalibration(scene: Pick<SecurityScene, "calibrationConstants">): CalibrationConstants {
  return scene.calibrationConstants ?? DEFAULT_CALIBRATION;
}

/**
 * Look up a camera preset by name, returning calibration data if available.
 */
export function getCameraPreset(
  calibration: CalibrationConstants,
  presetName: string,
): CalibrationCameraPreset | undefined {
  return calibration.cameraPresets[presetName];
}

/**
 * Estimate confidence that a camera's on-spec parameter values are accurate.
 *
 * Returns a confidence level based on source provenance:
 * - spec_sheet → high (if manufacturer-trusted) or medium
 * - footage_verified → verified (gold standard)
 * - scan_reconstruction → medium (geometry inferred)
 * - ai_estimate → low (no direct measurement)
 * - assumption → none (default fallback)
 * - operator → medium (human measurement, error possible)
 */
export function estimateCameraConfidence(camera: CameraNode): "none" | "low" | "medium" | "high" | "verified" {
  switch (camera.source) {
    case "demo":
    case "preset":
      return "medium";
    case "manual":
      return "high";
    case "ai":
      return "low";
    case "scan":
      return "medium";
    case "import":
      return "medium";
    default:
      return "none";
  }
}

/**
 * Get the effective edge falloff factor for a camera based on its lens type.
 */
export function getEdgeFalloffFactor(camera: CameraNode, calibration?: CalibrationConstants): number {
  const cal = calibration ?? DEFAULT_CALIBRATION;
  return cal.lensEdgeFalloff[camera.lensType] ?? 0.40;
}

/**
 * Get the maximum allowed pitch tilt for a given mount type.
 */
export function getMountTiltLimit(mountType: CameraNode["mountType"], calibration?: CalibrationConstants): number {
  const cal = calibration ?? DEFAULT_CALIBRATION;
  return cal.mountTiltLimits[mountType] ?? 50;
}

/**
 * Compute night mode PPM retention factor — fraction of daylight PPM retained.
 */
export function getNightModeRetentionFactor(
  camera: CameraNode,
  calibration?: CalibrationConstants,
): number {
  const cal = calibration ?? DEFAULT_CALIBRATION;
  return cal.nightModeRetention[camera.nightMode] ?? 0.5;
}

/**
 * Map lux value to light-level label using calibrated thresholds.
 */
export function luxToLightLevel(lux: number, calibration?: CalibrationConstants): "bright" | "normal" | "dim" | "dark" {
  const cal = calibration ?? DEFAULT_CALIBRATION;
  if (lux >= cal.luxThresholds.bright) return "bright";
  if (lux >= cal.luxThresholds.normal) return "normal";
  if (lux >= cal.luxThresholds.dim) return "dim";
  return "dark";
}

/**
 * Compute the expected confidence interval for a PPM value.
 * Higher PPM values with higher-calibration cameras have narrower intervals.
 */
export function computePpmConfidenceInterval(
  ppm: number,
  cameraConfidence: "none" | "low" | "medium" | "high" | "verified",
): { lower: number; upper: number; width: number } {
  const confidenceWidths: Record<string, number> = {
    none: 0.50,
    low: 0.35,
    medium: 0.20,
    high: 0.10,
    verified: 0.05,
  };
  const relativeWidth = confidenceWidths[cameraConfidence] ?? 0.50;
  const halfWidth = ppm * relativeWidth;
  return {
    lower: Math.max(0, ppm - halfWidth),
    upper: ppm + halfWidth,
    width: halfWidth * 2,
  };
}
