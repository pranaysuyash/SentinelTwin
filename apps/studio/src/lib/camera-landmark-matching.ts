import { getYawPitchDirection } from "@sentineltwin/core";
import type { CameraEvidenceArtifact, CameraNode } from "@/schema/security-scene";

export type LandmarkMatch = NonNullable<CameraEvidenceArtifact["binding"]>["landmarkMatches"][number];

type Vec2 = [number, number];
type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

const EPSILON = 1e-9;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function subtract2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

function subtract3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(value: Vec3, factor: number): Vec3 {
  return [value[0] * factor, value[1] * factor, value[2] * factor];
}

function dot3(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length2(value: Vec2) {
  return Math.hypot(value[0], value[1]);
}

function length3(value: Vec3) {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalize3(value: Vec3): Vec3 {
  const magnitude = length3(value);
  if (magnitude <= EPSILON) {
    return [0, 0, 0];
  }
  return scale3(value, 1 / magnitude);
}

function angleWeight(angleRad: number, limitRad: number) {
  if (limitRad <= EPSILON) {
    return 0;
  }
  return clamp01(1 - angleRad / limitRad);
}

function meanPairwiseDistance2D(points: Vec2[]) {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  let count = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      total += length2(subtract2(points[i]!, points[j]!));
      count += 1;
    }
  }
  return count > 0 ? total / count : 0;
}

function normalizePoints2D(points: Vec2[]) {
  const centroid = points.reduce<Vec2>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  const count = Math.max(points.length, 1);
  const center: Vec2 = [centroid[0] / count, centroid[1] / count];
  const meanDistance = points.reduce((sum, point) => sum + length2(subtract2(point, center)), 0) / count;
  const scale = meanDistance <= EPSILON ? 1 : Math.SQRT2 / meanDistance;

  return {
    normalized: points.map((point) => [(point[0] - center[0]) * scale, (point[1] - center[1]) * scale] as Vec2),
    center,
    scale,
  };
}

function normalizePoints3D(points: Vec3[]) {
  const centroid = points.reduce<Vec3>((acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]], [0, 0, 0]);
  const count = Math.max(points.length, 1);
  const center: Vec3 = [centroid[0] / count, centroid[1] / count, centroid[2] / count];
  const meanDistance = points.reduce((sum, point) => sum + length3(subtract3(point, center)), 0) / count;
  const scale = meanDistance <= EPSILON ? 1 : Math.sqrt(3) / meanDistance;

  return {
    normalized: points.map((point) => [
      (point[0] - center[0]) * scale,
      (point[1] - center[1]) * scale,
      (point[2] - center[2]) * scale,
    ] as Vec3),
    center,
    scale,
  };
}

function maxTriangleScore2D(points: Vec2[]) {
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

function maxTriangleScore3D(points: Vec3[]) {
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

function gaussianSolve(matrix: number[][], rhs: number[]) {
  const n = matrix.length;
  const augmented = matrix.map((row, index) => [...row, rhs[index] ?? 0]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let pivotValue = Math.abs(augmented[col]![col] ?? 0);
    for (let row = col + 1; row < n; row += 1) {
      const value = Math.abs(augmented[row]![col] ?? 0);
      if (value > pivotValue) {
        pivotValue = value;
        pivotRow = row;
      }
    }

    if (pivotValue <= EPSILON) {
      augmented[col]![col] = EPSILON;
      pivotValue = EPSILON;
      pivotRow = col;
    }

    if (pivotRow !== col) {
      const temp = augmented[col]!;
      augmented[col] = augmented[pivotRow]!;
      augmented[pivotRow] = temp;
    }

    const pivot = augmented[col]![col]!;
    for (let entry = col; entry <= n; entry += 1) {
      augmented[col]![entry]! /= pivot;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row]![col]!;
      if (Math.abs(factor) <= EPSILON) continue;
      for (let entry = col; entry <= n; entry += 1) {
        augmented[row]![entry]! -= factor * augmented[col]![entry]!;
      }
    }
  }

  return augmented.map((row) => row[n]!);
}

function symmetricSmallestEigenvector(matrix: number[][]) {
  const regularized = matrix.map((row, rowIndex) =>
    row.map((value, colIndex) => value + (rowIndex === colIndex ? 1e-8 : 0)),
  );
  let vector = new Array(matrix.length).fill(0);
  vector[0] = 1;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const next = gaussianSolve(regularized, vector);
    const norm = Math.hypot(...next);
    if (norm <= EPSILON) {
      break;
    }
    vector = next.map((value) => value / norm);
  }

  return vector;
}

