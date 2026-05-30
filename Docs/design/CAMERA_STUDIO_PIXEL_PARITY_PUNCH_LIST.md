# Camera Studio Pixel Parity Punch List

**Date:** 2026-05-30
**Source references:** `sentineltwin_ui_design_pack/SentinelTwin_UI_Design_Pack.md`, `Docs/design/CAMERA_STUDIO_SCREEN_STATUS.md`, current Studio implementation under `apps/studio/src/`

This is the implementation-oriented follow-up to the design parity audit. It is intentionally file-by-file and focuses on the smallest set of visual deltas that will move the current Studio toward full pixel parity with the reference boards.

## Priority order

1. Canonical map/token language
2. Camera view composition and overlay density
3. Camera wall feed-first layout rhythm
4. Path replay annotation hierarchy
5. Compare workspace simplification
6. Root dashboard panel rhythm

## P0 — canonical tokens and interaction language

### 1) Map layer visual language still needs one canonical pass

**Why this is still missing:**
The design pack treats `DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png` as the source of truth, but the live implementation still spreads map colors, badges, lines, and state styles across several components. The result is close, but not yet rigid enough for pixel parity.

**Exact deltas to close:**
- Normalize map fill/line/badge tokens so the same semantic state renders identically in MiniMap, PathMap, the workspace canvas, replay, and compare.
- Reduce token drift in warning/selection/privacy states.
- Make empty / no-path / privacy-violation states visually distinct in the same language as the board.

**Files to touch:**
- `apps/studio/src/components/map/map-colors.ts`
- `apps/studio/src/components/map/MiniMap.tsx`
- `apps/studio/src/components/map/PathMap.tsx`
- `apps/studio/src/components/workspace/MapCanvas.tsx`
- `apps/studio/src/components/workspace/MapLayers.tsx`

**Priority:** P0

---

## P1 — camera view parity

### 2) `CameraFeedCanvas.tsx` is feature-rich, but the overlay stack is too dense

**Why this is still missing:**
The current feed canvas now shows live feed mode toggles, DORI overlay, latest sensor event, latest camera metadata, live camera connection, operational fusion summary, path replay metadata, and timestamp blocks. That is useful, but the reference camera-view boards read cleaner and more intentional: fewer stacked status cards, stronger hierarchy, and more breathing room around the main POV.

**Exact deltas to close:**
- Collapse the three separate left-side evidence cards into one tighter, prioritized status rail or a single summary card stack.
- Reduce bottom-right competition between `Operational Fusion` and path replay badges.
- Make the DORI card the dominant secondary overlay; demote sensor and transport metadata.
- Align timestamp placement, badge sizing, and overlay opacity to the reference board.
- Rebalance the darkening/noise treatment so the feed feels like a camera view, not a dashboard inside a camera view.

**Files to touch:**
- `apps/studio/src/components/inspector/CameraFeedCanvas.tsx`
- `apps/studio/src/components/view/CameraViewMode.tsx`
- `apps/studio/src/components/view/SceneFeedCanvas.tsx`

**Priority:** P1

### 3) `CameraViewMode.tsx` still needs stricter composition against the reference board

**Why this is still missing:**
The current implementation has the right ingredients, but the reference uses a cleaner camera-monitor composition with tighter hierarchy between the feed, the timeline, the DORI card, and the inspector context.

**Exact deltas to close:**
- Make the feed feel like the primary surface, not one panel among many.
- Tighten the relationship between the view tab, replay timeline, and mini-wall preview.
- Reduce control clutter around mode toggles and utility actions.
- Bring typography and badge spacing closer to the design system board.

**Files to touch:**
- `apps/studio/src/components/view/CameraViewMode.tsx`
- `apps/studio/src/components/inspector/CameraFeedCanvas.tsx`
- `apps/studio/src/components/launcher/StudioDashboardHome.tsx` if the view-tab entry point needs spacing alignment

**Priority:** P1

---

## P1 — camera wall parity

### 4) `CameraWallView.tsx` should stay feed-first and lose the extra panel feel

**Why this is still missing:**
The design reference reads like a multiview operator wall with optional supporting summaries. The current implementation is functionally close but still feels more like a mode with side panels than a true multiview wall.

**Exact deltas to close:**
- Make the feed grid dominate the viewport.
- Reposition status summaries into lightweight floating or docked modules.
- Tighten offline/dirty/blocked tile states to match the board’s chip treatment.
- Unify tile headers, timestamp labels, and DORI badges.

