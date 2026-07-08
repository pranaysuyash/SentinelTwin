# Camera Studio — Build Gap Analysis

**Updated:** 2026-07-08 (Compliance Reporting Suite D-330; Canonical Org Catalog D-329)
**Source of truth for spec:** `Docs/product/sentineltwin_camerastudio_fullcamerasuite_product_spec.md`
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
- View tab: has CameraFeedCanvas with a live POV feed, DORI overlay, path actor toggle, and failure-state artifacts ✅
- Failures tab: live failure simulation controls, counterfactual impact panel, and restore state ✅
- ObstructionInspector: position, rotation, dimensions, material, vision transmission ✅
- "Test Without This" button: wired to counterfactual simulation and delta metrics ✅
- NoSelection state ✅

### LeftPanel
- All 10 tool buttons (select, camera, obstruction, light, path, zone, door/window, wall, measure, comment) ✅
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

**[GAP-01] Tool actions — no canvas placement behavior** ✅ Resolved
The floor catcher in `WorkspaceCanvas.tsx` now handles click placement for camera,
obstruction, light, wall, zone, path, and door/window tools. The placement flow includes
raycast-to-floor snapping, wall snapping for doors/windows, draft wall drawing, and the
camera preset picker. The regression test now asserts the core placement handlers are
present in the workspace canvas source.

---

**[GAP-02] Camera Feed View not implemented** ✅ Resolved
The `view` tab now renders `CameraFeedCanvas` as a live inspector POV with:
- Timestamp overlay
- DORI quality label
- Night/IR/low-light/thermal visual states
- Noise/blur for dirty lens and failure-state artifacts
- Subject bounding box toggle
- "Lost / blocked" indicator
**Spec ref:** Section 12.2 (Single Camera View), section 10.1 View tab

---

**[GAP-03] Camera Wall mode not implemented** ✅ Resolved
The 4-panel camera wall is now implemented as a live mode with adaptive camera-feed grid,
map overview slot, and live/offline counters. The shell routes through the camera wall
workspace and the mode is covered by source-level regression tests.

---

**[GAP-04] Inspector Failures tab is a placeholder** ✅ Resolved
The failures tab now surfaces live failure simulation controls:
- Toggle camera offline
- Mark as dirty/blocked
- Reduce clarity/resolution
- Disable night mode
- Show impact: which zones lose coverage, which path segments lose visibility
**Spec ref:** Section 10.1 Failures tab, Section 17 (Redundancy / failure matrix)

---

**[GAP-05] "Test Without This Obstruction" button is disabled** ✅ Resolved
The obstruction inspector now runs a live counterfactual test:
- Temporarily sets obstruction visionTransmission to 1.0
- Re-runs simulation
- Shows delta metrics
- Restores the original state via clear test / revert preview
**Spec ref:** Section 10.2 (Obstruction inspector actions)

---

**[GAP-06] Assumptions panel not surfaced in UI** ✅ Resolved
The assumptions panel is now visible in the shell, editable from the bottom panel, and
reflected in report/workspace surfaces so the model posture is always apparent.

---

### P1 — Required for the full V0.1 product experience

**[GAP-07] Dedicated launcher scene browser remains partial**
TopBar already provides a canonical scene selector, and the launcher now adds a searchable project browser with selected-workspace actions, direct saved-scene resume shortcuts, launcher-side folder/tag/pin metadata management, and a source filter row.
It now also exposes duplicate/rename actions on the selected workspace card, so the launcher is no longer read-only once a project is selected.
The top-bar selector now mirrors duplicate/rename on each saved scene row, so the primary shell and launcher agree on workspace-management actions.
**Spec ref:** Section 4 (Top bar — Scene selector), section 20 (Reports/exports)
**Remaining:** Cross-device sync, shared project metadata, and multi-user project collaboration if the product grows beyond local storage.

---

**[GAP-08] No camera preset library**
Camera placement currently creates a hardcoded camera. There's no preset picker.
**Spec ref:** Section 14 (Camera preset library)
**Status:** Resolved in the live shell. The camera tool exposes a preset picker in-canvas, and View Settings now surfaces the preset library before placement so users can choose common camera specs up front.

---

**[GAP-09] No target-type switcher**
The requiredQuality in critical zones is fixed. There's no way to say
"test this setup for license plate recognition" vs "face identification."
**Status:** Resolved in the live shell. The top bar exposes a global target-type dropdown and the zone inspector still supports per-zone overrides, so the scene can now be retargeted from the shell or at the object level.
**Spec ref:** Section 15 (Target-type testing)

---

