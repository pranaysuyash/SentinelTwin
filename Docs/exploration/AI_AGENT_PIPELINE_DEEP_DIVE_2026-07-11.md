# AI Agent Pipeline — Deep Dive (2026-07-11)

**Thread 57 — Multi-Agent Workflows, Scene Operations, Simulation Verification, and Recommendations**

---

## 1. Overview

The AI agent pipeline implements the canonical rule: **"AI proposes. Simulation verifies. AI explains."**

No AI model ever returns security metrics, coverage numbers, or fix recommendations
directly to the user without simulation verification. The geometry engine is the
source of truth. The AI is the interface to it.

---

## 2. Core Principle

| Task | Who Does It |
|------|-------------|
| Parse "move Camera 1 left" into scene operation | **AI** |
| Compute whether Camera 1 now covers the counter | **Simulation** |
| Explain why coverage improved | **AI** |
| Determine if cash counter meets recognition threshold | **Simulation** |
| Write the client report | **AI** (using simulation numbers) |
| Propose "move shelf to improve coverage" | **AI** |
| Test if moving the shelf actually improves coverage | **Simulation** |
| Rank candidates by impact | **Simulation output → AI synthesizes** |

---

## 3. The 5 Agent Roles

| # | Agent | Package | Job | Input | Output |
|---|-------|---------|-----|-------|--------|
| 1 | **CommandAgent** | `@sentineltwin/agents` | Parse NL commands → structured operations | User text + scene context | `SceneOperation[]` |
| 2 | **CounterfactualAgent** | `@sentineltwin/agents` | Propose candidate fixes | Issues + scene summary + constraints | `CounterfactualCandidate[]` |
| 3 | **ReportAgent** | `@sentineltwin/agents` | Generate client audit report | Simulation data + scene metadata | `SecurityReport` |
| 4 | **SceneUnderstandingAgent** | `@sentineltwin/agents` | Analyze scene for security gaps | Scene description + simulation data | `SceneUnderstandingResult` |
| 5 | **CoordinatorAgent** | `@sentineltwin/agents` | Orchestrate multi-agent workflows | Task chain | Ordered `AgentResult[]` |

---

## 4. Agent 1: Command Agent

### 4.1 File: `packages/agents/src/command-agent.ts`

**Core function:** `parseCommandDetailed(userText, sceneContext, provider, semanticScene?)`

### 4.2 How It Works

1. **Build scene summary** from `SceneContextSummary`:
   ```
   Cameras: Camera 1, Camera 2 (2 active) | Obstructions: Shelf 1, Counter |
   Lights: Light 1 | Zones: Cash Counter | Time: day | Room: 10m × 8m × 3m
   ```

2. **Send to LLM** with system prompt from `PROMPT_REGISTRY["command_parse"]`:
   ```
   You are SentinelTwin's command interpreter. Convert the user's natural language
   request into structured scene operations. Output ONLY valid JSON matching the schema.
   ```

3. **LLM returns** `SceneOperation[]` via Structured Outputs

4. **Validate** against scene via `validateSceneOperationsAgainstScene()`:
   - Check camera/obstruction IDs exist
   - Validate position bounds (within room dimensions)
   - Reject out-of-bounds operations

5. **Return** `CommandParseResult`:
   ```typescript
   {
     operations: SceneOperation[],  // Validated operations
     confidence: number,            // 0.82 (valid) or 0.58 (issues)
     warnings: string[],            // Validation issues
     requiresConfirmation: boolean  // Always true for AI-parsed commands
   }
   ```

### 4.3 SceneOperation Schema (15 Types)

