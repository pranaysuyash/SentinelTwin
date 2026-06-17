import * as THREE from "three";
import { normalizeAngle } from "@sentineltwin/core";
import type { CameraNode, CriticalZoneNode, SecurityScene, SimulationResult } from "@/schema/security-scene";

/**
 * "Cinematic framing grade" (EXPLORATION_MAP.md Thread 146) — a director's-eye
 * companion to DORI coverage quality.
 *
 * DORI quality answers "is the pixel density high enough to identify someone
 * at this distance?" It does not answer "where in the frame does this zone
 * fall, and is the angle steep enough that a camera only ever sees the top of
 * someone's head?" A zone can pass DORI (good pixel density) while still
 * being framed at the extreme edge of the shot, or shot from almost directly
 * overhead — both reduce real-world usefulness even when the quality tier
 * says "good".
 *
 * This is a pure derivation over data the engine already produces: camera
 * pose (yaw/pitch/FOV) and critical-zone geometry. It reuses the exact
 * hAngle/vAngle projection used by the coverage engine's `evaluatePoint`
 * (packages/simulation/src/coverage.ts ~L573-579) so "in frame" here means
 * the same thing it means to the simulation. No schema changes — Rule 5
 * clean, same shape as Camera Drift (D-308).
 */

export type FramingGrade = "well_framed" | "edge_of_frame" | "foreshortened" | "out_of_frame";

export interface FramingGradeEntry {
  zoneId: string;
  zoneLabel: string;
  cameraId: string;
  cameraName: string;
  grade: FramingGrade;
  /** -1..1, 0 = centered horizontally, ±1 = at the horizontal FOV edge. */
  normalizedHPos: number;
  /** -1..1, 0 = centered vertically, ±1 = at the vertical FOV edge. */
  normalizedVPos: number;
  detail: string;
}

export interface FramingGradeReport {
  entries: FramingGradeEntry[];
  /** Zones whose only covering camera(s) are foreshortened or edge-framed. */
  zonesNeedingAttention: string[];
}

/** Steep downward camera pitch beyond which a standing person is mostly seen from above. */
const STEEP_TOP_DOWN_PITCH_DEG = -55;
/** |normalizedPos| beyond this is considered "edge of frame". */
const EDGE_THRESHOLD = 0.6;

function polygonCentroid(polygon: CriticalZoneNode["polygon"]): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of polygon) {
    x += px;
    z += pz;
  }
  return [x / polygon.length, z / polygon.length];
}

/**
 * Computes the horizontal/vertical angle from a camera's bore-sight to a
 * world point, matching `evaluatePoint`'s projection in coverage.ts.
 */
export function projectToCameraFrame(
  camera: CameraNode,
  point: [number, number],
  targetHeightM: number,
): { hAngleDeg: number; vAngleDeg: number } {
  const origin = new THREE.Vector3(...camera.position);
  const target = new THREE.Vector3(point[0], targetHeightM, point[1]);
  const direction = target.clone().sub(origin).normalize();
  const targetYaw = THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z));
  const targetPitch = THREE.MathUtils.radToDeg(
    Math.atan2(direction.y, Math.hypot(direction.x, direction.z)),
  );
  return {
    hAngleDeg: normalizeAngle(targetYaw - camera.yawDeg),
    vAngleDeg: targetPitch - camera.pitchDeg,
  };
}

/**
 * Grades how a world point would appear in `camera`'s frame, independent of
 * range/occlusion (callers that care about visibility should check those
 * separately — e.g. `distance <= camera.rangeM`).
 */
export function gradeCameraFraming(
  camera: CameraNode,
  point: [number, number],
  targetHeightM: number,
): { grade: FramingGrade; normalizedHPos: number; normalizedVPos: number } {
  const { hAngleDeg, vAngleDeg } = projectToCameraFrame(camera, point, targetHeightM);
  const normalizedHPos = clampFrameRatio(hAngleDeg, camera.fovHorizontalDeg);
  const normalizedVPos = clampFrameRatio(vAngleDeg, camera.fovVerticalDeg);

  let grade: FramingGrade;
  if (Math.abs(normalizedHPos) > 1 || Math.abs(normalizedVPos) > 1) {
    grade = "out_of_frame";
  } else if (camera.pitchDeg <= STEEP_TOP_DOWN_PITCH_DEG) {
    grade = "foreshortened";
  } else if (Math.abs(normalizedHPos) > EDGE_THRESHOLD || Math.abs(normalizedVPos) > EDGE_THRESHOLD) {
    grade = "edge_of_frame";
  } else {
    grade = "well_framed";
  }

  return { grade, normalizedHPos, normalizedVPos };
}

/**
 * Builds a per-camera, per-critical-zone "framing grade" report for every
 * zone the simulation found at least one covering camera for. Cameras that
 * are off, or zones with no covering cameras, are skipped — this report is
 * about the quality of an existing shot, not a substitute for coverage gaps
 * (those are already surfaced by zone pass/fail status).
 */
export function buildFramingGradeReport(scene: SecurityScene, result: SimulationResult): FramingGradeReport {
  const camerasById = new Map(scene.cameras.map((camera) => [camera.id, camera] as const));
  const zonesById = new Map(scene.criticalZones.map((zone) => [zone.id, zone] as const));
  const targetHeightM = scene.assumptions.personHeightM;

  const entries: FramingGradeEntry[] = [];
  const zonesNeedingAttention = new Set<string>();

  for (const zoneResult of result.criticalZoneResults) {
    const zone = zonesById.get(zoneResult.zoneId);
    if (!zone) continue;

    const [cx, cz] = polygonCentroid(zone.polygon);
    let zoneHasWellFramedCamera = false;

    for (const cameraId of zoneResult.coveringCameras) {
      const camera = camerasById.get(cameraId);
      if (!camera || camera.status !== "on") continue;

      const { grade, normalizedHPos, normalizedVPos } = gradeCameraFraming(camera, [cx, cz], targetHeightM);

      let detail: string;
      switch (grade) {
        case "out_of_frame":
          detail = `${zone.label} falls outside ${camera.name}'s frame (covered by another camera or via redundancy).`;
          break;
        case "foreshortened":
          detail = `${camera.name} looks down at ${Math.abs(camera.pitchDeg).toFixed(0)}° — mostly a top-down view of ${zone.label}, limiting face/feature visibility despite passing pixel density.`;
          break;
        case "edge_of_frame":
          detail = `${zone.label} sits near the edge of ${camera.name}'s frame — re-aiming would center the shot and reduce lens-distortion risk.`;
          break;
        default:
          detail = `${camera.name} frames ${zone.label} centrally with a usable viewing angle.`;
          zoneHasWellFramedCamera = true;
      }

      entries.push({
        zoneId: zone.id,
        zoneLabel: zone.label,
        cameraId: camera.id,
        cameraName: camera.name,
        grade,
        normalizedHPos,
        normalizedVPos,
        detail,
      });
    }

    const hasCoveringEntries = entries.some((entry) => entry.zoneId === zone.id);
    if (hasCoveringEntries && !zoneHasWellFramedCamera) {
      zonesNeedingAttention.add(zone.id);
    }
  }

  return { entries, zonesNeedingAttention: Array.from(zonesNeedingAttention) };
}

function clampFrameRatio(angleDeg: number, fovDeg: number): number {
  return angleDeg / (fovDeg / 2);
}
