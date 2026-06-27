# SentinelTwin Issue Review — 2026-06-30 (Floor-plan recovery and product-understanding check)

**Date:** 2026-06-30
**Primary surface:** `apps/studio/src/components/scan-to-scene/*`, `Apps/studio` routing bootstrap, demo artifacts
**Demo role:** live sales coaching with live objections from implemented UI

## Decision (this session)

1. Treat the current floor-plan lane as a trust-first review lane: no scene creation without review confirmation.
2. Keep demo/objection handling as a first-class workflow artifact, not an ad-hoc support note.
3. Elevate plan-understanding support work (calibration, candidate semantics, route continuity) as product-critical, not polish.

## What changed in user-perceived behavior vs expectation

- **Expected:** one-screen import to clean review in <=2 minutes.
- **Observed:** right-side UI density and count semantics caused repeated interpretation ambiguity.
- **Expected:** clean transition from Next -> review -> Create.
- **Observed:** `Next/Create` intent still required repeated narration and remained error-prone under stress.
- **Expected:** calibration visibly changes geometry with trust.
- **Observed:** metric change is detectable but preview motion is subtle and easily interpreted as broken.

## P0 blockers (must pass before next buyer-facing run)

- `Create Site Twin` route state mismatch when opening app entry URL.
- Insufficient visual delta of calibration action in preview lane.
- No persistent, compact “candidate source” explanation near wall metrics.
- No explicit list-ergonomics control for large/denoised detection sets.

## P1 reliability follow-ups

- Persist reviewer-visible lock state for the entire correction sequence.
- Keep wall list indexing stable under `Show all` + batch operations.
- Tighten guidance copy around source profiles for hand-drawn / photo-quality plans.

## Implementation tasks for next pass

1. Add a compact calibration audit row near preview (from/to meters + px/m delta + source-of-truth badge).
2. Add explicit raw/kept legend row in wall metrics at all correction surfaces.
3. Add explicit route bootstrap landing contract: first screen should always be either `Create Site Twin` or explicitly restored studio state with reason text.
4. Add floor-plan source preprocessor toggles (legend/text suppression and border cleanup) behind conservative defaults.
5. Add a reusable script: `sentineltwin-demo-walkthrough` + new `wide-open-brainstorm` to standardize future sessions.
