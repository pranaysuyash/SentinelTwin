# Store Composition Boundary Audit

**Date:** 2026-07-10
**Scope:** Product review §6 — identify which slices are truly independent vs hidden in one god-store.
**Status:** Audit complete. Findings documented. No code changes in this pass.

---

## 1. Current Architecture

The studio store is composed of **11 slices** via Zustand's spread composition:

```
StudioStoreState = SceneSlice & SimulationSlice & LayoutSlice & SnapshotSlice
  & ReplaySlice & ComparisonSlice & WorkflowSlice & GovernanceSlice
  & TelemetrySlice & DebugTogglesSlice & JobLensSlice
```

Plus one standalone store: `useProductViewStore` (product-level navigation).

### Slice Inventory

| Slice | File | State Fields | Actions | Independence |
|-------|------|-------------|---------|-------------|
| **SceneSlice** | `core/scene-slice.ts` | ~40 | ~25 | **Low** — reads/writes governance, telemetry, simulation, layout, fixSandbox |
| **SimulationSlice** | `core/simulation-slice.ts` | ~15 | ~12 | **Low** — reads scene, governance, telemetry, snapshots; writes simulation state |
| **LayoutSlice** | `core/layout-slice.ts` | ~35 | ~30 | **Medium** — mostly self-contained UI chrome state; reads nothing from other slices |
| **SnapshotSlice** | `core/snapshot-slice.ts` | ~3 | ~3 | **Medium** — reads scene + simulation; writes snapshots |
| **ReplaySlice** | `core/replay-slice.ts` | ~8 | ~6 | **High** — path replay state only; reads nothing cross-slice |
| **ComparisonSlice** | `core/comparison-slice.ts` | ~4 | ~4 | **High** — comparison state only; reads nothing cross-slice |
| **WorkflowSlice** | `enterprise/workflow-slice.ts` | ~6 | ~8 | **High** — workflow navigation only; minimal cross-slice reads |
| **GovernanceSlice** | `enterprise/governance-slice.ts` | ~15 | ~35 | **Very Low** — reads scene, simulation, telemetry, snapshots, layout; writes governance + scene + evidence |
| **TelemetrySlice** | `enterprise/telemetry-slice.ts` | ~15 | ~15 | **Low** — reads scene, governance, simulation, snapshots; writes telemetry + scene + governance |
| **DebugTogglesSlice** | `core/debug-toggles-slice.ts` | ~12 | ~2 | **High** — pure debug flags; no cross-slice reads |
| **JobLensSlice** | `job-lens-slice.ts` | ~4 | ~3 | **High** — job lens persona routing; no cross-slice reads |

---

## 2. Dependency Map (Cross-Slice `get()` Calls)

### SceneSlice — reads from:
- `get().workspaceGovernance` (governance-slice) — for evidence events
- `get().operationalEvidenceEvents` (governance-slice) — for appending evidence
- `get().historyPast` (self) — for revision depth
- `get().fixSandboxBaselineScene` / `get().fixSandboxDiff` (governance-slice) — for sandbox persistence
- `get().recordRuntimeIncident` (telemetry-slice) — for error recording

### SimulationSlice — reads from:
- `get().scene` (scene-slice) — for simulation input
- `get().historyPast` (self via scene-slice) — for revision depth
- `get().operationalEvidenceEvents` (governance-slice) — for appending evidence
- `get().snapshots` (snapshot-slice) — for saving snapshots after apply
- `get().saveSnapshot` (snapshot-slice) — called after counterfactual apply
- `get().recordRuntimeIncident` (telemetry-slice) — for error recording
- `get().fixSandboxDiff` (governance-slice) — for sandbox dirty tracking

### GovernanceSlice — reads from:
- `get().scene` (scene-slice) — for evidence events, scene replacement
- `get().simulationResult` (simulation-slice) — for graph state, sandbox apply
- `get().snapshots` (snapshot-slice) — for sandbox snapshots
- `get().historyPast` (scene-slice) — for revision depth
- `get().operationalEvidenceEvents` (self) — for appending evidence
- `get().recordRuntimeIncident` (telemetry-slice) — for error recording
- `get().setScene` (scene-slice) — called from loadReferenceScene, activateWorkspace
- `get().refreshSavedScenesList` (self) — after project mutations
- `get().runSimulation` (simulation-slice) — called from activateWorkspace
- `get().setViewMode` / `get().setWorkspacePreset` / `get().setBottomTab` (layout-slice) — called from activateWorkspace

### TelemetrySlice — reads from:
- `get().scene` (scene-slice) — for evidence events
- `get().workspaceGovernance` (governance-slice) — for evidence events
- `get().simulationResult` (simulation-slice) — for evidence events
- `get().snapshots` (snapshot-slice) — for evidence events
- `get().historyPast` (scene-slice) — for revision depth
- `get().recordRuntimeIncident` (self) — for error recording

---

## 3. Classification

### Truly Independent Slices (No Cross-Slice Reads)
These slices own their state and never read from other slices:

| Slice | Why Independent |
|-------|----------------|
| **ReplaySlice** | Pure path replay animation state |
| **ComparisonSlice** | Pure comparison state |
| **DebugTogglesSlice** | Pure debug flags |
| **JobLensSlice** | Pure persona routing |
| **WorkflowSlice** | Pure workflow navigation (reads nothing cross-slice in its slice creator) |

### Loosely Coupled (Read 1-2 Other Slices)
| Slice | Reads From |
|-------|-----------|
| **LayoutSlice** | Nothing cross-slice in its creator (layout state is self-contained) |
| **SnapshotSlice** | scene-slice (for scene data), simulation-slice (for simulation result) |

