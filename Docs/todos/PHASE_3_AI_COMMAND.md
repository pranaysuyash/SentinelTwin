# Phase 3 — AI Command Layer

**Status:** ✅ Complete (Sprint 2)

## Overview

The AI Command Layer allows users to modify and analyze the security scene using
natural language, and to generate professional audit reports. It also includes
counterfactual analysis — AI-proposed fixes that are verified by the simulation engine
before surfacing to the user.

## Completed Tasks

### 3.1 — ! Model abstraction
- [x] `ModelProvider` interface (`agents/providers/ModelProvider.ts`)
- [x] `OpenAIProvider` implementation with GPT-4o Structured Outputs (`agents/providers/OpenAIProvider.ts`)
- [x] Gemini provider stub (`agents/providers/GeminiProvider.ts`)
- [x] Qwen provider stub (`agents/providers/QwenProvider.ts`)
- [x] Uses `zod-to-json-schema` for robust JSON Schema generation
- [x] `ensureStrictMode()` for OpenAI strict mode compatibility

### 3.2 — ! SceneOperation schema
- [x] Zod discriminated union with 15 operation types (`schema/SceneOperation.ts`):
  - `move_camera`, `rotate_camera`, `change_camera_fov`, `toggle_camera`
  - `move_obstruction`, `resize_obstruction`, `rotate_obstruction`
  - `add_light`, `toggle_light`
  - `set_time_of_day`, `replay_path`, `run_adversarial`, `save_snapshot`, `generate_report`
- [x] `SceneOperationArray` wrapper for agent responses
- [x] `applySceneOperation` + `applySceneOperations` in `lib/applySceneOperation.ts`

### 3.3 — ! Command agent
- [x] `CommandAgent` (`agents/CommandAgent.ts`)
- [x] System prompt with all operation types
- [x] `SceneContextSummary` — lightweight scene snapshot (never sends full JSON)
- [x] `parseCommand()` — NL → `SceneOperation[]`

### 3.4 — ! Zustand store integration
- [x] `useAiCommand()` hook (`hooks/use-ai-command.ts`)
- [x] `executeCommand()` — parses + applies + reports success
- [x] `runCounterfactuals()` — proposes + verifies by simulation + ranks by delta
- [x] `runReportGeneration()` — generates AI security report
- [x] Internal slash commands: `/night`, `/day`, `/report`, `/snapshot`, `/simulate`, `/run`
- [x] Auto-dismiss success messages after 4s
- [x] Error handling with dismissable error state

### 3.5 — ! CommandBar UI
- [x] Collapsed state: small button (bottom-right) with Sparkles icon + ⌘K badge
- [x] Expanded state: animated panel with text input, quick hints, submit button
- [x] Keyboard shortcut: ⌘K/⌃K to toggle
- [x] Status bar within panel: thinking, applying, success, error states
- [x] Loading spinners during AI operations
- [x] Wired into `StudioShell.tsx`

### 3.6 — ! Counterfactual agent
- [x] `CounterfactualAgent` (`agents/CounterfactualAgent.ts`)
- [x] System prompt for security optimization expert
- [x] Proposes 3–5 candidates with description, operations, costCategory
- [x] Each candidate verified by simulation: coverage delta, blindspot delta, zone status changes

### 3.7 — ! CounterfactualPanel UI
- [x] `CounterfactualPanel` component (`components/bottom-panel/CounterfactualPanel.tsx`)
- [x] Empty state with lightbulb icon + "Find Fixes" button (disabled without simulation)
- [x] Constraints input for user to specify limitations
- [x] `CandidateCard` with rank badge, description, cost badge, verified deltas, Apply button
- [x] Delta badges: coverage %, blindspot %, critical issues resolved, zone status changes
- [x] Apply button mutates scene and re-simulates
- [x] Wired into `BottomPanel.tsx` as "FIXES" tab

### 3.8 — ! Report agent
- [x] `ReportAgent` (`agents/ReportAgent.ts`)
- [x] System prompt for professional, non-alarmist audit reports
- [x] Zod schema with `siteName`, `generatedAt`, sections, recommendations, assumptions, limitations
- [x] `buildSimulationSummary()` — compact JSON-safe summary for AI
- [x] `ReportLiteTab` — default markdown report + AI enhanced report toggle
- [x] Copy to clipboard, Default/AI report switching
- [x] Wired into `BottomPanel.tsx` as "REPORT LITE" tab

### Store changes
- [x] Added `"counterfactual"` to `BottomTab` type in `studio-store.ts`

## Browser Verification
- [x] CommandBar renders and expands with AI Command button
- [x] FIXES tab renders Find Fixes view (disabled without simulation)
- [x] REPORT LITE tab renders simulation summary content
- [x] No console errors from Phase 3 code (only pre-existing Three.js deprecation warnings)

## Architecture Notes

- **AI Proposes, Simulation Verifies**: All counterfactual candidates are run through
  `simulateStudio()` before being shown to the user. Deltas are computed against current
  simulation results.
- **Model-Agnostic Provider**: `ModelProvider` interface allows switching between
  OpenAI (current), Gemini, or Qwen via config flag.
- **Lightweight Context**: Never sends full SecurityScene JSON to AI — only `SceneContextSummary`.
- **No React in Agents**: All agent modules are pure TypeScript with zero React dependencies.
- **zod-to-json-schema**: Used for robust JSON Schema generation from Zod schemas,
  compatible with OpenAI's `strict: true` mode.

## Remaining / Future

- [ ] Integrate with adversarial path simulation when available
- [ ] Add `/improve` command that runs counterfactuals + auto-applies best candidate
- [ ] Add batch counterfactual comparison view
- [ ] Add PDF export for reports
- [ ] Integrate with `@sentineltwin/agents` package when monorepo restructured
- [ ] Add rate limiting / token budget management
