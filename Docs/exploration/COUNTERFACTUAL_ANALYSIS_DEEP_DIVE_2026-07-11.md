# Counterfactual Analysis Pipeline — Deep Dive

**Date:** 2026-07-11  
**Thread:** 163  
**Status:** Documentation complete

---

## Executive Summary

SentinelTwin's counterfactual analysis pipeline answers the question: **"What if we changed something?"** It generates fix candidates, verifies each through full simulation, ranks by improvement, and presents results in a sandboxed UI where operators can preview, compare, and apply changes.

**Core principle:** AI proposes. Simulation verifies. No change reaches the scene without passing through the simulation engine first.

---

## Architecture: Three Surfaces

The codebase has **three cooperating counterfactual surfaces** that live in different packages:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COUNTERFACTUAL ANALYSIS PIPELINE                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. ALGORITHMIC SEARCH (packages/simulation)                │   │
│  │     computeCounterfactualSearch()                           │   │
│  │                                                             │   │
│  │  • Enumerates candidate action plans                        │   │
│  │  • Runs simulateStudio() against each                      │   │
│  │  • Ranks by coverage gain                                   │   │
│  │  • Deterministic, no AI, runs in Web Worker                 │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  2. AI PROPOSER (packages/agents)                           │   │
│  │     proposeCounterfactuals()                                │   │
│  │                                                             │   │
│  │  • Takes issue summary + scene context                     │   │
│  │  • Asks LLM for natural-language fix suggestions            │   │
│  │  • Returns structured SceneOperation arrays                │   │
│  │  • Cloud-backed; disabled by local-only mode               │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  3. STUDIO RUNNER (apps/studio/src/simulation)              │   │
│  │     counterfactual-runner.ts                                │   │
│  │                                                             │   │
│  │  • Coordinates deterministic search + AI proposals          │   │
│  │  • Applies local constraints (budget, wiring, privacy)      │   │
│  │  • Runs each plan through simulateStudio()                 │   │
│  │  • Surfaces ranked plans for CounterfactualPanel UI         │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  4. FIX SANDBOX (apps/studio/src/store + components)        │   │
│  │                                                             │   │
│  │  • Operator-initiated OR AI-proposal-initiated              │   │
│  │  • Baseline scene preserved for revert                      │   │
│  │  • Draft scene receives mutations                           │   │
│  │  • "Run Review" re-simulates to verify impact               │   │
│  │  • "Apply Changes" commits to live scene                    │   │
│  │  • "Discard" reverts to baseline                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Surface 1: Algorithmic Search

**File:** `packages/simulation/src/counterfactual-search.ts` (~360 lines)

### Core Function

```typescript
function computeCounterfactualSearch(
  scene: SecurityScene,
  baseline: SimulationResult,
  constraints?: CounterfactualConstraints,
): CounterfactualSearchResult
```

### Candidate Generation (4 Types)

#### Type 1: Rotate Camera Toward Failing Zone

For each failing zone, for each camera covering that zone:

```typescript
// Re-aim camera toward zone center
const [zoneX, zoneZ] = polygonCenter(zoneDef.polygon);
const dx = zoneX - patchedCamera.position[0];
const dz = zoneZ - patchedCamera.position[2];
patchedCamera.yawDeg = Math.round(Math.atan2(dx, dz) * (180 / Math.PI));
patchedCamera.pitchDeg = -28;

const result = simulateStudio(patchedScene);
```

**Cost:** `low` (wall/ceiling mount) or `medium` (pole mount)

#### Type 2: Move Obstruction Away from Zone

For each movable obstruction within 3m of a failing zone center:

```typescript
// Push obstruction away from zone center
const vx = ox - zoneX;
const vz = oz - zoneZ;
const len = Math.hypot(vx, vz) || 1;
const pushDist = Math.max(obs.dimensions[0], obs.dimensions[1]) + 1.2;
patchedObs.position[0] = clamp(ox + (vx / len) * pushDist, 0.4, width - 0.4);
patchedObs.position[2] = clamp(oz + (vz / len) * pushDist, 0.4, depth - 0.4);
```

