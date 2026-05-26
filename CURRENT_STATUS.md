# SentinelTwin Current Status

**As of:** 2026-05-26
**Scope:** repository-wide, documentation-first implementation baseline for `apps/studio`

## What runs

- `apps/studio` app shell, routes, and 3D workspace render.
- Security simulation stack: `coverage.ts`, `grid.ts`, `path-analysis.ts`, `simulate-studio.ts`, `adversarial-path.ts`.
- Security scene schema + validation (`security-scene.ts`) and scene CRUD/store actions.
- Report building and export surface (`buildReportData`, `exportAsHtml`, `exportAsMarkdown`, `exportAsText`).
- Demo scene loading and snapshot handling.

## What is wired

- Auto simulation and manual run controls.
- Heatmap rendering and zone/camera overlays.
- Camera/obstruction/light/zone/path node mutation via store actions.
- Simulation patching path for "Test Without Obstruction" in obstacle inspector (temporary scene patch, recompute, and revert).
- Report generation and report-lite tab export UX.
- Keyboard shortcuts and top-level tool panel state management.
- Counterfactual recommendation generation and apply/verify loop scaffolding.

## What is stubbed / unfinished

- Full canvas mode switching (Map / Camera View / Camera Wall / Path Replay) is incomplete.
- Path replay actor animation exists only partially in overlays.
- Timeline playback controls and per-camera DORI timeline UX are still below reference parity.
- Some AI command/provider calls remain prototype-level; production confidence layer is pending.
- Scan/import pipeline is present but not yet robust enough for real-world edge cases.
- Several report sections still need stronger wording around assumptions and certainty bounds.

## Known warnings

- Past naming used security-sensitive language in docs (`adversarial`, `evaded`, `minimum-exposure`). We now use defensive incident replay framing for operator-facing reports/docs.
- `DECISION_LOG.md` had future-dated entries; impossible dates have been corrected.
- Some internal identifiers and code paths still use legacy names (`adversarialPath`, `run_adversarial`) by design for engine compatibility.

## Next 10 tasks (stabilization sprint)

1. Add and harden canvas mode switching with full-window camera view and camera wall presets.
2. Deliver path replay actor animation with timeline playback sync.
3. Expand timeline UX to per-camera DORI quality over time.
4. Add DORI overlay controls and target-quality badges in camera replay mode.
5. Finish tool-placement-to-canvas interactions for camera/light/obstruction/door/window.
6. Wire remaining top-bar actions to stable scene/store handlers (Night Mode, Camera Failure, Compare, Generate Report).
7. Add clear assumptions/disclaimer summary to every exported report format.
8. Add a lightweight fixture/test harness for scene-level validation scenarios.
9. Close known UI stub points listed in `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md` and `CAMERASTUDIO_GAP_ANALYSIS.md`.
10. Start editor UX plan for realistic scene creation (walls/doors/windows, object placement, scale calibration).

## Documentation health tags

- Canonical: `Docs/architecture/*`, `Docs/decisions/DECISION_LOG.md`, `Docs/decisions/OPEN_QUESTIONS.md`, `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md`.
- Historical: `CODE_QUALITY_REVIEW_2026-05-26.md`, `WIDE_OPEN_BRAINSTORM_2026-05-26.md`.
- Stale: legacy milestone writeups that conflict with current state until reviewed (`PHASE_0_SETUP.md`, `CAMERASTUDIO_GAP_ANALYSIS.md`).
- Superseded: earlier claims in older `CURRENT_IMPLEMENTATION_STATE` style notes without runtime validation.
