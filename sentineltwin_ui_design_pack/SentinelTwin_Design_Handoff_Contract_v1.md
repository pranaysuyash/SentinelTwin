# SentinelTwin Design Handoff Contract v1

**Canonical status:** This document is the canonical implementation contract for the current root/home screen redesign and its supporting component exports. Older dashboard/root/home variants are references only and must not override this contract.

**Canonical screen:** `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel`

**Canonical master export filename:** `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel_Master.png`

**Canonical design board export filename:** `StudioDashboardHome_PixelSpec_MasterComponentBoard.png`

**Canonical desktop breakpoint:** `1536 × 1024`

**Design intent:** Replace the current form-like root page with a SentinelTwin Studio dashboard that feels like a professional security simulation workspace. The page should immediately show the currently loaded workspace, visual security state, outcome summary, open issues, assumptions, and direct entry points into Studio modes.

---

## 1. Export Requirements

All design exports used for implementation and QA must follow these settings.

### Required exports

For every frame/component board:

```txt
1x PNG
2x PNG
sRGB color profile
No compression / maximum quality
Transparent background: false unless explicitly requested
Exact frame dimensions included in filename or metadata
```

### Canonical frame sizes

```txt
Desktop canonical: 1536 × 1024
Desktop wide optional: 1536 × 864
Smaller laptop QA: 1440 × 900
Tight laptop QA: 1280 × 800
```

### File naming convention

Use this pattern:

```txt
<ScreenOrComponent>_<SubscreenOrPurpose>_<StateOrPanel>.png
```

Examples:

```txt
StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel_Master.png
StudioDashboardHome_HeroMapPreview_IsometricSceneOverlays.png
StudioDashboardHome_RightRail_SecurityStatusIssuesAssumptions.png
StudioDashboardHome_KPIStrip_StatusCards.png
```

---

## 2. Token Source Reference

The implementation must not infer styling ad hoc from screenshots. Tokens should be centralized.

### Canonical token file to create or update

```txt
apps/studio/src/styles/design-tokens.ts
```

or, if the repo already centralizes map tokens separately:

```txt
apps/studio/src/components/map/map-colors.ts
```

### Related design docs to create or update

```txt
Docs/design/STUDIO_DASHBOARD_HOME_PIXEL_SPEC.md
Docs/design/MAP_LAYER_VISUAL_LANGUAGE.md
Docs/design/DESIGN_TOKENS.md
```

### Token categories required

```txt
color.background.*
color.surface.*
color.border.*
color.text.*
color.semantic.success
color.semantic.warning
color.semantic.danger
color.semantic.info
color.camera.*
color.coverage.identification
color.coverage.recognition
color.coverage.observation
color.coverage.detection
color.coverage.none
radius.*
spacing.*
typography.*
shadow.*
motion.*
icon.*
```

---

## 3. Motion and Interaction Timing

Use subtle, professional transitions. SentinelTwin should feel like a studio tool, not a flashy SaaS app.

### Default timings

```txt
Hover state: 120ms ease-out
Button active/pressed: 80ms ease-out
Panel expand/collapse: 180ms cubic-bezier(0.2, 0.8, 0.2, 1)
Card hover lift/glow: 140ms ease-out
Tooltip appear: 120ms ease-out, 100ms delay
Modal/drawer enter: 180ms ease-out
Modal/drawer exit: 140ms ease-in
Map overlay fade: 150ms ease-out
```

### Transition rules

```txt
Do not animate layout so much that it distracts from the canvas.
Do not use bouncy/spring effects for security status, risk, or issue states.
Semantic status changes should be immediate or near-immediate.
Panel collapse should increase canvas/workspace area clearly.
```

---

## 4. Canonical Screen Purpose

### Screen

```txt
SentinelTwin Studio
Studio Dashboard Home
Current Workspace Overview
```

### Purpose

The root/home page should answer:

```txt
What workspace am I in?
What is the current security state?
What issues need attention?
What assumptions produced these results?
Where do I click to continue working?
```

### It must not feel like

```txt
A form
A setup wizard
A marketing landing page
A generic SaaS dashboard
A product feature checklist
```

### It must feel like

