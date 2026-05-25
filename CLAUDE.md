# SentinelTwin — Claude Code Instructions

## Instruction Stack (Read in Order)

1. `/Users/pranay/AGENTS.md` (if accessible)
2. `/Users/pranay/Projects/AGENTS.md`
3. `/Users/pranay/Projects/SentinelTwin/AGENTS.md` ← this repo's rules
4. `/Users/pranay/Projects/SentinelTwin/motto_v2.md`
5. `Docs/decisions/DECISION_LOG.md` ← decisions already made, do not re-decide
6. `Docs/decisions/OPEN_QUESTIONS.md` ← questions to answer as you go
7. `Docs/todos/PHASE_0_SETUP.md` ← start here if no code exists yet
8. `Docs/todos/PHASE_1_COVERAGE_ENGINE.md`
9. `Docs/todos/PHASE_2_EDITOR_INTEGRATION.md`

## What This Project Is

SentinelTwin is an AI-native physical security simulation platform.
It forks [Pascal Editor](https://github.com/pascalorg/editor) (MIT) and adds a security
simulation layer on top: camera coverage, DORI quality scoring, adversarial path simulation,
temporal security profiling, AI command layer, and client report generation.

The founding principle: AI proposes. Simulation verifies. AI explains.
The simulation engine is deterministic geometry — not AI. AI is the interface.

## Current State

**No code exists yet.** The repo is in pure documentation / architecture phase.
All architectural decisions and data model designs are in `Docs/architecture/`.
Read those before writing any code.

## Architecture Docs (Must Read Before Coding)

| Doc | Read it for |
|---|---|
| `Docs/architecture/00_ARCHITECTURE_OVERVIEW.md` | Full system picture, 5 layers |
| `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md` | The schema — foundation of everything |
| `Docs/architecture/02_PASCAL_EDITOR_INTEGRATION.md` | Fork strategy, what we inherit |
| `Docs/architecture/03_COVERAGE_ENGINE.md` | Raycasting, DORI, BVH, tests |
| `Docs/architecture/04_ADVERSARIAL_PATH_SIMULATION.md` | Novel feature — Dijkstra design |
| `Docs/architecture/05_AI_AGENT_ARCHITECTURE.md` | Provider abstraction, agent types |
| `Docs/architecture/06_TEMPORAL_SIMULATION.md` | 24h simulation (V0.3 feature) |
| `Docs/architecture/07_RENDERING_PIPELINE.md` | R3F layout, heatmap, camera feed |
| `Docs/architecture/08_MONOREPO_STRUCTURE.md` | Turborepo layout, package rules |

## Origin Context (Background — Read If Needed)

All founding conversations and documents are in `Docs/context/origin/`.
See `Docs/context/origin/INDEX.md` for what each file is.

**Important:** If anything in the origin files conflicts with `Docs/architecture/` or
`Docs/decisions/DECISION_LOG.md`, the architecture docs and decision log win.
The origin files are preserved history, not current truth.

Pranay is actively adding more context from other chat sessions into this folder.
When new files appear in `Docs/context/origin/`, read them for new ideas or direction changes,
then update the INDEX.md and propagate any meaningful changes to the architecture docs or
open questions. Do not silently absorb context — surface anything that changes prior decisions.

## Decisions Already Made (Do Not Re-Decide Without Logging)

See `Docs/decisions/DECISION_LOG.md` for full rationale. Summary:
- D-001: Fork Pascal Editor (MIT)
- D-002: SecurityScene is the single source of truth
- D-003: Coverage engine is deterministic geometry, not AI
- D-004: three-mesh-bvh is mandatory from day one
- D-005: Model-agnostic with GPT-4o as V0.1 default
- D-006: Instanced mesh for heatmap
- D-007: Secondary Canvas for camera feed view
- D-008: Rapier optional — simple AABB for V0.1
- D-009: Dijkstra for adversarial path

## Start Here

See `Docs/todos/PHASE_0_SETUP.md` for the first concrete tasks.

## Non-Negotiable Rules

1. SecurityScene is the single source of truth. No parallel scene representations.
2. AI never returns coverage numbers directly. Simulation computes them.
3. `src/simulation/` (or `packages/simulation/`) must have zero React, R3F, Zustand,
   DOM, or browser API imports. It must run in a Web Worker without modification.
   It MAY import `three` and `three-mesh-bvh` — these are pure geometry libraries.
4. three-mesh-bvh is required from the first working coverage engine. No exceptions.
5. Schema changes require updating types + Zod + simulation engine + AI prompts + report templates.
6. Document every divergence from any external fork in `Docs/decisions/DECISION_LOG.md`.
7. No AI co-author trailers in commits (motto_v2 Section 20).
8. Build and prove the simulation pipeline before introducing external editor forks (D-010).

## New Context File Protocol

When Pranay adds a new file to `Docs/context/origin/`:

1. Read it fully before doing anything else
2. Extract: new ideas, changed directions, new constraints, references to external tools/models
3. Check each against existing architecture docs and decisions
4. For conflicts: flag explicitly, do not silently override
5. For new ideas: add to `Docs/exploration/EXPLORATION_MAP.md` with source reference
6. For new constraints: add to `Docs/decisions/OPEN_QUESTIONS.md` or `DECISION_LOG.md`
7. Update `Docs/context/origin/INDEX.md` with the new file entry
8. Only then proceed with coding work

## Key Commands (After Fork Setup)

```bash
# Install
bun install

# Dev
bun dev

# Test
bun test

# Typecheck
bun typecheck

# Build all packages
turbo build
```
