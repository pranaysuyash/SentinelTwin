You are right. After checking the attached UI design pack, previous conversations, and the repo state, the correction is:

**Do not make `PlatformHome_CommandCenter_RecentWorkspaceRiskOverview.png` the immediate root target.** That is marked as a **future full-app root concept**. The immediate root replacement is **`StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png`**, because the current product is still Studio-first / Camera Coverage Testbed-first. The design pack explicitly says the immediate priority is to “replace the current form-like root page with `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png`,” while `PlatformHome_CommandCenter_RecentWorkspaceRiskOverview.png` is “Future full-app root concept” for when projects/sites/reports portfolio management exists. 

Below is the full local task brief to give to an implementation agent.

---

# Full Task: Replace Current Root Launcher With Studio Dashboard Home and Align the Entire Camera Studio UI to the Design Pack

## 0. Ground truth

This is **not** a partial patch, not a small root-page tweak, not a cosmetic pass, and not only a “make homepage nicer” task.

This is the complete correction of the SentinelTwin Studio product surface based on:

* the earlier product conversations,
* the current repo state,
* the attached `SentinelTwin_UI_Design_Pack.md`,
* the current broken/form-like root launcher,
* the existing implemented Camera Studio screens,
* the intended V0.1 product hierarchy.

The project should feel like:

> **SentinelTwin Studio — a serious security simulation workspace where the Small Retail Shop demo is immediately visible, coverage risk is understandable, and users can jump into Coverage, Camera View, Camera Wall, Path Replay, Compare, Report, Scan, Import, or AI Draft flows without feeling like they are using a setup form.**

The current root problem is documented in the design pack as `CurrentRepoRootLauncher_FormProblem.png`: it has working flows, but it looks like a centered form/checklist, has no large scene preview, has no command-center feel, and makes all actions look like setup steps rather than studio operations. 

The immediate replacement target is `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png`, not the platform-wide command center. The platform command center is for later V1+ when multi-site/project/report management is real. 

---

## 1. Product hierarchy to implement now

### Immediate V0.1 hierarchy

```txt
/                    Studio Dashboard Home
/studio or ?studio=1  Full StudioShell workspace
```

Root `/` should show the **Studio Dashboard Home** focused on the current workspace, usually `Small Retail Shop Demo`.

It should not show:

```txt
Centered form launcher
Setup checklist
Product status checklist as the main content
Generic SaaS dashboard
Future platform portfolio dashboard
Only StudioShell with no home
```

### Future hierarchy, not now

```txt
/                    Platform Home / command center
/studio              Studio Dashboard Home
/studio/workspace    Full StudioShell workspace
```

This future hierarchy can be documented, but not forced into the current V0.1 implementation unless the repo already has real multi-project/site/report management.

The design pack explicitly marks the Platform Home as a future full-product homepage, while the Studio Dashboard Home is the immediate root replacement. 

---

## 2. Why this correction matters

Earlier repo review found that the app originally felt like only the Camera Coverage Testbed existed. The repo has since added dashboard/home work, but the current root still does not match the design target. The implementation state doc says the launcher was updated with scene work, workspace resume, scan, AI draft, project browser, and status surfaces , and current code renders `StudioDashboardHome` at root unless the user enters the studio or uses `?studio=1` . But the design pack says the current problem is still that the root looks like a form/checklist and must be replaced by the studio dashboard target. 

So the task is not “add a dashboard.” A dashboard already exists.

The task is:

> **Replace the wrong dashboard/form hybrid with the correct Studio Dashboard Home, preserve all working flows, and polish the full Camera Studio modes against the design system.**

---

## 3. Non-negotiable instruction for agents

Do not run mutating git commands.

Allowed read-only commands:

```bash
git status
git diff
git log
git branch -vv
git show
find
ls
cat
sed
grep
rg
bun test
bun run ...
npm run ...
```

Do not run:

```bash
git checkout
git reset
git restore
git clean
git add
git commit
git rebase
git merge
```

Make code changes through file editing only. Leave commit/branch operations to the user.

---

## 4. Primary implementation target: Studio Dashboard Home

### Target reference

Use:

```txt
StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png
```

Status in design pack:

```txt
Immediate root replacement target
```

Purpose:

```txt
Replaces the form-like root page with a studio dashboard focused on the currently loaded workspace.
```

The design pack says this screen should feel like:

```txt
Figma file browser + Blender splash + security command center
```

and it must keep:

