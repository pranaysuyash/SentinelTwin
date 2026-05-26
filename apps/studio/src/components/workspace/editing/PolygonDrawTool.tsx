import { Line, LineLoop } from "@react-three/drei";
import * as THREE from "three";
import type { Point2 } from "./editor-geometry";

type PolygonDrawToolProps = {
  points: Point2[];
  hoverPoint?: Point2;
};

export function PolygonDrawTool({ points, hoverPoint }: PolygonDrawToolProps) {
  const hasSegment = points.length >= 1 && Boolean(hoverPoint);

  const previewPoints = points.map(([x, z]) => new THREE.Vector3(x, 0.004, z));
  if (hoverPoint) previewPoints.push(new THREE.Vector3(hoverPoint[0], 0.004, hoverPoint[1]));

  if (points.length === 0 && !hoverPoint) return null;

  return (
    <group>
      {points.length > 1 ? <Line points={previewPoints} color="#22c55e" lineWidth={1.6} /> : null}
      {points.length >= 2 && <LineLoop points={points.map(([x, z]) => new THREE.Vector3(x, 0.002, z))} color="#22c55e" lineWidth={1.2} />}
      {points.map(([x, z], index) => (
        <mesh key={`${x}-${z}-${index}`} position={[x, 0.02, z]}>
          <ringGeometry args={[0.08, 0.13, 12]} />
          <meshBasicMaterial color={index === 0 ? "#bef264" : "#22c55e"} transparent opacity={0.85} />
        </mesh>
      ))}
      {hasSegment && hoverPoint ? (
        <Line points={previewPoints} color="#86efac" lineWidth={1} />
      ) : null}
      {points.length >= 3 ? null : null}
    </group>
  );
}
