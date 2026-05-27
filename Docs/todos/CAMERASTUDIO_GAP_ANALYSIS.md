# Camera Studio — Build Gap Analysis

**Updated:** 2026-05-25
**Source of truth for spec:** `sentineltwin_camerastudio_fullcamerasuite_product_spec.md`
**Source of truth for current state:** `apps/studio/src/`

This document maps every spec requirement against what is actually built.
Agents should read this before any implementation work.

---

## What is built and solid

These are implemented, tested in structure, and rendering correctly:

### Core simulation (apps/studio/src/simulation/)
- `coverage.ts` — BVH-accelerated raycasting, material penalties, lighting model, DORI scoring ✅
- `adversarial-path.ts` — Dijkstra minimum-exposure pathfinding ✅
- `dori.ts` — PPM thresholds, quality ordering, quality math ✅
- `grid.ts` — floor sampling grid with walkability ✅
- `geometry.ts` — yaw/pitch direction, polygon helpers ✅
- `path-analysis.ts` — path visibility over time ✅
- `simulate-studio.ts` — orchestrates full simulation run ✅

### Schema (apps/studio/src/schema/security-scene.ts)
- Full Zod schema for all node types ✅
- CameraNode, ObstructionNode, SecurityLightNode, WallNode, DoorNode, WindowNode ✅
- CriticalZoneNode, PrivacyZoneNode, EntryPointNode, ScenarioPath ✅
- SimulationResult with adversarialPath, coverageCells, criticalZoneResults ✅
- SceneSnapshot schema ✅
- All types exported ✅

### Store (apps/studio/src/store/)
- `studio-store.ts` — Zustand store with all CRUD, import/export, snapshots ✅
- `scene-store.ts` — exists (likely secondary store)
- Layer visibility system ✅
- Environment mode (day/dusk/night) ✅
- Active tool tracking ✅
- Snapshot system with demo snapshots ✅

### WorkspaceCanvas
- InstancedMesh heatmap (correct approach, no z-fighting workaround needed) ✅
- Camera frustum cones ✅
- Camera markers with labels, status indicators ✅
- Wall segments with glass material handling ✅
- Obstruction boxes with selection highlight ✅
- Decorative shelving ✅
- Critical zone overlays with pass/fail badges ✅
- Obstruction warning labels ✅
- Path lines (dashed, with start/end markers) ✅
- Adversarial path (red dashed line) ✅
- Entry door label ✅
- Ceiling light markers ✅
- Environment themes (day/dusk/night) ✅
- Orbit controls with appropriate constraints ✅
- NorthCompass, ViewControls, ControlHintBar ✅
- MiniMap in SVG (in LeftPanel) ✅

### InspectorPanel
- CameraInspector with 5 tabs ✅
- Properties tab: spec info, position XYZ, yaw/pitch sliders, FOV, height ✅
- Status tab: on/off toggle, night mode, clarity, PTZ, thermal ✅
- Analytics tab: coverage %, zone pass/fail, offline impact notes ✅
- View tab: has CameraFeedCanvas (unknown implementation state — see gaps) 🔶
- Failures tab: placeholder text only ❌
- ObstructionInspector: position, rotation, dimensions, material, vision transmission ✅
- "Test Without This" button: disabled, not implemented ❌
- NoSelection state ✅

### LeftPanel
- All 10 tool buttons (select, camera, obstruction, light, path, zone, door/window, wall, measure, comment) ✅ (UI only)
- Layer visibility toggles for all 11 layers ✅
- MiniMap with coverage cells, zones, walls, paths, adversarial path, cameras ✅

### BottomPanel
- All 6 tabs present: metrics, issues, timeline, beforeafter, report, debug ✅
- Actual tab content: need to verify each (not read yet) 🔶

### Demo Scene
- `small-retail-shop.json` ✅
- `small-retail-shop.ts` ✅
- Scene loads correctly ✅

### Shell and layout
- StudioShell with correct panel layout ✅
- TopBar (not read, assumed present) 🔶
- StatusBar (not read, assumed present) 🔶
- BottomRow (not read, assumed present) 🔶
- ScenarioPathPanel (not read, assumed present) 🔶

