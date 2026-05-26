import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Point2 } from "./editor-geometry";

type WallDraft = {
  start: Point2;
  current: Point2;
  lockedAngle?: boolean;
  snappedToWall?: boolean;
  length: number;
};

export function WallDrawTool({ draft }: { draft: WallDraft | null }) {
  if (!draft) return null;

  const start = new THREE.Vector3(draft.start[0], 0.001, draft.start[1]);
  const end = new THREE.Vector3(draft.current[0], 0.001, draft.current[1]);

  return (
    <group>
      <Line points={[start, end]} color={draft.snappedToWall ? "#7dd3fc" : "#60a5fa"} lineWidth={2.5} />
      <mesh position={[draft.current[0], 0.011, draft.current[1]]}>
        <ringGeometry args={[0.1, 0.18, 18]} />
        <meshBasicMaterial transparent color={draft.snappedToWall ? "#7dd3fc" : "#60a5fa"} opacity={0.72} />
      </mesh>
      <mesh position={[(draft.start[0] + draft.current[0]) / 2, 0.012, (draft.start[1] + draft.current[1]) / 2]}>
        <meshBasicMaterial transparent visible={false} />
      </mesh>
      <group position={[(draft.start[0] + draft.current[0]) / 2, 0.02, (draft.start[1] + draft.current[1]) / 2]}>
        <mesh>
          <planeGeometry args={[0.01, 0.5]} />
        </mesh>
      </group>
      {draft.length > 0 ? (
        <mesh position={[(draft.start[0] + draft.current[0]) / 2, 0.08, (draft.start[1] + draft.current[1]) / 2]}>
          <meshBasicMaterial transparent visible={false} />
        </mesh>
      ) : null}
    </group>
  );
}
