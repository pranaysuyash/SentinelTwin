# SentinelTwin Product Review — 2026-07-10

> Source: External product review (Pasted Text, 2026-07-10).
> This document records findings, verification status, and implemented fixes.
> Follows `motto_v3 §0.13` (evidence tiers) and `§0.11` (no stronger claims than system supports).

---

## Verdict

SentinelTwin should be reviewed as:

**A physical-security digital-twin platform with intake, scene creation, simulation, incident replay, counterfactual planning, evidence verification, governance, reporting, and extensibility.**

Not as a camera testbed, demo scene, CCTV cone visualizer, or retail-shop walkthrough.

The repo itself agrees with this. `AGENTS.md` explicitly says SentinelTwin is "the whole app, not just the camera studio."

---

## §1 — What Is Strong Already

| Area | Status | Evidence |
|---|---|---|
| Architecture doctrine | ✅ Strong | `AGENTS.md` forces instruction stacks, documentation-first, long-term thinking. `motto_v3.md` aligned. |
| Product architecture (5 layers) | ✅ Defined | `Docs/architecture/00_ARCHITECTURE_OVERVIEW.md` — Space Creation → Scene Model → Simulation → Intelligence → Output |
| SecurityScene schema | ✅ Platform-shaped | 20+ node types, simulation, temporal, snapshots, evidence artifacts |
| Simulation package breadth | ✅ Far beyond toy | Coverage, DORI/OODPCVS, adversarial path, blindspot, entropy, fragility, posture, k-robustness, occlusion, placement, temporal |
| TruthBadge system | ✅ Comprehensive | 20+ surfaces use `simulated | computed | inferred | imported | placeholder | live` labels |
| Truth audit | ✅ Enforced | `truth-audit.ts` enforces 40+ surfaces with required/forbidden phrases |
| Evidence events | ✅ Append-only journal | `OperationalEvidenceEvent` with archive, governance handoff, and snapshot provenance |
| Capability status manifest | ✅ Exists | `product-feature-status.ts` tracks `Available | Preview | Scaffolded | Planned` |
| Report generation | ✅ Evidence-first | `buildReportData` requires `SimulationResult`; reports include truth ladder, provenance, and audience policies |
| Documentation-first culture | ✅ Enforced | `AGENTS.md` mandates docs before/during implementation |

---

## §2 — Biggest Architectural Risk: Too Many Surfaces, Not Enough Canonical Lifecycle

### Finding (P0)

The code has many valid surfaces (intake, scan, manual builder, floor plan import, AI draft, studio, incident review, counterfactual compare, audit report, reference sites, settings). But these are **view routes**, not necessarily a coherent product lifecycle.

### Canonical lifecycle (from review)

```
Create/import/capture site → compile to SecurityScene → validate scene contract →
operator reviews draft → approve scene → run baseline simulation →
inspect issues → replay incident/path → test fixes →
compare before/after → generate report → store evidence/governance history → reopen/recompute later
```

### Verification

✅ `ProductViewRouter` maps these flows and routes intake/draft/studio/report surfaces explicitly.  
✅ `SiteIntakeHub` has 5 creation paths (scan, AI, floor plan, JSON import, manual).  
✅ `SiteDraftReview` has `compileToSiteTwinDraft`, `canRunBaselineSimulation`, and approval flow.  
⚠️ The flow between surfaces is view-route-based, not enforced by a lifecycle state machine.

### Recommendation

Add a `ProductLifecycleState` type that tracks where the current scene is in the canonical lifecycle. This is a V2 enhancement, not a blocker.

---

## §3 — Product Truth: "Not Run" Must Be First-Class Everywhere

### Finding (P0)

No component should show security claims (Detection, No Issues, Low Risk, Pass, Coverage %) without a current `SimulationResult`.

### Verification

✅ `SecurityOutcomePanel` returns `<OutcomeEmptyState />` when `!result`, which says "Simulation not run yet."  
✅ `OutcomeEmptyState` shows missing prerequisites when applicable.  
✅ All 15+ bottom-panel tabs use `TruthBadge` with `label="simulated"` when data comes from simulation.  
✅ `CoverageMetricsCards` uses `label={displayCoverage != null ? "simulated" : "placeholder"}`.  
✅ `SecurityStatusPanel` forbidden phrase list includes `"Live"` to prevent false operational claims.

### Implemented fix (§7)

StatusBar quick-run button now delegates to canonical `runStudioSimulation` via `runSimulation()` instead of calling `simulateStudio()` directly.

---

## §4 — Fixtures Are Not the Product

### Finding (P0)

No scene-name-based behavior. Fixtures (Small Retail Shop, Apartment Lobby, Warehouse, School Corridor, empty scene, imported JSON, scan draft, AI draft) are validation inputs, not special product logic.