```txt
A security simulation studio dashboard
A Figma/Blender/Adobe-style workspace entry
A command center around the active scene
```

---

## 5. Master Layout Contract

### Full layout

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ Top Header Bar                                                            │
├───────────────┬─────────────────────────────────────────────┬──────────────┤
│ Left Sidebar  │ Current Workspace Card                       │ Right Rail   │
│               │ - title/meta                                 │ - status     │
│               │ - hero map preview                           │ - issues     │
│               │ - KPI strip                                  │ - assumptions│
│               │ - workspace shortcuts                        │              │
├───────────────┴─────────────────────────────┬───────────────┴──────────────┤
│ Recent Workspaces                            │ Quick Start Actions          │
├──────────────────────────────────────────────┴──────────────────────────────┤
│ Footer / Status Strip                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relative priorities

```txt
Hero map preview: highest visual priority
Right security status rail: second priority
KPI strip: third priority
Workspace shortcuts: fourth priority
Recent/quick-start: supporting content
```

---

## 6. Component Export List

The following exports are required for implementation and QA.

```txt
1. StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel_Master.png
2. StudioDashboardHome_TopHeaderBar_ControlsStates.png
3. StudioDashboardHome_LeftSidebar_NavModesUserCard.png
4. StudioDashboardHome_CurrentWorkspaceCard_ContainerSpec.png
5. StudioDashboardHome_HeroMapPreview_IsometricSceneOverlays.png
6. StudioDashboardHome_KPIStrip_StatusCards.png
7. StudioDashboardHome_WorkspaceShortcutCards_ModeActions.png
8. StudioDashboardHome_RightRail_SecurityStatusIssuesAssumptions.png
9. StudioDashboardHome_BottomRecentWorkspaces_ThumbnailCards.png
10. StudioDashboardHome_QuickStartActions_SecondaryFlows.png
11. StudioDashboardHome_FooterStatusStrip_SystemFeedback.png
12. StudioDashboardHome_GlobalTokens_ColorTypographySpacingEffects.png
13. StudioDashboardHome_InteractionResponsiveBehaviorSpec.png
```

---

## 7. Top Header Bar Contract

### Component name

```txt
StudioDashboardHeader
```

### Required content

```txt
Logo mark
SentinelTwin Studio
Security Simulation Workspace
Workspace selector: Small Retail Shop Demo
Status chip: Up to date
Last run: Today, 10:31 AM
Environment mode: Day / Night
Open Studio
Run Simulation
Import JSON
New Scene
```

### Behavior

```txt
Run Simulation is the dominant action.
Open Studio is secondary but still prominent.
Import JSON and New Scene are utility actions.
Status chip changes when scene is dirty, running, errored, or up to date.
```

### States to export

```txt
Default
Hover
Active/pressed
Running
Disabled
Dirty / Needs recompute
```

---

## 8. Left Sidebar Contract

### Component name

```txt
StudioDashboardRail
```

### Sections

```txt
STUDIO
- Home
- Projects
- Demo Sites
- Reports
- Docs
- Settings

WORKSPACE MODES
- Coverage Workspace
- Camera View
- Camera Wall
- Path Replay
- Compare Fixes
- Report Lite

BOTTOM USER / LOCAL WORKSPACE CARD
```

### State variants

```txt
Default
Hover
Active
Pressed
Disabled / future
```

### Design rule

This is Studio-level navigation, not full platform admin navigation. Do not add Teams, Integrations, Audit Log, or portfolio admin unless those features are real or explicitly marked future.

---

## 9. Current Workspace Card Contract

### Component name

```txt
CurrentWorkspacePreview
```

### Required content

```txt
Current Workspace label
Small Retail Shop Demo title
Edit/rename affordance
Meta row:
- 10m × 7m
- 5 cameras
- 1 light
- 5 obstructions
- 1 critical zone
- 2 paths
Open Full Workspace button
Hero map preview
KPI strip
Workspace shortcut cards
```

### Design rule

The workspace card is the hero. It should be visually dominant and should not look like a form container.

---

## 10. Hero Map Preview Contract

### Component name

```txt
HeroMapPreview
```

### Required visual content

