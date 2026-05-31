## New Decisions — Added 2026-05-25 (updated 2026-05-31)

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

---

## D-026 | 2026-05-29 | 4-question audit standard for all rendering/runtime audits

**Decision:** Every future framework audit report must answer 4 actionability questions
for each "not found" or "deferred" result.

**Standard questions:**
1. **Should this be used now?** — Is there a current need for this capability?
2. **Where first?** — Which surface/subsystem is the natural entry point?
3. **At what implementation level?** — Custom code, library integration, or architectural change?
4. **When to trigger?** — What activation criteria must be met before implementing?

**Rationale:**
- The R3F/Drei audit (`Docs/decisions/R3F_DREI_FULL_AUDIT_2026-05-29.md`) produced 3 findings
  (post-processing, shaders, geometry optimization) that were technically accurate but not
  execution-ready. The audit was descriptive when it should have been actionable.
- Applying the 4-question pattern after the fact made each finding immediately actionable
  for the next available sprint.

**Adopted for:**
- All future rendering/runtime/audit reports
- Recommended but not required for AI model evaluations and product research threads

**Related:** `Docs/decisions/R3F_DREI_FULL_AUDIT_2026-05-29.md` (Thread 51 in EXPLORATION_MAP).

---

## D-027 | 2026-05-31 | Rendering runtime stack closure — verified against source of truth

**Decision:** The rendering runtime stack is closed and verified against `apps/studio/package.json`.
`07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md` is the canonical runtime truth snapshot.

**Resolution:**
- GSAP is NOT a runtime dependency — confirmed absent from all source code and `package.json`.
- `framer-motion ^12.40.0` (MIT, per D-011) is the active animation library.
- All 14 non-origin docs files that referenced GSAP have been resolved:
  - **Base docs:** Retain historical references per addendum convention (provenance of the decision process).
  - **Addendums:** `OPEN_QUESTIONS_ADDENDUM.md` (Q-017 resolved), `DECISION_LOG_ADDENDUM.md` (this entry),
    `07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md` (runtime truth), `EXPLORATION_MAP.md` (thread findings).
  - **Updated in-place:** `07_RENDERING_PIPELINE.md` addendum banner + corrected stack,
    `OPEN_QUESTIONS.md` D-018 marked resolved.

**Verification evidence:**
- `grep -rn -i 'gsap|green[sS]ock' apps/ --include='*.ts' --include='*.tsx'` = 0 results in source code.
- `grep -rn -i 'gsap' Docs/ --include='*.md' -l` = 14 files, all non-origin confirmed as historical.
- `apps/studio/package.json`: `framer-motion: ^12.40.0`, no GSAP entry.

**Documents retaining GSAP references (historical only):**
1. `Docs/architecture/07_RENDERING_PIPELINE.md`*  
2. `Docs/architecture/07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md`*  
3. `Docs/decisions/DECISION_LOG.md`
4. `Docs/decisions/DECISION_LOG_ADDENDUM.md`*
5. `Docs/decisions/OPEN_QUESTIONS.md`*
6. `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md`*
7. `Docs/decisions/PRE_BUILD_DISCUSSION_LOG.md`
8. `Docs/decisions/WIDE_OPEN_BRAINSTORM_2026-05-26.md`
9. `Docs/decisions/R3F_DREI_FULL_AUDIT_2026-05-29.md`
10. `Docs/exploration/OPEN_SOURCE_LICENSING.md`
11. `Docs/exploration/EXPLORATION_MAP.md`*

  * = Updated with resolution cross-references during this closure pass.

**Policy for all future GSAP questions:**
- Direct to D-011, D-018, D-259 in `DECISION_LOG.md`, and D-027 in this addendum.
- Do not re-open. The decision is closed.

---

## D-028 | 2026-05-31 | Addendum convention — resolve stale doc references without editing base docs

**Decision:** When base docs contain stale references that are historically accurate for the time
of writing, and the resolution is documented elsewhere, create or update addendums rather than
editing the base documents in-place.

**Rationale:**
- Base docs are records of the decision-making process at a point in time. Editing them erases
  provenance for how and why decisions evolved.
- Addendums supersede base docs without destroying them. Future readers can see both the
  original thinking and the resolution, side by side.
- This aligns with the existing addendum pattern (`07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md`,
  `DECISION_LOG_ADDENDUM.md`, `OPEN_QUESTIONS_ADDENDUM.md`).

**Exception:** In-place edits are acceptable for:
- Cross-reference banners ("This doc has been superseded — see addendum X")
- Correcting factual errors that would mislead a new reader
- Minor version/version-drift corrections that don't affect decision provenance

**Policy for resolution documentation:**
1. Identify all docs files with stale references (via grep or find).
2. Group by topic (e.g., GSAP references across 14 docs).
3. Create/update one addendum per topic with: what was resolved, where cross-references live,
   and the verification evidence.
4. Optionally add cross-reference banners to high-traffic base docs so readers find the addendum.
