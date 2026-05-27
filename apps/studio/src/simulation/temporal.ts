/**
 * Temporal Security Simulation Engine
 *
 * Computes a 24-hour security profile by building a change timeline of state
 * transitions (light, occupancy, door state, guard patrol) and running the
 * coverage simulation only at transition points — not every 15-minute step.
 *
 * Typical scene: 10–15 transitions per day → 10–15 coverage computations instead of 96.
 *
 * Schedule resolution order:
 * 1. scene.timeSchedule — user-configured per-light, per-occupancy schedules
 * 2. DEFAULT_SCHEDULES — built-in demo schedule for scenes without timeSchedule
 */
import { simulateStudio } from "@/simulation/simulate-studio";
import { detectTemporalAnomalies } from "@/simulation/temporal-anomaly";
import {
  type HourlySecuritySnapshot,
  type SecurityScene,
  type TemporalSecurityProfile,
  type TimePeriod,
  type TimeSchedule,
  type VulnerabilityWindow,
} from "@/schema/security-scene";

const DEFAULT_SCHEDULES = {
  interiorLights: [
    { hour: 6, label: "Business Hours" },
    { hour: 18, label: "Business Hours" },
    { hour: 22, label: "Cleaning" },
    { hour: 24, label: "After Hours" },
  ],
  occupancy: [
    { hour: 7, level: "medium" as const, label: "Staff Arrival" },
    { hour: 10, level: "high" as const, label: "Peak Hours" },
    { hour: 15, level: "medium" as const, label: "Afternoon" },
    { hour: 18, level: "low" as const, label: "Closing" },
    { hour: 22, level: "empty" as const, label: "After Hours" },
  ],
  exteriorLights: [
    { hour: 6, label: "Daylight" },
    { hour: 19, label: "Night" },
    { hour: 2, label: "Deep Night" },
    { hour: 5, label: "Pre-Dawn" },
  ],
};

type SimState = "day" | "night";
type OccupancyLevel = "empty" | "low" | "medium" | "high";

type TimeSliceState = {
  hour: number;
  minute: number;
  timeOfDay: SimState;
  interiorLightsOn: boolean;
  exteriorLightsOn: boolean;
  occupancy: OccupancyLevel;
  stateLabel: string;
};

function isNight(hour: number): SimState {
  return hour < 6 || hour >= 19 ? "night" : "day";
}

function getInteriorLightStateDefault(hour: number, minute: number): { on: boolean; label: string } {
  const time = hour + minute / 60;
  if (time >= 6 && time < 18) return { on: true, label: "Business Hours" };
  if (time >= 18 && time < 22) return { on: false, label: "After Hours" };
  if (time >= 22 && time < 24) return { on: true, label: "Cleaning" };
  return { on: false, label: "After Hours" };
}

function getExteriorLightStateDefault(hour: number, minute: number): { on: boolean; label: string } {
  const time = hour + minute / 60;
  if (time >= 6 && time < 19) return { on: false, label: "Daylight" };
  if (time >= 2 && time < 5) return { on: false, label: "Timer Cutout" };
  return { on: true, label: "Night" };
}

function getOccupancyDefault(hour: number, minute: number): { level: OccupancyLevel; label: string } {
  const time = hour + minute / 60;
  if (time < 7) return { level: "empty", label: "After Hours" };
  if (time < 10) return { level: "medium", label: "Staff Arrival" };
  if (time < 15) return { level: "high", label: "Peak Hours" };
  if (time < 18) return { level: "medium", label: "Afternoon" };
  if (time < 22) return { level: "low", label: "Closing" };
  return { level: "empty", label: "After Hours" };
}

function timeInPeriod(time: number, startHour: number, endHour: number): boolean {
  if (endHour > startHour) {
    return time >= startHour && time < endHour;
  }
  return time >= startHour || time < endHour;
}

function getInteriorLightStateFromSchedule(
  hour: number,
  minute: number,
  schedule: TimeSchedule,
): { on: boolean; label: string } {
  const time = hour + minute / 60;
  for (const ls of schedule.interiorLightSchedule) {
    for (const period of ls.periods) {
      if (timeInPeriod(time, period.startHour, period.endHour)) {
        return { on: true, label: "Scheduled" };
      }
    }
  }
  return { on: false, label: "Off" };
}

