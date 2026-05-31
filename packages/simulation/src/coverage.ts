/**
 * Coverage evaluator — deterministic geometry-based visibility and quality engine.
 *
 * Computes per-cell camera coverage using pixel density (PPM), occlusion raycasting,
 * DORI 2014 / OODPCVS 2025 quality models, lighting context, and environmental penalties.
 *
 * ── KNOWN GAPS ──────────────────────────────────────────────────
 * 1. Seasonal lighting (sun position, exterior lux, twilight) is
 *    modelled separately in ./seasonal-lighting.ts but NOT integrated
 *    into the coverage evaluator's getLightingContext(). Daylight
 *    calculations ignore sun position and window-transmitted ambient
 *    light. This means interior light levels are time-independent
 *    during day mode.
 *
 *    Path to close: wire computeSeasonalLightState() output into
 *    getLightingContext() so exterior light varies by time of day
 *    and geographic location. For now, timeOfDay="day" assumes
 *    full ambient light (lightLevel=1) everywhere.
 *
 * 2. Reflective bounce mirrors across the window's wall plane
 *    (or Z-axis fallback for unlinked windows). Windows with no
 *    wallId set cannot compute their wall normal, so the Z-axis
 *    mirror match is only correct when boxes are unrotated.
 * ────────────────────────────────────────────────────────────────
 */

import * as THREE from "three";

import type {
  CameraNode,
  CoverageCellResult,
  DoriQuality,
  SecurityLightNode,
  SecurityScene,
} from "@sentineltwin/core";
import {
  DORI_THRESHOLDS,
  getDetectionProbability,
  maxQuality,
  ppmToQuality,
  qualityToScore,
  type PpmThresholds,
} from "@sentineltwin/core";
import { getYawPitchDirection, normalizeAngle } from "@sentineltwin/core";
import { buildCoverageGrid, type GridCell } from "@sentineltwin/core";
import { computeBlindSpotPenalty, computeMountTiltPenalty } from "./mount-model";
import { computeOODPCVSQuality } from "./odpcvs";
import { getCalibration, getNightModeRetentionFactor, getEdgeFalloffFactor } from "./calibration";
import {
  buildVisionColliderMesh,
  disposeVisionColliderMesh,
  getVisionColliderSource,
  type VisionColliderMesh,
} from "./vision-collider-mesh";

export type CellComputation = CoverageCellResult & {
  probabilities: number[];
  cameraEvaluations: Record<string, CameraEvaluation>;
};

export type CameraEvaluation = {
  quality: DoriQuality;
  ppm: number;
  probability: number;
  visible: boolean;
  blockedBy?: string;
  inFov: boolean;
  withinRange: boolean;
  distanceM: number;
  hAngleDeg: number;
  vAngleDeg: number;
  edgePenaltyMultiplier: number;
  clarityMultiplier: number;
  materialTransmission: number;
  glarePenalty: number;
  lightingPenalty: number;
  lightLevel: number;
  illuminatedBy: string[];
  shadowedBy: string[];
  finalPpmMultiplier: number;
  reasonCodes: string[];
};

export type CoverageEvaluator = {
  evaluatePoint: (camera: CameraNode, point: [number, number], targetHeightM?: number) => CameraEvaluation;
  computeCoverageCells: (cellsPerMeter?: number, targetHeightM?: number) => CellComputation[];
  /** Async variant that yields to the event loop every `yieldEvery` cells.
   *  Keeps the browser responsive during large simulations. */
  computeCoverageCellsAsync: (
    cellsPerMeter?: number,
    targetHeightM?: number,
    yieldEvery?: number,
  ) => Promise<CellComputation[]>;
  /** Release Three.js GPU resources (geometry, material, BVH). Safe to call after all evaluations are done. */
  dispose: () => void;
};

function deriveResolutionWidth(camera: CameraNode) {
  if (camera.resolutionWidth) {
    return camera.resolutionWidth;
  }
  const megapixels = Math.max(camera.resolutionMP, 0.1) * 1_000_000;
  if (camera.resolutionHeight) {
    const width = megapixels / camera.resolutionHeight;
    return Math.max(1, width);
  }

  return Math.sqrt(megapixels * (16 / 9));
}

