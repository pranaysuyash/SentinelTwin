# Focus Mode Walkthrough - Three Surface Simulation

## Date
- 2026-06-17

## Persona
- Role: Security Operations Analyst switching between incident review, route replay, and camera wall triage.
- Objective: Inspect the same simulated incident from three complementary surfaces without fighting the UI.

## Shared Scenario
- One scene with multiple active cameras.
- At least one route/path with replay data.
- A wall layout with visible route coverage context.
- Goal is not to change scene truth, only to inspect it from different viewpoints.

## Walkthrough Sequence

1. Camera View first.
   - Open a single camera feed.
   - Enter Focus Mode with `F`.
   - Expected result: the feed becomes the dominant surface, nonessential overlays collapse, and the operator can inspect the frame more directly.

2. Path Replay second.
   - Switch into replay of the selected path.
   - Enter Focus Mode with `F`.
   - Expected result: the route summary becomes secondary, the replay canvas stays visible, and the operator keeps only a compact path control set plus the play/pause reset actions.

3. Camera Wall third.
   - Switch into the wall view.
   - Enter Focus Mode with `F`.
   - Expected result: the grid stays visible but the heavy header/control chrome collapses so the operator can compare feeds at a glance.

4. Return flow.
   - Exit each focus mode with `F` or the visible toggle button.
   - Confirm that the underlying selected camera, path, and layout state are preserved.

## Angle 1 - Operator Efficiency
- The same shortcut works across all three surfaces.
- This reduces context switching and avoids forcing the operator to learn a different control model for each view.

## Angle 2 - Readability
- Each focus mode removes a different layer of chrome.
- Camera View removes analysis overlays.
- Path Replay removes detailed summary panels and the visibility timeline.
- Camera Wall removes layout-heavy header density.

## Angle 3 - Safety and Recovery
- No store truth is mutated by the focus toggle.
- Exit is explicit and reversible.
- Existing selection and replay state remain intact when the operator exits focus.

## Angle 4 - Limitations / Watchouts
- The shortcut should not be used while typing in inputs.
- Focus mode is only a display/state-density change, not a new simulation mode.
- On smaller screens, the compact focus bars may still be dense; browser-level QA should confirm wrapping and hit targets.

## Angle 5 - Documentation Contract
- The surface-level focus behavior is now documented in:
  - `Docs/exploration/CAMERA_VIEW_FOCUS_PERSONA_SIMULATION.md`
  - `Docs/exploration/MULTI_SURFACE_FOCUS_WALKTHROUGH.md`
  - `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md`

## Outcome
- The three primary review surfaces now share a consistent focus-first inspection pattern.
- The operator can move from one evaluation mode to another without losing context.
- Next useful step: browser QA on desktop and tablet to confirm the compact focus chrome does not crowd the canvas on smaller widths.

