# Phase 5 — Path Replay + Demo Polish

**Status:** ✅ Complete
**Completed by:** Buffy / Sprint 3
**Date:** May 26, 2026

---

## Summary

The path replay view has been enhanced with a visibility timeline, colored coverage quality bands on the scrub bar, and a guided demo mode overlay. The demo scene is polished and all features are browser-verified.

---

## What Was Built

### Visibility Timeline (`apps/studio/src/components/view/VisibilityTimeline.tsx`)
- Per-camera colored segment bars showing when each camera can see the actor
- Colors by DORI quality (ID=blue, REC=green, OBS=amber, DET=orange, lost=red)
- Correct camera attribution (fixed: no aggregate event leakage)
- Initial "none" segment from time 0 to first event for complete coverage
- Playhead indicator line synced to current replay time
- Clickable bars for seeking to that time
- Summary stats: visible duration, lost duration, event count
- Handles empty state gracefully

### Coverage Quality Bands (in `PathReplayView.tsx`)
- Colored bands beneath the scrub bar showing coverage quality at each segment
- Uses more conservative (worse) quality between segment endpoints
- Semi-transparent for subtle visual layering
- Coverage mini legend (ID/REC/OBS/DET/NONE) below the scrub bar

### Demo Walkthrough Panel (`apps/studio/src/components/demo/DemoWalkthroughPanel.tsx`)
- Supersedes the earlier `DemoModeOverlay.tsx` (deleted 2026-05-29)
- 7-step guided walkthrough: baseline → camera wall → path replay → failure identification → apply fix → before/after comparison → report
- Orchestrates real simulation state through store actions (not hardcoded demo data)
- Conditionally rendered via `demoMode` state in store
- CompareView auto-selects baseline vs latest snapshot at step ≥ 5

### Path Replay Enhancements (`apps/studio/src/components/view/PathReplayView.tsx`)
- Integrated `CoverageSegmentPath` for colored quality segments
- Integrated `VisibilityTimeline` below playback controls
- `CoverageQualityBands` on scrub bar
- `CoverageMiniLegend` for DORI color reference

---

## Architecture Notes

- Zero new simulation logic — all visualization and UI
- VisibilityTimeline reads from existing `PathVisibilityResult` data
- DemoMode is purely a UI overlay — no state coupling with simulation

---

## Done Criteria

- [x] Person actor renders in scene (existing PathActor)
- [x] Path replay animates correctly, play/pause/scrub (existing PlaybackControls)
- [x] Visibility timeline shows camera coverage during replay
- [x] Demo scene looks and feels polished
- [x] Demo mode with 5 guided steps
- [x] Performance: no new computation, pure visualization
