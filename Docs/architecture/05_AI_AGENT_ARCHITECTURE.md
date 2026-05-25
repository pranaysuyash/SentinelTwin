# AI Agent Architecture

**Status:** Design — 2026-05-25

---

## Core Principle

AI proposes. Simulation verifies. AI explains.

No AI model ever returns security metrics, coverage numbers, or fix recommendations directly
to the user without simulation verification. The geometry engine is the source of truth.
The AI is the interface to it.

This prevents hallucinated security advice — which is the most dangerous thing a tool like
this could produce.

---

## What AI Does vs What Simulation Does

| Task | Who does it |
|---|---|
| Parse "move Camera 1 left" into scene operation | AI |
| Compute whether Camera 1 now covers the counter | Simulation |
| Explain why coverage improved | AI |
| Determine if cash counter meets recognition threshold | Simulation |
| Write the client report | AI (using simulation numbers) |
| Propose "move shelf to improve coverage" | AI |
| Test if moving the shelf actually improves coverage | Simulation |
| Rank candidates by impact | Simulation output → AI synthesizes |
| Voice command parsing | AI |
| Scene JSON from floor plan photo | AI (CV models) |

---

## Provider Abstraction

All model calls go through a typed provider interface:

```typescript
interface ModelProvider {
  name: string;
  complete(prompt: ModelPrompt): Promise<ModelResponse>;
  completeStructured<T>(
    prompt: ModelPrompt,
    schema: ZodSchema<T>,
  ): Promise<T>;
}

interface ModelPrompt {
  system: string;
  messages: ConversationMessage[];
  tools?: ToolDefinition[];
  images?: ImageInput[];
}
```

Implementations:
- `OpenAIProvider` — GPT-4o, Structured Outputs, tool calling
- `GeminiProvider` — Gemini 2.5 Flash/Pro, function calling
- `QwenProvider` — Qwen2.5-VL (for vision tasks), Qwen for reasoning
- `LocalProvider` — MiniCPM-V, Florence-2 (for experiments)

Config:
```typescript
type AgentConfig = {
  commandProvider: ProviderName;      // default: "openai"
  visionProvider: ProviderName;       // default: "qwen" or "gemini"
  reportProvider: ProviderName;       // default: "openai"
  counterfactualProvider: ProviderName; // default: "openai"
};
```

Switch = config change. Not a code change.

---

## Agent Definitions

### Command Agent

**Job:** Parse natural language commands into structured SecurityScene operations.

**Input:** User text, current SecurityScene snapshot
**Output:** `SceneOperation[]` — structured operations to apply to the scene

```typescript
type SceneOperation =
  | { type: "move_camera"; cameraId: string; newPosition: [number, number, number] }
  | { type: "rotate_camera"; cameraId: string; yawDeg: number; pitchDeg: number }
  | { type: "change_camera_fov"; cameraId: string; fovHorizontalDeg: number }
  | { type: "toggle_camera"; cameraId: string; status: CameraStatus }
  | { type: "move_obstruction"; obstructionId: string; newPosition: [number, number, number] }
  | { type: "add_light"; light: Partial<SecurityLightNode> }
  | { type: "toggle_light"; lightId: string; status: LightStatus }
  | { type: "set_time_of_day"; timeOfDay: TimeOfDay }
  | { type: "replay_path"; pathId: string }
  | { type: "run_adversarial" }
  | { type: "save_snapshot"; label: string }
  | { type: "generate_report" }

```

**Prompt template:**
```
You are SentinelTwin's command interpreter. Convert the user's natural language request
into structured scene operations. Output ONLY valid JSON matching the SceneOperation schema.
Do not explain, do not add commentary.

Current scene: {scene_summary}
User says: {user_input}

Return: { operations: SceneOperation[] }
```

**Uses:** GPT-4o Structured Outputs for reliable JSON.

---

### Counterfactual Agent

**Job:** Given a coverage problem, propose candidate fixes ranked by estimated impact and cost.

**Input:** Current SimulationResult, problem description, constraints (e.g., "Camera 1 cannot move")
**Output:** `CounterfactualCandidate[]` — proposed changes with predicted impact

**The critical loop:**
```
1. Counterfactual Agent proposes candidates
2. Simulation engine tests each candidate (applies operation, recomputes coverage)
3. Simulation returns verified deltas for each candidate
4. Agent synthesizes ranked recommendations using verified numbers
5. Present to user with before/after metrics
```

```typescript
type CounterfactualCandidate = {
  id: string;
  description: string;                   // "Move Shelf 1 to the right wall"
  operations: SceneOperation[];          // exact scene operations
  costCategory: "free" | "low" | "medium" | "high";
  estimatedImpact: string;               // AI's prediction BEFORE simulation
  verifiedDelta?: SimulationDelta;       // set AFTER simulation tests it
  rank?: number;                         // set after all candidates are verified
};

type SimulationDelta = {
  totalCoveragePctDelta: number;
  blindspotPctDelta: number;
  criticalZoneStatusChanges: ZoneStatusChange[];
  worstIssueResolved: boolean;
  adversarialPathExposureDelta?: number;
};
```

**System prompt:**
```
You are a security camera optimization expert. Given the current coverage analysis,
propose 3–5 candidate fixes. Consider only practical, low-cost changes unless the problem
is severe. Constraints: {constraints}

Current problems: {issues}
Scene context: {scene_summary}

Return: { candidates: CounterfactualCandidate[] }
Each candidate must include: description, operations, costCategory.
Do not include estimatedImpact or verified metrics — those will be filled by simulation.
```

