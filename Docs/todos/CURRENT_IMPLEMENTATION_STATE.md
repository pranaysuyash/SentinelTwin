# Current Implementation State — Camera Studio

**Updated:** 2026-05-27 (session 9: Coverage Fragility Field end-to-end, /target command, three-compat test fix)
**Source:** Direct code audit of apps/studio/src/
**Purpose:** Accurate baseline of what is actually built, tested, and rendering.
Use this instead of the earlier CAMERASTUDIO_GAP_ANALYSIS.md which was written
before the Phase 2 audit. This doc supersedes the gap analysis for "what exists."

---

## What is verified built and working

### Simulation engine (src/simulation/) — complete, tested
- `coverage.ts` — BVH-accelerated raycasting, DORI scoring, material penalties, lighting model ✅
- `coverage.ts` — trust-hardening updates now enforce camera `rangeM` gates before scoring, wire scene `pixelsPerMeter` assumptions into quality mapping, emit per-camera evaluation metadata (`cameraEvaluations`) and mark privacy/coverage-denominator cells for traceable KPIs ✅
- `coverage.ts` — camera evaluations now include `visible` plus machine-readable `reasonCodes`, and the debug/report surfaces show active PPM thresholds ✅
- `coverage.ts` / coverage tests — door and window states now participate in deterministic vision occlusion with regression coverage for closed/open doors plus glass, grill, curtain, and reflective window behavior ✅
- `simulation/__tests__/golden-simulation-claims.test.ts` — golden product-claim suite verifies door/window behavior, night+IR recovery, obstruction counterfactual improvement, privacy flagging, and redundancy preservation under single-camera failure ✅
- `grid.ts` / grid tests — rotated obstruction footprints now have explicit walkability regression coverage ✅
- `adversarial-path.ts` — Dijkstra minimum-exposure pathfinding now surfaced with defensive aliases (`coverageFailurePath`, coverage-gap/camera-without-coverage/critical-zone-reachable fields) while preserving backward-compatible payload keys ✅
- `dori.ts` — PPM thresholds, quality ordering, quality comparators ✅
- `grid.ts` — floor sampling grid with walkability ✅
- `geometry.ts` — yaw/pitch direction vectors, polygon helpers ✅
- `path-analysis.ts` — path visibility over time ✅
- `simulate-studio.ts` — orchestrates full simulation run ✅
- `coverage-fragility.ts` — Coverage Fragility Field: per-cell distance-to-DORI-threshold score (0=robust, 1=fragile), `computeCoverageFragility()` pure function with `FragilitySummary` output ✅
- `simulate-studio.ts` — Coverage Fragility wired: per-cell `fragility` field + `fragilitySummary` attached to every `SimulationResult` ✅
- `simulate-studio.ts` — zone quality uses target-height profiles, privacy coverage issues are surfaced, and all aggregate metrics are computed over non-privacy walkable cells for canonical coverage denominators ✅
- `PathReplayView` / `TimelineTab` — authored `scene.paths` are now the primary replay/timeline focus, with coverage-failure replay retained as secondary defensive analysis ✅
- `PathReplayView` / `TimelineTab` — replay follow state is now shared through the store, so the Follow toggle actually pans the replay camera toward the actor instead of changing only button chrome ✅
- `studio-store` / store tests — obstruction counterfactuals now have direct regression coverage for simulated deltas and obstruction-id tracking ✅
- Confirmed performance: ~10.8ms average on 40×28 grid with 2 cameras — under 16ms target ✅
- Zero React/DOM imports confirmed ✅

### Temporal Simulation (src/simulation/temporal.ts) — complete, tested
- `temporal.ts` — 24-hour security profile engine: change-timeline optimization (10-15 transitions/day, not 96 full sims) ✅
- `computeTemporalProfile(scene)` — full end-to-end: builds change timeline, patches scene per time slice, runs coverage at transitions, interpolates intermediates ✅
- `computeTimeSliceStateForHour(hour, minute)` — public helper for time-slice state queries ✅
- `detectVulnerabilityWindows()` — classifies high/medium/low severity windows from snapshot analysis ✅
- `findSafestPeriods()` — identifies continuous safe coverage windows ✅
- `patchSceneForTimeSlice()` — clones scene, patches assumptions (timeOfDay, interiorLightLevel, security light status, camera night mode) ✅
- Fixed operator precedence bug in `getExteriorLightState` for 0:00-2:00 (D-035) ✅
- 29 unit tests covering time-slice states, profile structure, snapshot count, vulnerability windows, safest periods, zone coverage, camera/light counts, timer cutout behavior ✅
- **ISSUE-005 resolved:** Engine now reads `scene.timeSchedule` when present (interior/exterior light schedules, occupancy periods). Falls back to `DEFAULT_SCHEDULES` when scene has no schedule. Schedule resolution uses `timeInPeriod()` for wrap-around midnight ranges ✅
- **97-snapshot off-by-one fixed:** Engine now produces exactly 96 snapshots (24h × 4 per hour at 15-min resolution) ✅
- **Not implemented:** Seasonal/location-aware lighting (suncalc.js), guard patrol integration, occupancy-based camera obstruction multiplier, door lock schedules — deferred to V0.2/V0.3