---

## What is MISSING or INCOMPLETE

Ordered by priority based on spec and DEMO_SCRIPT.md.

---

### P0 — Required for basic demo completeness

**[GAP-01] Tool actions — no canvas placement behavior**
All tool buttons exist but only `select` (click on object) works.
Clicking the canvas with Camera tool active does not place a camera.
Clicking with Obstruction tool active does not place an obstruction.
This means the planner cannot build a scene interactively.
**Spec ref:** Section 5 (Tool list), section 9 (Canvas controls — transform handles)
**Needed:**
- Raycaster against floor plane for canvas click
- Camera placement handler: click → place CameraNode at hit position
- Obstruction placement handler: click → place ObstructionNode with preset type
- Light placement handler
- Wall drawing handler (click-drag for wall segments)

---

**[GAP-02] Camera Feed View not implemented**
The `view` tab in the inspector says "CameraFeedCanvas" exists. Unknown if it renders
an actual second R3F canvas locked to the camera's perspective.
The spec describes a separate Canvas per camera, with:
- Timestamp overlay
- DORI quality label
- Night/IR grayscale effect
- Noise/blur for dirty lens
- Subject bounding box
- "Lost / blocked" indicator
**Spec ref:** Section 12.2 (Single Camera View), section 10.1 View tab
**Status:** Unknown/likely stub. Must verify.

---

**[GAP-03] Camera Wall mode not implemented**
The 4-panel camera wall (2×2 grid of camera feeds + main map) is not in the canvas.
**Spec ref:** Section 12.3 (Camera Wall), section 7.10 (Camera Feed View)
**Needed:** Mode toggle that replaces main canvas with camera wall layout.

---

**[GAP-04] Inspector Failures tab is a placeholder**
The failures tab shows static text. It should show:
- Toggle camera offline
- Mark as dirty/blocked
- Reduce clarity/resolution
- Disable night mode
- Show impact: which zones lose coverage, which path segments lose visibility
**Spec ref:** Section 10.1 Failures tab, Section 17 (Redundancy / failure matrix)

---

**[GAP-05] "Test Without This Obstruction" button is disabled**
This is a critical counterfactual action. Should:
- Temporarily set obstruction visionTransmission = 1.0
- Re-run simulation
- Show delta
- Revert to original state
**Spec ref:** Section 10.2 (Obstruction inspector actions)

---

**[GAP-06] Assumptions panel not surfaced in UI**
The `simulationAssumptions` is in the schema and store but not visible to the user.
The spec is explicit: assumptions must always be visible (section 19).
Every result should cite its assumptions.
**Needed:** Collapsible assumptions panel, accessible from canvas or bottom panel.

---

### P1 — Required for the full V0.1 product experience

**[GAP-07] No scene selector / multiple scenes**
Only the small retail shop demo loads. There's no way to load other demo scenes,
create a blank scene, or import a SecurityScene JSON from a file.
**Spec ref:** Section 4 (Top bar — Scene selector), section 20 (Reports/exports)
**Needed:** Scene dropdown in top bar, import JSON from file, new blank scene.

---

**[GAP-08] No camera preset library**
Camera placement currently creates a hardcoded camera. There's no preset picker.
**Spec ref:** Section 14 (Camera preset library)
**Needed:** When placing a camera, show a preset picker: "2MP Indoor Dome", "4MP Wide
Dome", etc. Each preset fills in the camera spec fields automatically.

---

**[GAP-09] No target-type switcher**
The requiredQuality in critical zones is fixed. There's no way to say
"test this setup for license plate recognition" vs "face identification."
**Spec ref:** Section 15 (Target-type testing)
**Needed:** Target type dropdown (person detection, face recognition, vehicle detection,
license plate, etc.) that updates the PPM thresholds and report language accordingly.

---

**[GAP-10] Redundancy / failure matrix not implemented**
No matrix view showing coverage outcome per zone per camera-failure scenario.
**Spec ref:** Section 17 (Redundancy / failure matrix)
**Needed:** Table: rows = critical zones, columns = normal/cam1-off/cam2-off/night/etc.

