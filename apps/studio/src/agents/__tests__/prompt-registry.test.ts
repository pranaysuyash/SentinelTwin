import { describe, expect, test } from "bun:test";

import { buildPromptRegistrySnapshot, PROMPT_REGISTRY, getPromptRegistryEntry, resolvePromptRegistryLineage, summarizePromptRegistry } from "@/agents/prompt-registry";

describe("prompt registry", () => {
  test("exposes canonical prompt metadata for the model-backed stages", () => {
    const summary = summarizePromptRegistry();

    expect(PROMPT_REGISTRY).toHaveLength(4);
    expect(summary.total).toBe(4);
    expect(summary.latestVersion).toBe("v1");
    expect(summary.registryDigest).toContain("command_parse");
    expect(summary.stages.command).toBe(1);
    expect(summary.stages.counterfactual).toBe(1);
    expect(summary.stages.report).toBe(1);
    expect(summary.stages.draft).toBe(1);
    expect(getPromptRegistryEntry("report_generation")?.agent).toBe("ReportAgent");
    expect(getPromptRegistryEntry("model_layout_draft")?.outputSchema).toContain("SecurityScene");
    expect(resolvePromptRegistryLineage("ai_draft")?.promptId).toBe("model_layout_draft");
    expect(resolvePromptRegistryLineage("report_generation")?.promptOutputSchema).toBe("SecurityReport");
    expect(buildPromptRegistrySnapshot().observedAt).toBeGreaterThan(0);
  });
});
