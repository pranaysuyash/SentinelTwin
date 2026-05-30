# Camera Studio Screen Status

**Date:** 2026-05-27
**Purpose:** Freeze the current screen inventory against the live Studio implementation so we do not re-build screens that already exist and do not lose track of the remaining polish-only gaps.

This document is intentionally narrow. It captures the current screen/component surface area that the audit reviewed and assigns the next concrete action for each one.

## Status Table

| Screen / Component | Design image filename | Repo component(s) | Status | Missing | Next action |
|---|---|---|---|---|---|
| Coverage Mode | `FullCamerasuiteCoverageMode_metrics_Camera1Inspector.png` | `StudioShell`, `WorkspaceCanvas`, `InspectorPanel`, `BottomPanel`, `MiniMap`, `PathMap` | Mostly done | Visual hierarchy, palette consistency, issue-card action polish | Run visual QA and tighten the map language |
| Camera View | `CameraViewMode_TimelinePathReplay_Camera1InspectorViewtab.png` | `StudioShell`, `CameraViewMode`, `CameraFeedCanvas` | Partially done | Feed reactivity when camera moves, actor overlay in feed, lens/noise effects, DORI explanation polish | Hardening pass on the camera feed stack |
| Camera Wall | `CameraWallMode_Timeline_Camera1InspectorViewTab.png` | `StudioShell`, `CameraWallView`, `BottomPanel` | Implemented, but layout differs from the generated board | Full docked-side layout is intentionally not used; quick-status summary and feed selection polish remain | Keep the full-canvas wall pattern and add lightweight summaries |
| Path Replay | `PathReplayMode_Timeline_Camera1Inspector.png` | `StudioShell`, `PathReplayView`, `TimelineTab`, `PathMap` | Mostly done | Stronger annotations, actor state card, event hierarchy, handoff clarity | Polish replay language and event labeling |
| Compare Mode | `CompareMode_BeforeAfter_Camera1InspectorViewTab.png` | `StudioShell`, `CompareView` | Implemented (snapshot-true geometry) | Snapshot-without-simulation warning + interaction polish remain | Keep visual truth strict and improve action affordances |
| MiniMap (collapsed/expanded/hover) | N/A | `MiniMap`, `MapCanvas`, `MapLayers` | Implemented | Hover density and viewport rectangle verification | Visual QA against the board |
| PathMap | N/A | `PathMap`, `ScenarioPathPanel`, `MapCanvas` | Implemented | Better path labels and event annotations | Visual QA and label polish |
| Map interaction states | N/A | `MapCanvas`, `MapLayers`, `InspectorPanel` | Partial | Hover tooltips, empty states, privacy violation cards, no-path CTA | Finish the edge-state polish pass |
| Bottom dock tabs | N/A | `BottomPanel`, `BottomRow` | Mostly complete | `RedundancyTab` exposure was missing from the tab strip before this pass | Keep tab surfacing aligned with the actual render branches |
| Report workspace | N/A | `ReportLiteTab` | Partial | No dedicated report workspace view mode yet | Treat as a next screen once the current surfaces are polished |
| Failure analysis workspace | N/A | `RedundancyTab`, `ThreatAnalysisPanel`, inspector failure controls | Partial | Not yet a dedicated workspace mode | Promote only if the product needs a separate full-screen workflow |
| AI command bar | N/A | `CommandBar`, `useAiCommand` | Shell complete | Command coverage and verified-op safety still need audit | Audit the command set after the visual surfaces stabilize |

## Reading Notes

- The live implementation already covers the core Studio shell, the main 3D workspace, replay, compare, and camera wall modes.
- The remaining work is mostly polish, canonical surfacing, and consistency rather than building entirely new screens from scratch.
- Any new screen proposal should be checked against this table first.
- For an implementation-oriented checklist with exact file targets, see `Docs/design/CAMERA_STUDIO_PIXEL_PARITY_PUNCH_LIST.md`.