| Operation | Parameters |
|-----------|-----------|
| `move_camera` | cameraId, newPosition [x,y,z] |
| `rotate_camera` | cameraId, yawDeg, pitchDeg? |
| `change_camera_fov` | cameraId, fovHorizontalDeg (1-180) |
| `toggle_camera` | cameraId, status (on/off) |
| `move_obstruction` | obstructionId, newPosition |
| `resize_obstruction` | obstructionId, newDimensions [w,h,d] |
| `rotate_obstruction` | obstructionId, rotationYDeg |
| `add_obstruction` | position, obstructionType (13 types) |
| `add_light` | position, name?, lightType?, brightness? |
| `toggle_light` | lightId, status |
| `set_time_of_day` | timeOfDay (day/night/dusk) |
| `replay_path` | pathId |
| `run_adversarial` | — |
| `save_snapshot` | label |
| `generate_report` | — |

### 4.4 Validation Rules

```typescript
validateSceneOperationsAgainstScene(operations, scene) → {
  validOperations: SceneOperation[],  // Only valid ops
  issues: SemanticValidationIssue[]   // Rejected ops with reasons
}
```

| Validation | Check |
|-----------|-------|
| Camera exists | `scene.cameras.some(c => c.id === cameraId)` |
| Obstruction exists | `scene.obstructions.some(o => o.id === obstructionId)` |
| Light exists | `scene.securityLights.some(l => l.id === lightId)` |
| Path exists | `scene.paths.some(p => p.id === pathId)` |
| Position in bounds | `x >= 0 && z >= 0 && x <= width && z <= depth` |
| Dimensions positive | `w > 0 && h > 0 && d > 0` |

---

## 5. Agent 2: Counterfactual Agent

### 5.1 File: `packages/agents/src/counterfactual-agent.ts`

**Core function:** `proposeCounterfactuals(issuesSummary, sceneSummary, constraints, provider)`

### 5.2 How It Works

1. **Build prompt** from issues, scene context, and constraints
2. **Send to LLM** with system prompt from `PROMPT_REGISTRY["counterfactual_candidates"]`:
   ```
   You are a security camera optimization expert. Given the current coverage analysis,
   propose 3–5 candidate fixes. Each candidate must include: description, operations,
   costCategory, risks, assumptions.
   ```
3. **LLM returns** structured response with candidates
4. **Map to** `CounterfactualCandidate[]` with generated IDs

### 5.3 Output Structure

```typescript
type CounterfactualCandidate = {
  id: string;
  description: string;           // "Move Shelf 1 to the right wall"
  operations: SceneOperation[];  // Exact scene mutations
  costCategory: "free" | "low" | "medium" | "high";
  estimatedImpact: string;       // AI's prediction BEFORE simulation
  verifiedDelta?: {              // Set AFTER simulation tests it
    totalCoveragePctDelta: number;
    blindspotPctDelta: number;
    criticalZoneStatusChanges: string[];
    worstIssueResolved: boolean;
    adversarialPathExposureDelta?: number;
  };
  rank?: number;                 // Set after all candidates verified
  risks?: string[];
  assumptions?: string[];
};
```

### 5.4 The Critical Loop

```
1. Counterfactual Agent proposes candidates (AI)
2. Simulation engine tests each candidate (Simulation)
3. Simulation returns verified deltas for each candidate
4. Agent synthesizes ranked recommendations using verified numbers
5. Present to user with before/after metrics
```

---

## 6. Agent 3: Report Agent

### 6.1 File: `packages/agents/src/report-agent.ts`

**Core function:** `generateReport(simulationData, sceneSummary, provider)`

### 6.2 How It Works

1. **Build simulation summary** via `buildSimulationSummary(result)`:
   - Converts `SimulationResult` to JSON string with all metrics
   - Includes coverage %, quality scores, zone results, camera results, issues, recommendations

2. **Send to LLM** with system prompt from `PROMPT_REGISTRY["report_generation"]`:
   ```
   You are a professional security audit report writer. Use the verified simulation
   data provided. Do not invent numbers. Do not claim more certainty than the data supports.
   Use phrases like "estimated recognition-quality coverage" not "guaranteed recognition."
   ```

