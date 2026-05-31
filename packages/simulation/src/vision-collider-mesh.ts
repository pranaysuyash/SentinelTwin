import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type {
  SecurityScene,
  DoorNode,
  WindowNode,
  WallNode,
  ObstructionNode,
} from "@sentineltwin/core";

declare module "three" {
  interface Raycaster {
    firstHitOnly?: boolean;
  }
}

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

export type VisionColliderSource = {
  id: string;
  material: string;
  visionTransmission: number;
  label: string;
  glarePenalty: boolean;
};

export type VisionColliderMesh = {
  mesh: THREE.Mesh;
  sources: VisionColliderSource[];
  faceSources: VisionColliderSource[];
};

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

function buildDoorGeometry(door: DoorNode) {
  const [width, height, thickness] = door.dimensions;
  const geometry = new THREE.BoxGeometry(width, height, thickness);
  geometry.translate(door.position[0], door.position[1], door.position[2]);
  return geometry;
}

function buildWindowGeometry(window: WindowNode) {
  const [width, height, thickness] = window.dimensions;
  const geometry = new THREE.BoxGeometry(width, height, thickness);
  geometry.translate(window.position[0], window.position[1], window.position[2]);
  return geometry;
}

function pushSourceFaces(
  faceSources: VisionColliderSource[],
  geometry: THREE.BufferGeometry,
  source: VisionColliderSource,
) {
  const faceCount = geometry.index
    ? geometry.index.count / 3
    : geometry.attributes.position.count / 3;

  for (let index = 0; index < faceCount; index += 1) {
    faceSources.push(source);
  }
}

export function buildVisionColliderMesh(
  scene: Pick<SecurityScene, "walls" | "obstructions" | "doors" | "windows">,
): VisionColliderMesh {
  const geometries: THREE.BufferGeometry[] = [];
  const sources: VisionColliderSource[] = [];
  const faceSources: VisionColliderSource[] = [];

  for (const wall of scene.walls) {
    if (wall.collisionLayer && !wall.collisionLayer.visionCollider) continue;
    const geometry = buildWallGeometry(wall);
    geometries.push(geometry);
    const source = {
      id: wall.id,
      material: wall.material,
      visionTransmission: wall.visionTransmission,
      label: wall.label,
      glarePenalty: false,
    };
    sources.push(source);
    pushSourceFaces(faceSources, geometry, source);
  }

  for (const obstruction of scene.obstructions) {
    if (obstruction.collisionLayer && !obstruction.collisionLayer.visionCollider) continue;
    const geometry = buildObstructionGeometry(obstruction);
    geometries.push(geometry);
    const source = {
      id: obstruction.id,
      material: obstruction.material,
      visionTransmission: obstruction.visionTransmission,
      label: obstruction.label,
      glarePenalty: false,
    };
    sources.push(source);
    pushSourceFaces(faceSources, geometry, source);
  }

  for (const door of scene.doors) {
    if (String(door.state) === "open") continue;
    if (door.collisionLayer && !door.collisionLayer.visionCollider) continue;

    const geometry = buildDoorGeometry(door);
    geometries.push(geometry);
    const source = {
      id: door.id,
      material: "solid",
      visionTransmission: 0,
      label: door.label,
      glarePenalty: false,
    };
    sources.push(source);
    pushSourceFaces(faceSources, geometry, source);
  }

  for (const window of scene.windows) {
    if (window.state === "open") continue;
    if (window.collisionLayer && !window.collisionLayer.visionCollider) continue;

    const geometry = buildWindowGeometry(window);
    geometries.push(geometry);
    const transmission =
      window.state === "closed_glass"
        ? window.visionTransmission
        : window.state === "grill"
          ? 0.5
          : window.state === "curtain"
            ? 0.15
            : window.state === "reflective"
              ? Math.min(0.4, Math.max(0.12, window.visionTransmission))
              : 0;
    const source = {
      id: window.id,
      material: window.state,
      visionTransmission: transmission,
      label: window.label,
      glarePenalty: window.state === "reflective",
    };
    sources.push(source);
    pushSourceFaces(faceSources, geometry, source);
  }

  const merged = geometries.length > 0 ? mergeGeometries(geometries, true) : new THREE.BufferGeometry();
  merged.computeBoundsTree?.();

  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
  mesh.userData.sources = sources;
  mesh.userData.faceSources = faceSources;

  return { mesh, sources, faceSources };
}

export function getVisionColliderSource(
  mesh: THREE.Mesh,
  faceIndex?: number,
): VisionColliderSource | undefined {
  if (faceIndex == null) return undefined;

  const faceSources = mesh.userData.faceSources as VisionColliderSource[] | undefined;
  return faceSources?.[faceIndex];
}
