import { describe, expect, test } from "bun:test";

import {
  buildReplayStateByCameraAtTime,
  clampPathDuration,
  clampReplayProgress,
  findLatestTimelineEventForCameraAtTime,
  findLatestTimelineEventAtOrBeforeTime,
  findNextTimelineEventAfterTime,
  orderCamerasForReplayPlayback,
  sortTimelineEvents,
} from "@/components/view/camera-view-utils";

function camEvent(overrides: {
  timeS: number;
  event: "visible" | "lost" | "quality_change";
  cameraId?: string;
  quality?: "none" | "low" | "medium" | "high" | "verified";
  reason?: string;
}) {
  return {
    timeS: overrides.timeS,
    event: overrides.event,
    cameraId: overrides.cameraId,
    quality: overrides.quality,
    reason: overrides.reason,
  };
}

describe("camera-view-utils", () => {
  test("orders replay cameras deterministically", () => {
    const input = [
      { id: "c1", name: "Zeta", status: "off" as const },
      { id: "c2", name: "Alpha", status: "on" as const },
      { id: "c3", name: "Beta", status: "on" as const },
      { id: "c4", name: "Gamma", status: "off" as const },
    ];

    const ordered = orderCamerasForReplayPlayback(input, "c4", "c1");
    expect(ordered.map((camera) => camera.id)).toEqual(["c4", "c2", "c3", "c1"]);
  });

  test("clamps replay progress and durations", () => {
    expect(clampReplayProgress(-0.2)).toBe(0);
    expect(clampReplayProgress(0.47)).toBe(0.47);
    expect(clampReplayProgress(1.2)).toBe(1);
    expect(clampReplayProgress(NaN)).toBe(0);

    expect(clampPathDuration(-1)).toBe(0);
    expect(clampPathDuration(9.5)).toBe(9.5);
    expect(clampPathDuration(0)).toBe(0);
    expect(clampPathDuration(null)).toBe(0);
  });

  test("sorts timeline events by time then camera id", () => {
    const sorted = sortTimelineEvents([
      camEvent({ timeS: 3, event: "lost", cameraId: "c-b" }),
      camEvent({ timeS: 1, event: "visible", cameraId: "c-a" }),
      camEvent({ timeS: 1, event: "visible", cameraId: "c-0" }),
      camEvent({ timeS: 2, event: "visible", cameraId: "c-c" }),
    ]);

    expect(sorted.map((event) => `${event.timeS}-${event.cameraId}`)).toEqual([
      "1-c-0",
      "1-c-a",
      "2-c-c",
      "3-c-b",
    ]);
  });

  test("finds the latest timeline event for a camera at time", () => {
    const timeline = [
      camEvent({ timeS: 3, event: "lost", cameraId: "cam-2", reason: "lost late" }),
      camEvent({ timeS: 1, event: "visible", cameraId: "cam-1", quality: "low" }),
      camEvent({ timeS: 2, event: "quality_change", cameraId: "cam-1", quality: "medium" }),
      camEvent({ timeS: 4, event: "visible", reason: "future" }),
      camEvent({ timeS: 2, event: "visible", cameraId: "cam-2", quality: "high" }),
    ];

    expect(findLatestTimelineEventForCameraAtTime(timeline, 1.5, "cam-1")?.reason).toBeUndefined();
    expect(findLatestTimelineEventForCameraAtTime(timeline, 2.1, "cam-1")?.quality).toBe("medium");
    expect(findLatestTimelineEventForCameraAtTime(timeline, 2.1, "cam-2")?.cameraId).toBe("cam-2");
    expect(findLatestTimelineEventForCameraAtTime(timeline, 2.1, "cam-2")?.quality).toBe("high");
  });

  test("finds the latest timeline event at or before a given time", () => {
    const timeline = [
      camEvent({ timeS: 1, event: "visible", cameraId: "cam-1", quality: "low" }),
      camEvent({ timeS: 3, event: "visible", cameraId: "cam-1", quality: "medium" }),
      camEvent({ timeS: 5, event: "visible", cameraId: "cam-1", quality: "high" }),
    ];

    expect(findLatestTimelineEventAtOrBeforeTime(timeline, 0)).toBeNull();
    expect(findLatestTimelineEventAtOrBeforeTime(timeline, 1)?.quality).toBe("low");
    expect(findLatestTimelineEventAtOrBeforeTime(timeline, 4)?.quality).toBe("medium");
    expect(findLatestTimelineEventAtOrBeforeTime(timeline, 5)?.quality).toBe("high");
    expect(findLatestTimelineEventAtOrBeforeTime(timeline, 6)?.quality).toBe("high");
  });

  test("finds the next timeline event after a given time", () => {
    const timeline = [
      camEvent({ timeS: 1, event: "visible", cameraId: "cam-1", quality: "low" }),
      camEvent({ timeS: 3, event: "visible", cameraId: "cam-1", quality: "medium" }),
      camEvent({ timeS: 5, event: "visible", cameraId: "cam-1", quality: "high" }),
    ];

    expect(findNextTimelineEventAfterTime(timeline, 0)?.timeS).toBe(1);
    expect(findNextTimelineEventAfterTime(timeline, 1)?.timeS).toBe(3);
    expect(findNextTimelineEventAfterTime(timeline, 4)?.timeS).toBe(5);
    expect(findNextTimelineEventAfterTime(timeline, 5)).toBeNull();
  });

  test("builds replay state by camera at time", () => {
    const timeline = [
      camEvent({ timeS: 4, event: "quality_change", cameraId: "cam-2", quality: "high", reason: "clear" }),
      camEvent({ timeS: 1, event: "visible", cameraId: "cam-2", quality: "low", reason: "start" }),
      camEvent({ timeS: 3, event: "lost", cameraId: "cam-2", quality: "none", reason: "occluded" }),
      camEvent({ timeS: 2, event: "visible", cameraId: "cam-1", quality: "medium", reason: "start-1" }),
      camEvent({ timeS: 3.2, event: "quality_change", cameraId: "cam-1", quality: "high", reason: "closer" }),
      camEvent({ timeS: 5, event: "visible", cameraId: "cam-1", quality: "high", reason: "future" }),
    ];

    expect(buildReplayStateByCameraAtTime(timeline, 3.2)).toEqual({
      "cam-2": {
        visible: false,
        quality: "none",
        reason: "occluded",
      },
      "cam-1": {
        visible: true,
        quality: "high",
        reason: "closer",
      },
    });
  });
});
