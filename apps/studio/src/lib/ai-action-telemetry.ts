import type { AiActionTelemetryRecord } from "@/store/studio-store";

export type AiActionTelemetryWindowSummary = {
  count: number;
  averageDurationMs: number;
  averageTokens: number;
  successCount: number;
  errorCount: number;
};

export type AiActionTelemetrySummary = {
  totalEvents: number;
  successCount: number;
  errorCount: number;
  averageDurationMs: number;
  averageTokens: number;
  recentWindow: AiActionTelemetryWindowSummary | null;
  previousWindow: AiActionTelemetryWindowSummary | null;
  trendLabel: "faster" | "slower" | "stable" | "insufficient-data";
  trendNote: string;
  stageCounts: Record<AiActionTelemetryRecord["stage"], number>;
};

function summarizeWindow(records: AiActionTelemetryRecord[]): AiActionTelemetryWindowSummary | null {
  if (records.length === 0) return null;
  const totalDurationMs = records.reduce((sum, record) => sum + record.durationMs, 0);
  const totalTokens = records.reduce((sum, record) => sum + record.estimatedTotalTokens, 0);
  const successCount = records.filter((record) => record.status === "success").length;
  const errorCount = records.length - successCount;
  return {
    count: records.length,
    averageDurationMs: Math.round(totalDurationMs / records.length),
    averageTokens: Math.round(totalTokens / records.length),
    successCount,
    errorCount,
  };
}

export function summarizeAiActionTelemetry(records: AiActionTelemetryRecord[]): AiActionTelemetrySummary {
  const ordered = [...records].sort((a, b) => b.timestamp - a.timestamp);
  const totalEvents = ordered.length;
  const successCount = ordered.filter((record) => record.status === "success").length;
  const errorCount = totalEvents - successCount;
  const averageDurationMs = totalEvents > 0
    ? Math.round(ordered.reduce((sum, record) => sum + record.durationMs, 0) / totalEvents)
    : 0;
  const averageTokens = totalEvents > 0
    ? Math.round(ordered.reduce((sum, record) => sum + record.estimatedTotalTokens, 0) / totalEvents)
    : 0;
  const recentWindow = summarizeWindow(ordered.slice(0, 5));
  const previousWindow = summarizeWindow(ordered.slice(5, 10));

  let trendLabel: AiActionTelemetrySummary["trendLabel"] = "insufficient-data";
  let trendNote = "Need at least two windows to compare recent telemetry.";
  if (recentWindow && previousWindow) {
    const durationDelta = recentWindow.averageDurationMs - previousWindow.averageDurationMs;
    if (Math.abs(durationDelta) <= 10) {
      trendLabel = "stable";
      trendNote = `Recent actions are holding steady versus the previous window (${durationDelta >= 0 ? "+" : ""}${durationDelta} ms).`;
    } else if (durationDelta < 0) {
      trendLabel = "faster";
      trendNote = `Recent actions are faster than the previous window by ${Math.abs(durationDelta)} ms on average.`;
    } else {
      trendLabel = "slower";
      trendNote = `Recent actions are slower than the previous window by ${durationDelta} ms on average.`;
    }
  } else if (recentWindow) {
    trendNote = "Add more measured actions to compare the latest window with an earlier baseline.";
  }

  const stageCounts = ordered.reduce<Record<AiActionTelemetryRecord["stage"], number>>((acc, record) => {
    acc[record.stage] = (acc[record.stage] ?? 0) + 1;
    return acc;
  }, {
    command_parse: 0,
    counterfactual: 0,
    report_generation: 0,
    ai_draft: 0,
  });

  return {
    totalEvents,
    successCount,
    errorCount,
    averageDurationMs,
    averageTokens,
    recentWindow,
    previousWindow,
    trendLabel,
    trendNote,
    stageCounts,
  };
}
