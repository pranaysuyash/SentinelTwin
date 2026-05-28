# Workspace Layout Manager

## Why this exists

SentinelTwin Studio is not a fixed dashboard. It is a spatial security workspace where the user may want different compositions for different jobs:

- scene editing
- coverage review
- camera tuning
- replay analysis
- compare workflows
- report generation
- client demos
- debugging

Before this work, those concerns were split across workspace presets, dock collapse state, scene layers, bottom tabs, and viewport chrome. That made the product powerful, but harder to reason about from the user side.

The layout manager makes the workspace composition explicit and editable from one place.

## Mental model

The layout manager separates four concepts that previously overlapped:

1. `View mode` - the main workspace destination, such as `map`, `camera_view`, `wall`, `replay`, `compare`, or `report`.
2. `Workspace preset` - the task-oriented default arrangement, such as `edit`, `coverage`, `camera_wall`, `replay`, `compare`, `report`, `debug`, or `focus`.
3. `Scene layers` - what is visible inside the canvas, such as cameras, cones, heatmap, obstructions, critical zones, privacy zones, paths, grid, walls/floors, and labels.
4. `Layout chrome` - which UI pieces are visible and how the shell is arranged, including docks, view controls, command bar, status bar, view mode bar, coverage legend, compass, minimap, and analysis modules.

Scenes answer: "what is the site?"

Layouts answer: "how do I want to inspect the site?"

## Current implementation

The canonical state lives in `apps/studio/src/store/studio-store.ts`.

The layout snapshot now includes:

- `viewMode`
- `workspacePreset`
- `canvasMode`
- dock collapse state and sizes
- `visibleComponents`
- `enabledAnalysisModules`
- `rightPanelMode`
- `bottomDrawerMode`
- `pinnedAnalysisModule`
- `layerVisibility`
- `overlayDensity`
- `showDebugOverlays`
- `clientDemoOptions`

Shared preset definitions and layout helpers live in `apps/studio/src/lib/workspace-layouts.ts`.

The Studio shell now wires that state into:

- `apps/studio/src/components/layout/StudioShell.tsx`
- `apps/studio/src/components/layout/ViewSettingsModal.tsx`
- `apps/studio/src/components/dock/WorkspacePresetSwitcher.tsx`
- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`
- `apps/studio/src/components/bottom-panel/BottomPanel.tsx`
- `apps/studio/src/components/panels/ContextRightPanel.tsx`
- `apps/studio/src/components/view/ViewModeBar.tsx`

The report destination is now first-class via `apps/studio/src/components/view/ReportView.tsx`.

## System presets

The current preset set is task-oriented:

- `Edit`
- `Coverage`
- `Camera Wall`
- `Replay`
- `Compare`
- `Report`
- `Debug`
- `Focus / Demo`

Each preset defines the default:

- view mode
- canvas mode
- dock sizes
- dock collapse state
- component visibility
- enabled analysis modules
- right panel mode
- bottom drawer mode
- pinned module
- demo/client options

## Custom layouts

Users can save custom layouts separately from scenes.

Persistence currently uses local storage under:

- `sentineltwin_workspace_layouts`

This keeps scene history and workspace composition independent, which reduces drift and avoids overwriting the site model when the user is only changing the UI arrangement.

Saved layouts can be:

- created from the current workspace
- applied later
- deleted
- refreshed from storage

The layout switcher also shows when the active workspace has been modified from its preset baseline.

## View Settings surface

The `View Settings` modal is the main control surface for layout composition.

It now exposes:

- main view
- canvas mode
- dock collapse controls
- panel/component visibility
- analysis module visibility
- right panel mode
- bottom drawer mode
- pinned module
- workspace presets
- saved layouts
- client/demo options

The modal is reachable from:

- the top bar
- the floating viewport controls
- the workspace preset switcher
- `Shift+V`

## Dock semantics

The shell distinguishes between:

- `visible`
- `collapsed`
- `hidden`

That matters because a dock can be available as a rail, available as a collapsed panel, or removed from the composition entirely depending on the preset and user preference.

## Analysis drawer behavior

The bottom panel now supports three modes:

- `tabs` - the normal multi-tab drawer
- `single_module` - one pinned module only
- `hidden` - minimized drawer state

If a module is disabled, it disappears from the tab strip and the active tab falls back to the nearest enabled module.

## Right panel behavior

The right panel can now act as more than a scene inspector.

Available modes include:

- inspector
- security status
- issues
- recommendations
- assumptions
- camera controls

## Future extension

The next obvious step is to make layouts user-scoped and syncable:

- per-user cloud persistence
- workspace sharing
- layout export/import
- role-based preset bundles for auditors, installers, and client demos
- project-level defaults with user overrides

The current implementation keeps the first version local-first on purpose so the user can iterate quickly without introducing account or sync complexity before the shell model is proven.