function computePixelDensity(camera: CameraNode, distanceM: number) {
  const widthPx = deriveResolutionWidth(camera);
  const sceneWidthAtDistance =
    2 * Math.max(distanceM, 0.01) * Math.tan((camera.fovHorizontalDeg * Math.PI) / 360);

  return widthPx / sceneWidthAtDistance;
}

/**
 * Light brightness → visibility contribution weights.
 *
 * These model the relative illuminance contribution of each brightness level
 * as a factor of the light's maximum output. Derived from typical commercial
 * security light lumen ranges (200–12,000 lm) normalized to [0, 1].
 *
 * | Brightness | Lumen range  | Weight |
 * |------------|-------------|--------|
 * | dim        | 200–500     | 0.25   |
 * | low        | 500–1,200   | 0.42   |
 * | medium     | 1,200–3,000 | 0.62   |
 * | high       | 3,000–6,000 | 0.82   |
 * | very_high  | 6,000–12,000| 1.0    |
 */
const LIGHT_BRIGHTNESS_WEIGHT: Record<SecurityLightNode["brightness"], number> = {
  dim: 0.25,
  low: 0.42,
  medium: 0.62,
  high: 0.82,
  very_high: 1,
};

function isPointInLightCone(light: SecurityLightNode, cell: GridCell) {
  if (!light.coneDeg || light.coneDeg >= 359 || light.yawDeg == null) {
    return true;
  }

  const [lx, , lz] = light.position;
  const targetYaw = THREE.MathUtils.radToDeg(Math.atan2(cell.x - lx, -(cell.z - lz)));
  const hAngle = normalizeAngle(targetYaw - light.yawDeg);
  return Math.abs(hAngle) <= light.coneDeg / 2;
}

function getLightOcclusion(
  light: SecurityLightNode,
  cell: GridCell,
  targetHeightM: number,
  raycaster: THREE.Raycaster,
  visionMesh: VisionColliderMesh,
) {
  const pseudoLightCamera: CameraNode = {
    id: light.id,
    nodeType: "camera",
    name: light.name,
    position: light.position,
    yawDeg: light.yawDeg ?? 0,
    pitchDeg: light.pitchDeg ?? -45,
    rollDeg: 0,
    mountType: "ceiling",
    mountHeightM: light.position[1],
    fovHorizontalDeg: light.coneDeg ?? 360,
    fovVerticalDeg: 180,
    rangeM: light.rangeM,
    resolutionMP: 1,
    resolutionWidth: 1000,
    resolutionHeight: 1000,
    lensType: "fixed",
    status: "on",
    nightMode: "none",
    irRangeM: 0,
    thermalCapable: false,
    ptz: false,
    clarity: "excellent",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "coverage-light-occlusion",
    geometryValidity: "valid",
    ndaaCompliant: true,
    privacyMaskingEnabled: false,
    tags: [],
  };

  const target = new THREE.Vector3(cell.x, targetHeightM, cell.z);
  return assessOcclusion(pseudoLightCamera, target, raycaster, visionMesh);
}

/**
 * Environment risk penalties for backlight, glare, and overexposure.
 *
 * These model the PPM degradation each condition causes in practice:
 * - Backlight reduces subject contrast (face/body in shadow against bright background).
 * - Environment glare from reflective surfaces washes out detail.
 * - Overexposed zones lose all detail in bright areas (blown highlights).
 *
 * Values are derived from camera sensor dynamic range modelling — a typical
 * 8-bit sensor (~48 dB DR) loses 15–25% of effective resolution under strong
 * backlight, and glare/highlight clipping adds 4–18% additional degradation.
 */
const BACKLIGHT_PENALTY: Record<string, number> = { none: 0, low: 0.06, medium: 0.14, high: 0.25 };
const GLARE_ENV_PENALTY: Record<string, number> = { none: 0, low: 0.04, medium: 0.1, high: 0.18 };
const OVEREXPOSED_PENALTY = 0.08;

function computeEnvironmentRiskPenalty(assumptions: {
  backlightIntensity?: "none" | "low" | "medium" | "high";
  glareIntensity?: "none" | "low" | "medium" | "high";
  overexposedZones?: boolean;
}): number {
  let penalty = 0;
  penalty += BACKLIGHT_PENALTY[assumptions.backlightIntensity ?? "none"] ?? 0;
  penalty += GLARE_ENV_PENALTY[assumptions.glareIntensity ?? "none"] ?? 0;
  if (assumptions.overexposedZones) {
    penalty += OVEREXPOSED_PENALTY;
  }
  return Math.min(1, penalty);
}

