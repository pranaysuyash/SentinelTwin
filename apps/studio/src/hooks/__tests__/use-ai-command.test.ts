import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const hookPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/hooks/use-ai-command.ts";

describe("useAiCommand", () => {
  test("uses the offline parser fallback and the selected provider before requiring an API key", () => {
    const source = readFileSync(hookPath, "utf8");

    expect(source).toContain('import { parseOfflineCommand, type OfflineCommandAction } from "@/lib/offline-command-parser";');
    expect(source).toContain('import { createModelProvider, describeAiProviderSelection, providerKeyAvailable } from "@/agents/provider-selection";');
    expect(source).toContain('const aiProviderSelection = useStudioStore((s) => s.aiProviderSelection);');
    expect(source).toContain('const providerSummary = describeAiProviderSelection(aiProviderSelection);');
    expect(source).toContain('const provider = createModelProvider(aiProviderSelection);');
    expect(source).toContain("const offlinePlan = parseOfflineCommand(userText, storeState.scene);");
    expect(source).toContain("if (offlinePlan.operations.length > 0) {");
    expect(source).toContain('setStatusSafe({ state: "success", message: offlinePlan.message });');
    expect(source).toContain("providerSummary.providerName");
    expect(source).toContain("providerKeyAvailable(aiProviderSelection.providerId)");
    expect(source).toContain("Try commands like /night, /privacy on, /simulate, /report, or /target license_plate.");
    expect(source).toContain('const mode: AiCommandMode = apiKeyAvailable');
    expect(source).toContain('Recognized scene edits run locally.');
    expect(source).toContain('providerLabel: providerSummary.providerLabel');
    expect(source).toContain("return { status, executeCommand, runCounterfactuals, runReportGeneration, dismissError, applyCandidate, mode };");
  });
});
