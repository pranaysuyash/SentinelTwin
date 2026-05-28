# SentinelTwin UI Design Pack — Screens, Components, Briefs, and Implementation Notes

This document collects every UI image generated in the SentinelTwin design pass so agents can choose the relevant screen/component reference and map it cleanly to implementation.

## How agents should use this pack

- Treat **Primary target** images as implementation references.
- Treat **Deprecated / rejected** images as negative references or historical context only.
- Treat **Design System** boards as canonical cross-component rules.
- Do not remove working repo functionality to match a mockup. Evolve existing `StudioShell`, `DockLayout`, mode routing, `WorkspaceCanvas`, `MiniMap`, `PathMap`, and panels toward the targets.

## Immediate implementation priorities

1. Replace the current form-like root page with `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png`.
2. Polish the existing Coverage, Camera View, Camera Wall, Path Replay, and Compare modes against their target references.
3. Canonicalize `DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png` into design tokens and docs.
4. Use MiniMap/PathMap component boards to finish edge states and interactions.

## Image inventory

| # | Save-as filename | Status | Screen / Component | Purpose |
|---:|---|---|---|---|
| 1 | `Deprecated_InitialAIStyleDashboard_Rejected.png` | Deprecated / reference only | Initial AI SaaS Dashboard — rejected direction | Early visual exploration that looked too much like a generic AI SaaS dashboard. Keep only as a negative reference. |
| 2 | `Deprecated_ProjectConsole_NotV01Primary.png` | Deprecated as first screen / reference for later project console | Project Console — useful but not V0.1 primary | A more professional project console, but still not the right V0.1 first screen because Camera Studio should open directly into the testbed. |
| 3 | `CameraStudioWorkspace_MainCoverage_EarlyTarget.png` | Reference / superseded by later full-suite coverage designs | Camera Testbed Studio — early main workspace target | First correct direction: open directly into the camera testbed with Small Retail Shop loaded. |
| 4 | `FullCameraSuiteCoverageMode_metrics_Camera1Inspector_Concept.png` | Reference / coverage mode target | Full Camera Suite Coverage Mode — broad concept | Expanded camera suite coverage mode with many controls and panels visible. |
| 5 | `FullCameraSuiteCoverageMode_metrics_Camera1Inspector.png` | Primary target for Coverage Mode | Full Camera Suite Coverage Mode — final main coverage target | Primary V0.1 Camera Studio screen: coverage heatmap, DORI quality, camera cones, path, snapshots, assumptions, report summary. |
| 6 | `CoverageMode_Metrics_Camera1Inspector.png` | Primary target variant / cleaner coverage mode | Coverage Mode — cleaner V0.1 primary workspace | Cleaner V0.1 first workspace focused on coverage, metrics, and camera editing. |
| 7 | `CameraViewMode_TimelinePathReplay_Camera1InspectorViewtab.png` | Primary target for Camera View polish | Camera View Mode | Shows the simulated feed from a selected camera with DORI overlays, target info, and replay context. |
| 8 | `CameraWallMode_Timeline_Camera1InspectorViewTab.png` | Primary target for Camera Wall polish | Camera Wall Mode | Shows multiple simulated camera feeds at once to identify which cameras see the actor and which fail. |
| 9 | `PathReplayMode_Timeline_Camera1Inspector.png` | Primary target for Path Replay polish | Path Replay Mode | Detailed route visibility analysis over time: actor path, lost/visible moments, per-camera quality, and recommendations. |
| 10 | `CompareMode_BeforeAfter_Camera1InspectorViewTab.png` | Primary target for Compare polish | Compare / Before-After Mode | Compares baseline vs proposed fix with verified coverage, recognition, critical-zone, and path deltas. |
| 11 | `MiniMapComponent_DesignBoard_InitialStates.png` | Reference / superseded by refined MiniMap board | MiniMap — initial design board | Explores MiniMap role, purpose, compact size, hover preview and pinned preview. |
| 12 | `MiniMapComponent_States_CollapsedCompactExpanded.png` | Primary MiniMap state reference | MiniMap — collapsed, compact, expanded states | Defines MiniMap states: icon rail, compact always-visible map, expanded navigation panel, and hover behavior. |
| 13 | `MiniMapComponent_ExpandedHoverState_DrawerNavigation.png` | Primary expanded MiniMap reference | MiniMap — expanded / hover state | Defines expanded MiniMap as active navigation and selection tool. |
| 14 | `PathMapComponent_ScenarioPathPanel_RouteSummaryState.png` | Primary PathMap summary reference | PathMap — scenario/path panel state | Defines PathMap as compact route summary showing selected path, quality, cameras, lost/visible points and target zone. |
| 15 | `PathMapComponent_ReplayState_LiveActorVisibility.png` | Primary PathMap replay reference | PathMap — replay state | Defines how PathMap scrubs with time during replay and shows current visibility/DORI/camera state. |
| 16 | `DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png` | Critical design-system reference | Map Layer Visual Language | Canonical colors, symbols, fills, line styles and interaction states for all map/canvas/timeline/report surfaces. |
| 17 | `DesignSystem_MapInteractionStates_MiniMapPathMapWireframes.png` | Reference / superseded by refined board | Map interaction states — first wireframe board | Early state matrix for hover/click/zoom/empty/multipath/special geometry/privacy cases. |
| 18 | `DesignSystem_MapInteractionStates_RefinedWireframeBoard.png` | Primary interaction-state reference | Map interaction states — refined board | Defines global interaction behavior for MiniMap/PathMap hover, click, selection, zoom, missing-state, multi-path, geometry, privacy violation, and transitions. |
| 19 | `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png` | Immediate root replacement target | Studio Dashboard Home — current workspace preview | Replaces the form-like root page with a studio dashboard focused on the currently loaded workspace. |
| 20 | `PlatformHome_CommandCenter_RecentWorkspaceRiskOverview.png` | Future full-app root concept | Platform Home — command center for full product | Full finished-product homepage across projects, sites, scenes, reports, issues, recommendations and activity. |
| 21 | `CurrentRepoRootLauncher_FormProblem.png` | Current problem / replace | Current repo root launcher — problem reference | Screenshot of current root page that looks like a form/checklist instead of a studio dashboard. |

