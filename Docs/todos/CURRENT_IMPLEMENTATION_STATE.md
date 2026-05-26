# Current Implementation State — Camera Studio

**Updated:** 2026-05-26
**Source:** Direct code audit of apps/studio/src/
**Purpose:** Accurate baseline of what is actually built, tested, and rendering.
Use this instead of the earlier CAMERASTUDIO_GAP_ANALYSIS.md which was written
before the Phase 2 audit. This doc supersedes the gap analysis for "what exists."

---

## What is verified built and working

### Simulation engine (src/simulation/) — complete, tested
- `coverage.ts` — BVH-accelerated raycasting, DORI scoring, material penalties, lighting model ✅
- `coverage.ts` — trust-hardening updates now enforce camera `rangeM` gates before scoring, wire scene `pixelsPerMeter` assumptions into quality mapping, emit per-camera evaluation metadata (`cameraEvaluations`) and mark privacy/coverage-denominator cells for traceable KPIs ✅
- `adversarial-path.ts` — Dijkstra minimum-exposure pathfinding, full AdversarialPathResult output ✅
- `dori.ts` — PPM thresholds, quality ordering, quality comparators ✅
- `grid.ts` — floor sampling grid with walkability ✅
- `geometry.ts` — yaw/pitch direction vectors, polygon helpers ✅
- `path-analysis.ts` — path visibility over time ✅
- `simulate-studio.ts` — orchestrates full simulation run ✅
- `simulate-studio.ts` — zone quality uses target-height profiles, privacy coverage issues are surfaced, and all aggregate metrics are computed over non-privacy walkable cells for canonical coverage denominators ✅
- Confirmed performance: ~10.8ms average on 40×28 grid with 2 cameras — under 16ms target ✅
- Zero React/DOM imports confirmed ✅

### Schema (src/schema/security-scene.ts) — complete
- All Zod schemas + TypeScript types ✅
- All node types: Camera, ObstructionNode, SecurityLightNode, WallNode, DoorNode, WindowNode,
  CriticalZoneNode, PrivacyZoneNode, EntryPointNode, ScenarioPath ✅
- Full SimulationResult with coverageCells, criticalZoneResults, adversarialPath ✅
- SceneSnapshot schema ✅
- parseSecurityScene, safeParseSecurityScene, cloneSecurityScene utilities ✅

### Store (src/store/studio-store.ts) — complete
- Full Zustand store with all CRUD operations (addNode, updateNode, removeNode) ✅
- importScene / exportScene with Zod validation ✅
- Snapshots system with 4 pre-built demo snapshots ✅
- Layer visibility (11 layers) ✅
- Environment mode (day/dusk/night) ✅
- Active tool tracking ✅
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
- Night Mode, Camera Failure, Save Snapshot, Compare, Generate Report buttons (UI only, not wired) ❌
- Save Snapshot button is wired ✅

### WorkspaceCanvas — good 3D foundation, no view modes yet
- Instanced mesh heatmap ✅
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
- MiniMap in SVG (in LeftPanel) ✅
- NO view mode switching (Map / Camera View / Camera Wall / Path Replay) ❌
- NO path replay animation ❌
- NO actor animation ❌

### CameraFeedCanvas — working but minimal
- Renders R3F canvas from camera's perspective ✅
- Shows walls, obstructions, floor geometry ✅
- Night overlay (CSS filter) ✅
- Camera name + resolution label ✅
- Uses fixed Canvas with static camera position — does NOT update if camera moves ❌
- No DORI overlays on the feed ❌
- No actor/path actor in feed ❌
- No IR/thermal simulation effects ❌
- No dirty lens / noise effects ❌

### InspectorPanel — wired and working
- CameraInspector with 5 tabs ✅
- Properties: position XYZ inputs (wired to updateNode), yaw/pitch sliders (wired), FOV slider (wired), height ✅
- Status: on/off toggle (wired), night mode selector (wired), clarity selector (wired) ✅
- Analytics: coverage %, zone pass/fail, offline impact notes ✅
- View: CameraFeedCanvas (working but minimal — see above) ✅
- Failures: placeholder text only ❌ (says "Failure-mode controls stay scoped...")
- ObstructionInspector: position, rotation, dimensions, material (all wired to updateNode) ✅
- "Test Without This Obstruction" button: disabled, not implemented ❌
- Aim at Zone button: wired ✅
- Duplicate camera button: wired ✅
- Delete camera button: wired ✅

### LeftPanel — UI complete
- All 10 tool buttons with keyboard shortcut labels ✅
- Layer visibility toggles for all 11 layers (wired to toggleLayer) ✅
- MiniMap SVG with: coverage cells, zones, walls, paths, adversarial path, cameras ✅
- Tools are buttons only — clicking canvas doesn't place objects ❌ (all tools except select are UI-only)

### BottomPanel tabs — mostly complete

**MetricsTab** ✅
- 7 metric cards: coverage, critical zones, cameras, avg quality, worst area, recognition %, identification %
- DonutChart component for coverage and quality
- All values from simulationResult
- "+6% vs last run" is hardcoded placeholder ❌

**IssuesTab** ✅
- Severity icons and badges
- Affected zones / cameras displayed
- Recommendations list
- No "Apply Fix" / "Test Fix" action buttons ❌

