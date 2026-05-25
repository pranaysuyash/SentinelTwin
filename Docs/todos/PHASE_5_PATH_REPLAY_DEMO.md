# Phase 5 — Path Replay + Demo Polish

**Status:** Not started
**Blocking:** Phases 0–3 must be complete (Phase 4 nice-to-have)
**Agent:** Claude Code (or any agent)
**Read first:** Docs/architecture/07_RENDERING_PIPELINE.md (replay section)

---

## Goal

Add person path replay animation. Polish the demo scene. This phase produces a working,
presentable demo of SentinelTwin's core value proposition.

---

## Task 5.1 — Person Actor Renderer

In `packages/viewer/src/replay/PersonActor.tsx`:

A simple person silhouette: capsule geometry (cylinder + two spheres) in a neutral color.
Renders at the actor's current position + height.
Has a slight emissive glow to stand out from the scene.

For V0.1: no detailed mesh. Clear, visible, simple.

---

## Task 5.2 — Path Replay Controller (GSAP)

In `packages/viewer/src/replay/PathReplayController.tsx`:

Uses GSAP timeline to animate `PersonActor` along the path:
- Each path segment = a GSAP tween
- Speed: `path.speedMps` m/s
- Actor rotates to face direction of travel

Controls: Play / Pause / Restart / Scrub (timeline slider)
Speed multiplier: 1x / 2x / 4x

During replay:
- Coverage heatmap shows which cameras can see actor at current position
- Cameras that currently see the actor: cone highlights
- Cameras that lost the actor: cone dims

---

## Task 5.3 — Visibility Timeline Panel

In `apps/editor/src/panels/VisibilityTimeline.tsx`:

During or after replay, shows a timeline:
```
Camera 1:  ████████░░░░░░░████████  (visible → lost → visible)
Camera 2:  ░░░░░░░██████░░░░░░░░░░  (visible for mid-section)
Subject:   DDD OOO RRR LLL OOO DDD  (detection → observation → recognition → lost)

         0s   2s   4s   6s   8s   10s
```

Color coding: D=red, O=orange, R=yellow, (blank)=lost

Shows: "Subject lost behind Shelf 1 at 4.2s — Camera 1 blocked"

---

## Task 5.4 — Demo Scene Polish

Polish the `small_retail_shop.json` scene:
- Correct proportions and realistic object placement
- Camera cones visually plausible for a retail space
- Coverage heatmap looks right (entry and counter should be covered, shelf creates blindspot)
- Night mode shows clearly degraded coverage near counter

Record or screenshot: before shelf move, after shelf move, night mode.
These become the demo screenshots.

---

## Task 5.5 — Demo Script in the UI

Add an optional "Demo Mode" overlay:
- [Start Demo] button in toolbar
- Steps through the demo script from `Docs/context/origin/project_brief_summary.md`
- Each step highlights the relevant UI element and shows a callout
- Narration text appears in bottom panel

This is for showcasing to judges/clients. Not for daily use.

---

## Task 5.6 — Performance Validation

Before demo:
- Load demo scene: verify < 1 second
- Move an obstruction: coverage recomputes in < 200ms
- Path replay at 1x speed: smooth at 60fps
- Night mode toggle: heatmap updates < 200ms

If any metric fails: profile and fix before demo.

---

## Phase 5 Done Criteria

- [ ] 5.1: Person actor renders in scene
- [ ] 5.2: Path replay animates correctly, GSAP timeline, play/pause/scrub
- [ ] 5.3: Visibility timeline shows camera coverage during replay
- [ ] 5.4: Demo scene looks and feels polished
- [ ] 5.5: Demo mode with guided steps
- [ ] 5.6: Performance targets met

**This completes the V0.1 hackathon demo.**

---

## After Phase 5 — Future Phases (Not Yet Written)

```
Phase 6 — Path Drawing Tool (user draws custom paths)
Phase 7 — Scene Generation from Text ("Create a 10m × 8m retail shop...")
Phase 8 — Floor Plan Import (image + scale → scene)
Phase 9 — Temporal Simulation (24h security profile)
Phase 10 — Multi-Photo Scan Input
Phase 11 — Real Camera Feed Verification
```

Write todo docs for each phase as you approach them. Do not write them speculatively far in advance
— requirements will evolve as earlier phases complete.