### Temporal Schema Types (src/schema/security-scene.ts) — complete
- `timeScheduleSchema` with location, interior/exterior light schedules, occupancy, guard patrols ✅
- `temporalSecurityProfileSchema` with hourlySnapshots, vulnerability windows, safest periods, zone coverage by hour ✅
- `hourlySecuritySnapshotSchema`, `vulnerabilityWindowSchema` ✅
- Scene fields: `timeSchedule: timeScheduleSchema.optional()`, `temporalProfile: temporalSecurityProfileSchema.optional()` ✅

### Temporal Store Integration (src/store/studio-store.ts) — complete
- `temporalProfile` state (TemporalSecurityProfile | null) ✅
- `temporalScrubHour` / `temporalScrubMinute` for time-scrubbing UI ✅
- `setTemporalScrub(hour, minute)` — auto-switches environmentMode (day/night/dusk) ✅
- `computeTemporalProfile` action — runs engine and stores result ✅

### Temporal UI (src/components/bottom-panel/TemporalProfileView.tsx) — complete
- 24-hour clickable timeline bar (96 slots, color-coded by coverage quality) ✅
- Vulnerability window cards (expandable, severity-colored, with "Jump to start") ✅
- State transition map (visual bar showing Business Hours, After Hours, Night, etc.) ✅
- Summary cards: Worst Coverage, Vulnerability Windows count, Safest Periods count ✅
- Zone coverage stability chart (per-zone average + variance) ✅
- Compute / Recompute button ✅
- "24H PROFILE" tab in BottomPanel TABS array (surfaced 2026-05-27) ✅

### Temporal Report Integration (src/report/index.ts) — complete
- TemporalProfileSummary in report data ✅
- HTML export: vulnerability windows, worst coverage, safest periods ✅
- Markdown + JSON export: temporal profile section ✅

### Schema (src/schema/security-scene.ts) — complete
- All Zod schemas + TypeScript types ✅
- All node types: Camera, ObstructionNode, SecurityLightNode, WallNode, DoorNode, WindowNode,
  CriticalZoneNode, PrivacyZoneNode, EntryPointNode, ScenarioPath ✅
- Full SimulationResult with coverageCells, criticalZoneResults, adversarialPath ✅
- `CoverageCellResult.fragility?: number` (0=robust, 1=fragile) ✅
- `SimulationResult.fragilitySummary?: { meanFragility, fragileCellCount, robustCellCount, totalCells }` ✅
- SceneSnapshot schema ✅
- parseSecurityScene, safeParseSecurityScene, cloneSecurityScene utilities ✅

### Store (src/store/studio-store.ts) — complete
- Full Zustand store with all CRUD operations (addNode, updateNode, removeNode) ✅
- importScene / exportScene with Zod validation ✅
- Snapshots system with 4 pre-built demo snapshots ✅
- Layer visibility (11 layers) ✅
- `heatmapMode: "quality" | "fragility"` — store-backed heatmap mode with `setHeatmapMode` action ✅
- Environment mode (day/dusk/night) ✅
- Active tool tracking ✅
- Shared minimap/path-map viewport state is store-backed, resets on scene import/load/create, and no longer gets silently re-fit by map remounts ✅
- simulationDirty / simulationRunning / autoRecompute ✅
- getSelectedCamera() helper ✅

### use-simulation hook — working
- Runs simulation on first mount ✅
- Auto-recompute on scene change with 400ms debounce ✅
- Manual runSimulation() callback ✅
- Defers to setTimeout to allow React to paint loading state first ✅