**[GAP-10] Redundancy / failure matrix not implemented**
No matrix view showing coverage outcome per zone per camera-failure scenario.
**Spec ref:** Section 17 (Redundancy / failure matrix)
**Status:** Resolved in the live shell and report exports. The matrix is present in the Redundancy drawer, the Security Outcome panel, and the report handoff/export surfaces, including per-camera criticality and vulnerable-zone summaries.

---

**[GAP-11] AI command bar not wired**
The spec describes a natural language command bar. A COMMAND tab never existed in the
bottom drawer, but the actual product shell now exposes a dedicated AI command bar and
an offline parser fallback for common natural-language scene edits when no API key is
configured.
**Status:** Resolved in the live shell. The command bar now supports slash commands and
deterministic offline actions for report, privacy, snapshot, view-mode, and common scene
manipulation flows.

---

**[GAP-12] Debug tab content unknown**
The DebugTab component now exposes live overlay-density controls, debug-overlay toggles,
auto-recompute, scene-graph stats, camera-failure chips, and layer visibility controls.
**Status:** Resolved in the live product. Remaining debug polish would be incremental, not a missing tab.

---

**[GAP-13] Path replay not interactive**
Path lines render but there's no play/pause/scrub animation.
The actor doesn't animate along the path. The visibility timeline doesn't update
as the path plays.
**Spec ref:** Section 11.3 (Timeline tab), section 12.2 (Path Replay mode)
**Status:** Resolved in the live product. PathReplayView now includes a play/pause playhead, speed presets, an animating actor, legalised replay waypoints, camera cones, and a quality-over-time scrub timeline.

---

**[GAP-14] Before/After comparison lacks visual diff**
BeforeAfterTab exists but its implementation is unknown. Likely shows metrics only.
**Spec ref:** Section 11.4, section 12.5 (Before/After Split View)
**Status:** Resolved in the live product. BeforeAfterTab now reuses the compare visual evidence pipeline for a side-by-side diff when available and includes a direct handoff into Compare View.

---

**[GAP-15] Coverage uncertainty not shown**
Simulation results are presented as hard numbers. No indication of assumption
sensitivity or confidence.
**Spec ref:** Section 19 (Assumptions and uncertainty), NOVEL_ALGORITHMS.md Algorithm 7
**Status:** Resolved in the live product surfaces. Fragility and k-robustness now appear in the metrics / report / report-lite surfaces, and the assumptions panel remains visible.
**Maintenance note:** Keep the legacy doc in sync if future product changes move these summaries again.

---

### P2 — Full Camera Suite features

**[GAP-16] No privacy zone rendering or enforcement**
PrivacyZoneNode is in the schema, the privacy_zones layer exists, but nothing renders
and no coverage warnings fire for cameras that cover privacy zones.
**Status:** Resolved in the live product. Privacy zones render in map/canvas/wall/replay views, the simulation emits privacy issues for visible restricted cells, and the Issues / Security Outcome / Report surfaces now expose them.

**[GAP-17] No mounting snap behavior**
The spec describes snapping cameras to walls, ceiling, poles. Currently camera position
is set via the inspector number inputs only.
**Status:** Resolved in the live product. The camera inspector now includes wall, ceiling, and pole snap actions that reposition the selected camera to a mount target, raise it to a realistic mount height, and re-aim it toward the room interior.

**[GAP-18] No camera comparison mode**
No way to compare two specific cameras' individual coverage contributions side by side.
**Status:** Resolved in the live compare workspace. CompareView now includes a camera comparison section that contrasts two cameras from the current scene using live simulation results, coverage, critical-zone counts, and DORI reach.

**[GAP-19] No light inspector** ✅ Resolved in the live product
SecurityLightNodes now open a LightInspector with editable position, range, brightness, type, status, and night-coverage controls.
The inspector also exposes the light's night-coverage contribution so the simulation impact is visible while editing.
**Status:** Resolved in the live inspector. LightInspector is present, editable, and covered by the inspector regression test.
**Status:** Resolved in the live inspector. LightInspector is present, editable, and covered by the inspector regression test.

**[GAP-20] Metrics tab content unknown**
MetricsTab component exists but not read. May show stale or incomplete metrics.
**Status:** Resolved in the live shell. MetricsTab renders the 7 core metric cards plus the optional Coverage Fragility card, all driven from simulationResult and prior snapshots.

**[GAP-21] Issues tab — fix actions not wired**
IssuesTab exists. Does each issue show "Apply Fix" / "Test Fix" buttons?
Based on the issues schema (severity, affectedZones, affectedCameras), this is possible.
Currently unknown if the buttons are functional.