function getExteriorLightStateFromSchedule(
  hour: number,
  minute: number,
  schedule: TimeSchedule,
): { on: boolean; label: string } {
  const time = hour + minute / 60;
  for (const ls of schedule.exteriorLightSchedule) {
    for (const period of ls.periods) {
      if (timeInPeriod(time, period.startHour, period.endHour)) {
        return { on: true, label: "Scheduled" };
      }
    }
  }
  return { on: false, label: "Off" };
}

function getOccupancyFromSchedule(
  hour: number,
  minute: number,
  schedule: TimeSchedule,
): { level: OccupancyLevel; label: string } {
  const time = hour + minute / 60;
  for (const op of schedule.occupancySchedule) {
    if (timeInPeriod(time, op.timeRange.startHour, op.timeRange.endHour)) {
      return { level: op.level, label: op.level };
    }
  }
  return { level: "empty", label: "Unoccupied" };
}

function hasSceneSchedule(scene: SecurityScene): boolean {
  const ts = scene.timeSchedule;
  if (!ts) return false;
  return (
    ts.interiorLightSchedule.length > 0 ||
    ts.exteriorLightSchedule.length > 0 ||
    ts.occupancySchedule.length > 0
  );
}

function computeTimeSliceState(hour: number, minute: number, scene: SecurityScene): TimeSliceState {
  const ts = scene.timeSchedule;
  const useScene = hasSceneSchedule(scene);

  const interior = useScene && ts
    ? getInteriorLightStateFromSchedule(hour, minute, ts)
    : getInteriorLightStateDefault(hour, minute);
  const exterior = useScene && ts
    ? getExteriorLightStateFromSchedule(hour, minute, ts)
    : getExteriorLightStateDefault(hour, minute);
  const occupancy = useScene && ts
    ? getOccupancyFromSchedule(hour, minute, ts)
    : getOccupancyDefault(hour, minute);

  return {
    hour,
    minute,
    timeOfDay: isNight(hour),
    interiorLightsOn: interior.on,
    exteriorLightsOn: exterior.on,
    occupancy: occupancy.level,
    stateLabel: interior.label,
  };
}

type StateTransition = {
  hour: number;
  minute: number;
  label: string;
};

function collectScheduleTransitionHours(scene: SecurityScene): number[] {
  const hours = new Set<number>();
  const ts = scene.timeSchedule;

  if (ts) {
    for (const ls of ts.interiorLightSchedule) {
      for (const period of ls.periods) {
        hours.add(period.startHour);
        hours.add(period.endHour < 24 ? period.endHour : 0);
      }
    }
    for (const ls of ts.exteriorLightSchedule) {
      for (const period of ls.periods) {
        hours.add(period.startHour);
        hours.add(period.endHour < 24 ? period.endHour : 0);
      }
    }
    for (const op of ts.occupancySchedule) {
      hours.add(op.timeRange.startHour);
      hours.add(op.timeRange.endHour < 24 ? op.timeRange.endHour : 0);
    }
  }

  for (const entry of DEFAULT_SCHEDULES.interiorLights) {
    hours.add(entry.hour < 24 ? entry.hour : 0);
  }
  for (const entry of DEFAULT_SCHEDULES.exteriorLights) {
    hours.add(entry.hour < 24 ? entry.hour : 0);
  }
  for (const entry of DEFAULT_SCHEDULES.occupancy) {
    hours.add(entry.hour < 24 ? entry.hour : 0);
  }

  hours.add(0);
  return Array.from(hours).sort((a, b) => a - b);
}

function buildChangeTimeline(scene: SecurityScene): StateTransition[] {
  const hours = collectScheduleTransitionHours(scene);
  return hours.map((h) => ({ hour: h, minute: 0, label: `Transition ${h}:00` }));
}

