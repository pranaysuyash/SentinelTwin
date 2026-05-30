/**
 * Lens/FOV Tradeoff Simulator — interactive focal length, sensor, and resolution analysis.
 *
 * Computes how changing focal length affects horizontal/vertical FOV, PPM at a target
 * distance, and DORI quality levels. Uses standard camera sensor format sizes.
 */

import type { DoriQuality } from "@/schema/security-scene";
import { ppmToDoriQuality } from "@sentineltwin/core";

// ── Standard sensor widths (mm) ───────────────────────────────────────────────

export const SENSOR_FORMATS: Record<string, { widthMm: number; heightMm: number }> = {
  "1/4\"": { widthMm: 3.2, heightMm: 2.4 },
  "1/3\"": { widthMm: 4.8, heightMm: 3.6 },
  "1/2.7\"": { widthMm: 5.37, heightMm: 4.04 },
  "1/2\"": { widthMm: 6.4, heightMm: 4.8 },
  "1/1.8\"": { widthMm: 7.18, heightMm: 5.39 },
  "2/3\"": { widthMm: 8.8, heightMm: 6.6 },
  "1\"": { widthMm: 12.8, heightMm: 9.6 },
};

export type SensorFormat = keyof typeof SENSOR_FORMATS;

// ── Focal length presets ──────────────────────────────────────────────────────

export const FOCAL_LENGTH_PRESETS: number[] = [2.8, 4, 6, 8, 12, 16, 25, 50];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LensFovParams {
  focalLengthMm: number;
  sensorFormat: SensorFormat;
  resolutionMP: number;
  targetDistanceM: number;
}

export interface LensFovResult {
  fovHorizontalDeg: number;
  fovVerticalDeg: number;
  fovDiagonalDeg: number;
  ppm: number;
  quality: DoriQuality;
  detectionRangeM: number;
  observationRangeM: number;
  recognitionRangeM: number;
  identificationRangeM: number;
}

export interface TradeoffCurvePoint {
  focalLengthMm: number;
  fovHorizontalDeg: number;
  fovVerticalDeg: number;
  ppm: number;
  quality: DoriQuality;
  detectionRangeM: number;
  observationRangeM: number;
  recognitionRangeM: number;
  identificationRangeM: number;
}

// ── Computation ───────────────────────────────────────────────────────────────

/**
 * Compute the horizontal and vertical FOV from focal length and sensor dimensions.
 *
 * Formula: FOV = 2 * atan(sensorDimension / (2 * focalLength))
 */
function computeFov(sensorWidthMm: number, sensorHeightMm: number, focalLengthMm: number) {
  const fovHorizontalDeg = 2 * Math.atan2(sensorWidthMm, 2 * focalLengthMm) * (180 / Math.PI);
  const fovVerticalDeg = 2 * Math.atan2(sensorHeightMm, 2 * focalLengthMm) * (180 / Math.PI);
  const fovDiagonalDeg = 2 * Math.atan2(
    Math.hypot(sensorWidthMm, sensorHeightMm),
    2 * focalLengthMm,
  ) * (180 / Math.PI);
  return { fovHorizontalDeg, fovVerticalDeg, fovDiagonalDeg };
}

/**
 * Compute pixels per meter at a given distance.
 *
 * PPM = (resolutionWidthPx) / (2 * targetDistance * tan(fovHorizontalDeg / 2))
 */
function computePpm(
  resolutionMP: number,
  fovHorizontalDeg: number,
  targetDistanceM: number,
  aspectRatio: number = 16 / 9,
): number {
  const resolutionWidthPx = Math.sqrt(resolutionMP * 1_000_000 * aspectRatio);
  const sceneWidthAtTarget = 2 * Math.max(targetDistanceM, 0.01) * Math.tan(
    (fovHorizontalDeg * Math.PI) / 360,
  );
  return resolutionWidthPx / sceneWidthAtTarget;
}

/**
 * Compute the max distance at which a specific PPM threshold is met.
 */