### TopBar — complete
- SentinelTwin Studio identity + scene selector dropdown ✅
- SimStatus badge (Needs Recompute / Running / Up to date) ✅
- Environment mode dropdown (Day/Dusk/Night) ✅
- Run Simulation button (wired, triggers simulation) ✅
- Night Mode and Camera Failure quick actions are wired to live scene state changes ✅
- Save Snapshot, Compare, and Generate Report actions are wired ✅
- Scene name dynamically displays `scene.name` (no longer hardcoded) ✅
- "New Scene..." opens SceneBuilderWizard modal with template/blank/floor-plan creation ✅
- SceneBuilderWizard (560 lines) was dead code — now wired into TopBar as modal overlay ✅
- 5 scene templates accessible from wizard: retail-shop, open-office, warehouse, classroom, parking-garage ✅
- TopBar scene menu now also exposes `Scan a Site...`, which opens the dedicated manual-assisted scan intake flow and compiles into a canonical `scan_import` scene ✅

### Scan-to-scene intake — built and visible
- Launcher page now has a visible `Scan a Site` entry point alongside scene creation/import and AI layout draft ✅
- `ScanSiteWizard` handles manual-assisted site photo intake, candidate placement/classification, review, and compile-to-scene handoff ✅
- `apps/studio/src/lib/scene-skeleton.ts` centralizes the blank-scene shell used by both new-scene creation and scan compilation ✅
- `apps/studio/src/lib/scan-to-scene.ts` converts scan candidates into real `SecurityScene` nodes without introducing a parallel scene model ✅
- Scan sessions remain separate from the final scene until compile, and the UI labels the flow as manual-assisted rather than claiming AI perception ✅

### WorkspaceCanvas — good 3D foundation with view-mode shell wired
- Instanced mesh heatmap with quality/fragility mode toggle ✅
- Camera frustum cones ✅
- Camera markers with labels and status ✅
- Wall segments with glass material handling ✅
- Obstruction boxes with click-to-select + highlight ✅
- Decorative shelving ✅
- Critical zone overlays with pass/fail badges ✅
- Obstruction warning labels ✅
- Path lines (dashed, start/end markers) ✅
- Adversarial path (red dashed line) ✅
- Entry door label ✅
- Ceiling light markers ✅
- Environment themes (day/dusk/night) with fog ✅
- NorthCompass, ViewControls, ControlHintBar ✅
- View mode switching now routes through `StudioShell` for Map View / Camera View / Camera Wall / Path Replay / Compare ✅
- Full-canvas view modes are wired for the canvas shell ✅
- Camera View mode is a dedicated full-canvas single-camera POV with a live HUD, DORI overlay card, mode filters, overlay toggles, camera header navigation, and a back-to-map control ✅
- Camera Wall mode now uses an adaptive live feed grid (selected-first, active-first) with 1-6 camera feeds plus a 3D map overview slot and active/offline counters ✅
- Compare mode now renders side-by-side baseline/proposed 3D panels with delta cards, issue/recommendation notes, a quality-over-time trend, and scenario notes ✅
- Compare mode now exposes explicit Scenario A / Scenario B selectors so comparison pairs do not drift silently when new snapshots are saved ✅
- MiniMap now uses the shared 2D map system with reusable projection/layers, zoom/fit controls, hover/selection sync, and replay actor visibility ✅
- MiniMap now supports collapsed / compact / expanded / hover-preview states, shared map tokens, layer/display controls, legend, scale, north, and empty-map focus handoff to the 3D workspace ✅
- PathMap now uses the shared 2D map system with quality-banded path rendering, current-state replay panel, path events list, segment details, and inline play/open-in-3D controls ✅
- Camera placement presets are now reactive and store-backed instead of hidden module state, so the camera tool picker reflects the current preset and placement reads one canonical source ✅
- The scene workbench now supports a canonical duplicate-node action with keyboard shortcut support, so selected cameras/obstructions/walls/zones/paths can be copied and reselected instead of rebuilt manually ✅
- The scene workbench now has shared grouped selection state, shift/meta multi-select, and drag-select bounds so the canvas can capture more than one object without losing the primary inspector selection ✅
- The workbench transform layer now exposes obstruction width/depth resize handles and camera pitch affordances in addition to move/rotate/height controls ✅
- View mode switching is implemented for Map / Camera View / Camera Wall / Path Replay ✅
- Path replay animation and actor playback are implemented in the dedicated replay view ✅
- Path replay now renders replay-proof overlays: legalized samples avoid obvious obstruction overlap, the scene shows camera frustums, and the floor is tiled so breach/collision explanations read directly from the canvas ✅
- Full-canvas replay mode now uses the workspace shell, not the docked layout ✅
- Compare mode now renders a full before/after comparison shell with scene panels, comparison cards, and lower analysis bands; verified in production build via `?mode=compare` ✅
- Compare mode now keeps the selected snapshot pair explicit in the header and still uses canonical `saveSnapshot()` for Add Scenario ✅
- Path replay and compare are deep-linkable via `?mode=replay` and `?mode=compare`, which makes visual QA deterministic in the local browser flow ✅
- `apps/studio/next.config.ts` now allows local dev origins (`127.0.0.1`, `localhost`) so browser-based QA can hydrate the app cleanly in development ✅
- Path replay now uses the night-stage theme in the production bundle, which matches the reference mood more closely and keeps the replay surface distinct from map/compare ✅
- Production-browser verification on `http://localhost:3010/?mode=replay` and `http://localhost:3010/?mode=compare` matched the stored reference screenshots after scale normalization; `replay-live-current.png` and `compare-final.png` are the current proof captures ✅

