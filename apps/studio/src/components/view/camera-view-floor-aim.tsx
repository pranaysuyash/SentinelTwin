"use client";

import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useMemo } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import type { CameraNode } from "@/schema/security-scene";

/**
 * Floor-plane click aim for camera view. Renders an invisible plane
 * that catches click events and re-aims the camera at the hit point.
 */
export function CameraViewFloorAim({ camera }: { camera: CameraNode }) {
  const updateNode = useStudioStore((s) => s.updateNode);
  const markDirty = useStudioStore((s) => s.markDirty);
  const scene = useStudioStore((s) => s.scene);
  const { camera: threeCam, size } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const handleClick = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const ndc = new THREE.Vector2(
        (event.nativeEvent.clientX / size.width) * 2 - 1,
        -(event.nativeEvent.clientY / size.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, threeCam);
      const point = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(floorPlane, point);
      if (!hit) return;
      const dx = point.x - camera.position[0];
      const dz = point.z - camera.position[2];
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < 0.5) return;
      const yaw = Math.atan2(dx, dz) * (180 / Math.PI);
      const heightDelta = point.y - camera.position[1];
      const pitch = -Math.atan2(heightDelta, distance) * (180 / Math.PI);
      updateNode(camera.id, {
        yawDeg: Math.round(yaw),
        pitchDeg: Math.max(-90, Math.min(0, Math.round(pitch))),
      });
      markDirty();
    },
    [camera, floorPlane, markDirty, raycaster, threeCam, size, updateNode],
  );

  const { width, depth } = scene.dimensions;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[width / 2, 0, depth / 2]}
      onPointerDown={handleClick}
      visible={false}
    >
      <planeGeometry args={[width * 2, depth * 2]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