**Cost:** `free` (if movableByAI) or `low` (manual move)

#### Type 3: Add Camera Near Failing Zone

Suggests 2 positions per failing zone (ceiling + wall mount):

```typescript
addPositions.push(
  { x: cx + 2, z: cz + 2, mount: "ceiling" },
  { x: cx - 2, z: cz - 2, mount: "wall" },
);
```

**Cost:** `medium` ($200–$800 estimated)

#### Type 4: Add Light Near Failing Zone (Night Only)

Only generated when `timeOfDay !== "day"`:

```typescript
patchedScene.securityLights.push({
  lightType: "flood",
  position: [cx, 3.5, cz],
  brightness: "high",
  rangeM: 8,
  coneDeg: 90,
  illuminatesNightCoverage: true,
});
```

**Cost:** `low` ($50–$200 estimated)

### Scoring Algorithm

```typescript
function computeCandidateScore(improved, quality, cost, zoneDelta): number {
  let score = 0;
  
  if (improved) score += 10;                          // Zone quality improved
  if (quality) score += qualityToScore(quality);       // Absolute quality level
  
  const costPenalty = { free: 0, low: 2, medium: 5, high: 10 };
  score -= costPenalty[cost] ?? 5;                     // Penalize expensive fixes
  
  score += zoneDelta * 3;                              // Bonus per zone resolved
  
  return Math.max(0, score);
}
```

### Search Constraints

```typescript
interface CounterfactualConstraints {
  cameraCannotMoveIds?: string[];   // Fixed cameras
  noNewCamera?: boolean;            // Budget constraint
  maxCostCategory?: "free" | "low" | "medium" | "high";
  noPrivacyViolation?: boolean;     // Privacy gate
  maxChanges?: number;              // Max actions per candidate (default: 3)
  targetZoneIds?: string[];         // Focus on specific zones
}
```

### Output Structure

```typescript
interface CounterfactualSearchResult {
  baselineLabel: "current";
  candidates: CounterfactualResult[];
  candidateCount: number;
  topRecommendationId?: string;
  constraints: CounterfactualConstraints;
  computedAt: number;
}
```

---

## Surface 2: AI Proposer

**File:** `packages/agents/src/counterfactual-agent.ts` (~80 lines)

### Core Function

```typescript
async function proposeCounterfactuals(
  issuesSummary: string,
  sceneSummary: string,
  constraints: string[],
  provider: ModelProvider,
): Promise<CounterfactualCandidate[]>
```

### Prompt Structure

```
System: You are a security planning assistant. Given a scene with coverage
issues, propose specific fixes as structured SceneOperation arrays.

User:
Current problems: [issuesSummary]
Scene context: [sceneSummary]
Constraints: [constraints.join(", ")]

Return: { candidates: [{ description, rationale, operations, costCategory, risks, assumptions }] }
```

### Response Schema (Zod-validated)

```typescript
const counterfactualResponseSchema = z.object({
  candidates: z.array(z.object({
    description: z.string().min(8),
    rationale: z.string().min(8).optional(),
    operations: z.array(sceneOperationSchema).min(1),
    costCategory: z.enum(["free", "low", "medium", "high"]),
    risks: z.array(z.string()).optional(),
    assumptions: z.array(z.string()).optional(),
  })),
});
```

### AI Candidate Structure

```typescript
interface CounterfactualCandidate {
  id: string;                          // "cf_<uuid>"
  description: string;
  operations: SceneOperation[];        // Structured scene mutations
  costCategory: "free" | "low" | "medium" | "high";
  estimatedImpact: string;
  rationale?: string;
  risks?: string[];
  assumptions?: string[];
  verifiedDelta?: {                    // Populated after simulation verification
    totalCoveragePctDelta: number;
    blindspotPctDelta: number;
    criticalZoneStatusChanges: string[];
    worstIssueResolved: boolean;
    adversarialPathExposureDelta?: number;
  };
  rank?: number;
}
```

