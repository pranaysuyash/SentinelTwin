import type { CameraNode, DoriQuality, SecurityScene, SimulationResult } from "@/schema/security-scene";

export type CameraReplayPose = {
  yawDeg: number;
  pitchDeg: number;
};

export function formatCameraTag(name: string) {
  const match = name.match(/(\d+)/);
  return `CAM ${match ? match[0] : "01"}`;
}

export function formatTargetTypeLabel(targetType: SecurityScene["criticalZones"][number]["targetType"]) {
  switch (targetType) {
    case "person_detection":
      return "Person";
    case "face_recognition":
    case "face_identification":
      return "Face";
    case "vehicle_detection":
      return "Vehicle";
    case "license_plate":
      return "License Plate";
    case "package_detection":
      return "Package";
    case "cash_counter_activity":
      return "Cash Counter";
    case "door_entry_exit":
      return "Entry / Exit";
    case "perimeter_breach":
      return "Perimeter";
    default:
      return `${targetType}`.replace(/_/g, " ");
  }
}

export type CameraReplayState = {
  visible: boolean;
  quality?: DoriQuality;
  reason?: string;
};

type CameraTimelineEvent = SimulationResult["pathResults"][number]["timeline"][number];

const DEFAULT_PTZ_SPEED_DEG_PER_S = 30;
const SWEEP_AMPLITUDE_YAW_DEG = 45;
const SWEEP_AMPLITUDE_PITCH_DEG = 30;
const SWEEP_PRESET_PERIOD_S = 8;

function normalizeYaw(yawDeg: number) {
  let normalized = yawDeg % 360;
  if (normalized <= -180) normalized += 360;
  if (normalized > 180) normalized -= 360;
  return normalized;
}

function angleDifferenceDeg(fromDeg: number, toDeg: number) {
  const diff = normalizeYaw(toDeg - fromDeg);
  return diff;
}

function lerpAngleDeg(fromDeg: number, toDeg: number, t: number) {
  return normalizeYaw(fromDeg + angleDifferenceDeg(fromDeg, toDeg) * t);
}

function numericLerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function safeSeconds(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function sampleReplayPoseFromWaypoints(
  viewMotion: CameraNode["viewMotion"],
  pathTimeS: number,
  baseYawDeg: number,
  basePitchDeg: number,
) {
  const waypoints = viewMotion.waypoints ?? [];
  if (waypoints.length < 2) {
    return { yawDeg: normalizeYaw(baseYawDeg), pitchDeg: basePitchDeg };
  }

  const safeMotionSpeedDegPerS = safeSeconds(viewMotion.patrolSpeedDegPerS ?? DEFAULT_PTZ_SPEED_DEG_PER_S);
  const segmentSpeed = safeMotionSpeedDegPerS > 0 ? safeMotionSpeedDegPerS : DEFAULT_PTZ_SPEED_DEG_PER_S;

  const segmentTable = waypoints.map((currentWaypoint, index) => {
    const nextWaypoint = waypoints[(index + 1) % waypoints.length];
    const holdSeconds = safeSeconds(currentWaypoint.holdSeconds ?? viewMotion.dwellSeconds);
    const yawDelta = Math.abs(angleDifferenceDeg(currentWaypoint.yawDeg, nextWaypoint.yawDeg));
    const pitchDelta = Math.abs(nextWaypoint.pitchDeg - currentWaypoint.pitchDeg);
    const transitionSeconds = Math.max(0.01, Math.max(yawDelta, pitchDelta) / segmentSpeed);
    return {
      holdSeconds,
      transitionSeconds,
      totalSeconds: holdSeconds + transitionSeconds,
      nextYawDeg: normalizeYaw(nextWaypoint.yawDeg),
      nextPitchDeg: nextWaypoint.pitchDeg,
    };
  });
  const totalDuration = segmentTable.reduce((acc, entry) => acc + entry.totalSeconds, 0);
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return { yawDeg: normalizeYaw(baseYawDeg), pitchDeg: basePitchDeg };
  }

  let remaining = totalDuration <= 0 ? 0 : safeSeconds(pathTimeS) % totalDuration;
  const lastIndex = waypoints.length - 1;
  for (let index = 0; index < waypoints.length; index += 1) {
    const segment = segmentTable[index];
    const waypoint = waypoints[index]!;

    if (remaining <= segment.holdSeconds) {
      return {
        yawDeg: normalizeYaw(waypoint.yawDeg),
        pitchDeg: waypoint.pitchDeg,
      };
    }

    remaining -= segment.holdSeconds;
    if (remaining <= segment.transitionSeconds) {
      const transitionT = segment.transitionSeconds > 0
        ? Math.max(0, Math.min(1, remaining / segment.transitionSeconds))
        : 0;
      const nextIndex = index === lastIndex ? 0 : index + 1;
      const nextWaypoint = waypoints[nextIndex]!;
      return {
        yawDeg: lerpAngleDeg(waypoint.yawDeg, nextWaypoint.yawDeg, transitionT),
        pitchDeg: numericLerp(waypoint.pitchDeg, nextWaypoint.pitchDeg, transitionT),
      };
    }

    remaining -= segment.transitionSeconds;
  }

  const finalWaypoint = waypoints[lastIndex]!;
  return {
    yawDeg: normalizeYaw(finalWaypoint.yawDeg),
    pitchDeg: finalWaypoint.pitchDeg,
  };
}