---

## 1. Initial AI SaaS Dashboard — rejected direction

![Initial AI SaaS Dashboard — rejected direction](images/Deprecated_InitialAIStyleDashboard_Rejected.png)

| Field | Value |
|---|---|
| Status | Deprecated / reference only |
| Screen | SentinelTwin Studio |
| Workspace preset | Launcher / early dashboard concept |
| Subscreen | AI SaaS style home |
| Active tab/panel | N/A |
| Selected component | New Project / Demo Cards |
| Dock state | Fixed sidebar + marketing dashboard |
| Purpose | Early visual exploration that looked too much like a generic AI SaaS dashboard. Keep only as a negative reference. |
| Save as | `Deprecated_InitialAIStyleDashboard_Rejected.png` |
| Feel target | Rejected. Avoid this tone. |

### What is correct in the image

- Dark theme and basic product areas existed.
- Showed demo scenes and recent projects.

### What feels wrong / avoid

- Too AI-startup/landing-page-like.
- Large marketing hero copy dominated the page.
- Fake photoreal cards and generic feature badges made the product feel less serious.

### What must stay / implementation contract

- Do not use this as implementation target.

---

## 2. Project Console — useful but not V0.1 primary

![Project Console — useful but not V0.1 primary](images/Deprecated_ProjectConsole_NotV01Primary.png)

| Field | Value |
|---|---|
| Status | Deprecated as first screen / reference for later project console |
| Screen | SentinelTwin Studio |
| Workspace preset | Project Console |
| Subscreen | Project selection dashboard |
| Active tab/panel | Recent Projects |
| Selected component | Open Small Retail Shop Testbed |
| Dock state | Left project nav + central project cards + status panels |
| Purpose | A more professional project console, but still not the right V0.1 first screen because Camera Studio should open directly into the testbed. |
| Save as | `Deprecated_ProjectConsole_NotV01Primary.png` |
| Feel target | Figma file browser / project console, later. |

### What is correct in the image

- More utilitarian than the first SaaS dashboard.
- Recent projects, assumptions, and status panels are valid ideas.

### What feels wrong / avoid

- Still delays the user before the core testbed.
- Can feel like project administration rather than live simulation.

### What must stay / implementation contract

- Use later when real multi-project management exists.

---

## 3. Camera Testbed Studio — early main workspace target

![Camera Testbed Studio — early main workspace target](images/CameraStudioWorkspace_MainCoverage_EarlyTarget.png)

