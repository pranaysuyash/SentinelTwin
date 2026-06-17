import type { CameraNode } from "@/schema/security-scene";

/**
 * "Camera Drift" — compares the current scene's camera poses against a
 * baseline snapshot's cameras and flags geometric/status changes since that
 * baseline was captured.
 *
 * This is the design-time half of "live coverage drift detection"
 * (EXPLORATION_MAP.md §A1): a re-aimed, moved, or disabled camera is exactly
 * the kind of change that silently invalidates a previously-verified coverage
 * result. The live-feed half (comparing against real camera telemetry) is a
 * separate, larger architectural slice — this module only diffs scene state
 * the engine already has, the same baseline snapshot Coverage CI (D-306)
 * uses. No new schema, no new evidence types.
 */

export type DriftSeverity = "minor" | "major";

export interface CameraDriftEntry {
  cameraId: string;
  cameraName: string;
  kind: "moved" | "reaimed" | "status_changed" | "fov_changed" | "added" | "removed";
  severity: DriftSeverity;
  detail: string;
}

export interface CameraDriftReport {
  hasBaseline: boolean;
  baselineLabel: string | null;
  baselineTimestamp: number | null;
  entries: CameraDriftEntry[];
}

const POSITION_MINOR_M = 0.1;
const POSITION_MAJOR_M = 0.5;
const ANGLE_MINOR_DEG = 2;
const ANGLE_MAJOR_DEG = 10;
const FOV_MINOR_PCT = 5;
const FOV_MAJOR_PCT = 20;

function distance(a: CameraNode["position"], b: CameraNode["position"]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function angleDelta(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function pctChange(current: number, baseline: number): number {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return ((current - baseline) / baseline) * 100;
}

const DEGRADED_STATUSES = new Set<CameraNode["status"]>(["off", "blocked", "dirty", "malfunctioning"]);

/**
 * Builds a Camera Drift report comparing `currentCameras` against
 * `baselineCameras`. If `baselineCameras` is null (no prior simulated
 * snapshot exists), returns an empty-but-honest report with
 * `hasBaseline: false` and no entries.
 */
export function buildCameraDriftReport(
  currentCameras: CameraNode[],
  baselineCameras: CameraNode[] | null,
  baselineMeta: { label: string; timestamp: number } | null,
): CameraDriftReport {
  if (!baselineCameras) {
    return { hasBaseline: false, baselineLabel: null, baselineTimestamp: null, entries: [] };
  }

  const entries: CameraDriftEntry[] = [];
  const baselineById = new Map(baselineCameras.map((camera) => [camera.id, camera] as const));
  const currentById = new Map(currentCameras.map((camera) => [camera.id, camera] as const));

  for (const current of currentCameras) {
    const baseline = baselineById.get(current.id);
    if (!baseline) {
      entries.push({
        cameraId: current.id,
        cameraName: current.name,
        kind: "added",
        severity: "minor",
        detail: "Added since baseline",
      });
      continue;
    }

    const posDelta = distance(current.position, baseline.position);
    if (posDelta >= POSITION_MINOR_M) {
      entries.push({
        cameraId: current.id,
        cameraName: current.name,
        kind: "moved",
        severity: posDelta >= POSITION_MAJOR_M ? "major" : "minor",
        detail: `Moved ${posDelta.toFixed(2)} m from baseline position`,
      });
    }

    const yawDelta = angleDelta(current.yawDeg, baseline.yawDeg);
    const pitchDelta = angleDelta(current.pitchDeg, baseline.pitchDeg);
    const maxAngleDelta = Math.max(yawDelta, pitchDelta);
    if (maxAngleDelta >= ANGLE_MINOR_DEG) {
      entries.push({
        cameraId: current.id,
        cameraName: current.name,
        kind: "reaimed",
        severity: maxAngleDelta >= ANGLE_MAJOR_DEG ? "major" : "minor",
        detail: `Re-aimed ${maxAngleDelta.toFixed(1)}° from baseline (yaw Δ${yawDelta.toFixed(1)}°, pitch Δ${pitchDelta.toFixed(1)}°)`,
      });
    }

    if (current.status !== baseline.status) {
      const newlyDegraded = DEGRADED_STATUSES.has(current.status) && !DEGRADED_STATUSES.has(baseline.status);
      entries.push({
        cameraId: current.id,
        cameraName: current.name,
        kind: "status_changed",
        severity: newlyDegraded ? "major" : "minor",
        detail: `Status changed: ${baseline.status} → ${current.status}`,
      });
    }

    const fovDelta = Math.max(
      Math.abs(pctChange(current.fovHorizontalDeg, baseline.fovHorizontalDeg)),
      Math.abs(pctChange(current.rangeM, baseline.rangeM)),
    );
    if (fovDelta >= FOV_MINOR_PCT) {
      entries.push({
        cameraId: current.id,
        cameraName: current.name,
        kind: "fov_changed",
        severity: fovDelta >= FOV_MAJOR_PCT ? "major" : "minor",
        detail: `Field of view / range changed ${fovDelta.toFixed(0)}% from baseline`,
      });
    }
  }

  for (const baseline of baselineCameras) {
    if (!currentById.has(baseline.id)) {
      entries.push({
        cameraId: baseline.id,
        cameraName: baseline.name,
        kind: "removed",
        severity: "major",
        detail: "Removed since baseline",
      });
    }
  }

  return {
    hasBaseline: true,
    baselineLabel: baselineMeta?.label ?? null,
    baselineTimestamp: baselineMeta?.timestamp ?? null,
    entries,
  };
}