function sampleSweepPose(
  pathTimeS: number,
  baseYawDeg: number,
  basePitchDeg: number,
  isHorizontal: boolean,
) {
  const safeTime = safeSeconds(pathTimeS);
  const phase = (safeTime % SWEEP_PRESET_PERIOD_S) / SWEEP_PRESET_PERIOD_S;
  const sweep = Math.sin(phase * Math.PI * 2);
  return {
    yawDeg: normalizeYaw(baseYawDeg + (isHorizontal ? SWEEP_AMPLITUDE_YAW_DEG : 0) * sweep),
    pitchDeg: basePitchDeg + (isHorizontal ? 0 : SWEEP_AMPLITUDE_PITCH_DEG * sweep),
  };
}

function sampleCameraReplayPoseFromMotion(
  camera: Pick<CameraNode, "yawDeg" | "pitchDeg" | "viewMotion">,
  pathTimeS: number,
) {
  const movement = camera.viewMotion;
  if (!movement) {
    return {
      yawDeg: normalizeYaw(camera.yawDeg),
      pitchDeg: camera.pitchDeg,
    };
  }

  const movementMode = movement.movementMode;
  const baseYaw = normalizeYaw(camera.yawDeg);
  const basePitch = camera.pitchDeg;

  if (movementMode === "fixed") {
    return {
      yawDeg: baseYaw,
      pitchDeg: basePitch,
    };
  }

  if ((movementMode === "sweep_h" || movementMode === "sweep_v" || movementMode === "preset_cycle" || movementMode === "tracking")
    && movement.waypoints
    && movement.waypoints.length >= 2) {
    return sampleReplayPoseFromWaypoints(movement, pathTimeS, baseYaw, basePitch);
  }

  if (movementMode === "sweep_h") {
    return sampleSweepPose(pathTimeS, baseYaw, basePitch, true);
  }

  if (movementMode === "sweep_v") {
    return sampleSweepPose(pathTimeS, baseYaw, basePitch, false);
  }

  if (movementMode === "tracking") {
    return {
      ...sampleSweepPose(pathTimeS, baseYaw, basePitch, true),
      pitchDeg: basePitch,
    };
  }

  if (movementMode === "preset_cycle") {
    return sampleSweepPose(pathTimeS, baseYaw, basePitch, true);
  }

  return {
    yawDeg: baseYaw,
    pitchDeg: basePitch,
  };
}

export function sampleCameraReplayPose(
  camera: Pick<CameraNode, "yawDeg" | "pitchDeg" | "viewMotion">,
  pathTimeS: number,
): CameraReplayPose {
  return sampleCameraReplayPoseFromMotion(camera, safeSeconds(pathTimeS));
}

export function clampReplayProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return progress;
}

