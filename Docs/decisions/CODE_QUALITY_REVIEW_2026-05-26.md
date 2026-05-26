# Code Quality Review — SentinelTwin Studio

**Date:** 2026-05-26
**Scope:** Full audit of apps/studio/src/ from direct code reading
**Reviewer:** Claude (session review, not runtime verification)
**Confidence standard:** Based on reading source files directly. Runtime behavior not verified.
Any claims marked [INFERRED] are based on code analysis, not execution.

---

## Overall verdict

The codebase is **solid for a Phase 0-2 build.** The simulation engine is architecturally correct,
the schema is well-designed, the store follows good patterns, and the UI renders correctly (confirmed
from Image 1). There are specific issues in each layer that need addressing before Sprint 1,
and a handful that should be fixed before any production claim.

Code-ready: ✅ for the Phase 0-2 scope
Feature-ready: 🟡 Partial (Image 2 features missing — view modes, animation, camera wall)
Launch-ready: ❌ Not yet (stubs, hardcoded values, missing interactions)

---

## Simulation Engine (src/simulation/) — what's right

**Architecture: correct.**
The simulation package imports only `three` and `three-mesh-bvh`. Zero React/R3F/Zustand.
This is the right call — simulation can move to a Web Worker without refactoring.

**BVH usage: correct.**
`acceleratedRaycast` is patched onto `THREE.Mesh.prototype` at module load. `computeBoundsTree`
is called on the merged geometry. `firstHitOnly = true` is set on the raycaster. This is the
optimal path for one-way occlusion checks.

**FOV test before raycast: correct.**
`evaluateCameraAgainstCell` checks horizontal and vertical FOV angles first, before raycasting.
This short-circuits the expensive raycast for the majority of cells that aren't in the camera's
view frustum. Good performance design.

**Material-aware occlusion: correct.**
The `getSourceForIntersection` approach — using `geometry.groups` + `materialIndex` to identify
which obstruction was hit — is correct. Partial transmission (glass, grill) is properly modeled
as a penalty multiplier rather than a hard block.

**Zone quality: defensible.**
Using the 25th percentile of cells in a zone (not the mean or median) is a conservative,
security-appropriate choice. It reflects the weakest reliable coverage, not the average.

**Path analysis: correct.**
`segmentSamples` uses 0.25m step resolution matching the grid resolution. `nearestCoverageCell`
does nearest-neighbor lookup for path points not exactly on a grid point.

---

## Simulation Engine — issues

### [SIM-01] `resolutionWidth` derivation hardcodes 16:9 aspect ratio
**File:** coverage.ts, `deriveResolutionWidth()`
**Code:** `Math.sqrt(camera.resolutionMP * 1_000_000 * (16 / 9))`
**Problem:** Fisheye (1:1), wide-angle (4:3), and panoramic (21:9) cameras all get wrong pixel
density estimates. The schema has `resolutionWidth` as optional — the fallback hardcodes an
assumption that should be explicit.
**Fix:** Use `camera.resolutionWidth` when present. When absent, log a warning and default to
16:9 explicitly in the schema or presets, not silently in the formula.

### [SIM-02] Adversarial path uses 4-directional movement only
**File:** adversarial-path.ts, `getNeighbors()`
**Code:** `neighborOffsets = [[1,0], [-1,0], [0,1], [0,-1]]`
**Problem:** No diagonal movement (NE, NW, SE, SW). Paths become staircase patterns along
grid diagonals. A real actor moves at any angle. The adversarial path loses realism and
produces visually unnatural routes.
**Fix:** Add diagonal offsets `[[1,1], [1,-1], [-1,1], [-1,-1]]` with movement cost `√2 × cellSize`
instead of `1 × cellSize`. This also gives the path optimizer more options to avoid detection.