### Tightly Coupled (Read/Writes Multiple Slices)
| Slice | Problem |
|-------|---------|
| **SceneSlice** | Reads governance, telemetry, fixSandbox; writes evidence events directly |
| **SimulationSlice** | Reads scene, governance, snapshot, telemetry; writes evidence events |
| **GovernanceSlice** | **The god-slice.** Reads scene, simulation, snapshot, layout, telemetry. Writes to scene, evidence, layout state. Contains project persistence, sandbox management, workspace identity, and report catalog. |
| **TelemetrySlice** | Reads scene, governance, simulation, snapshot. Writes evidence events, sensor events, AI telemetry. |

---

## 4. The Governance-Slice Problem

`governance-slice.ts` is **~1300 lines** and owns:

1. **Workspace governance** — roles, approval mode, scene status, review workflow
2. **Workspace access** — members, policies, entitlements
3. **Workspace account** — organization profile, plan posture
4. **Organizations** — CRUD for org list
5. **Project persistence** — save/load/delete/duplicate/rename scenes to localStorage
6. **Reference scenes** — add/load/duplicate reference scenes
7. **Fix sandbox** — enter/exit/apply sandbox with baseline/draft
8. **Branch management** — create/switch/submit/approve/reject branches
9. **Scene annotations** — review notes
10. **Report catalog** — preset management
11. **Layout persistence** — save/load/delete layouts
12. **Camera verification** — intent and snapshots
13. **Archive handoff** — handoff requests
14. **Timeline focus** — focus requests

This is **not one domain** — it's 12+ concerns bundled into a single slice because they all touch "enterprise" state.

---

## 5. Cross-Slice Side Effects

The most dangerous pattern is slices calling actions on other slices via `get()`:

| Caller | Called Action | Risk |
|--------|-------------|------|
| GovernanceSlice.activateWorkspaceFromDraft | `get().setScene()`, `get().runSimulation()`, `get().setViewMode()`, `get().setWorkspacePreset()`, `get().setBottomTab()` | Orchestrates 5 slices in one action |
| GovernanceSlice.duplicateReferenceToWorkspace | `get().setScene()`, `get().refreshSavedScenesList()` | Scene replacement from governance |
| GovernanceSlice.exitFixSandbox | `get().setScene()` | Scene replacement from governance |
| SimulationSlice.applyCounterfactualPlan | `get().saveSnapshot()` | Snapshot creation from simulation |
| SceneSlice.updateNode | `get().commitSceneChange()` → writes evidence events | Evidence creation from scene edits |

---

## 6. Recommendations

### Immediate (P1)
1. **Split governance-slice** into focused slices:
   - `workspace-governance-slice.ts` — roles, approval, scene status, review
   - `workspace-identity-slice.ts` — access, account, organizations
   - `project-persistence-slice.ts` — save/load/delete/duplicate/rename
   - `fix-sandbox-slice.ts` — sandbox enter/exit/apply
   - `reference-scenes-slice.ts` — add/load/duplicate reference scenes

2. **Extract orchestration actions** into a separate `orchestration-helpers.ts` module:
   - `activateWorkspaceFromDraft` → `orchestrateDraftActivation()`
   - `applyFixSandbox` → `orchestrateFixApply()`
   - `applyCounterfactualPlan` → `orchestrateCounterfactualApply()`
   
   These are workflow-level actions that coordinate multiple slices — they should not live inside any single slice.

### Medium-Term (P2)
3. **Move evidence event creation to a dedicated `EvidenceService`**:
   - SceneSlice, SimulationSlice, and GovernanceSlice all create evidence events directly
   - A shared service would centralize the pattern and prevent drift

4. **Make LayoutSlice the only UI chrome state owner**:
   - Currently WorkflowSlice and GovernanceSlice also set layout state (viewMode, bottomTab, etc.)
   - Route all layout mutations through LayoutSlice actions

### Long-Term (P3)
5. **Consider Zustand's `subscribeWithSelector` middleware** for cross-slice derivations:
   - Currently slices call `get()` on other slices synchronously
   - Middleware could make these subscriptions explicit and testable

6. **Add a slice boundary lint rule**:
   - Flag when a slice's creator calls `get()` on a key not owned by that slice
   - Enforce the dependency direction: core → enterprise, not enterprise → core

---

## 7. What NOT to Do

Per the original review guidance:

> "Do not move everything into more slices blindly."

The 5 independent slices (Replay, Comparison, Debug, JobLens, Workflow) are correctly scoped. The problem is not too many slices — it's that GovernanceSlice is too many things.

**Correct approach:** Split the god-slice into focused slices, extract orchestration into helpers, and centralize evidence creation. Do not merge independent slices or create new abstractions for slices that already work.

---

## 8. Acceptance Criteria for Future Refactor

When the split is done, each resulting slice should:

1. **Own its state** — no `get()` calls to keys owned by other slices
2. **Receive inputs via action parameters** — not by reading other slices' state
3. **Return results, not side-effect on other slices** — callers handle orchestration
4. **Be independently testable** — mock only its direct dependencies
5. **Have a clear storage boundary** — each slice owns its localStorage key

The orchestration helpers should:

1. **Coordinate multiple slices** — calling actions on each in sequence
2. **Handle error recovery** — if step 2 fails, undo step 1
3. **Be testable in isolation** — mock the store actions they call
4. **Be the only place** where cross-slice state coordination happens