**Files to touch:**
- `apps/studio/src/components/view/CameraWallView.tsx`
- `apps/studio/src/components/view/CameraViewMode.tsx` if the shared feed chrome is reused
- `apps/studio/src/components/launcher/StudioDashboardHome.tsx` only if launcher shortcuts need to mirror mode actions

**Priority:** P1

---

## P1 — path replay parity

### 5) `PathReplayView.tsx` needs more explicit annotation hierarchy

**Why this is still missing:**
The replay implementation is already strong, but the board emphasizes a visual story: actor movement, visibility transitions, current state, next state, and recommendations should read in that order.

**Exact deltas to close:**
- Promote the current time / current segment annotation.
- Make visibility changes and quality state feel more like timeline events than generic HUD labels.
- Simplify secondary cards so the timeline remains the hero.
- Match the reference’s playhead, quality band, and callout rhythm.

**Files to touch:**
- `apps/studio/src/components/view/PathReplayView.tsx`
- `apps/studio/src/components/map/PathMap.tsx`
- `apps/studio/src/components/bottom-panel/TimelineTab.tsx` if the replay timeline is shared there

**Priority:** P1

---

## P1 — compare parity

### 6) `CompareView.tsx` should be simplified to the board’s A/B evidence rhythm

**Why this is still missing:**
The current compare workspace is substantively correct, but the reference wants a clearer before/after story with fewer competing panels.

**Exact deltas to close:**
- Compress the metric story into fewer, more legible cards.
- Keep the side-by-side scene comparison as the dominant object.
- Make the delta narrative easier to scan.
- Reduce the visual weight of support notes when the comparison is on screen.

**Files to touch:**
- `apps/studio/src/components/view/CompareView.tsx`
- `apps/studio/src/components/view/CameraViewMode.tsx` if compare reuses view-tab chrome
- `apps/studio/src/components/bottom-panel/BeforeAfterTab.tsx` if the tab and full compare need to stay visually aligned

**Priority:** P1

---

## P1 — root/dashboard parity

### 7) `StudioDashboardHome.tsx` still needs panel rhythm cleanup

**Why this is still missing:**
The root home already replaced the form-like launcher, but the design target is a more deliberate command-center surface. The current implementation is close in content, not yet close in spacing and section rhythm.

**Exact deltas to close:**
- Tighten the right-side risk/status panel proportions.
- Reduce the feeling of stacked utility blocks.
- Improve the “currently loaded workspace” preview as the visual anchor.
- Rebalance quick actions versus state summary.

**Files to touch:**
- `apps/studio/src/components/launcher/StudioDashboardHome.tsx`
- `apps/studio/src/app/page.tsx` only if the entry composition needs to shift

**Priority:** P1

---

## P2 — lower-risk cleanup that still matters for parity

### 8) MiniMap state variants need one last polish pass

**Exact deltas to close:**
- Refine collapsed/compact/expanded transitions.
- Make hover preview density feel closer to the state boards.
- Tighten label spacing, outline weight, and legend rhythm.

**Files to touch:**
- `apps/studio/src/components/map/MiniMap.tsx`

**Priority:** P2

### 9) PathMap summary cards need stronger board-level consistency

**Exact deltas to close:**
- Reduce the number of competing badge styles.
- Make route summary, replay state, and event annotations share one typography scale.
- Match the compact summary geometry in the design board.

**Files to touch:**
- `apps/studio/src/components/map/PathMap.tsx`

**Priority:** P2

### 10) Dock and bottom-panel surfaces should mirror the mode-specific board rhythm

**Exact deltas to close:**
- Keep tab strip density consistent across coverage / view / replay / compare.
- Ensure dock collapse states do not feel like separate designs.
- Align tab content padding and title hierarchy.

**Files to touch:**
- `apps/studio/src/components/layout/StudioShell.tsx`
- `apps/studio/src/components/bottom-panel/*`
- `apps/studio/src/components/panels/*`

**Priority:** P2

## Suggested next implementation slice

If we want the fastest visible jump toward parity, do this order:

1. Canonicalize map tokens and interaction states
2. Simplify `CameraFeedCanvas.tsx` overlay hierarchy
3. Tighten `CameraViewMode.tsx` composition around the feed
4. Clean up `CameraWallView.tsx` to be feed-first
5. Then finish `PathReplayView.tsx` and `CompareView.tsx`

## Notes

- This punch list intentionally avoids claiming that missing screens need to be built from scratch; most of the gaps are hierarchy, spacing, and state-composition problems.
- The recently edited `CameraFeedCanvas.tsx` should be kept on the next visual QA pass because it now carries more live evidence overlays than the reference board wants by default.
- If a change improves correctness but hurts parity, the design board wins only when the underlying product intent is still preserved.
