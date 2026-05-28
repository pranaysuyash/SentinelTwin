import { GeminiProvider } from "@/agents/providers/GeminiProvider";
import { OpenAIProvider } from "@/agents/providers/OpenAIProvider";
import { QwenProvider } from "@/agents/providers/QwenProvider";
import type { ModelProvider } from "@/agents/providers/ModelProvider";

export type AiProviderId = "openai" | "gemini" | "qwen";

export type AiProviderSelection = {
  providerId: AiProviderId;
  model: string;
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

export function getProviderOption(providerId: AiProviderId) {
  return AI_PROVIDER_OPTIONS.find((option) => option.id === providerId) ?? AI_PROVIDER_OPTIONS[0]!;
}

export function normalizeAiProviderSelection(selection?: Partial<AiProviderSelection> | null): AiProviderSelection {
  const providerId = selection?.providerId && AI_PROVIDER_OPTIONS.some((option) => option.id === selection.providerId)
    ? selection.providerId
    : DEFAULT_AI_PROVIDER_SELECTION.providerId;
  const option = getProviderOption(providerId);
  const model = typeof selection?.model === "string" && selection.model.trim().length > 0
    ? selection.model
    : option.defaultModel;
  return { providerId, model };
}

export function createModelProvider(selection: AiProviderSelection): ModelProvider {
  const option = getProviderOption(selection.providerId);
  return option.create(selection.model || option.defaultModel);
}

export function providerKeyAvailable(providerId: AiProviderId): boolean {
  const option = getProviderOption(providerId);
  if (typeof process === "undefined") return false;
  return Boolean(process.env[option.envKey as keyof NodeJS.ProcessEnv]);
}

export function describeAiProviderSelection(selection: AiProviderSelection) {
  const option = getProviderOption(selection.providerId);
  return {
    providerName: option.name,
    providerLabel: `${option.name} · ${selection.model}`,
    description: option.description,
    envKey: option.envKey,
    cloudAvailable: providerKeyAvailable(selection.providerId),
  };
}
