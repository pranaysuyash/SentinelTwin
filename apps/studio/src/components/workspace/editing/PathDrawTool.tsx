import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Point2 } from "./editor-geometry";

function sanitizePoints(points: Point2[]): Point2[] {
  return points.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

function sanitizePoint(point?: Point2): Point2 | null {
  if (!point) return null;
  const [x, z] = point;
  return Number.isFinite(x) && Number.isFinite(z) ? point : null;
}

type PathDrawToolProps = {
  points: Point2[];
  hoverPoint?: Point2;
};

export function PathDrawTool({ points, hoverPoint }: PathDrawToolProps) {
  const safePoints = sanitizePoints(points);
  const safeHoverPoint = sanitizePoint(hoverPoint);
  const linePoints = safePoints.map(([x, z]) => new THREE.Vector3(x, 0.01, z));
  if (safeHoverPoint) {
    linePoints.push(new THREE.Vector3(safeHoverPoint[0], 0.01, safeHoverPoint[1]));
  }

  if (safePoints.length === 0 && !safeHoverPoint) return null;

  return (
    <group>
      {safePoints.length > 1 ? <Line points={linePoints} color="#fb923c" lineWidth={2} /> : null}
      {safeHoverPoint && safePoints.length > 0 ? <Line points={linePoints} color="#fdba74" lineWidth={1} dashed /> : null}
      {safePoints.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.02, z]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshBasicMaterial color={i === 0 ? "#fde68a" : "#fb923c"} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}