### CameraFeedCanvas — inspector PIP, intentionally lighter than the full camera view
- Renders R3F canvas from camera's perspective ✅
- Shows walls, obstructions, floor geometry ✅
- Night overlay (CSS filter) ✅
- Camera name + resolution label ✅
- DORI overlay card now shows the selected target zone, current quality, required range, distance, angle, best camera, and lighting summary ✅
- Local view-mode toggles now provide Normal / IR / Low Light / Thermal visual states for the inspector feed ✅
- Uses fixed Canvas with static camera position — does NOT update if camera moves ❌
- No actor/path actor in feed ❌
- No dirty lens / noise effects ❌
- This is the smaller inspector preview; the full-screen `camera_view` shell now owns the richer HUD and overlay stack ✅

### CameraViewMode — full-canvas single-camera POV
- Full-canvas camera view with live HUD, DORI overlay card, LIVE MODE banner, overlay controls, mode filters, and back-to-map button ✅
- Camera selector header with previous/next buttons and store-backed camera selection sync ✅
- Mode toggles cover Normal / IR / Low Light / Thermal, and the overlay strip can show overlays, path, zones, timestamp, and grid state ✅
- The camera feed itself still does not render the walking actor inside the POV; the actor lives in replay/map contexts only ⚠️

### InspectorPanel — wired and working
- CameraInspector with 5 tabs ✅
- Properties: position XYZ inputs (wired to updateNode), yaw/pitch sliders (wired), FOV slider (wired), height ✅
- Status: on/off toggle (wired), night mode selector (wired), clarity selector (wired) ✅
- Analytics: coverage %, zone pass/fail, offline impact notes ✅
- View: CameraFeedCanvas (working but minimal — see above) ✅
- Failures: camera failure simulation controls (offline/dirty/night-disabled), criticality scoring, redundancy analysis, and impact notes are implemented ✅
- ObstructionInspector: position, rotation, dimensions, material (all wired to updateNode) ✅
- "Test Without This Obstruction" button is wired to counterfactual simulation with delta metrics ✅
- Aim at Zone button: wired ✅
- Duplicate camera button: wired ✅
- Delete camera button: wired ✅
- InspectorPanel now mounts as a full-width dock shell inside the contextual right panel, so the right dock can reclaim canvas space instead of reserving a fixed-width inner island ✅
- The dock headers were tightened further so toggles live on each section without turning the header chrome into the dominant visual element ✅

### LeftPanel — UI complete
- All 10 tool buttons with keyboard shortcut labels ✅
- Layer visibility toggles for all 11 layers (wired to toggleLayer) ✅
- MiniMap is now powered by the shared map module, not a panel-local SVG, and renders coverage cells, zones, walls, paths, adversarial path, cameras, path replay actor, and interactive zoom/fit/select controls ✅
- Tools are buttons only — clicking canvas doesn't place objects ❌ (all tools except select are UI-only)
- LeftPanel now behaves as a full-width dock shell with collapsible subpanels for Scene Tools, Scene Layers, and Mini-Map, instead of a fixed-width inner column that wasted canvas space ✅
- Section headers now use compact badges and slimmer toggle controls so the sidebar gives more space back to tools and content ✅

### BottomPanel tabs — mostly complete

