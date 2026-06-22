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
import { simulateStudio } from "./simulate-studio";
import { detectTemporalAnomalies } from "./temporal-anomaly";
import { cloneSecuritySceneSimulation } from "@sentineltwin/core";
import { getExteriorLightStateSeasonal } from "./seasonal-lighting";
import {
  type HourlySecuritySnapshot,
  type SecurityScene,
  type TemporalSecurityProfile,
  type TimePeriod,
  type TimeSchedule,
  type VulnerabilityWindow,
} from "@sentineltwin/core";

/**
 * Vulnerability detection thresholds for the temporal analysis.
 *
 * COVERAGE_SAFETY_THRESHOLD (60%) — A snapshot is flagged as vulnerable
 * when overall coverage falls below this percentage. Derived from common
 * physical security standards (IEC 62676-4 recommends ≥60% for basic
 * operational monitoring). Below this threshold, meaningful portions of
 * the scene are not observable, creating exploitable gaps.
 *
 * ADVERSARIAL_EXPOSURE_WARNING (5) — An adversarial path exposure score
 * above this threshold indicates a route with low detection probability
 * exists. The score aggregates distance + exposure penalties along the
 * path; values >5 correspond roughly to a >3-second continuous transit
 * through sub-detection-quality zones in a typical small-retail scene.
 */
const COVERAGE_SAFETY_THRESHOLD = 60;
const ADVERSARIAL_EXPOSURE_WARNING = 5;

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

