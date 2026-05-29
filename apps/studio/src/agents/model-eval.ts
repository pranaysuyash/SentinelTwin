import { draftSceneFromPrompt, draftSceneFromPromptWithModel, summarizeDraftResult } from "@/lib/ai-layout-draft";
import { describeAiProviderGovernance, type AiProviderGovernanceSummary, type AiProviderSelection } from "@/agents/provider-selection";
import { buildPromptRegistrySnapshot, type PromptRegistrySnapshot } from "@/agents/prompt-registry";
import { parseCommand, type SceneContextSummary } from "@/agents/CommandAgent";
import { proposeCounterfactuals } from "@/agents/CounterfactualAgent";
import { buildSimulationSummary, generateReport } from "@/agents/ReportAgent";
import type { ModelProvider } from "@/agents/providers/ModelProvider";

export type ModelEvalFixtureKind = "baseline" | "command" | "counterfactual" | "report" | "draft";
export type ModelEvalFixtureStatus = "pass" | "fail" | "skip";

export type ModelEvalCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

export type ModelEvalFixtureResult = {
  id: string;
  label: string;
  kind: ModelEvalFixtureKind;
  status: ModelEvalFixtureStatus;
  summary: string;
  prompt: string;
  durationMs: number;
  checks: ModelEvalCheck[];
  outputPreview: string;
  skippedReason?: string;
};

export type ModelEvalSuiteSummary = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
};

export type ModelEvalSuiteResult = {
  generatedAt: number;
  provider: {
    providerId: AiProviderSelection["providerId"];
    providerName: string;
    providerLabel: string;
    model: string;
    localOnlyMode: boolean;
    cloudAvailable: boolean;
  };
  governance: AiProviderGovernanceSummary;
  promptRegistry: PromptRegistrySnapshot;
  summary: ModelEvalSuiteSummary;
  fixtures: ModelEvalFixtureResult[];
};

export type ModelEvalFixtureSummary = {
  id: string;
  label: string;
  kind: ModelEvalFixtureKind;
  status: ModelEvalFixtureStatus;
  durationMs: number;
};

export type ModelEvalStageBudget = {
  modeLabel: string;
  maxFailures: number;
  maxSkips: number;
  expectedSkips: number;
  expectedPasses: number;
  met: boolean;
  note: string;
};

export type ModelEvalRunRecord = {
  generatedAt: number;
  providerId: AiProviderSelection["providerId"];
  providerLabel: string;
  model: string;
  localOnlyMode: boolean;
  cloudAvailable: boolean;
  promptRegistry: PromptRegistrySnapshot;
  summary: ModelEvalSuiteSummary;
  stageBudget: ModelEvalStageBudget;
  fixtureSummaries: ModelEvalFixtureSummary[];
};

export type ModelEvalRunComparison = {
  previous: ModelEvalRunRecord;
  current: ModelEvalRunRecord;
  deltaPassed: number;
  deltaFailed: number;
  deltaSkipped: number;
  deltaTotalDurationMs: number;
  trendLabel: string;
};

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

function makeCheck(label: string, passed: boolean, detail: string): ModelEvalCheck {
  return { label, passed, detail };
}

