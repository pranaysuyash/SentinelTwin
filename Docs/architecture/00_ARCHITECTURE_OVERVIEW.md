# Architecture Overview

**Status:** Draft — 2026-05-25
**Author:** Claude (from Pranay's briefing and exploration sessions)
**Next review:** After data model design is confirmed

---

## 1. System Identity

SentinelTwin is not a CCTV planner. It is a **physical security simulation platform** where every
element of a physical space — cameras, lights, obstructions, access points, time of day, lighting
conditions, and human movement — is an editable variable in a continuous risk model.

The core product interaction is:

```
Edit scene
  → coverage engine recomputes
  → risk map updates live
  → AI explains what changed
  → system recommends cheapest practical fix
  → report updates
```

Everything must feel alive. Every edit triggers a cascade.

---

## 2. Five Layers

SentinelTwin is built in five distinct, independently testable layers:

```
┌─────────────────────────────────────────────────┐
│ Layer 5: Output                                  │
│ Reports, exports, client audits, before/after    │
├─────────────────────────────────────────────────┤
│ Layer 4: Intelligence                            │
│ AI agents, NL commands, optimization, reporting  │
├─────────────────────────────────────────────────┤
│ Layer 3: Simulation                              │
│ Coverage engine, adversarial paths, temporal sim │
├─────────────────────────────────────────────────┤
│ Layer 2: Scene Model                             │
│ SecurityScene — the single source of truth       │
├─────────────────────────────────────────────────┤
│ Layer 1: Space Creation                          │
│ Pascal Editor fork — walls, rooms, objects       │
└─────────────────────────────────────────────────┘
```

**Critical rule:** Layers communicate only through the SecurityScene schema.
No layer reaches into another layer's internals. The schema is the contract.

---

## 3. Pascal Editor as Foundation

SentinelTwin forks [Pascal Editor](https://github.com/pascalorg/editor) (MIT license).

Pascal provides Layer 1 for free:
- Wall drawing with corner mitering
- Door/window placement with CSG cutouts
- Floor/ceiling/roof geometry
- Zone/room definitions
- Furniture placement
- Multi-level support (stacked/exploded/solo modes)
- React Three Fiber + Zustand + WebGPU architecture
- Flat dictionary node store with dirty tracking
- Zod schemas, IndexedDB persistence, undo/redo (Zundo)
- JSON import/export

SentinelTwin adds security node types to Pascal's `AnyNode` union:
`CameraNode`, `SecurityLightNode`, `CriticalZoneNode`, `PersonPathNode`, `VehiclePathNode`,
`PrivacyZoneNode`, `EntryPointNode`, `GuardPatrolNode`

And adds security systems to Pascal's system loop:
`CameraSystem`, `CoverageSystem`, `PathSystem`, `QualitySystem`, `AdversarialPathSystem`

**Why fork, not depend-on:**
SentinelTwin will mutate the data model, rendering pipeline, and tool system too deeply for
a clean dependency relationship. Fork gives full ownership while keeping Pascal's foundation.
Every divergence from upstream must be documented in `Docs/decisions/DECISION_LOG.md`.

---

## 4. The SecurityScene Schema

SecurityScene is the **single source of truth** for all layers.
Details in `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md`.

High-level shape:

```typescript
type SecurityScene = {
  // Space (from Pascal)
  walls: WallNode[];
  slabs: SlabNode[];
  doors: DoorNode[];
  windows: WindowNode[];
  items: ItemNode[];
  levels: LevelNode[];

  // Security (SentinelTwin additions)
  cameras: CameraNode[];
  lights: SecurityLightNode[];
  obstructions: ObstructionNode[];
  criticalZones: CriticalZoneNode[];
  privacyZones: PrivacyZoneNode[];
  entryPoints: EntryPointNode[];
  paths: ScenarioPath[];
  guardPatrols: GuardPatrolNode[];

  // Simulation state
  assumptions: SimulationAssumptions;
  simulation?: SimulationResult;
  snapshots: SceneSnapshot[];
  scenarios: Scenario[];
};
```

---

## 5. Coverage Engine

The coverage engine is **deterministic geometry — not AI**.

For every (camera, grid cell) pair:
1. Is camera on?
2. Is point inside horizontal + vertical FOV cone?
3. Is point within camera range?
4. Raycast camera → point. Does ray intersect any visionCollider before reaching point?
5. Compute pixel density at distance given camera resolution and FOV.
6. Apply quality penalties: lighting, clarity, angle, material transmission.
7. Map numeric score to DORI category: none / detection / observation / recognition / identification.

Grid: 40×40 default on V0.1, recomputed on mouse-up not every drag frame.
Acceleration: `three-mesh-bvh` for all raycasting — mandatory, not optional.

Details in `Docs/architecture/03_COVERAGE_ENGINE.md`.

---

## 6. Adversarial Path Simulation — The Frontier Feature

This is genuinely novel. No existing security tool does this.

Model the floor as a weighted graph where each node's weight is the detection probability from
all cameras combined. Then find the path from entry to target that **minimizes** cumulative
detection exposure. This is the path a motivated actor would take.

Show that path to the security planner. They immediately see the gap — not inferred from a
heatmap, but as a concrete exploitable route.

When the planner fixes coverage (moves camera, moves obstruction, adds light), the adversarial
path recomputes and must find a new route or fail to find one below a risk threshold.

The interaction becomes:
```
Fix coverage → adversarial path changes → new gap revealed → fix again → gap closes
```

This is "red team vs blue team" as a live interactive simulation.

Details in `Docs/architecture/04_ADVERSARIAL_PATH_SIMULATION.md`.

---

## 7. AI Agent Architecture

AI is used for:
- Parsing natural language commands → structured SecurityScene operations
- Proposing counterfactual change candidates
- Explaining simulation results in plain language
- Generating client-ready reports
- Extracting camera specs from spec sheets
- Scene understanding from photos/floor plans (V0.2+)

AI is **not** used for:
- Computing coverage or visibility (deterministic geometry does that)
- Making direct security recommendations (simulation verifies first)
- Generating numbers that go into reports without verification

The pipeline is model-agnostic. All model calls go through a provider abstraction:
`OpenAIProvider | GeminiProvider | QwenProvider | LocalProvider`

For OpenAI hackathon context: GPT-4o with Structured Outputs is default.
Switch is a config flag, not a code change.

Details in `Docs/architecture/05_AI_AGENT_ARCHITECTURE.md`.

---

## 8. Temporal Simulation

Real spaces have 24-hour security profiles. Most tools only think in "day" and "night" modes.

SentinelTwin will model:
- Exterior natural lighting (sunrise/sunset curves)
- Interior artificial light schedules (office hours, after-hours, cleaning)
- Access states (which doors locked/unlocked at which hours)
- Occupancy levels (crowds that obscure camera views)
- Environmental risk windows (when is the space most vulnerable?)

Output: "Your facility has three peak-vulnerability windows. The most critical is 2AM–4AM when
exterior perimeter lighting cuts out and Camera 3's IR range doesn't cover the loading bay gate."

Details in `Docs/architecture/06_TEMPORAL_SIMULATION.md`.

---

## 9. Three Object Layers (Critical)

Every physical object in the scene has three independent layers:

```typescript
type SecurityEntity = {
  id: string;
  visualMesh: THREE.Object3D;    // what user sees
  physicsCollider?: unknown;      // blocks movement (Rapier)
  visionCollider: THREE.Mesh;    // blocks camera rays
  metadata: {
    material: MaterialType;       // affects visionCollider transmission
    movable: boolean;
    blocksVision: boolean;
    visionTransmission: number;   // 0=full block, 1=full pass
  };
};
```

The physics collider and vision collider are NOT the same thing.

| Object | Physics | Vision |
|---|---|---|
| Solid wall | Full block | Full block |
| Glass wall | Full block | Pass-through + glare penalty |
| Grill | Full block | Partial block (transmission ~0.4) |
| Cupboard | Full block | Full block |
| Curtain | Soft block | Major degradation |
| Mesh fence | Soft block | Partial degradation |

This distinction is what makes SentinelTwin's simulation credible vs toy cone-plotters.

---

## 10. Monorepo Structure

```
sentineltwin/
├── apps/
│   └── editor/          — main SentinelTwin web app
├── packages/
│   ├── core/            — SecurityScene schema, Zustand store, systems
│   ├── viewer/          — R3F rendering, security overlays, camera feeds
│   ├── simulation/      — coverage engine, adversarial, temporal (no React)
│   ├── agents/          — AI agent pipeline (model-agnostic)
│   └── report/          — report generation, export
├── experiments/         — model bakeoff harness, CV experiments
├── Docs/                — architecture, decisions, exploration (this folder)
└── turbo.json
```

Details in `Docs/architecture/08_MONOREPO_STRUCTURE.md`.

---

## 11. Build Phases

| Phase | What | Status |
|---|---|---|
| 0 | Architecture documentation | In progress |
| 1 | Pascal fork + monorepo scaffold | Not started |
| 2 | SecurityScene schema + Zustand store | Not started |
| 3 | Coverage engine: raycasting, DORI, heatmap | Not started |
| 4 | Camera + light + obstruction node system | Not started |
| 5 | AI command layer + counterfactual | Not started |
| 6 | Adversarial path simulation | Not started |
| 7 | Temporal simulation | Not started |
| 8 | Before/after snapshots + report generation | Not started |
| 9 | Demo scene (Small Retail Shop) | Not started |
| 10 | Scan/photo input (V0.2+) | Future |

---

## 12. What SentinelTwin Is NOT

- Not a CCTV management system (no live feeds in V0.1/V0.2)
- Not a physics simulation (Rapier is optional, not the core)
- Not an AI-hallucination security advisor (all recommendations are simulation-verified)
- Not a robbery planning tool (defensive framing only, always)
- Not a competitor to Figma for architecture — security simulation is the vertical