```txt
Isometric/top-down retail shop preview
Walls/floor boundary
Shelves/cupboards/counter
Camera markers
Camera FOV wedges
Coverage heatmap
Active route/path
Critical zone marker
Issue callouts
Coverage legend
Compass
2D/3D controls
Layer/control chip
```

### Required annotations

```txt
Cash Counter — FAILS Recognition
Cupboard blocking Camera 1
Camera 1
Camera 2
Night Entry → Cash Counter path
Coverage: 68%
```

### Quality bar

The hero preview must look closer to the high-fidelity isometric design reference, not an abstract debug grid. If implementation cannot render photoreal/isometric in root cheaply, use a high-quality SVG/CSS pseudo-isometric preview with the same semantic content.

### Layer exports requested

```txt
Base scene
Camera cones
Heatmap
Path line
Critical zones
Issue callouts
Legend
Compass/map controls
```

---

## 11. KPI Strip Contract

### Component name

```txt
DashboardKpiStrip
```

### Required cards

```txt
Coverage: 68%
Critical Zones: 0 / 1 passing
Worst Quality: DETECTION at cash counter
Open Issues: 4
Redundancy: FAILS, no backup coverage
Last Run: 10:31 AM, Today
```

### State colors

```txt
Pass: green
Warning: amber/yellow
Fail: red
Neutral: slate/blue-gray
Stale: muted gray
```

### Design rule

The KPI strip must show security outcome state, not generic analytics.

---

## 12. Workspace Shortcut Cards Contract

### Component name

```txt
WorkspaceShortcutCards
```

### Required cards

```txt
Open Coverage Workspace
Open Camera Wall
Open Path Replay
Compare Fixes
```

### Card content

```txt
Icon container
Title
One-line subtitle
Optional status/mode chip
Arrow/launch affordance
```

### Design rule

These are larger mode-launch tiles, not compact generic buttons. They should visually sit below the KPI strip as the primary continuation paths.

---

## 13. Right Rail Contract

### Component name

```txt
SecurityStatusRail
```

### Required sections

```txt
Security Status
Outcome Summary
Open Issues
Simulation Assumptions
```

### Outcome Summary content

```txt
Cash Counter — FAILS
Main Entry — DETECTION
Night Mode — WEAK
Overall Coverage — 68%
```

### Open Issues content

```txt
Critical — Cash Counter recognition requirement not met
High — Cupboard blocks Camera 1
Medium — Night visibility weak near counter
Medium — No redundant camera for cash counter
```

### Issue row anatomy

```txt
Severity icon
Severity label
Issue title
Affected object/zone if space allows
Chevron or action button
```

### Assumptions content

```txt
DORI Model: Simplified PPM
Person Height: 1.7m
Lighting: Day
Grid Size: 0.25m
Time: 10:31 AM
```

---

## 14. Recent Workspaces Contract

### Component name

```txt
RecentWorkspacesStrip
```

### Required cards

```txt
Small Retail Shop Demo
Warehouse Bay A
Apartment Lobby
School Corridor
```

### Card anatomy

```txt
Thumbnail
Workspace name
Coverage %
Issue count
Last run/date
Status chip or arrow
```

### Thumbnail rule

Thumbnail must show a rich preview when available: heatmap, cones, or scene thumbnail. Do not use placeholder-only cards when a demo scene exists.

---

## 15. Quick Start Actions Contract

### Component name

```txt
QuickStartActions
```

### Required actions

```txt
New Blank Scene
Import Scene JSON
Scan a Site
AI Layout Draft
```

### Hierarchy rule

These are secondary. They must not compete with Open Studio / Open Coverage Workspace.

### State variants

```txt
Available
Hover
Active
Disabled
Coming soon
```

---

## 16. Footer / Status Strip Contract

### Component name

```txt
DashboardFooterStatus
```

### Required content

Left side:

```txt
Simulation engine ready
Coverage grid: 0.25m
Scene source: Demo
```

Right side:

```txt
Docs
Send Feedback
Local Mode
Version
```

### Design rule

The footer should be quiet, aligned, and compact. It must not become another content panel.

---

## 17. Interaction and Responsive Behavior

### Hover rules