function buildAtA(rows: number[][]) {
  const size = rows[0]?.length ?? 0;
  const ata = Array.from({ length: size }, () => new Array(size).fill(0));

  for (const row of rows) {
    for (let i = 0; i < size; i += 1) {
      const left = row[i] ?? 0;
      if (Math.abs(left) <= EPSILON) continue;
      for (let j = i; j < size; j += 1) {
        const product = left * (row[j] ?? 0);
        ata[i]![j]! += product;
        if (j !== i) {
          ata[j]![i]! += product;
        }
      }
    }
  }

  return ata;
}

function projectProjectivePoint(matrix: number[][], point: Vec3) {
  const homogeneous: Vec4 = [point[0], point[1], point[2], 1];
  const projected = matrix.map((row) => row.reduce((sum, value, index) => sum + value * (homogeneous[index] ?? 0), 0));
  const w = projected[2] ?? 0;
  if (Math.abs(w) <= EPSILON) {
    return null;
  }
  return [projected[0]! / w, projected[1]! / w] as Vec2;
}

function projectAffinePoint(coefficients: number[], point: Vec3) {
  return [
    (coefficients[0] ?? 0) * point[0] + (coefficients[1] ?? 0) * point[1] + (coefficients[2] ?? 0) * point[2] + (coefficients[3] ?? 0),
    (coefficients[4] ?? 0) * point[0] + (coefficients[5] ?? 0) * point[1] + (coefficients[6] ?? 0) * point[2] + (coefficients[7] ?? 0),
  ] as Vec2;
}