function getLightingContext(
  camera: CameraNode,
  cell: GridCell,
  scene: SecurityScene,
  targetHeightM: number,
  raycaster: THREE.Raycaster,
  visionMesh: VisionColliderMesh,
) {
  const illuminatedBy: string[] = [];
  const shadowedBy = new Set<string>();
  let lightLevel = scene.assumptions.timeOfDay === "day" ? 1 : 0;

  for (const light of scene.securityLights) {
    if (light.status !== "on" || !light.illuminatesNightCoverage) {
      continue;
    }

    const [lx, , lz] = light.position;
    const distance = Math.hypot(lx - cell.x, lz - cell.z);
    if (distance > light.rangeM || !isPointInLightCone(light, cell)) {
      continue;
    }

    const occlusion = getLightOcclusion(light, cell, targetHeightM, raycaster, visionMesh);
    if (occlusion.blocked) {
      if (occlusion.blockedBy) shadowedBy.add(occlusion.blockedBy);
      continue;
    }

    if (occlusion.blockedBy) shadowedBy.add(occlusion.blockedBy);
    const falloff = Math.max(0, 1 - distance / Math.max(light.rangeM, 0.01));
    const beam = Math.sqrt(falloff);
    const transmission = Math.max(0, Math.min(1, occlusion.materialPenalty));
    const contribution = LIGHT_BRIGHTNESS_WEIGHT[light.brightness] * beam * transmission;

    if (contribution > 0.04) {
      lightLevel = Math.max(lightLevel, contribution);
      illuminatedBy.push(light.id);
    }
  }

  const envPenalty = computeEnvironmentRiskPenalty(scene.assumptions);

  if (scene.assumptions.timeOfDay === "day") {
    return { penalty: envPenalty, lightLevel, illuminatedBy, shadowedBy: [...shadowedBy] };
  }

  /**
   * Night penalty models effective PPM degradation in low-light conditions.
   *
   * Light level thresholds approximate the minimum illuminance (lux) for
   * each band in a typical security scene:
   *   0.65+ → ~10 lux (well-lit by security lights)
   *   0.35+ → ~3 lux (dim corridor with distant lights)
   *   0.12+ → ~1 lux (starlight + minimal spill)
   *   below → <0.5 lux (near-dark)
   *
   * Camera night mode capabilities determine fallback when light is
   * insufficient. Penalty = 1 - retentionFactor from calibration:
   *   thermal    — 8–14 µm LWIR unaffected by visible light     → 0.08
   *   low_light  — amplified CMOS with noise reduction          → 0.18
   *   ir + range — active IR within rated distance              → 0.32
   *   ir (far)   — IR present but out of range                  → 0.78
   *   none       — no night capability                           → 0.88
   *
   * Calibration constants override these defaults via scene.calibrationConstants.
   */
  let nightPenalty = 0;
  const calibration = getCalibration(scene);

  if (lightLevel >= 0.65) nightPenalty = 0.1;
  else if (lightLevel >= 0.35) nightPenalty = 0.24;
  else if (lightLevel >= 0.12) nightPenalty = 0.42;
  else {
    const retention = getNightModeRetentionFactor(camera, calibration);
    nightPenalty = 1 - retention;

    if (camera.nightMode === "ir") {
      const [cx, , cz] = camera.position;
      const distance = Math.hypot(cx - cell.x, cz - cell.z);
      if (distance > camera.irRangeM) {
        const irRetention = retention * 0.35;
        nightPenalty = 1 - irRetention;
      }
    }
  }

  return {
    penalty: Math.min(1, nightPenalty + envPenalty),
    lightLevel,
    illuminatedBy,
    shadowedBy: [...shadowedBy],
  };
}

function getClarityMultiplier(camera: CameraNode) {
  return {
    poor: 0.4,
    average: 0.68,
    good: 0.9,
    excellent: 1,
  }[camera.clarity];
}

function getYawPitchTowardTarget(origin: [number, number, number], target: THREE.Vector3) {
  const direction = target.clone().sub(new THREE.Vector3(...origin)).normalize();
  return {
    yawDeg: THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z)),
    pitchDeg: THREE.MathUtils.radToDeg(
      Math.atan2(direction.y, Math.hypot(direction.x, direction.z)),
    ),
  };
}

