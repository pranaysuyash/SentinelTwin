# SentinelTwin — Claude Code Instructions

<!-- PROJECTS_MEMORY_AGENT_ALIGNMENT_BEGIN -->

## Projects-Level Agent Alignment (Workspace Memory)

**Purpose:** ensure any agent/LLM (Codex, Copilot, Claude Code, Qwen, GLM, etc.) starts aligned with the same workspace memory + project context.

### Step 0 (first time in this folder)
Generate the per-project context pack:
```bash
/Users/pranay/Projects/agent-start
```

### Step 1 (per shell)
Load the shared defaults for this project session:
```bash
source Docs/context/agent-start/STEP1_ENV.sh
# Or (no file read) print exports and eval:
/Users/pranay/Projects/agent-start --print-step1 --skip-index
```

### Step 2 (generate aligned context pack)
```bash
/Users/pranay/Projects/agent-start
```

Outputs:
- Canonical project-local pack:
  - `Docs/context/agent-start/SESSION_CONTEXT.md`
  - `Docs/context/agent-start/AGENT_KICKOFF_PROMPT.txt`
  - `Docs/context/agent-start/STEP1_ENV.sh`
- Compatibility mirrors when present:
  - `.agent/SESSION_CONTEXT.md`
  - `.agent/AGENT_KICKOFF_PROMPT.txt`
  - `.agent/STEP1_ENV.sh`
  - `frontend/docs/context/agent-start/*`

### Automation (already configured)
- Terminal auto-loads `Docs/context/agent-start/STEP1_ENV.sh` when you `cd` into a project under `/Users/pranay/Projects` (zsh hook).
- VS Code/Antigravity can run `agent-start --skip-index` on folder open via `.vscode/tasks.json`.

### How agents should use this
- Provide the canonical `Docs/context/agent-start/AGENT_KICKOFF_PROMPT.txt` and `Docs/context/agent-start/SESSION_CONTEXT.md` as the first context for the agent.
- If sources conflict, the agent must cite concrete file paths and ask before proceeding.
- If the canonical context pack is missing or stale, run `/Users/pranay/Projects/agent-start --skip-index` before planning changes.
- Treat `.agent/` files as compatibility mirrors only.
- Do not start implementation until `Docs/context/agent-start/AGENT_KICKOFF_PROMPT.txt` and `Docs/context/agent-start/SESSION_CONTEXT.md` are loaded.

### Mandatory agent operating mandate
- Begin every substantial task by refreshing ground truth: read the applicable instruction stack, repo-local `AGENTS.md`/`CLAUDE.md`, and any Qwen, Codex, Copilot, or other agent-specific instruction files relevant to the repo.
- Check the current codebase, docs, worklogs, and project status before planning or coding. Parallel agents may have changed files, decisions, or docs since the last session.
- Treat drift as normal: before editing and again before finalizing, re-check the files and docs you rely on, then adapt rather than assuming older context still holds.
- Use relevant skills and workflow guidance after checking the configured skill locations. Do not default to one toolset when a better domain skill exists.
- Think from first principles and optimize for long-term, scalable, architecturally sound solutions. Existing code is evidence, not a boundary; if current implementation no longer fits the product reality or architecture, propose or implement the proper path.
- Avoid building duplicate or parallel systems. Extend canonical routes, pipelines, validation, docs, and tools unless the project explicitly calls for a new replacement path.
- Git safety: read-only git inspection is allowed; no destructive commands, staging, commits, pushes, resets, or checkouts without explicit permission in the current conversation.
- Research online when facts may be current, external, or uncertain; cite sources when research affects decisions.
- Test changes, verify for regressions, and document findings, decisions, open questions, and follow-up work in durable project artifacts.