### [SIM-03] `buildCoverageGrid` called twice per simulation run
**File:** adversarial-path.ts calls `buildCoverageGrid(scene, 4)` independently
**Problem:** `simulateStudio` calls `computeCoverageCells` (which calls `buildCoverageGrid`),
then calls `computeAdversarialPath` (which calls `buildCoverageGrid` again). Two grid builds
for the same scene.
**Fix:** Compute grid once in `simulateStudio`, pass it to both functions. Or accept
`coverageCells` from the existing computation in `computeAdversarialPath` (it already does
— but then rebuilds a separate grid for nav graph building). Pass `cells` + `cols` + `rows`
+ `cellSize` as parameters.

### [SIM-04] Adversarial path fallback coverage lookup is O(n) per cell
**File:** adversarial-path.ts
**Code:** The `coverageCells.reduce(...)` fallback runs a full scan for every nav node
that doesn't have an exact key match. For a 40×40 grid with 1,600 nav nodes and 1,600
coverage cells, worst case is 1,600 × 1,600 = 2.56M operations.
**Fix:** Build a KD-tree or simply use the same grid coordinates (since nav grid and
coverage grid use the same `buildCoverageGrid`). The key mismatch happens due to floating
point formatting — verify keys use the same precision as the lookup.

### [SIM-05] `simulate-studio.ts` has hardcoded "Cupboard" string check
**File:** simulate-studio.ts, two places
**Code:** `cell.blockedBy.includes("Cupboard")` and `failureReasons.push("Cupboard occlusion...")`
**Problem:** This is demo-specific logic baked into the simulation engine. When used with other
scenes, or if the cupboard is renamed, the issue report will be wrong.
**Fix:** Remove scene-specific hardcoding. The obstruction label should come from the simulation
result's `blockedBy` array. Issue generation should be data-driven from blocked cells, not
string-matching.

### [SIM-06] `worstAreaQuality` computation is wrong
**File:** simulate-studio.ts
**Code:**
```ts
coverageCells.reduce(
  (worst, cell) =>
    qualityToScore(cell.quality) < qualityToScore(worst) ? cell.quality : worst,
  "identification" as DoriQuality,
)
```
**Problem:** Starts from "identification" and finds the minimum quality among all cells —
which means ANY cell with no coverage makes this "none." This is almost always "none" for
any scene with walls (walls create no-coverage areas at their edges). This metric shows "1"
as the worst area quality in the UI even when 95% of the floor is well-covered.
**Fix:** Worst area quality should be the worst quality among WALKABLE cells (cells inside the
room, not walls/obstructions). Filter to `cell.walkable === true` — or since `computeCoverageCells`
already filters to walkable cells, the issue is that "none" quality cells are walkable but
simply uncovered. The current metric is technically correct but misleading — it should
exclude cells that are structurally never reachable (inside walls).

### [SIM-07] Lighting penalty constants have no physical grounding documentation
**File:** coverage.ts
**Constants:** `0.12`, `0.32`, `0.18`, `0.08`, `0.88`, `0.78`
**Not a bug, but a risk:** These multipliers are completely undocumented assumptions. If someone
builds a report that says "Camera 1 achieves recognition quality at night," those numbers determine
whether that claim is roughly true or wildly off. They should have at minimum a comment explaining
what they model (e.g., "IR degrades pixel clarity by ~32% at max rated range").
**Fix:** Add comments or a `LIGHTING_ASSUMPTIONS.md` explaining what each constant models
and where it comes from (measured? manufacturer spec? educated guess?).

---

## Frontend — what's right

**Zustand selectors: correct patterns.**
Components subscribe to specific slices (`useStudioStore((s) => s.scene.cameras)`) not the
entire store object. This prevents unnecessary re-renders.

**InstancedMesh heatmap: correct.**
`instanceColor` TypedArray update pattern (set matrix + set color per index, then flag needsUpdate)
is the right approach. No canvas texture, no DPI issues, direct per-cell color control.

**R3F secondary canvas: correctly isolated.**
`CameraFeedCanvas` creates its own `<Canvas>` with its own R3F renderer and camera. This is
the right approach for camera-view-in-inspector. The camera's perspective state is isolated.

**Zod schema validation on import: correct.**
`safeParseSecurityScene` is used for `importScene()`, returning `{ success, error }` rather
than throwing. Error messages are surfaced to the caller.