function getReasonCodesForLighting(camera: CameraNode, lightingPenalty: number) {
  const reasonCodes: string[] = [];

  if (lightingPenalty <= 0) return reasonCodes;

  if (camera.nightMode === "thermal") {
    reasonCodes.push("THERMAL_MODE");
  } else if (camera.nightMode === "ir" && lightingPenalty <= 0.32) {
    reasonCodes.push("IR_RANGE");
  } else {
    reasonCodes.push("LOW_LIGHT");
  }

  return reasonCodes;
}

/**
 * Return quality thresholds appropriate for the active standard.
 *
 * In DORI 2014 mode: returns the scene's user-configurable pixelsPerMeter.
 * In OODPCVS 2025 mode: returns the canonical OODPCVS thresholds normalized
 * to the PpmThresholds shape for consumers that need DORI-format thresholds
 * (getRecognitionAreaPct, getIdentificationAreaPct, etc.).
 */
export function getQualityThresholds(scene: SecurityScene): PpmThresholds {
  if (scene.assumptions.doriStandard === "oodpcvs_2025") {
    return {
      detection: 12,
      observation: 32,
      recognition: 96,
      identification: 192,
      // match the OODPCVS canonical thresholds for completeness
    };
  }
  return scene.assumptions.pixelsPerMeter;
}

/**
 * Build a partial CameraEvaluation for early-return paths (camera off,
 * out of range, out of FOV, blocked by solid).
 *
 * Accepts overrides so callers supply only the fields that differ from
 * the "no coverage" baseline.
 */
function makeEmptyEvaluation(overrides: Partial<CameraEvaluation> & { reasonCodes: string[] }): CameraEvaluation {
  return {
    quality: "none" as DoriQuality,
    ppm: 0,
    probability: 0,
    visible: false,
    blockedBy: undefined as string | undefined,
    inFov: false,
    withinRange: false,
    distanceM: Number.MAX_VALUE,
    hAngleDeg: 0,
    vAngleDeg: 0,
    edgePenaltyMultiplier: 0,
    clarityMultiplier: 1,
    materialTransmission: 1,
    glarePenalty: 0,
    lightingPenalty: 0,
    lightLevel: 0,
    illuminatedBy: [],
    shadowedBy: [],
    finalPpmMultiplier: 0,
    ...overrides,
  };
}

function assessOcclusion(
  camera: CameraNode,
  target: THREE.Vector3,
  raycaster: THREE.Raycaster,
  visionMesh: VisionColliderMesh,
  ignoredSourceIds: Set<string> = new Set<string>(),
) {
  const origin = new THREE.Vector3(...camera.position);
  const direction = target.clone().sub(origin).normalize();
  const distance = origin.distanceTo(target);

  raycaster.firstHitOnly = ignoredSourceIds.size === 0;
  raycaster.set(origin, direction);

  const hits = raycaster.intersectObject(visionMesh.mesh, false);

  for (const hit of hits) {
    if (hit.distance >= distance - 0.05) {
      break;
    }

    const source = getVisionColliderSource(visionMesh.mesh, hit.faceIndex ?? undefined);

    if (!source || ignoredSourceIds.has(source.id)) {
      continue;
    }

    if (source.visionTransmission > 0.05) {
      return {
        blocked: false,
        materialPenalty: source.visionTransmission,
        glarePenalty: source.glarePenalty ? 0.86 : 0,
        blockedBy: source.label,
      };
    }

    return {
      blocked: true,
      materialPenalty: 0,
      glarePenalty: 0,
      blockedBy: source.label,
    };
  }

  return {
    blocked: false,
    materialPenalty: 1,
    blockedBy: undefined,
    glarePenalty: 0,
  };
}

