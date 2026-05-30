import { GeminiProvider } from "@/agents/providers/GeminiProvider";
import { OpenAIProvider } from "@/agents/providers/OpenAIProvider";
import { QwenProvider } from "@/agents/providers/QwenProvider";
import type { ModelProvider } from "@/agents/providers/ModelProvider";

export type AiProviderId = "openai" | "gemini" | "qwen";

export type AiProviderSelection = {
  providerId: AiProviderId;
  model: string;
};

export type AiProviderGovernanceSummary = {
  activeProviderId: AiProviderId;
  activeProviderName: string;
  activeProviderLabel: string;
  activeModel: string;
  activeEnvKey: string;
  localOnlyMode: boolean;
  cloudAvailable: boolean;
  fallbackOrder: Array<{
    providerId: AiProviderId;
    name: string;
    label: string;
    model: string;
    envKey: string;
    available: boolean;
    isActive: boolean;
    fallbackPriority: number;
  }>;
};

export type AiProviderHealthStatus = "healthy" | "partial" | "blocked";

export type AiProviderHealthSummary = {
  overallStatus: AiProviderHealthStatus;
  healthyProviders: number;
  partialProviders: number;
  blockedProviders: number;
  totalProviders: number;
  localOnlyMode: boolean;
  activeProviderStatus: AiProviderHealthStatus;
  providers: Array<{
    providerId: AiProviderId;
    name: string;
    label: string;
    model: string;
    envKey: string;
    available: boolean;
    active: boolean;
    status: AiProviderHealthStatus;
    detail: string;
  }>;
};

export type AiProviderCostTier = "free" | "low" | "medium" | "high";

export type AiProviderLatencyTier = "fast" | "standard" | "slow";

export type AiTelemetryStageId = "command" | "counterfactual" | "report" | "draft";

export type AiTelemetryStagePolicy = {
  stage: AiTelemetryStageId;
  label: string;
  maxCostTier: AiProviderCostTier;
  maxLatencyTier: AiProviderLatencyTier;
  ready: boolean;
  note: string;
};

export type AiProviderTelemetrySummary = {
  overallStatus: "ready" | "guarded" | "blocked";
  localOnlyMode: boolean;
  activeProviderId: AiProviderId;
  activeProviderName: string;
  activeProviderLabel: string;
  activeModel: string;
  activeCostTier: AiProviderCostTier;
  activeLatencyTier: AiProviderLatencyTier;
  activeCostLabel: string;
  activeLatencyLabel: string;
  stagePolicies: AiTelemetryStagePolicy[];
  providers: Array<{
    providerId: AiProviderId;
    name: string;
    label: string;
    model: string;
    envKey: string;
    available: boolean;
    active: boolean;
    costTier: AiProviderCostTier;
    latencyTier: AiProviderLatencyTier;
    costLabel: string;
    latencyLabel: string;
    detail: string;
    stageReadiness: Record<AiTelemetryStageId, boolean>;
  }>;
};

export type AiProviderOption = {
  id: AiProviderId;
  name: string;
  description: string;
  envKey: string;
  defaultModel: string;
  models: string[];
  create: (model: string) => ModelProvider;
};

export const AI_PROVIDER_OPTIONS: AiProviderOption[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o / GPT-4.1 structured output",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
    create: (model: string) => new OpenAIProvider(model),
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Gemini 2.5 Flash / Pro via Google AI",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    create: (model: string) => new GeminiProvider(model),
  },
  {
    id: "qwen",
    name: "Qwen",
    description: "Qwen2.5-VL via Together AI",
    envKey: "TOGETHER_API_KEY",
    defaultModel: "Qwen/Qwen2.5-VL-72B-Instruct-Turbo",
    models: [
      "Qwen/Qwen2.5-VL-72B-Instruct-Turbo",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      "Qwen/Qwen2.5-32B-Instruct",
    ],
    create: (model: string) => new QwenProvider(model),
  },
];

export const DEFAULT_AI_PROVIDER_SELECTION: AiProviderSelection = {
  providerId: "openai",
  model: "gpt-4o",
};

