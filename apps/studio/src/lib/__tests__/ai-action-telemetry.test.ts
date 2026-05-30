import { describe, expect, test } from "bun:test";

import {
  DEFAULT_AI_ACTION_TELEMETRY_POLICY,
  summarizeAiActionTelemetry,
} from "@/lib/ai-action-telemetry";
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
    expect(summary.policy).toEqual(DEFAULT_AI_ACTION_TELEMETRY_POLICY);
    expect(summary.recentWindow?.count).toBe(5);
    expect(summary.previousWindow?.count).toBe(5);
    expect(summary.longHorizonWindow?.count).toBe(10);
    expect(summary.stageCounts.ai_draft).toBe(4);
    expect(["faster", "slower", "stable", "insufficient-data"]).toContain(summary.trendLabel);
    expect(["healthy", "warming", "degraded", "insufficient-data"]).toContain(summary.policyLabel);
    expect(summary.trendNote.length).toBeGreaterThan(0);
    expect(summary.policyNote.length).toBeGreaterThan(0);
  });

  test("honors an operator-tuned telemetry policy", () => {
    const summary = summarizeAiActionTelemetry([
      makeRecord("ai_draft", 140, 320, "success", 1710000000000),
      makeRecord("report_generation", 135, 315, "success", 1710000000100),
      makeRecord("command_parse", 138, 310, "success", 1710000000200),
      makeRecord("counterfactual", 110, 250, "success", 1710000010000),
      makeRecord("report_generation", 112, 260, "success", 1710000010100),
      makeRecord("ai_draft", 108, 255, "success", 1710000010200),
      makeRecord("command_parse", 170, 700, "error", 1710000020000),
      makeRecord("counterfactual", 175, 730, "error", 1710000020100),
      makeRecord("report_generation", 180, 720, "success", 1710000020200),
      makeRecord("ai_draft", 190, 760, "error", 1710000020300),
    ], {
      recentWindowSize: 4,
      baselineWindowSize: 4,
      durationDeltaThresholdMs: 20,
      tokenDeltaThreshold: 120,
      successRateDeltaThreshold: 0.04,
    });

    expect(summary.policy.recentWindowSize).toBe(4);
    expect(summary.policy.baselineWindowSize).toBe(4);
    expect(summary.policy.durationDeltaThresholdMs).toBe(20);
    expect(summary.policy.tokenDeltaThreshold).toBe(120);
    expect(summary.policy.successRateDeltaThreshold).toBeCloseTo(0.04, 2);
    expect(summary.recentWindow?.count).toBe(4);
    expect(summary.previousWindow?.count).toBe(4);
    expect(summary.longHorizonWindow?.count).toBe(4);
    expect(["healthy", "warming", "degraded", "insufficient-data"]).toContain(summary.policyLabel);
  });
});