3. **LLM returns** `SecurityReport` via Structured Outputs

### 6.3 Output Structure

```typescript
type SecurityReport = {
  title: string;
  siteName: string;
  generatedAt: number;
  executiveSummary: string;
  sections: ReportSection[];      // { title, content, type: "text"|"table"|"list" }
  recommendations: string[];
  assumptions: string[];
  limitations: string[];
};
```

### 6.4 Key Rule

**All numbers in the report come from SimulationResult.** The AI writes prose. The simulation provides the facts.

---

## 7. Agent 4: Scene Understanding Agent

### 7.1 File: `packages/agents/src/scene-understanding-agent.ts`

**Core function:** `analyzeScene(sceneDescription, simulationData, provider)`

### 7.2 How It Works

1. **Send to LLM** with system prompt from `PROMPT_REGISTRY["scene_understanding"]`:
   ```
   You are a security assessment analyst. Analyze the provided scene description and
   simulation data to produce a structured security understanding. Evaluate: facility type,
   occupancy patterns, lighting conditions, obstruction effects, camera placement, zone coverage.
   ```

2. **LLM returns** structured analysis with findings

### 7.3 Output

- Facility type and risk profile
- Occupancy patterns and security implications
- Lighting conditions and problem areas
- Obstruction effects on camera coverage
- Per-camera placement suitability and gaps
- Critical zone coverage and risk levels

---

## 8. Agent 5: Coordinator Agent

### 8.1 File: `packages/agents/src/coordinator.ts`

**Core class:** `CoordinatorAgent`

### 8.2 How It Works

```typescript
class CoordinatorAgent {
  private memory: ConversationMemory;
  private agentRegistry: Map<AgentRole, AgentExecutor>;
  private activeChain: AgentTask[];

  registerAgent(role, executor): void;
  routeTask(task): Promise<AgentResult>;
  executeChain(tasks): Promise<AgentResult[]>;
  getConversationContext(): { history, summary };
  resetConversation(): void;
}
```

### 8.3 Conversation Memory

```typescript
class ConversationMemory {
  private exchanges: { role: "user"|"assistant"; content: string }[];
  private summary: string | null;

  add(role, content): void;       // Auto-summarizes when context exceeds 8K tokens
  getHistory(): Exchange[];
  getSummary(): string | null;
  clear(): void;
}
```

### 8.4 Task Routing

1. Register agents by role: `coordinator.registerAgent("command", commandExecutor)`
2. Route task: `coordinator.routeTask({ id, role: "command", input: "move camera left" })`
3. Coordinator finds registered agent, executes, records in memory
4. Chain execution: `coordinator.executeChain([task1, task2, task3])` — stops on error

### 8.5 Singleton

```typescript
export const globalCoordinator = new CoordinatorAgent();
```

---

## 9. Prompt Registry

### 9.1 File: `packages/agents/src/prompt-registry.ts`

Central registry of all AI prompts with versioning and lineage tracking.

### 9.2 Registry Entries

| ID | Agent | Stage | Output Schema | Version |
|----|-------|-------|---------------|---------|
| `command_parse` | CommandAgent | command | `SceneOperation[]` | v1 |
| `counterfactual_candidates` | CounterfactualAgent | counterfactual | `CounterfactualCandidate[]` | v1 |
| `report_generation` | ReportAgent | report | `SecurityReport` | v1 |
| `model_layout_draft` | AI Layout Draft | draft | `SecurityScene blueprint` | v2 |
| `scene_understanding` | SceneUnderstandingAgent | scene_understanding | `SceneUnderstandingResult` | v1 |

### 9.3 Lineage Tracking

Every AI action records prompt lineage:
```typescript
type PromptRegistryLineage = {
  promptId: string;
  promptVersion: string;
  promptTitle: string;
  promptAgent: string;
  promptStage: PromptRegistryStage;
  promptOutputSchema: string;
};
```

