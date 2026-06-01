// Types
export type { AiActionTelemetryStage, AgentRole, AgentTask, AgentResult } from "./types";

// Providers
export type {
  ModelProvider, ModelPrompt, ModelResponse, ConversationMessage,
  ImageInput, ToolDefinition, ToolCall, ToolCallResult,
} from "./providers/ModelProvider";

export { OpenAIProvider } from "./providers/OpenAIProvider";
export { GeminiProvider } from "./providers/GeminiProvider";
export { QwenProvider } from "./providers/QwenProvider";
export { LocalProvider } from "./providers/LocalProvider";

export {
  TokenTracker, globalTokenTracker, RateLimiter, retryWithFallback,
  DEFAULT_AGENT_CONFIG,
} from "./providers/AgentConfig";
export type { TokenUsage, TokenTrackerEntry, AgentConfig } from "./providers/AgentConfig";

// Coordinator
export { ConversationMemory, CoordinatorAgent, globalCoordinator } from "./coordinator";

// Agents
export { proposeCounterfactuals } from "./counterfactual-agent";
export type { CounterfactualCandidate } from "./counterfactual-agent";

export { generateReport, buildSimulationSummary } from "./report-agent";
export type { ReportSection, SecurityReport } from "./report-agent";

// Provider Selection
export {
  AI_PROVIDER_OPTIONS, DEFAULT_AI_PROVIDER_SELECTION,
  normalizeAiProviderSelection, createModelProvider, providerKeyAvailable,
  getProviderOption, describeAiProviderSelection,
  describeAiProviderGovernance, describeAiProviderHealth, describeAiProviderTelemetry,
} from "./provider-selection";
export type {
  AiProviderId, AiProviderSelection, AiProviderGovernanceSummary,
  AiProviderHealthStatus, AiProviderHealthSummary,
  AiProviderCostTier, AiProviderLatencyTier, AiProviderOption,
  AiProviderTelemetrySummary, AiTelemetryStageId, AiTelemetryStagePolicy,
} from "./provider-selection";

// Prompt Registry
export {
  PROMPT_REGISTRY, getPromptRegistryEntry, resolvePromptRegistryLineage,
  summarizePromptRegistry, buildPromptRegistrySnapshot,
} from "./prompt-registry";
export type {
  PromptRegistryEntry, PromptRegistryStage, PromptRegistrySummary,
  PromptRegistrySnapshot, PromptRegistryLineage,
} from "./prompt-registry";

// Model Eval
export {
  makeCheck, summarizePreview, evaluateChecks,
  summarizeStageBudget, summarizeModelEvalRun, compareModelEvalRuns,
  normalizeModelEvalRunRecord, loadModelEvalHistoryFromRaw,
  serializeModelEvalHistory, getCloudRequiredFixtureCount, evaluateFixture,
} from "./model-eval";
export type {
  ModelEvalFixtureKind, ModelEvalFixtureStatus, ModelEvalCheck,
  ModelEvalFixtureResult, ModelEvalSuiteSummary, ModelEvalSuiteResult,
  ModelEvalFixtureSummary, ModelEvalStageBudget, ModelEvalRunRecord,
  ModelEvalRunComparison,
} from "./model-eval";

// Scene Understanding Agent
export { analyzeSceneUnderstanding, buildSceneUnderstandingSummary } from "./scene-understanding-agent";
export type { SceneUnderstandingResult } from "./scene-understanding-agent";