### Rate Limiting

```typescript
// From ai-rate-limit.ts
counterfactual: { maxRequests: 8, windowMs: 60_000 }
```

### Local-Only Mode Gate

```typescript
// From /api/ai/counterfactuals/route.ts
if (providerMode === "local-only") {
  return NextResponse.json({
    error: "Local-only mode blocks cloud-backed counterfactual proposals.",
    errorCode: "LOCAL_ONLY_MODE",
  }, { status: 403 });
}
```

---

## Surface 3: Studio Runner

**File:** `apps/studio/src/simulation/counterfactual-runner.ts` (~200 lines)

### Core Function

```typescript
function generateAndRankCounterfactuals(
  scene: SecurityScene,
  baselineResult: SimulationResult,
  constraints: CounterfactualConstraint,
): CounterfactualPlan[]
```

### Candidate Action Generation

```typescript
function generateCandidateActions(scene, constraints): CounterfactualAction[] {
  const actions = [];
  
  // 1. Move movable obstructions
  for (const obs of scene.obstructions) {
    if (obs.movableByAI) {
      actions.push({
        type: "move_object",
        suggestedPosition: [obs.position[0] + 3, obs.position[1], obs.position[2]],
        estimatedCost: 0,
      });
    }
  }
  
  // 2. Rotate all cameras (+15° yaw)
  for (const cam of scene.cameras) {
    actions.push({
      type: "rotate_camera",
      suggestedYawDeg: cam.yawDeg + 15,
      suggestedPitchDeg: -30,
      estimatedCost: 50,
    });
  }
  
  // 3. Add camera (if budget allows)
  if (!constraints.noNewWiring && constraints.maxBudget >= 500) {
    actions.push({
      type: "add_camera",
      suggestedPosition: [width/2, 2.5, depth/2],
      estimatedCost: 500,
    });
  }
  
  return actions;
}
```

### Plan Simulation

Each action (or compound pair) is applied to a cloned scene and simulated:

```typescript
for (const plan of candidatePlans) {
  let patchedScene = scene;
  for (const action of plan.actions) {
    patchedScene = applyAction(patchedScene, action);
  }
  
  const result = simulateStudio(patchedScene);
  
  plan.simulationResult = result;
  plan.simulatedCoveragePct = result.totalCoveragePct;
  plan.simulatedImprovementPct = result.totalCoveragePct - baselineResult.totalCoveragePct;
  
  // Track per-zone deltas
  plan.zoneDeltas = result.criticalZoneResults.map((zone, i) => ({
    zoneId: zone.label,
    baselineStatus: baselineResult.criticalZoneResults[i]?.status ?? "unknown",
    proposedStatus: zone.status,
    coverageChangePct: (zone.coveragePct ?? 0) - (baselineResult.criticalZoneResults[i]?.coveragePct ?? 0),
    improved: baselineResult.criticalZoneResults[i]?.status === "fail" && zone.status === "pass",
  }));
}
```

### Ranking

```typescript
validPlans.sort((a, b) => {
  // Primary: coverage improvement (descending)
  if (a.simulatedImprovementPct !== b.simulatedImprovementPct) {
    return (b.simulatedImprovementPct || 0) - (a.simulatedImprovementPct || 0);
  }
  // Secondary: cost (ascending — cheaper first)
  return a.totalCost - b.totalCost;
});
```

---

## Fix Sandbox UI

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FIX SANDBOX                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Baseline    │  │   Draft      │  │   Diff       │             │
│  │   Scene       │  │   Scene      │  │   Tracker    │             │
│  │              │  │              │  │              │             │
│  │  Snapshot    │  │  Mutations   │  │  cameras     │             │
│  │  preserved   │  │  applied to  │  │  zones       │             │
│  │  for revert  │  │  this copy   │  │  affected    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    FixSandboxBar                             │   │
│  │                                                             │   │
│  │  [Shield] Fix Sandbox Active                                │   │
│  │  2 cameras changed · 1 zone affected                       │   │
│  │  [Review stale] [Run Review] [Apply Changes] [Discard]     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Origin: "operator" → amber accent                                  │
│          "ai_proposal" → violet accent ("AI proposed — verify")     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sandbox State