**TimelineTab** — stub-level ❌
- Play/Pause buttons (not wired)
- Progress bar (static)
- Path results table (shows % visible, lost time, event badges)
- NO animation
- NO per-camera DORI quality per timestep
- NO actor animation
- Does NOT match the reference image

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
- Active path selector
- Path length, estimated time, visible % stats
- Coverage ribbon (colored segments showing DORI quality along path)
- SVG path map with walls, zones, path, start/end markers
- Edit Path / Play Path buttons (UI only, not wired) ❌

### BottomRow ✅ (more complete than expected)
- Snapshots panel with thumbnail cards + "New Snapshot" button
- Assumptions panel showing all SimulationAssumptions with "Edit Assumptions" button (UI only) ❌
- Report Summary panel with 4 bullet points (dynamic from simulation result)
- Environment panel (temperature, humidity, weather, lighting level — static per mode)

### StatusBar — exists (not read in detail)
### Demo scene — validated ✅
- small_retail_shop.json loads and validates
- Cupboard confirmed to occlude Camera 1 view of cash counter

---

## What the reference image (Image 2) shows that is NOT in the code

**Image 2: CameraView_TimelinePathReplay_Camera1InspectorViewtab.png**

This is the target design for what needs to be built next. Key missing pieces:

### [MISS-01] View mode tab bar above canvas ❌
The reference shows: Map View | Camera View (active) | Camera Wall | Path Replay
Current code: single WorkspaceCanvas with no mode switching.

### [MISS-02] Camera View mode filling the full canvas ❌
When Camera View is active, the entire canvas area shows the selected camera's perspective.
This is different from the small inspector PIP (CameraFeedCanvas) — it's full screen.

### [MISS-03] Path replay animation with actor ❌
The reference shows a person figure walking through the scene.
Time: 8.4s shown in the "LIVE MODE (Simulated)" overlay.
Current code: path lines render but no actor, no animation.

### [MISS-04] DORI quality overlays on camera view ❌
When Camera View is active and an actor is in view:
- Zone badge: "CASH COUNTER / RECOGNITION REQUIRED / FAILS"
- "Current Quality: OBSERVATION"
- "Best Camera: CAM 2"
- "Distance: 7.8m"

### [MISS-05] LIVE MODE overlay on camera view ❌
"LIVE MODE (Simulated) | Time: 8.4s | Path: Night Entry → Cash Counter | Speed: 1.0x"

### [MISS-06] Canvas overlays control bar ❌
"Overlays | DORI | Path | Zones | Timestamp | Grid | More | Back to Map View"

### [MISS-07] Camera Wall mode ❌
4-panel thumbnail grid: CAM 1, CAM 2, CAM 3, 3D MAP
"4 Views" dropdown button

### [MISS-08] Enhanced Timeline with per-camera DORI quality ❌
The reference shows a detailed table with:
- TIMELINE (Path Replay) | EVENTS | QUALITY OVER TIME sub-tabs
- Full playback controls: << | pause | >> | time display 00:08.4 / 00:10.2 | speed 1.4x | Follow Actor checkbox
- Table rows: Time(s), Actor Position, CAM 1, CAM 2, Quality (Best), Event
- Each row shows DORI quality per camera as colored badges
- e.g., "4.3 | Behind Cupboard | NONE | DETECTION | DETECTION | Partially obscured"
Current code: static table with % visible / lost time / event tags — fundamentally different.

### [MISS-09] Inspector View tab showing DORI Overlay section ❌
In the reference, the right inspector (Camera 1 selected, View tab) shows:
- VIEW MODE: Normal | IR (B/W) | Low Light | Thermal
- VIEW OPTIONS: Show DORI Labels, Show Path Actor, Show Zones, Show Timestamp, Show Bounding Box (checkboxes)
- DORI OVERLAY (At Target): "OBSERVATION" / "62.5–125 PPM"
- TARGET INFO: Target Type, Distance, PPM (est.), Angle from center, Lighting
Current CameraFeedCanvas: only shows camera name + resolution, no DORI data.

### [MISS-10] Scenario/Path panel showing full active scenario details ❌
Reference shows right panel with:
- "Active Scenario: Night Entry → Cash Counter" dropdown
- Edit Path / Play Path buttons
- Path Length: 10.2m / Est. Time: 8.5 sec
- Start / --- Path --- / End (Cash Counter) legend
- Path Visibility Timeline link
Current ScenarioPathPanel: similar but no active scenario selector, Play Path is UI-only.

---

## Action priority (from reference image analysis)

**Sprint 1 — Canvas view modes + path replay (enables the demo script)**
1. Add view mode tabs: Map View | Camera View | Camera Wall | Path Replay
2. Full-canvas Camera View rendering (separate R3F canvas or camera lock)
3. Path replay animation: actor moving along path over time (requestAnimationFrame or GSAP)
4. LIVE MODE overlay on Camera View with time/path/speed display

**Sprint 2 — Timeline overhaul + DORI on camera view**
5. Enhanced Timeline: playback controls, per-camera DORI quality table per timestep
6. DORI overlays on Camera View (zone badges, current quality, distance, PPM)
7. Inspector View tab: DORI Overlay section + VIEW MODE toggles (IR, Thermal, etc.)

**Sprint 3 — Camera Wall + complete canvas**
8. Camera Wall mode: 4-panel thumbnail grid
9. Canvas overlay controls bar (DORI/Path/Zones/Timestamp toggles)
10. Actor in camera feed view reacting to path replay

**Sprint 4 — Wiring remaining stubs**
11. Tool canvas placement (Camera, Obstruction, Light, Wall tools)
12. Failures tab content
13. "Test Without This Obstruction" button
14. Night Mode / Camera Failure / Camera Failure top bar buttons