```txt
Large scene preview
Right risk/status panel
Primary actions: Coverage, Camera Wall, Path Replay, Compare
Secondary actions: New Scene, Import JSON, Scan Site, AI Layout Draft
```



---

## 5. Root `/` required layout

Root `/` should open into a full-screen Studio Dashboard Home.

### 5.1 Top bar

Required left identity:

```txt
SentinelTwin Studio
Security Simulation Workspace
```

Required controls:

```txt
Workspace selector: Small Retail Shop Demo
Status: Up to date / Needs recompute / Running
Last run: Today, 10:31 AM
Environment mode: Day Mode / Night Mode / Dusk
Open Studio
Run Simulation
Import JSON
New Scene
```

Behavior:

* Workspace selector uses current scene / saved scenes.
* Status comes from `simulationDirty`, `simulationRunning`, and `simulationResult`.
* Last run comes from `SimulationResult.computedAt` when available.
* Environment mode comes from scene assumptions or store environment mode.
* `Open Studio` enters full `StudioShell`.
* `Run Simulation` runs existing deterministic simulation, stores result, and can enter coverage workspace.
* `Import JSON` opens existing file input/import flow.
* `New Scene` opens existing scene wizard.

Do not hardcode `Small Retail Shop Demo` except as fallback/demo seed.

---

### 5.2 Left Studio nav rail

Required sections:

```txt
STUDIO
- Home
- Projects
- Demo Sites
- Reports
- Docs
- Settings

WORKSPACE MODES
- Coverage
  Map & Analysis

- Camera View
  Single Camera

- Camera Wall
  Multi Camera

- Path Replay
  Route Analysis

- Compare
  Before / After

- Report Lite
  Quick Report
```

Required footer:

```txt
Studio User
Admin
```

Behavior:

* `Home` stays on Studio Dashboard Home.
* `Coverage` opens actual coverage/map workspace.
* `Camera View` opens actual camera view mode.
* `Camera Wall` opens actual camera wall mode.
* `Path Replay` opens actual path replay mode.
* `Compare` opens actual compare mode.
* `Report Lite` opens report mode/tab.
* Non-built sections like Docs/Settings can be disabled, preview, or simple placeholders, but must not break.

---

### 5.3 Central current workspace panel

Required header:

```txt
CURRENT WORKSPACE
Small Retail Shop Demo
10m × 7m · 5 Cameras · 1 Light · 5 Obstructions · 1 Critical Zone · 2 Paths
```

Required hero preview:

* large scene preview,
* coverage heatmap,
* camera cones,
* camera labels,
* critical zone,
* obstruction warning,
* route/path overlay,
* coverage legend,
* 2D/3D toggle,
* compass/north marker.

This can use SVG/2D scene preview if that is more reliable than a live 3D canvas.

The design pack explicitly says the large scene preview is what makes root feel like a real product. 

Required preview labels:

```txt
Cash Counter
Cupboard blocking Camera 1
Coverage (PPM)
250+ Identification
125–250 Recognition
62.5–125 Observation
25–62.5 Detection
<25 No Coverage
Obstructed
```

Use the canonical DORI/PPM color language from the design system. The design pack marks `DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png` as the critical design-system reference for colors, symbols, fills, line styles, and interaction states across canvas, minimap, timeline, and reports. 

---

### 5.4 Metric cards below preview

Required cards:

```txt
Coverage
68%
+6% vs last run

Critical Zones
0 / 1
Passing

Worst Quality
Detection
Cash Counter

Issues
4
Open

Redundancy
Fails
If CAM 1 offline

Last Run
Today, 10:31 AM
2m 14s
```

Behavior:

* Coverage uses `result.totalCoveragePct` if available.
* Critical zone count uses `result.criticalZoneResults`.
* Worst quality is computed from issue/zone/path result if available.
* Issues count uses `result.issues`.
* Redundancy uses available redundancy/camera failure data if available; otherwise use “Needs check” or “Not evaluated.”
* Last run uses simulation timestamp.

Do not display fake metric values if live values exist.

Fallback values are allowed only for canonical demo preview when simulation has not run yet.

---

### 5.5 Primary action cards

Required cards:

```txt
Open Coverage Workspace
Map & full analysis

Open Camera Wall
Multi-camera view

Open Path Replay
Route visibility over time

Compare Fixes
Before / after analysis
```

Behavior:

* Coverage opens map/coverage workspace.
* Camera Wall opens `wall` mode.
* Path Replay opens `replay` mode and timeline/path panel.
* Compare opens `compare` mode and before/after tab.

