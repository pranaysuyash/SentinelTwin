"use client";

import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useMemo } from "react";
import * as THREE from "three";

import { pointOnPathAtProgress } from "@/components/map/path-quality";
import { useStudioStore } from "@/store/studio-store";
import { getYawPitchDirection } from "@/simulation/geometry";
import type { CameraNode, SecurityScene } from "@/schema/security-scene";

function pathYawAtProgress(path: SecurityScene["paths"][number], progress: number) {
  if (path.points.length < 2) return 0;

  const clamped = Math.max(0, Math.min(1, progress));
  const total = path.points.reduce((acc, point, index) => {
    if (index === 0) return acc;
    const prev = path.points[index - 1]!.position;
    const current = point.position;
    return acc + Math.hypot(current[0] - prev[0], current[1] - prev[1]);
  }, 0);

  if (total <= 0) return 0;

  let target = total * clamped;
  for (let index = 1; index < path.points.length; index += 1) {
    const start = path.points[index - 1]!.position;
    const end = path.points[index]!.position;
    const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (segmentLength <= 0) continue;

    if (target <= segmentLength || index === path.points.length - 1) {
      return Math.atan2(end[0] - start[0], end[1] - start[1]);
    }

    target -= segmentLength;
  }

  const last = path.points[path.points.length - 1]!;
  const prev = path.points[path.points.length - 2]!;
  return Math.atan2(last.position[0] - prev.position[0], last.position[1] - prev.position[1]);
}

export function ReplayActor({
  path,
  progress,
}: {
  path: SecurityScene["paths"][number];
  progress: number;
}) {
  const [x, z] = pointOnPathAtProgress(path, progress);
  const yaw = pathYawAtProgress(path, progress);

  return (
    <group position={[x, 0.02, z]} rotation={[0, yaw, 0]}>
      <Html position={[0, 1.52, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div className="rounded-full border border-red-400/50 bg-black/75 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-red-200 shadow-[0_0_24px_rgba(248,113,113,0.18)]">
          Tracked Actor
        </div>
      </Html>
      <mesh position={[0, 0.88, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.62, 6, 10]} />
        <meshStandardMaterial color="#e5ebf3" roughness={0.58} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#f8fbff" roughness={0.35} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.58, 1.9, 0.54]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.24} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.58, 1.9, 0.54]} />
        <meshBasicMaterial color="#f97316" wireframe transparent opacity={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[0.17, 0.35, 24]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

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