**`use-simulation` debounce: good.**
The 400ms debounce on auto-recompute prevents simulation running on every keystroke when
editing inspector fields. The `setTimeout(30ms)` before the sync simulation work gives React
time to paint the loading state.

**Component decomposition: reasonable.**
The 5-tab inspector, the separate bottom panel tabs, and the scene panel are all well-separated
concerns. `StudioShell` is a clean layout orchestrator.

---

## Frontend — issues

### [FE-01] WorkspaceCanvas.tsx is 500+ lines — needs decomposition
**File:** WorkspaceCanvas.tsx
**Problem:** CoverageHeatmap, CameraFrustum, CameraMarker, WallSegment, ObstructionBox,
DecorativeShelving, AccentSurface, CeilingLightMarkers, CriticalZoneOverlay, ObstructionWarning,
EntryDoorLabel, PathLine, AdversarialPath, SceneGeometry are all in one 500+ line file.
**Risk:** Any change to one component requires navigating the entire file. Multiple devs or
agents working in parallel on camera rendering and heatmap rendering will conflict.
**Fix:** Each R3F scene object type → its own file in `src/components/workspace/scene/`:
`HeatmapLayer.tsx`, `CameraObjects.tsx`, `ObstructionObjects.tsx`, `PathObjects.tsx`, etc.
`SceneGeometry` becomes the coordinator that imports and renders them.

### [FE-02] DecorativeShelving has hardcoded positions not tied to SecurityScene
**File:** WorkspaceCanvas.tsx, `DecorativeShelving()`
**Code:** 8 shelves with hardcoded positions like `[1.15, 0.65, 1.3]`
**Problem:** This is a visual layer that's completely disconnected from the simulation's
obstruction geometry. If you load a different scene, or move Shelf 1 in the inspector,
the decorative shelves don't move but the obstructions do. The simulation truth and visual
layer are desynchronized.
**This violates the core architecture principle:** visual mesh must match simulation geometry.
**Fix:** Either remove decorative shelving (use obstruction boxes only), or derive shelf
visual positions from the SecurityScene obstruction nodes with `obstructionType === "shelf"`.

### [FE-03] ObstructionWarning hardcodes "CUPBOARD" label
**File:** WorkspaceCanvas.tsx, `ObstructionWarning`
**Code:** `<div>CUPBOARD</div>` — hardcoded string
**Fix:** Use `scene.obstructions.find(o => o.id === issue.affectedCameras[0])?.label ?? "Obstruction"`
to derive the label dynamically.

### [FE-04] AccentSurface positions are hardcoded decoration
**File:** WorkspaceCanvas.tsx
**Same issue as FE-02** but for floor accent overlays. Positions like `[5, 0.0025, 5.58]`
with arbitrary sizes are demo-specific. Fine for the demo but will look wrong on other scenes.

### [FE-05] CameraFeedCanvas doesn't update when camera is edited
**File:** CameraFeedCanvas.tsx
**Code:** Uses `ref` callback on `perspectiveCamera` to call `cam.lookAt()` on mount, not on update.
The `Canvas` camera prop is set at initialization.
**Problem:** When user drags Camera 1's yaw slider in the inspector, the 3D canvas updates
correctly, but the camera feed PIP doesn't reposition. The feed is stale.
**Fix:** Use R3F's `useFrame` with `camera.position.set()` and `camera.lookAt()` per frame,
or use the `camera={{ ...props }}` pattern correctly so R3F's reconciler handles updates.

### [FE-06] Inspector number inputs fire `updateNode` on every keystroke
**File:** InspectorPanel.tsx, `NumberInput` and `SliderInput` components
**Problem:** Slider inputs correctly use `onChange` (fine — sliders always produce valid values).
Number inputs also use `onChange`, which fires updateNode on every digit typed. Typing "12.5"
into the X position field calls updateNode 4 times with "1", "12", "12.", "12.5", triggering
3 simulation re-runs for the intermediate states.
**Fix:** Number inputs should use `onBlur` or trigger on `Enter`. Or add a separate controlled
state that only commits to the store on blur/enter.
**Note:** Sliders are fine as-is.