These are the hero actions. New/import/scan/AI draft are secondary on this screen.

---

### 5.6 Right Security Status panel

Required panel title:

```txt
SECURITY STATUS
```

Required section 1:

```txt
OUTCOME SUMMARY

Cash Counter
Recognition required
FAILS

Main Entry
Minimum requirement
DETECTION

Night Mode
Low light performance
WEAK

Overall Coverage
Acceptable
68%
```

Required section 2:

```txt
OPEN ISSUES (4)

CRITICAL
Cash Counter recognition requirement not met

HIGH
Cupboard blocking Camera 1 view

MEDIUM
Night visibility weak near cash counter

MEDIUM
No redundant camera for cash counter

See all issues & recommendations
```

Required section 3:

```txt
SIMULATION ASSUMPTIONS

DORI Model         Simplified PPM
Person Height      1.7 m
Lighting           Day Mode
Grid Resolution    0.25 m
Glass Handling     Standard

View all assumptions
```

Behavior:

* Outcome summary uses `SimulationResult` and `scene.criticalZones`.
* Open issues use `result.issues`.
* Assumptions use `scene.assumptions`.
* Buttons open issues tab / assumptions panel.

The right panel must be security-first, not generic status.

---

### 5.7 Bottom recent and quick-start dock

Required left area:

```txt
RECENT WORKSPACES
- Small Retail Shop Demo
  68% coverage
  4 issues
  Today, 10:31 AM

- Warehouse Bay A
  72% coverage
  2 issues
  Yesterday, 4:22 PM

- Apartment Lobby
  81% coverage
  1 issue
  May 26, 2:15 PM

- School Corridor
  65% coverage
  6 issues
  May 24, 11:05 AM
```

Required right area:

```txt
QUICK START

New Blank Scene
Start from scratch

Import Scene JSON
From file

Scan a Site
Upload site photos

AI Layout Draft
Generate layout
```

Behavior:

* Recent workspaces should use saved/demo workspaces from existing local store if available.
* Quick start cards open existing flows:

  * New Blank Scene → SceneBuilderWizard
  * Import Scene JSON → file input/import flow
  * Scan a Site → ScanSiteWizard
  * AI Layout Draft → AI layout modal
* Preserve all working flows from the current root problem screen; reframe them visually instead of deleting them.

---

### 5.8 Footer/status row

Required footer:

```txt
© 2026 SentinelTwin
Security Simulation Studio
v0.9.0
All systems operational
Give Feedback
Help
```

Use current version if available in package metadata; otherwise keep static.

---

## 6. What to do with Platform Home

Do not implement `PlatformHome_CommandCenter_RecentWorkspaceRiskOverview.png` as the immediate root unless explicitly asked later.

Keep it as a future concept.

Document it as:

```txt
Future V1+ Platform Home
Requires real multi-project / multi-site / report / activity model
Not the current V0.1 root target
```

The design pack says this concept shows broader app scope beyond Camera Studio and is correct for V1+, but “not immediate Studio root if product is still Studio-first.” 

---

## 7. Full StudioShell must remain intact

The full studio workspace is already the strongest part and must not regress.

The repo currently has a real deterministic simulation core: BVH raycasting, DORI scoring, material penalties, lighting model, door/window occlusion, path analysis, simulation orchestration, temporal profile, and tested schema/store surfaces.  

The full StudioShell must continue to support:

```txt
Coverage / Map View
Camera View
Camera Wall
Path Replay
Compare
Report
Inspector
Bottom tabs
Left tools/layers
MiniMap
PathMap / Scenario Path panel
Snapshots
Assumptions
Import/export
Scan wizard
AI layout draft
View settings/layout manager
```

The design pack maps these references to existing repo components like `StudioShell`, `TopBar`, `WorkspaceCanvas`, `DockLayout`, `LeftPanel`, `MiniMap`, `InspectorPanel`, `ScenarioPathPanel`, `BottomPanel`, `CameraViewMode`, `CameraWallView`, `PathReplayView`, `CompareView`, `MapCanvas`, and `PathMap`. 

---

## 8. Coverage Mode task

### Target references

Use these as primary targets:

```txt
CoverageMode_Metrics_Camera1Inspector.png
FullCameraSuiteCoverageMode_metrics_Camera1Inspector.png
```

The design pack marks `CoverageMode_Metrics_Camera1Inspector.png` as the cleaner V0.1 primary workspace and `FullCameraSuiteCoverageMode_metrics_Camera1Inspector.png` as the final main coverage target. 

