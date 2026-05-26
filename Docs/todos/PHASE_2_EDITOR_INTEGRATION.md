# Phase 2 — Editor Integration

**Status:** In progress (2026-05-26)
**Blocking:** Phase 0 ✅ + Phase 1 ✅ complete
**Agent:** Claude Code (or any agent)
**Read first:** Docs/architecture/02, 07, 08

**Note:** `apps/studio` is the standalone implementation (per D-010). The Pascal fork paths
in tasks 2.1–2.2 are already implemented directly in `WorkspaceCanvas.tsx`. Tasks below
are mapped to actual `apps/studio` locations.

---

## Goal

Wire the coverage engine into the R3F editor. Scene renders in 3D with camera cones,
coverage heatmap, and the inspector panel. Every scene change triggers coverage recompute.
This is when SentinelTwin first feels alive.

---

## Task 2.1 — Camera System (Frustum Geometry)

In `packages/core/src/systems/CameraSystem.ts`:

Follows Pascal's WallSystem pattern:
- Reads dirty camera nodes
- Generates frustum cone geometry (see Docs/architecture/07 for formula)
- Updates the corresponding Three.js Object3D in scene registry

In `packages/viewer/src/renderers/CameraNodeRenderer.tsx`:
- Renders camera body (small sphere or box)
- Renders frustum cone (custom geometry, semi-transparent)
- Both update when camera node changes

**Done when:** Camera 1 in demo scene shows a visible cone in 3D view.

---

## Task 2.2 — Coverage Heatmap

In `packages/viewer/src/overlays/CoverageHeatmap.tsx`:

Creates an `InstancedMesh` across the floor grid.
Subscribes to `simulation` state in Zustand.
When simulation updates, writes quality colors to `instanceColor`.

Colors (per Docs/architecture/07):
- none: #222222 (dark gray, 70% alpha)
- detection: #ff4444 (red)
- observation: #ff8c00 (orange)
- recognition: #ffdd00 (yellow)
- identification: #44cc44 (green)

Place heatmap at `y = 0.01` to avoid z-fighting with floor.

**Done when:** Running the demo scene shows a colored heatmap over the floor corresponding to camera coverage quality.

---

## Task 2.3 — Simulation Trigger

In `apps/editor/src/hooks/useSimulationTrigger.ts`:

```typescript
// When scene changes (any node is modified), set simulationDirty = true
// On mouse-up (pointer up event), if simulationDirty: run computeCoverage, store result, set simulationDirty = false
// During drag: do NOT recompute (only show preview cone)
```

Debounce the recompute to prevent rapid successive calls.
Target: recompute triggers within 100ms of mouse-up.

**Done when:** Moving a shelf in the scene causes the heatmap to update after mouse release.

---

## Task 2.4 — Camera Inspector Panel

In `apps/editor/src/panels/CameraInspector.tsx`:

When a camera node is selected, show:
- Name (editable)
- Status (on/off toggle)
- Mount type (dropdown)
- Position (x, z) — numeric inputs
- Height (y) — slider + numeric
- Yaw (slider + numeric, 0–360)
- Pitch (slider + numeric, -90 to 0)
- FOV horizontal (slider, 30–180)
- Resolution (preset dropdown or MP numeric)
- Night mode (dropdown)
- IR range (if applicable)
- Clarity (dropdown)
- [View from Camera] button
- [Preset selector] button

All inputs write back to the CameraNode in Zustand store, trigger dirty + recompute.

**Done when:** Selecting Camera 1, changing FOV, and releasing causes heatmap to update.

---

## Task 2.5 — Obstruction Inspector Panel

In `apps/editor/src/panels/ObstructionInspector.tsx`:

When an obstruction node is selected:
- Label (editable)
- Position (x, z)
- Rotation (slider)
- Dimensions (width, depth, height) — numeric inputs
- Material (dropdown: solid/glass/grill/mesh/curtain/reflective)
- Movable toggle
- Vision transmission (displayed, not editable — derived from material)
- [Test without this] button (temporarily removes node, recomputes coverage, restores)

**Done when:** Selecting Shelf 1, moving it, and releasing updates the heatmap.

---

## Task 2.6 — Metrics Panel

In `apps/editor/src/panels/MetricsPanel.tsx`:

Shows `SimulationResult` summary:
```
Total Coverage: 78%        Blindspot: 22%
Critical zones passing: 2/4
Identification quality area: 31%

Issues:
⚠️ Cash Counter: requires Recognition, currently Observation
⚠️ Entry Corridor: requires Identification, currently Recognition
✅ Main Entry: passes
✅ Back Storage: passes
```

Updates whenever `simulation` state changes in Zustand.

**Done when:** Metrics panel shows meaningful numbers for the demo scene.

---

## Task 2.7 — Day/Night Toggle

Simple toggle in the toolbar: Day / Night.
Updates `assumptions.timeOfDay` in store.
Triggers coverage recompute.
Heatmap updates to show degraded night coverage.

**Done when:** Toggling night mode shows red/orange zones replacing yellow/green in most of the scene.

---

## Task 2.8 — Camera View Mode (Secondary Canvas)

In `apps/editor/src/panels/CameraFeedCanvas.tsx`:

```tsx
<CameraFeedCanvas
  cameraNode={selectedCamera}
  width={320}
  height={240}
  overlayMode="day"  // or "night_ir", "night_nolight"
/>
```

Creates a secondary R3F Canvas.
Places a THREE.PerspectiveCamera at the simulated camera's position/orientation.
Renders the same scene from that camera's POV.
Applies CSS overlay effects: grayscale + noise for night, normal for day.

Panel opens in bottom-right when user clicks [View from Camera] in inspector.

**Done when:** Clicking "View from Camera" on Camera 1 shows a picture-in-picture view of the scene from Camera 1's perspective.

---

## Task 2.9 — Before/After Snapshot

In `apps/editor/src/toolbar/SnapshotControls.tsx`:

[Save Snapshot] button: saves current scene + simulation to `snapshots` in store, prompts for label.
[Compare] button: opens before/after split view.

Split view: two canvases side by side, each rendering a different snapshot.
Metrics panel shows delta between them.

**Done when:** Save snapshot "Before moving shelf", move shelf, save "After moving shelf", compare shows different heatmaps and metrics delta.

---

## Phase 2 Done Criteria

- [x] 2.1: Camera cone renders in 3D — `WorkspaceCanvas.tsx` CameraFrustum ✅
- [x] 2.2: Coverage heatmap renders correctly with quality colors — `CoverageHeatmap` ✅
- [x] 2.3: Simulation recomputes on mouse-up, not during drag — `use-simulation.ts` 400ms debounce ✅ (wired after 2.4 completes)
- [x] 2.4: Camera inspector panel updates camera, triggers recompute — `InspectorPanel.tsx` wired to `updateNode` ✅
- [x] 2.5: Obstruction inspector panel, movable, triggers recompute — `ObstructionInspector` + clickable `ObstructionBox` ✅
- [x] 2.6: Metrics panel shows coverage summary and zone results — `MetricsTab.tsx` ✅
- [x] 2.7: Day/night toggle degrades coverage visually — `TopBar.tsx` environmentMode toggle ✅
- [x] 2.8: Camera view mode (PIP) works — `CameraFeedCanvas.tsx`, live secondary R3F Canvas in inspector View tab ✅
- [x] 2.9: Before/after snapshots work, comparison renders — `BeforeAfterTab.tsx` with delta ✅

**Phase 2 COMPLETE — 2026-05-26**

**Next phase:** `Docs/todos/PHASE_3_AI_COMMAND.md`
