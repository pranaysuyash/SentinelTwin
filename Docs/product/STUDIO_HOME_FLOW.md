# Studio Home Flow (V0.1)

Updated: 2026-05-29

## Current Root Hierarchy

- `/` -> `StudioDashboardHome` (Product home shell)
- `/studio` -> `StudioShell` (explicit workspace route)
- `?studio=1` -> `StudioShell` (explicit launcher bypass for dev/debug)

This is now positioned as a product-first root: users arrive at a job-oriented home, then enter the workspace when they choose a path.

- `/` now exposes a primary **Start Security Audit** flow that opens the current workspace in audit mode.
- `?studio=1` is intentionally treated as a debug bypass and shows a launcher-skipped notice in studio.

## What Root Means Today

`StudioDashboardHome` is the launch surface for:

- Current workspace preview and risk/status summary
- Primary workspace actions:
  - Coverage
  - Camera View / Camera Wall
  - Path Replay
  - Compare
  - Report
- Quick-start flows:
  - New scene
  - Import JSON
  - Manual-assisted Scan Site
  - AI Layout Draft
  - Import Floor Plan workflow (advanced path via Project Start Launcher)

Priority ordering on home is now intentionally job-first:

1. Start Security Audit (current workspace)
2. Continue current workspace
3. Advanced workflows (scan, AI draft, floor plan, import, verify)
4. Workspace references (including reference demo)

## Full Workspace

`StudioShell` is the active editing/simulation workspace:

- Map/Coverage
- Camera View
- Camera Wall
- Path Replay
- Compare
- Report
- Inspector, docks, analysis modules, minimap/path map, snapshots

## Platform Home (Future V1+)

`PlatformHome_CommandCenter_RecentWorkspaceRiskOverview` is kept as a future product concept.
It requires a true multi-project/multi-site/report portfolio model and is not the current V0.1 root target.

## Feature Maturity Labels

Use these labels consistently on launcher/home surfaces:

- `real` (implemented and usable end-to-end)
- `preview` (usable but not product-complete)
- `planned` (not implemented yet)

Current examples:

- Camera studio core loop: `real`
- Manual-assisted scan-to-scene: `preview`
- AI layout draft: `preview`
- Guided scan reconstruction: `preview`
- Real footage verification (local ingest + frame extraction): `preview`
- Product-grade real footage verification pipeline (ONVIF/RTSP, pose recovery, forensic claims): `planned`

## Important routing note

`?studio=1` is no longer the normal entry URL for users. It should only be used in
developer/debug contexts when the product launcher should be skipped.

That means the perceived default does not need to be a demo/workspace shell.
