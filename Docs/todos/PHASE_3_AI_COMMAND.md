# Phase 3 — AI Command Layer + Counterfactual

**Status:** Not started
**Blocking:** Phase 2 must be complete
**Agent:** Claude Code (or any agent)
**Read first:** Docs/architecture/05_AI_AGENT_ARCHITECTURE.md
**Requires:** OPENAI_API_KEY in environment

---

## Goal

Add the AI command layer so the user can type natural language to edit the scene.
Add the counterfactual engine: "Camera 1 cannot move — what can we change?"
This is where SentinelTwin gets its intelligence layer.

---

## Task 3.1 — Provider Abstraction

In `packages/agents/src/providers/`:

Create `ModelProvider.ts` interface.
Create `OpenAIProvider.ts` implementing it with GPT-4o + Structured Outputs.
Stub `GeminiProvider.ts` and `QwenProvider.ts` (implement later).

The provider reads `NEXT_PUBLIC_OPENAI_API_KEY` (or server-side `OPENAI_API_KEY`).

**Done when:** OpenAIProvider makes a test call and returns valid JSON.

---

## Task 3.2 — SceneOperation Schema

In `packages/core/src/schema/SceneOperation.ts`:

Define all `SceneOperation` types (from Docs/architecture/05).
Create Zod schema for each operation type.
Export `SceneOperationSchema` as a Zod discriminated union.

This schema is passed to GPT-4o as the Structured Output schema.

**Done when:** Zod validates a sample array of SceneOperations. TypeScript compiles.

---

## Task 3.3 — Command Agent

In `packages/agents/src/agents/CommandAgent.ts`:

```typescript
async function parseCommand(
  userText: string,
  sceneContext: SceneContextSummary,  // lightweight summary, NOT full SecurityScene JSON
  provider: ModelProvider,
): Promise<SceneOperation[]>
```

Builds the prompt from `Docs/architecture/05` prompt template.
Calls provider with SceneOperationSchema as structured output.
Returns parsed SceneOperation array.

**SceneContextSummary** — lightweight, not full JSON:
```typescript
type SceneContextSummary = {
  cameraNames: string[];
  obstructionLabels: string[];
  lightNames: string[];
  zoneLabels: string[];
  activeCameraCount: number;
  currentTimeOfDay: "day" | "night";
};
```

Never send the full SecurityScene JSON to the model for command parsing — it's too large
and most of it is irrelevant. Only send what the model needs to interpret the command.

**Done when:** "Move Camera 1 left" returns `[{ type: "rotate_camera", cameraId: "cam_xxx", yawDeg: X }]`.

---

## Task 3.4 — Apply SceneOperation to Store

In `packages/core/src/store/applySceneOperation.ts`:

```typescript
function applySceneOperation(
  operation: SceneOperation,
  store: SentinelSceneStore,
): void
```

Dispatches each operation type to the appropriate Zustand store method.
Validates that referenced IDs exist before applying.
Throws descriptive error if operation is invalid.

**Done when:** All SceneOperation types are handled and applied correctly to the store.

---

## Task 3.5 — Command Bar UI

In `apps/editor/src/panels/CommandBar.tsx`:

Text input at bottom of the editor.
On submit: call CommandAgent, apply operations, trigger coverage recompute.
Show loading state during API call.
Show "Applied: [operation descriptions]" on success.
Show error clearly on failure.

Example commands to test:
```
"Move Camera 1 toward the entry"
"Rotate Camera 2 to face the cash counter"
"Turn off Camera 1"
"Add a light near the counter"
"Switch to night mode"
"Move Shelf 1 to the right wall"
```

**Done when:** Typing commands updates the 3D scene and coverage recomputes.

---

## Task 3.6 — Counterfactual Agent

In `packages/agents/src/agents/CounterfactualAgent.ts`:

```typescript
async function proposeCounterfactuals(
  currentSimulation: SimulationResult,
  constraints: string[],  // e.g., ["Camera 1 cannot move", "Budget is low"]
  provider: ModelProvider,
): Promise<CounterfactualCandidate[]>
```

Returns 3–5 candidates. Each candidate has: description, operations, costCategory.
Does NOT include verified metrics (those come after simulation tests them).

**The verification loop** (in the calling code):
```typescript
const candidates = await proposeCounterfactuals(simulation, constraints, provider);
const verified = await Promise.all(
  candidates.map(async candidate => {
    const testScene = applyOperationsToScene(currentScene, candidate.operations);
    const testResult = computeCoverage(testScene);
    return { ...candidate, verifiedDelta: computeDelta(simulation, testResult) };
  })
);
const ranked = verified.sort((a, b) => b.verifiedDelta.totalCoveragePctDelta - a.verifiedDelta.totalCoveragePctDelta);
```

**Done when:** Given a scene with a shelved-blocked cash counter, agent proposes 3+ candidates
(move shelf, rotate camera, add light) and simulation verifies each with real deltas.

---

## Task 3.7 — Counterfactual UI Panel

In `apps/editor/src/panels/CounterfactualPanel.tsx`:

Triggered by a "Find fixes" button or command: "What can we change?"
Shows:
- Constraints input ("Camera 1 cannot move")
- Loading state
- Ranked candidates with verified before/after metrics
- [Apply this fix] button per candidate

**Done when:** "Find cheapest fix without moving cameras" produces ranked candidates with
verified coverage deltas, and clicking Apply updates the scene.

---

## Task 3.8 — Report Generation (Basic)

In `packages/agents/src/agents/ReportAgent.ts`:

```typescript
async function generateReport(
  scene: SecurityScene,
  simulation: SimulationResult,
  snapshots: SceneSnapshot[],  // optional, for before/after section
  provider: ModelProvider,
): Promise<SecurityReport>
```

Uses GPT-4o to write the prose sections (executive summary, recommendations narrative).
All numbers come from `SimulationResult` — AI writes around them, not over them.

In `apps/editor/src/panels/ReportPreviewPanel.tsx`:
Renders the SecurityReport as readable HTML in a panel.
Sections: Site Overview, Camera Setup, Coverage Summary, Zone Results, Issues, Recommendations.
[Export as PDF] placeholder (full PDF export is Phase 4).

**Done when:** Clicking "Generate Report" produces a readable audit summary with accurate numbers.

---

## Phase 3 Done Criteria

- [ ] 3.1: Provider abstraction with OpenAI working
- [ ] 3.2: SceneOperation Zod schema validates correctly
- [ ] 3.3: CommandAgent parses NL commands to SceneOperation[]
- [ ] 3.4: applySceneOperation works for all operation types
- [ ] 3.5: Command bar UI works end-to-end
- [ ] 3.6: CounterfactualAgent proposes + simulation verifies candidates
- [ ] 3.7: Counterfactual UI shows ranked verified candidates
- [ ] 3.8: Report generation produces readable output with accurate numbers

**Next phase:** `Docs/todos/PHASE_4_ADVERSARIAL_PATH.md`
