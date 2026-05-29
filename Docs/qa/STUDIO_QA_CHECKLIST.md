# SentinelTwin Studio QA Checklist

Use this checklist for a quick manual pass after changes to Studio workflows, simulation, scan import, or report export.

## Preconditions

- Start the Studio app from a clean browser session.
- Open the current demo or workspace scene.
- Run the shared simulation once so the status bar has fresh data.

## Checklist

- [ ] Fresh launch
  - The launcher loads without a blank screen or runtime error.
  - The default path is understandable and the primary CTA is visible.

- [ ] Run simulation
  - The scene recomputes and the status bar shows an updated simulation state.
  - Coverage, zone status, and issues update after the run.

- [ ] Edit camera
  - Select a camera, move or disable it, and confirm the scene becomes dirty.
  - Re-run simulation and confirm the coverage and issue summary change.

- [ ] Place object
  - Add or move an obstruction and confirm the scene updates immediately.
  - Re-run simulation and confirm the obstruction affects coverage.

- [ ] Scan import
  - Open the scan-to-scene flow and compile a manual-assisted scene.
  - Confirm invalid candidate input is rejected with a readable warning.

- [ ] AI draft fallback
  - Open the AI layout draft path.
  - Confirm the app still offers a non-AI/manual fallback when AI is unavailable or not configured.

- [ ] Report export
  - Open the report workspace or report-lite surface.
  - Export HTML, Markdown, or text and confirm the output includes the planning disclaimer and standards reference.

## Pass Criteria

- No fatal runtime errors during the checklist.
- Dirty state, simulation state, and exported report content all reflect the latest scene changes.
- Planned or preview flows always offer a fallback path instead of a dead end.