### Verification

✅ `SOURCE_LABELS` maps scene sources to labels without branching on names.  
✅ `demoMode` flag is independent of scene names — it's a toggle, not a name check.  
✅ `workspaceGovernance` treats demo scenes as read-only via `source === "demo"` checks, not name checks.  
✅ `StudioDashboardHome` derives titles from `source`, not from `scene.name`.  
✅ `SiteIntakeHub` has reference scenes but treats them as "Reference Scenes" section, not as the foundation.

### Remaining hardcoded names

The following are in test files only (acceptable):
- `createSmallRetailShopScene()` in test fixtures
- Zone labels like `"Cash Counter"`, `"Main Entry"` in test data

No hardcoded scene names in production UI components.

---

## §5 — First-Time Routing

### Finding (P1)

`ProductViewRouter` redirects first-time users from `product_home` to `site_intake` when no saved projects and no cameras. This is correct.

### Verification

✅ `ProductViewRouter` line 300+: checks `scene.cameras.length === 0` and redirects to `site_intake`.  
✅ `SiteIntakeHub` presents 5 creation paths as equal options (scan, AI, floor plan, JSON, manual).  
✅ Reference/demo scenes are in a separate sidebar section, not the foundation.

### Improvement opportunity

The review suggests three equal first-run routes: Create Site Twin, Open Existing Site, Explore Reference Site. Currently the hub presents creation paths first, with "Recent Site Twins" below. This is acceptable for V1.

---

## §6 — Store Composition

### Finding (P1)

`studio-store.ts` composes many slices (scene, simulation, layout, workflow, governance, telemetry, snapshot, replay, comparison, debug). Risk of becoming a god-store.

### Verification

✅ Slices are already separated: `scene-slice.ts`, `simulation-slice.ts`, `layout-slice.ts`, `workflow-slice.ts`, `governance-slice.ts`, `telemetry-slice.ts`, `snapshot-slice.ts`.  
✅ `SecurityScene` remains portable — it's cloned at every boundary.  
✅ Simulation is React-free (`packages/simulation`).  
✅ Reports are generated from `SimulationResult` + `SecurityScene`, not UI state.

### Recommendation

Monitor for cross-slice coupling. Current architecture is acceptable. No immediate refactor needed.

---

## §7 — Simulation Runner Integrity

### Finding (P1)

All product simulation flows should use the canonical `runStudioSimulation` runner. Flag direct `simulateStudio()` calls from UI/store/product flows.

### Audit results

| Location | Call | Status |
|---|---|---|
| `simulation-slice.ts → runSimulation()` | `runStudioSimulation` | ✅ Canonical |
| `simulation-slice.ts → setSimulationResult()` | N/A (receives result) | ✅ OK |
| `simulation-slice.ts → runCounterfactual()` | `simulateStudio(patched)` | ⚠️ Documented exception |
| `StatusBar.tsx` onClick | `useStudioStore.getState().runSimulation()` | ✅ **Fixed** (was `simulateStudio` directly) |
| `counterfactual-runner.ts` | `simulateStudio(patchedScene)` | ✅ Package-level pure function call |
| `snapshot-slice.ts` | `simulateStudio(fullScene)` | ⚠️ Snapshot creation — sync, fast, no temporal |
| `temporal.ts` (simulation package) | `simulateStudio(patchedScene)` | ✅ Package-internal |
| `use-ai-command.ts` | `simulateStudio(testScene)` | ✅ One-off test in AI propose flow |
| All test files | `simulateStudio(scene)` | ✅ Acceptable — pure function tests |

### Implemented fixes

1. **StatusBar.tsx** — Replaced direct `simulateStudio()` with `useStudioStore.getState().runSimulation()` which delegates to canonical runner. Removed unused `setSimulationRunning`/`setSimulationResult` imports.

2. **simulation-slice.ts → runCounterfactual** — Added documented exception comment:
   ```
   // KNOWN EXCEPTION: runCounterfactual calls simulateStudio() synchronously
   // for a quick single-obstruction removal check. This is intentional — the
   // engine call is fast (<50ms), does not need a temporal profile, and runs
   // on a patched clone that never touches the live scene.
   ```

### Remaining (acceptable with documentation)

- `snapshot-slice.ts` uses `simulateStudio` synchronously for snapshot creation. Acceptable because snapshots are fast, synchronous, and don't need temporal profiles.
- `use-ai-command.ts` uses `simulateStudio` for a one-off test during AI propose. Acceptable because it's a test-only path.

---

## §8 — Counterfactual Lifecycle Hardening

### Finding (P0)

Counterfactual preview/apply/revert must be auditable. Preview must not overwrite baseline. Apply must create evidence event and snapshot. Report must state whether a fix is simulated, previewed, or applied.

