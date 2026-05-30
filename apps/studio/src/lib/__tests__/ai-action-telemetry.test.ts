import { describe, expect, test } from "bun:test";

import { summarizeAiActionTelemetry } from "@/lib/ai-action-telemetry";
import type { AiActionTelemetryRecord } from "@/store/studio-store";

function makeRecord(
  stage: AiActionTelemetryRecord["stage"],
  durationMs: number,
  estimatedTotalTokens: number,
  status: AiActionTelemetryRecord["status"] = "success",
  timestamp = Date.now(),
): AiActionTelemetryRecord {
  return {
    id: `${stage}-${durationMs}-${estimatedTotalTokens}`,
    stage,
    providerId: "openai",
    providerLabel: "OpenAI · gpt-4o",
    model: "gpt-4o",
    localOnlyMode: false,
    cloudAvailable: true,
    timestamp,
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
      makeRecord("report_generation", 120, 320, "success", 1710000000000),
      makeRecord("ai_draft", 115, 300, "success", 1710000000100),
      makeRecord("counterfactual", 118, 310, "success", 1710000000200),
      makeRecord("command_parse", 110, 290, "success", 1710000000300),
      makeRecord("report_generation", 112, 305, "success", 1710000000400),
      makeRecord("ai_draft", 150, 700, "success", 1710000010000),
      makeRecord("counterfactual", 160, 720, "success", 1710000010100),
      makeRecord("command_parse", 155, 690, "success", 1710000010200),
      makeRecord("report_generation", 165, 730, "error", 1710000010300),
      makeRecord("ai_draft", 158, 710, "success", 1710000010400),
      makeRecord("counterfactual", 220, 1100, "error", 1710000020000),
      makeRecord("command_parse", 210, 1080, "success", 1710000020100),
      makeRecord("report_generation", 205, 1120, "success", 1710000020200),
      makeRecord("ai_draft", 215, 1150, "error", 1710000020300),
      makeRecord("counterfactual", 200, 1090, "success", 1710000020400),
    ]);

    expect(summary.totalEvents).toBe(15);
    expect(summary.successCount).toBe(12);
    expect(summary.errorCount).toBe(3);
    expect(summary.averageDurationMs).toBeGreaterThan(0);
    expect(summary.averageTokens).toBeGreaterThan(0);
    expect(summary.recentWindow?.count).toBe(5);
    expect(summary.previousWindow?.count).toBe(5);
    expect(summary.longHorizonWindow?.count).toBe(10);
    expect(summary.stageCounts.ai_draft).toBe(4);
    expect(["faster", "slower", "stable", "insufficient-data"]).toContain(summary.trendLabel);
    expect(["healthy", "warming", "degraded", "insufficient-data"]).toContain(summary.policyLabel);
    expect(summary.trendNote.length).toBeGreaterThan(0);
    expect(summary.policyNote.length).toBeGreaterThan(0);
  });
});
