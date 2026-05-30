import type {
  TemporalAnomaly,
  TemporalSecurityProfile,
} from "@sentineltwin/core";

export function detectTemporalAnomalies(
  profile: TemporalSecurityProfile,
): TemporalAnomaly[] {
  const anomalies: TemporalAnomaly[] = [];

  for (let hour = 1; hour < profile.slices.length; hour++) {
    const prev = profile.slices[hour - 1]!;
    const curr = profile.slices[hour]!;
    const delta = curr.totalCoveragePct - prev.totalCoveragePct;

    if (Math.abs(delta) > 15) {
      anomalies.push({
        hour: curr.hour,
        type: delta > 0 ? "coverage_gain" : "coverage_loss",
        magnitudePct: Number(Math.abs(delta).toFixed(1)),
        description: `${delta > 0 ? "Gain" : "Loss"} of ${Math.abs(delta).toFixed(1)}% coverage from hour ${prev.hour} to ${curr.hour}.`,
      });
    }
  }

  return anomalies;
}