---

**[GAP-11] AI command bar not wired**
The spec describes a natural language command bar. A COMMAND tab appears in the
BottomPanel tab list definition... wait — checking the actual tab list in BottomPanel.tsx:
The tabs are: metrics, issues, timeline, beforeafter, report, debug.
No command tab. The command functionality is completely absent.
**Spec ref:** Section 11.7 (Command tab), section 16 (Natural language commands)
**Needed:** A command input in the bottom panel or top bar. Commands parse to
structured ScenePatch operations. AI layer not needed for V0.1 — can use structured
dropdown commands first.

---

**[GAP-12] Debug tab content unknown**
The DebugTab component exists but its content isn't read. May be stub.
**Spec ref:** Section 11.6 (Debug tab), section 19 (Debug/developer mode)
**Needed:** Toggles for coverage grid, raycasts, vision colliders, physics colliders,
recompute time, BVH rebuild stats.

---

**[GAP-13] Path replay not interactive**
Path lines render but there's no play/pause/scrub animation.
The actor doesn't animate along the path. The visibility timeline doesn't update
as the path plays.
**Spec ref:** Section 11.3 (Timeline tab), section 12.2 (Path Replay mode)
**Needed:** GSAP or requestAnimationFrame timeline. Actor sphere moving along path.
Per-camera quality updating as actor moves. Scrub bar in timeline tab.

---

**[GAP-14] Before/After comparison lacks visual diff**
BeforeAfterTab exists but its implementation is unknown. Likely shows metrics only.
**Spec ref:** Section 11.4, section 12.5 (Before/After Split View)
**Needed:** Side-by-side canvas showing baseline vs fix. Delta metrics table.

---

**[GAP-15] Coverage uncertainty not shown**
Simulation results are presented as hard numbers. No indication of assumption
sensitivity or confidence.
**Spec ref:** Section 19 (Assumptions and uncertainty), NOVEL_ALGORITHMS.md Algorithm 7
**Needed:** Fragility indicators on zone results. "Passes by X%" shown prominently.
Assumptions panel always accessible.

---

### P2 — Full Camera Suite features

**[GAP-16] No privacy zone rendering or enforcement**
PrivacyZoneNode is in the schema, the privacy_zones layer exists, but nothing renders
and no coverage warnings fire for cameras that cover privacy zones.

**[GAP-17] No mounting snap behavior**
The spec describes snapping cameras to walls, ceiling, poles. Currently camera position
is set via the inspector number inputs only.

**[GAP-18] No camera comparison mode**
No way to compare two specific cameras' individual coverage contributions side by side.

**[GAP-19] No light inspector**
SecurityLightNodes exist but clicking a light doesn't open a light inspector.
The ObstructionInspector exists, CameraInspector exists, but no LightInspector.

**[GAP-20] Metrics tab content unknown**
MetricsTab component exists but not read. May show stale or incomplete metrics.
Must verify: does it show all the spec-required metrics cards?

**[GAP-21] Issues tab — fix actions not wired**
IssuesTab exists. Does each issue show "Apply Fix" / "Test Fix" buttons?
Based on the issues schema (severity, affectedZones, affectedCameras), this is possible.
Currently unknown if the buttons are functional.

**[GAP-22] No scene export UI**
`exportScene()` exists in the store. No UI button triggers it.

**[GAP-23] No report export**
Report Lite renders in a tab. No "Export Markdown" or "Copy" button wired.

**[GAP-24] No keyboard shortcuts active**
The spec lists keyboard shortcuts (V, C, B, L, P, Z, D, W, M, T, R, N, F, S).
None appear to be wired to actual handlers.

---

## Novel algorithms not yet built

See `Docs/exploration/NOVEL_ALGORITHMS.md` for full specifications.

