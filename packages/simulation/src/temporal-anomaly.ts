import type {
  TemporalAnomalySummary,
  TemporalAnomalyWindow,
  TemporalSecurityProfile,
} from "@sentineltwin/core";

const ANOMALY_MIN_COVERAGE_DROP = 8;
const ANOMALY_MEDIUM_COVERAGE_DROP = 12;
const ANOMALY_HIGH_COVERAGE_DROP = 20;
const ANOMALY_MIN_EXPOSURE_JUMP = 2.5;
const ANOMALY_HIGH_EXPOSURE_JUMP = 5;

function compareSnapshots(
  previous: TemporalSecurityProfile["hourlySnapshots"][number],
  current: TemporalSecurityProfile["hourlySnapshots"][number],
  criticalZoneCoverageByHour: TemporalSecurityProfile["criticalZoneCoverageByHour"],
  snapshotIndex: number,
): TemporalAnomalyWindow | null {
  const coverageDeltaPct = Number((current.overallCoveragePct - previous.overallCoveragePct).toFixed(1));
  const zonePassDelta = current.criticalZonePassCount - previous.criticalZonePassCount;
  const exposureDelta = Number((current.adversarialPathExposureScore - previous.adversarialPathExposureScore).toFixed(1));

  const isCoverageDrop = coverageDeltaPct <= -ANOMALY_MIN_COVERAGE_DROP;
  const isZoneFlip = zonePassDelta < 0;
  const isExposureSpike = exposureDelta >= ANOMALY_MIN_EXPOSURE_JUMP;

  if (!isCoverageDrop && !isZoneFlip && !isExposureSpike) {
    return null;
  }

  const anomalyType =
    isCoverageDrop && isZoneFlip
      ? "mixed"
      : isExposureSpike && (isCoverageDrop || isZoneFlip)
        ? "mixed"
        : isExposureSpike
          ? "adversarial_spike"
          : isZoneFlip
            ? "zone_flip"
            : "coverage_drop";

  const severity =
    coverageDeltaPct <= -ANOMALY_HIGH_COVERAGE_DROP ||
    zonePassDelta <= -2 ||
    exposureDelta >= ANOMALY_HIGH_EXPOSURE_JUMP
      ? "high"
      : coverageDeltaPct <= -ANOMALY_MEDIUM_COVERAGE_DROP ||
          zonePassDelta < 0 ||
          exposureDelta >= ANOMALY_MIN_EXPOSURE_JUMP
        ? "medium"
        : "low";

  const affectedZones = Object.entries(criticalZoneCoverageByHour)
    .map(([zoneLabel, values]) => {
      const prevValue = values[snapshotIndex - 1] ?? values[snapshotIndex] ?? 100;
      const nextValue = values[snapshotIndex] ?? prevValue;
      return {
        zoneLabel,
        delta: Number((nextValue - prevValue).toFixed(1)),
        nextValue,
      };
    })
    .filter((entry) => entry.delta < 0 || entry.nextValue < 100)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3)
    .map((entry) => entry.zoneLabel);

  const window: TemporalAnomalyWindow = {
    startHour: previous.hour,
    startMinute: previous.minute,
    endHour: current.hour,
    endMinute: current.minute,
    severity,
    anomalyType,
    coverageDeltaPct,
    zonePassDelta,
    exposureDelta,
    description:
      `${current.stateLabel} introduced a ${coverageDeltaPct.toFixed(1)}% coverage change, ` +
      `${zonePassDelta < 0 ? "reduced" : "shifted"} critical-zone pass count, ` +
      `${exposureDelta > 0 ? `and increased adversarial exposure by ${exposureDelta.toFixed(1)}.` : "without a route spike."}`,
    affectedZones,
  };

  return window;
}

function mergeWindows(windows: TemporalAnomalyWindow[]): TemporalAnomalyWindow[] {
  if (windows.length === 0) return [];

  const merged: TemporalAnomalyWindow[] = [windows[0]!];

  for (let index = 1; index < windows.length; index += 1) {
    const current = windows[index]!;
    const last = merged[merged.length - 1]!;

    const contiguous = last.endHour === current.startHour && last.endMinute === current.startMinute;
    const sameKind = last.severity === current.severity && last.anomalyType === current.anomalyType;

    if (contiguous && sameKind) {
      last.endHour = current.endHour;
      last.endMinute = current.endMinute;
      last.coverageDeltaPct = Number((last.coverageDeltaPct + current.coverageDeltaPct).toFixed(1));
      last.zonePassDelta += current.zonePassDelta;
      last.exposureDelta = Number((last.exposureDelta + current.exposureDelta).toFixed(1));
      last.description = `${last.description} ${current.description}`;
      current.affectedZones.forEach((zone) => {
        if (!last.affectedZones.includes(zone)) {
          last.affectedZones.push(zone);
        }
      });
      continue;
    }

    merged.push({ ...current, affectedZones: [...current.affectedZones] });
  }

  return merged;
}

export function detectTemporalAnomalies(
  profile: TemporalSecurityProfile,
): {
  windows: TemporalAnomalyWindow[];
  summary: TemporalAnomalySummary;
} {
  const sortedSnapshots = [...profile.hourlySnapshots].sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  });

  const windows = sortedSnapshots.slice(1).map((current, index) =>
    compareSnapshots(
      sortedSnapshots[index]!,
      current,
      profile.criticalZoneCoverageByHour,
      index + 1,
    ),
  ).filter((window): window is TemporalAnomalyWindow => Boolean(window));

  const merged = mergeWindows(windows);

  const summary: TemporalAnomalySummary = {
    totalAnomalies: merged.length,
    highSeverityCount: merged.filter((window) => window.severity === "high").length,
    mediumSeverityCount: merged.filter((window) => window.severity === "medium").length,
    lowSeverityCount: merged.filter((window) => window.severity === "low").length,
    worstCoverageDropPct: Number(Math.min(0, ...merged.map((window) => window.coverageDeltaPct)).toFixed(1)),
    worstExposureJump: Number(Math.max(0, ...merged.map((window) => window.exposureDelta)).toFixed(1)),
  };

  return { windows: merged, summary };
}