**MetricsTab** ✅
- 7 core metric cards: coverage, critical zones, cameras, avg quality, worst area, recognition %, identification %
- 8th card (Coverage Fragility) renders when simulation includes fragility data ✅
- DonutChart component for coverage and quality
- All values from simulationResult
- Coverage delta is computed from prior snapshots, not hardcoded ✅

**IssuesTab** ✅
- Severity icons and badges
- Affected zones / cameras displayed
- Recommendations list
- Recommendation actions now include `Preview Fix`, `Apply Fix`, and `Revert Preview` for verified transform recommendations ✅

**TimelineTab** ✅
- Active authored path selector
- Playback controls with play/pause, scrubber, and speed presets
- Timeline event table with actor position, camera, quality, and reason columns
- Quality-over-time view backed by VisibilityTimeline
- Camera summary cards for the active path

**TemporalProfileView (24H PROFILE)** ✅
- 24-hour clickable timeline bar (96 slots, color-coded) with compute/recompute button
- Vulnerability window cards, safest periods, zone coverage stability chart
- Time-scrubbing into 3D scene (auto-switches environment mode)
- See "Temporal UI" section above for full detail

**BeforeAfterTab** ✅
- Shows before/after coverage % from last 2 snapshots
- Delta coverage calculation
- Shows issues count and zone pass rate
- No visual canvas comparison (numbers only)

**ReportLiteTab** ✅
- Generates markdown report
- Copy to clipboard button
- Shows all issues and recommendations

**DebugTab** ✅
- Toggle switches for all 11 layers
- Simulation debug stats (coverage %, quality breakdown, issues count)

### ScenarioPathPanel ✅
- Active path selector wired to `activePathId`
- Path length, estimated time, visible % stats
- Coverage ribbon now uses interpolated path sampling instead of authored point-only sampling
- Shared SVG path map with walls, zones, path, start/end markers, replay actor, and pan/zoom/fit controls
- Edit Path / Play Path buttons are wired (`Edit`: map+path tool, `Play`: replay mode + timeline) ✅

### BottomRow ✅ (more complete than expected)
- Snapshots panel with thumbnail cards + "New Snapshot" button
- Assumptions panel showing all SimulationAssumptions with "Edit Assumptions" button (UI only) ❌
- Report Summary panel with 4 bullet points (dynamic from simulation result)
- Environment panel now shows scene-derived mode, light state, window handling, door handling, and exterior lux instead of synthetic weather values ✅
- AI command bar (`use-ai-command.ts`) handles: `/night`, `/dusk`, `/day`, `/report`, `/compare`, `/snapshot`, `/simulate`, `/run`, `/fail`, `/camera-failure`, `/fix`, `/improve`, `/target` ✅
- `/target <type>` — sets targetType on all critical zones (face, face_recognition, face_identification, vehicle_detection, license_plate, package, cash, door, perimeter, person) ✅

### StatusBar — exists (not read in detail)
### Demo scene — validated ✅
- small_retail_shop.json loads and validates
- Cupboard confirmed to occlude Camera 1 view of cash counter

---

## Reference image parity status

**Image 2: CameraView_TimelinePathReplay_Camera1InspectorViewtab.png**

The reference is now largely matched in behavior. The remaining deltas are mostly visual polish and the actor-in-camera-feed overlay, not missing workspace modes.

### [MISS-01] View mode tab bar above canvas ✅
The reference shows: Map View | Camera View (active) | Camera Wall | Path Replay
Current code: the workspace now switches between map, full-canvas camera view, camera wall, compare, and path replay.

### [MISS-02] Camera View mode filling the full canvas ✅
When Camera View is active, the entire canvas area shows the selected camera's perspective.
This is different from the small inspector PIP (CameraFeedCanvas) — it's full screen.

### [MISS-03] Path replay animation with actor ✅
The reference shows a person figure walking through the scene.
Time is shown in the replay overlay and the actor animates along the authored path.

### [MISS-04] DORI quality overlays on camera view ✅
Camera View now renders DORI overlay insights for a critical zone with required-quality status framing,
current quality, best camera, distance, angle, and lighting context.

### [MISS-05] LIVE MODE overlay on camera view ✅
"LIVE MODE (Simulated) | Time: 8.4s | Path: Night Entry → Cash Counter | Speed: 1.0x"

### [MISS-06] Canvas overlays control bar ✅
"Overlays | DORI | Path | Zones | Timestamp | Grid | More | Back to Map View"

