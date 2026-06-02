"use client";

import { Html } from "@react-three/drei";

import { pointOnPathAtProgress } from "@/components/map/path-quality";
import type { SecurityScene } from "@/schema/security-scene";

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
      <SceneHtml position={[0, 1.52, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div className="rounded-full border border-red-400/50 bg-black/75 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-red-200 shadow-[0_0_24px_rgba(248,113,113,0.18)]">
          Tracked Actor
        </div>
      </SceneHtml>
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
