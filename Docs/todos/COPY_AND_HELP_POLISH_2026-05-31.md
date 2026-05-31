# Copy And Help Polish — 2026-05-31

## Scope

This pass corrected operator-facing Studio language away from implementation jargon and toward physical-security industry language.

## Language Standard

- Prefer: site twin, site review, coverage verification, critical zone, route exposure, camera outage, evidence trail, assumptions, verified fix, before/after delta, audit evidence.
- Keep technical terms such as `SecurityScene`, provider, JSON, telemetry, DORI, OODPCVS, PPM, and K-robustness behind advanced data views, diagnostics, or contextual help.
- Avoid default operator copy that sounds like an AI developer console, generic AI SaaS, or offensive/evasion analysis.

## Implemented

- Updated Studio metadata and top-bar identity to physical-security site twin framing.
- Renamed high-frequency actions from technical labels to operator actions: Run Review, Test Outage, Path Risk, Evidence Trail, Site Twin File.
- Reworked workspace presets, launcher actions, layout draft, scan intake, compare exports, route review, advanced risk signals, report labels, and source-string tests.
- Extended `ExplainBadge` for hover/focus/click tooltips and added `SectionCard` help props.
- Added contextual help to camera inspector, critical-zone inspector, top-bar actions, and the Help tab glossary/workflow guide.

## Verification

- Focused source tests passed for updated copy surfaces:
  - top bar scene selector
  - threat / route exposure panel
  - metrics tab
  - advanced risk signals tab
  - report view
  - compare view
  - fix options panel
  - project start launcher

## Remaining Follow-Up

- Continue the same language standard in deeper specialist surfaces that are intentionally diagnostic today, especially provider configuration and automation settings.
- Browser QA should confirm tooltip positioning in dense inspector panels and narrow top-bar layouts.
