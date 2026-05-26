import * as THREE from "three";

import type { Point2 } from "./editor-geometry";

export function SelectionOverlay({ center, label, showSnap = false }: {
  center?: Point2;
  label?: string;
  showSnap?: boolean;
}) {
  if (!center) return null;

  return (
    <group>
      <mesh position={[center[0], 0.015, center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.26, 16]} />
        <meshBasicMaterial color="#93c5fd" transparent opacity={showSnap ? 0.8 : 0.45} />
      </mesh>
      {label ? (
        <mesh position={[center[0], 0.06, center[1]]}>
          <planeGeometry args={[1.1, 0.28]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ) : null}
    </group>
  );
}
