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

- [ ] View mode transitions
  - Switch between all 7 view modes (Map, Camera View, Camera Wall, Path Replay, Compare, Report, Analytics) via the view mode bar or keyboard shortcuts `1`–`7`.
  - Confirm the view renders without blank canvas, error, or stale state from the previous mode.

- [ ] Focus mode (F key)
  - From a view surface (Camera View, Camera Wall, or Path Replay), press `F` to enter focus mode.
  - Confirm the focus bar overlay appears with the surface title and "Press F to exit focus" prompt.
  - Confirm docks/panels are hidden and the canvas claims the full viewport.
  - Press `F` again to exit focus mode.
  - Confirm the previous layout (docks, panels, sizes) is fully restored, including the previously active bottom tab.

- [ ] Focus mode (surface toggle)
  - Press `F` while NOT in a view surface (e.g., Map or Report view).
  - Confirm the layout switches to the `focus` preset.
  - Press `F` again and confirm full layout restoration.

- [ ] Camera View immersion
  - Open Camera View and press `F` (or the toggle-immersive trigger).
  - Confirm the focus bar shows "Camera Focus Mode", camera name, and camera index/total.
  - Exit focus mode and confirm the `CameraHeader` bar returns.

- [ ] Camera Wall immersion
  - Open Camera Wall and press `F`.
  - Confirm "Camera Wall Focus Mode" bar shows active/offline camera counts and bridge health.
  - Exit focus mode and confirm the standard bar with "Camera Wall - Multi Camera" returns.

- [ ] Path Replay immersion
  - Open Path Replay and press `F`.
  - Confirm focus mode toggles the immersive state.
  - Confirm exit restores the standard layout.

- [ ] Keyboard guard (input fields)
  - Focus any input, textarea, select, or contentEditable element.
  - Press any keyboard shortcut (`1`–`7`, `F`, `R`, `N`, `S`, `P`, `V`, `Delete`, etc.).
  - Confirm the shortcut is NOT intercepted — the input receives the keypress normally.

- [ ] Report export
  - Open the report workspace or report-lite surface.
  - Export HTML, Markdown, or text and confirm the output includes the planning disclaimer and standards reference.

## Pass Criteria

- No fatal runtime errors during the checklist.
- Dirty state, simulation state, and exported report content all reflect the latest scene changes.
- Planned or preview flows always offer a fallback path instead of a dead end.
