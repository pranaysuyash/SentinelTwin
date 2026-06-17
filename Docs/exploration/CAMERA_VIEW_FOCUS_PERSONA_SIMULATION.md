# Camera View Focus Mode — Persona Simulation

## Simulation Date
- 2026-06-17

## Persona
- Role: Security Operations Analyst (first responder / operator)
- Primary goal: Rapidly inspect one camera feed for incident visibility with minimal UI distraction.
- Context: Scene is live simulation state with multiple active cameras and active path replay.

## Preconditions
- Scene exists with at least one online camera.
- Path replay may be running or paused.
- Camera View mode selected from the workspace shell.

## Simulation Steps

1. Open Camera View.
   - Baseline expectation: camera is in standard work mode with header, control strip, path overlays, DORI analysis, replay overlays, and verification panel available.

2. Toggle to a specific camera.
   - Baseline expectation: canvas updates to selected camera and replay state remains tied to shared timeline state.

3. Enter Focus Mode using `F` key shortcut.
   - Behavioral expectation: `immersiveMode` becomes active, standard control chrome collapses, and a compact focus header appears.
   - Explicit expected copy: `Camera Focus Mode`, index text, and instruction `Press F to exit focus`.

4. Inspect feed in Focus Mode.
   - Behavioral expectation: nonessential overlays (mode filter, control strip, DORI card, path status, visibility overlays, full verification panel) are hidden to preserve canvas readability.

5. Return to standard view using `F` or `Exit Focus`.
   - Behavioral expectation: full Camera View overlays return and no persisted mode-state corruption occurs.

6. Return to Map View via strip action.
   - Behavioral expectation: context remains and selected camera is preserved for quick re-entry.

## Angle 1 — Operator UX
- Positive: one-key mode toggle improves continuous visual focus.
- Risk: key binding may conflict with browser/system shortcuts in some contexts.
- Mitigation in code: shortcut ignores modified keys and ignores element targets that are form controls.

## Angle 2 — Analysis Fidelity
- Nonessential overlays are intentionally hidden only in focus mode.
- Verification, path/replay analysis, DORI and zone analysis remain available in standard mode.
- Risk: there is no explicit auto-preserving of ephemeral panel visibility.
- Mitigation: all flags/state are kept in existing React state, so returning to standard mode reuses current values.

## Angle 3 — Accessibility / Safety
- Positive: `F` provides fast operator workflow.
- Risk: users relying on screen readers may not discover the mode without visible toggle text.
- Mitigation: on-screen strip button exposes focus actions, and header copy confirms how to exit.

## Angle 4 — Robustness / Recovery
- Focus Mode does not alter store-level simulation state.
- Escape/exit returns to prior camera selection with no scene mutation.

## Angle 5 — Test Coverage Contract
- Added source-level assertions to lock the Focus Mode contract in:
  - `apps/studio/src/components/__tests__/camera-view-mode.test.ts`
  - `apps/studio/src/components/view/camera-view-chrome.tsx`
- Coverage expectations include `Camera Focus Mode`, `Focus`, `Exit Focus`, and `Press F to exit focus` strings.

## Outcome
- Focus Mode is implemented as a reversible operator-only display mode.
- The mode is useful for incident inspection and keeps analysis tooling available in standard mode.
- Next step for broader confidence: browser-mode user simulation for each screen size (desktop + tablet) to validate visual ergonomics and discoverability.

## Live Browser QA Note
- Date: 2026-06-17
- Environment: local Studio shell on `http://127.0.0.1:3011/?qa=1`
- Scene: `Small Retail Shop Demo`
- Verified that Camera View renders the standard operator chrome correctly in the live shell and preserves the selected scene/camera context.
- Finding: the shell-wide `F` shortcut enters the global focus layout; it does not by itself surface the local Camera View immersive header copy that the component-level focus state can render.
- Practical implication: the camera-view header copy and the shell focus shortcut should remain documented as separate interaction layers so browser QA can test each one on purpose rather than assuming they are the same control path.
