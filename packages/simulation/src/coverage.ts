import * as THREE from "three";

import type {
  CameraNode,
  CoverageCellResult,
  DoriQuality,
  SecurityLightNode,
  SecurityScene,
} from "@sentineltwin/core";
import { DORI_THRESHOLDS, maxQuality, ppmToOodpcvsQuality, ppmToQuality, qualityToScore } from "@sentineltwin/core";
import { getYawPitchDirection, normalizeAngle } from "@sentineltwin/core";
import { buildCoverageGrid, type GridCell } from "@sentineltwin/core";
import { computeBlindSpotPenalty, computeMountTiltPenalty } from "./mount-model";
import {
  buildVisionColliderMesh,
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
};

function deriveResolutionWidth(camera: CameraNode) {
  if (camera.resolutionWidth) {
    return camera.resolutionWidth;
  }

  return Math.sqrt(camera.resolutionMP * 1_000_000 * (16 / 9));
}

function computePixelDensity(camera: CameraNode, distanceM: number) {
  const widthPx = deriveResolutionWidth(camera);
  const sceneWidthAtDistance =
    2 * Math.max(distanceM, 0.01) * Math.tan((camera.fovHorizontalDeg * Math.PI) / 360);

  return widthPx / sceneWidthAtDistance;
}

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

