// Re-export framework from @sentineltwin/agents
export {
  makeCheck, summarizePreview, evaluateChecks,
  summarizeStageBudget, summarizeModelEvalRun, compareModelEvalRuns,
  normalizeModelEvalRunRecord, loadModelEvalHistoryFromRaw,
  serializeModelEvalHistory, getCloudRequiredFixtureCount, evaluateFixture,
  PROMPT_REGISTRY,
} from "@sentineltwin/agents";

export type {
  ModelEvalFixtureKind, ModelEvalFixtureStatus, ModelEvalCheck,
  ModelEvalFixtureResult, ModelEvalSuiteSummary, ModelEvalSuiteResult,
  ModelEvalFixtureSummary, ModelEvalStageBudget, ModelEvalRunRecord,
  ModelEvalRunComparison, PromptRegistrySnapshot, AiProviderSelection,
  AiProviderGovernanceSummary,
} from "@sentineltwin/agents";

// App-specific imports for fixture runners
import { draftSceneFromPrompt, draftSceneFromPromptWithModel, summarizeDraftResult } from "@/lib/ai-layout-draft";
import { describeAiProviderGovernance, type AiProviderGovernanceSummary, type AiProviderSelection } from "@sentineltwin/agents";
import { buildPromptRegistrySnapshot, type PromptRegistrySnapshot } from "@sentineltwin/agents";
import { parseCommand, type SceneContextSummary } from "@sentineltwin/agents";
import { proposeCounterfactuals } from "@sentineltwin/agents";
import { buildSimulationSummary, generateReport } from "@sentineltwin/agents";
import type { ModelProvider } from "@sentineltwin/agents";

import type { ModelEvalCheck, ModelEvalFixtureResult, ModelEvalFixtureKind, ModelEvalSuiteResult, ModelEvalSuiteSummary } from "@sentineltwin/agents";

type ModelEvalContext = {
  provider: ModelProvider;
  selection: AiProviderSelection;
  governance: AiProviderGovernanceSummary;
  localOnlyMode: boolean;
  cloudAvailable: boolean;
};

type FixtureRunner = (
  context: ModelEvalContext,
) => Promise<{
  summary: string;
  checks: ModelEvalCheck[];
  outputPreview: string;
}>;

function buildEvalSceneContext(): SceneContextSummary {
  return {
    cameraNames: ["Camera 1", "Camera 2"],
    obstructionLabels: ["Shelf A", "Cash Counter"],
    lightNames: ["Front Light"],
    zoneLabels: ["Checkout"],
    activeCameraCount: 2,
    currentTimeOfDay: "day",
    dimensions: { width: 10, depth: 7, height: 3 },
  };
}

function buildReportSimulationSummary() {
  return buildSimulationSummary({
    totalCoveragePct: 87.2,
    blindspotPct: 12.8,
    averageWalkableQuality: 1.76,
    worstAreaQuality: "observation",
    recognitionAreaPct: 61.3,
    identificationAreaPct: 31.7,
    coverageByQuality: {
      none: 12.8,
      detection: 18.5,
      observation: 24.1,
      recognition: 31.1,
      identification: 13.5,
    },
    issues: [
      { severity: "high", description: "Front aisle has a recognition gap near the entry." },
      { severity: "medium", description: "Checkout counter is only observed by one camera." },
    ],
    recommendations: [
      { description: "Re-aim Camera 1 toward the front aisle.", costCategory: "low", verified: true },
      { description: "Add one camera at the cashier line.", costCategory: "medium", verified: false },
    ],
    criticalZoneResults: [
      { label: "Checkout", actualQuality: "recognition", requiredQuality: "identification", status: "warning" },
    ],
    cameraResults: [
      { cameraId: "Camera 1", coveragePct: 44.2 },
      { cameraId: "Camera 2", coveragePct: 38.9 },
    ],
  });
}