export function getPathReplayDurationS(
  path:
    | {
        points?: Array<{ position: [number, number] }>;
        speedMps?: number | null | undefined;
      }
    | null
    | undefined,
) {
  if (!path || path.points == null || path.points.length < 2) return 0;

  let distanceM = 0;
  for (let index = 1; index < path.points.length; index += 1) {
    const current = path.points[index]?.position;
    const previous = path.points[index - 1]?.position;
    if (!current || !previous) continue;
    const [x0, z0] = previous;
    const [x1, z1] = current;
    if (!Number.isFinite(x0) || !Number.isFinite(z0) || !Number.isFinite(x1) || !Number.isFinite(z1)) {
      continue;
    }
    distanceM += Math.hypot(x1 - x0, z1 - z0);
  }

  const speedMps = Number.isFinite(path.speedMps ?? NaN) ? path.speedMps ?? 1.2 : 1.2;
  return distanceM / Math.max(speedMps ?? 1.2, 0.01);
}

export function clampPathDuration(durationS: number | null | undefined) {
  if (!Number.isFinite(durationS ?? NaN)) return 0;
  return durationS! <= 0 ? 0 : durationS!;
}

export function orderCamerasForReplayPlayback(
  cameras: ReadonlyArray<{ id: string; name: string; status: "on" | "off" | "unknown" }>,
  selectedCameraId?: string | null,
  activeCameraId?: string | null,
) {
  const active = selectedCameraId || activeCameraId || null;
  return [...cameras].sort((a, b) => {
    if (active) {
      if (a.id === active) return -1;
      if (b.id === active) return 1;
    }
    if (a.status === "on" && b.status !== "on") return -1;
    if (a.status !== "on" && b.status === "on") return 1;
    return a.name.localeCompare(b.name);
  });
}

export function sortTimelineEvents(timeline: CameraTimelineEvent[] | undefined) {
  if (!Array.isArray(timeline) || timeline.length === 0) return [];
  return [...timeline].sort((a, b) => {
    const byTime = a.timeS - b.timeS;
    if (byTime !== 0) return byTime;
    if (!a.cameraId || !b.cameraId) return 0;
    return a.cameraId.localeCompare(b.cameraId);
  });
}

export function findLatestTimelineEventAtOrBeforeTime(
  timeline: CameraTimelineEvent[] | undefined,
  pathTimeS: number,
) {
  const safePathTime = clampPathDuration(pathTimeS);
  const events = sortTimelineEvents(timeline);
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.timeS <= safePathTime) {
      return event;
    }
  }
  return null;
}

export function findNextTimelineEventAfterTime(
  timeline: CameraTimelineEvent[] | undefined,
  pathTimeS: number,
) {
  const safePathTime = clampPathDuration(pathTimeS);
  const events = sortTimelineEvents(timeline);
  for (const event of events) {
    if (event.timeS > safePathTime) {
      return event;
    }
  }
  return null;
}

export function findLatestTimelineEventForCameraAtTime(
  timeline: CameraTimelineEvent[] | undefined,
  pathTimeS: number,
  cameraId: string,
): CameraTimelineEvent | null {
  const safePathTime = clampPathDuration(pathTimeS);
  const events = sortTimelineEvents(timeline);
  let latestEvent: CameraTimelineEvent | null = null;
  for (const event of events) {
    if (event.timeS > safePathTime) break;
    if (!event.cameraId || event.cameraId === cameraId) {
      latestEvent = event;
    }
  }
  return latestEvent;
}

export function buildReplayStateByCameraAtTime(
  timeline: CameraTimelineEvent[] | undefined,
  pathTimeS: number,
): Record<string, CameraReplayState> {
  if (!Array.isArray(timeline) || timeline.length === 0) return {};

  const ordered = sortTimelineEvents(timeline);
  const safePathTime = clampPathDuration(pathTimeS);
  const stateByCamera = new Map<string, CameraReplayState>();

  for (const event of ordered) {
    if (!event.cameraId || !Number.isFinite(event.timeS) || event.timeS > safePathTime) continue;
    const prev = stateByCamera.get(event.cameraId);
    if (event.event === "visible") {
      stateByCamera.set(event.cameraId, {
        visible: true,
        quality: event.quality,
        reason: event.reason,
      });
      continue;
    }
    if (event.event === "lost") {
      stateByCamera.set(event.cameraId, {
        visible: false,
        quality: event.quality,
        reason: event.reason,
      });
      continue;
    }
    stateByCamera.set(event.cameraId, {
      visible: prev?.visible ?? true,
      quality: event.quality ?? prev?.quality,
      reason: event.reason ?? prev?.reason,
    });
  }

  return Object.fromEntries(Array.from(stateByCamera.entries()));
}