function computeEnvironmentRiskPenalty(assumptions: {
  backlightIntensity?: "none" | "low" | "medium" | "high";
  glareIntensity?: "none" | "low" | "medium" | "high";
  overexposedZones?: boolean;
}): number {
  let penalty = 0;
  const backlightTable: Record<string, number> = { none: 0, low: 0.06, medium: 0.14, high: 0.25 };
  penalty += backlightTable[assumptions.backlightIntensity ?? "none"] ?? 0;
  const glareTable: Record<string, number> = { none: 0, low: 0.04, medium: 0.1, high: 0.18 };
  penalty += glareTable[assumptions.glareIntensity ?? "none"] ?? 0;
  if (assumptions.overexposedZones) {
    penalty += 0.08;
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

  let nightPenalty = 0;
  if (lightLevel >= 0.65) nightPenalty = 0.1;
  else if (lightLevel >= 0.35) nightPenalty = 0.24;
  else if (lightLevel >= 0.12) nightPenalty = 0.42;
  else if (camera.nightMode === "thermal") nightPenalty = 0.08;
  else if (camera.nightMode === "low_light") nightPenalty = 0.18;
  else {
    const [cx, , cz] = camera.position;
    const distance = Math.hypot(cx - cell.x, cz - cell.z);
    if (camera.nightMode === "ir" && distance <= camera.irRangeM) {
      nightPenalty = 0.32;
    } else {
      nightPenalty = camera.nightMode === "none" ? 0.88 : 0.78;
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

function getDetectionProbability(quality: DoriQuality): number {
  const table: Record<DoriQuality, number> = {
    none: 0,
    detection: 0.25,
    overview: 0.25,
    outline: 0.35,
    observation: 0.5,
    discern: 0.5,
    perceive: 0.65,
    recognition: 0.85,
    characterize: 0.85,
    validate: 0.92,
    identification: 0.99,
    scrutinize: 0.99,
  };
  return table[quality];
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

export function getQualityThresholds(scene: SecurityScene) {
  if (scene.assumptions.doriStandard === "oodpcvs_2025") {
    return scene.assumptions.pixelsPerMeter;
  }
  return scene.assumptions.pixelsPerMeter;
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
    return {
      quality: "none" as DoriQuality,
      ppm: 0,
      probability: 0,
      visible: false,
      blockedBy: undefined as string | undefined,
      inFov: false,
      withinRange: true,
      distanceM: Number.MAX_VALUE,
      hAngleDeg: 0,
      vAngleDeg: 0,
      edgePenaltyMultiplier: 0,
      clarityMultiplier: 1,
      materialTransmission: 1,
      glarePenalty: 0,
      lightingPenalty: 0,
      lightLevel: scene.assumptions.timeOfDay === "day" ? 1 : 0,
      illuminatedBy: [],
      shadowedBy: [],
      finalPpmMultiplier: 0,
      reasonCodes: ["CAMERA_OFF"],
    };
  }

  const origin = new THREE.Vector3(...camera.position);
  const target = new THREE.Vector3(cell.x, targetHeightM, cell.z);
  const distance = origin.distanceTo(target);
  if (distance > camera.rangeM) {
    return {
      quality: "none" as DoriQuality,
      ppm: 0,
      probability: 0,
      visible: false,
      blockedBy: undefined as string | undefined,
      inFov: false,
      withinRange: false,
      distanceM: distance,
      hAngleDeg: 0,
      vAngleDeg: 0,
      edgePenaltyMultiplier: 0,
      clarityMultiplier: 1,
      materialTransmission: 1,
      glarePenalty: 0,
      lightingPenalty: 0,
      lightLevel: scene.assumptions.timeOfDay === "day" ? 1 : 0,
      illuminatedBy: [],
      shadowedBy: [],
      finalPpmMultiplier: 0,
      reasonCodes: ["OUT_OF_RANGE"],
    };
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
    return {
      quality: "none" as DoriQuality,
      ppm: 0,
      probability: 0,
      visible: false,
      blockedBy: undefined as string | undefined,
      inFov: false,
      withinRange: true,
      distanceM: distance,
      hAngleDeg: hAngle,
      vAngleDeg: vAngle,
      edgePenaltyMultiplier: 0,
      clarityMultiplier: 1,
      materialTransmission: 1,
      glarePenalty: 0,
      lightingPenalty: 0,
      lightLevel: scene.assumptions.timeOfDay === "day" ? 1 : 0,
      illuminatedBy: [],
      shadowedBy: [],
      finalPpmMultiplier: 0,
      reasonCodes: ["OUT_OF_FOV"],
    };
  }

  const occlusion = assessOcclusion(camera, target, raycaster, visionMesh, ignoredSourceIds);

  if (occlusion.blocked) {
    return {
      quality: "none" as DoriQuality,
      ppm: 0,
      probability: 0,
      visible: false,
      blockedBy: occlusion.blockedBy,
      inFov: true,
      withinRange: true,
      distanceM: distance,
      hAngleDeg: hAngle,
      vAngleDeg: vAngle,
      edgePenaltyMultiplier: 0,
      clarityMultiplier: 1,
      materialTransmission: 0,
      glarePenalty: 0,
      lightingPenalty: 0,
      lightLevel: scene.assumptions.timeOfDay === "day" ? 1 : 0,
      illuminatedBy: [],
      shadowedBy: [],
      finalPpmMultiplier: 0,
      reasonCodes: ["BLOCKED_BY_SOLID"],
    };
  }

  const basePpm = computePixelDensity(camera, distance);
  let ppm = basePpm;
  const edgeAngle = Math.max(Math.abs(hAngle), Math.abs(vAngle));
  const reasonCodes = new Set<string>();
  let edgePenaltyMultiplier = 1;

  if (edgeAngle > 55) {
    edgePenaltyMultiplier = 0.42;
    reasonCodes.add("EDGE_OF_FOV");
  } else if (edgeAngle > 42) {
    edgePenaltyMultiplier = 0.58;
    reasonCodes.add("EDGE_OF_FOV");
  } else if (edgeAngle > 28) {
    edgePenaltyMultiplier = 0.76;
    reasonCodes.add("EDGE_OF_FOV");
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
  const quality = isOodpcvs
    ? ppmToOodpcvsQuality(ppm)
    : ppmToQuality(ppm, scene.assumptions.pixelsPerMeter);

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

  const evaluateReflectiveBounce = (
    camera: CameraNode,
    cell: GridCell,
    targetHeightM: number,
    directEvaluation: CameraEvaluation,
  ) => {
    let bestCandidate: { evaluation: CameraEvaluation; windowLabel: string } | null = null;
    const target = new THREE.Vector3(cell.x, targetHeightM, cell.z);

    for (const window of scene.windows) {
      if (window.state !== "reflective") continue;

      const cameraSide = camera.position[2] - window.position[2];
      const targetSide = target.z - window.position[2];
      if (cameraSide === 0 || targetSide === 0 || Math.sign(cameraSide) === Math.sign(targetSide)) {
        continue;
      }

      const windowVisibility = evaluatePoint(camera, [window.position[0], window.position[2]], window.position[1]);
      if (!windowVisibility.visible) {
        continue;
      }

      const virtualCamera: CameraNode = {
        ...structuredClone(camera),
        position: [
          camera.position[0],
          camera.position[1],
          (2 * window.position[2]) - camera.position[2],
        ],
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
      const bouncedQuality = isOodpcvs
        ? ppmToOodpcvsQuality(bouncedPpm)
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

  const computeCoverageCells = (cellsPerMeter = 4, targetHeightM = scene.assumptions.personHeightM) => {
    const { cells } = buildCoverageGrid(scene, cellsPerMeter);
    const results: CellComputation[] = [];

    for (const cell of cells) {
      if (!cell.walkable) continue;

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

      results.push({
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
      });
    }

    return results;
  };

  return { evaluatePoint, computeCoverageCells };
}

export function computeCoverageCells(scene: SecurityScene, cellsPerMeter = 4) {
  return createCoverageEvaluator(scene).computeCoverageCells(cellsPerMeter);
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
