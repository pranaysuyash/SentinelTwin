import { getYawPitchDirection } from "@sentineltwin/core";
import type { CameraEvidenceArtifact, CameraNode } from "@/schema/security-scene";

export type LandmarkMatch = NonNullable<CameraEvidenceArtifact["binding"]>["landmarkMatches"][number];

const EPSILON = 1e-9;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function subtract3(a: [number, number, number], b: [number, number, number]) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as [number, number, number];
}

function subtract2(a: [number, number], b: [number, number]) {
  return [a[0] - b[0], a[1] - b[1]] as [number, number];
}

function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: [number, number, number], b: [number, number, number]) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ] as [number, number, number];
}

function length3(value: [number, number, number]) {
  return Math.hypot(value[0], value[1], value[2]);
}

function length2(value: [number, number]) {
  return Math.hypot(value[0], value[1]);
}

function normalize3(value: [number, number, number]) {
  const magnitude = length3(value);
  if (magnitude <= EPSILON) {
    return [0, 0, 0] as [number, number, number];
  }
  return [value[0] / magnitude, value[1] / magnitude, value[2] / magnitude] as [number, number, number];
}

function angleWeight(angleRad: number, limitRad: number) {
  if (limitRad <= EPSILON) {
    return 0;
  }
  return clamp01(1 - angleRad / limitRad);
}

function maxTriangleScore2D(points: Array<[number, number]>) {
  if (points.length < 3) {
    return 0;
  }

  let bestArea = 0;
  let bestEdge = 0;

  for (let i = 0; i < points.length - 2; i += 1) {
    for (let j = i + 1; j < points.length - 1; j += 1) {
      for (let k = j + 1; k < points.length; k += 1) {
        const a = points[i]!;
        const b = points[j]!;
        const c = points[k]!;
        const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
        const edge = Math.max(length2(subtract2(a, b)), length2(subtract2(b, c)), length2(subtract2(c, a)));
        if (area > bestArea) {
          bestArea = area;
          bestEdge = edge;
        }
      }
    }
  }

  if (bestEdge <= EPSILON) {
    return 0;
  }

  return clamp01((bestArea / (bestEdge * bestEdge)) * 2.5);
}

function maxTriangleScore3D(points: Array<[number, number, number]>) {
  if (points.length < 3) {
    return 0;
  }

  let bestArea = 0;
  let bestEdge = 0;

  for (let i = 0; i < points.length - 2; i += 1) {
    for (let j = i + 1; j < points.length - 1; j += 1) {
      for (let k = j + 1; k < points.length; k += 1) {
        const a = points[i]!;
        const b = points[j]!;
        const c = points[k]!;
        const area = length3(cross3(subtract3(b, a), subtract3(c, a))) / 2;
        const edge = Math.max(length3(subtract3(a, b)), length3(subtract3(b, c)), length3(subtract3(c, a)));
        if (area > bestArea) {
          bestArea = area;
          bestEdge = edge;
        }
      }
    }
  }

  if (bestEdge <= EPSILON) {
    return 0;
  }

  return clamp01((bestArea / (bestEdge * bestEdge)) * 2.5);
}

function computeCameraFitScore(camera: CameraNode, matches: LandmarkMatch[]) {
  const forward = getYawPitchDirection(camera.yawDeg, camera.pitchDeg).toArray() as [number, number, number];
  const worldUp: [number, number, number] = [0, 1, 0];
  let right = cross3(forward, worldUp);

  if (length3(right) <= EPSILON) {
    right = [1, 0, 0];
  } else {
    right = normalize3(right);
  }

  const up = normalize3(cross3(right, forward));
  const halfHorizontal = Math.max(toRadians(camera.fovHorizontalDeg / 2), EPSILON);
  const halfVertical = Math.max(toRadians(camera.fovVerticalDeg / 2), EPSILON);

  const scores = matches.map((match) => {
    const delta = subtract3(match.scenePosition, camera.position);
    const distance = length3(delta);
    if (distance <= EPSILON) {
      return 0;
    }

    const direction = normalize3(delta);
    const forwardComponent = clamp01(dot3(direction, forward));
    const rightComponent = dot3(direction, right);
    const upComponent = dot3(direction, up);
    const forwardDot = dot3(direction, forward);
    const horizontalOffset = Math.abs(Math.atan2(rightComponent, forwardDot));
    const verticalOffset = Math.abs(Math.atan2(upComponent, forwardDot));
    const fovScore = angleWeight(horizontalOffset, halfHorizontal) * angleWeight(verticalOffset, halfVertical);
    const rangeScore = clamp01(1 - distance / camera.rangeM);

    return (fovScore * 0.55) + (rangeScore * 0.25) + (forwardComponent * 0.2);
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function computeLandmarkAlignmentConfidence(
  camera: CameraNode,
  matches: LandmarkMatch[]
): number {
  if (!matches || matches.length < 3) {
    return 0;
  }

  const matchCountScore = clamp01((matches.length - 2) / 3);
  const cameraFitScore = computeCameraFitScore(camera, matches);
  const geometry3DScore = maxTriangleScore3D(matches.map((match) => match.scenePosition));
  const geometry2DScore = maxTriangleScore2D(matches.map((match) => match.evidencePosition2D));
  const geometryScore = (geometry3DScore * 0.6) + (geometry2DScore * 0.4);

  const confidence =
    (matchCountScore * 0.2) +
    (cameraFitScore * 0.5) +
    (cameraFitScore * geometryScore * 0.3);

  return Math.min(0.95, clamp01(confidence));
}
