# SentinelTwin Project Brief — Origin Document

**Source:** Compiled from ChatGPT exploration sessions, May 2026
**Full file:** `/Users/pranay/Projects/SentinelTwin_Project_Brief.md` (in Claude Project Files)
**Note:** This brief is the pre-analysis product doc. Architecture decisions and refinements are in Docs/architecture/.

## Summary

SentinelTwin is an AI security digital twin testbed. V0.1 is the Camera Coverage Testbed.
The brief covers: product thesis, target users, V0.1–V1.0 roadmap, simulation model, data schemas,
AI pipeline, multi-agent architecture, rendering strategy, demo scenes, and 29-item V0.1 acceptance criteria.

## V0.1 Core Acceptance Criteria (from brief)

1. Load a small shop scene
2. Add/select Camera 1
3. Move/rotate/tilt Camera 1
4. Change Camera 1 FOV/resolution
5. Turn Camera 1 on/off
6. Move shelf/cupboard
7. Toggle day/night
8. Add/toggle light
9. Show camera cones
10. Show blindspot heatmap
11. Switch to Camera 1 view
12. Replay person path
13. Show visibility timeline
14. Save before/after
15. Show report-lite summary

## Roadmap from brief

- V0.1 — Camera Coverage Testbed (manual/procedural scene)
- V0.2 — AI Layout Draft + 2D Plan Editor (prompt → plan)
- V0.3 — Floor Plan Upload (image/PDF import)
- V0.4 — Guided Camera Scan (no floor plan, guided tap)
- V0.5 — Real Camera Snapshot/Video Verification
- V1.0 — Security Digital Twin Product Demo (all combined)

## Demo Scene: Small Retail Shop

Objects: front entrance, cash counter, two shelves, back storage room, two cameras, one cupboard causing blindspot, one light.

Story: owner thinks shop is covered → camera loses subject near cash counter → shelf/cupboard move improves coverage → night mode reveals weak recognition → add light improves quality.
