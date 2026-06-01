import type { AiProviderSelection, AiProviderGovernanceSummary } from "./provider-selection";
import { describeAiProviderGovernance } from "./provider-selection";
import { buildPromptRegistrySnapshot, type PromptRegistrySnapshot } from "./prompt-registry";

export type ModelEvalFixtureKind = "baseline" | "command" | "counterfactual" | "report" | "draft" | "scene_understanding";
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
  requiresCloud?: boolean;
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

export function makeCheck(label: string, passed: boolean, detail: string): ModelEvalCheck {
  return { label, passed, detail };
}

export function summarizePreview(value: unknown, maxLength = 220) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export function evaluateChecks(checks: ModelEvalCheck[]) {
  return checks.every((check) => check.passed);
}

export function summarizeStageBudget(
  total: number,
  cloudAvailable: boolean,
  localOnlyMode: boolean,
  summary: ModelEvalSuiteSummary,
  cloudRequiredFixtureCount: number,
): ModelEvalStageBudget {
  const expectedSkips = cloudAvailable ? 0 : cloudRequiredFixtureCount;
  const expectedPasses = Math.max(0, total - expectedSkips);
  const met = summary.failed === 0 && summary.skipped === expectedSkips;
  return {
    modeLabel: localOnlyMode ? "Local-only budget" : "Cloud-backed budget",
    maxFailures: 0,
    maxSkips: expectedSkips,
    expectedSkips,
    expectedPasses,
    met,
    note: localOnlyMode
      ? "Cloud fixtures may skip under local-only policy."
      : cloudAvailable
        ? "All fixtures should run without skips when cloud-backed AI is available."
        : "Cloud fixtures skip because the active provider is unavailable.",
  };
}

export function summarizeModelEvalRun(
  report: ModelEvalSuiteResult,
  cloudRequiredFixtureCount: number,
): ModelEvalRunRecord {
  return {
    generatedAt: report.generatedAt,
    providerId: report.provider.providerId,
    providerLabel: report.provider.providerLabel,
    model: report.provider.model,
    localOnlyMode: report.provider.localOnlyMode,
    cloudAvailable: report.provider.cloudAvailable,
    promptRegistry: report.promptRegistry ?? buildPromptRegistrySnapshot(),
    summary: report.summary,
    stageBudget: summarizeStageBudget(
      report.summary.total,
      report.provider.cloudAvailable,
      report.provider.localOnlyMode,
      report.summary,
      cloudRequiredFixtureCount,
    ),
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
  const deltaTotalDurationMs = current.fixtureSummaries.reduce((sum, f) => sum + f.durationMs, 0)
    - previous.fixtureSummaries.reduce((sum, f) => sum + f.durationMs, 0);
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
  const providerId = candidate.providerId === "openai" || candidate.providerId === "gemini" || candidate.providerId === "qwen" || candidate.providerId === "local"
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
          scene_understanding: typeof promptRegistry.stages?.scene_understanding === "number" ? promptRegistry.stages.scene_understanding : 0,
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
      || (entry.kind !== "baseline" && entry.kind !== "command" && entry.kind !== "counterfactual" && entry.kind !== "report" && entry.kind !== "draft" && entry.kind !== "scene_understanding")
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

export function getCloudRequiredFixtureCount(fixtures: Array<{ requiresCloud?: boolean }>): number {
  return fixtures.filter((fixture) => fixture.requiresCloud).length;
}

export async function evaluateFixture(
  fixture: {
    id: string;
    label: string;
    kind: ModelEvalFixtureKind;
    prompt: string;
    requiresCloud?: boolean;
    run: (context: Record<string, unknown>) => Promise<{ summary: string; checks: ModelEvalCheck[]; outputPreview: string }>;
  },
  context: Record<string, unknown>,
  cloudAvailable: boolean,
  localOnlyMode: boolean,
): Promise<ModelEvalFixtureResult> {
  const startedAt = Date.now();
  const shouldSkip = fixture.requiresCloud && !cloudAvailable;
  if (shouldSkip) {
    return {
      id: fixture.id,
      label: fixture.label,
      kind: fixture.kind,
      status: "skip",
      summary: "Skipped because cloud-backed AI is unavailable under the current provider policy.",
      prompt: fixture.prompt,
      durationMs: Date.now() - startedAt,
      requiresCloud: fixture.requiresCloud === true,
      checks: [makeCheck("Provider availability", false, "Cloud-backed AI is unavailable.")],
      outputPreview: "Skipped",
      skippedReason: localOnlyMode
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
      requiresCloud: fixture.requiresCloud === true,
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
      requiresCloud: fixture.requiresCloud === true,
      checks: [makeCheck("Execution", false, message)],
      outputPreview: message,
    };
  }
}