export type TimeSliceState = {
  hour: number;
  minute: number;
  timeOfDay: SimState;
  interiorLightsOn: boolean;
  exteriorLightsOn: boolean;
  occupancy: OccupancyLevel;
  stateLabel: string;
  doorStates?: Record<string, "closed" | "locked">;
  guardPatrolActive: boolean;
  activeGuardCount: number;
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

/**
 * Determine how many guards are actively on patrol at a given time.
 *
 * A patrol round starts at firstPatrolHour then repeats every intervalMinutes.
 * A guard is "active" when the current time falls within any round's
 * [roundStart, roundStart + durationMinutes) window.
 */
function getActiveGuardCount(hour: number, minute: number, scene?: SecurityScene): number {
  const patrols = scene?.timeSchedule?.guardPatrolSchedule;
  if (!patrols || patrols.length === 0) return 0;

  const currentMinutes = hour * 60 + minute;
  let count = 0;

  for (const patrol of patrols) {
    const dayMinutes = 24 * 60;
    const firstStartMinutes = patrol.firstPatrolHour * 60;

    // Walk through every round in the 24h window
    for (
      let roundStart = firstStartMinutes;
      roundStart < firstStartMinutes + dayMinutes;
      roundStart += patrol.intervalMinutes
    ) {
      const roundStartWrapped = roundStart % dayMinutes;
      const roundEnd = roundStartWrapped + patrol.durationMinutes;

      const inRound =
        roundEnd <= dayMinutes
          ? currentMinutes >= roundStartWrapped && currentMinutes < roundEnd
          : currentMinutes >= roundStartWrapped || currentMinutes < roundEnd % dayMinutes;

      if (inRound) {
        count++;
        break; // This guard is active — no need to check remaining rounds
      }
    }
  }

  return count;
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

function getDoorStateFromSchedule(
  hour: number,
  minute: number,
  schedule: TimeSchedule,
  doorId: string,
): "closed" | "locked" {
  const time = hour + minute / 60;
  for (const ds of schedule.doorLockSchedule) {
    if (ds.doorId !== doorId) continue;
    for (const period of ds.periods) {
      if (timeInPeriod(time, period.startHour, period.endHour)) {
        return "locked";
      }
    }
  }
  return "closed";
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
    ts.occupancySchedule.length > 0 ||
    ts.doorLockSchedule.length > 0
  );
}

function computeTimeSliceState(hour: number, minute: number, scene?: SecurityScene): TimeSliceState {
  const ts = scene?.timeSchedule;
  const useScene = !!scene && hasSceneSchedule(scene);
  const hasLocation = !!(ts?.location?.latitude != null && ts?.location?.longitude != null);

  const interior = useScene && ts
    ? getInteriorLightStateFromSchedule(hour, minute, ts)
    : getInteriorLightStateDefault(hour, minute);
  const exterior = ts && hasLocation
    ? getExteriorLightStateSeasonal(hour, minute, ts)
    : useScene && ts
      ? getExteriorLightStateFromSchedule(hour, minute, ts)
      : getExteriorLightStateDefault(hour, minute);
  const occupancy = useScene && ts
    ? getOccupancyFromSchedule(hour, minute, ts)
    : getOccupancyDefault(hour, minute);

  let doorStates: Record<string, "closed" | "locked"> | undefined;
  if (useScene && ts && ts.doorLockSchedule.length > 0 && scene) {
    doorStates = {};
    for (const door of scene.doors) {
      doorStates[door.id] = getDoorStateFromSchedule(hour, minute, ts, door.id);
    }
  }

  const activeGuardCount = getActiveGuardCount(hour, minute, scene);
  const guardPatrolActive = activeGuardCount > 0;

  const baseLabel = ts && ts.doorLockSchedule.length > 0 && scene && scene.doors.length > 0
    ? `${interior.label}${doorStates && Object.values(doorStates).some(s => s === "locked") ? " (doors locked)" : ""}`
    : interior.label;

  return {
    hour,
    minute,
    timeOfDay: isNight(hour),
    interiorLightsOn: interior.on,
    exteriorLightsOn: exterior.on,
    occupancy: occupancy.level,
    stateLabel: guardPatrolActive ? `${baseLabel} (guard patrol)` : baseLabel,
    doorStates,
    guardPatrolActive,
    activeGuardCount,
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

  function addScheduleHours(
    periods: { startHour: number; endHour?: number }[],
  ) {
    for (const p of periods) {
      hours.add(p.startHour);
      hours.add((p.endHour ?? 24) < 24 ? (p.endHour ?? 24) : 0);
    }
  }

  if (ts) {
    for (const ls of ts.interiorLightSchedule) {
      addScheduleHours(ls.periods);
    }
    for (const ls of ts.exteriorLightSchedule) {
      addScheduleHours(ls.periods);
    }
    for (const op of ts.occupancySchedule) {
      addScheduleHours([op.timeRange]);
    }
    // Add guard patrol transition hours so each round start/end is a separate snapshot
    for (const patrol of ts.guardPatrolSchedule) {
      const dayMinutes = 24 * 60;
      const firstStart = patrol.firstPatrolHour * 60;
      for (let start = firstStart; start < firstStart + dayMinutes; start += patrol.intervalMinutes) {
        hours.add(Math.floor((start % dayMinutes) / 60));
        hours.add(Math.floor(((start + patrol.durationMinutes) % dayMinutes) / 60));
      }
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

  // Event phase transitions
  const ec = scene.eventConfig;
  if (ec?.isActive && ec.phases.length > 0) {
    for (const phase of ec.phases) {
      hours.add(phase.startHour);
      hours.add(phase.endHour < 24 ? phase.endHour : 0);
    }
  }

  hours.add(0);
  return Array.from(hours).sort((a, b) => a - b);
}

function getActiveEventPhase(scene: SecurityScene, hour: number): import("@sentineltwin/core").EventPhase | null {
  const ec = scene.eventConfig;
  if (!ec?.isActive || ec.phases.length === 0) return null;
  return ec.phases.find((p) => {
    if (p.endHour > p.startHour) return hour >= p.startHour && hour < p.endHour;
    return hour >= p.startHour || hour < p.endHour;
  }) ?? null;
}

const OCCUPANCY_CROWD_SCALE: Record<string, number> = {
  empty: 0,
  low: 0.15,
  medium: 0.5,
  high: 0.8,
  peak: 1.0,
};

function buildChangeTimeline(scene: SecurityScene): StateTransition[] {
  const hours = collectScheduleTransitionHours(scene);
  return hours.map((h) => ({ hour: h, minute: 0, label: `Transition ${h}:00` }));
}

function patchSceneForTimeSlice(
  scene: SecurityScene,
  state: TimeSliceState,
): SecurityScene {
  const patched = cloneSecuritySceneSimulation(scene);

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

  patched.securityLights = patched.securityLights.map((light) => {
    if (light.illuminatesNightCoverage) {
      return { ...light, status: state.exteriorLightsOn ? ("on" as const) : ("off" as const) };
    }
    return { ...light, status: state.interiorLightsOn ? ("on" as const) : ("off" as const) };
  });

  if (state.doorStates) {
    patched.doors = scene.doors.map((door) => {
      const scheduledState = state.doorStates?.[door.id];
      if (scheduledState) {
        return { ...door, state: scheduledState };
      }
      return door;
    });
  }

  // Event phase crowd scaling: when an event is active, scale crowd profiles
  // based on the phase's expected occupancy relative to peak attendance.
  const activePhase = getActiveEventPhase(scene, state.hour);
  if (activePhase && scene.eventConfig?.expectedPeakAttendance) {
    const scale = OCCUPANCY_CROWD_SCALE[activePhase.expectedOccupancy] ?? 0.5;
    const peakCount = scene.eventConfig.expectedPeakAttendance;
    if (patched.crowdProfiles && patched.crowdProfiles.length > 0) {
      patched.crowdProfiles = patched.crowdProfiles.map((profile) => ({
        ...profile,
        archetypes: profile.archetypes.map((arch) => ({
          ...arch,
          countByHour: arch.countByHour.map((count, h) => {
            if (h >= activePhase.startHour && h < activePhase.endHour) {
              return Math.round(peakCount * scale / Math.max(1, profile.archetypes.length));
            }
            return count;
          }),
        })),
      }));
    }
  }

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

  /**
   * Determine which critical zones are failing for a given snapshot.
   * Populates zonesFailing with zone labels whose status is not "pass".
   */
  function collectZonesFailing(snap: HourlySecuritySnapshot): string[] {
    return Object.entries(snap.criticalZoneStatuses)
      .filter(([, status]) => status !== "pass")
      .map(([label]) => label);
  }

  for (const snap of snapshots) {
    const isVulnerable =
      snap.criticalZonePassCount < snap.criticalZoneTotalCount ||
      snap.overallCoveragePct < COVERAGE_SAFETY_THRESHOLD;

    if (isVulnerable && !currentWindow) {
      currentWindow = {
        startHour: snap.hour,
        startMinute: snap.minute,
        reasons: new Set(snap.issues),
        zonesFailing: new Set(collectZonesFailing(snap)),
        adversarialAvailable: snap.adversarialPathExposureScore > ADVERSARIAL_EXPOSURE_WARNING,
      };
    } else if (isVulnerable && currentWindow) {
      snap.issues.forEach((issue) => currentWindow!.reasons.add(issue));
      for (const zf of collectZonesFailing(snap)) {
        currentWindow!.zonesFailing.add(zf);
      }
      if (snap.adversarialPathExposureScore > ADVERSARIAL_EXPOSURE_WARNING) {
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

  // Close any window still open at the final snapshot.
  // If 0:00 is safe, the vulnerability ends at 24:00 (midnight).
  // If 0:00 is also vulnerable, this window merges with the next day's
  // first window — the caller should reconcile across 24→0 boundaries.
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
    const result = simulateStudio(patchedScene, { hour: state.hour, minute: state.minute });

    const rawExposure = result.adversarialPath?.totalExposureScore ?? 0;
    // Guard patrol deterrence: each active guard reduces adversarial exposure by 35%.
    const adjustedExposure = state.guardPatrolActive
      ? rawExposure * Math.max(0, 1 - 0.35 * state.activeGuardCount)
      : rawExposure;

    // Use crowd-adjusted effective coverage when crowd profiles produce occlusion data
    const effectiveCoverage = result.crowdOcclusion
      ? result.crowdOcclusion.effectiveCoveragePct
      : result.totalCoveragePct;

    hourlySnapshots.push({
      hour: state.hour,
      minute: state.minute,
      overallCoveragePct: effectiveCoverage,
      geometricCoveragePct: result.crowdOcclusion ? result.totalCoveragePct : undefined,
      crowdAgentCount: result.crowdOcclusion?.totalAgentCount,
      criticalZonePassCount: result.criticalZoneResults.filter((z) => z.status === "pass").length,
      criticalZoneTotalCount: result.criticalZoneResults.length,
      criticalZoneStatuses: Object.fromEntries(
        result.criticalZoneResults.map((zone) => [zone.label, zone.status]),
      ),
      activeCameraCount: result.cameraResults.length,
      activeLightCount: patchedScene.securityLights.filter((l) => l.status === "on").length,
      adversarialPathExposureScore: adjustedExposure,
      issues: [
        ...result.issues.map((i) => i.description),
        ...(state.guardPatrolActive
          ? [`Guard patrol active (${state.activeGuardCount} guard${state.activeGuardCount > 1 ? "s" : ""}) — adversarial exposure reduced`]
          : []),
      ],
      stateLabel: state.stateLabel,
    });
  }

  // Build a Map from stateLabel → snapshot for O(1) lookup during fill
  const snapshotByLabel = new Map<string, HourlySecuritySnapshot>();
  for (const snap of hourlySnapshots) {
    if (!snapshotByLabel.has(snap.stateLabel)) {
      snapshotByLabel.set(snap.stateLabel, snap);
    }
  }

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += resolutionMinutes) {
      if (transitionKeys.has(`${h}:${m}`)) continue;

      const state = computeTimeSliceState(h, m, scene);
      const nearestSnapshot = snapshotByLabel.get(state.stateLabel);

      if (nearestSnapshot) {
        hourlySnapshots.push({
          hour: h,
          minute: m,
          overallCoveragePct: nearestSnapshot.overallCoveragePct,
          geometricCoveragePct: nearestSnapshot.geometricCoveragePct,
          crowdAgentCount: nearestSnapshot.crowdAgentCount,
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
  const evaluatedZones = scene.criticalZones.map((z) => ({ id: z.id, label: z.label }));
  for (const { id, label } of evaluatedZones) {
    criticalZoneCoverageByHour[id] = hourlySnapshots.map(
      (snap) => {
        const status = snap.criticalZoneStatuses[label] ?? "fail";
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

export function computeTimeSliceStateForHour(hour: number, minute = 0, scene?: SecurityScene): TimeSliceState {
  return computeTimeSliceState(hour, minute, scene);
}