function patchSceneForTimeSlice(
  scene: SecurityScene,
  state: TimeSliceState,
): SecurityScene {
  const patched = structuredClone(scene);

  patched.assumptions.timeOfDay = state.timeOfDay;

  if (state.interiorLightsOn) {
    patched.assumptions.interiorLightLevel =
      state.occupancy === "high" || state.occupancy === "medium"
        ? "bright"
        : state.occupancy === "low"
          ? "normal"
          : "dim";
  } else {
    patched.assumptions.interiorLightLevel = "dark";
  }

  patched.securityLights = scene.securityLights.map((light) => {
    if (light.illuminatesNightCoverage) {
      return { ...light, status: state.exteriorLightsOn ? ("on" as const) : ("off" as const) };
    }
    return { ...light, status: state.interiorLightsOn ? ("on" as const) : ("off" as const) };
  });

  patched.cameras = scene.cameras.map((camera) => {
    if (state.timeOfDay === "night" && camera.nightMode !== "none") {
      return camera;
    }
    if (state.timeOfDay === "night" && camera.nightMode === "none") {
      return camera;
    }
    return camera;
  });

  return patched;
}

function detectVulnerabilityWindows(
  snapshots: HourlySecuritySnapshot[],
): VulnerabilityWindow[] {
  const windows: VulnerabilityWindow[] = [];
  let currentWindow: {
    startHour: number;
    startMinute: number;
    reasons: Set<string>;
    zonesFailing: Set<string>;
    adversarialAvailable: boolean;
  } | null = null;

  for (const snap of snapshots) {
    const isVulnerable =
      snap.criticalZonePassCount < snap.criticalZoneTotalCount ||
      snap.overallCoveragePct < 60;

    if (isVulnerable && !currentWindow) {
      currentWindow = {
        startHour: snap.hour,
        startMinute: snap.minute,
        reasons: new Set(snap.issues),
        zonesFailing: new Set(),
        adversarialAvailable: snap.adversarialPathExposureScore > 5,
      };
    } else if (isVulnerable && currentWindow) {
      snap.issues.forEach((issue) => currentWindow!.reasons.add(issue));
      if (snap.adversarialPathExposureScore > 5) {
        currentWindow.adversarialAvailable = true;
      }
    } else if (!isVulnerable && currentWindow) {
      const severity =
        currentWindow.reasons.size >= 3 ||
        currentWindow.adversarialAvailable
          ? ("high" as const)
          : currentWindow.reasons.size >= 2
            ? ("medium" as const)
            : ("low" as const);

      windows.push({
        startHour: currentWindow.startHour,
        startMinute: currentWindow.startMinute,
        endHour: snap.hour,
        endMinute: snap.minute,
        severity,
        reasons: Array.from(currentWindow.reasons).slice(0, 5),
        criticalZonesFailing: Array.from(currentWindow.zonesFailing),
        adversarialRouteAvailable: currentWindow.adversarialAvailable,
      });
      currentWindow = null;
    }
  }

  if (currentWindow) {
    windows.push({
      startHour: currentWindow.startHour,
      startMinute: currentWindow.startMinute,
      endHour: 24,
      endMinute: 0,
      severity: "high" as const,
      reasons: Array.from(currentWindow.reasons).slice(0, 5),
      criticalZonesFailing: Array.from(currentWindow.zonesFailing),
      adversarialRouteAvailable: currentWindow.adversarialAvailable,
    });
  }

  return windows;
}

function findSafestPeriods(snapshots: HourlySecuritySnapshot[]): TimePeriod[] {
  const periods: TimePeriod[] = [];
  let currentStart: { hour: number; minute: number } | null = null;

  for (const snap of snapshots) {
    const isSafe =
      snap.criticalZonePassCount === snap.criticalZoneTotalCount &&
      snap.overallCoveragePct >= 80;

    if (isSafe && !currentStart) {
      currentStart = { hour: snap.hour, minute: snap.minute };
    } else if (!isSafe && currentStart) {
      periods.push({
        startHour: currentStart.hour,
        endHour: snap.hour,
        daysOfWeek: undefined,
      });
      currentStart = null;
    }
  }

  if (currentStart) {
    periods.push({ startHour: currentStart.hour, endHour: 24, daysOfWeek: undefined });
  }

  return periods;
}