---

## 10. Provider Abstraction

### 10.1 File: `packages/agents/src/providers/ModelProvider.ts`

```typescript
interface ModelProvider {
  readonly name: string;
  complete(prompt: ModelPrompt, signal?: AbortSignal): Promise<ModelResponse>;
  completeStreaming(prompt: ModelPrompt, signal?: AbortSignal): AsyncIterable<string>;
  completeStructured<T>(prompt: ModelPrompt, schema: ZodSchema<T>, signal?: AbortSignal): Promise<T>;
  completeWithTools?(prompt: ModelPrompt, tools: ToolDefinition[], signal?: AbortSignal): Promise<...>;
}
```

### 10.2 Implementations

| Provider | Models | Use Case |
|----------|--------|----------|
| `OpenAIProvider` | GPT-4o, GPT-4o-mini | Command parsing, counterfactuals, reports |
| `GeminiProvider` | Gemini 2.5 Flash/Pro | Fast inference, function calling |
| `QwenProvider` | Qwen2.5-VL | Vision tasks, floor plan understanding |
| `LocalProvider` | MiniCPM-V, Florence-2 | Experiments, on-device inference |

### 10.3 Provider Selection

```typescript
type AiProviderSelection = {
  providerId: "openai" | "gemini" | "qwen" | "local";
  model: string;
};

function createModelProvider(selection: AiProviderSelection): ModelProvider;
```

**Switch = config change. Not a code change.**

---

## 11. API Routes

### 11.1 Command Parsing

**File:** `apps/studio/src/app/api/ai/command/route.ts`

```
POST /api/ai/command
Body: { userText, selection, localOnlyMode, sceneContext, scene }
Response: { ok, result: { operations, confidence, warnings, requiresConfirmation } }
```

### 11.2 Counterfactual Proposals

**File:** `apps/studio/src/app/api/ai/counterfactuals/route.ts`

```
POST /api/ai/counterfactuals
Body: { selection, localOnlyMode, issuesSummary, sceneSummary, constraints }
Response: { ok, candidates: CounterfactualCandidate[] }
```

### 11.3 Report Generation

**File:** `apps/studio/src/app/api/ai/report/route.ts`

```
POST /api/ai/report
Body: { selection, localOnlyMode, simulationSummary, sceneSummary }
Response: { ok, report: SecurityReport }
```

---

## 12. Integration Flow

### 12.1 Command Bar → Command Agent → Scene

```
User types "move camera 1 left"
  → useAiCommand.executeCommand()
  → POST /api/ai/command
  → CommandAgent.parseCommandDetailed()
  → LLM returns SceneOperation[]
  → validateSceneOperationsAgainstScene()
  → Stage preview with descriptions
  → User confirms
  → applySceneOperations() → scene mutation → simulation re-run
```

### 12.2 /fix Command → Counterfactual Agent → Verified Fixes

```
User types "/fix"
  → useAiCommand.executeCommand()
  → POST /api/ai/counterfactuals
  → CounterfactualAgent.proposeCounterfactuals()
  → LLM returns CounterfactualCandidate[]
  → verifyAndRankCounterfactualCandidates()
    → For each candidate:
      → Clone scene
      → Apply operations
      → simulateStudio(testScene)
      → Compute verifiedDelta
    → Filter + Rank
  → Show candidates in CommandBar
  → User applies best fix
  → enterFixSandboxForAiProposal()
  → Apply operations to draft
  → Run sandbox simulation
  → Show FixSandboxBar with diff
  → User reviews → Apply or Discard
```

### 12.3 Report Button → Report Agent → PDF

```
User clicks "Generate Report"
  → useAiCommand.runReportGeneration()
  → buildSimulationSummary(sim)
  → POST /api/ai/report
  → ReportAgent.generateReport()
  → LLM returns SecurityReport
  → Render in ReportLiteTab
  → Export to PDF
```

