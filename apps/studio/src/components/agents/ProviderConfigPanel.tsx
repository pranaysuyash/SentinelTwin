"use client";

import { Settings2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { GeminiProvider } from "@/agents/providers/GeminiProvider";
import { OpenAIProvider } from "@/agents/providers/OpenAIProvider";
import { QwenProvider } from "@/agents/providers/QwenProvider";
import type { AiProviderSelection } from "@/agents/provider-selection";

interface ProviderOption {
  id: string;
  name: string;
  description: string;
  create: (model: string) => unknown;
  defaultModel: string;
  models: string[];
  envKey: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o with Structured Outputs",
    create: (model: string) => new OpenAIProvider(model),
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Gemini 2.5 Flash/Pro via Google AI",
    create: (model: string) => new GeminiProvider(model),
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "qwen",
    name: "Qwen",
    description: "Qwen2.5-VL via Together AI",
    create: (model: string) => new QwenProvider(model),
    defaultModel: "Qwen/Qwen2.5-VL-72B-Instruct-Turbo",
    models: [
      "Qwen/Qwen2.5-VL-72B-Instruct-Turbo",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      "Qwen/Qwen2.5-32B-Instruct",
    ],
    envKey: "TOGETHER_API_KEY",
  },
];

interface ProviderConfigPanelProps {
  onSelectionChange?: (selection: AiProviderSelection) => void;
  initialProviderId?: AiProviderSelection["providerId"];
  initialModel?: string;
}

export function ProviderConfigPanel({
  onSelectionChange,
  initialProviderId,
  initialModel,
}: ProviderConfigPanelProps) {
  const [selectedId, setSelectedId] = useState<AiProviderSelection["providerId"]>(initialProviderId ?? "openai");
  const [selectedModel, setSelectedModel] = useState<string>(initialModel ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentProvider = useMemo(
    () => PROVIDERS.find((p) => p.id === selectedId) ?? PROVIDERS[0],
    [selectedId],
  );

  const handleProviderChange = useCallback(
    (providerId: string) => {
      const selectedProviderId = providerId as AiProviderSelection["providerId"];
      setSelectedId(selectedProviderId);
      const option = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];
      const model = selectedModel || option.defaultModel;
      onSelectionChange?.({ providerId: selectedProviderId, model });
    },
    [selectedModel, onSelectionChange],
  );

  const handleModelChange = useCallback(
    (model: string) => {
      setSelectedModel(model);
      onSelectionChange?.({ providerId: selectedId, model });
    },
    [selectedId, onSelectionChange],
  );

  return (
    <div className="space-y-3 rounded-lg border border-[#1e2130] bg-[#0b0f17] p-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-[#1e2130] pb-2">
        <Settings2 className="h-3.5 w-3.5 text-blue-400/70" />
        <span className="text-[11px] font-medium text-[#e8edf5]">Provider Configuration</span>
      </div>

      {/* Provider Selection */}
      <div className="space-y-1">
        <span className="text-[9px] font-medium text-[#68738a]">Provider</span>
        <div className="grid grid-cols-3 gap-1.5">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={`rounded-lg border px-2 py-1.5 text-left text-[9px] transition-colors ${
                selectedId === p.id
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-200"
                  : "border-[#1e2130] text-[#68738a] hover:border-[#2a3045] hover:text-[#9da8c0]"
              }`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="mt-0.5 text-[7px] opacity-60">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-1">
        <span className="text-[9px] font-medium text-[#68738a]">Model</span>
        <select
          value={selectedModel || currentProvider.defaultModel}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full rounded-lg border border-[#1e2130] bg-[#070a12] px-2 py-1.5 text-[10px] text-[#c5ccdb] outline-none focus:border-blue-500/40"
        >
          {currentProvider.models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[8px] font-medium text-[#59637a] hover:text-[#8090a8]"
      >
        {showAdvanced ? "Hide" : "Show"} advanced
      </button>

      {/* API Key Status */}
      {showAdvanced && (
        <div className="space-y-1.5 rounded-lg border border-[#1e2130] bg-[#070a12] p-2">
          <span className="text-[8px] font-medium uppercase tracking-wider text-[#59637a]">
            API Keys
          </span>
          {PROVIDERS.map((p) => {
            const hasKey = Boolean(
              typeof process !== "undefined" && process.env[p.envKey],
            );
            return (
              <div
                key={p.id}
                className="flex items-center justify-between text-[8px]"
              >
                <span className="text-[#68738a]">{p.envKey}</span>
                <span
                  className={`font-mono ${
                    hasKey ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {hasKey ? "✓ Set" : "Not set"}
                </span>
              </div>
            );
          })}
          <div className="pt-1 text-[7px] text-[#3a4158]">
            Set these via environment variables or .env.local
          </div>
        </div>
      )}

      {/* Active Provider Indicator */}
      <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-2 py-1">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-[8px] text-emerald-300">
          Active: {currentProvider.name} ({selectedModel || currentProvider.defaultModel})
        </span>
      </div>
    </div>
  );
}