---

### Report Agent

**Job:** Generate professional client-facing security audit report from simulation results.

**Input:** SimulationResult, before/after snapshots, scene metadata, recommendations
**Output:** Structured report JSON → rendered as HTML/PDF

```typescript
type SecurityReport = {
  title: string;
  siteInfo: SiteInfo;
  executiveSummary: string;
  sections: ReportSection[];
  assumptions: string[];
  limitations: string[];
  recommendations: RankedRecommendation[];
  generatedAt: number;
};
```

**Key rule:** All numbers in the report come from SimulationResult.
The AI writes prose. The simulation provides the facts.

**Prompt:**
```
Write a professional security camera coverage audit report for a client.
Use the verified simulation data below. Write in a clear, factual, non-alarmist tone.
Do not invent numbers. Do not claim more certainty than the data supports.
Use phrases like "estimated recognition-quality" not "guaranteed recognition."

Simulation data: {simulation_json}
Site: {site_name}
Cameras: {camera_count}
Issues: {issues_list}
Recommendations: {recommendations_with_verified_deltas}
```

---

### Scene Understanding Agent (V0.2+)

**Job:** Parse a floor plan image or site photo and extract SecurityScene node descriptions.

**Input:** Image(s), optional scale reference
**Output:** Draft SecurityScene JSON (flagged as AI-generated, requires user confirmation)

**Model priority:** Qwen2.5-VL or Gemini 2.5 Flash (vision specialists)

**Output format:**
```json
{
  "walls": [{ "startPoint": [0, 0], "endPoint": [10, 0], "confidence": 0.9 }],
  "doors": [{ "position": [5, 0], "width": 0.9, "confidence": 0.8 }],
  "obstructions": [
    { "label": "shelf", "position": [3, 4], "dimensions": [2, 0.5, 1.8], "confidence": 0.7 }
  ],
  "cameras": [
    { "position": [0, 0, 2.8], "yawDeg": 45, "confidence": 0.6 }
  ],
  "scaleFactorMPerPixel": 0.05,
  "overallConfidence": 0.72,
  "uncertainItems": ["shelf near entry unclear if solid or glass"]
}
```

**Key design:** The AI scene understanding output is always marked `source: "ai"` and
requires user confirmation before being applied. Users can click each detected object to
confirm or correct. This prevents invisible AI errors corrupting the simulation.

---

### Optimization Agent (Future V0.3)

**Job:** Given constraints (budget, immovable cameras, max N changes), find the optimal
change set that maximizes critical zone coverage improvement.

This is the most ambitious AI task. The approach:

```
1. Agent generates N candidate change sets (combinatorial)
2. Simulation tests all of them in batch
3. Agent selects Pareto-optimal solutions: max coverage improvement per unit cost
4. Present top 3 solutions with trade-offs explained
```

For complex scenes with many variables, this becomes a genuine optimization problem.
Future possibility: use a lightweight RL or evolutionary algorithm to search the space,
with the simulation as the fitness function.

---

## Tool Calling Schema

For OpenAI Structured Outputs, tool calls are defined as:

```typescript
const SENTINELTWIN_TOOLS: ToolDefinition[] = [
  {
    name: "apply_scene_operations",
    description: "Apply one or more scene operations to the current security scene",
    parameters: zodToJsonSchema(z.object({ operations: z.array(SceneOperationSchema) })),
  },
  {
    name: "compute_coverage",
    description: "Recompute coverage simulation for current scene",
    parameters: zodToJsonSchema(z.object({ forceFullRecompute: z.boolean().optional() })),
  },
  {
    name: "run_adversarial_analysis",
    description: "Run adversarial path analysis for the current scene",
    parameters: zodToJsonSchema(AdversarialConfigSchema),
  },
  {
    name: "save_snapshot",
    description: "Save current scene state as a named snapshot for comparison",
    parameters: zodToJsonSchema(z.object({ label: z.string() })),
  },
  {
    name: "generate_report",
    description: "Generate client security audit report from current simulation results",
    parameters: zodToJsonSchema(z.object({ includeBeforeAfter: z.boolean().optional() })),
  },
];
```

---

## Voice Command Layer

For OpenAI Realtime API:

```
User speaks → Realtime API transcribes + sends to Command Agent
Command Agent returns SceneOperation[]
Operations applied to scene
Coverage recomputes
AI speaks back: "I've moved Shelf 1 to the right wall. Cash counter coverage improved from
observation to recognition quality. Want me to save a before/after snapshot?"
```

For demo: typed commands only, with voice as enhancement.

---

## Model Bakeoff Harness

Before committing to a model for each agent role, run experiments:

```
experiments/
├── command_parsing/
│   ├── test_cases.json         — 50 NL commands with expected SceneOperation output
│   └── run_bakeoff.ts          — tests each provider, scores output accuracy
├── scene_understanding/
│   ├── test_images/            — 10 sample floor plan photos
│   ├── ground_truth.json       — expected object extractions
│   └── run_bakeoff.ts
├── counterfactual/
│   ├── test_cases.json         — 20 problem scenarios with known good fixes
│   └── run_bakeoff.ts
└── BAKEOFF_RESULTS.md          — running results log
```

Run bakeoff before deciding model defaults. Document results in BAKEOFF_RESULTS.md.
