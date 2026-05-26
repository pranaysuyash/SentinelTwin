/**
 * Temporal Security Simulation Engine
 *
 * Computes a 24-hour security profile by building a change timeline of state
 * transitions (light, occupancy, door state, guard patrol) and running the
 * coverage simulation only at transition points — not every 15-minute step.
 *
 * Typical scene: 10–15 transitions per day → 10–15 coverage computations instead of 96.
 */
import { simulateStudio } from "@/simulation/simulate-studio";
import {
  type HourlySecuritySnapshot,
  type SecurityScene,
  type TemporalSecurityProfile,
  type TimePeriod,
  type VulnerabilityWindow,
} from "@/schema/security-scene";

// ── Default schedules for demo scenes ──

const DEFAULT_SCHEDULES = {
  interiorLights: [
    { hour: 6, label: "Business Hours" },   // on
    { hour: 18, label: "Business Hours" },   // off (after hours)
    { hour: 22, label: "Cleaning" },         // on (cleaning crew)
    { hour: 24, label: "After Hours" },      // off
  ],
  occupancy: [
    { hour: 7, level: "medium" as const, label: "Staff Arrival" },
    { hour: 10, level: "high" as const, label: "Peak Hours" },
    { hour: 15, level: "medium" as const, label: "Afternoon" },
    { hour: 18, level: "low" as const, label: "Closing" },
    { hour: 22, level: "empty" as const, label: "After Hours" },
  ],
  exteriorLights: [
    { hour: 6, label: "Daylight" },          // off (natural light)
    { hour: 19, label: "Night" },            // on (sunset)
    { hour: 2, label: "Deep Night" },        // off (timer cutout)
    { hour: 5, label: "Pre-Dawn" },          // on (timer restore)
  ],
};

// ── State builder ──

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

function getInteriorLightState(hour: number, minute: number): { on: boolean; label: string } {
  const time = hour + minute / 60;
  if (time >= 6 && time < 18) return { on: true, label: "Business Hours" };
  if (time >= 18 && time < 22) return { on: false, label: "After Hours" };
  if (time >= 22 && time < 24) return { on: true, label: "Cleaning" };
  return { on: false, label: "After Hours" };
}

function getExteriorLightState(hour: number, minute: number): { on: boolean; label: string } {
  const time = hour + minute / 60;
  if (time >= 6 && time < 19) return { on: false, label: "Daylight" };
  if (time >= 2 && time < 5) return { on: false, label: "Timer Cutout" };
  return { on: true, label: "Night" };
}

function getOccupancy(hour: number, minute: number): { level: OccupancyLevel; label: string } {
  const time = hour + minute / 60;
  if (time < 7) return { level: "empty", label: "After Hours" };
  if (time < 10) return { level: "medium", label: "Staff Arrival" };
  if (time < 15) return { level: "high", label: "Peak Hours" };
  if (time < 18) return { level: "medium", label: "Afternoon" };
  if (time < 22) return { level: "low", label: "Closing" };
  return { level: "empty", label: "After Hours" };
}

function computeTimeSliceState(hour: number, minute: number): TimeSliceState {
  const interior = getInteriorLightState(hour, minute);
  const exterior = getExteriorLightState(hour, minute);
  const occupancy = getOccupancy(hour, minute);

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

// ── Change timeline builder ──

type StateTransition = {
  hour: number;
  minute: number;
  label: string;
};

function buildChangeTimeline(): StateTransition[] {
  // Collect all transition points from schedules, deduplicate
  const transitions = new Map<string, StateTransition>();

  for (const entry of DEFAULT_SCHEDULES.interiorLights) {
    const key = `${entry.hour}:00`;
    if (!transitions.has(key)) {
      transitions.set(key, { hour: entry.hour, minute: 0, label: entry.label });
    }
  }

  for (const entry of DEFAULT_SCHEDULES.exteriorLights) {
    const key = `${entry.hour}:00`;
    if (!transitions.has(key)) {
      transitions.set(key, { hour: entry.hour, minute: 0, label: entry.label });
    }
  }

  for (const entry of DEFAULT_SCHEDULES.occupancy) {
    const key = `${entry.hour}:00`;
    if (!transitions.has(key)) {
      transitions.set(key, { hour: entry.hour, minute: 0, label: entry.label });
    }
  }

  // Add 0:00 as start
  if (!transitions.has("0:00")) {
    transitions.set("0:00", { hour: 0, minute: 0, label: "Midnight" });
  }

  return Array.from(transitions.values()).sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  });
}

// ── Simulation runner ──

