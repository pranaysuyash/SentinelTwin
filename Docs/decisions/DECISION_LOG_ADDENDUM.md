## New Decisions — Added 2026-05-25

---

## D-010 | 2026-05-25 | Apache 2.0 as SentinelTwin's open source license

**Decision:** SentinelTwin's own code is licensed Apache 2.0.
All dependencies must be MIT, Apache 2.0, BSD, or CC0.

**Rationale:**
- Apache 2.0 includes an explicit patent grant — important for security software
- Fully permissive: commercial SaaS use allowed without source disclosure
- Enterprise buyers prefer Apache 2.0 over MIT (patent protection)
- Compatible with MIT dependencies (Pascal, three.js, etc.)

**Prohibited dependency licenses:** GPL, AGPL, CC BY-NC, BSL (during restriction period)

**Specific flags identified:**
- DUSt3R / MASt3R: CC BY-NC-SA 4.0 — non-commercial. Use VGGT (MIT) instead.
- GSAP: Custom non-SaaS license. Replace with Framer Motion (`motion`, MIT) v11.

See `Docs/exploration/OPEN_SOURCE_LICENSING.md` for full dependency audit.

---

## D-011 | 2026-05-25 | Replace GSAP with Framer Motion (motion, MIT)

**Decision:** Remove GSAP dependency. Use `motion` (Framer Motion v11, MIT) for all animations.

**Rationale:**
- GSAP's "No Charge" commercial license prohibits SaaS use without Club GSAP paid subscription
- `motion` (Framer Motion v11) is MIT, actively maintained, strong React integration
- API is different from GSAP but adequate for SentinelTwin's use: replay timelines, camera
  transitions, before/after animations

**Impact on architecture:** Update `Docs/architecture/07_RENDERING_PIPELINE.md` references to GSAP.

---

## D-012 | 2026-05-25 | IEC 62676-4:2025 OODPCVS as default coverage standard

**Decision:** SentinelTwin uses IEC 62676-4:2025 (OODPCVS, 7 levels) as the default
quality standard. IEC 62676-4:2014 (DORI, 4 levels) is supported as a legacy option.

**Rationale:**
- IEC 62676-4:2025 was published October 9, 2025 — it is the current standard
- DORI (2014) is superseded and may not be legally defensible for professional reports
- JVSG (the leading desktop tool) implemented OODPCVS in October 2025
- 7 levels (Overview/Outline/Discern/Perceive/Characterize/Validate/Scrutinize) are
  more granular and accurate for modern IP cameras

**Implementation impact:**
- `apps/studio/src/simulation/dori.ts`: OODPCVS_THRESHOLDS (7-level), ppmToOodpcvsQuality(), full QUALITY_SCORE_MAP
- `apps/studio/src/schema/security-scene.ts`: doriQualitySchema extended to 12 values, doriStandard: "dori_2014" | "oodpcvs_2025" with Zod transform for legacy values
- `apps/studio/src/simulation/coverage.ts`: getQualityThresholds dispatches to ppmToOodpcvsQuality() in oodpcvs_2025 mode; cells store actual quality name; getQualityShare uses qualityToScore() matching
- `apps/studio/src/simulation/simulate-studio.ts`: coverageByQuality uses score-based buckets
- `apps/studio/src/report/index.ts`: standardsRef derives from scene's doriStandard
- `apps/studio/src/lib/quality-display.ts`: canonical QUALITY_LABEL, QUALITY_ABBR, QUALITY_COLOR, QUALITY_BAR_COLOR, QUALITY_RANK
- 6 display maps updated with full OODPCVS entries
- InspectorPanel, CameraViewMode DORI ranges respect scene PPM thresholds

**Open question:** Exact PPM thresholds for OODPCVS — see Q-016 in OPEN_QUESTIONS.md.

---

## D-013 | 2026-05-25 | Use VGGT (MIT) instead of DUSt3R/MASt3R for multi-photo 3D

**Decision:** VGGT (MIT) is the primary multi-photo 3D reconstruction tool for V0.3+.
DUSt3R and MASt3R (both CC BY-NC-SA 4.0) are prohibited for commercial use.

**Rationale:**
- DUSt3R and MASt3R are CC BY-NC-SA 4.0 — cannot be used in commercial product
- VGGT appears MIT licensed — verify before V0.3 work begins (Q-018)
- VGGT functionality (few/many views → camera poses + point maps + depth) is equivalent
- If VGGT fails: fallback is COLMAP (BSD licensed, classical SfM)

**Action required:** Verify VGGT's actual license at the GitHub repo before building on it.

---

## D-014 | 2026-05-25 | OpenAI Codex for parallel build tasks

**Decision:** OpenAI Codex is used as a parallel coding agent, not just an assistant.
Multiple Codex sandboxes run simultaneously on separate sub-tasks of the same phase.

**Pattern:**
- Developer writes the spec (in Docs/todos/PHASE_N.md and architecture docs)
- Codex reads AGENTS.md + CLAUDE.md first (repo instructions)
- Multiple Codex tasks run in parallel on independent sub-modules
- Developer reviews PRs, merges good work, corrects errors

**Why this works:** The documentation-first approach means Codex has enough context
to build correctly. AGENTS.md is the key synchronization mechanism across parallel tasks.

**Hackathon narrative:** This is how parallel development at this scale is possible solo.

---

## D-015 | 2026-05-25 | Documentation-first is the build methodology

**Decision:** Documentation is part of delivery, not optional polish.
A feature is not done until its architecture docs, decision log entries, and
open questions are updated. This is a hard requirement, not a preference.

**Why it matters for multi-agent builds:**
- 4+ agents (Codex, Claude Code, etc.) run in parallel on the same codebase
- Documentation is the only reliable shared context between parallel agents
- Without docs, agents make inconsistent decisions about architecture
- With docs, parallel agents can build correct, coherent, non-conflicting work

**Enforcement:**
- Phase completion criteria in Docs/todos/ include documentation updates
- AGENTS.md and CLAUDE.md explicitly state: "Documentation is part of delivery"
- Every PR should update relevant docs alongside code changes

---

## D-042 | 2026-05-27 | Camera sensor specs deferred to V0.2+

**Decision:** Do not add `sensorWidthMm`, `sensorHeightMm`, or `sensorFormat` to the CameraNode schema for V0.1. Current approach (FOV entered directly, resolution width optional with fallback) is sufficient.

**Rationale:**
- Adding sensor specs would require `FOV = 2 × arctan(sensorWidth / (2 × focalLength))` derivation, schema migration, and preset updates — for zero change in coverage output
- Users enter FOV directly, which is the most intuitive camera parameter
- Generic preset library has no real camera models needing sensor-accurate FOV
- Sensor specs only matter when focal length differs from FOV — not a realistic V0.1 workflow

**When to revisit:**
1. Camera preset library grows to include real models (CP Plus, Hikvision, Axis)
2. User reports FOV mismatch with a real camera
3. "Enter lens + sensor, derive FOV" is requested as a feature

**Research location:** Thread 114 in `Docs/exploration/EXPLORATION_MAP.md`. Full sensor size table documented there.