function summarizePreview(value: unknown, maxLength = 220) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildEvalSceneContext(): SceneContextSummary {
  return {
    cameraNames: ["Camera 1", "Camera 2"],
    obstructionLabels: ["Shelf A", "Cash Counter"],
    lightNames: ["Front Light"],
    zoneLabels: ["Checkout"],
    activeCameraCount: 2,
    currentTimeOfDay: "day",
    dimensions: {
      width: 10,
      depth: 7,
      height: 3,
    },
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

function evaluateChecks(checks: ModelEvalCheck[]) {
  return checks.every((check) => check.passed);
}

function summarizeStageBudget(report: ModelEvalSuiteResult): ModelEvalStageBudget {
  const expectedSkips = report.provider.cloudAvailable ? 0 : report.summary.skipped;
  const expectedPasses = Math.max(0, report.summary.total - expectedSkips);
  const met = report.summary.failed === 0 && report.summary.skipped === expectedSkips;
  return {
    modeLabel: report.provider.localOnlyMode ? "Local-only budget" : "Cloud-backed budget",
    maxFailures: 0,
    maxSkips: expectedSkips,
    expectedSkips,
    expectedPasses,
    met,
    note: report.provider.localOnlyMode
      ? "Cloud fixtures may skip under local-only policy."
      : report.provider.cloudAvailable
        ? "All fixtures should run without skips when cloud-backed AI is available."
        : "Cloud fixtures skip because the active provider is unavailable.",
  };
}

export function summarizeModelEvalRun(report: ModelEvalSuiteResult): ModelEvalRunRecord {
  return {
    generatedAt: report.generatedAt,
    providerId: report.provider.providerId,
    providerLabel: report.provider.providerLabel,
    model: report.provider.model,
    localOnlyMode: report.provider.localOnlyMode,
    cloudAvailable: report.provider.cloudAvailable,
    promptRegistry: report.promptRegistry ?? buildPromptRegistrySnapshot(),
    summary: report.summary,
    stageBudget: summarizeStageBudget(report),
    fixtureSummaries: report.fixtures.map((fixture) => ({
      id: fixture.id,
      label: fixture.label,
      kind: fixture.kind,
      status: fixture.status,
      durationMs: fixture.durationMs,
    })),
  };
}

export function compareModelEvalRuns(previous: ModelEvalRunRecord, current: ModelEvalRunRecord): ModelEvalRunComparison {
  const deltaPassed = current.summary.passed - previous.summary.passed;
  const deltaFailed = current.summary.failed - previous.summary.failed;
  const deltaSkipped = current.summary.skipped - previous.summary.skipped;
  const deltaTotalDurationMs = current.fixtureSummaries.reduce((sum, fixture) => sum + fixture.durationMs, 0)
    - previous.fixtureSummaries.reduce((sum, fixture) => sum + fixture.durationMs, 0);
  const trendLabel = deltaFailed < 0
    ? "Improved"
    : deltaFailed > 0
      ? "Regressed"
      : deltaPassed > 0 || deltaSkipped < 0
        ? "Improved"
        : "Stable";
  return {
    previous,
    current,
    deltaPassed,
    deltaFailed,
    deltaSkipped,
    deltaTotalDurationMs,
    trendLabel,
  };
}

export function normalizeModelEvalRunRecord(input: unknown): ModelEvalRunRecord | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<ModelEvalRunRecord> & {
    stageBudget?: Partial<ModelEvalStageBudget>;
    summary?: Partial<ModelEvalSuiteSummary>;
    fixtureSummaries?: unknown;
    promptRegistry?: Partial<PromptRegistrySnapshot>;
  };
  const providerId = candidate.providerId === "openai" || candidate.providerId === "gemini" || candidate.providerId === "qwen"
    ? candidate.providerId
    : null;
  if (!providerId) return null;
  if (typeof candidate.providerLabel !== "string" || typeof candidate.model !== "string") return null;
  if (typeof candidate.generatedAt !== "number") return null;
  if (typeof candidate.localOnlyMode !== "boolean" || typeof candidate.cloudAvailable !== "boolean") return null;

  const promptRegistry = candidate.promptRegistry;
  const normalizedPromptRegistry: PromptRegistrySnapshot = promptRegistry && typeof promptRegistry === "object"
    ? {
        observedAt: typeof promptRegistry.observedAt === "number" ? promptRegistry.observedAt : candidate.generatedAt,
        total: typeof promptRegistry.total === "number" ? promptRegistry.total : 0,
        latestVersion: typeof promptRegistry.latestVersion === "string" ? promptRegistry.latestVersion : "v1",
        registryDigest: typeof promptRegistry.registryDigest === "string" ? promptRegistry.registryDigest : "unknown",
        stages: {
          command: typeof promptRegistry.stages?.command === "number" ? promptRegistry.stages.command : 0,
          counterfactual: typeof promptRegistry.stages?.counterfactual === "number" ? promptRegistry.stages.counterfactual : 0,
          report: typeof promptRegistry.stages?.report === "number" ? promptRegistry.stages.report : 0,
          draft: typeof promptRegistry.stages?.draft === "number" ? promptRegistry.stages.draft : 0,
        },
      }
    : buildPromptRegistrySnapshot();

  const summary = candidate.summary;
  if (!summary || typeof summary.total !== "number" || typeof summary.passed !== "number" || typeof summary.failed !== "number" || typeof summary.skipped !== "number") {
    return null;
  }

  const stageBudget = candidate.stageBudget;
  if (
    !stageBudget
    || typeof stageBudget.modeLabel !== "string"
    || typeof stageBudget.maxFailures !== "number"
    || typeof stageBudget.maxSkips !== "number"
    || typeof stageBudget.expectedSkips !== "number"
    || typeof stageBudget.expectedPasses !== "number"
    || typeof stageBudget.met !== "boolean"
    || typeof stageBudget.note !== "string"
  ) {
    return null;
  }

  if (!Array.isArray(candidate.fixtureSummaries)) return null;
  const fixtureSummaries = candidate.fixtureSummaries.flatMap((fixture) => {
    if (!fixture || typeof fixture !== "object") return [];
    const entry = fixture as Partial<ModelEvalFixtureSummary>;
    if (
      typeof entry.id !== "string"
      || typeof entry.label !== "string"
      || (entry.kind !== "baseline" && entry.kind !== "command" && entry.kind !== "counterfactual" && entry.kind !== "report" && entry.kind !== "draft")
      || (entry.status !== "pass" && entry.status !== "fail" && entry.status !== "skip")
      || typeof entry.durationMs !== "number"
    ) {
      return [];
    }
    return [{
      id: entry.id,
      label: entry.label,
      kind: entry.kind,
      status: entry.status,
      durationMs: entry.durationMs,
    }];
  });

  return {
    generatedAt: candidate.generatedAt,
    providerId,
    providerLabel: candidate.providerLabel,
    model: candidate.model,
    localOnlyMode: candidate.localOnlyMode,
    cloudAvailable: candidate.cloudAvailable,
    promptRegistry: normalizedPromptRegistry,
    summary: {
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
    },
    stageBudget: {
      modeLabel: stageBudget.modeLabel,
      maxFailures: stageBudget.maxFailures,
      maxSkips: stageBudget.maxSkips,
      expectedSkips: stageBudget.expectedSkips,
      expectedPasses: stageBudget.expectedPasses,
      met: stageBudget.met,
      note: stageBudget.note,
    },
    fixtureSummaries,
  };
}

export function loadModelEvalHistoryFromRaw(raw: string | null): ModelEvalRunRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const normalized = normalizeModelEvalRunRecord(item);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
}

