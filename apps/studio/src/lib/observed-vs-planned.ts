/**
 * "Observed vs Planned" — fuses camera design-time drift with live operational
 * health into a single composite report.
 *
 * Camera Drift (design-time) answers: have cameras moved or been re-aimed
 * relative to the last verified baseline? Live Ops (runtime) answers: are
 * sensors and cameras reporting healthy right now?
 *
 * Operators care about both simultaneously. Splitting them into separate cards
 * forces context-switching between the same underlying question: "is the
 * physical deployment matching the simulation?"
 */

import type { CameraDriftReport, CameraDriftEntry } from "./camera-drift";
import type { LiveOperationalHealthSummary, LiveHealthEntry } from "./security-analytics";

export interface ObservedVsPlannedSummary {
  driftCount: number;
  majorDriftCount: number;
  faultCount: number;
  degradedCount: number;
  totalIssues: number;
  statusLabel: string;
}

export interface ObservedVsPlannedReport {
  hasData: boolean;
  baselineLabel: string | null;
  driftEntries: CameraDriftEntry[];
  liveAlerts: LiveHealthEntry[];
  trackedSensors: number;
  trackedCameras: number;
  summary: ObservedVsPlannedSummary;
}

function deriveStatusLabel(
  majorDriftCount: number,
  faultCount: number,
  totalIssues: number,
): string {
  if (totalIssues === 0) return "On plan";
  if (majorDriftCount > 0 || faultCount > 0) return "Critical deviation";
  return "Minor deviations";
}

export function buildObservedVsPlannedReport(
  cameraDriftReport: CameraDriftReport | null,
  liveHealth: LiveOperationalHealthSummary,
): ObservedVsPlannedReport {
  const driftEntries = cameraDriftReport?.entries ?? [];
  const liveAlerts = liveHealth.alerts;

  const driftCount = driftEntries.length;
  const majorDriftCount = driftEntries.filter((e) => e.severity === "major").length;
  const faultCount = liveHealth.faultedSensors;
  const degradedCount = liveHealth.degradedCameras;
  const totalIssues = driftCount + liveAlerts.length;

  const hasData =
    driftEntries.length > 0 ||
    liveAlerts.length > 0 ||
    liveHealth.trackedSensors + liveHealth.trackedCameras > 0;

  return {
    hasData,
    baselineLabel: cameraDriftReport?.baselineLabel ?? null,
    driftEntries,
    liveAlerts,
    trackedSensors: liveHealth.trackedSensors,
    trackedCameras: liveHealth.trackedCameras,
    summary: {
      driftCount,
      majorDriftCount,
      faultCount,
      degradedCount,
      totalIssues,
      statusLabel: deriveStatusLabel(majorDriftCount, faultCount, totalIssues),
    },
  };
}
