# Studio Home Flow (V0.1)

Updated: 2026-05-28

## Current Root Hierarchy

- `/` -> `StudioDashboardHome` (current V0.1 root)
- `?studio=1` (or dashboard "Open Studio" actions) -> `StudioShell` full workspace

This is intentional for the current stage: SentinelTwin is still Studio-first, with the Camera Coverage Testbed as the strongest live module.

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