---

## 13. Known Gaps & Future Work

| Gap | Impact | Priority |
|-----|--------|----------|
| No multi-turn conversation in Command Agent | Each command is stateless | Medium |
| No tool calling in agent workflows | Agents only use structured output, not function calling | Low |
| No streaming responses | Users wait for full response | Medium |
| No cost tracking per agent call | Can't optimize provider selection by cost | Low |
| No prompt versioning in production | Can't A/B test prompt changes | Medium |
| No agent-to-agent delegation | Coordinator routes but agents don't call each other | Low |
| No retry/fallback on provider failure | Single provider per call | Medium |

---

## 14. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Agent Pipeline                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Prompt Registry (5 entries, versioned)               │       │
│  │  command_parse | counterfactual | report | draft |    │       │
│  │  scene_understanding                                  │       │
│  └────────────────────┬─────────────────────────────────┘       │
│                        │                                         │
│                        ▼                                         │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  ModelProvider Abstraction                             │       │
│  │  OpenAI | Gemini | Qwen | Local                        │       │
│  └────────────────────┬─────────────────────────────────┘       │
│                        │                                         │
│         ┌──────────────┼──────────────┐                         │
│         ▼              ▼              ▼                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│  │ Command    │ │ Counter-   │ │ Report     │                  │
│  │ Agent      │ │ factual    │ │ Agent      │                  │
│  │            │ │ Agent      │ │            │                  │
│  │ NL → Ops   │ │ Propose    │ │ Sim Data   │                  │
│  └─────┬──────┘ │ Fixes      │ │ → Report   │                  │
│        │        └─────┬──────┘ └────────────┘                  │
│        │              │                                         │
│        ▼              ▼                                         │
│  ┌──────────────────────────────────────────┐                  │
│  │  Scene Operation Validator                │                  │
│  │  validateSceneOperationsAgainstScene()    │                  │
│  └────────────────────┬─────────────────────┘                  │
│                        │                                         │
│                        ▼                                         │
│  ┌──────────────────────────────────────────┐                  │
│  │  Simulation Engine (deterministic)        │                  │
│  │  simulateStudio(patchedScene)             │                  │
│  └────────────────────┬─────────────────────┘                  │
│                        │                                         │
│                        ▼                                         │
│  ┌──────────────────────────────────────────┐                  │
│  │  Verified Results → UI                    │                  │
│  │  CounterfactualPanel | CommandBar |       │                  │
│  │  ReportTab | FixSandboxBar                │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Key Files Reference

| File | Purpose |
|------|---------|
| `packages/agents/src/command-agent.ts` | NL command → SceneOperation[] |
| `packages/agents/src/counterfactual-agent.ts` | AI fix proposals |
| `packages/agents/src/report-agent.ts` | Report generation |
| `packages/agents/src/scene-understanding-agent.ts` | Scene analysis |
| `packages/agents/src/coordinator.ts` | Multi-agent orchestration |
| `packages/agents/src/prompt-registry.ts` | 5 prompt entries, versioned |
| `packages/agents/src/scene-operation-validator.ts` | Operation validation |
| `packages/agents/src/providers/ModelProvider.ts` | Provider interface |
| `packages/agents/src/providers/OpenAIProvider.ts` | OpenAI implementation |
| `packages/agents/src/providers/GeminiProvider.ts` | Gemini implementation |
| `packages/agents/src/providers/QwenProvider.ts` | Qwen implementation |
| `apps/studio/src/hooks/use-ai-command.ts` | Studio integration |
| `apps/studio/src/app/api/ai/command/route.ts` | Command API |
| `apps/studio/src/app/api/ai/counterfactuals/route.ts` | Counterfactual API |
| `apps/studio/src/app/api/ai/report/route.ts` | Report API |
| `Docs/architecture/05_AI_AGENT_ARCHITECTURE.md` | Architecture doc |