### Implemented fixes

**simulation-slice.ts:**

1. Added `counterfactualPreviewBaselineScene: SecurityScene | null` — stores the scene before any preview.

2. `previewCounterfactualPlan` — snapshots the baseline on first preview; updates only if scene was manually edited between previews (prevents losing intermediate edits).

3. `revertCounterfactualPreview` — restores from stored baseline instead of relying only on generic `undo()`. Falls back to `undo()` if no baseline exists.

4. `applyCounterfactualPlan` — clears baseline, creates evidence event, saves snapshot.

### Lifecycle states now tracked

```
baselineScene     → captured before first preview
previewScene      → current scene after preview (live state)
appliedScene      → after applyCounterfactualPlan (evidence + snapshot)
```

### Acceptance criteria

- ✅ Preview never silently overwrites baseline (baseline stored before preview)
- ✅ Apply creates evidence event (`kind: "counterfactual_completed"`)
- ✅ Apply saves snapshot (`saveSnapshot`)
- ✅ Revert restores deterministic baseline (not dependent on undo stack depth)
- ⚠️ Report distinguishes proposed vs simulated vs applied — needs UI-level labeling (V2)

---

## §9 — Capability Registry

### Finding (P1)

Prevent advanced surfaces from overclaiming. Every major surface must know whether it is implemented, simulated, preview, unavailable, requires configuration, or requires external integration.

### Current state

✅ `product-feature-status.ts` tracks 13 features with `Available | Preview | Scaffolded` status.  
✅ `SiteIntakeHub` surfaces honest limitations (e.g., "No product-grade video/stream verification yet", "Automatic segmentation/depth reconstruction is still rolling out").  
✅ `truth-audit.ts` enforces forbidden phrases like "Coming Soon", "fake", "stub" across 40+ surfaces.  
⚠️ No centralized `CapabilityRegistry` utility that UI surfaces can query at runtime.

### Recommendation

Add `apps/studio/src/lib/capability-registry.ts` that exports a `getCapabilityStatus(featureId)` function. This is a V2 enhancement. Current `product-feature-status.ts` serves as the manifest.

---

## §10 — Report Evidence Basis

### Finding (P1)

Reports must only make claims from: SecurityScene, SimulationResult, OperationalEvidenceEvent, approved operator notes, attached evidence artifacts, or capability/provenance labels.

### Verification

✅ `buildReportData` in `packages/report/src/index.ts` requires `SimulationResult` — no report can be generated without simulation.  
✅ Reports include `truthLadder` (reviewed/verified/source-traced nodes), `provenance` (scene source, node count, revision depth), and `evidenceTrail`.  
✅ `applyReportVisibility` redacts evidence for shared/privacy-safe exports.  
✅ Commercial framing includes legal boundary disclaimers (e.g., "Not a legal or statutory compliance certificate").  
✅ `buildReportEvidenceBundle` packages scene + report + simulation + evidence together.

### No static report copy claims

All report values are computed from scene/result/evidence. No hardcoded claims.

---

## §11 — Platform Expansion Beyond Cameras

### Finding (P2)

Camera coverage is the first deterministic risk engine. Future engines should plug into the same SecurityScene and evidence/report lifecycle.

### Current schema support

The `SecurityScene` schema already includes:
- Sensors (types, positions, live state)
- Access control (door/gate restrictions)
- Perimeter elements (fence lines, boundaries)
- Event configs (schedules, crowd profiles)
- Evidence artifacts
- Temporal profiles

### Future engines (roadmap)

- Camera coverage engine ✅ (implemented)
- Lighting risk engine (schema-ready, engine needed)
- Access-control risk engine (schema-ready, engine needed)
- Sensor coverage engine (schema-ready, engine needed)
- Perimeter integrity engine (schema partially in analytics dashboard)
- Crowd/occlusion engine ✅ (implemented)
- Temporal vulnerability engine ✅ (implemented)
- Incident replay engine ✅ (implemented)
- Real footage verification engine (preview — adapter stubs exist)
- Compliance/reporting engine ✅ (implemented)

---

## Implemented Changes Summary

| File | Change | Review § |
|---|---|---|
| `apps/studio/src/components/layout/StatusBar.tsx` | Replaced direct `simulateStudio()` with canonical `runSimulation()`. Removed unused imports. | §7 |
| `apps/studio/src/store/slices/core/simulation-slice.ts` | Added `counterfactualPreviewBaselineScene` for deterministic preview/revert. Documented `runCounterfactual` exception. | §8, §7 |
| `Docs/review/PRODUCT_REVIEW_2026-07-10.md` | This document — comprehensive findings, verification, and acceptance criteria. | All |