### Required Coverage Mode behavior

Coverage workspace must show:

* central 3D shop scene,
* DORI/PPM heatmap,
* camera cones,
* camera labels,
* obstruction warning,
* critical zone pass/fail,
* path overlay,
* coverage legend,
* left tools/layers/minimap,
* right inspector,
* bottom metrics,
* scenario/path panel,
* snapshots,
* assumptions,
* report summary.

### Required top actions

```txt
Run Simulation
Night Mode
Camera Failure
Save Snapshot
Compare
Generate Report
```

These already exist in some form and must remain operational.

### Required bottom tabs

```txt
Metrics
Issues
Timeline
Before / After
Report Lite
Debug
```

At minimum, preserve current available tabs and align copy/layout to the design pack.

### Required metric cards

```txt
Overall Coverage
Critical Zones
Cameras
Average Quality
Worst Area Quality
Recognition Area
Identification Area
```

### Required inspector

For selected camera:

```txt
Camera 1
Active

Properties
View
Status
Analytics
Failures

Type
Mount
Position
Rotation
FOV
Resolution
Lens
Height
Night Mode
Image Clarity

Aim at Zone
Go To Camera View
Duplicate
Delete Camera
```

Do not degrade existing inspector wiring. The repo status says camera inspector properties, status, analytics, failures, obstruction controls, “Test Without This Obstruction,” Aim at Zone, duplicate, delete, and camera feed view are wired. 

---

## 9. Camera View Mode task

### Target reference

```txt
CameraViewMode_TimelinePathReplay_Camera1InspectorViewtab.png
```

The design pack marks this as the primary target for Camera View polish. 

### Required Camera View behavior

Camera View must feel like a simulated CCTV operator feed, not just another 3D view.

Required:

* large selected-camera POV,
* camera name/status badge,
* camera spec badge,
* timestamp,
* actor/person visible when replay path is active,
* bounding box around actor,
* DORI overlay card for target zone,
* current quality,
* best camera,
* distance,
* PPM estimate,
* angle from center,
* lighting condition,
* Normal / IR / Low Light / Thermal toggles,
* overlay toggles:

  * DORI labels,
  * path actor,
  * zones,
  * timestamp,
  * bounding box,
  * grid,
  * camera info,
  * dirty lens,
  * compression.

The repo status says Camera View already has full-canvas POV, HUD, DORI overlay, mode filters, overlay toggles, camera header navigation, back-to-map, and actor rendering.  This task is to polish it to match the design pack and ensure it is consistent.

### Required bottom area

In Camera View mode, bottom should include:

```txt
Timeline / Path Replay
Events
Quality Over Time
Camera Wall preview
Scenario / Path
```

The camera wall preview should show small feeds and map overview if available.

---

## 10. Camera Wall Mode task

### Target reference

```txt
CameraWallMode_Timeline_Camera1InspectorViewTab.png
```

This is in the design pack inventory as the primary Camera Wall polish target. 

### Required Camera Wall behavior

Camera Wall must feel like a security control-room multi-view.

Required:

* adaptive grid of camera feeds,
* selected/active feed highlighted,
* offline / dirty / blocked states,
* DORI badges per feed,
* synchronized replay time,
* optional 3D map overview tile,
* camera status summary,
* quick action to open selected camera view,
* quick action to run replay / timeline.

The repo status says Camera Wall mode already uses an adaptive live feed grid with selected-first/active-first ordering, 1–6 feeds plus a 3D map slot, and active/offline counters.  This should be polished, not rebuilt from scratch.

---

## 11. Path Replay Mode task

### Target reference

```txt
PathReplayMode_Timeline_Camera1Inspector.png
```

The design pack marks this as the primary target for Path Replay polish. 

### Required Path Replay behavior

Path Replay must be a detailed defensive route visibility analysis.

Required:

* active path selector,
* path length,
* estimated time,
* start time,
* edit path,
* play/pause,
* speed selector,
* large replay viewport,
* actor on route,
* path line,
* start/target cards,
* obstruction/lost annotations,
* DORI timeline,
* visibility timeline table,
* per-camera quality columns,
* combined quality column,
* event/notes column,
* key events panel,
* quality over time chart,
* path summary donut/card,
* recommendation highlights,
* camera inspector context.

Use defensive language:

```txt
coverage failure
lost behind shelf
recognition weak
route visibility
incident replay
hardening recommendation
```

Avoid evasion/bypass framing.