```txt
Buttons: subtle border brighten + surface lift
Cards: border brighten + slight shadow/glow
Nav rows: background fill + text brighten
Issue rows: severity border accent + chevron emphasis
Hero map annotations: hover raises callout and highlights related object/path
```

### Click rules

```txt
Open Studio → enter StudioShell current mode
Run Simulation → run or enter studio and run, depending implementation readiness
Import JSON → existing import flow
New Scene → existing scene builder flow
Scan Site → existing scan wizard flow
AI Layout Draft → existing AI draft flow
Mode shortcut → enter StudioShell with requested viewMode
Issue row → open StudioShell with issue context if supported, otherwise open Coverage Workspace
```

### Responsive behavior

At `1536 × 1024`:

```txt
Full layout visible.
Left rail, center card, right rail, bottom strips all visible.
```

At `1440 × 900`:

```txt
Reduce vertical card padding.
Recent workspaces may scroll horizontally.
Right rail remains visible.
```

At `1280 × 800`:

```txt
Left rail can collapse to icon mode.
Right rail can become narrower or scroll internally.
Bottom quick start may collapse into a single row / horizontal scroll.
Hero map remains visible and dominant.
```

---

## 18. Implementation Mapping

### Existing root file

```txt
apps/studio/src/app/page.tsx
```

### Suggested new components

```txt
apps/studio/src/components/dashboard/StudioDashboardHome.tsx
apps/studio/src/components/dashboard/StudioDashboardHeader.tsx
apps/studio/src/components/dashboard/StudioDashboardRail.tsx
apps/studio/src/components/dashboard/CurrentWorkspacePreview.tsx
apps/studio/src/components/dashboard/HeroMapPreview.tsx
apps/studio/src/components/dashboard/DashboardKpiStrip.tsx
apps/studio/src/components/dashboard/WorkspaceShortcutCards.tsx
apps/studio/src/components/dashboard/SecurityStatusRail.tsx
apps/studio/src/components/dashboard/RecentWorkspacesStrip.tsx
apps/studio/src/components/dashboard/QuickStartActions.tsx
apps/studio/src/components/dashboard/DashboardFooterStatus.tsx
```

### Existing flows to keep

```txt
enterStudio
?studio=1 boot
SceneBuilderWizard
ScanSiteWizard
AI Layout Draft
Import JSON
saved scenes/local storage
feature status data, demoted or moved out of first fold
```

### Must not remove

```txt
StudioShell
DockLayout
ViewModeBar
WorkspaceCanvas
CameraViewMode
CameraWallView
PathReplayView
CompareView
```

---

## 19. QA Acceptance Criteria

### Master screen match

```txt
Overall shell structure matches target.
Hero map preview is rich/isometric, not abstract debug map.
Right rail uses explicit mixed severity/outcome model.
KPI strip uses canonical target values and semantic states.
Workspace shortcuts use 4 larger mode-launch tiles.
Recent workspaces use thumbnail-rich cards.
Quick start is secondary.
Footer/status strip is compact and aligned.
```

### Visual token match

```txt
Typography hierarchy matches token doc.
Card radius and border are consistent.
Glow/shadow intensity is subtle and consistent.
Spacing uses defined scale.
Semantic colors match token source.
Coverage colors match map visual language.
```

### Behavior match

```txt
Hover/active states implemented for buttons, cards, nav rows, issue rows.
Mode shortcut cards enter correct StudioShell mode.
Issue rows can route to relevant workspace/context or gracefully fallback.
Responsive behavior preserves hero map dominance.
```

---

## 20. Non-goals

Do not use this contract to build the future full platform home yet.

Do not add fake platform areas such as:

```txt
Teams & Users
Integrations
Audit Log
Portfolio-wide multi-site metrics
```

unless they are explicitly marked future or backed by real functionality.

Do not replace the Camera Studio/StudioShell architecture.

Do not turn the root into a marketing homepage.

---

## 21. Final Design Stance

The root/home page should communicate:

```txt
SentinelTwin Studio is already a working security simulation workspace.
The user is one click away from continuing analysis on the current scene.
The current scene has visible security outcomes, issues, and assumptions.
```

The page should not communicate:

```txt
Fill out this form to start.
Choose one equal setup path.
Read a product checklist.
```

This contract is canonical for the current root/home implementation pass.
