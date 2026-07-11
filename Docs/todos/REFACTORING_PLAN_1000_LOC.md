# Refactoring Plan: Files >1000 LOC

**Date:** 2026-07-11  
**Status:** In Progress  
**motto_v3 Alignment:** §0.3 (Simplicity), §0.5 (No Hacks), §0.8 (Documentation), §0.12 (Testing)

## Overview

27 source files exceed 1000 lines of code. This plan refactors them into smaller, focused modules while maintaining 100% test coverage and zero regressions.

## Refactoring Principles

1. **Single Responsibility:** Each extracted module handles one concern
2. **Export Preservation:** All public exports remain unchanged
3. **Import Updates:** Update all import paths after extraction
4. **Test-First Approach:** Write regression test for current export surface BEFORE refactoring, then refactor, then verify test still passes
5. **Documentation:** Update file headers with new module structure
6. **Git Safety:** Commit after each successful refactor

## Risk Tiers

| Risk | Description | Examples |
|------|-------------|----------|
| **Low** | UI section extraction, pure presentational | DebugTab, SceneIntelligenceTab, CameraInspector |
| **Medium** | Store/state splits, hook decomposition | scene-slice, governance-slice, use-ai-command |
| **High** | Schema/engine splits, core logic | security-scene, coverage, site-compiler |

## Dependency Graph (Refactoring Order)

```
security-scene.ts (schema) ← must be stable first
    ↓
coverage.ts (engine) ← depends on schema
    ↓
security-outcome-model.ts ← depends on engine
    ↓
CompareView.tsx, ReportLiteTab.tsx ← depend on model
    ↓
UI components (DebugTab, etc.) ← lowest risk, refactor last
```

## Tier 1: Critical (>2000 LOC) — Highest Impact

| File | LOC | Risk | Effort | Strategy |
|------|-----|------|--------|----------|
| `DebugTab.tsx` | 3,206 | Low | M | Extract 8 sub-components: DiagnosticsBundle, SupportIngest, ProviderGovernance, AlertSystem, ArchiveManager, PromptRegistry, EvalSuite, AiTelemetry |
| `SceneIntelligenceTab.tsx` | 2,498 | Low | M | Extract 6 sections: ProvenanceSection, CheckpointManager, MemoryTimeline, PublishControls, OperationalMemory, SnapshotDiff |
| `CameraInspector.tsx` | 2,422 | Low | M | Extract 6 sections: CameraMetrics, CameraFeedPreview, CameraSettings, CameraAnalytics, CameraHealth, CameraCalibration |
| `WorkspaceCanvas.tsx` | 2,347 | Low | M | Extract 6 sections: CanvasToolbar, CanvasOverlays, CanvasGrid, CanvasInteraction, CanvasPerformance, CanvasExport |
| `ScanSiteWizard.tsx` | 2,130 | Low | M | Extract wizard steps into separate Step components: StepCapture, StepProcess, StepReview, StepImport, StepCalibrate |

## Tier 2: Large (1500–2000 LOC) — Significant Impact

| File | LOC | Risk | Effort | Strategy |
|------|-----|------|--------|----------|
| `GovernanceTab.tsx` | 1,971 | Low | M | Extract 5 sections: RoleSelector, RoutingMatrix, ActionGate, GovernanceTrail, MembershipManager |
| `scene-slice.ts` | 1,837 | Medium | L | Split into 5 files: scene-creation.ts, scene-mutation.ts, scene-query.ts, scene-snapshots.ts, scene-utils.ts |
| `SharedScene.tsx` | 1,828 | Low | M | Extract 5 mesh groups: WallMeshes, RoomMeshes, CameraMeshes, ZoneOverlays, LightingMeshes |
| `security-scene.ts` | 1,738 | High | L | Split into 5 schema files: schema-types.ts, schema-validators.ts, schema-defaults.ts, schema-helpers.ts, schema-index.ts |
| `StudioDashboardHome.tsx` | 1,584 | Low | M | Extract 4 sections: DashboardHeader, ProjectGrid, QuickActions, RecentActivity |
| `PathReplayView.tsx` | 1,571 | Low | M | Extract 4 sections: ReplayTimeline, ReplayControls, ReplayOverlays, ReplayMetrics |
| `operational-evidence.ts` | 1,526 | Medium | L | Split into 4 files: evidence-collector.ts, evidence-store.ts, evidence-replay.ts, evidence-types.ts |

