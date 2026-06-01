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

import { getYawPitchDirection } from "@sentineltwin/core";
import { useStudioStore } from "@/store/studio-store";
import type { CameraNode } from "@/schema/security-scene";
import type { CameraReplayPose } from "@/components/view/camera-view-utils";

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
      <SceneWalls walls={scene.walls} selectable={false} />
      <SceneDoors doors={scene.doors} selectable={false} />
      <SceneWindows windows={scene.windows} selectable={false} />
      <SceneObstructions obstructions={scene.obstructions} selectedId={selectedId} onSelect={() => {}} />
      {showPrivacyZones && <ScenePrivacyZones zones={scene.privacyZones} />}
    </>
  );
}

/**
 * CameraRig for single-camera focus view — re-focuses whenever camData changes.
 * Use this in CameraViewMode where switching cameras should animate to the new POV.
 */
export function CameraRigLive({
  camera: camData,
  poseOverride,
}: {
  camera: CameraNode;
  poseOverride?: CameraReplayPose;
}) {
  const camera = useThree((s) => s.camera);
  const [cameraX, cameraY, cameraZ] = camData.position;
  const yawDeg = poseOverride?.yawDeg ?? camData.yawDeg;
  const pitchDeg = poseOverride?.pitchDeg ?? camData.pitchDeg;

  useEffect(() => {
    const forward = getYawPitchDirection(yawDeg, pitchDeg);
    const pos = new THREE.Vector3(cameraX, cameraY, cameraZ);
    const target = pos.clone().add(forward.clone().multiplyScalar(8));
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, camData.id, cameraX, cameraY, cameraZ, yawDeg, pitchDeg]);

  return null;
}

/**
 * CameraRig for wall-mode tiles — keeps POV synchronized to live camera edits.
 */
export function CameraRigFixed({
  camera: camData,
  poseOverride,
}: {
  camera: CameraNode;
  poseOverride?: CameraReplayPose;
}) {
  const camera = useThree((s) => s.camera);
  const [cameraX, cameraY, cameraZ] = camData.position;
  const yawDeg = poseOverride?.yawDeg ?? camData.yawDeg;
  const pitchDeg = poseOverride?.pitchDeg ?? camData.pitchDeg;

  useEffect(() => {
    const forward = getYawPitchDirection(yawDeg, pitchDeg);
    const pos = new THREE.Vector3(cameraX, cameraY, cameraZ);
    const target = pos.clone().add(forward.clone().multiplyScalar(6));
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, camData.id, cameraX, cameraY, cameraZ, yawDeg, pitchDeg]);

  return null;
}