| Field | Value |
|---|---|
| Status | Reference / superseded by later full-suite coverage designs |
| Screen | SentinelTwin Studio |
| Workspace preset | Camera Coverage Testbed |
| Subscreen | Coverage Mode |
| Active tab/panel | Metrics |
| Selected component | Camera 1 Inspector |
| Dock state | Fixed left tools + right inspector + bottom metrics |
| Purpose | First correct direction: open directly into the camera testbed with Small Retail Shop loaded. |
| Save as | `CameraStudioWorkspace_MainCoverage_EarlyTarget.png` |
| Feel target | Operator workspace / security simulation studio. |

### What is correct in the image

- 3D shop scene is the hero.
- Camera cones, heatmap, critical zone, blocked cupboard, inspector, metrics, scenario path all visible.

### What feels wrong / avoid

- Panels are fully fixed and dense.
- Visual hierarchy still less refined than later images.

### What must stay / implementation contract

- Keep direct-to-studio concept.
- Keep Small Retail Shop as default V0.1 scene.

---

## 4. Full Camera Suite Coverage Mode — broad concept

![Full Camera Suite Coverage Mode — broad concept](images/FullCameraSuiteCoverageMode_metrics_Camera1Inspector_Concept.png)

| Field | Value |
|---|---|
| Status | Reference / coverage mode target |
| Screen | SentinelTwin Studio |
| Workspace preset | Full Camera Suite |
| Subscreen | Coverage Mode |
| Active tab/panel | Metrics |
| Selected component | Camera 1 Inspector |
| Dock state | Left tools/layers/minimap + center canvas + right inspector + bottom analytics |
| Purpose | Expanded camera suite coverage mode with many controls and panels visible. |
| Save as | `FullCameraSuiteCoverageMode_metrics_Camera1Inspector_Concept.png` |
| Feel target | Professional security planning/CAD workspace. |

### What is correct in the image

- Includes DORI/PPM legend, view options, layers, minimap, snapshots, assumptions, report summary.
- Good coverage of full Camera Studio feature set.

### What feels wrong / avoid

- Too many panels open at once for default state.
- Should move toward collapsible docks and workspace presets.

### What must stay / implementation contract

- Coverage legend must use DORI/security outcome labels.
- Camera inspector stays object-specific.

---

## 5. Full Camera Suite Coverage Mode — final main coverage target

![Full Camera Suite Coverage Mode — final main coverage target](images/FullCameraSuiteCoverageMode_metrics_Camera1Inspector.png)

| Field | Value |
|---|---|
| Status | Primary target for Coverage Mode |
| Screen | SentinelTwin Studio |
| Workspace preset | Coverage Workspace |
| Subscreen | Coverage Mode |
| Active tab/panel | Metrics |
| Selected component | Camera 1 Inspector |
| Dock state | Left dock expanded, right inspector expanded, bottom insights expanded |
| Purpose | Primary V0.1 Camera Studio screen: coverage heatmap, DORI quality, camera cones, path, snapshots, assumptions, report summary. |
| Save as | `FullCameraSuiteCoverageMode_metrics_Camera1Inspector.png` |
| Feel target | Figma/Blender canvas with Adobe-style panels. |

### What is correct in the image

- Strong central 3D scene with heatmap, camera FOV, path, critical zone and obstruction warning.
- Top bar actions are operational: Run Simulation, Night Mode, Camera Failure, Save Snapshot, Compare, Generate Report.
- Metrics and report summary make the simulation explainable.

### What feels wrong / avoid

- Default app should support collapsing panels to avoid canvas crowding.
- Environment panel can be secondary.

### What must stay / implementation contract

- Keep DORI/PPM legend.
- Keep assumptions visible.
- Keep report summary tied to verified simulation.

---

## 6. Coverage Mode — cleaner V0.1 primary workspace

![Coverage Mode — cleaner V0.1 primary workspace](images/CoverageMode_Metrics_Camera1Inspector.png)

| Field | Value |
|---|---|
| Status | Primary target variant / cleaner coverage mode |
| Screen | SentinelTwin Studio |
| Workspace preset | Coverage Workspace |
| Subscreen | Coverage Mode |
| Active tab/panel | Metrics |
| Selected component | Camera 1 Inspector |
| Dock state | Left dock expanded, right inspector expanded, bottom metrics drawer |
| Purpose | Cleaner V0.1 first workspace focused on coverage, metrics, and camera editing. |
| Save as | `CoverageMode_Metrics_Camera1Inspector.png` |
| Feel target | Serious simulation workstation. |