The earlier conversations made defensive incident replay one of the product hooks: show which cameras should have captured a route, how long the subject was visible, what quality was achieved, why coverage failed, and what fixes reduce risk. 

---

## 12. Compare Mode task

### Target reference

```txt
CompareMode_BeforeAfter_Camera1InspectorViewTab.png
```

The design pack marks this as primary target for Compare polish. 

### Required Compare behavior

Compare must show verified before/after simulation deltas.

Required:

* Scenario A selector,
* Scenario B selector,
* add scenario,
* side-by-side baseline/proposed canvases,
* baseline issue annotation,
* proposed fix annotation,
* path overlay on both,
* DORI heatmap on both,
* metric comparison cards:

  * overall coverage,
  * recognition coverage,
  * identification coverage,
  * critical zones covered,
  * average visible time on path,
  * worst segment quality,
* change list for Scenario B,
* scenario notes:

  * baseline issues,
  * proposed fix,
* quality-over-time chart,
* recommended next steps,
* Open Report,
* Apply Scenario B.

The repo status says Compare mode already renders side-by-side baseline/proposed 3D panels, delta cards, notes, quality trend, selectors, exports, and explicit snapshot pairs.  This should be polished to the design pack.

---

## 13. MiniMap task

### Target references

```txt
MiniMapComponent_States_CollapsedCompactExpanded.png
MiniMapComponent_ExpandedHoverState_DrawerNavigation.png
```

The design pack marks these as primary MiniMap references. 

### Required MiniMap role

MiniMap is not decorative. It is an always-visible navigation and spatial awareness tool.

Required states:

```txt
Collapsed
- icon only
- live status dot
- hover preview

Compact
- always visible in left panel
- 180–220px wide
- shows walls, FOV, heatmap, paths, zones, selected object

Expanded
- drawer/navigation panel
- 260–420px wide or full drawer
- layer toggles
- display options
- scale/north
- click/drag/zoom interactions
```

Required content:

* walls/boundaries,
* cameras,
* camera FOV,
* coverage heatmap,
* critical zones,
* privacy zones,
* paths,
* actor/current point,
* selected object,
* north marker,
* scale bar,
* fit button,
* 2D/top view toggle,
* recenter/focus button,
* zoom controls.

Required interactions:

```txt
Click empty space -> recenter/pan main 3D view
Click object -> select object
Ctrl/Cmd + click -> multi-select
Drag map -> pan
Scroll -> zoom
Fit -> frame entire scene
2D -> switch to top-down plan
Focus -> center selected object
```

The repo status says MiniMap already uses a shared 2D map system with projection/layers, zoom/fit, hover/selection sync, replay actor visibility, collapsed/compact/expanded states, layer controls, legend, scale, north, and map tokens.  This means this task should finish edge states and visual consistency, not create a separate MiniMap implementation.

---

## 14. PathMap task

### Target references

```txt
PathMapComponent_ScenarioPathPanel_RouteSummaryState.png
PathMapComponent_ReplayState_LiveActorVisibility.png
```

The design pack marks these as primary PathMap references. 

### Required PathMap distinction

PathMap is not the full Path Replay view.

PathMap is a compact route summary and current replay-state map inside the Scenario/Path panel.

Required summary state:

* active path name,
* route line quality-colored,
* start/end markers,
* actor/current marker if replay active,
* cameras seeing path,
* cameras not seeing path,
* critical target zone,
* lost/low-quality points,
* other paths faint,
* compact stats:

  * total path length,
  * total time,
  * visible time,
  * low-quality time,
  * lost time,
  * critical zone reached.

Required replay state:

* current actor position,
* current visibility state,
* current DORI quality,
* best camera,
* distance,
* next change,
* upcoming event,
* annotation of reason:

  * lost behind shelf,
  * observed by camera,
  * privacy zone violation,
  * target reached.

Required action:

```txt
Open Path Replay
```

This opens the full detailed replay surface.

---

## 15. Map visual language task

### Target reference

```txt
DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png
```

The design pack marks it as a critical design-system reference. 

### Required token system

Canonicalize visual tokens across:

```txt
WorkspaceCanvas
MiniMap
PathMap
Timeline
CameraView overlays
CameraWall badges
Compare mode
Reports
CoverageLegend
```

Required layers:

```txt
Architecture
- wall
- glass wall
- door closed
- door open
- window/glass
- window/glass+grill

Cameras
- active
- offline
- dirty/blocked
- FOV cone

Lighting
- light range

Obstructions
- solid
- glass/partial
- vegetation
- vehicle
- shelf/rack

Zones
- critical pass
- critical fail
- privacy zone
- soft/advisory zone
- restricted zone
- target/objective

Coverage heatmap
- no/lost
- detection
- observation
- recognition
- identification

Paths
- normal/planned
- replay/active
- visible segment
- low-quality segment
- lost segment

Special markers
- start
- end
- current actor
- lost point
- decision/branch
- point of interest

Selection and hover
- selected object
- hovered object
- selected locked
- multi-selected
```

Do not invent component-specific colors. The same meaning must use the same color and symbol everywhere.

---

## 16. Interaction state task

### Target reference

```txt
DesignSystem_MapInteractionStates_RefinedWireframeBoard.png
```

The design pack marks it as the primary interaction-state reference. 

### Required interaction states

Implement or verify:

```txt
Hover camera on minimap
Click camera selects it
Hover path segment shows quality
Click path segment opens details
Zoomed map state
No simulation yet state
No path yet state
Multiple paths state
Long/narrow scene adaptation
Non-rectangular critical zone
Privacy zone violation during replay
```

Required global interactions:

```txt
Hover object -> highlight + quick tooltip
Click object -> select + show details + center 3D
Click empty space -> recenter / pan 3D view
Drag map -> pan
Scroll wheel -> zoom
Double click -> zoom to fit
Right click/context -> create path/add zone if supported
Box select -> multi-select where supported
```

Required state transitions:

```txt
No simulation -> Run Simulation -> Results available
No path -> Create Path -> Path available
Hover segment -> quality shown
Click segment -> details panel opens
Replay -> actor/current point updates map
```

---

## 17. Scene creation / import / scan / AI draft task

Preserve current working flows, but place them correctly.

### Root dashboard quick start

```txt
New Blank Scene
Import Scene JSON
Scan a Site
AI Layout Draft
```

### Required behavior

New Blank Scene:

* Opens existing `SceneBuilderWizard`.
* Supports blank/template/floor-plan modes if available.
* Does not lose current scene without warning.

Import Scene JSON:

* Opens existing file input.
* Validates `SecurityScene`.
* Uses existing `importScene`.
* Shows import errors.

Scan a Site:

* Opens existing `ScanSiteWizard`.
* Copy must say “manual-assisted site photo intake” unless real AI segmentation/classification is wired.
* It can compile scan candidates into `SecurityScene` using existing scan-to-scene pipeline.

AI Layout Draft:

* Opens existing AI layout draft modal.
* Must disclose provider-backed vs heuristic fallback.
* Must warn if generated scene replaces current workspace.
* Must record provenance if current code supports it.

The repo status says scan-to-scene intake is built and visible, but is manual-assisted and intentionally does not claim AI perception.  Keep that honesty.

---

## 18. Product copy rules

Use this language consistently.

### Product names

```txt
SentinelTwin Studio
Security Simulation Workspace
Camera Coverage Testbed
```

### Mode labels

```txt
Coverage — Map & Analysis
Camera View — Single Camera
Camera Wall — Multi Camera
Path Replay — Route Analysis
Compare — Before / After
Report Lite — Quick Report
```

### Simulation language

Use:

```txt
estimated
simulated
coverage quality
recognition required
planning assumption
manual-assisted
verified by simulation
```

Avoid:

```txt
guaranteed identification
perfect scan
autonomous reconstruction
real CCTV verification
AI detected everything
criminal route
bypass cameras
avoid detection
```

The product brief says the app must be framed as authorized security audit/hardening and avoid bypass/evasion language. 

---

## 19. What must be removed or corrected

Remove or refactor the current root behavior that looks like:

```txt
Centered max-width card
Create/import/scan/open/AI cards as a setup grid
Workspace Resume as the main product surface
Guided Security Workflow checklist
Product Feature Status as a dominant section
```

Do not delete the underlying functionality. Reframe it into dashboard actions.

Correct these issues:

```txt
Root does not feel like a form.
Root has a large scene preview.
Root has a right risk/status panel.
Root makes Coverage/Camera Wall/Path Replay/Compare primary.
Root makes New/Import/Scan/AI secondary quick start.
Root uses current scene/simulation data.
Root no longer looks like a dev status checklist.
Root no longer buries the actual testbed.
```

---

## 20. Repo files/components to inspect

Start here:

```txt
apps/studio/src/app/page.tsx
apps/studio/src/components/launcher/StudioDashboardHome.tsx
apps/studio/src/components/layout/StudioShell.tsx
apps/studio/src/components/layout/TopBar.tsx
apps/studio/src/components/layout/LeftPanel.tsx
apps/studio/src/components/workspace/WorkspaceCanvas.tsx
apps/studio/src/components/camera/CameraViewMode.tsx
apps/studio/src/components/camera-wall/CameraWallView.tsx
apps/studio/src/components/replay/PathReplayView.tsx
apps/studio/src/components/compare/CompareView.tsx
apps/studio/src/components/minimap/MiniMap.tsx
apps/studio/src/components/path-map/PathMap.tsx
apps/studio/src/components/bottom-panel/BottomPanel.tsx
apps/studio/src/components/inspector/InspectorPanel.tsx
apps/studio/src/store/studio-store.ts
apps/studio/src/schema/security-scene.ts
apps/studio/src/simulation/simulate-studio.ts
apps/studio/src/lib/product-feature-status.ts
```

Existing root code already imports `StudioDashboardHome`, `SceneBuilderWizard`, `ScanSiteWizard`, AI draft helpers, feature status, provider selection, and `simulateStudio` . Reuse this wiring.

---

## 21. Suggested component architecture

Do not keep everything inside one giant hybrid component.

Recommended split:

```txt
components/launcher/StudioDashboardHome.tsx
components/launcher/StudioDashboardTopBar.tsx
components/launcher/StudioDashboardSidebar.tsx
components/launcher/CurrentWorkspaceHero.tsx
components/launcher/WorkspacePreviewMap.tsx
components/launcher/SecurityStatusPanel.tsx
components/launcher/WorkspaceMetricCards.tsx
components/launcher/StudioModeActionCards.tsx
components/launcher/RecentWorkspacesDock.tsx
components/launcher/QuickStartDock.tsx
components/launcher/StudioDashboardFooter.tsx
```

Shared map/preview primitives can live under:

```txt
components/shared-scene-preview/
components/map/
components/security-outcome/
```

Do not duplicate scene models.

Use `SecurityScene` and `SimulationResult`.

---

## 22. Testing requirements

Update tests to verify product behavior, not old source strings.

Current launcher dashboard tests assert many string literals inside `StudioDashboardHome.tsx`, including “Security Simulation Workspace,” “Scene Work,” “Current Workspace Preview,” “Project Browser,” “Scene Starter Gallery,” “Security Outcome,” and “Product feature status” . These tests should be replaced or updated to match the new root target.

### Required tests

Root dashboard tests:

```txt
Renders SentinelTwin Studio identity.
Renders Security Simulation Workspace subtitle.
Renders current workspace preview.
Renders security status panel.
Renders outcome summary.
Renders open issues.
Renders simulation assumptions.
Renders coverage/critical zones/worst quality/issues/redundancy/last run metrics.
Renders primary mode cards: Coverage, Camera Wall, Path Replay, Compare.
Renders quick start: New Blank Scene, Import Scene JSON, Scan a Site, AI Layout Draft.
```

Action wiring tests:

```txt
Open Studio calls full workspace launch.
Open Coverage Workspace sets coverage/map mode.
Open Camera Wall sets wall mode.
Open Path Replay sets replay mode.
Compare Fixes sets compare mode.
Run Simulation calls simulate/store update path.
Import JSON triggers file input flow.
New Scene opens wizard.
Scan a Site opens ScanSiteWizard.
AI Layout Draft opens AI draft modal.
```

Regression tests:

```txt
Existing simulation tests continue passing.
Existing schema/store tests continue passing.
Existing StudioShell mode tests continue passing.
Camera View / Wall / Replay / Compare routes still render.
```

Fix tests that use absolute local paths like:

```txt
/Users/pranay/Projects/SentinelTwin/...
```

Use repo-relative paths instead.

---

## 23. Documentation requirements

Update docs after implementation.

Required docs:

```txt
Docs/product/STUDIO_HOME_FLOW.md
Docs/todos/CURRENT_IMPLEMENTATION_STATE.md
```

`STUDIO_HOME_FLOW.md` should explain:

```txt
Current V0.1 root = Studio Dashboard Home
Full workspace = StudioShell
Platform Home = future V1+ concept
Current mode targets
Feature maturity:
- real
- preview
- planned
```

Update current implementation state to say:

```txt
Root no longer uses the form-like launcher.
Root uses StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel target.
PlatformHome_CommandCenter is retained as future V1+ product concept.
```

---

