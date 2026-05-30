import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Point2 } from "./editor-geometry";

type PathDrawToolProps = {
  points: Point2[];
  hoverPoint?: Point2;
};

export function PathDrawTool({ points, hoverPoint }: PathDrawToolProps) {
  const linePoints = points.map(([x, z]) => new THREE.Vector3(x, 0.01, z));
  if (hoverPoint) {
    linePoints.push(new THREE.Vector3(hoverPoint[0], 0.01, hoverPoint[1]));
  }

  if (points.length === 0 && !hoverPoint) return null;

  return (
    <group>
      {points.length > 1 ? <Line points={linePoints} color="#fb923c" lineWidth={2} /> : null}
      {hoverPoint && points.length > 0 ? <Line points={linePoints} color="#fdba74" lineWidth={1} dashed /> : null}
      {points.map(([x, z], i) => (
        <mesh key={`${x.toFixed(1)}-${z.toFixed(1)}`} position={[x, 0.02, z]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshBasicMaterial color={i === 0 ? "#fde68a" : "#fb923c"} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}