### [FE-07] `SceneGeometry` subscribes to entire scene object
**File:** WorkspaceCanvas.tsx
**Code:** `const scene = useStudioStore((s) => s.scene)`
**Problem:** Every scene change (moving a camera, adding a node) causes `SceneGeometry` to
re-render entirely, which re-renders all child components (heatmap, all cameras, all walls,
all obstructions). For a 40×40 grid heatmap this is fine now, but at larger scales or with
more objects this will cause frame drops.
**Fix (future):** Use selective subscriptions per child. `CameraObjects` subscribes only to
`s.scene.cameras`. `ObstructionObjects` subscribes only to `s.scene.obstructions`. Each
layer only re-renders when its own data changes.
**Priority:** Low for current scene size, medium for production.

### [FE-08] No view mode switching exists in StudioShell
**File:** StudioShell.tsx
**Problem:** The reference image (Image 2) shows "Map View | Camera View | Camera Wall | Path Replay"
tabs above the canvas. No view mode state exists anywhere in the store or shell.
**This is the primary missing feature for the next sprint.**
**Fix:** Add `viewMode: "map" | "camera" | "camera_wall" | "path_replay"` to studio-store.
StudioShell renders different canvas components based on view mode.

### [FE-09] Timeline is a static stub
**File:** TimelineTab.tsx
**Problem:** Play/Pause buttons are not wired. Progress bar is static (CSS width hardcoded
to 1/3). The reference design shows a fully interactive playback with per-camera DORI quality
columns per timestep. Current implementation shows a simple table with % visible and event
tags — completely different from the target.
**This is the second primary missing feature for the next sprint.**

### [FE-10] Metrics "+6% vs last run" is hardcoded
**File:** MetricsTab.tsx
**Code:** `<div className="mt-1 text-[9px] text-green-400 font-medium">+6% vs last run</div>`
**Fix:** Compute from `snapshots[snapshots.length - 2]?.simulation?.totalCoveragePct` vs current.
If no previous snapshot, don't show the delta.

### [FE-11] No keyboard shortcut handlers
**File:** LeftPanel.tsx shows keyboard shortcut labels (V, C, B, L, P, Z, D, W, M, T)
but there are no `useEffect` + `addEventListener` keyboard handlers anywhere in the codebase.
**Fix:** Add a `useKeyboardShortcuts` hook that maps key presses to `setActiveTool()`.

### [FE-12] Tool buttons don't place objects on canvas click
**All tool buttons** except "Select" do nothing when the canvas is clicked.
The Select tool works (click on objects selects them via the onClick handlers on R3F meshes).
**Fix (Sprint 1):** Add a floor plane raycaster in WorkspaceCanvas. When active tool is
"camera", canvas click fires `addNode(newCameraNode)` at the hit position.
**Priority:** P1 — users cannot build scenes interactively without this.

### [FE-13] Night Mode / Camera Failure top bar buttons are UI-only
Both buttons render correctly but have no click handlers.
Night Mode should: `setEnvironmentMode("night")` + `updateSimulationAssumptions({timeOfDay:"night"})`.
Camera Failure should: open a modal or set a selected camera to `status: "off"`.

### [FE-14] "Go To Camera View" button doesn't change canvas mode
**File:** InspectorPanel.tsx, CameraInspector
**Code:** `onClick={() => setTab("view")}` — switches the inspector tab but doesn't switch
the main canvas to Camera View mode.
**Fix:** Once view modes are added (FE-08), update to `setViewMode("camera")`.

---

## Store — assessment

**Overall: correct Zustand patterns.**

The `patchNode` / `removeNode` / `insertNode` helpers correctly iterate over all collection keys
using the discriminated union pattern. `cloneSecurityScene` uses `structuredClone` which is
correct for deep cloning before mutation.