const COST_TIER_ORDER: Record<AiProviderCostTier, number> = {
  free: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const LATENCY_TIER_ORDER: Record<AiProviderLatencyTier, number> = {
  fast: 0,
  standard: 1,
  slow: 2,
};

const AI_TELEMETRY_STAGE_POLICIES: Array<{
  stage: AiTelemetryStageId;
  label: string;
  maxCostTier: AiProviderCostTier;
  maxLatencyTier: AiProviderLatencyTier;
}> = [
  { stage: "command", label: "Command parse", maxCostTier: "low", maxLatencyTier: "fast" },
  { stage: "counterfactual", label: "Counterfactual", maxCostTier: "medium", maxLatencyTier: "standard" },
  { stage: "report", label: "Report generation", maxCostTier: "medium", maxLatencyTier: "standard" },
  { stage: "draft", label: "AI layout draft", maxCostTier: "high", maxLatencyTier: "standard" },
];

function isWithinCostTier(current: AiProviderCostTier, limit: AiProviderCostTier) {
  return COST_TIER_ORDER[current] <= COST_TIER_ORDER[limit];
}

function isWithinLatencyTier(current: AiProviderLatencyTier, limit: AiProviderLatencyTier) {
  return LATENCY_TIER_ORDER[current] <= LATENCY_TIER_ORDER[limit];
}

function inferProviderTelemetry(selection: AiProviderSelection): {
  costTier: AiProviderCostTier;
  latencyTier: AiProviderLatencyTier;
  costLabel: string;
  latencyLabel: string;
  detail: string;
} {
  const model = selection.model.toLowerCase();

  if (selection.providerId === "openai") {
    if (model.includes("mini")) {
      return {
        costTier: "low",
        latencyTier: "fast",
        costLabel: "Low estimated cost",
        latencyLabel: "Fast estimated latency",
        detail: "OpenAI mini models are the low-friction path for quick command and layout work.",
      };
    }

    return {
      costTier: "high",
      latencyTier: model.includes("4.1") ? "standard" : "standard",
      costLabel: "High estimated cost",
      latencyLabel: "Standard estimated latency",
      detail: "OpenAI structured-output models are strong but generally sit above the lightest budget tier.",
    };
  }

  if (selection.providerId === "gemini") {
    if (model.includes("flash")) {
      return {
        costTier: "low",
        latencyTier: "fast",
        costLabel: "Low estimated cost",
        latencyLabel: "Fast estimated latency",
        detail: "Gemini Flash is the quickest path for interactive AI guidance.",
      };
    }

    return {
      costTier: "medium",
      latencyTier: "standard",
      costLabel: "Medium estimated cost",
      latencyLabel: "Standard estimated latency",
      detail: "Gemini Pro is a balanced option for deeper structured reasoning.",
    };
  }

  if (model.includes("32b")) {
    return {
      costTier: "medium",
      latencyTier: "standard",
      costLabel: "Medium estimated cost",
      latencyLabel: "Standard estimated latency",
      detail: "Qwen 32B keeps the structured-output path practical without pushing the highest latency tier.",
    };
  }

  return {
    costTier: "high",
    latencyTier: "slow",
    costLabel: "High estimated cost",
    latencyLabel: "Slow estimated latency",
    detail: "Large Qwen vision-language models are powerful but sit at the top of the cost and latency budget.",
  };
}

export function getProviderOption(providerId: AiProviderId) {
  return AI_PROVIDER_OPTIONS.find((option) => option.id === providerId) ?? AI_PROVIDER_OPTIONS[0]!;
}

function normalizeProviderModel(option: AiProviderOption, model?: string | null): string {
  const trimmedModel = typeof model === "string" ? model.trim() : "";
  if (!trimmedModel) {
    return option.defaultModel;
  }

  const matchedModel = option.models.find((candidate) => candidate.toLowerCase() === trimmedModel.toLowerCase());
  return matchedModel ?? option.defaultModel;
}

export function normalizeAiProviderSelection(selection?: Partial<AiProviderSelection> | null): AiProviderSelection {
  const providerId = selection?.providerId && AI_PROVIDER_OPTIONS.some((option) => option.id === selection.providerId)
    ? selection.providerId
    : DEFAULT_AI_PROVIDER_SELECTION.providerId;
  const option = getProviderOption(providerId);
  const model = normalizeProviderModel(option, selection?.model);
  return { providerId, model };
}

export function createModelProvider(selection: AiProviderSelection): ModelProvider {
  const normalizedSelection = normalizeAiProviderSelection(selection);
  const option = getProviderOption(normalizedSelection.providerId);
  return option.create(normalizedSelection.model);
}

export function providerKeyAvailable(providerId: AiProviderId): boolean {
  const option = getProviderOption(providerId);
  if (typeof process === "undefined") return false;
  return Boolean(process.env[option.envKey as keyof NodeJS.ProcessEnv]);
}

export function describeAiProviderSelection(selection: AiProviderSelection) {
  const normalizedSelection = normalizeAiProviderSelection(selection);
  const option = getProviderOption(normalizedSelection.providerId);
  return {
    providerName: option.name,
    providerLabel: `${option.name} · ${normalizedSelection.model}`,
    description: option.description,
    envKey: option.envKey,
    cloudAvailable: providerKeyAvailable(normalizedSelection.providerId),
  };
}

export function describeAiProviderGovernance(
  selection: AiProviderSelection,
  localOnlyMode: boolean,
): AiProviderGovernanceSummary {
  const normalizedSelection = normalizeAiProviderSelection(selection);
  const activeOption = getProviderOption(normalizedSelection.providerId);
  const cloudAvailable = providerKeyAvailable(normalizedSelection.providerId);
  return {
    activeProviderId: normalizedSelection.providerId,
    activeProviderName: activeOption.name,
    activeProviderLabel: `${activeOption.name} · ${normalizedSelection.model}`,
    activeModel: normalizedSelection.model,
    activeEnvKey: activeOption.envKey,
    localOnlyMode,
    cloudAvailable: cloudAvailable && !localOnlyMode,
    fallbackOrder: AI_PROVIDER_OPTIONS.map((option, index) => ({
      providerId: option.id,
      name: option.name,
      label: `${option.name} · ${option.defaultModel}`,
      model: option.defaultModel,
      envKey: option.envKey,
      available: providerKeyAvailable(option.id),
      isActive: option.id === selection.providerId,
      fallbackPriority: option.id === selection.providerId ? 0 : index + 1,
    })).sort((a, b) => a.fallbackPriority - b.fallbackPriority),
  };
}

export function describeAiProviderHealth(
  selection: AiProviderSelection,
  localOnlyMode: boolean,
): AiProviderHealthSummary {
  const governance = describeAiProviderGovernance(selection, localOnlyMode);
  const providers = governance.fallbackOrder.map((entry) => {
    const status: AiProviderHealthStatus = localOnlyMode
      ? "blocked"
      : entry.available
        ? "healthy"
        : "partial";
    return {
      providerId: entry.providerId,
      name: entry.name,
      label: entry.label,
      model: entry.model,
      envKey: entry.envKey,
      available: entry.available,
      active: entry.isActive,
      status,
      detail: localOnlyMode
        ? "Blocked by local-only policy."
        : entry.available
          ? "Ready for cloud-backed runs."
          : "API key missing; can still fall back locally.",
    };
  });

  const healthyProviders = providers.filter((provider) => provider.status === "healthy").length;
  const partialProviders = providers.filter((provider) => provider.status === "partial").length;
  const blockedProviders = providers.filter((provider) => provider.status === "blocked").length;
  const activeProviderStatus = providers.find((provider) => provider.active)?.status ?? "partial";
  const overallStatus: AiProviderHealthStatus = localOnlyMode
    ? "blocked"
    : healthyProviders > 0
      ? "healthy"
      : partialProviders > 0
        ? "partial"
        : "blocked";

  return {
    overallStatus,
    healthyProviders,
    partialProviders,
    blockedProviders,
    totalProviders: providers.length,
    localOnlyMode,
    activeProviderStatus,
    providers,
  };
}

export function describeAiProviderTelemetry(
  selection: AiProviderSelection,
  localOnlyMode: boolean,
): AiProviderTelemetrySummary {
  const normalizedSelection = normalizeAiProviderSelection(selection);
  const governance = describeAiProviderGovernance(normalizedSelection, localOnlyMode);
  const activeTelemetry = inferProviderTelemetry(normalizedSelection);
  const stagePolicies = AI_TELEMETRY_STAGE_POLICIES.map((stage) => ({
    ...stage,
    ready:
      !localOnlyMode &&
      isWithinCostTier(activeTelemetry.costTier, stage.maxCostTier) &&
      isWithinLatencyTier(activeTelemetry.latencyTier, stage.maxLatencyTier),
    note: localOnlyMode
      ? "Blocked by local-only policy."
      : `${activeTelemetry.costLabel} · ${activeTelemetry.latencyLabel}`,
  }));

  const providers = governance.fallbackOrder.map((entry) => {
    const telemetry = inferProviderTelemetry({ providerId: entry.providerId, model: entry.model });
    const stageReadiness = Object.fromEntries(
      AI_TELEMETRY_STAGE_POLICIES.map((stage) => [
        stage.stage,
        !localOnlyMode &&
          isWithinCostTier(telemetry.costTier, stage.maxCostTier) &&
          isWithinLatencyTier(telemetry.latencyTier, stage.maxLatencyTier),
      ]),
    ) as Record<AiTelemetryStageId, boolean>;
    return {
      providerId: entry.providerId,
      name: entry.name,
      label: entry.label,
      model: entry.model,
      envKey: entry.envKey,
      available: entry.available,
      active: entry.isActive,
      costTier: telemetry.costTier,
      latencyTier: telemetry.latencyTier,
      costLabel: telemetry.costLabel,
      latencyLabel: telemetry.latencyLabel,
      detail: localOnlyMode
        ? "Blocked by local-only policy."
        : telemetry.detail,
      stageReadiness,
    };
  });

  const overallStatus: AiProviderTelemetrySummary["overallStatus"] = localOnlyMode
    ? "blocked"
    : stagePolicies.every((stage) => stage.ready)
      ? "ready"
      : stagePolicies.some((stage) => stage.ready)
        ? "guarded"
        : "blocked";

  return {
    overallStatus,
    localOnlyMode,
    activeProviderId: governance.activeProviderId,
    activeProviderName: governance.activeProviderName,
    activeProviderLabel: governance.activeProviderLabel,
    activeModel: governance.activeModel,
    activeCostTier: activeTelemetry.costTier,
    activeLatencyTier: activeTelemetry.latencyTier,
    activeCostLabel: activeTelemetry.costLabel,
    activeLatencyLabel: activeTelemetry.latencyLabel,
    stagePolicies,
    providers,
  };
}