Priority order for implementation:
1. Occlusion Blame Attribution (GAP closes failures tab + "why failed" question)
2. Blind Spot Topology Analysis (transforms blindspot % into actionable insight)
3. Adversarial K-Robustness (extends existing adversarial path, high novelty)
4. Coverage Fragility Field (makes heatmap honest, essential for evidence twin framing)
5. Camera Placement Oracle (answers "where should next camera go?")

---

## Recommended next implementation sequence

Based on spec priority, demo script requirements, and dependency order:

**Sprint 1 — Complete the core demo loop (DEMO_SCRIPT.md must work)**
- GAP-01: Canvas click placement for camera and obstruction tools
- GAP-04: Failures tab — camera offline toggle with recompute
- GAP-05: Test Without This Obstruction (single-click counterfactual)
- GAP-06: Assumptions panel (visible, editable)
- Verify GAP-02: CameraFeedCanvas — fix if stub

**Sprint 2 — Harden the simulation outputs**
- Novel Algorithm 6: Occlusion Blame Attribution
- Novel Algorithm 2: Blind Spot Topology
- GAP-12: Debug tab with all toggles from spec
- GAP-13: Path replay animation

**Sprint 3 — Professional tool surface**
- GAP-07: Scene selector + import JSON
- GAP-08: Camera preset library
- GAP-10: Redundancy / failure matrix
- Novel Algorithm 4: Adversarial K-Robustness
- Novel Algorithm 1: Coverage Fragility Field

**Sprint 4 — Full Camera Suite**
- GAP-03: Camera Wall mode
- GAP-09: Target-type switcher
- GAP-11: Command bar (structured commands first, AI later)
- GAP-16: Privacy zone rendering + coverage warning
- ~~GAP-19: Light inspector~~ ✅ **DONE** (2026-05-28) — LightInspector component added; name, position, brightness, type, status, range, delete all functional

---

## Resolved Gaps

| Gap | Status | Date | Notes |
|-----|--------|------|-------|
| GAP-01 | ✅ Done | Prior session | ToolPlacementFloor click-to-place fully implemented |
| GAP-13 | ✅ Done | 2026-05-28 | PathReplayActor added to WorkspaceCanvas; TimelineTab Play/Pause/SkipBack wired; progress bar live |
| GAP-19 | ✅ Done | 2026-05-28 | LightInspector in InspectorPanel; all fields editable; delete button |
| GAP-21 | ✅ Done | 2026-05-28 | IssuesTab Apply Fix buttons; rotate_camera and move_object recommendations apply via updateNode; camera chips clickable for selectNode |

---

## 2026-05-26 Update: Reference Screenshot UI Implementation

The following gaps have been resolved in this session:

| Gap | Status | Notes |
|-----|--------|-------|
| GAP-03 (Camera Wall mode) | ✅ Done | CameraWallView with adaptive grid (1-6 cameras), POV Canvas per feed, HUD overlays, OFFLINE state |
| GAP-02 (Camera Feed View) | ✅ Done | CameraViewMode full-screen POV, CameraFeedCanvas in inspector mini-feed |
| GAP-13 (Path replay) | ✅ Done (prev session + enhanced) | TimelineTab now has adversarial path event table + quality-over-time bars + stats strip |
| GAP-14 (Before/After comparison) | ✅ Done | BeforeAfterTab now has multi-metric donut comparison + quality distribution stacked bars |

### New capabilities added beyond gap closure
- **ViewModeBar context chip**: Shows selected camera name/path count/coverage% next to active mode tab
- **Auto bottom-tab switching**: Entering replay/camera_view auto-selects timeline; compare auto-selects beforeafter; map auto-selects metrics
- **Compare view**: Full side-by-side dual 3D heatmap with scenario selector bar
- **Inspector recommendation badge**: Properties tab shows count badge when simulation has recommendations for the selected camera
- **Inspector Recommended Next Steps**: Properties tab surfaces simulation recommendations at the bottom
- **scrollable bottom tab strip**: 8 tabs now scroll instead of overflow

### What is still NOT resolved (updated 2026-05-27)
- GAP-09: Target-type switcher (person/vehicle/face) not implemented globally (note: targetType IS editable per-zone in ZoneInspector, but not a global scene-level switcher)
- GAP-11: Command bar not wired to simulation actions
- GAP-16: Privacy zone rendering not implemented