### [MISS-07] Camera Wall mode ✅
Adaptive multi-camera grid: selected-first, active-first, 1-6 feeds, plus 3D map overview and status counters
"Views" counter and feed sorting are store-backed rather than fixed to 4 panels

### [MISS-08] Enhanced Timeline with per-camera DORI quality ✅
The reference shows a detailed table with:
- TIMELINE (Path Replay) | EVENTS | QUALITY OVER TIME sub-tabs
- Full playback controls: << | pause | >> | time display 00:08.4 / 00:10.2 | speed 1.4x | Follow Actor checkbox
- Table rows: Time(s), Actor Position, CAM 1, CAM 2, Quality (Best), Event
- Each row shows DORI quality per camera as colored badges
- e.g., "4.3 | Behind Cupboard | NONE | DETECTION | DETECTION | Partially obscured"
Current code: replay controls, a path selector, event table, and quality-over-time panels are implemented. The row-level view is still a streamlined interpretation of the reference, but the missing debug-only stub has been replaced.

### [MISS-09] Inspector View tab showing DORI Overlay section ⚠️
In the reference, the right inspector (Camera 1 selected, View tab) shows:
- VIEW MODE: Normal | IR (B/W) | Low Light | Thermal
- VIEW OPTIONS: Show DORI Labels, Show Path Actor, Show Zones, Show Timestamp, Show Bounding Box (checkboxes)
- DORI OVERLAY (At Target): "OBSERVATION" / "62.5–125 PPM"
- TARGET INFO: Target Type, Distance, PPM (est.), Angle from center, Lighting
Current CameraFeedCanvas now exposes a DORI overlay card and local view-mode controls, but it still does not expose the full set of view-option toggles or a live target-actor overlay. That richer HUD lives in `camera_view`.

### [MISS-10] Scenario/Path panel showing full active scenario details ⚠️
Reference shows right panel with:
- "Active Scenario: Night Entry → Cash Counter" dropdown
- Edit Path / Play Path buttons
- Path Length: 10.2m / Est. Time: 8.5 sec
- Start / --- Path --- / End (Cash Counter) legend
- Path Visibility Timeline link
Current ScenarioPathPanel: active path selector is wired and `Edit Path` / `Play Path` now trigger
real mode transitions (map-path edit and replay timeline). Remaining gap is richer scenario-detail
presentation parity versus the reference screenshot.

---

## Current follow-up work

The reference-image feature set is now fully built. All major gaps are closed.
Remaining work is polish, novel algorithms, and V0.2 features:

1. Actor overlay in the camera feed POV itself is still missing; replay actor visibility exists in replay/map contexts only.
2. Camera wall performance still needs a real low-end GPU pass because the current layout uses multiple live canvases.
3. Compare mode is functional, but the shell could still use tighter visual polish and export affordances.
4. Global target-type switcher (per-zone switcher exists with 9 types).
5. Command bar not wired to simulation actions.
6. Privacy zone rendering not implemented.
7. Novel algorithms: Coverage Fragility Field, K-Robustness, Placement Oracle, Temporal Anomaly Detection.

---

## TypeScript stabilization session (2026-05-27)

The following issues were fixed to reach 0 typed errors (only pre-existing TS7006 implicit-any remain):

1. **`QUALITY_RANK` in `TimelineTab.tsx`** — Missing 7 OODPCVS 2025 levels added (scrutinize=11 … detection=1 … none=0).
2. **`formatPoint` in `TimelineTab.tsx`** — Extended to accept `[number, number] | null` (was `| undefined` only).
3. **`activePathResult?.timeline.length`** — Added optional chaining to guard possible null.
4. **`setFocusScenePointRequest` in `PathMap.tsx`** — Removed selector and call sites: the store action doesn't exist; the logic now just updates replay progress without the non-existent focus request.
5. **`pointOnPathAtProgress` in `MapLayers.tsx`** — Moved import from `./map-geometry` (doesn't export it) to `./path-quality` (correct source).
6. **`CompareView.tsx`** — Added `DeltaMetricsBar` component with 5 delta chips: Overall Coverage, Recognition Quality, Blind Spot (inverted), Camera Count, Critical Zones. Uses `SceneSnapshot.simulation` data for both snapshots. Renders below the side-by-side 3D panels.

212 tests passing, 0 failures, 5577 expect() calls across 34 files.