function computeDistanceForPpm(
  resolutionMP: number,
  fovHorizontalDeg: number,
  targetPpm: number,
  maxRangeM: number = 200,
): number {
  const resolutionWidthPx = Math.sqrt(resolutionMP * 1_000_000 * (16 / 9));
  const distance = resolutionWidthPx / (2 * targetPpm * Math.tan((fovHorizontalDeg * Math.PI) / 360));
  return Math.min(distance, maxRangeM);
}

/**
 * Run the full lens/FOV tradeoff computation.
 */
export function computeLensFovTradeoff(params: LensFovParams): LensFovResult {
  const sensor = SENSOR_FORMATS[params.sensorFormat] ?? SENSOR_FORMATS["1/2.7\""];
  const focalLength = Math.max(1, params.focalLengthMm);

  const { fovHorizontalDeg, fovVerticalDeg, fovDiagonalDeg } = computeFov(
    sensor.widthMm,
    sensor.heightMm,
    focalLength,
  );

  const ppm = computePpm(params.resolutionMP, fovHorizontalDeg, params.targetDistanceM);
  const quality = ppmToDoriQuality(ppm, {
    detection: 25,
    observation: 62.5,
    recognition: 125,
    identification: 250,
  });

  const detectionRangeM = computeDistanceForPpm(params.resolutionMP, fovHorizontalDeg, 25);
  const observationRangeM = computeDistanceForPpm(params.resolutionMP, fovHorizontalDeg, 62.5);
  const recognitionRangeM = computeDistanceForPpm(params.resolutionMP, fovHorizontalDeg, 125);
  const identificationRangeM = computeDistanceForPpm(params.resolutionMP, fovHorizontalDeg, 250);

  return {
    fovHorizontalDeg,
    fovVerticalDeg,
    fovDiagonalDeg,
    ppm,
    quality,
    detectionRangeM,
    observationRangeM,
    recognitionRangeM,
    identificationRangeM,
  };
}

/**
 * Generate a full tradeoff curve across all focal length presets.
 */
export function generateTradeoffCurve(
  sensorFormat: SensorFormat,
  resolutionMP: number,
  targetDistanceM: number,
): TradeoffCurvePoint[] {
  return FOCAL_LENGTH_PRESETS.map((focalLengthMm) => {
    const result = computeLensFovTradeoff({
      focalLengthMm,
      sensorFormat,
      resolutionMP,
      targetDistanceM,
    });
    return {
      focalLengthMm,
      fovHorizontalDeg: result.fovHorizontalDeg,
      fovVerticalDeg: result.fovVerticalDeg,
      ppm: result.ppm,
      quality: result.quality,
      detectionRangeM: result.detectionRangeM,
      observationRangeM: result.observationRangeM,
      recognitionRangeM: result.recognitionRangeM,
      identificationRangeM: result.identificationRangeM,
    };
  });
}

/**
 * Derive optimal focal length for a given target distance and PPM requirement.
 * Scans the presets and returns the first that meets the threshold.
 */
export function findOptimalFocalLength(
  targetDistanceM: number,
  requiredPpm: number,
  sensorFormat: SensorFormat = "1/2.7\"",
  resolutionMP: number = 4,
): { focalLengthMm: number; result: LensFovResult } | null {
  for (const focalLengthMm of FOCAL_LENGTH_PRESETS) {
    const result = computeLensFovTradeoff({
      focalLengthMm,
      sensorFormat,
      resolutionMP,
      targetDistanceM,
    });
    if (result.ppm >= requiredPpm) {
      return { focalLengthMm, result };
    }
  }
  // Return the one with highest focal length (best PPM) as fallback
  const bestFocalLength = FOCAL_LENGTH_PRESETS[FOCAL_LENGTH_PRESETS.length - 1]!;
  const bestResult = computeLensFovTradeoff({
    focalLengthMm: bestFocalLength,
    sensorFormat,
    resolutionMP,
    targetDistanceM,
  });
  return { focalLengthMm: bestFocalLength, result: bestResult };
}
