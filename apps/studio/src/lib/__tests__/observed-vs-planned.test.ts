import { describe, expect, test } from "bun:test";
import { buildObservedVsPlannedReport } from "../observed-vs-planned";
import type { CameraDriftReport } from "../camera-drift";
import type { LiveOperationalHealthSummary } from "../security-analytics";

const emptyLiveHealth: LiveOperationalHealthSummary = {
  trackedSensors: 0,
  trackedCameras: 0,
  faultedSensors: 0,
  degradedCameras: 0,
  alerts: [],
};

const emptyDrift: CameraDriftReport = {
  hasBaseline: true,
  baselineLabel: "Baseline v1",
  baselineTimestamp: 1700000000000,
  entries: [],
};

describe("buildObservedVsPlannedReport", () => {
  test("hasData is false when no drift entries, no alerts, no tracked nodes", () => {
    const report = buildObservedVsPlannedReport(emptyDrift, emptyLiveHealth);
    expect(report.hasData).toBe(false);
  });

  test("hasData is true when drift entries exist", () => {
    const drift: CameraDriftReport = {
      ...emptyDrift,
      entries: [
        { cameraId: "cam1", cameraName: "Lobby Cam", kind: "moved", severity: "minor", detail: "moved 0.2m" },
      ],
    };
    const report = buildObservedVsPlannedReport(drift, emptyLiveHealth);
    expect(report.hasData).toBe(true);
  });

  test("hasData is true when live alerts exist", () => {
    const liveHealth: LiveOperationalHealthSummary = {
      ...emptyLiveHealth,
      alerts: [
        { nodeId: "s1", kind: "sensor", label: "Door Sensor", status: "fault", lastEventTitle: "Offline", lastEventTimestamp: 1700000001000 },
      ],
    };
    const report = buildObservedVsPlannedReport(null, liveHealth);
    expect(report.hasData).toBe(true);
  });

  test("hasData is true when tracked nodes exist (even with no issues)", () => {
    const liveHealth: LiveOperationalHealthSummary = {
      ...emptyLiveHealth,
      trackedSensors: 3,
      trackedCameras: 2,
    };
    const report = buildObservedVsPlannedReport(null, liveHealth);
    expect(report.hasData).toBe(true);
  });

  test("null drift report produces empty driftEntries and null baselineLabel", () => {
    const report = buildObservedVsPlannedReport(null, emptyLiveHealth);
    expect(report.driftEntries).toEqual([]);
    expect(report.baselineLabel).toBeNull();
  });

  test("baselineLabel is forwarded from drift report", () => {
    const report = buildObservedVsPlannedReport(emptyDrift, emptyLiveHealth);
    expect(report.baselineLabel).toBe("Baseline v1");
  });

  test("statusLabel is 'On plan' when totalIssues is zero", () => {
    const report = buildObservedVsPlannedReport(emptyDrift, emptyLiveHealth);
    expect(report.summary.statusLabel).toBe("On plan");
    expect(report.summary.totalIssues).toBe(0);
  });

  test("statusLabel is 'Minor deviations' for minor drift only", () => {
    const drift: CameraDriftReport = {
      ...emptyDrift,
      entries: [
        { cameraId: "cam1", cameraName: "Entry Cam", kind: "reaimed", severity: "minor", detail: "3° rotation" },
      ],
    };
    const report = buildObservedVsPlannedReport(drift, emptyLiveHealth);
    expect(report.summary.statusLabel).toBe("Minor deviations");
    expect(report.summary.majorDriftCount).toBe(0);
  });

  test("statusLabel is 'Critical deviation' when major drift exists", () => {
    const drift: CameraDriftReport = {
      ...emptyDrift,
      entries: [
        { cameraId: "cam1", cameraName: "Entry Cam", kind: "moved", severity: "major", detail: "moved 0.8m" },
      ],
    };
    const report = buildObservedVsPlannedReport(drift, emptyLiveHealth);
    expect(report.summary.statusLabel).toBe("Critical deviation");
    expect(report.summary.majorDriftCount).toBe(1);
  });

  test("statusLabel is 'Critical deviation' when sensor fault exists", () => {
    const liveHealth: LiveOperationalHealthSummary = {
      ...emptyLiveHealth,
      faultedSensors: 1,
      alerts: [
        { nodeId: "s1", kind: "sensor", label: "Motion", status: "fault", lastEventTitle: "Power loss", lastEventTimestamp: 1700000002000 },
      ],
    };
    const report = buildObservedVsPlannedReport(null, liveHealth);
    expect(report.summary.statusLabel).toBe("Critical deviation");
  });

  test("totalIssues counts drift entries plus live alerts", () => {
    const drift: CameraDriftReport = {
      ...emptyDrift,
      entries: [
        { cameraId: "cam1", cameraName: "Cam A", kind: "fov_changed", severity: "minor", detail: "FOV widened" },
        { cameraId: "cam2", cameraName: "Cam B", kind: "status_changed", severity: "major", detail: "disabled" },
      ],
    };
    const liveHealth: LiveOperationalHealthSummary = {
      ...emptyLiveHealth,
      alerts: [
        { nodeId: "c1", kind: "camera", label: "Cam C", status: "degraded", lastEventTitle: "Signal weak", lastEventTimestamp: 1700000003000 },
      ],
    };
    const report = buildObservedVsPlannedReport(drift, liveHealth);
    expect(report.summary.driftCount).toBe(2);
    expect(report.summary.totalIssues).toBe(3);
  });

  test("trackedSensors and trackedCameras are forwarded from liveHealth", () => {
    const liveHealth: LiveOperationalHealthSummary = {
      ...emptyLiveHealth,
      trackedSensors: 5,
      trackedCameras: 8,
    };
    const report = buildObservedVsPlannedReport(null, liveHealth);
    expect(report.trackedSensors).toBe(5);
    expect(report.trackedCameras).toBe(8);
  });
});