const MODEL_EVAL_FIXTURES: Array<{
  id: string;
  label: string;
  kind: ModelEvalFixtureKind;
  prompt: string;
  requiresCloud?: boolean;
  run: FixtureRunner;
}> = [
  {
    id: "heuristic_layout_baseline",
    label: "Heuristic Layout Baseline",
    kind: "baseline",
    prompt: "Create a 10m x 7m electronics shop with front entry, two shelves, a cash counter, and two cameras.",
    run: async () => {
      const draft = draftSceneFromPrompt("Create a 10m x 7m electronics shop with front entry, two shelves, a cash counter, and two cameras.");
      const summary = summarizeDraftResult(draft);
      const checks = [
        { label: "AI draft source", passed: draft.scene.source === "ai", detail: `source=${draft.scene.source}` },
        { label: "Heuristic mode", passed: summary.modeLabel === "Heuristic fallback", detail: summary.modeLabel },
        { label: "Expected structure", passed: summary.counts.entryPoints >= 1 && summary.counts.cameras >= 2, detail: `entries=${summary.counts.entryPoints}, cameras=${summary.counts.cameras}` },
      ];
      return {
        summary: `${summary.modeLabel} · ${summary.counts.cameras} cameras · ${summary.counts.entryPoints} entries`,
        checks,
        outputPreview: `${summary.sceneName}\n${summary.summary}`,
      };
    },
  },
  {
    id: "command_parse",
    label: "Command Parse",
    kind: "command",
    prompt: "Turn camera 1 off and switch to night mode.",
    requiresCloud: true,
    run: async ({ provider }) => {
      const operations = await parseCommand(
        "Turn camera 1 off and switch to night mode.",
        buildEvalSceneContext(),
        provider,
      );
      const kinds = operations.map((operation) => operation.type);
      const checks = [
        { label: "Returned operations", passed: operations.length > 0, detail: `${operations.length} operation(s)` },
        { label: "Toggled a camera", passed: kinds.includes("toggle_camera"), detail: kinds.join(", ") || "no operations" },
        { label: "Set time of day", passed: kinds.includes("set_time_of_day"), detail: kinds.join(", ") || "no operations" },
      ];
      return {
        summary: `${operations.length} operations · ${kinds.join(", ")}`,
        checks,
        outputPreview: JSON.stringify(operations, null, 2).slice(0, 220),
      };
    },
  },
  {
    id: "counterfactual_candidates",
    label: "Counterfactual Candidates",
    kind: "counterfactual",
    prompt: "Give low-cost coverage fixes for a blind spot at the checkout counter.",
    requiresCloud: true,
    run: async ({ provider }) => {
      const candidates = await proposeCounterfactuals(
        "Checkout blind spot and a weak front-aisle recognition gap.",
        "Retail pilot site with a front entry, checkout counter, two shelves, and two cameras.",
        ["Prefer low-cost changes", "Avoid adding more than one camera if a re-aim works"],
        provider,
      );
      const lowCostCount = candidates.filter((c) => c.costCategory === "free" || c.costCategory === "low").length;
      const checks = [
        { label: "Returned candidates", passed: candidates.length >= 3, detail: `${candidates.length} candidate(s)` },
        { label: "Has usable operations", passed: candidates.some((c) => c.operations.length > 0), detail: `${candidates.filter((c) => c.operations.length > 0).length} candidate(s)` },
        { label: "Has low-cost options", passed: lowCostCount > 0, detail: `${lowCostCount} low/free candidate(s)` },
      ];
      return {
        summary: `${candidates.length} candidates · ${lowCostCount} low/free`,
        checks,
        outputPreview: JSON.stringify(candidates.map((c) => ({ description: c.description, costCategory: c.costCategory, operations: c.operations }))).slice(0, 220),
      };
    },
  },
  {
    id: "report_generation",
    label: "Report Generation",
    kind: "report",
    prompt: "Write the executive summary and recommendations for a retail shop coverage audit.",
    requiresCloud: true,
    run: async ({ provider }) => {
      const simulationSummary = buildReportSimulationSummary();
      const report = await generateReport(
        simulationSummary,
        "Retail Pilot Site — 10m x 7m shop with a front entry, checkout counter, shelves, and two cameras.",
        provider,
      );
      const checks = [
        { label: "Has title", passed: report.title.trim().length > 0, detail: report.title },
        { label: "Has executive summary", passed: report.executiveSummary.trim().length > 0, detail: report.executiveSummary.slice(0, 80) },
        { label: "Has sections", passed: report.sections.length >= 3, detail: `${report.sections.length} section(s)` },
      ];
      return {
        summary: `${report.sections.length} sections · ${report.recommendations.length} recommendations`,
        checks,
        outputPreview: JSON.stringify({ title: report.title, siteName: report.siteName, executiveSummary: report.executiveSummary, recommendations: report.recommendations }).slice(0, 220),
      };
    },
  },
  {
    id: "model_layout_draft",
    label: "Model Layout Draft",
    kind: "draft",
    prompt: "Create a 10m x 7m retail shop with a front entry, two shelves, a cash counter, and two cameras.",
    requiresCloud: true,
    run: async ({ provider }) => {
      const draft = await draftSceneFromPromptWithModel(
        "Create a 10m x 7m retail shop with a front entry, two shelves, a cash counter, and two cameras.",
        provider,
      );
      const summary = summarizeDraftResult(draft);
      const checks = [
        { label: "Model-backed mode", passed: summary.modeLabel === "Model-backed", detail: summary.modeLabel },
        { label: "Has cameras", passed: summary.counts.cameras >= 2, detail: `${summary.counts.cameras} camera(s)` },
        { label: "Has entry points", passed: summary.counts.entryPoints >= 1, detail: `${summary.counts.entryPoints} entry point(s)` },
      ];
      return {
        summary: `${summary.modeLabel} · ${summary.counts.cameras} cameras · ${summary.counts.entryPoints} entries`,
        checks,
        outputPreview: `${summary.sceneName}\n${summary.summary}`,
      };
    },
  },
];

