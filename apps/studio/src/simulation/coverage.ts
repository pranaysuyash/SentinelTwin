import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type {
  CameraNode,
  CoverageCellResult,
  DoriQuality,
  ObstructionNode,
  SecurityLightNode,
  SecurityScene,
  WallNode,
} from "@/schema/security-scene";
import { DORI_THRESHOLDS, maxQuality, ppmToQuality } from "@/simulation/dori";
import { getYawPitchDirection, normalizeAngle } from "@/simulation/geometry";
import { buildCoverageGrid, type GridCell } from "@/simulation/grid";

// three-mesh-bvh provides its own type augmentations for BufferGeometry and Mesh.
// The declarations below only add what the package doesn't declare itself.
declare module "three" {
  interface Raycaster {
    firstHitOnly?: boolean;
  }
}

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

type VisionSource = {
  id: string;
  material: string;
  visionTransmission: number;
  label: string;
};

type VisionMesh = {
  mesh: THREE.Mesh;
  sources: VisionSource[];
};

export type CellComputation = CoverageCellResult & {
  probabilities: number[];
};

export type CameraEvaluation = {
  quality: DoriQuality;
  ppm: number;
  probability: number;
  blockedBy?: string;
};

export type CoverageEvaluator = {
  evaluatePoint: (camera: CameraNode, point: [number, number], targetHeightM?: number) => CameraEvaluation;
  computeCoverageCells: (cellsPerMeter?: number) => CellComputation[];
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

function getLightingPenalty(
  camera: CameraNode,
  cell: GridCell,
  lights: SecurityLightNode[],
  scene: SecurityScene,
) {
  if (scene.assumptions.timeOfDay === "day") {
    return 0;
  }

  const illuminated = lights.some((light) => {
    if (light.status !== "on" || !light.illuminatesNightCoverage) {
      return false;
    }

    const [lx, , lz] = light.position;
    return Math.hypot(lx - cell.x, lz - cell.z) <= light.rangeM;
  });

  if (illuminated) return 0.12;
  if (camera.nightMode === "thermal") return 0.08;
  if (camera.nightMode === "low_light") return 0.18;

  const [cx, , cz] = camera.position;
  const distance = Math.hypot(cx - cell.x, cz - cell.z);

  if (camera.nightMode === "ir" && distance <= camera.irRangeM) {
    return 0.32;
  }

  return camera.nightMode === "none" ? 0.88 : 0.78;
}

function getClarityMultiplier(camera: CameraNode) {
  return {
    poor: 0.4,
    average: 0.68,
    good: 0.9,
    excellent: 1,
  }[camera.clarity];
}

function getDetectionProbability(quality: DoriQuality) {
  return {
    none: 0,
    detection: 0.25,
    observation: 0.5,
    recognition: 0.85,
    identification: 0.99,
  }[quality];
}

function getQualityThresholds(scene: SecurityScene) {
  return scene.assumptions.doriStandard === "iec62676"
    ? scene.assumptions.pixelsPerMeter
    : DORI_THRESHOLDS;
}

function buildWallGeometry(wall: WallNode) {
  const [sx, sz] = wall.start;
  const [ex, ez] = wall.end;
  const length = Math.hypot(ex - sx, ez - sz);
  const geometry = new THREE.BoxGeometry(length, wall.heightM, wall.thicknessM);
  const midpointX = (sx + ex) / 2;
  const midpointZ = (sz + ez) / 2;
  const angle = Math.atan2(ez - sz, ex - sx);
  geometry.rotateY(angle);
  geometry.translate(midpointX, wall.heightM / 2, midpointZ);
  return geometry;
}

function buildObstructionGeometry(obstruction: ObstructionNode) {
  const [width, depth, height] = obstruction.dimensions;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.rotateY((obstruction.rotationYDeg * Math.PI) / 180);
  geometry.translate(...obstruction.position);
  return geometry;
}

function buildVisionMesh(scene: SecurityScene): VisionMesh {
  const geometries: THREE.BufferGeometry[] = [];
  const sources: VisionSource[] = [];

  for (const wall of scene.walls) {
    geometries.push(buildWallGeometry(wall));
    sources.push({
      id: wall.id,
      material: wall.material,
      visionTransmission: wall.visionTransmission,
      label: wall.label,
    });
  }

  for (const obstruction of scene.obstructions) {
    geometries.push(buildObstructionGeometry(obstruction));
    sources.push({
      id: obstruction.id,
      material: obstruction.material,
      visionTransmission: obstruction.visionTransmission,
      label: obstruction.label,
    });
  }

  for (const door of scene.doors) {
    const doorState = String(door.state);
    if (doorState === "open") continue;
    const [width, height, thickness] = door.dimensions;
    const geometry = new THREE.BoxGeometry(width, height, thickness);
    geometry.translate(door.position[0], door.position[1], door.position[2]);
    geometries.push(geometry);
    sources.push({
      id: door.id,
      material: "solid",
      visionTransmission: doorState === "locked" || doorState === "restricted" ? 0.05 : 0,
      label: door.label,
    });
  }

  for (const window of scene.windows) {
    if (window.state === "open") continue;
    const [width, height, thickness] = window.dimensions;
    const geometry = new THREE.BoxGeometry(width, height, thickness);
    geometry.translate(window.position[0], window.position[1], window.position[2]);
    geometries.push(geometry);
    sources.push({
      id: window.id,
      material: window.state,
      visionTransmission:
        window.state === "reflective"
          ? Math.min(0.2, window.visionTransmission)
          : window.visionTransmission,
      label: window.label,
    });
  }

  const merged = mergeGeometries(geometries, true);
  merged.computeBoundsTree?.();

  const materials = sources.map(() => new THREE.MeshBasicMaterial());
  const mesh = new THREE.Mesh(merged, materials);
  mesh.userData.sources = sources;

  return {
    mesh,
    sources,
  };
}

function getSourceForIntersection(mesh: THREE.Mesh, faceIndex?: number): VisionSource | undefined {
  if (faceIndex === undefined) return undefined;

  const geometry = mesh.geometry;
  const groups = geometry.groups;
  const indexStart = faceIndex * 3;
  const group = groups.find(
    (candidate) =>
      indexStart >= candidate.start && indexStart < candidate.start + candidate.count,
  );

  return group
    ? (mesh.userData.sources as VisionSource[])[group.materialIndex ?? 0]
    : undefined;
}

function assessOcclusion(
  camera: CameraNode,
  target: THREE.Vector3,
  raycaster: THREE.Raycaster,
  visionMesh: VisionMesh,
) {
  const origin = new THREE.Vector3(...camera.position);
  const direction = target.clone().sub(origin).normalize();
  const distance = origin.distanceTo(target);

  raycaster.firstHitOnly = true;
  raycaster.set(origin, direction);

  const hit = raycaster.intersectObject(visionMesh.mesh, false)[0];

  if (!hit || hit.distance >= distance - 0.05) {
    return {
      blocked: false,
      materialPenalty: 1,
      blockedBy: undefined,
    };
  }

  const source = getSourceForIntersection(visionMesh.mesh, hit.faceIndex ?? undefined);

  if (!source) {
    return {
      blocked: false,
      materialPenalty: 1,
      blockedBy: undefined,
    };
  }

  if (source.visionTransmission >= 0.45) {
    return {
      blocked: false,
      materialPenalty: source.visionTransmission,
      blockedBy: source.label,
    };
  }

  return {
    blocked: true,
    materialPenalty: 0,
    blockedBy: source.label,
  };
}

function evaluateCameraAgainstCell(
  scene: SecurityScene,
  camera: CameraNode,
  cell: GridCell,
  targetHeightM: number,
  raycaster: THREE.Raycaster,
  visionMesh: VisionMesh,
): CameraEvaluation {
  if (camera.status !== "on") {
    return {
      quality: "none" as DoriQuality,
      ppm: 0,
      probability: 0,
      blockedBy: undefined as string | undefined,
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
      blockedBy: undefined as string | undefined,
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
      blockedBy: undefined as string | undefined,
    };
  }

  const occlusion = assessOcclusion(camera, target, raycaster, visionMesh);

  if (occlusion.blocked) {
    return {
      quality: "none" as DoriQuality,
      ppm: 0,
      probability: 0,
      blockedBy: occlusion.blockedBy,
    };
  }

  let ppm = computePixelDensity(camera, distance);
  const edgeAngle = Math.max(Math.abs(hAngle), Math.abs(vAngle));

  if (edgeAngle > 55) ppm *= 0.42;
  else if (edgeAngle > 42) ppm *= 0.58;
  else if (edgeAngle > 28) ppm *= 0.76;

  ppm *= getClarityMultiplier(camera);
  ppm *= occlusion.materialPenalty;
  ppm *= 1 - getLightingPenalty(camera, cell, scene.securityLights, scene);

  const quality = ppmToQuality(ppm, getQualityThresholds(scene));

  return {
    quality,
    ppm,
    probability: getDetectionProbability(quality),
    blockedBy: occlusion.blockedBy,
  };
}

export function createCoverageEvaluator(scene: SecurityScene): CoverageEvaluator {
  const visionMesh = buildVisionMesh(scene);
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

  const computeCoverageCells = (cellsPerMeter = 4) => {
    const { cells } = buildCoverageGrid(scene, cellsPerMeter);
    const results: CellComputation[] = [];

    for (const cell of cells) {
      if (!cell.walkable) continue;

      let bestQuality: DoriQuality = "none";
      let bestPpm = 0;
      const coveringCameras: string[] = [];
      const blockedBy = new Set<string>();
      const probabilities: number[] = [];

      for (const camera of scene.cameras) {
        const evaluation = evaluatePoint(camera, [cell.x, cell.z], scene.assumptions.personHeightM);

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
        coveringCameras,
        blockedBy: [...blockedBy],
        ppm: bestPpm,
        probabilities,
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

export function getQualityShare(cells: CellComputation[], quality: DoriQuality) {
  if (cells.length === 0) return 0;
  return (cells.filter((cell) => cell.quality === quality).length / cells.length) * 100;
}

export function getRecognitionAreaPct(
  cells: CellComputation[],
  thresholds: { detection: number; observation: number; recognition: number; identification: number } = DORI_THRESHOLDS,
) {
  if (cells.length === 0) return 0;
  return (
    (cells.filter((cell) => {
      const score = cell.ppm;
      return score >= thresholds.recognition;
    }).length /
      cells.length) *
    100
  );
}

export function getIdentificationAreaPct(
  cells: CellComputation[],
  thresholds: { detection: number; observation: number; recognition: number; identification: number } = DORI_THRESHOLDS,
) {
  if (cells.length === 0) return 0;
  return (
    (cells.filter((cell) => cell.ppm >= thresholds.identification).length /
      cells.length) *
    100
  );
}
