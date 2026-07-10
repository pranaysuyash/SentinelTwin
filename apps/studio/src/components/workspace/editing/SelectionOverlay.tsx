import { Html } from "@react-three/drei";
import { SceneHtml } from "@/components/shared/SceneHtml";

import type { Point2 } from "./editor-geometry";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
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
        <SceneHtml position={[center[0], 0.09, center[1]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className={`rounded-md border ${UI_SURFACES.borderElevated} ${UI_SURFACES.panel}/90 px-2 py-0.5 text-[8px] font-semibold ${UI_SURFACES.textBody2} shadow-[0_8px_20px_rgba(0,0,0,0.22)]`}>
            {label}
          </div>
        </SceneHtml>
      ) : null}
    </group>
  );
}
