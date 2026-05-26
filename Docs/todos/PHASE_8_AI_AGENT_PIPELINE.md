# Phase 8: AI Agent Pipeline — Production Hardening

## Goal
Take the existing agent infrastructure (CommandAgent, ReportAgent, CounterfactualAgent, ModelProvider/OpenAIProvider) from thin wrappers to a production-grade multi-agent system with orchestration, streaming, token tracking, provider configuration, and comprehensive testing.

## Current State
- `ModelProvider` interface: `complete()` + `completeStructured()` — no streaming, no retry, no rate limiting
- `OpenAIProvider`: functional, uses GPT-4o with Structured Outputs, no fallback
- `GeminiProvider`, `QwenProvider`: stubs that throw
- `CommandAgent`, `ReportAgent`, `CounterfactualAgent`: individual agents with no coordination
- `use-ai-command` hook: orchestrates in React, no conversation memory, single-shot only
- Agent status shown via CommandBar inline status, no token usage tracking

## What We Built

### P0 — Core Infrastructure
- [x] **Streaming support in ModelProvider**: Added `completeStreaming()` method that returns `AsyncIterable<string>`. OpenAIProvider implements it via SSE streaming. This enables live token-by-token display in the UI.
- [x] **Retry + fallback logic**: `AgentConfig` with `maxRetries`, `timeoutMs`. `retryWithFallback()` wraps any provider call with exponential backoff, automatic retry on transient errors, and fallback to a backup provider.
- [x] **Rate limiting**: Sliding-window token bucket limiter. Respects RPM and TPM limits per provider. Queues overflow with `AbortController` support.
- [x] **Token tracking**: `TokenTracker` accumulates prompt/completion tokens per session, per model, per provider. Exposes `getUsage()` and `reset()`.

### P1 — Agent Orchestration
- [x] **CoordinatorAgent**: Routes tasks to specialized agents (CommandAgent, ReportAgent, CounterfactualAgent). Supports multi-turn conversation with conversation memory (last N messages, context windowing with summarization at threshold).
- [x] **Conversation memory**: `ConversationMemory` class — ring buffer of last 20 exchanges, automatic summarization when context exceeds 8000 tokens, injects summary as system message prefix.
- [x] **Agent session lifecycle**: `AgentSession` wraps a full interaction — input → parse → route → execute → verify → respond.

### P2 — Provider Expansion
- [x] **OpenAIProvider streaming**: Full `completeStreaming()` via SSE. Parses `data:` lines, emits text deltas, handles abort via AbortSignal.
- [x] **GeminiProvider implemented**: REST-based with `generateContent` endpoint, structured output via response_mime_type=application/json. Supports `complete()` and `completeStreaming()`.
- [x] **QwenProvider implemented**: OpenAI-compatible API (serving Qwen2.5-VL). Reuses OpenAIProvider via endpoint config override.

### P3 — UI Integration
- [x] **AgentCoordinatorPanel**: React component showing all agents, their status, token usage, and the active agent chain. Live-updating token counters.
- [x] **Streaming response display**: CommandBar extended to show streaming agent responses character-by-character.
- [x] **Provider config panel**: UI to switch between providers, set API keys, configure model parameters.

### P4 — Tests
- [x] **ModelProvider tests**: Unit tests for retry logic, rate limiter, token tracker
- [x] **CoordinatorAgent tests**: Integration test with mock provider
- [x] **ConversationMemory tests**: Context windowing, summarization trigger
- [x] **Streaming tests**: OpenAIProvider streaming parse

## Key Decisions
- **Provider interface additive**: `completeStreaming()` added as new method, not breaking existing interface
- **Rate limiting in-process**: Sliding window, not distributed — fine for single-user Studio
- **Conversation memory in memory**: No persistence across sessions (Phase 12 scope)
- **Agent coordinator lives in React**: Uses Zustand store for state, not a separate worker

## Validation
- TypeScript clean
- ESLint 0 errors
- All agent tests pass
- Existing simulation tests still pass

## Files Created/Modified
- `apps/studio/src/agents/providers/ModelProvider.ts` — streaming + retry interfaces
- `apps/studio/src/agents/providers/AgentConfig.ts` — config types + rate limiter + token tracker
- `apps/studio/src/agents/providers/OpenAIProvider.ts` — streaming + retry implementation
- `apps/studio/src/agents/providers/GeminiProvider.ts` — full implementation
- `apps/studio/src/agents/providers/QwenProvider.ts` — full implementation
- `apps/studio/src/agents/CoordinatorAgent.ts` — multi-agent routing + conversation memory
- `apps/studio/src/hooks/use-ai-command.ts` — updated for streaming + coordinator
- `apps/studio/src/components/command-bar/CommandBar.tsx` — streaming display
- `apps/studio/src/components/agents/AgentCoordinatorPanel.tsx` — new agent monitoring UI
- `apps/studio/src/components/agents/ProviderConfigPanel.tsx` — provider config UI
- `apps/studio/src/agents/__tests__/ModelProvider.test.ts` — retry, rate limit, token tests
- `apps/studio/src/agents/__tests__/CoordinatorAgent.test.ts` — coordinator tests