export function serializeModelEvalHistory(history: ModelEvalRunRecord[]) {
  return JSON.stringify(history);
}

async function evaluateFixture(
  fixture: { id: string; label: string; kind: ModelEvalFixtureKind; prompt: string; requiresCloud?: boolean; run: FixtureRunner },
  context: ModelEvalContext,
): Promise<ModelEvalFixtureResult> {
  const startedAt = Date.now();
  const shouldSkip = fixture.requiresCloud && !context.cloudAvailable;
  if (shouldSkip) {
    return {
      id: fixture.id,
      label: fixture.label,
      kind: fixture.kind,
      status: "skip",
      summary: "Skipped because cloud-backed AI is unavailable under the current provider policy.",
      prompt: fixture.prompt,
      durationMs: Date.now() - startedAt,
      checks: [makeCheck("Provider availability", false, "Cloud-backed AI is unavailable.")],
      outputPreview: "Skipped",
      skippedReason: context.localOnlyMode
        ? "Local-only mode is enabled."
        : "No API key is configured for the active provider.",
    };
  }

  try {
    const payload = await fixture.run(context);
    const status = evaluateChecks(payload.checks) ? "pass" : "fail";
    return {
      id: fixture.id,
      label: fixture.label,
      kind: fixture.kind,
      status,
      summary: payload.summary,
      prompt: fixture.prompt,
      durationMs: Math.max(0, Date.now() - startedAt),
      checks: payload.checks,
      outputPreview: payload.outputPreview,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown model eval failure.";
    return {
      id: fixture.id,
      label: fixture.label,
      kind: fixture.kind,
      status: "fail",
      summary: "Fixture execution failed.",
      prompt: fixture.prompt,
      durationMs: Math.max(0, Date.now() - startedAt),
      checks: [makeCheck("Execution", false, message)],
      outputPreview: message,
    };
  }
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
        makeCheck("AI draft source", draft.scene.source === "ai", `source=${draft.scene.source}`),
        makeCheck("Heuristic mode", summary.modeLabel === "Heuristic fallback", summary.modeLabel),
        makeCheck("Expected structure", summary.counts.entryPoints >= 1 && summary.counts.cameras >= 2, `entries=${summary.counts.entryPoints}, cameras=${summary.counts.cameras}`),
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
        makeCheck("Returned operations", operations.length > 0, `${operations.length} operation(s)`),
        makeCheck("Toggled a camera", kinds.includes("toggle_camera"), kinds.join(", ") || "no operations"),
        makeCheck("Set time of day", kinds.includes("set_time_of_day"), kinds.join(", ") || "no operations"),
      ];
      return {
        summary: `${operations.length} operations · ${kinds.join(", ")}`,
        checks,
        outputPreview: summarizePreview(operations),
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
      const lowCostCount = candidates.filter((candidate) => candidate.costCategory === "free" || candidate.costCategory === "low").length;
      const checks = [
        makeCheck("Returned candidates", candidates.length >= 3, `${candidates.length} candidate(s)`),
        makeCheck("Has usable operations", candidates.some((candidate) => candidate.operations.length > 0), `${candidates.filter((candidate) => candidate.operations.length > 0).length} candidate(s)`),
        makeCheck("Has low-cost options", lowCostCount > 0, `${lowCostCount} low/free candidate(s)`),
      ];
      return {
        summary: `${candidates.length} candidates · ${lowCostCount} low/free`,
        checks,
        outputPreview: summarizePreview(candidates.map((candidate) => ({
          description: candidate.description,
          costCategory: candidate.costCategory,
          operations: candidate.operations,
        }))),
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
        makeCheck("Has title", report.title.trim().length > 0, report.title),
        makeCheck("Has executive summary", report.executiveSummary.trim().length > 0, report.executiveSummary.slice(0, 80)),
        makeCheck("Has sections", report.sections.length >= 3, `${report.sections.length} section(s)`),
      ];
      return {
        summary: `${report.sections.length} sections · ${report.recommendations.length} recommendations`,
        checks,
        outputPreview: summarizePreview({
          title: report.title,
          siteName: report.siteName,
          executiveSummary: report.executiveSummary,
          recommendations: report.recommendations,
        }),
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
        makeCheck("Model-backed mode", summary.modeLabel === "Model-backed", summary.modeLabel),
        makeCheck("Has cameras", summary.counts.cameras >= 2, `${summary.counts.cameras} camera(s)`),
        makeCheck("Has entry points", summary.counts.entryPoints >= 1, `${summary.counts.entryPoints} entry point(s)`),
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
    fixtures.push(await evaluateFixture(fixture, context));
  }

  const summary = fixtures.reduce<ModelEvalSuiteSummary>(
    (acc, fixture) => {
      acc.total += 1;
      if (fixture.status === "pass") acc.passed += 1;
      else if (fixture.status === "fail") acc.failed += 1;
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