function patchSceneForTimeSlice(
  scene: SecurityScene,
  state: TimeSliceState,
): SecurityScene {
  const patched = structuredClone(scene);

  // Set time of day
  patched.assumptions.timeOfDay = state.timeOfDay;

  // Set interior light level based on occupancy and light state
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

  // Toggle security lights based on exterior state
  patched.securityLights = scene.securityLights.map((light) => {
    if (light.illuminatesNightCoverage) {
      return { ...light, status: state.exteriorLightsOn ? "on" as const : "off" as const };
    }
    return { ...light, status: state.interiorLightsOn ? "on" as const : "off" as const };
  });

  // Toggle cameras with night mode based on time of day
  patched.cameras = scene.cameras.map((camera) => {
    if (state.timeOfDay === "night" && camera.nightMode !== "none") {
      return camera; // keep on — night mode active
    }
    if (state.timeOfDay === "night" && camera.nightMode === "none") {
      // Camera without night mode — reduced effectiveness but still on
      return camera;
    }
    return camera;
  });

  return patched;
}

// ── Vulnerability detection ──

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
      // End of vulnerability window
      const severity =
        currentWindow.reasons.size >= 3 ||
        currentWindow.adversarialAvailable
          ? "high" as const
          : currentWindow.reasons.size >= 2
            ? "medium" as const
            : "low" as const;

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

  // Close any open window at end of day
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

// ── Public API ──

export function computeTemporalProfile(scene: SecurityScene): TemporalSecurityProfile {
  const resolutionMinutes = 15;
  const steps: TimeSliceState[] = [];
  const hourlySnapshots: HourlySecuritySnapshot[] = [];

  // Build change timeline of transition points
  const transitions = buildChangeTimeline();
  const transitionHours = new Set(transitions.map((t) => t.hour));

  // Run coverage sim at each transition point
  for (const transition of transitions) {
    const state = computeTimeSliceState(transition.hour, transition.minute);
    steps.push(state);

    const patchedScene = patchSceneForTimeSlice(scene, state);
    const result = simulateStudio(patchedScene);

    hourlySnapshots.push({
      hour: state.hour,
      minute: state.minute,
      overallCoveragePct: result.totalCoveragePct,
      criticalZonePassCount: result.criticalZoneResults.filter((z) => z.status === "pass").length,
      criticalZoneTotalCount: result.criticalZoneResults.length,
      activeCameraCount: result.cameraResults.length,
      activeLightCount: patchedScene.securityLights.filter((l) => l.status === "on").length,
      adversarialPathExposureScore: result.adversarialPath?.totalExposureScore ?? 0,
      issues: result.issues.map((i) => i.description),
      stateLabel: state.stateLabel,
    });
  }

  // Also generate intermediate 15-min steps by interpolating between transitions
  // For each hour:minute not in transitions, find nearest transition and copy its state
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += resolutionMinutes) {
      if (transitionHours.has(h) && m === 0) continue; // already computed

      // Find the "current" state by computing directly (cheap — no sim needed)
      const state = computeTimeSliceState(h, m);

      // Find the nearest transition snapshot that has the same state label
      // This avoids running coverage sim for every 15-min step
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
          activeCameraCount: nearestSnapshot.activeCameraCount,
          activeLightCount: nearestSnapshot.activeLightCount,
          adversarialPathExposureScore: nearestSnapshot.adversarialPathExposureScore,
          issues: nearestSnapshot.issues,
          stateLabel: state.stateLabel,
        });
      }
    }
  }

  // Sort all snapshots by time
  hourlySnapshots.sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  });

  // Build vulnerability windows
  const peakVulnerabilityWindows = detectVulnerabilityWindows(hourlySnapshots);
  const safestPeriods = findSafestPeriods(hourlySnapshots);

  // Build per-zone coverage by hour
  const criticalZoneCoverageByHour: Record<string, number[]> = {};
  const evaluatedZoneLabels = scene.criticalZones.map((z) => z.label);
  for (const zoneLabel of evaluatedZoneLabels) {
    criticalZoneCoverageByHour[zoneLabel] = hourlySnapshots.map(
      (snap) =>
        snap.criticalZoneTotalCount > 0
          ? (snap.criticalZonePassCount / snap.criticalZoneTotalCount) * 100
          : 100,
    );
  }

  return {
    hoursAnalyzed: 24,
    resolutionMinutes,
    hourlySnapshots,
    peakVulnerabilityWindows,
    safestPeriods,
    criticalZoneCoverageByHour,
    computedAt: Date.now(),
  };
}

export function computeTimeSliceStateForHour(hour: number, minute = 0): TimeSliceState {
  return computeTimeSliceState(hour, minute);
}