## 24. Acceptance criteria

This task is complete only when:

```txt
1. http://localhost:3000/ renders without Internal Server Error.

2. Root / shows Studio Dashboard Home, not the centered form/checklist launcher.

3. Root has:
   - SentinelTwin Studio identity
   - left studio nav
   - top workspace controls
   - large current workspace preview
   - right security status panel
   - metric cards
   - primary mode action cards
   - recent workspaces
   - quick start
   - footer/status row

4. Current workspace preview clearly shows:
   - scene layout
   - heatmap
   - camera cones
   - critical zone
   - obstruction warning
   - path
   - DORI/PPM legend

5. Primary actions open real existing modes:
   - Coverage
   - Camera Wall
   - Path Replay
   - Compare
   - Report Lite

6. Quick start actions preserve existing flows:
   - New scene
   - Import JSON
   - Scan site
   - AI layout draft

7. Root metrics use real scene/simulation data when available.

8. Demo fallback values are used only when no live data exists.

9. The root does not overclaim AI scan, segmentation, video verification, or platform portfolio features.

10. Full StudioShell still works.

11. Coverage Mode aligns with CoverageMode / FullCameraSuite references.

12. Camera View aligns with CameraView reference.

13. Camera Wall aligns with CameraWall reference.

14. Path Replay aligns with PathReplay reference.

15. Compare aligns with Compare reference.

16. MiniMap and PathMap use canonical states and visual language.

17. Tests are updated.

18. Docs are updated.

19. No working repo functionality is removed just to match a mockup.

20. The final product no longer feels like “we are stuck on a form launcher or only camera testbed.” It feels like a working Studio product whose core module is the Camera Coverage Testbed.
```

---

## 25. Implementation order

Follow this order.

### Phase 1 — Stabilize root

```txt
1. Run app locally.
2. Fix Internal Server Error.
3. Identify whether error is from app/page.tsx, StudioDashboardHome, hydration, use(searchParams), browser-only API, saved scene seeding, or bad import.
4. Verify / renders.
5. Verify ?studio=1 renders StudioShell.
```

### Phase 2 — Replace root form with Studio Dashboard Home

```txt
1. Refactor StudioDashboardHome into the target layout.
2. Add/extract top bar, sidebar, current workspace hero, status panel, metrics, action cards, recent workspaces, quick start, footer.
3. Preserve all existing modal/action wiring.
4. Use current scene/simulation data.
5. Remove or demote Product Feature Status and Guided Workflow checklist from root.
```

### Phase 3 — Scene preview

```txt
1. Build or refine WorkspacePreviewMap.
2. Render scene boundaries, walls, cameras, FOV cones, heatmap cells, zones, obstructions, path.
3. Add DORI/PPM legend.
4. Add 2D/3D toggle UI.
5. Add compass/north indicator.
```

### Phase 4 — Mode action wiring

```txt
1. Coverage action -> map/coverage workspace.
2. Camera Wall -> wall mode.
3. Path Replay -> replay mode.
4. Compare -> compare mode.
5. Report -> report mode/tab.
6. Issues -> issues tab.
7. Assumptions -> assumptions panel/tab.
```

### Phase 5 — Polish main Studio modes

```txt
1. Coverage Mode.
2. Camera View.
3. Camera Wall.
4. Path Replay.
5. Compare.
6. Report Lite.
```

Use the design pack references as targets, but preserve implemented behavior.

### Phase 6 — MiniMap / PathMap / tokens

```txt
1. Canonicalize map tokens.
2. Align MiniMap states.
3. Align PathMap summary/replay states.
4. Align interaction states.
5. Ensure same colors/symbols across canvas, minimap, pathmap, timeline, report.
```

### Phase 7 — Tests and docs

```txt
1. Update launcher tests.
2. Add dashboard behavior tests.
3. Update StudioShell mode tests if needed.
4. Run simulation tests.
5. Update docs.
```

---

## 26. Final note for the implementation agent

The correct immediate product answer is:

```txt
Studio-first root.
Current workspace preview first.
Security status always visible.
Coverage/replay/compare actions primary.
Create/import/scan/AI secondary.
Platform command center later.
```

Do not turn this into a generic SaaS dashboard. Do not keep the current form-like launcher. Do not overbuild future platform management. Do not regress the working StudioShell.

The goal is to make the current repo feel like the attached design pack’s SentinelTwin Studio: a professional security simulation workspace with the Camera Coverage Testbed as the hero, not a pile of disconnected panels or a setup checklist.