## Tier 3: Medium (1000–1500 LOC) — Moderate Impact

| File | LOC | Risk | Effort | Strategy |
|------|-----|------|--------|----------|
| `governance-slice.ts` | 1,493 | Medium | M | Split into 4 files: governance-state.ts, governance-actions.ts, governance-routing.ts, governance-membership.ts |
| `CompareView.tsx` | 1,478 | Low | S | Extract 4 sections: CompareHeader, CompareMetrics, CompareDelta, CompareExport |
| `ReportLiteTab.tsx` | 1,467 | Low | S | Extract 4 sections: ReportHeader, ReportSections, ReportExport, ReportPreview |
| `telemetry-slice.ts` | 1,389 | Medium | M | Split into 4 files: telemetry-state.ts, telemetry-actions.ts, telemetry-providers.ts, telemetry-budget.ts |
| `use-ai-command.ts` | 1,326 | Medium | M | Split into 4 files: ai-command-state.ts, ai-command-actions.ts, ai-command-providers.ts, ai-command-history.ts |
| `security-outcome-model.ts` | 1,251 | Medium | M | Split into 4 files: outcome-calculators.ts, outcome-formatters.ts, outcome-types.ts, outcome-selectors.ts |
| `floor-plan-import.ts` | 1,207 | Medium | M | Split into 4 files: import-parsers.ts, import-validators.ts, import-converters.ts, import-types.ts |
| `coverage.ts` | 1,117 | High | L | Split into 4 files: raycast.ts, quality-scorer.ts, aggregation.ts, coverage-types.ts |
| `site-compiler.ts` | 1,065 | Medium | M | Split into 4 files: compiler-core.ts, compiler-maturity.ts, compiler-validators.ts, compiler-types.ts |

## Effort Legend

- **S** (Small): ~1-2 hours, straightforward extraction
- **M** (Medium): ~2-4 hours, moderate complexity
- **L** (Large): ~4-8 hours, high complexity, requires careful testing

## Current Progress

- [ ] DebugTab.tsx (3,206 LOC) — Low risk, M effort
- [ ] SceneIntelligenceTab.tsx (2,498 LOC) — Low risk, M effort
- [ ] CameraInspector.tsx (2,422 LOC) — Low risk, M effort
- [ ] WorkspaceCanvas.tsx (2,347 LOC) — Low risk, M effort
- [ ] ScanSiteWizard.tsx (2,130 LOC) — Low risk, M effort
- [ ] GovernanceTab.tsx (1,971 LOC) — Low risk, M effort
- [ ] scene-slice.ts (1,837 LOC) — Medium risk, L effort
- [ ] SharedScene.tsx (1,828 LOC) — Low risk, M effort
- [ ] security-scene.ts (1,738 LOC) — High risk, L effort
- [ ] StudioDashboardHome.tsx (1,584 LOC) — Low risk, M effort
- [ ] PathReplayView.tsx (1,571 LOC) — Low risk, M effort
- [ ] operational-evidence.ts (1,526 LOC) — Medium risk, L effort
- [ ] governance-slice.ts (1,493 LOC) — Medium risk, M effort
- [ ] CompareView.tsx (1,478 LOC) — Low risk, S effort
- [ ] ReportLiteTab.tsx (1,467 LOC) — Low risk, S effort
- [ ] telemetry-slice.ts (1,389 LOC) — Medium risk, M effort
- [ ] use-ai-command.ts (1,326 LOC) — Medium risk, M effort
- [ ] security-outcome-model.ts (1,251 LOC) — Medium risk, M effort
- [ ] floor-plan-import.ts (1,207 LOC) — Medium risk, M effort
- [ ] coverage.ts (1,117 LOC) — High risk, L effort
- [ ] site-compiler.ts (1,065 LOC) — Medium risk, M effort

## Execution Strategy

1. **Start with Low-risk UI files** (Tier 1) — safest to refactor, highest impact
2. **Write regression tests first** — capture current export surface
3. **Extract one section at a time** — commit after each extraction
4. **Run full test suite after each file** — verify zero regressions
5. **Move to Medium-risk stores** (Tier 2) — after UI files are done
6. **Save High-risk engines last** (Tier 3) — requires most careful testing

## Estimated Total Effort

- **Tier 1 (5 files):** ~20-25 hours
- **Tier 2 (7 files):** ~25-35 hours  
- **Tier 3 (9 files):** ~20-30 hours
- **Total:** ~65-90 hours across 21 files