export function computeTemporalProfile(scene: SecurityScene): TemporalSecurityProfile {
  const resolutionMinutes = 15;
  const hourlySnapshots: HourlySecuritySnapshot[] = [];

  const transitions = buildChangeTimeline(scene);
  const transitionKeys = new Set(transitions.map((t) => `${t.hour}:${t.minute}`));

  for (const transition of transitions) {
    const state = computeTimeSliceState(transition.hour, transition.minute, scene);

    const patchedScene = patchSceneForTimeSlice(scene, state);
    const result = simulateStudio(patchedScene);

    hourlySnapshots.push({
      hour: state.hour,
      minute: state.minute,
      overallCoveragePct: result.totalCoveragePct,
      criticalZonePassCount: result.criticalZoneResults.filter((z) => z.status === "pass").length,
      criticalZoneTotalCount: result.criticalZoneResults.length,
      criticalZoneStatuses: Object.fromEntries(
        result.criticalZoneResults.map((zone) => [zone.label, zone.status]),
      ),
      activeCameraCount: result.cameraResults.length,
      activeLightCount: patchedScene.securityLights.filter((l) => l.status === "on").length,
      adversarialPathExposureScore: result.adversarialPath?.totalExposureScore ?? 0,
      issues: result.issues.map((i) => i.description),
      stateLabel: state.stateLabel,
    });
  }

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += resolutionMinutes) {
      if (transitionKeys.has(`${h}:${m}`)) continue;

      const state = computeTimeSliceState(h, m, scene);

      const nearestSnapshot = hourlySnapshots.find(
        (snap) => snap.stateLabel === state.stateLabel,
      ) ?? hourlySnapshots[hourlySnapshots.length - 1];

      if (nearestSnapshot) {
        hourlySnapshots.push({
          hour: h,
          minute: m,
          overallCoveragePct: nearestSnapshot.overallCoveragePct,
          criticalZonePassCount: nearestSnapshot.criticalZonePassCount,
          criticalZoneTotalCount: nearestSnapshot.criticalZoneTotalCount,
          criticalZoneStatuses: nearestSnapshot.criticalZoneStatuses,
          activeCameraCount: nearestSnapshot.activeCameraCount,
          activeLightCount: nearestSnapshot.activeLightCount,
          adversarialPathExposureScore: nearestSnapshot.adversarialPathExposureScore,
          issues: nearestSnapshot.issues,
          stateLabel: state.stateLabel,
        });
      }
    }
  }

  hourlySnapshots.sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  });

  const criticalZoneCoverageByHour: Record<string, number[]> = {};
  const evaluatedZoneLabels = scene.criticalZones.map((z) => z.label);
  for (const zoneLabel of evaluatedZoneLabels) {
    criticalZoneCoverageByHour[zoneLabel] = hourlySnapshots.map(
      (snap) => {
        const status = snap.criticalZoneStatuses[zoneLabel] ?? "fail";
        return status === "pass" ? 100 : status === "partial" ? 50 : 0;
      },
    );
  }

  const peakVulnerabilityWindows = detectVulnerabilityWindows(hourlySnapshots);
  const safestPeriods = findSafestPeriods(hourlySnapshots);
  const anomalyAnalysis = detectTemporalAnomalies({
    hoursAnalyzed: 24,
    resolutionMinutes,
    hourlySnapshots,
    peakVulnerabilityWindows,
    safestPeriods,
    criticalZoneCoverageByHour,
    computedAt: Date.now(),
    anomalyWindows: [],
  });

  return {
    hoursAnalyzed: 24,
    resolutionMinutes,
    hourlySnapshots,
    peakVulnerabilityWindows,
    safestPeriods,
    criticalZoneCoverageByHour,
    anomalyWindows: anomalyAnalysis.windows,
    anomalySummary: anomalyAnalysis.summary,
    computedAt: Date.now(),
  };
}

export function computeTimeSliceStateForHour(hour: number, minute = 0): TimeSliceState {
  return computeTimeSliceState(hour, minute, {} as SecurityScene);
}
