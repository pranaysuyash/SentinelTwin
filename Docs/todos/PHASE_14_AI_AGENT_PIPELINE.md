# Phase 14: AI Agent Pipeline

**Status:** Not started  
**Priority:** P2 (Medium)  
**Dependencies:** Phase 11 (Monorepo Packages)

---

## Goal

Build the production-grade multi-agent AI pipeline with model-agnostic provider switching (OpenAI / Gemini / Qwen), structured tool calling, and integration with the simulation engine for verified recommendations.

---

## Current State

The Camera Studio has a functional command layer:
- `CommandAgent` — parses natural language → structured scene operations
- `provider-selection.ts` — model-agnostic provider selection
- `model-eval.ts` — model evaluation harness
- `prompt-registry.ts` — prompt management
- Providers: OpenAI, Gemini, Qwen (stub level)

Recent hardening:
- `provider-selection.ts` now canonicalizes requested model strings to each provider's supported model list, so invalid or case-variant model names no longer leak into the active selection or provider summaries.

But this is primarily a **command parsing layer**, not a full multi-agent pipeline:
- No multi-agent orchestration (OpenAI Agents SDK pattern)
- No counterfactual analysis agent wired to simulation
- No scene understanding agent
- No report generation agent using structured outputs
- No tool definitions for structured function calling
- No config-driven model selection at runtime

---

## Deliverables

### 1. Multi-Agent Architecture

```
Command input
  → RouterAgent (classifies intent: edit / analyze / report / explore)
    → EditAgent (parses → structured scene operations)
    → AnalysisAgent (runs simulation → explains results)
    → ReportAgent (generates structured report data)
    → ExploreAgent (counterfactual proposals)
  → Results merged → response to user
```

### 2. Provider Abstraction (Model-Agnostic)

- `ModelProvider` abstract interface (exists as concept, needs hardening)
- Implementations:
  - `OpenAIProvider` (GPT-4o, GPT-4o-mini) — default V0.1
  - `GeminiProvider` (Gemini 2.5 Pro, Flash)
  - `QwenProvider` (Qwen2.5-VL) — for multimodal scene understanding
  - `LocalProvider` (Ollama) — for air-gapped deployments
- Config-driven: `config.modelProvider = "openai" | "gemini" | "qwen" | "local"`
- Unified streaming interface for all providers
- Structured output parsing (JSON mode / function calling)

### 3. Agent Implementations

| Agent | Input | Output | Calls Simulation? |
|-------|-------|--------|-------------------|
| CommandAgent | NL text | Scene operations | No |
| CounterfactualAgent | Scene state | Change proposals | Yes |
| ReportAgent | Scene + simulation | Structured report data | No |
| SceneUnderstandingAgent | Image/floor plan | Scene draft | No |

### 4. Tool Definitions

- Structured function calling tools for each agent:
  - `add_camera` / `move_camera` / `remove_camera`
  - `set_time_of_day`
  - `add_obstruction`
  - `run_coverage_simulation`
  - `run_adversarial_path`
  - `generate_report`
- Tools return structured data that the UI can render directly

### 5. Prompt Management

- Prompt templates in `src/agents/prompts/`
- Per-model prompt tuning (different providers need different prompt styles)
- Prompt versioning for A/B testing
- System prompt + few-shot examples per agent type

### 6. SOAR-Ready Output Format

- CommandAction schema designed for future SOAR integration
- Event format aligned with ONVIF event model
- Temporal timing model for automated responses
- See `Docs/architecture/05_AI_AGENT_ARCHITECTURE.md` for full spec

---

## Implementation Order

1. Harden ModelProvider abstraction (unified interface, error handling, retry)
2. Build RouterAgent for intent classification
3. Build structured tool definitions for all camera/scene operations
4. Wire CounterfactualAgent to simulation engine
5. Build ReportAgent with structured output
6. Add provider switching at runtime (config file / env var)
7. Prompt optimization per provider
8. SOAR output format alignment

---

## Success Criteria

- NL command like "add a 4K dome camera at the entrance" produces a valid CameraNode
- "What if I remove this obstruction?" triggers simulation and returns delta metrics
- "Generate a compliance report" produces structured report data
- Switching from OpenAI to Gemini works by changing one config flag
- All agents respect the "AI proposes, simulation verifies" rule

---

## Related Docs

- `apps/studio/src/agents/*` — existing agent code
- `Docs/architecture/05_AI_AGENT_ARCHITECTURE.md` — full AI architecture spec
- `Docs/exploration/AGENTIC_SYSTEMS_CODEX.md` — agent framework research