function evaluateCameraAgainstCell(
  scene: SecurityScene,
  camera: CameraNode,
  cell: GridCell,
  targetHeightM: number,
  raycaster: THREE.Raycaster,
  visionMesh: VisionColliderMesh,
  ignoredSourceIds: Set<string> = new Set<string>(),
): CameraEvaluation {
  if (camera.status !== "on") {
    return makeEmptyEvaluation({
      withinRange: true,
      lightLevel: scene.assumptions.timeOfDay === "day" ? 1 : 0,
      reasonCodes: ["CAMERA_OFF"],
    });
  }

  const origin = new THREE.Vector3(...camera.position);
  const target = new THREE.Vector3(cell.x, targetHeightM, cell.z);
  const distance = origin.distanceTo(target);
  if (distance > camera.rangeM) {
    return makeEmptyEvaluation({
      withinRange: false,
      distanceM: distance,
      lightLevel: scene.assumptions.timeOfDay === "day" ? 1 : 0,
      reasonCodes: ["OUT_OF_RANGE"],
    });
  }

  const direction = target.clone().sub(origin).normalize();
  const targetYaw = THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z));
  const targetPitch = THREE.MathUtils.radToDeg(
    Math.atan2(direction.y, Math.hypot(direction.x, direction.z)),
  );
  const hAngle = normalizeAngle(targetYaw - camera.yawDeg);
  const vAngle = targetPitch - camera.pitchDeg;

  if (
    Math.abs(hAngle) > camera.fovHorizontalDeg / 2 ||
    Math.abs(vAngle) > camera.fovVerticalDeg / 2
    ) {
    return makeEmptyEvaluation({
      withinRange: true,
      distanceM: distance,
      hAngleDeg: hAngle,
      vAngleDeg: vAngle,
      lightLevel: scene.assumptions.timeOfDay === "day" ? 1 : 0,
      reasonCodes: ["OUT_OF_FOV"],
    });
  }

  const occlusion = assessOcclusion(camera, target, raycaster, visionMesh, ignoredSourceIds);

  if (occlusion.blocked) {
    return makeEmptyEvaluation({
      blockedBy: occlusion.blockedBy,
      inFov: true,
      withinRange: true,
      distanceM: distance,
      hAngleDeg: hAngle,
      vAngleDeg: vAngle,
      materialTransmission: 0,
      lightLevel: scene.assumptions.timeOfDay === "day" ? 1 : 0,
      reasonCodes: ["BLOCKED_BY_SOLID"],
    });
  }

  const basePpm = computePixelDensity(camera, distance);
  let ppm = basePpm;
  const edgeAngle = Math.max(Math.abs(hAngle), Math.abs(vAngle));
  const reasonCodes = new Set<string>();
  let edgePenaltyMultiplier = 1;

  /**
   * Edge-of-FOV penalty — models optical resolution falloff toward the
   * periphery of a typical varifocal security lens.
   *
   * Angle is the max of |hAngle| and |vAngle| away from the optical axis:
   *   > 55° → severe falloff (extreme periphery, ~42% effective PPM)
   *   > 42° → significant falloff (~58%)
   *   > 28° → moderate falloff (~76%)
   *   ≤ 28° → negligible (within the central ~56° region)
   *
   * Calibration edge falloff factor (by lens type) is combined as
   * an additional multiplier to account for lens-specific optical quality.
   */
  const calibration = getCalibration(scene);
  const calibrationEdgeFactor = getEdgeFalloffFactor(camera, calibration);

  if (edgeAngle > 55) {
    edgePenaltyMultiplier = 0.42 * calibrationEdgeFactor;
    reasonCodes.add("EDGE_OF_FOV");
  } else if (edgeAngle > 42) {
    edgePenaltyMultiplier = 0.58 * calibrationEdgeFactor;
    reasonCodes.add("EDGE_OF_FOV");
  } else if (edgeAngle > 28) {
    edgePenaltyMultiplier = 0.76 * calibrationEdgeFactor;
    reasonCodes.add("EDGE_OF_FOV");
  } else {
    edgePenaltyMultiplier = calibrationEdgeFactor;
  }
  ppm *= edgePenaltyMultiplier;

  const clarityMultiplier = getClarityMultiplier(camera);
  if (clarityMultiplier < 1) {
    reasonCodes.add("DIRTY_CAMERA");
  }
  ppm *= clarityMultiplier;

  const mountTiltPenalty = computeMountTiltPenalty(camera);
  if (mountTiltPenalty > 0) {
    reasonCodes.add("MOUNT_TILT_EXCEEDED");
  }
  ppm *= 1 - mountTiltPenalty;

  const blindSpotPenalty = computeBlindSpotPenalty(camera, distance);
  if (blindSpotPenalty > 0) {
    reasonCodes.add("BLIND_SPOT_UNDER_CAMERA");
  }
  ppm *= 1 - blindSpotPenalty;

  const materialTransmission = occlusion.materialPenalty;
  ppm *= materialTransmission;
  if (materialTransmission < 1) {
    reasonCodes.add("PARTIAL_MATERIAL");
  }

  const glarePenalty = occlusion.glarePenalty;
  if (glarePenalty > 0) {
    reasonCodes.add("GLARE_RISK");
  }

  ppm *= 1 - glarePenalty;

  const lightingContext = getLightingContext(camera, cell, scene, targetHeightM, raycaster, visionMesh);
  const lightingPenalty = lightingContext.penalty;
  if (lightingPenalty > 0) {
    getReasonCodesForLighting(camera, lightingPenalty).forEach((code) => reasonCodes.add(code));
  }

  const envRisks = scene.assumptions;
  if (envRisks.backlightIntensity && envRisks.backlightIntensity !== "none") {
    reasonCodes.add(`BACKLIGHT_${envRisks.backlightIntensity.toUpperCase()}`);
  }
  if (envRisks.glareIntensity && envRisks.glareIntensity !== "none") {
    reasonCodes.add(`GLARE_ENV_${envRisks.glareIntensity.toUpperCase()}`);
  }
  if (envRisks.overexposedZones) {
    reasonCodes.add("OVEREXPOSED_ZONE");
  }

  if (lightingContext.illuminatedBy.length > 0) {
    reasonCodes.add("ILLUMINATED_BY_LIGHT");
  }

  if (lightingContext.shadowedBy.length > 0) {
    reasonCodes.add("LIGHT_SHADOWED_BY_OBSTRUCTION");
  }

  ppm *= 1 - lightingPenalty;
  const finalPpmMultiplier = basePpm > 0 ? ppm / basePpm : 0;

  const isOodpcvs = scene.assumptions.doriStandard === "oodpcvs_2025";
  const quality: DoriQuality = isOodpcvs
    ? computeOODPCVSQuality(
        ppm,
        scene.assumptions.sceneComplexity,
        scene.assumptions.operatorExperience,
        scene.assumptions.taskCriticality,
      )
    : ppmToQuality(ppm, scene.assumptions.pixelsPerMeter);

  if (isOodpcvs) {
    reasonCodes.add("OODPCVS_MODE");
  }

  if (quality === "none") {
    reasonCodes.add("LOW_PPM");
  }

  return {
    quality,
    ppm,
    probability: getDetectionProbability(quality),
    visible: true,
    blockedBy: occlusion.blockedBy,
    inFov: true,
    withinRange: true,
    distanceM: distance,
    hAngleDeg: hAngle,
    vAngleDeg: vAngle,
    edgePenaltyMultiplier,
    clarityMultiplier,
    materialTransmission,
    glarePenalty,
    lightingPenalty,
    lightLevel: lightingContext.lightLevel,
    illuminatedBy: lightingContext.illuminatedBy,
    shadowedBy: lightingContext.shadowedBy,
    finalPpmMultiplier,
    reasonCodes: [...reasonCodes],
  };
}