### What is correct in the image

- Less clutter than broad full-suite concept.
- Cash counter failure and cupboard obstruction are obvious.
- Scenario/path and metrics are still visible.

### What feels wrong / avoid

- Can still feel fixed-panel-heavy.
- Needs collapsible dock behavior in real implementation.

### What must stay / implementation contract

- Use this as the clearest Coverage Mode visual target.

---

## 7. Camera View Mode

![Camera View Mode](images/CameraViewMode_TimelinePathReplay_Camera1InspectorViewtab.png)

| Field | Value |
|---|---|
| Status | Primary target for Camera View polish |
| Screen | SentinelTwin Studio |
| Workspace preset | Camera View Workspace |
| Subscreen | Camera View Mode |
| Active tab/panel | Timeline / Path Replay |
| Selected component | Camera 1 Inspector — View tab |
| Dock state | Left tools/layers visible, right camera view inspector, bottom timeline/camera wall area |
| Purpose | Shows the simulated feed from a selected camera with DORI overlays, target info, and replay context. |
| Save as | `CameraViewMode_TimelinePathReplay_Camera1InspectorViewtab.png` |
| Feel target | CCTV operator monitor + simulation overlay. |

### What is correct in the image

- Large single-camera feed communicates what the camera actually sees.
- DORI target card, bounding box, timestamp, view toggles and timeline are right.
- Mini camera wall previews are helpful.

### What feels wrong / avoid

- The actual repo should make this full-canvas and less dependent on full side panels.
- DORI overlay should be current-time/target-aware, not only generic camera range.

### What must stay / implementation contract

- Keep Camera View distinct from inspector mini-feed.
- Keep Normal/IR/Low Light/Thermal modes.

---

## 8. Camera Wall Mode

![Camera Wall Mode](images/CameraWallMode_Timeline_Camera1InspectorViewTab.png)

| Field | Value |
|---|---|
| Status | Primary target for Camera Wall polish |
| Screen | SentinelTwin Studio |
| Workspace preset | Camera Wall Workspace |
| Subscreen | Camera Wall Mode |
| Active tab/panel | Timeline / Camera Status Summary |
| Selected component | Camera 1 Inspector — View tab |
| Dock state | Feed-first layout; side/bottom panels optional/floating |
| Purpose | Shows multiple simulated camera feeds at once to identify which cameras see the actor and which fail. |
| Save as | `CameraWallMode_Timeline_Camera1InspectorViewTab.png` |
| Feel target | Security control room / OBS multiview. |

### What is correct in the image

- Multi-feed grid, offline tile, DORI badges, map overview, status summary and quick actions are the right feature set.

### What feels wrong / avoid

- Generated version has too many fixed panels. Real app should prioritize feed area and use floating summaries.

### What must stay / implementation contract

- Keep adaptive feed grid and offline/dirty/blocked states.
- Keep synchronized replay time across feeds.

---

## 9. Path Replay Mode

![Path Replay Mode](images/PathReplayMode_Timeline_Camera1Inspector.png)

| Field | Value |
|---|---|
| Status | Primary target for Path Replay polish |
| Screen | SentinelTwin Studio |
| Workspace preset | Path Replay Workspace |
| Subscreen | Path Replay Mode |
| Active tab/panel | Timeline |
| Selected component | Camera 1 Inspector — View tab |
| Dock state | Replay-focused center, contextual right inspector, expanded timeline drawer |
| Purpose | Detailed route visibility analysis over time: actor path, lost/visible moments, per-camera quality, and recommendations. |
| Save as | `PathReplayMode_Timeline_Camera1Inspector.png` |
| Feel target | Adobe Premiere timeline + security incident analysis. |

### What is correct in the image

- Large replay viewport, actor, path, time scrubber, timeline table, quality chart and recommendations are right.

### What feels wrong / avoid

- Language must avoid evasion/bypass framing.
- Current-state annotations should be more prominent in implementation.

### What must stay / implementation contract

- Path Replay remains separate from ScenarioPathPanel.
- Use defensive incident/coverage replay language.

---

## 10. Compare / Before-After Mode

![Compare / Before-After Mode](images/CompareMode_BeforeAfter_Camera1InspectorViewTab.png)

