"use client";

import { useMemo } from "react";

import type { CameraNode } from "@/schema/security-scene";

export const DORI_BAND_COLORS = {
  identification: "#38bdf8",
  recognition: "#22c55e",
  observation: "#fbbf24",
  detection: "#f59e0b",
} as const;

const DORI_PPM_THRESHOLDS: Record<string, number> = {
  detection: 25,
  observation: 62.5,
  recognition: 125,
  identification: 250,
};

const BAND_WIDTH_FRAC = 0.08;
const RING_SEGMENTS = 64;
const FLOOR_Y = 0.012;
const MAX_RANGE_M = 80;

function computeDistanceForPpm(
  resolutionMP: number,
  fovHorizontalDeg: number,
  targetPpm: number,
): number {
  if (resolutionMP <= 0 || fovHorizontalDeg <= 0) return 0;
  const resolutionWidthPx = Math.sqrt(resolutionMP * 1_000_000 * (16 / 9));
  const fovRad = (fovHorizontalDeg * Math.PI) / 360;
  const tanHalfFov = Math.tan(fovRad);
  if (tanHalfFov <= 0) return 0;
  const distance = resolutionWidthPx / (2 * targetPpm * tanHalfFov);
  return Math.min(distance, MAX_RANGE_M);
}

export function DoriBandArcs({ camera }: { camera: CameraNode }) {
  const distances = useMemo(() => {
    return {
      detection: computeDistanceForPpm(camera.resolutionMP, camera.fovHorizontalDeg, DORI_PPM_THRESHOLDS.detection),
      observation: computeDistanceForPpm(camera.resolutionMP, camera.fovHorizontalDeg, DORI_PPM_THRESHOLDS.observation),
      recognition: computeDistanceForPpm(camera.resolutionMP, camera.fovHorizontalDeg, DORI_PPM_THRESHOLDS.recognition),
      identification: computeDistanceForPpm(camera.resolutionMP, camera.fovHorizontalDeg, DORI_PPM_THRESHOLDS.identification),
    };
  }, [camera.resolutionMP, camera.fovHorizontalDeg]);

  const arcs = useMemo(() => {
    return Object.entries(DORI_PPM_THRESHOLDS)
      .filter(([key]) => distances[key as keyof typeof distances] > 0.5)
      .map(([key]) => {
        const radius = distances[key as keyof typeof distances];
        return {
          radius,
          color: DORI_BAND_COLORS[key as keyof typeof DORI_BAND_COLORS],
          key,
        };
      });
  }, [distances]);

  if (arcs.length === 0) return null;

  return (
    <group position={[camera.position[0], FLOOR_Y, camera.position[2]]}>
      {arcs.map((arc) => (
        <mesh key={arc.key} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[
              Math.max(arc.radius * (1 - BAND_WIDTH_FRAC), 0.02),
              Math.max(arc.radius, 0.04),
              RING_SEGMENTS,
              1,
              0,
              Math.PI * 2,
            ]}
          />
          <meshBasicMaterial color={arc.color} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