**[GAP-22] No scene export UI**
`exportScene()` exists in the store and the top bar now exposes it through the scene dropdown.
**Status:** Resolved in the live shell. Scene JSON export is available alongside import and save actions.

**[GAP-23] No report export**
Report Lite now exposes Copy, Export Markdown, Export HTML, and Print actions directly in the handoff toolbar.
**Status:** Resolved in the live shell and enhanced with the Compliance Reporting Suite (D-330). Reports now support regulatory compliance templates (GDPR ICO/CNIL/BfDI, PCI DSS Section 9, BIPA/HIPAA) with automated policy-driven redaction (IPs, GPS, patrol routes, vulnerabilities).

**[GAP-24] No keyboard shortcuts active**
The spec lists keyboard shortcuts (V, C, B, L, P, Z, D, W, M, T, R, N, F, S).
**Status:** Resolved in the live shell. The shortcut handler now wires the visible tool
keys (V, C, B, L, P, Z, D, W, M, T), the single-key actions (R, N, F, S), and view keys 1–6.

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
- Verify GAP-02: CameraFeedCanvas — fix if stub

**Sprint 2 — Harden the simulation outputs**
- Novel Algorithm 6: Occlusion Blame Attribution
- Novel Algorithm 2: Blind Spot Topology
- GAP-12: Debug tab with all toggles from spec
- GAP-13: Path replay animation

**Sprint 3 — Professional tool surface**
- GAP-07: Scene selector + import JSON
- GAP-08: Camera preset library
- ~~GAP-10: Redundancy / failure matrix~~ — resolved in the live shell and report exports
- Novel Algorithm 4: Adversarial K-Robustness
- Novel Algorithm 1: Coverage Fragility Field

**Sprint 4 — Full Camera Suite**
- GAP-09: Target-type switcher
- GAP-11: Command bar (resolved — offline parser + AI command flow)
- GAP-16: Privacy zone rendering + coverage warning (resolved in the live product)
- ~~GAP-19: Light inspector~~ ✅ **DONE** (verified 2026-05-28) — LightInspector component added; name, position, brightness, type, status, range, delete all functional, plus a night-impact section for the light's simulation contribution

---

## Resolved Gaps

| Gap | Status | Date | Notes |
|-----|--------|------|-------|
| GAP-01 | ✅ Done | Prior session | ToolPlacementFloor click-to-place fully implemented |
| GAP-13 | ✅ Done | 2026-05-27 | PathReplayActor added to WorkspaceCanvas; TimelineTab Play/Pause/SkipBack wired; progress bar live |
| GAP-19 | ✅ Done | 2026-05-28 | LightInspector in InspectorPanel; all fields editable; delete button; night-impact toggle / summary |
| GAP-21 | ✅ Done | 2026-05-27 | IssuesTab Apply Fix buttons; rotate_camera and move_object recommendations apply via updateNode; camera chips clickable for selectNode |

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
- ~~GAP-09: Target-type switcher~~ — **RESOLVED**: The top bar now exposes a global default target-type dropdown, applies the choice to all current critical zones, and the manual critical-zone placement tool uses that same default when creating new zones.
- GAP-11: Command bar resolved to offline parser + AI flow
- GAP-16: Privacy zone rendering resolved in the live product

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
- GAP-09: Target-type switcher resolved globally via top-bar default + manual placement tool
- GAP-11: Command bar resolved to offline parser + AI flow
- GAP-16: Privacy zone rendering resolved in the live product
- Novel Algorithm 1: Coverage Fragility Field
- Novel Algorithm 3: Adversarial K-Robustness
- Novel Algorithm 4: Camera Placement Oracle
- Novel Algorithm 5: Temporal Security Profile Anomaly Detection

### Previously listed as NOT resolved — now RESOLVED (2026-05-27)
- ~~GAP-07: Scene selector / multiple scenes~~ — **RESOLVED**: TopBar has full dropdown with saved scenes, import/export JSON, save to localStorage, Ctrl+N/S/O shortcuts. SceneBuilderWizard wired via "New Scene..." button with template/blank/floor-plan creation.
- ~~GAP-08: Camera preset library~~ — **RESOLVED**: CameraPresetPicker.tsx with 4 presets (Indoor Dome, Bullet, PTZ, Fisheye 360) integrated into placement flow.
- ~~GAP-10: Redundancy failure matrix~~ — **RESOLVED**: RedundancyTab.tsx (411 lines) full camera-vs-zone matrix with SPOF sidebar. RedundancyMatrixPanel.tsx as alternative card view. Both wired into BottomPanel.
