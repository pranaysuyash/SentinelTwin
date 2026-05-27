# SentinelTwin Studio (`apps/studio`)

SentinelTwin Studio is the active V0.1 Camera Coverage Testbed.

Core loop: `Edit scene -> run simulation -> inspect impact -> apply/revert fixes -> compare/report`.

## Requirements

- Node.js `>=24.13.0`
- Bun (for tests)

## Run

From repo root:

```bash
cd apps/studio
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build and Test

```bash
# production build
npm run build

# lint
npm run lint

# tests (bun)
npm test

# watch mode
npm run test:watch
```

Useful targeted tests:

```bash
bun test src/components/__tests__/issues-tab.test.ts
bun test src/components/__tests__/camera-view-mode.test.ts
bun test src/components/__tests__/scenario-path-panel.test.ts
bun test src/simulation/__tests__/golden-simulation-claims.test.ts
```

## Current Workflow Surface

- Root launcher flow before Studio shell: `Create or Import Scene` / `Open Current Workspace` / JSON import.
- Root launcher includes a 5-step guided security workflow with direct handoff actions into Studio.
- Root launcher includes a visible `Product Feature Status` board (`Available`/`Preview`/`Planned`) to avoid demoware ambiguity.
- Guided flow includes quick actions for baseline run, failure simulation, cheapest-fix counterfactual, replay, night mode, and report.
- Guided flow uses outcome-focused CTA language and disables stress/fix actions when prerequisites are missing.
- Root launcher also includes `AI Layout Draft` (prompt-to-`SecurityScene` starter).
- AI Layout Draft uses structured model output when configured (`NEXT_PUBLIC_OPENAI_API_KEY`) and otherwise falls back to deterministic local drafting.
- AI Layout Draft also maps key prompt hints into scene entities (camera count, shelves/counter, back-storage zone).
- Studio shell with view modes: `Map`, `Camera View`, `Camera Wall`, `Path Replay`, `Compare`.
- Scene controls in top bar: new scene wizard, save/load, import/export JSON, simulation run, snapshots, compare, report.
- Scene builder wizard paths: blank, template, floor-plan import prototype.
- Floor-plan review supports manual scale calibration before creating the scene.
- Floor-plan review also supports correction controls (drop false wall/door/window detections before scene creation).
- Bottom panel: metrics, issues, timeline, before/after, report-lite, assumptions.

## What Works Well

- Typed `SecurityScene` schema and validation.
- Deterministic simulation pipeline (coverage, occlusion, quality scoring, path visibility).
- Recommendation preview/apply/revert loop in issues tab.
- Counterfactual scene comparisons and snapshot flow.
- Defensive report wording and assumptions/disclaimer framing.
- Report-lite includes failing-zone summaries and immediate action checklist output.
- Assumptions are visible and editable in-panel (quick controls + full assumptions tab).
- Golden simulation claim tests for major behavior checks.
- Camera wall POV stays in sync with live camera transform edits.
- Camera view includes per-camera replay visibility status overlay.
- Camera wall tiles include route visibility status/quality overlays and route-context chip in header.
- Compare mode renders selected snapshot geometry per side for truthful before/after visuals.

## Known Gaps

- Floor-plan import now materializes basic walls/doors/windows but remains prototype-level (heuristic parsing, no robust correction loop).
- Some UI surfaces are wired but still demo/static in parts.
- Full product layers (guided scan, AI layout draft, real footage verification, project backend) are not implemented yet.

## Defensive Framing

This tool is for defensive security hardening and coverage-failure analysis. It does not provide offensive bypass guidance.

## Notes

- Main implementation status is tracked in:
  - `CURRENT_STATUS.md` (repo snapshot)
  - `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md` (detailed implementation ledger)