function computeResidualStats(residuals: number[]) {
  if (!residuals.length) {
    return null;
  }

  const sorted = [...residuals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const meanSquare = residuals.reduce((sum, value) => sum + value * value, 0) / residuals.length;
  const rmse = Math.sqrt(meanSquare);
  const inlierRatio = residuals.filter((value) => value <= 0.15).length / residuals.length;

  return {
    median,
    rmse,
    inlierRatio,
  };
}

function computeVisibilityPrior(camera: CameraNode, matches: LandmarkMatch[]) {
  const forward = getYawPitchDirection(camera.yawDeg, camera.pitchDeg).toArray() as Vec3;
  const halfHorizontal = Math.max(toRadians(camera.fovHorizontalDeg / 2), EPSILON);
  const halfVertical = Math.max(toRadians(camera.fovVerticalDeg / 2), EPSILON);
  let right = normalize3(cross3(forward, [0, 1, 0]));
  if (length3(right) <= EPSILON) {
    right = [1, 0, 0];
  }
  let up = normalize3(cross3(right, forward));
  if (length3(up) <= EPSILON) {
    up = [0, 1, 0];
  }

  const scores = matches.map((match) => {
    const delta = subtract3(match.scenePosition, camera.position);
    const distance = length3(delta);
    if (distance <= EPSILON) {
      return 0;
    }

    const direction = normalize3(delta);
    const forwardDot = dot3(direction, forward);
    const horizontalOffset = Math.abs(Math.atan2(dot3(direction, right), forwardDot));
    const verticalOffset = Math.abs(Math.atan2(dot3(direction, up), forwardDot));

    const frontScore = clamp01(forwardDot);
    const fovScore = angleWeight(horizontalOffset, halfHorizontal) * angleWeight(verticalOffset, halfVertical);
    const rangeScore = clamp01(1 - distance / camera.rangeM);

    return (frontScore * 0.35) + (fovScore * 0.45) + (rangeScore * 0.2);
  });

  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function computeSpreadConfidence(matches: LandmarkMatch[]) {
  const scenePoints = matches.map((match) => match.scenePosition);
  const evidencePoints = matches.map((match) => match.evidencePosition2D);
  const sceneScore = maxTriangleScore3D(scenePoints);
  const evidenceScore = maxTriangleScore2D(evidencePoints);
  const pairwiseSpread = clamp01(meanPairwiseDistance2D(evidencePoints) / 2);

  return clamp01((sceneScore * 0.45) + (evidenceScore * 0.35) + (pairwiseSpread * 0.2));
}

function computeProjectiveConfidence(camera: CameraNode, matches: LandmarkMatch[]) {
  const normalized3D = normalizePoints3D(matches.map((match) => match.scenePosition));
  const normalized2D = normalizePoints2D(matches.map((match) => match.evidencePosition2D));
  const rows: number[][] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const point3D = normalized3D.normalized[index]!;
    const point2D = normalized2D.normalized[index]!;
    rows.push([
      point3D[0],
      point3D[1],
      point3D[2],
      1,
      0,
      0,
      0,
      0,
      -point2D[0] * point3D[0],
      -point2D[0] * point3D[1],
      -point2D[0] * point3D[2],
      -point2D[0],
    ]);
    rows.push([
      0,
      0,
      0,
      0,
      point3D[0],
      point3D[1],
      point3D[2],
      1,
      -point2D[1] * point3D[0],
      -point2D[1] * point3D[1],
      -point2D[1] * point3D[2],
      -point2D[1],
    ]);
  }

  const smallest = symmetricSmallestEigenvector(buildAtA(rows));
  const projection = [
    smallest.slice(0, 4),
    smallest.slice(4, 8),
    smallest.slice(8, 12),
  ] as number[][];

  const residuals = matches.map((match, index) => {
    const predicted = projectProjectivePoint(projection, normalized3D.normalized[index]!);
    if (!predicted) {
      return Number.POSITIVE_INFINITY;
    }
    const target = normalized2D.normalized[index]!;
    return length2(subtract2(predicted, target));
  });

  const stats = computeResidualStats(residuals);
  if (!stats) {
    return 0;
  }

  const fitConfidence = clamp01(Math.exp(-(stats.rmse + stats.median) * 3.5) * (0.45 + 0.55 * stats.inlierRatio));
  const spreadConfidence = computeSpreadConfidence(matches);
  const visibilityConfidence = computeVisibilityPrior(camera, matches);

  return clamp01(fitConfidence * (0.25 + 0.75 * spreadConfidence) * Math.pow(visibilityConfidence, 1.6));
}

function computeAffineConfidence(camera: CameraNode, matches: LandmarkMatch[]) {
  const normalized3D = normalizePoints3D(matches.map((match) => match.scenePosition));
  const normalized2D = normalizePoints2D(matches.map((match) => match.evidencePosition2D));
  const rows: number[][] = [];
  const targets: number[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const point3D = normalized3D.normalized[index]!;
    const point2D = normalized2D.normalized[index]!;
    rows.push([point3D[0], point3D[1], point3D[2], 1, 0, 0, 0, 0]);
    targets.push(point2D[0]);
    rows.push([0, 0, 0, 0, point3D[0], point3D[1], point3D[2], 1]);
    targets.push(point2D[1]);
  }

  const ata = buildAtA(rows);
  const atb = new Array(8).fill(0).map((_, columnIndex) =>
    rows.reduce((sum, values, rowIndex) => sum + (values[columnIndex] ?? 0) * (targets[rowIndex] ?? 0), 0),
  );
  const coefficients = gaussianSolve(ata, atb);

  const residuals = matches.map((match, index) => {
    const predicted = projectAffinePoint(coefficients, normalized3D.normalized[index]!);
    const target = normalized2D.normalized[index]!;
    return length2(subtract2(predicted, target));
  });

  const stats = computeResidualStats(residuals);
  if (!stats) {
    return 0;
  }

  const fitConfidence = clamp01(Math.exp(-stats.rmse * 3) * (0.4 + 0.6 * stats.inlierRatio));
  const spreadConfidence = computeSpreadConfidence(matches);
  const visibilityConfidence = computeVisibilityPrior(camera, matches);

  return clamp01(0.72 * fitConfidence * (0.3 + 0.7 * spreadConfidence) * Math.pow(visibilityConfidence, 1.6));
}

/**
 * Estimate how trustworthy the landmark alignment is using an actual geometric fit.
 *
 * The solver works in normalized evidence space because the binding payload does not
 * currently carry camera calibration or image dimensions. Confidence therefore comes
 * from reprojection residuals, geometric spread, and a soft visibility prior from the
 * current camera pose.
 */
export function computeLandmarkAlignmentConfidence(camera: CameraNode, matches: LandmarkMatch[]) {
  if (!matches || matches.length < 4) {
    return 0;
  }

  if (matches.length >= 6) {
    return computeProjectiveConfidence(camera, matches);
  }

  return computeAffineConfidence(camera, matches);
}
