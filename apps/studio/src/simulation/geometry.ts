import * as THREE from "three";

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function normalizeAngle(value: number) {
  let angle = value % 360;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;
  return angle;
}

export function getYawPitchDirection(yawDeg: number, pitchDeg: number) {
  const yaw = toRadians(yawDeg);
  const pitch = toRadians(pitchDeg);
  const x = Math.sin(yaw) * Math.cos(pitch);
  const y = Math.sin(pitch);
  const z = -Math.cos(yaw) * Math.cos(pitch);
  return new THREE.Vector3(x, y, z).normalize();
}

export function pointInPolygon(point: [number, number], polygon: [number, number][]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] <
        ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function polygonCenter(polygon: [number, number][]) {
  const total = polygon.reduce(
    (acc, [x, z]) => ({ x: acc.x + x, z: acc.z + z }),
    { x: 0, z: 0 },
  );
  return [total.x / polygon.length, total.z / polygon.length] as [number, number];
}

export function distance2D(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function lerp2D(a: [number, number], b: [number, number], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as [number, number];
}