### Previously listed as NOT resolved — now RESOLVED (2026-05-27)
- ~~GAP-08: Camera preset library~~ — **RESOLVED**: CameraPresetPicker.tsx with 4 presets integrated into placement flow.
- ~~GAP-10: Redundancy failure matrix~~ — **RESOLVED**: RedundancyTab.tsx (411 lines) full matrix + RedundancyMatrixPanel.tsx card view.

### Resolved in session 2026-05-26 (this session)
- ✅ GAP-04: Failures tab — full implementation: criticality score, offline/dirty lens/night toggles, zone redundancy map, path exposure count, restore button
- ✅ GAP-06: Assumptions panel — inline editable form with segmented controls and number inputs; `updateAssumptions` action added to store
- ✅ GAP-22: Scene export/import buttons wired in TopBar scene dropdown (Export JSON, Import JSON with file picker)
- ✅ NEW: CriticalZoneInspector — clicking a zone now shows a full inspector (target type, required quality, priority, night/redundancy flags, editable, covering cameras, gap explanation)
- ✅ NEW: "Open Report Lite" button in BottomRow report summary now routes to the report tab

---

## Session update: Build fix + Novel Algorithm 2 + GAP completions

### Resolved in current session

| Item | Status | Notes |
|------|--------|-------|
| Build errors (4 TypeScript failures) | ✅ Fixed | `scene-templates.ts` full rewrite with schema-correct helpers; `report/index.ts` ZoneResult/SecurityIssue field fixes; `floor-plan-import.ts` arg count fix |
| GAP-05: "Test Without This Obstruction" | ✅ Verified done | `runCounterfactual` in store, delta panel in ObstructionInspector, button wired |
| GAP-06: Assumptions panel surfaced in UI | ✅ Done | `AssumptionsTab` added to bottom panel with segmented controls for time-of-day, interior light, DORI standard, night penalty mode, and numeric fields. DORI standard switch auto-updates PPM thresholds. |
| Novel Algorithm 2: Blind Spot Topology | ✅ Done | `blind-spot-topology.ts` pure function; flood-fill BFS; `entry_corridor`/`entry_connected`/`isolated` classification; severity `critical`→`low`; wired into `simulate-studio.ts`; 7 unit tests pass |
| Blind regions in IssuesTab | ✅ Done | "Blind Spot Topology" section added after issues list showing severity badge, classification, area, cells count, and affected zone chips |

### Test count
- 128 tests pass (pre-session) → 135 tests pass (post-session)
- Build: clean, no TypeScript errors

### What is still NOT resolved
- GAP-09: Target-type switcher not implemented globally (per-zone IS editable in CriticalZoneInspector with 9 target types)
- GAP-11: Command bar not wired to simulation actions
- GAP-16: Privacy zone rendering not implemented
- Novel Algorithm 1: Coverage Fragility Field
- Novel Algorithm 3: Adversarial K-Robustness
- Novel Algorithm 4: Camera Placement Oracle
- Novel Algorithm 5: Temporal Security Profile Anomaly Detection

### Previously listed as NOT resolved — now RESOLVED (2026-05-27)
- ~~GAP-07: Scene selector / multiple scenes~~ — **RESOLVED**: TopBar has full dropdown with saved scenes, import/export JSON, save to localStorage, Ctrl+N/S/O shortcuts. SceneBuilderWizard wired via "New Scene..." button with template/blank/floor-plan creation.
- ~~GAP-08: Camera preset library~~ — **RESOLVED**: CameraPresetPicker.tsx with 4 presets (Indoor Dome, Bullet, PTZ, Fisheye 360) integrated into placement flow.
- ~~GAP-10: Redundancy failure matrix~~ — **RESOLVED**: RedundancyTab.tsx (411 lines) full camera-vs-zone matrix with SPOF sidebar. RedundancyMatrixPanel.tsx as alternative card view. Both wired into BottomPanel.