| Field | Value |
|---|---|
| Status | Primary target for Compare polish |
| Screen | SentinelTwin Studio |
| Workspace preset | Compare Workspace |
| Subscreen | Before / After Scenario Compare |
| Active tab/panel | Compare |
| Selected component | Camera 1 Inspector — View tab |
| Dock state | Side-by-side compare canvas, right inspector/status, bottom delta metrics |
| Purpose | Compares baseline vs proposed fix with verified coverage, recognition, critical-zone, and path deltas. |
| Save as | `CompareMode_BeforeAfter_Camera1InspectorViewTab.png` |
| Feel target | Figma version compare + audit evidence. |

### What is correct in the image

- Scenario A/B side-by-side is clear.
- Metric deltas and quality-over-time graph are right.
- Apply Scenario B is the right action.

### What feels wrong / avoid

- Needs explicit “what changed” list and source of proposed fix.
- Avoid magic: show verified simulation deltas.

### What must stay / implementation contract

- Keep baseline/proposed split.
- Keep delta metrics prominent.

---

## 11. MiniMap — initial design board

![MiniMap — initial design board](images/MiniMapComponent_DesignBoard_InitialStates.png)

| Field | Value |
|---|---|
| Status | Reference / superseded by refined MiniMap board |
| Screen | SentinelTwin Component Design |
| Workspace preset | Left Panel / Dock System |
| Subscreen | MiniMap component states |
| Active tab/panel | Component Spec |
| Selected component | MiniMap |
| Dock state | Left dock compact/collapsed/expanded variants |
| Purpose | Explores MiniMap role, purpose, compact size, hover preview and pinned preview. |
| Save as | `MiniMapComponent_DesignBoard_InitialStates.png` |
| Feel target | Design-system explainer. |

### What is correct in the image

- MiniMap is framed as useful navigation, not passive status.
- Shows expected content: walls, FOV, heatmap, critical zone, selected object.

### What feels wrong / avoid

- Too presentation-like; refined board is cleaner for implementation.

### What must stay / implementation contract

- Keep answer: MiniMap is useful navigation map, not just tiny widget.

---

## 12. MiniMap — collapsed, compact, expanded states

![MiniMap — collapsed, compact, expanded states](images/MiniMapComponent_States_CollapsedCompactExpanded.png)

| Field | Value |
|---|---|
| Status | Primary MiniMap state reference |
| Screen | SentinelTwin Component Design |
| Workspace preset | Left Panel / Dock System |
| Subscreen | MiniMap Component States |
| Active tab/panel | Component Spec / MiniMap |
| Selected component | MiniMap — Collapsed, Compact, Expanded |
| Dock state | Left dock collapsed + compact + expanded variants |
| Purpose | Defines MiniMap states: icon rail, compact always-visible map, expanded navigation panel, and hover behavior. |
| Save as | `MiniMapComponent_States_CollapsedCompactExpanded.png` |
| Feel target | Figma navigator + GIS minimap. |

### What is correct in the image

- Clear sizing and state hierarchy.
- Shows compact MiniMap in Coverage, Camera View, and Path Replay contexts.
- Includes legend, behavior, details and design tokens.

### What feels wrong / avoid

- Implementation should not create multiple separate minimap components; use shared MapCanvas.

### What must stay / implementation contract

- Default compact when left dock expanded.
- Icon-only when dock collapsed.
- Expanded drawer for navigation/detail.

---

## 13. MiniMap — expanded / hover state

![MiniMap — expanded / hover state](images/MiniMapComponent_ExpandedHoverState_DrawerNavigation.png)

| Field | Value |
|---|---|
| Status | Primary expanded MiniMap reference |
| Screen | SentinelTwin Component Design |
| Workspace preset | Left Panel / Dock System |
| Subscreen | MiniMap Expanded / Hover State |
| Active tab/panel | Component Spec / MiniMap |
| Selected component | MiniMap — Expanded Drawer + Hover Preview |
| Dock state | Left dock supports collapsed icon, compact default, expanded drawer |
| Purpose | Defines expanded MiniMap as active navigation and selection tool. |
| Save as | `MiniMapComponent_ExpandedHoverState_DrawerNavigation.png` |
| Feel target | GIS navigation drawer. |

### What is correct in the image

- Layer toggles, object labels, fit, 2D top view, scale/north, behavior rules are right.
- Answers click behavior: empty map recenters, object click selects, ctrl/cmd multi-select.

### What feels wrong / avoid

- Should be drawer/panel, not modal by default.

### What must stay / implementation contract

