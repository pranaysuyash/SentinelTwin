import { Html } from "@react-three/drei";

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
        <Html position={[center[0], 0.09, center[1]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className="rounded-md border border-[#2b3a58] bg-[#0b0f17]/90 px-2 py-0.5 text-[8px] font-semibold text-[#d2d9e8] shadow-[0_8px_20px_rgba(0,0,0,0.22)]">
            {label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
