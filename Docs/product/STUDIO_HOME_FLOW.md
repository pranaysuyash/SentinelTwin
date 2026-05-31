# Studio Home Flow (Canonical Product Surface)

Updated: 2026-05-31 (command-center parity + intake clickability hardening)

## Root hierarchy

- `/` -> `StudioDashboardHome` (product command center)
- `/studio` -> `StudioShell` (full editing + simulation workspace)

Root is product-first. Workspace entry is explicit through visible actions.

## Home contract

`StudioDashboardHome` is the command center for:

- Current Site Twin summary + security status.
- Primary actions: `Open Security Twin Studio`, `Run/Refresh Simulation`, `Audit Report`.
- Product navigation: `Home`, `Create Site Twin`, `Security Twin Studio`, `Audit Reports`, `Reference Sites`, `Settings`.
- Mode cards: coverage/camera wall/path replay/compare/report.
- Site Twin memory search and recent Site Twin list.

## Clickability honesty rules

- Controls that look interactive must be wired to real actions/routes.
- Controls that are informational must not render as clickable buttons.
- `Create Site Twin` in left nav must open `site_intake`.
- `Reference Sites` and `Settings` must route to intentional product views (no confusing fallback).

## Site intake handoff from home

Home launches intake through `navigate("site_intake")`.
From intake, each source path must follow draft-gate lifecycle:

1. Source flow produces candidate scene/result.
2. `SiteIntakeSession` is created from draft candidate.
3. `site_draft_review` is opened.
4. Approval promotes draft to active scene.
5. Baseline simulation runs only after approval and prerequisites.

## Notes

- Scene name and environment mode in the header are currently status chips, not dropdowns.
- Organization/account control remains interactive and opens org manager panel.