```typescript
// From governance-slice.ts
fixSandboxActive: boolean;
fixSandboxBaselineScene: SecurityScene | null;   // Original for revert
fixSandboxDraftScene: SecurityScene | null;       // Mutations applied here
fixSandboxDiff: {
  camerasChanged: number;
  zonesAffected: number;
  needsRecompute: boolean;
};
fixSandboxOrigin: "operator" | "ai_proposal" | null;
```

### Mutation Flow

When `fixSandboxActive`, all scene mutations go to `fixSandboxDraftScene` instead of the live scene:

```typescript
// From scene-slice.ts
if (fixSandboxActive && fixSandboxDraftScene) {
  const patchedDraft = translateNodesInScene(fixSandboxDraftScene, selectedNodeIds, delta);
  set({ fixSandboxDraftScene: patchedDraft, fixSandboxDiff: { ...diff, needsRecompute: true } });
} else {
  // Normal path — mutate live scene
}
```

### AI Proposal Flow

AI counterfactual proposals are routed through the sandbox (Trust Pass T3):

```typescript
// From use-ai-command.ts
if (!storeState.fixSandboxActive) {
  storeState.enterFixSandboxForAiProposal();  // Sets origin = "ai_proposal"
}

// Mutations applied to draft scene
const draft = useStudioStore.getState().fixSandboxDraftScene;
// ... apply candidate operations to draft ...
```

### Visual Distinction

| Origin | Border | Background | Icon | Label |
|--------|--------|------------|------|-------|
| Operator | `border-amber-500/30` | `bg-amber-500/5` | Shield | "Fix Sandbox Active" |
| AI Proposal | `border-violet-500/30` | `bg-violet-500/8` | Sparkles | "AI Proposal — verify before committing" |

### Review States

| State | Badge | Meaning |
|-------|-------|---------|
| `needsRecompute` | ⚠️ "Review stale" | Draft changed, needs re-simulation |
| `simulationRunning` | 🔄 "Verifying" | Simulation in progress |
| Verified | ✅ "Reviewed" / "Verified — safe to apply" | Simulation passed |

### Actions

| Action | Effect |
|--------|--------|
| **Run Review** | Re-runs `simulateStudio()` on draft scene |
| **Apply Changes** | Commits draft to live scene, exits sandbox |
| **Discard** | Reverts to baseline scene, exits sandbox |
| **Ctrl+Shift+S** | Toggle sandbox on/off |

---

## CounterfactualPanel UI

**File:** `apps/studio/src/components/bottom-panel/CounterfactualPanel.tsx` (~400 lines)

### Two Modes

| Mode | Engine | API Required | Visual |
|------|--------|-------------|--------|
| **Sim Scan** | Algorithmic search | No | Green (Cpu icon) |
| **AI** | LLM proposer | Yes | Purple (Sparkles icon) |

### Sim Mode Flow

1. Operator enters constraints (budget, wiring, privacy)
2. Clicks scan button → `generateCounterfactuals(parseConstraints(constraints))`
3. Plans appear as `SimPlanCard` components
4. Each card shows: cost tier, coverage delta, zone resolution count
5. **Preview Fix** → applies plan to draft scene, re-simulates
6. **Apply Fix** → commits to live scene
7. **Revert** → restores baseline

### AI Mode Flow

1. Operator enters natural-language constraints
2. Clicks arrow → `runCounterfactuals(constraintList, setAiCandidates)`
3. Candidates appear as `AiCandidateCard` components
4. Each card shows: rank, description, cost category, verified deltas
5. **Apply This Fix** → routes through fix sandbox
6. **Batch Compare** → table view with all candidates side-by-side

### Constraint Parsing (Sim Mode)

