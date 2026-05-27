"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import {
  ENVIRONMENT_THEMES,
  SceneDoors,
  SceneFloor,
  SceneLighting,
  SceneObstructions,
  ScenePrivacyZones,
  SceneWalls,
  SceneWindows,
} from "@/components/workspace/SharedScene";

import { getYawPitchDirection } from "@/simulation/geometry";
import { useStudioStore } from "@/store/studio-store";
import type { CameraNode } from "@/schema/security-scene";

/** Shared scene geometry for camera feed views. Includes optional privacy zones. */
export function SceneFeedGeometry({
  theme,
  showPrivacyZones = false,
}: {
  theme?: (typeof ENVIRONMENT_THEMES)[keyof typeof ENVIRONMENT_THEMES];
  showPrivacyZones?: boolean;
}) {
  const scene = useStudioStore((s) => s.scene);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const { width, depth } = scene.dimensions;
  const resolvedTheme = theme ?? ENVIRONMENT_THEMES.day;

  return (
    <>
      <SceneLighting theme={resolvedTheme} />
      <SceneFloor width={width} depth={depth} showGrid={false} />
      <SceneWalls walls={scene.walls} />
      <SceneDoors doors={scene.doors} />
      <SceneWindows windows={scene.windows} />
      <SceneObstructions obstructions={scene.obstructions} selectedId={selectedId} />
      {showPrivacyZones && <ScenePrivacyZones zones={scene.privacyZones} />}
    </>
  );
}

/**
 * CameraRig for single-camera focus view — re-focuses whenever camData changes.
 * Use this in CameraViewMode where switching cameras should animate to the new POV.
 */
export function CameraRigLive({ camera: camData }: { camera: CameraNode }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const forward = getYawPitchDirection(camData.yawDeg, camData.pitchDeg);
    const pos = new THREE.Vector3(...camData.position);
    const target = pos.clone().add(forward.clone().multiplyScalar(8));
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, camData.id, camData.pitchDeg, camData.position, camData.yawDeg]);

  return null;
}

/**
 * CameraRig for wall-mode tiles — keeps POV synchronized to live camera edits.
 */
export function CameraRigFixed({ camera: camData }: { camera: CameraNode }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const forward = getYawPitchDirection(camData.yawDeg, camData.pitchDeg);
    const pos = new THREE.Vector3(...camData.position);
    const target = pos.clone().add(forward.clone().multiplyScalar(6));
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, camData.id, camData.pitchDeg, camData.position, camData.yawDeg]);

  return null;
}

/** HH:MM:SS timestamp string for feed overlays. */
export function nowTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}  ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
