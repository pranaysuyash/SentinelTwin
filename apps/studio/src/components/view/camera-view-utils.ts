import type { DoriQuality, SecurityScene, SimulationResult } from "@/schema/security-scene";

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

export function clampReplayProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return progress;
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
