# SentinelTwin — Agent Instructions

## Instruction Stack

Read in order before any work:
1. `/Users/pranay/AGENTS.md`
2. `/Users/pranay/Projects/AGENTS.md`
3. This file — `SentinelTwin/AGENTS.md`
4. `SentinelTwin/motto_v2.md`
5. `Docs/decisions/DECISION_LOG.md`
6. `Docs/decisions/OPEN_QUESTIONS.md`
7. `Docs/context/origin/INDEX.md` — check for new context files Pranay has added
8. `Docs/todos/PHASE_0_SETUP.md` (if no code exists yet)

## What SentinelTwin Is

SentinelTwin is an AI-native physical security simulation platform. It is not a CCTV planner.
It is a live security digital twin where cameras, lights, obstructions, access points, time,
lighting conditions, and human movement are all editable variables in a continuous risk model.

Core loop: `Edit scene → recompute coverage → show security impact → explain what changed → recommend fixes`

Product value: saves 4–8 hours per security audit, eliminates false confidence about coverage,
automates compliance evidence, and surfaces coverage gaps before incidents force discovery.

The simulation must feel alive. Every edit updates the risk map.

---

## Documentation Is How We Build

**This is not optional. Documentation is the primary deliverable that enables everything else.**

SentinelTwin is built documentation-first. Every significant decision, design, finding,
exploration thread, open question, and architectural choice is written down in `Docs/`
before or alongside implementation.

### Why this matters for agents specifically

1. **Codex runs documentation.** When Codex receives a task, it reads AGENTS.md and CLAUDE.md first.
   Good documentation means Codex builds correctly without being re-prompted about constraints.
   Poor documentation means Codex guesses and creates drift.

2. **Multiple agents work in parallel.** When 4 Codex sandboxes are running simultaneously,
   documentation is the only shared context. Docs are the synchronization mechanism.

3. **Documentation prevents re-derivation.** Every hour spent re-figuring out a decision
   that was already made is wasted. Docs capture the decision + rationale permanently.

4. **Reports and outputs reference docs.** SentinelTwin generates coverage reports with
   standards references (IEC 62676-4:2025). Those standard definitions live in docs.
   If docs are wrong, outputs are wrong.

### Documentation rules

**When you make any architectural decision:**
→ Add to `Docs/decisions/DECISION_LOG.md` with rationale and rejected alternatives.

**When you encounter an open question:**
→ Add to `Docs/decisions/OPEN_QUESTIONS.md` with priority and what's needed to answer it.

**When you discover something new (model finding, library behavior, API quirk, industry fact):**
→ Add to `Docs/exploration/EXPLORATION_MAP.md` as a new finding under the relevant thread.

**When you diverge from Pascal upstream:**
→ Add to `Docs/decisions/DECISION_LOG.md` with the specific file, line, and why.

**When you complete a phase:**
→ Update the relevant `Docs/todos/PHASE_N_*.md` with done/not-done status and findings.

**When you change the SecurityScene schema:**
→ Update `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md` + all 8 downstream locations.

**When Pranay adds a context file to `Docs/context/origin/`:**
→ Read it, extract signals, update INDEX.md and EXPLORATION_MAP.md.

---

## Architecture Foundation

SentinelTwin is built as a Turborepo monorepo that forks and extends Pascal Editor
(`pascalorg/editor`, MIT license). Pascal provides the spatial editing foundation (walls,
rooms, doors, windows, zones, levels, furniture). SentinelTwin adds the security simulation
layer on top.

Key packages:
- `@sentineltwin/core` — extends `@pascal-app/core` with security node types + coverage engine
- `@sentineltwin/viewer` — extends `@pascal-app/viewer` with security overlays + camera feeds
- `@sentineltwin/editor` — full editor app with security tools + AI command layer
- `@sentineltwin/simulation` — coverage engine, adversarial path sim, temporal sim (no React)
- `@sentineltwin/agents` — AI agent pipeline (model-agnostic, OpenAI/Gemini/Qwen switchable)
- `@sentineltwin/report` — report generation, before/after comparison, export

---

## Critical Files — Read Before Implementing Anything

| File | Purpose |
|---|---|
| `Docs/architecture/00_ARCHITECTURE_OVERVIEW.md` | Full system architecture |
| `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md` | SecurityScene schema — the single source of truth |
| `Docs/architecture/02_PASCAL_EDITOR_INTEGRATION.md` | How we extend Pascal — fork strategy |
| `Docs/architecture/03_COVERAGE_ENGINE.md` | Raycasting, DORI quality model, heatmap |
| `Docs/architecture/04_ADVERSARIAL_PATH_SIMULATION.md` | Adversarial path sim — the frontier feature |
| `Docs/architecture/05_AI_AGENT_ARCHITECTURE.md` | Multi-agent pipeline |
| `Docs/architecture/06_TEMPORAL_SIMULATION.md` | 24h temporal security profile |
| `Docs/architecture/07_RENDERING_PIPELINE.md` | R3F, WebGPU, camera feed view |
| `Docs/architecture/08_MONOREPO_STRUCTURE.md` | Full monorepo layout |
| `Docs/decisions/DECISION_LOG.md` | Architecture decisions made — read before proposing changes |
| `Docs/decisions/OPEN_QUESTIONS.md` | Open questions — pick up from here |
| `Docs/exploration/EXPLORATION_MAP.md` | Living research map — append, don't replace |
| `Docs/exploration/AGENTIC_SYSTEMS_CODEX.md` | How Codex is used, agent framework choices |
| `Docs/exploration/STANDARDS_COMPLIANCE_REGULATORY.md` | IEC 62676-4:2025, GDPR, NDAA, insurance |
| `Docs/exploration/OPEN_SOURCE_LICENSING.md` | License strategy — Apache 2.0, dependency audit |
| `Docs/exploration/CAMERA_DATASET.md` | Camera dataset plan and schema |
| `Docs/product/PRODUCT_VALUE_POSITIONING.md` | What problem we solve, for whom, how to pitch |
| `Docs/product/PRODUCT_THESIS.md` | Core product thesis and positioning |

