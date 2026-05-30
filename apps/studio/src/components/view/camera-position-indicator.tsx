"use client";

import * as THREE from "three";
import { useMemo } from "react";

import { getYawPitchDirection } from "@sentineltwin/core";
import type { CameraNode } from "@/schema/security-scene";

/**
 * Small minimap-style marker showing the camera's position and look direction
 * within the scene. Rendered as a 2D circle + direction indicator on the floor.
 */
export function CameraPositionIndicator({ camera }: { camera: CameraNode }) {
  const forward = useMemo(() => getYawPitchDirection(camera.yawDeg, camera.pitchDeg), [camera.yawDeg, camera.pitchDeg]);
  const targetPos = useMemo(
    () => new THREE.Vector3(...camera.position).add(forward.clone().multiplyScalar(2)),
    [camera.position, forward],
  );

  return (
    <group>
      <mesh position={[camera.position[0], 0.01, camera.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.22, 24]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh position={[targetPos.x, 0.01, targetPos.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.06, 12]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh position={[camera.position[0], 0.005, camera.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.04, 12]} />
        <meshBasicMaterial color="#93c5fd" depthWrite={false} />
      </mesh>
    </group>
  );
}
