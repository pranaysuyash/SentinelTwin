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

type PolygonDrawToolProps = {
  points: Point2[];
  hoverPoint?: Point2;
};

export function PolygonDrawTool({ points, hoverPoint }: PolygonDrawToolProps) {
  const safePoints = sanitizePoints(points);
  const safeHoverPoint = sanitizePoint(hoverPoint);
  const hasSegment = safePoints.length >= 1 && Boolean(safeHoverPoint);

  const previewPoints = safePoints.map(([x, z]) => new THREE.Vector3(x, 0.004, z));
  if (safeHoverPoint) previewPoints.push(new THREE.Vector3(safeHoverPoint[0], 0.004, safeHoverPoint[1]));

  const closedLoopPoints = safePoints.length >= 2
    ? [...safePoints, safePoints[0]!].map(([x, z]) => new THREE.Vector3(x, 0.002, z))
    : null;

  if (safePoints.length === 0 && !safeHoverPoint) return null;

  return (
    <group>
      {safePoints.length > 1 ? <Line points={previewPoints} color="#22c55e" lineWidth={1.6} /> : null}
      {closedLoopPoints ? <Line points={closedLoopPoints} color="#22c55e" lineWidth={1.2} /> : null}
      {safePoints.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.02, z]}>
          <ringGeometry args={[0.08, 0.13, 12]} />
          <meshBasicMaterial color={i === 0 ? "#bef264" : "#22c55e"} transparent opacity={0.85} />
        </mesh>
      ))}
      {hasSegment ? (
        <Line points={previewPoints} color="#86efac" lineWidth={1} />
      ) : null}
    </group>
  );
}