```typescript
function parseConstraints(raw: string): CounterfactualConstraint {
  return {
    noNewWiring: /no.*(new.*(wiring|cable|install)|wiring)/i.test(raw),
    privacyPreserving: /privacy/i.test(raw),
    maxBudget: (() => {
      const m = raw.match(/budget\s*[:=]?\s*\$?\s*(\d+)/i);
      return m ? Number(m[1]) : undefined;
    })(),
  };
}
```

### Baseline Snapshot Prompt

If no snapshots exist, the panel prompts:

```
Save a baseline snapshot before applying fixes to enable Before/After comparison.
[Save Baseline]
```

### Post-Apply CTA

After applying a fix:

```
✅ "Re-aim Camera 1 toward Cashier Zone" applied.
[GitCompare] Compare → saves "After:" snapshot, navigates to Before/After tab
```

---

## Data Flow Summary

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Scene +     │────▶│  Algorithmic  │────▶│  Ranked      │
│  Baseline    │     │  Search       │     │  Candidates  │
│  Result      │     │  (Worker)     │     │              │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
┌─────────────┐     ┌──────────────┐            │
│  Issues +    │────▶│  AI Proposer  │────────────┤
│  Scene       │     │  (Cloud API)  │            │
│  Summary     │     └──────────────┘            │
└─────────────┘                                  │
                                                 ▼
                                    ┌──────────────────┐
                                    │  Counterfactual   │
                                    │  Panel UI         │
                                    │                   │
                                    │  [Preview] [Apply]│
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │  Fix Sandbox      │
                                    │                   │
                                    │  Baseline ← Draft │
                                    │  [Run Review]     │
                                    │  [Apply] [Discard]│
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │  Live Scene       │
                                    │  (committed)      │
                                    └──────────────────┘
```

---

## File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `packages/simulation/src/counterfactual-search.ts` | 360 | Algorithmic candidate generation + scoring |
| `packages/agents/src/counterfactual-agent.ts` | 80 | AI proposer via LLM |
| `apps/studio/src/simulation/counterfactual-runner.ts` | 200 | Studio-side runner + ranking |
| `apps/studio/src/components/bottom-panel/CounterfactualPanel.tsx` | 400 | Dual-mode UI (sim + AI) |
| `apps/studio/src/components/top-bar/FixSandboxBar.tsx` | 150 | Sandbox chrome + actions |
| `apps/studio/src/store/slices/core/simulation-slice.ts` | 450+ | Store: plans, preview, apply |
| `apps/studio/src/store/slices/enterprise/governance-slice.ts` | 1,200+ | Sandbox state + persistence |
| `apps/studio/src/hooks/use-ai-command.ts` | 1,300+ | AI candidate flow + sandbox routing |
| `apps/studio/src/app/api/ai/counterfactuals/route.ts` | 90 | API endpoint for AI proposer |
| `packages/core/src/schema/security-scene.ts` | 1,700+ | CounterfactualResult, CounterfactualSearchResult schemas |
| `packages/simulation/src/__tests__/counterfactual-search.test.ts` | 150+ | Algorithmic search tests |
| `apps/studio/src/simulation/__tests__/counterfactual-runner.test.ts` | 100+ | Runner tests |

---

## Gaps & Future Work

| Gap | Impact | Priority |
|-----|--------|----------|
| No multi-action compound scoring | Only top-2 actions combined | Medium |
| No cost estimation from scene context | Fixed cost tiers only | Low |
| No privacy zone violation detection in algorithmic search | Relies on constraint flag | Medium |
| No undo after apply | Must manually revert | Medium |
| No batch apply (apply top-N fixes together) | One-at-a-time only | Low |
| No learning from past counterfactuals | Same candidates regenerated | Low |
| No integration with temporal simulation | Counterfactuals verified at current time only | Medium |

---

## Related Exploration Threads

- Thread 160: Rendering Pipeline (coverage visualization during preview)
- Thread 157: Coverage Engine (simulation verification core)
- Thread 162: Temporal Simulation (time-aware counterfactuals)
- Thread 161: Governance & Audit Trail (evidence logging for applied fixes)
