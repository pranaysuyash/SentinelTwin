import { describe, expect, test } from "bun:test";

import {
  AI_PROVIDER_OPTIONS,
  describeAiProviderHealth,
  describeAiProviderGovernance,
  describeAiProviderTelemetry,
  describeAiProviderSelection,
  normalizeAiProviderSelection,
} from "@/agents/provider-selection";

describe("provider selection", () => {
  test("describes the active provider and fallback order", () => {
    const selection = normalizeAiProviderSelection({ providerId: "gemini", model: "gemini-2.5-pro" });
    const summary = describeAiProviderSelection(selection);
    const governance = describeAiProviderGovernance(selection, false);

    expect(summary.providerName).toBe("Gemini");
    expect(summary.providerLabel).toBe("Gemini · gemini-2.5-pro");
    expect(governance.activeProviderId).toBe("gemini");
    expect(governance.activeProviderName).toBe("Gemini");
    expect(governance.activeProviderLabel).toBe("Gemini · gemini-2.5-pro");
    expect(governance.localOnlyMode).toBe(false);
    expect(governance.fallbackOrder[0]?.providerId).toBe("gemini");
    expect(governance.fallbackOrder).toHaveLength(AI_PROVIDER_OPTIONS.length);
    expect(governance.fallbackOrder.some((entry) => entry.available)).toBe(true);
  });

  test("marks cloud-backed providers unavailable when local-only mode is active", () => {
    const governance = describeAiProviderGovernance(
      normalizeAiProviderSelection({ providerId: "openai", model: "gpt-4o" }),
      true,
    );
    const health = describeAiProviderHealth(
      normalizeAiProviderSelection({ providerId: "openai", model: "gpt-4o" }),
      true,
    );

    expect(governance.localOnlyMode).toBe(true);
    expect(governance.cloudAvailable).toBe(false);
    expect(governance.activeProviderLabel).toContain("OpenAI");
    expect(health.overallStatus).toBe("blocked");
    expect(health.providers.every((entry) => entry.status === "blocked")).toBe(true);
  });

  test("summarizes estimated cost and latency policy per stage", () => {
    const telemetry = describeAiProviderTelemetry(
      normalizeAiProviderSelection({ providerId: "gemini", model: "gemini-2.5-flash" }),
      false,
    );

    expect(telemetry.activeCostTier).toBe("low");
    expect(telemetry.activeLatencyTier).toBe("fast");
    expect(telemetry.overallStatus).toBe("ready");
    expect(telemetry.stagePolicies.find((stage) => stage.stage === "command")?.ready).toBe(true);
    expect(telemetry.stagePolicies.find((stage) => stage.stage === "draft")?.ready).toBe(true);
    expect(telemetry.providers.some((provider) => provider.costTier === "low")).toBe(true);
  });
});