### Mandatory commit gate
Install or refresh the managed repo-local git hooks. They resolve the repo's effective hook path, block commit creation in `prepare-commit-msg` until the current full `motto_v3.md` has a fresh attestation, then enforce objective diff checks plus commit trailers in `pre-commit` and `commit-msg`:
```bash
python3 /Users/pranay/Projects/workspace_memory/scripts/install_git_precommit_agent_hook.py
```

Refresh the current repo's motto attestation before committing:
```bash
python3 /Users/pranay/Projects/workspace_memory/scripts/attest_motto.py --repo "$PWD"
```

### Shared Idea Pad Protocol (Required)
- Canonical file: `/Users/pranay/Projects/idea_pad/IDEA_PAD.md`
- Raw capture file: `/Users/pranay/Projects/idea_pad/IDEA_DUMP.md`
- Do not create per-model primary copies of the idea pad.
- Do not overwrite the whole file; use append/update workflow with validation.
- Capture rough ideas in `IDEA_DUMP.md`, then promote high-signal items into `IDEA_PAD.md`.
- Before edits:
```bash
python3 /Users/pranay/Projects/idea_pad/scripts/idea_pad_tool.py validate
```
- Add new ideas safely:
```bash
python3 /Users/pranay/Projects/idea_pad/scripts/idea_pad_tool.py add --title "<title>" --owner "<agent>" --type build
```
- After updates, refresh shared memory index:
```bash
cd /Users/pranay/Projects
./projects-memory index
```

<!-- PROJECTS_MEMORY_AGENT_ALIGNMENT_END -->


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
10. `sentineltwin_ui_design_pack/SentinelTwin_UI_Design_Pack.md` and the referenced images when the task involves UI, layout, motion, tokens, or screen composition

## What This Project Is

SentinelTwin is an AI-native physical security simulation platform.
It uses the existing `apps/studio` implementation as the canonical working surface and adds a security
simulation layer on top: camera coverage, DORI quality scoring, defensive incident replay analysis,
temporal security profiling, AI command layer, and client report generation.

The founding principle: AI proposes. Simulation verifies. AI explains.
The simulation engine is deterministic geometry — not AI. AI is the interface.

## Current State

**Working camera-studio alpha is present in `apps/studio`.** The data model, simulation engine, store, rendering, report tooling, and demo scenes are implemented, with remaining focus on hardening UX loops and editor creation tooling.
All architectural decisions and data model designs are in `Docs/architecture/`.
Read `Docs/architecture/` and `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md` before changing implementation.

## Architecture Docs (Must Read Before Coding)

| Doc | Read it for |
|---|---|
| `Docs/architecture/00_ARCHITECTURE_OVERVIEW.md` | Full system picture, 5 layers |
| `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md` | The schema — foundation of everything |
| `Docs/architecture/02_PASCAL_EDITOR_INTEGRATION.md` | Fork strategy, what we inherit |
| `Docs/architecture/03_COVERAGE_ENGINE.md` | Raycasting, DORI, BVH, tests |
| `Docs/architecture/04_ADVERSARIAL_PATH_SIMULATION.md` | Novel feature — Dijkstra design; referenced externally as defensive coverage stress testing |
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

## UI Design Pack (Read for Screen Work)

The repo also contains `sentineltwin_ui_design_pack/`, which holds the images and briefs for the
current screen-by-screen UI direction.

For any work that touches visible screens or interaction design:

1. Read `sentineltwin_ui_design_pack/SentinelTwin_UI_Design_Pack.md`
2. Inspect the referenced images in `sentineltwin_ui_design_pack/images/`
3. Treat `Primary target` items as implementation references
4. Treat `Deprecated` and `Rejected` items as negative references only
5. Treat `DesignSystem_*` boards as canonical guidance for tokens and interaction states
6. Note any deliberate divergence in `Docs/decisions/DECISION_LOG.md`

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

## Health Stack

- typecheck: bun tsc --noEmit
- lint: eslint .
- test: bun test
- deadcode: knip (not installed)
- shell: shellcheck (not installed)

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