- MiniMap is active navigation + selection tool.

---

## 14. PathMap — scenario/path panel state

![PathMap — scenario/path panel state](images/PathMapComponent_ScenarioPathPanel_RouteSummaryState.png)

| Field | Value |
|---|---|
| Status | Primary PathMap summary reference |
| Screen | SentinelTwin Component Design |
| Workspace preset | Scenario / Path Panel |
| Subscreen | PathMap — Scenario Summary State |
| Active tab/panel | Component Spec / PathMap |
| Selected component | PathMap inside Scenario / Path Panel |
| Dock state | Compact right/bottom scenario panel map |
| Purpose | Defines PathMap as compact route summary showing selected path, quality, cameras, lost/visible points and target zone. |
| Save as | `PathMapComponent_ScenarioPathPanel_RouteSummaryState.png` |
| Feel target | GIS route summary card. |

### What is correct in the image

- Clearly distinguishes route summary from detailed replay.
- Selected path, other paths, start/end, arrows, current actor, camera visibility and critical zone are shown.

### What feels wrong / avoid

- Do not make this full replay; detailed replay belongs in PathReplayView.

### What must stay / implementation contract

- PathMap default = route summary.
- Open Path Replay for detailed analysis.

---

## 15. PathMap — replay state

![PathMap — replay state](images/PathMapComponent_ReplayState_LiveActorVisibility.png)

| Field | Value |
|---|---|
| Status | Primary PathMap replay reference |
| Screen | SentinelTwin Component Design |
| Workspace preset | Scenario / Path Panel + Replay System |
| Subscreen | PathMap — Replay State |
| Active tab/panel | Component Spec / PathMap Replay |
| Selected component | PathMap with live actor position + current visibility state |
| Dock state | Component spec board showing replay behavior |
| Purpose | Defines how PathMap scrubs with time during replay and shows current visibility/DORI/camera state. |
| Save as | `PathMapComponent_ReplayState_LiveActorVisibility.png` |
| Feel target | Live route-state map. |

### What is correct in the image

- Actor dot, time marker, current state card, camera badges, lost/visible annotation and upcoming events are right.

### What feels wrong / avoid

- Do not turn it into full PathReplayView; keep it compact and synchronized.

### What must stay / implementation contract

- At a glance: where actor is, visibility state, best camera, DORI quality, upcoming lost/zone event, cause.

---

## 16. Map Layer Visual Language

![Map Layer Visual Language](images/DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png)

| Field | Value |
|---|---|
| Status | Critical design-system reference |
| Screen | SentinelTwin Design System |
| Workspace preset | Shared Visual Language / Design Board |
| Subscreen | Map Layer Visual Language |
| Active tab/panel | Design Spec / Layer Tokens |
| Selected component | Shared map/canvas/timeline/report symbols |
| Dock state | Standalone design board |
| Purpose | Canonical colors, symbols, fills, line styles and interaction states for all map/canvas/timeline/report surfaces. |
| Save as | `DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png` |
| Feel target | Design-system token board. |

### What is correct in the image

- Covers architecture, cameras, lights, obstructions, zones, coverage, paths, markers, selection/hover, legend.
- Explicitly prevents color chaos across MiniMap, PathMap, Canvas, Timeline and Reports.

### What feels wrong / avoid

- Must be reconciled with current code tokens in map-colors.ts.

### What must stay / implementation contract

- Use consistent tokens everywhere.
- Do not invent per-component colors.

---

## 17. Map interaction states — first wireframe board

![Map interaction states — first wireframe board](images/DesignSystem_MapInteractionStates_MiniMapPathMapWireframes.png)

| Field | Value |
|---|---|
| Status | Reference / superseded by refined board |
| Screen | SentinelTwin Design System |
| Workspace preset | Interaction States / Wireframe Board |
| Subscreen | MiniMap + PathMap Interaction States |
| Active tab/panel | Design Spec / Interaction Patterns |
| Selected component | Map Interaction States |
| Dock state | Standalone design board |
| Purpose | Early state matrix for hover/click/zoom/empty/multipath/special geometry/privacy cases. |
| Save as | `DesignSystem_MapInteractionStates_MiniMapPathMapWireframes.png` |
| Feel target | Wireframe implementation checklist. |

### What is correct in the image

- Covers the right states and behaviors.
- Good reference for edge-state coverage.

### What feels wrong / avoid

- Light board style is less aligned with dark app than refined board.

