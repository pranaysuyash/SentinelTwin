import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const hookPath = join(import.meta.dir, "../use-ai-command.ts");

describe("useAiCommand", () => {
  test("uses the offline parser fallback and the selected provider before requiring an API key", () => {
    const source = readFileSync(hookPath, "utf8");

    expect(source).toContain('import { parseOfflineCommand, type OfflineCommandAction } from "@/lib/offline-command-parser";');
    expect(source).toContain("describeAiProviderHealth");
    expect(source).toContain("describeAiProviderTelemetry");
    expect(source).toContain("describeAiProviderSelection");
    expect(source).toContain("providerKeyAvailable");
    expect(source).toContain('const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);');
    expect(source).toContain('const localOnlyMode = useStudioStore((s) => s.localOnlyMode);');
    expect(source).toContain('const providerSummary = describeAiProviderSelection(aiProviderSelection);');
    expect(source).toContain('const providerHealth = describeAiProviderHealth(aiProviderSelection, localOnlyMode);');
    expect(source).toContain('const providerTelemetry = describeAiProviderTelemetry(aiProviderSelection, localOnlyMode);');
    expect(source).toContain('const provider = createModelProvider(aiProviderSelection);');
    expect(source).toContain('const cloudAvailable = apiKeyAvailable && !localOnlyMode;');
    expect(source).toContain('const recordTelemetry = useCallback(');
    expect(source).toContain("const offlinePlan = parseOfflineCommand(userText, storeState.scene);");
    expect(source).toContain("if (offlinePlan.operations.length > 0) {");
    expect(source).toContain('setStatusSafe({ state: "success", message: offlinePlan.message });');
    expect(source).toContain("providerSummary.providerName");
    expect(source).toContain("providerKeyAvailable(aiProviderSelection.providerId)");
    expect(source).toContain("Try commands like /night, /privacy on, /simulate, /report, or /target license_plate.");
    expect(source).toContain('const mode: AiCommandMode = localOnlyMode');
    expect(source).toContain('label: "Local-only"');
    expect(source).toContain('Cloud-backed parsing, fix proposals, and report generation are disabled by policy');
    expect(source).toContain('Local-only mode blocks cloud-backed parsing.');
    expect(source).toContain('evaluateAiRateLimit');
    expect(source).toContain('recordAiRateLimitUsage');
    expect(source).toContain('formatRetryHint');
    expect(source).toContain('Auto-applied best fix');
    expect(source).toContain('verifyAndRankCounterfactualCandidates');
    expect(source).toContain('adversarialPathExposureDelta');
    expect(source).toContain('providerLabel: providerSummary.providerLabel');
    expect(source).toContain("return { status, executeCommand, runCounterfactuals, runReportGeneration, dismissError, applyCandidate, mode, providerHealth, providerTelemetry, latestAiActionTelemetry };");
  });
});
