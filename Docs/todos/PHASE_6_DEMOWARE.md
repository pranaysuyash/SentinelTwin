# Phase 6: Demoware Completion — UI & Polish

**Status:** 🚧 In Progress (updated 2026-05-27)
**Depends on:** Phases 0–5 (all delivered)
**Opens:** Product demo readiness after remaining gaps are closed

---

## Goal

Close high-impact UI/product-shell gaps identified in the gap analysis (`CAMERASTUDIO_GAP_ANALYSIS.md`) with truthful status framing.
Every item here should make demos more honest and workflows more executable.

## Current truth snapshot (2026-05-27)

- `Scene Management`: mostly done (`studio-store.ts`, top bar flows, import/export/snapshots working).
- `Report Export`: partial (report-lite export exists; full product-grade export stack not complete).
- `Camera Failures`: partially wired via failure drill + issues, not fully complete as a standalone matrix flow.
- `Assumptions Panel`: partially done and editable, but broader authoring UX still incomplete.
- `Visual Compare`: implemented with snapshot-true geometry rendering.
- `Privacy/Redundancy`: partially implemented; not complete product surfaces.
- `Keyboard shortcuts`: partially implemented.
- `Preset/library and some inspector actions`: still incomplete.

Do not mark this phase complete until all P0 requirements are verified against runtime behavior and docs are aligned.

---

## Priority breakdown

### P0 — Must-close before any demo or external walkthrough

| # | Item | Est. effort | Files affected |
|---|------|-------------|----------------|
| 1 | **Scene Management** — localStorage save/load, scene selector dropdown, "New Scene" blank creation, working "Import JSON" button, keyboard shortcut (Ctrl+S) | 1 day | `studio-store.ts`, `TopBar.tsx` |
| 2 | **Report Export** — HTML/print-friendly export from ReportLiteTab (not just AI report) | 0.5 day | `ReportLiteTab.tsx` |
| 3 | **Camera Failures Tab** — Toggle camera "blocked"/"dirty" states, show per-camera failure impact analysis | 0.5 day | `IssuesTab.tsx`, `InspectorPanel.tsx` |
| 4 | **Assumptions Panel** — Surface `SimulationAssumptions` in the UI with edit capability | 0.5 day | new `AssumptionsPanel.tsx`, `ContextRightPanel.tsx` |
| 5 | **Visual Compare** — Before/after side-by-side canvas with delta metrics panel | 0.5 day | `CompareView.tsx` |

### P1 — Important for product completeness

| # | Item | Est. effort | Files affected |
|---|------|-------------|----------------|
| 6 | **Privacy Zones** — Render privacy zone polygons in the scene, add coverage warnings | 0.5 day | `SharedScene.tsx`, `WorkspaceCanvas.tsx` |
| 7 | **Redundancy Matrix** — Camera-failure coverage matrix showing impact per zone per failure scenario | 0.5 day | new `RedundancyMatrixPanel.tsx` |
| 8 | **Keyboard Shortcuts** — Wire Ctrl+N/S/O, 1-5 for tools, shortcuts modal | 0.5 day | `StudioShell.tsx` |

### P2 — Polish & quality of life

| # | Item | Est. effort | Files affected |
|---|------|-------------|----------------|
| 9 | **Scene Export UI** — Button to export current scene as downloadable JSON | 0.25 day | `TopBar.tsx` |
| 10 | **Test Without Obstruction** — Wire the disabled button in ObstructionInspector | 0.25 day | `InspectorPanel.tsx` |
| 11 | **Camera Preset Library** — Preset picker shown when placing cameras (indoor dome, bullet, PTZ) | 0.5 day | `WorkspaceCanvas.tsx`, new `CameraPresetPicker.tsx` |

---

## Implementation order

1. P0 items in priority order (Scene Management → Report Export → Camera Failures → Assumptions → Visual Compare)
2. P1 items (Privacy Zones → Redundancy Matrix → Keyboard Shortcuts)
3. P2 items (Scene Export → Test Without Obstruction → Camera Presets)
4. Full typecheck + ESLint + test pass
5. Code review + documentation update

---

## API / contracts

No new external APIs. All changes are client-side:

- **localStorage** key: `sentineltwin_scene_*` for save/load
- **Keyboard events**: `keydown` listener on `StudioShell`
- **Export**: `navigator.clipboard.writeText()` for JSON, `window.print()` or `toBlob()` for report
- **Zustand store**: Extend `useStudioStore` with scene management actions