### What must stay / implementation contract

- Retain the state list and interaction rules.

---

## 18. Map interaction states — refined board

![Map interaction states — refined board](images/DesignSystem_MapInteractionStates_RefinedWireframeBoard.png)

| Field | Value |
|---|---|
| Status | Primary interaction-state reference |
| Screen | SentinelTwin Design System |
| Workspace preset | Interaction States / Wireframe Board |
| Subscreen | MiniMap + PathMap Interaction States — Refined Board |
| Active tab/panel | Design Spec / Interaction Patterns |
| Selected component | Map Interaction State Matrix |
| Dock state | Standalone design board |
| Purpose | Defines global interaction behavior for MiniMap/PathMap hover, click, selection, zoom, missing-state, multi-path, geometry, privacy violation, and transitions. |
| Save as | `DesignSystem_MapInteractionStates_RefinedWireframeBoard.png` |
| Feel target | Design-system state matrix. |

### What is correct in the image

- Includes global interactions, state transitions, quick DORI reference and notes.
- Clear enough for implementation handoff.

### What feels wrong / avoid

- Keep as reference; do not implement as one actual screen.

### What must stay / implementation contract

- Hover previews, click selects/details, empty-space recenters, drag pans, scroll zooms, double-click fits.

---

## 19. Studio Dashboard Home — current workspace preview

![Studio Dashboard Home — current workspace preview](images/StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png)

| Field | Value |
|---|---|
| Status | Immediate root replacement target |
| Screen | SentinelTwin Studio |
| Workspace preset | Studio Dashboard Home |
| Subscreen | Current Workspace Overview |
| Active tab/panel | Current Workspace Preview + Security Status |
| Selected component | Small Retail Shop Demo |
| Dock state | Dashboard layout: left nav, central preview, right risk panel, bottom recent/quick-start dock |
| Purpose | Replaces the form-like root page with a studio dashboard focused on the currently loaded workspace. |
| Save as | `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png` |
| Feel target | Figma file browser + Blender splash + security command center. |

### What is correct in the image

- Large scene preview makes root feel like product.
- Right risk/status panel is security-first.
- Primary actions open Coverage, Camera Wall, Path Replay, Compare.
- Creation/import/scan/AI draft are secondary.

### What feels wrong / avoid

- Avoid making it platform-wide too early. This is module-level Studio Home.

### What must stay / implementation contract

- Use as immediate replacement for current centered form root.

---

## 20. Platform Home — command center for full product

![Platform Home — command center for full product](images/PlatformHome_CommandCenter_RecentWorkspaceRiskOverview.png)

| Field | Value |
|---|---|
| Status | Future full-app root concept |
| Screen | SentinelTwin |
| Workspace preset | Platform Home / Security Command Center |
| Subscreen | Portfolio Overview + Recent Workspace |
| Active tab/panel | Recent Workspace Preview + Status & Insights |
| Selected component | Small Retail Shop Demo |
| Dock state | Platform-wide left nav, portfolio KPI row, recent workspace preview, insights panel, bottom recent/reports/activity |
| Purpose | Full finished-product homepage across projects, sites, scenes, reports, issues, recommendations and activity. |
| Save as | `PlatformHome_CommandCenter_RecentWorkspaceRiskOverview.png` |
| Feel target | Security simulation command center / portfolio dashboard. |

### What is correct in the image

- Shows broader app scope beyond Camera Studio.
- Portfolio KPIs, projects/sites/reports, platform activity and recent reports are correct for V1+.

### What feels wrong / avoid

- Too similar to StudioDashboardHome unless labels/scope are clearly separated. Not immediate root for current repo if product is still Studio-first.

### What must stay / implementation contract

- Use later when multi-site/project/report management exists.

---

## 21. Current repo root launcher — problem reference

![Current repo root launcher — problem reference](images/CurrentRepoRootLauncher_FormProblem.png)

| Field | Value |
|---|---|
| Status | Current problem / replace |
| Screen | SentinelTwin Studio root page |
| Workspace preset | Current implementation |
| Subscreen | Form-like launcher |
| Active tab/panel | Workspace Resume |
| Selected component | Create/Import, Scan, Open, AI Draft cards |
| Dock state | Centered max-width card with stacked sections |
| Purpose | Screenshot of current root page that looks like a form/checklist instead of a studio dashboard. |
| Save as | `CurrentRepoRootLauncher_FormProblem.png` |
| Feel target | Negative reference. Replace with StudioDashboardHome. |