export function createCoverageEvaluator(scene: SecurityScene): CoverageEvaluator {
  const visionMesh = buildVisionColliderMesh(scene);
  const raycaster = new THREE.Raycaster();

  const evaluatePoint = (
    camera: CameraNode,
    point: [number, number],
    targetHeightM = scene.assumptions.personHeightM,
  ): CameraEvaluation => {
    const cellLike: GridCell = {
      id: "point",
      x: point[0],
      z: point[1],
      walkable: true,
      coverageIncluded: true,
      privacyRestricted: false,
    };

    return evaluateCameraAgainstCell(
      scene,
      camera,
      cellLike,
      targetHeightM,
      raycaster,
      visionMesh,
    );
  };

  /**
   * Compute the mirror position of a camera across a window's wall plane.
   *
   * When the window has a wallId, the wall's 2D normal is used for the reflection.
   * Otherwise defaults to mirroring across the Z axis (aligned with unrotated window boxes).
   */
  function mirrorCameraAcrossWindow(
    cameraPos: [number, number, number],
    window: (typeof scene.windows)[number],
  ): [number, number, number] {
    if (window.wallId) {
      const wall = scene.walls.find((w) => w.id === window.wallId);
      if (wall) {
        const [sx, sz] = wall.start;
        const [ex, ez] = wall.end;
        const dx = ex - sx;
        const dz = ez - sz;
        const len = Math.hypot(dx, dz);
        if (len > 0.001) {
          // Wall normal (perpendicular to wall direction, pointing toward +Z side)
          const nx = dz / len;
          const nz = -dx / len;
          // Use window position as the plane anchor
          const [wx, , wz] = window.position;
          const dot = (cameraPos[0] - wx) * nx + (cameraPos[2] - wz) * nz;
          return [
            cameraPos[0] - 2 * dot * nx,
            cameraPos[1],
            cameraPos[2] - 2 * dot * nz,
          ];
        }
      }
    }
    // Fallback: mirror across Z axis (matching unrotated BoxGeometry windows)
    return [
      cameraPos[0],
      cameraPos[1],
      (2 * window.position[2]) - cameraPos[2],
    ];
  }

  const evaluateReflectiveBounce = (
    camera: CameraNode,
    cell: GridCell,
    targetHeightM: number,
    directEvaluation: CameraEvaluation,
  ) => {
    let bestCandidate: { evaluation: CameraEvaluation; windowLabel: string } | null = null;
    const target = new THREE.Vector3(cell.x, targetHeightM, cell.z);
    const cameraPos: [number, number, number] = [camera.position[0], camera.position[1], camera.position[2]];

    for (const window of scene.windows) {
      if (window.state !== "reflective") continue;

      const cameraSide = cameraPos[2] - window.position[2];
      const targetSide = target.z - window.position[2];
      if (Math.abs(cameraSide) < 0.001 || Math.abs(targetSide) < 0.001 || Math.sign(cameraSide) === Math.sign(targetSide)) {
        continue;
      }

      const mirroredPos = mirrorCameraAcrossWindow(cameraPos, window);

      const windowVisibility = evaluatePoint(camera, [window.position[0], window.position[2]], window.position[1]);
      if (!windowVisibility.visible) {
        continue;
      }

      const virtualCamera: CameraNode = {
        ...camera,
        position: mirroredPos,
      };
      const { yawDeg, pitchDeg } = getYawPitchTowardTarget(virtualCamera.position, target);
      virtualCamera.yawDeg = yawDeg;
      virtualCamera.pitchDeg = pitchDeg;

      const bounced = evaluateCameraAgainstCell(
        scene,
        virtualCamera,
        cell,
        targetHeightM,
        raycaster,
        visionMesh,
        new Set([window.id]),
      );

      if (bounced.quality === "none") {
        continue;
      }

      const bounceMultiplier = Math.max(0.7, Math.min(0.95, 0.75 + (window.visionTransmission * 0.15)));
      const reflectiveBoost = windowVisibility.ppm * Math.max(0.35, Math.min(0.6, 0.35 + (window.visionTransmission * 0.25)));
      const bouncedPpm = Math.max(
        bounced.ppm * bounceMultiplier,
        directEvaluation.ppm + reflectiveBoost,
      );
      const isOodpcvs = scene.assumptions.doriStandard === "oodpcvs_2025";
      const bouncedQuality: DoriQuality = isOodpcvs
        ? computeOODPCVSQuality(
            bouncedPpm,
            scene.assumptions.sceneComplexity,
            scene.assumptions.operatorExperience,
            scene.assumptions.taskCriticality,
          )
        : ppmToQuality(bouncedPpm, scene.assumptions.pixelsPerMeter);

      const candidate: CameraEvaluation = {
        ...bounced,
        quality: bouncedQuality,
        ppm: bouncedPpm,
        probability: getDetectionProbability(bouncedQuality),
        visible: bouncedQuality !== "none",
        reasonCodes: Array.from(new Set([
          ...bounced.reasonCodes,
          "REFLECTIVE_BOUNCE",
          `REFLECTIVE_WINDOW:${window.label}`,
        ])),
      };

      if (qualityToScore(candidate.quality) <= qualityToScore(directEvaluation.quality)) {
        continue;
      }

      if (!bestCandidate || qualityToScore(candidate.quality) > qualityToScore(bestCandidate.evaluation.quality)) {
        bestCandidate = {
          evaluation: candidate,
          windowLabel: window.label,
        };
      }
    }

    return bestCandidate;
  };

  const evaluateCell = (cell: GridCell, targetHeightM: number): CellComputation | null => {
    if (!cell.walkable) return null;

    let bestQuality: DoriQuality = "none";
    let bestPpm = 0;
    const coveringCameras: string[] = [];
    const blockedBy = new Set<string>();
    const probabilities: number[] = [];
    const cameraEvaluations: Record<string, CameraEvaluation> = {};

    for (const camera of scene.cameras) {
      const directEvaluation = evaluatePoint(camera, [cell.x, cell.z], targetHeightM);
      const bounceEvaluation = evaluateReflectiveBounce(camera, cell, targetHeightM, directEvaluation);
      const evaluation = bounceEvaluation ? bounceEvaluation.evaluation : directEvaluation;
      cameraEvaluations[camera.id] = evaluation;

      if (evaluation.blockedBy) {
        blockedBy.add(evaluation.blockedBy);
      }

      if (evaluation.quality !== "none") {
        coveringCameras.push(camera.id);
        probabilities.push(evaluation.probability);
      }

      bestQuality = maxQuality(bestQuality, evaluation.quality);
      bestPpm = Math.max(bestPpm, evaluation.ppm);
    }

    return {
      x: cell.x,
      z: cell.z,
      quality: bestQuality,
      coverageIncluded: cell.coverageIncluded,
      privacyRestricted: cell.privacyRestricted,
      coveringCameras,
      blockedBy: [...blockedBy],
      ppm: bestPpm,
      probabilities,
      cameraEvaluations,
    };
  };

  const computeCoverageCells = (cellsPerMeter = 4, targetHeightM = scene.assumptions.personHeightM) => {
    const { cells } = buildCoverageGrid(scene, cellsPerMeter);
    const results: CellComputation[] = [];

    for (const cell of cells) {
      const result = evaluateCell(cell, targetHeightM);
      if (result) results.push(result);
    }

    return results;
  };

  const computeCoverageCellsAsync = async (
    cellsPerMeter = 4,
    targetHeightM = scene.assumptions.personHeightM,
    yieldEvery = 50,
  ) => {
    const { cells } = buildCoverageGrid(scene, cellsPerMeter);
    const results: CellComputation[] = [];
    let evaluatedSinceYield = 0;

    for (const cell of cells) {
      const result = evaluateCell(cell, targetHeightM);
      if (result) {
        results.push(result);
        evaluatedSinceYield++;
      }

      if (evaluatedSinceYield >= yieldEvery) {
        evaluatedSinceYield = 0;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    return results;
  };

  return {
    evaluatePoint,
    computeCoverageCells,
    computeCoverageCellsAsync,
    dispose: () => disposeVisionColliderMesh(visionMesh),
  };
}

export function computeCoverageCells(scene: SecurityScene, cellsPerMeter = 4) {
  const evaluator = createCoverageEvaluator(scene);
  try {
    return evaluator.computeCoverageCells(cellsPerMeter);
  } finally {
    evaluator.dispose();
  }
}

export function getForwardVector(camera: CameraNode) {
  return getYawPitchDirection(camera.yawDeg, camera.pitchDeg);
}

export function getQualityShare(cells: CellComputation[], quality: DoriQuality, includeOnlyCoverageIncluded = false) {
  const cellsToCount = includeOnlyCoverageIncluded ? cells.filter((cell) => cell.coverageIncluded) : cells;

  if (cellsToCount.length === 0) return 0;
  return (cellsToCount.filter((cell) => cell.quality === quality).length / cellsToCount.length) * 100;
}

export function getRecognitionAreaPct(
  cells: CellComputation[],
  thresholds: { detection: number; observation: number; recognition: number; identification: number } = DORI_THRESHOLDS,
  includeOnlyCoverageIncluded = false,
) {
  const cellsToCount = includeOnlyCoverageIncluded ? cells.filter((cell) => cell.coverageIncluded) : cells;

  if (cellsToCount.length === 0) return 0;
  return (
    (cellsToCount.filter((cell) => {
      const score = cell.ppm;
      return score >= thresholds.recognition;
    }).length /
      cellsToCount.length) *
    100
  );
}

export function getIdentificationAreaPct(
  cells: CellComputation[],
  thresholds: { detection: number; observation: number; recognition: number; identification: number } = DORI_THRESHOLDS,
  includeOnlyCoverageIncluded = false,
) {
  const cellsToCount = includeOnlyCoverageIncluded ? cells.filter((cell) => cell.coverageIncluded) : cells;

  if (cellsToCount.length === 0) return 0;
  return (
    (cellsToCount.filter((cell) => cell.ppm >= thresholds.identification).length /
      cellsToCount.length) *
    100
  );
}