export async function runModelEvalSuite(
  provider: ModelProvider,
  selection: AiProviderSelection,
  localOnlyMode: boolean,
): Promise<ModelEvalSuiteResult> {
  const governanceSummary = describeAiProviderGovernance(selection, localOnlyMode);
  const cloudAvailable = governanceSummary.cloudAvailable;
  const context: ModelEvalContext = {
    provider,
    selection,
    governance: governanceSummary,
    localOnlyMode,
    cloudAvailable,
  };

  const fixtures = [];
  for (const fixture of MODEL_EVAL_FIXTURES) {
    const startedAt = Date.now();
    const shouldSkip = fixture.requiresCloud && !cloudAvailable;
    if (shouldSkip) {
      fixtures.push({
        id: fixture.id,
        label: fixture.label,
        kind: fixture.kind,
        status: "skip" as const,
        summary: "Skipped because cloud-backed AI is unavailable under the current provider policy.",
        prompt: fixture.prompt,
        durationMs: Date.now() - startedAt,
        checks: [{ label: "Provider availability", passed: false, detail: "Cloud-backed AI is unavailable." }],
        outputPreview: "Skipped",
        skippedReason: localOnlyMode ? "Local-only mode is enabled." : "No API key is configured for the active provider.",
      });
      continue;
    }

    try {
      const payload = await fixture.run(context);
      const passed = payload.checks.every((c) => c.passed);
      fixtures.push({
        id: fixture.id,
        label: fixture.label,
        kind: fixture.kind,
        status: passed ? "pass" as const : "fail" as const,
        summary: payload.summary,
        prompt: fixture.prompt,
        durationMs: Math.max(0, Date.now() - startedAt),
        checks: payload.checks,
        outputPreview: payload.outputPreview,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown model eval failure.";
      fixtures.push({
        id: fixture.id,
        label: fixture.label,
        kind: fixture.kind,
        status: "fail" as const,
        summary: "Fixture execution failed.",
        prompt: fixture.prompt,
        durationMs: Math.max(0, Date.now() - startedAt),
        checks: [{ label: "Execution", passed: false, detail: message }],
        outputPreview: message,
      });
    }
  }

  const summary = fixtures.reduce<ModelEvalSuiteSummary>(
    (acc, f) => {
      acc.total += 1;
      if (f.status === "pass") acc.passed += 1;
      else if (f.status === "fail") acc.failed += 1;
      else acc.skipped += 1;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0 },
  );

  return {
    generatedAt: Date.now(),
    provider: {
      providerId: selection.providerId,
      providerName: governanceSummary.activeProviderName,
      providerLabel: governanceSummary.activeProviderLabel,
      model: selection.model,
      localOnlyMode,
      cloudAvailable,
    },
    governance: governanceSummary,
    promptRegistry: buildPromptRegistrySnapshot(),
    summary,
    fixtures,
  };
}
