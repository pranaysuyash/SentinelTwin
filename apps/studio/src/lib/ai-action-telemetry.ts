import type { AiActionTelemetryRecord } from "@/store/studio-store";

export type AiActionTelemetryPolicy = {
  recentWindowSize: number;
  baselineWindowSize: number;
  durationDeltaThresholdMs: number;
  tokenDeltaThreshold: number;
  successRateDeltaThreshold: number;
};

export const DEFAULT_AI_ACTION_TELEMETRY_POLICY: AiActionTelemetryPolicy = {
  recentWindowSize: 5,
  baselineWindowSize: 10,
  durationDeltaThresholdMs: 25,
  tokenDeltaThreshold: 150,
  successRateDeltaThreshold: 0.05,
};

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
  policy: AiActionTelemetryPolicy;
  recentWindow: AiActionTelemetryWindowSummary | null;
  previousWindow: AiActionTelemetryWindowSummary | null;
  longHorizonWindow: AiActionTelemetryWindowSummary | null;
  trendLabel: "faster" | "slower" | "stable" | "insufficient-data";
  trendNote: string;
  policyLabel: "healthy" | "warming" | "degraded" | "insufficient-data";
  policyNote: string;
  stageCounts: Record<AiActionTelemetryRecord["stage"], number>;
};

function normalizePositiveInteger(value: number, fallback: number, minimum = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.round(value));
}

export function normalizeAiActionTelemetryPolicy(
  policy: Partial<AiActionTelemetryPolicy> | null | undefined,
): AiActionTelemetryPolicy {
  const recentWindowSize = normalizePositiveInteger(policy?.recentWindowSize ?? DEFAULT_AI_ACTION_TELEMETRY_POLICY.recentWindowSize, DEFAULT_AI_ACTION_TELEMETRY_POLICY.recentWindowSize);
  const baselineWindowSize = Math.max(
    recentWindowSize,
    normalizePositiveInteger(policy?.baselineWindowSize ?? DEFAULT_AI_ACTION_TELEMETRY_POLICY.baselineWindowSize, DEFAULT_AI_ACTION_TELEMETRY_POLICY.baselineWindowSize),
  );
  const durationDeltaThresholdMs = Math.max(
    0,
    Math.round(Number.isFinite(policy?.durationDeltaThresholdMs ?? Number.NaN)
      ? (policy?.durationDeltaThresholdMs ?? DEFAULT_AI_ACTION_TELEMETRY_POLICY.durationDeltaThresholdMs)
      : DEFAULT_AI_ACTION_TELEMETRY_POLICY.durationDeltaThresholdMs),
  );
  const tokenDeltaThreshold = Math.max(
    0,
    Math.round(Number.isFinite(policy?.tokenDeltaThreshold ?? Number.NaN)
      ? (policy?.tokenDeltaThreshold ?? DEFAULT_AI_ACTION_TELEMETRY_POLICY.tokenDeltaThreshold)
      : DEFAULT_AI_ACTION_TELEMETRY_POLICY.tokenDeltaThreshold),
  );
  const successRateDeltaThreshold = Math.min(
    1,
    Math.max(
      0,
      Number.isFinite(policy?.successRateDeltaThreshold ?? Number.NaN)
        ? (policy?.successRateDeltaThreshold ?? DEFAULT_AI_ACTION_TELEMETRY_POLICY.successRateDeltaThreshold)
        : DEFAULT_AI_ACTION_TELEMETRY_POLICY.successRateDeltaThreshold,
    ),
  );
  return {
    recentWindowSize,
    baselineWindowSize,
    durationDeltaThresholdMs,
    tokenDeltaThreshold,
    successRateDeltaThreshold,
  };
}

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

export function summarizeAiActionTelemetry(
  records: AiActionTelemetryRecord[],
  policyInput: Partial<AiActionTelemetryPolicy> | null | undefined = DEFAULT_AI_ACTION_TELEMETRY_POLICY,
): AiActionTelemetrySummary {
  const policy = normalizeAiActionTelemetryPolicy(policyInput);
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
  const recentWindow = summarizeWindow(ordered.slice(0, policy.recentWindowSize));
  const previousWindow = summarizeWindow(ordered.slice(policy.recentWindowSize, policy.recentWindowSize * 2));
  const longHorizonWindow = summarizeWindow(ordered.slice(policy.recentWindowSize, policy.recentWindowSize + policy.baselineWindowSize));

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

  let policyLabel: AiActionTelemetrySummary["policyLabel"] = "insufficient-data";
  let policyNote = "Need a longer historical baseline before the AI telemetry policy can compare recent behavior.";
  if (recentWindow && longHorizonWindow) {
    const durationDelta = recentWindow.averageDurationMs - longHorizonWindow.averageDurationMs;
    const tokenDelta = recentWindow.averageTokens - longHorizonWindow.averageTokens;
    const successRateDelta = (recentWindow.successCount / recentWindow.count) - (longHorizonWindow.successCount / longHorizonWindow.count);
    const regressionSignals = [
      durationDelta > policy.durationDeltaThresholdMs,
      tokenDelta > policy.tokenDeltaThreshold,
      successRateDelta < -policy.successRateDeltaThreshold,
      recentWindow.errorCount > longHorizonWindow.errorCount,
    ].filter(Boolean).length;
    if (regressionSignals >= 2) {
      policyLabel = "degraded";
      policyNote = `Recent telemetry is materially worse than the longer-horizon baseline (${durationDelta >= 0 ? "+" : ""}${durationDelta} ms, ${tokenDelta >= 0 ? "+" : ""}${tokenDelta} tokens, success-rate delta ${successRateDelta >= 0 ? "+" : ""}${(successRateDelta * 100).toFixed(0)}%).`;
    } else if (regressionSignals === 1) {
      policyLabel = "warming";
      policyNote = `Recent telemetry is drifting above the longer-horizon baseline (${durationDelta >= 0 ? "+" : ""}${durationDelta} ms, ${tokenDelta >= 0 ? "+" : ""}${tokenDelta} tokens, success-rate delta ${successRateDelta >= 0 ? "+" : ""}${(successRateDelta * 100).toFixed(0)}%).`;
    } else {
      policyLabel = "healthy";
      policyNote = `Recent telemetry is within policy bounds versus the longer-horizon baseline (${durationDelta >= 0 ? "+" : ""}${durationDelta} ms, ${tokenDelta >= 0 ? "+" : ""}${tokenDelta} tokens, success-rate delta ${successRateDelta >= 0 ? "+" : ""}${(successRateDelta * 100).toFixed(0)}%).`;
    }
  } else if (recentWindow) {
    policyNote = "Add more measured actions so the AI telemetry policy can compare recent behavior against a longer-horizon baseline.";
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
    policy,
    recentWindow,
    previousWindow,
    longHorizonWindow,
    trendLabel,
    trendNote,
    policyLabel,
    policyNote,
    stageCounts,
  };
}
