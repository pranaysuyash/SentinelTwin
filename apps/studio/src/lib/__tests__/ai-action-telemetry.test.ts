import { describe, expect, test } from "bun:test";

import { summarizeAiActionTelemetry } from "@/lib/ai-action-telemetry";
import type { AiActionTelemetryRecord } from "@/store/studio-store";

function makeRecord(
  stage: AiActionTelemetryRecord["stage"],
  durationMs: number,
  estimatedTotalTokens: number,
  status: AiActionTelemetryRecord["status"] = "success",
): AiActionTelemetryRecord {
  return {
    id: `${stage}-${durationMs}-${estimatedTotalTokens}`,
    stage,
    providerId: "openai",
    providerLabel: "OpenAI · gpt-4o",
    model: "gpt-4o",
    localOnlyMode: false,
    cloudAvailable: true,
    timestamp: Date.now(),
    durationMs,
    estimatedPromptTokens: Math.max(1, Math.floor(estimatedTotalTokens / 2)),
    estimatedCompletionTokens: Math.max(1, Math.ceil(estimatedTotalTokens / 2)),
    estimatedTotalTokens,
    tokenSource: "estimated",
    status,
    note: null,
  };
}

describe("summarizeAiActionTelemetry", () => {
  test("summarizes the telemetry trail and trend direction", () => {
    const summary = summarizeAiActionTelemetry([
      makeRecord("report_generation", 180, 900),
      makeRecord("ai_draft", 140, 700),
      makeRecord("counterfactual", 210, 1100),
      makeRecord("command_parse", 120, 300),
      makeRecord("report_generation", 150, 800),
      makeRecord("ai_draft", 130, 650),
      makeRecord("counterfactual", 200, 1000),
      makeRecord("command_parse", 110, 280),
    ]);

    expect(summary.totalEvents).toBe(8);
    expect(summary.successCount).toBe(8);
    expect(summary.errorCount).toBe(0);
    expect(summary.averageDurationMs).toBeGreaterThan(0);
    expect(summary.averageTokens).toBeGreaterThan(0);
    expect(summary.recentWindow?.count).toBe(5);
    expect(summary.previousWindow?.count).toBe(3);
    expect(summary.stageCounts.ai_draft).toBe(2);
    expect(["faster", "slower", "stable", "insufficient-data"]).toContain(summary.trendLabel);
    expect(summary.trendNote.length).toBeGreaterThan(0);
  });
});