### What is correct in the image

- Flows exist: create/import, scan, open current, AI layout, import JSON, saved scenes.
- Functionality should be preserved.

### What feels wrong / avoid

- Centered form card.
- Too much checklist/product-status content.
- No large scene preview or command-center feel.
- All actions look like setup steps rather than studio operations.

### What must stay / implementation contract

- Do not delete working flows; reframe them as dashboard actions.

---

# Repo mapping notes

Use these existing repo component names when mapping screens to implementation:

```txt
StudioShell
TopBar
ViewModeBar
WorkspaceCanvas
DockLayout
DockPanel
DockRail
LeftPanel
SceneTools
SceneLayers
MiniMap
ContextRightPanel
InspectorPanel
AssumptionsPanel
ScenarioPathPanel
BottomPanel
CameraViewMode
CameraWallView
PathReplayView
CompareMode / CompareView
CoverageLegend
CommandBar
MapCanvas
MapLayers
PathMap
```

## Screen/component mapping

| Design ref | Likely repo files/components | Notes |
|---|---|---|
| `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel.png` | `apps/studio/src/app/page.tsx` | Immediate root replacement target. Preserve current wizard/import/AI flows but restructure as dashboard. |
| `CoverageMode_Metrics_Camera1Inspector.png` | `StudioShell`, `WorkspaceCanvas`, `LeftPanel`, `InspectorPanel`, `BottomPanel`, `ScenarioPathPanel` | Primary Camera Studio coverage workspace. |
| `CameraViewMode_TimelinePathReplay_Camera1InspectorViewtab.png` | `CameraViewMode`, `CameraFeedCanvas`, `InspectorPanel`, `TimelineTab` | Needs current-time/actor-aware DORI overlay polish. |
| `CameraWallMode_Timeline_Camera1InspectorViewTab.png` | `CameraWallView`, `CameraFeedCanvas`, `CameraStatusSummaryPanel` | Feed-first full-canvas mode; use floating summaries. |
| `PathReplayMode_Timeline_Camera1Inspector.png` | `PathReplayView`, `TimelineTab`, `PathMap`, `CameraFeedCanvas` | Detailed route visibility analysis. |
| `CompareMode_BeforeAfter_Camera1InspectorViewTab.png` | `CompareView`, `BeforeAfterTab`, `MetricsTab` | Baseline vs proposed fix with verified deltas. |
| `MiniMapComponent_States_CollapsedCompactExpanded.png` | `MiniMap`, `MapCanvas`, `MapLayers`, store map state | Default compact + collapsed + expanded states. |
| `MiniMapComponent_ExpandedHoverState_DrawerNavigation.png` | `MiniMap`, `MapCanvas`, `MapLayers` | Expanded drawer / hover preview / layer controls. |
| `PathMapComponent_ScenarioPathPanel_RouteSummaryState.png` | `ScenarioPathPanel`, `PathMap`, `MapCanvas`, `MapLayers` | Route summary, not full replay. |
| `PathMapComponent_ReplayState_LiveActorVisibility.png` | `PathMap`, `TimelineTab`, path replay store | Live actor position and current visibility state. |
| `DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png` | `map-colors.ts`, `MapLayers.tsx`, `CoverageLegend`, Timeline badges, reports | Should become canonical token/design doc. |
| `DesignSystem_MapInteractionStates_RefinedWireframeBoard.png` | `MapCanvas`, `MapLayers`, `MiniMap`, `PathMap` | Hover/click/zoom/empty/multipath/privacy state matrix. |
| `PlatformHome_CommandCenter_RecentWorkspaceRiskOverview.png` | Future platform home, not immediate Studio root | Use when project/site/report portfolio exists. |
| `CurrentRepoRootLauncher_FormProblem.png` | `apps/studio/src/app/page.tsx` current problem | Negative reference: current root looks like a form. |

## Naming convention for future images

Use this pattern unless a specific save-as name is provided:

```txt
<ModeOrScreen>_<ActiveTabOrPanel>_<SelectedComponentOrFocus>.png
```

Examples:

```txt
CoverageMode_Metrics_Camera1Inspector.png
CameraViewMode_TimelinePathReplay_Camera1InspectorViewtab.png
PathReplayMode_Timeline_Camera1Inspector.png
CompareMode_BeforeAfter_Camera1InspectorViewTab.png
```