---

## Origin Context Protocol

Pranay actively adds raw context files from different chat sessions into `Docs/context/origin/`.

**When you see new files in `Docs/context/origin/`:**
1. Read them before doing any other work in that session
2. Extract new ideas, direction changes, constraints, tool/model references
3. Check each against architecture docs and decision log
4. Flag conflicts — do not silently override decisions
5. Add new ideas to `Docs/exploration/EXPLORATION_MAP.md` with file reference
6. Add new constraints to `Docs/decisions/OPEN_QUESTIONS.md` or `DECISION_LOG.md`
7. Update `Docs/context/origin/INDEX.md` with the new file entry
8. Then proceed with work

**Conflict resolution:** Architecture docs and decision log win over origin files.

---

## Canonical Rules

### SecurityScene is the single source of truth
All agents, all AI models, all UI panels, all simulation stages read and write one schema.
Do not create parallel scene representations.

### AI proposes. Simulation verifies.
No AI model ever returns security recommendations directly to the user.
All recommendations are proposed as structured operations on SecurityScene,
tested by the simulation engine, and presented with verified delta metrics.

### Model-agnostic but OpenAI-switch-ready
Provider abstraction — switch between OpenAI/GPT-4o, Gemini 2.5, Qwen2.5-VL via config flag.
OpenAI Agents SDK pattern for multi-agent workflows. Codex for parallel build tasks.

### Open source — Apache 2.0
SentinelTwin's own code is Apache 2.0. All dependencies must be MIT, Apache 2.0, or BSD.
No GPL, AGPL, CC BY-NC, or BSL dependencies. See `Docs/exploration/OPEN_SOURCE_LICENSING.md`.
DUSt3R and MASt3R are CC BY-NC-SA — use VGGT (MIT) instead.
GSAP is proprietary for SaaS — use Framer Motion (MIT) instead.

### Standards-compliant simulation
Coverage quality uses IEC 62676-4:2025 OODPCVS (7 levels) by default.
DORI (2014, 4 levels) supported as legacy option.
All reports reference the standard used. See `Docs/exploration/STANDARDS_COMPLIANCE_REGULATORY.md`.

### Defensive framing only
Output language: "authorized incident replay," "coverage failure analysis," "hardening recommendations."
Never: "avoid cameras," "bypass security," "optimal evasion."

### Coverage Engine is deterministic geometry, not AI
Raycasting, DORI/OODPCVS scoring, heatmap, path visibility = deterministic Three.js.
AI explains results. AI does not compute them.

---

## Development Standards

- Think from first principles. Root cause over surface patch.
- No hacks. No workarounds into production paths.
- Pascal-forked code: document every divergence in `Docs/decisions/DECISION_LOG.md`.
- Every coverage engine change must include a test that exercises the relevant scenario.
- Schema changes to SecurityScene require updating ALL layers: TypeScript types, Zod schemas, simulation engine, AI agent system prompts, report templates.
- Do not add GPU/WASM acceleration before the pure-JS version is verified correct.
- Documentation is part of delivery. If behavior changed and docs didn't update — the task is not done.

---

## Monorepo Conventions

- All packages under `packages/`, all apps under `apps/`
- `@sentineltwin/simulation` must have zero React dependencies (runs in worker)
- No cross-package imports that create circular dependencies
- Turborepo pipeline: `build`, `dev`, `test`, `typecheck`
- License: Apache 2.0 in all `package.json` files

---

## Git Rules

Follow `/Users/pranay/Projects/motto_v2.md` Section 3 (Git Safety) and Section 20 (no AI co-author trailers).
Read-only git commands only unless user explicitly approves writes in this conversation.

---

## Status

Phases 0–2 complete. Simulation engine, schema, store, and core UI all built and working.
See `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md` for exact verified state.
See `Docs/todos/CAMERASTUDIO_GAP_ANALYSIS.md` for gap analysis vs full product spec.
See `Docs/decisions/PRE_BUILD_DISCUSSION_LOG.md` for all discussion topics resolved before coding.
See `Docs/decisions/CODE_QUALITY_REVIEW_2026-05-26.md` for full FE/BE code audit.
See `Docs/decisions/WIDE_OPEN_BRAINSTORM_2026-05-26.md` for wide-open brainstorm with 11 roles.

Next build priorities (from reference image analysis):
1. Canvas view mode tabs (Map View / Camera View / Camera Wall / Path Replay)
2. Full-canvas Camera View rendering
3. Path replay animation with actor
4. DORI overlays on camera view + enhanced timeline
5. Camera Wall mode
6. Wire remaining stubs (Failures tab, Tool placement, Test Without This)

Open decisions that must be resolved before relevant sprint:
- D-018: GSAP vs motion for path replay animation (before Sprint 1)
- D-019: Local-first vs server-side compute (before AI call layer)
- D-020: Security Evidence Twin framing (before report layer design)
- D-021: Text-to-scene scope (before V0.2 design)
- D-022: Multi-sensor scope (before V1 data model freeze)