### [STORE-01] `simulateStudio` called synchronously in `setTimeout`
**File:** use-simulation.ts
**Code:** `setTimeout(() => { const result = simulateStudio(scene); ... }, 30)`
**Problem:** `simulateStudio` runs synchronously on the main thread. 10.8ms is fine now.
At 80×80 grid + 6 cameras, this becomes ~60-80ms — noticeable jank.
**Fix:** Move simulation to a Web Worker. The simulation package has zero DOM/React imports
and runs clean in a worker context. This is D-012 in the decision log.

### [STORE-02] Demo snapshots use `simulateStudio` at module init time
**File:** studio-store.ts
**Code:** `const INITIAL_SNAPSHOTS = buildDemoSnapshots()` runs at module load time,
calling `simulateStudio()` 4 times.
**Problem:** This delays the first page render by ~40ms (4 × 10ms simulations).
Fine for dev, slightly noticeable in production.
**Fix (future):** Pre-compute snapshot results at build time as JSON, import them as static data.

---

## Schema — assessment

**Overall: well-designed. The Zod schemas match the TypeScript types perfectly.**

Minor notes:
- `cameraNodeSchema` uses `z.string().startsWith("cam_")` — good defensive validation.
- All optional fields with defaults properly use `.default()`.
- `securitySceneSchema.extend({ snapshots: [...] })` is the correct Zod pattern for extending a base schema with additional fields.

### [SCHEMA-01] `criticalZoneNodeSchema` uses `doriQualitySchema.exclude(["none"])`
This is correct — a critical zone requiring "none" quality makes no sense.

### [SCHEMA-02] `simulationAssumptions.pixelsPerMeter` thresholds are in the schema
This is good — it means users can override DORI thresholds for custom standards.
But the UI currently doesn't expose this (only shows the values, no edit).
The "Edit Assumptions" button exists (BottomRow) but isn't wired to anything.

---

## Summary scorecard

| Layer | Quality | Critical Issues | Notes |
|---|---|---|---|
| Simulation engine | ✅ Good | SIM-02 (diagonal), SIM-03 (double grid), SIM-05 (hardcoded strings) | Architecturally sound |
| Schema | ✅ Excellent | None | Well-designed, future-proof |
| Store | ✅ Good | STORE-01 (main thread) | Correct Zustand patterns |
| Canvas/3D rendering | 🟡 Good foundation | FE-01 (monolithic), FE-02 (decorative/data drift), FE-05 (feed stale) | Missing view modes entirely |
| Inspector | 🟡 Working | FE-06 (keystroke firing), FE-14 (view button) | Wired correctly, minor issues |
| Bottom panels | 🟡 Mostly working | FE-09 (timeline stub), FE-10 (hardcoded delta) | Most tabs functional |
| BottomRow | ✅ Good | None found | More complete than expected |
| Tools/interactions | ❌ Stub | FE-08 (no view modes), FE-12 (tools don't place), FE-11 (no shortcuts), FE-13 (buttons unwired) | Major sprint 1 work |

---

## Priority fixes before Sprint 1 starts

**Must fix (correctness + simulation truth):**
1. SIM-02: Add diagonal movement to adversarial path
2. SIM-05: Remove hardcoded "Cupboard" strings from simulate-studio
3. FE-02: Fix DecorativeShelving to match SecurityScene obstruction data
4. FE-05: Fix CameraFeedCanvas camera not updating on yaw/pitch change
5. FE-06: Debounce NumberInput — don't fire updateNode on every keystroke

**Sprint 1 primary work:**
6. FE-08: Add viewMode to store + StudioShell (Map/Camera/CameraWall/PathReplay)
7. FE-12: Wire canvas click → tool placement for Camera and Obstruction tools
8. FE-09: Rebuild TimelineTab with animated playback + per-camera quality table
9. FE-13: Wire Night Mode and Camera Failure top bar buttons

**Backlog (non-blocking):**
10. FE-01: Decompose WorkspaceCanvas into separate files
11. FE-10: Compute "+N% vs last run" from snapshots
12. FE-11: Add keyboard shortcut handlers
13. SIM-01: Fix 16:9 assumption in resolutionWidth
14. SIM-07: Document lighting penalty constants
