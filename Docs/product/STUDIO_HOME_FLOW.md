# Studio Home Flow (V0.1)

Updated: 2026-05-30 (loop-orchestration pass)

## Current Root Hierarchy

- `/` -> `StudioDashboardHome` (Product home shell)
- `/studio` -> `StudioShell` (explicit workspace route, implemented via `src/app/studio/page.tsx`)

This is now positioned as a product-first root: users arrive at a job-oriented home, then enter the workspace when they choose a path.

- `/` now exposes a primary **Start Security Audit** flow that opens the current workspace in audit mode.
- The root no longer has a hidden boot bypass; all workspace entry happens through visible launcher actions or the explicit `/studio` route.

## What Root Means Today

`StudioDashboardHome` is the launch surface for:

- Current workspace preview and risk/status summary
- Top identity copy aligned to `SentinelTwin Studio` + `Security Simulation Workspace`
- Root top controls explicitly expose `Workspace selector`, `Status`, `Last run`, and `Environment mode` labels for operator clarity
- Quick-start actions (`New Blank Scene`, `Import Scene JSON`, `Scan a Site`, `AI Layout Draft`, plus optional floor-plan/guided entries) are now visible directly instead of hidden behind an expand toggle
- Shared mode labels now follow one canonical contract across launcher and shell: `Coverage - Map & Analysis`, `Camera View - Single Camera`, `Camera Wall - Multi Camera`, `Path Replay - Route Analysis`, `Compare - Before / After`, `Report Lite - Quick Report`
- Primary workspace actions:
  - Coverage
  - Camera View / Camera Wall
  - Path Replay
  - Compare
  - Report Lite
- Quick-start flows:
  - New scene
  - Import JSON
  - Manual-assisted Scan Site
  - AI Layout Draft
  - Import Floor Plan workflow (advanced path via Project Start Launcher)
  - Verify from Footage now routes to Camera View verification flow (preview path, not a dead-end alert)

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
- Report Lite
- Report workspace now surfaces a decision-priority strip (verified recommendations + critical issue context + latest AI recommendation telemetry)
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

There is no hidden launcher bypass on the root page. The launcher/dashboard is the
normal entry URL for users, and `/studio` is the explicit workspace route for direct
workspace entry in development and internal workflows.
