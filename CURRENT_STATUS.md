# SentinelTwin Current Status

**As of:** 2026-05-28
**Scope:** repo snapshot aligned to `goal2.md` execution checklist

## Implemented

- Root launcher now gates entry into Studio with explicit `Create or Import Scene`, `Open Current Workspace`, and direct saved-scene resume shortcuts.
- Root launcher now includes a searchable launcher-native project browser with folder, tag, and pin metadata for reopening and organizing local scenes.
- Root launcher includes `AI Layout Draft` prompt flow that generates editable `SecurityScene` JSON scenes.
- Root launcher now includes explicit 5-step guided workflow actions (protect goal -> input -> build -> baseline sim -> next actions).
- Guided workflow step-5 actions now include direct camera failure simulation and cheapest-fix counterfactual kickoff.
- Guided workflow copy/CTA language is now outcome-oriented with disabled-state hints when prerequisites are missing.
- Root launcher now includes a visible `Product Feature Status` surface with `Available` / `Preview` / `Planned` labels and an entry-flow maturity row.
- AI Layout Draft now clearly labels its model-backed generation path, warns about workspace replacement, and falls back deterministically when no public API key is present.
- AI Layout Draft now leaves a visible launcher status banner so the generated/fallback draft result is not lost when the modal closes.
- AI Layout Draft now applies prompt-aware enrichment (camera counts, shelves/counter hints, back-storage zone hints) to generated scenes.
- `apps/studio` Next.js app is the active product surface with a working Studio shell.
- Mode routing works inside studio: `Map`, `Camera View`, `Camera Wall`, `Path Replay`, `Compare`.
- SecurityScene schema/store/simulation stack is active and test-covered.
- Deterministic coverage + occlusion + quality simulation pipeline is functional.
- Issues panel supports recommendation `Preview Fix`, `Apply Fix`, and `Revert Preview` loop.
- Scene management exists: save/load, JSON import/export, snapshots, compare.
- SceneBuilderWizard is wired from top bar (`New Scene...`) with blank/template/floor-plan options.
- Launcher now has a dedicated floor-plan entry flow that opens SceneBuilderWizard directly in floor-plan mode (separate from generic new scene path).
- Floor-plan import now converts detected geometry into an editable scene skeleton (walls/doors/windows + dimensions).
- Manual-assisted `Scan a Site` flow now supports photo upload, marker placement/edit/reposition, candidate type switching (including path points), and review warnings before compile.
- Scan compile now deterministically maps markers into canonical `scan_import` SecurityScene nodes (walls, doors, windows, entry points, cameras, lights, obstructions, critical zones, optional path) with schema validation and explicit warnings.
- Scan handoff now emits launcher notice with compiled counts and auto-runs baseline simulation when camera + critical zone are present.
- Floor-plan review now supports manual scale calibration (known width/depth/height) before scene creation.
- Floor-plan review now supports correction controls to exclude false-positive walls/doors/windows before scene creation.
- Floor-plan review now supports draggable door/window marker correction in the spatial preview before applying normalization.
- Floor-plan normalization now merges/snaps geometry and uses calibrated scale for opening clamping (no hardcoded px/m assumption).
- Report-lite export surface exists and now uses defensive/disclaimer language.
- Report-lite now includes a practical hardening section: failing zones + immediate action plan from recommendations.
- Right-panel assumptions are visible and directly editable (time-of-day and quality model), with link to full assumptions editor.
- Camera wall feed rigs now track live camera transform edits (no one-time POV lock).
- Camera View now shows per-camera path-visibility status overlays during replay context.
- Camera View now includes metric-backed footage verification assist (reference still upload, overlay/split comparison, opacity/alignment controls, `Alignment Quality` score, and optional difference heat overlay) with defensive non-forensic disclaimer framing.
- Launcher now includes a dedicated `Verify Real Camera Footage (Preview)` modal that explicitly separates current overlay assist capabilities from not-yet-implemented forensic/video pipelines.
- Camera Wall now shows per-camera route-visibility overlays and active route context badges.
- Compare mode now renders each selected snapshot's own scene geometry (not only current live scene geometry).
- Compare mode now supports snapshot-level simulation recovery (`Simulate Scenario B Now`) and changed-object delta summaries.
- Report-lite now supports a `Before/After` export mode using snapshot A/B compare data.
- Compare mode now supports `Capture Visual Evidence` from live compare canvases, and Report-lite compare export embeds captured images when snapshot IDs match.
- Golden simulation claims suite exists (`apps/studio/src/simulation/__tests__/golden-simulation-claims.test.ts`).

## Partial

- Floor-plan conversion, calibration, and correction controls are wired, including explicit structural auto-fix actions (merge near duplicates, snap openings toward nearest wall), but extraction quality and advanced correction depth are not yet production-ready.
- Camera-view realism stack is present but still limited versus full product target.
- Before/after experience is present but not yet full visual diff parity across all scenarios.
- Assumptions/edit UX exists in part but still needs stronger end-to-end authoring flow.
- AI command path exists but broader product-level AI layout workflow is not complete.
- AI layout draft has model-backed structured output + fallback with basic semantic enrichment, but still needs deeper spatial intent fidelity and path-level planning quality for full production use.

## Stubbed

- Several report/analysis panel affordances still include placeholder/static elements.
- Some mode-adjacent controls are visible but do not yet drive full production behavior.
- Template/floor-plan workflows rely on prototype logic in places.

## Not Started

- Full guided scan workflow (capture -> reconstruction -> editable scene).
- Full AI layout draft to robust SecurityScene generation workflow.
- Product-grade footage verification workflow against simulated camera outcomes (current state is first-cut operator assist).
- Product-grade multi-project backend collaboration layer.

## Next Priority Order (Goal2-Aligned)

1. Expand launcher into full project/site start flow (templates, guided onboarding, multi-project organization).
2. Strengthen first-run guidance from launcher into scene setup and first simulation run.
3. Tighten mode labels and UX language so each mode outcome is obvious.
4. Complete floor-plan import depth (actual walls/doors/windows generation + review/edit loop).
5. Upgrade report-lite to stronger evidence framing and clearer assumptions display.
6. Ensure camera feed behavior always reflects live camera transform/state edits.
7. Reduce remaining stub/static controls in panels and close current goal2 P1 gaps.
8. Start goal2 P3 AI layout draft pipeline only after P0-P2 reliability gates are stable.

- 2026-05-28: Implemented unified Security Outcome surface wiring (dashboard, right dock mode, bottom outcome tab, report/compare reuse) with shared outcome derivation layer and tests.
- 2026-05-28: Applied UX hardening from design critique: non-blank canvas loading overlays, first-run onboarding guide, Help tab, safer saved-scene delete confirmation, Cmd/Ctrl+Enter simulation shortcut, and improved global muted/dim contrast tokens.
- 2026-05-28: Added accessibility/onboarding expansion: UI density + light theme controls, bulk camera editor mode, tool setup presets, edit-delta timeline tab, and Explain-this-panel micro-help affordances.
