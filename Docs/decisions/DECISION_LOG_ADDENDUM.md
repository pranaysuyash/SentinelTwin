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

## D-043 | 2026-06-01 | Dimension A no-floor-plan readiness contract becomes canonical

**Decision:** Promote `SiteTwinDraftReadiness` to a canonical, cross-flow contract for all draft intake paths (`scan`, AI draft, floor-plan, JSON, manual, camera evidence), and gate approval/simulation messaging through this single readiness policy.

**Rationale:**
- Dimension-A work requires explicit go/no-go behavior for `scan` and advisory versus production-safe recommendation output.
- Previous enforcement used scattered warning checks, causing mixed behavior across flows.
- Simulation trust requires one policy signal that combines prerequisites, warning severity, and confidence.

**Canonical behavior now required:**
1. `SiteCompilerResult` carries readiness (`deploy-ready`, `review-required`, `insufficient`).
2. `SiteTwinDraft` carries readiness into review and approval surfaces without translation drift.
3. Approval remains blocked only when readiness is `insufficient`; `review-required` remains allowed as advisory.
4. `Docs/exploration/EXPLORATION_MAP.md` Thread 98A tracks this as an implemented stage gate tied to the checklist.

**Updated in this pass:**
- `apps/studio/src/lib/site-compiler.ts`
- `apps/studio/src/lib/site-draft-approval.ts`
- `apps/studio/src/components/site-intake/SiteDraftReview.tsx`
- `apps/studio/src/app/page.tsx`
- `apps/studio/src/hooks/use-studio-navigation.ts`
- `apps/studio/src/lib/scan-to-scene.ts`
- `Docs/exploration/EXPLORATION_MAP.md`
- `Docs/todos/no-floor-plan-readiness-checklist.md`

**Open follow-up (kept):**
- Role-aware policy thresholds (`security consultant` vs `facilities director`).
- Scenario-layer and temporary-mode semantics for emergency/perimeter workflows.

## D-044 | 2026-06-01 | Dimension-A role-aware review policy is now additive, not schema-breaking

**Decision:** Implement role-aware recommendation posture in the no-floor-plan review lane without changing
`WorkspaceRole` or introducing backend role extensions.

**Rationale:**
- Users identified a concrete v1 gap: recommendations were readable but not yet tailored to
  `security consultant` versus `facilities director` consumer expectations.
- Dimension-A required a deterministic advisory-vs-production-safe narrative at the review gate
  while preserving current readiness gates (`canSimulate` / `canRecommend`).
- No new API or schema changes were needed; the policy can be enforced by read-only UI policy mapping.

**Behavior now required at `SiteDraftReview`:**
1. Resolution of active role into a persona policy (`consultant`, `facilities_director`, `operations_manager`, `auditor` family mapping).
2. Approval-action labels now indicate the intended consumer posture (e.g., advisory draft vs operations readiness draft) when `review-required`.
3. Readiness message block now explains impact in role-specific language:
   - consultant-oriented language emphasizes evidence-signoff and client advisory posture,
   - facilities/operator-oriented language emphasizes deployment planning sequencing,
   - audit/insurer-oriented language emphasizes evidence readiness and packet controls.
4. Insufficient state remains hard-blocked for hard recommendations in all personas.

**Code anchors updated in this pass:**
- `apps/studio/src/components/site-intake/SiteDraftReview.tsx`
- `apps/studio/src/components/product/ProductViewRouter.tsx`

**Remaining follow-up:** Extend the same role-posture split to report/export surfaces and temporary-control scenario escalation (A5/A6/A7).

## D-045 | 2026-06-01 | Dimension-A temporary/permanent split enters scan assumptions contract

**Decision:** Treat operational profile as first-class no-floor-plan context in scan mode by persisting
`operationalMode` and `operationalContext` in `ScanSession`, `SecurityScene.assumptions`, and draft assumptions.

**Rationale:** Temporary operations (VIP sweeps, emergency readiness, event control windows) were discussed as
the next frontier for no-floor-plan intake, but earlier pipeline paths treated this as workflow discipline only.
Dimension-A requires explicit evidence of whether a scene is baseline or temporary when recommending actions.

**Canonical behavior now required:**
1. `ScanSession` always carries an explicit operational mode with optional context fields.
2. `compileScanSessionToScene` persists this data into `scene.assumptions`.
3. Temporary mode lacking perimeter / entry-control markers emits `TEMPORARY_PERIMETER` warning.
4. `site-compiler` includes operational assumptions in `SiteTwinDraft.assumptions`, and scan provenance notes include
operational context lines for evidence continuity.

**Updated in this pass:**
- `apps/studio/src/lib/scan-to-scene.ts`
- `apps/studio/src/schema/security-scene.ts`
- `apps/studio/src/lib/site-compiler.ts`
- `apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx`
- `apps/studio/src/lib/__tests__/scan-to-scene.test.ts`
- `Docs/todos/no-floor-plan-readiness-checklist.md`
- `Docs/exploration/EXPLORATION_MAP.md`

**Open follow-up (kept):**
- Define and implement a durable scenario envelope/teardown workflow for A6 (apply, verify, retire temporary controls).
- Decide whether temporary operational assumptions should become a first-class event profile in all intake paths, not scan-only.

## D-046 | 2026-06-01 | Dimension-A temporary envelope + teardown lock added for scan and reconstruction

**Decision:** Finalize the temporary-event contract across both scan-to-scene pipelines by persisting a durable
`operationalScenarioEnvelope` in `SecurityScene.assumptions`, including required controls, rollback plan, and
scenario windowing. Use this envelope in draft assumptions and review surfaces so temporary posture is explicit
before recommendations move from advisory to production sequencing.

**Rationale:**
- A6 required a concrete split between permanent and temporary posture with evidence that rollback is enforced.
- Reconstruction and scan flows were diverging in operational metadata depth; both must produce equivalent
  assumptions output so the intake contract is stable.
- Review UI currently supports deterministic, role-aware policy messaging, so temporary control evidence must be
  visible at the same gate.

**Canonical behavior now required:**
1. In `compileScanSessionToScene` and `compileReconstructionToScene`, assign `scene.assumptions.operationalMode` and optional
   `scene.assumptions.operationalContext` when available.
2. In temporary mode, populate `scene.assumptions.operationalScenarioEnvelope` with profile metadata, control list,
   and mandatory rollback requirements before compile validation.
3. In `deriveAssumptions`, emit scenario envelope, window, controls, mandatory teardown, and optional rollback steps
   as structured draft assumptions.
4. In review UI, show temporary scenario assumptions in a dedicated operational block so temporary posture is visible at approval.

**Updated in this pass:**
- `apps/studio/src/lib/scan-reconstruction.ts`
- `apps/studio/src/lib/site-compiler.ts`
- `apps/studio/src/components/site-intake/SiteDraftReview.tsx`
- `Docs/todos/no-floor-plan-readiness-checklist.md`
- `Docs/exploration/EXPLORATION_MAP.md`
- `Docs/decisions/DECISION_LOG_ADDENDUM.md`

**Open follow-up (kept):**
- Define and validate the rollout/teardown "done" signal in the operator evidence packet (artifact checklist, signoff, timestamp).

## D-047 | 2026-06-01 | Dimension-A scenario arbitration includes temporary escalation path

**Decision:** Add explicit scenario-level escalation for temporary emergency/perimeter workflows across scan
compilation and governance so temporary-mode advisories remain visible and enforce admin-aware review routes.

**Rationale:** Temporary-event scenes could be operationally dangerous if treated as deploy-ready simply because
base coverage gates pass. Scenario context (emergency window, temporary perimeter, staffing lockdown) must drive a stronger
approval posture regardless of coverage math.

**Canonical behavior now required:**
1. `scan-to-scene` and `scan-reconstruction` emit `SCENARIO_ESCALATION_REQUIRED` for temporary emergency/perimeter
   context during compile.
2. Escalation warnings keep `readiness.canRecommend = false` and preserve `canSimulate = true` so planners can run
   deterministic simulation without prematurely approving deployment-ready recommendations.
3. `resolveApprovalRoute` treats scenario escalation as admin-gated review for publish workflows.
4. `SiteDraftReview` exposes an explicit scenario escalation block with scope/control/rollback visibility for operators.

**Updated in this pass:**
- `apps/studio/src/lib/scan-to-scene.ts`
- `apps/studio/src/lib/scan-reconstruction.ts`
- `apps/studio/src/lib/scan-artifacts.ts`
- `apps/studio/src/lib/workspace-governance.ts`
- `apps/studio/src/components/site-intake/SiteDraftReview.tsx`
- `apps/studio/src/lib/__tests__/scan-to-scene.test.ts`
- `apps/studio/src/lib/__tests__/scan-reconstruction.test.ts`
- `apps/studio/src/lib/__tests__/workspace-governance.test.ts`
- `Docs/todos/no-floor-plan-readiness-checklist.md`
- `Docs/exploration/EXPLORATION_MAP.md`

## D-048 | 2026-06-01 | Dimension-A A7 legal/commercial framing finalized for report exports

**Decision:** Finalize role-specific legal/commercial framing for no-floor-plan advisory outputs by adding
distribution-safe report messaging and boundary language for consultant/facilities director/operations manager
audiences in the report generation package.

**Rationale:**
- A7 required a closure on public/commercial wording and the advisory-vs. implementation split before A9 lock.
- Role-aware narratives were present in review UI, but report exports needed dedicated legal/commercial framing and
  explicit boundary language for distribution.
- This update keeps `consultant` and `facilities_director` as primary customer-facing personas, with `operations_manager`
  preserved for temporary-control readiness and rollout sequencing.

**Canonical behavior now required:**
1. `@sentineltwin/report` exposes audience-specific commercial framing with distribution and internal-use copies.
2. Distribution mode changes in `applyReportVisibility` update the active distribution message while preserving
   legal boundary and internal handling.
3. All export surfaces (`markdown`, `html`, `text`) include a legal-commercial framing block so commercial reviewers
   and operators receive the correct trust boundary.
4. Preset catalogue includes a dedicated consultant distribution-ready export option for client-facing packets.

**Updated in this pass:**
- `packages/report/src/index.ts`
- `Docs/todos/no-floor-plan-readiness-checklist.md`
- `Docs/exploration/EXPLORATION_MAP.md`

## D-296 | 2026-06-02 | Workspace & site creation system — read-only code-base exploration

**Decision:** Document the full workspace/site creation surface as it exists today, in a single
durable exploration document, as a launchpad for any new component touching creation flows.

**Rationale:**
- A future component was being designed against an inferred model. The cost of guessing was
  drift. D-015 (documentation-first) requires we write it down.
- The creation surface is broad: 6 source types × 6 intake methods × 12+ node types × 5 prompt
  stages × 4 view modes × 9 store slices × 9 localStorage keys × 24 context actions × 4 context
  action groups. A 1-page reference is the only way to keep mental model in sync.
- D-296 deliberately adds a *new* durable doc rather than overloading
  `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md` (which tracks shipping state) or
  `Docs/todos/FULL_VISION_GAP_INVENTORY.md` (which sequences next slices). This is a
  read-only surface reference, distinct in kind.
- D-296 establishes a *naming convention* for future exploration docs:
  `Docs/exploration/EXPLORATION_<TOPIC>_<YYYY-MM-DD>.md`. The
  `Docs/exploration/THREEJS_3D_RENDERING_SKILLS_INVENTORY_2026-05-29.md` and
  `Docs/exploration/KENNEY_SENTINELTWIN_ASSET_PLAN_2026-05-27.md` precedents
  confirm this is the right pattern.

**Canonical behavior now required:**
1. Any new component touching creation flows reads the new doc first.
2. EXPLORATION_MAP.md gains Thread 99 (a one-paragraph summary with a link to the durable doc)
   and never replaces prior threads (per the existing "append, don't replace" rule).
3. New Q-041, Q-042, Q-043 are filed in `OPEN_QUESTIONS_ADDENDUM.md` (P0/P1) as structural
   tensions surfaced by the read.

**Updated in this pass:**
- `Docs/exploration/EXPLORATION_WORKSPACE_CREATION_2026-06-02.md` (new)
- `Docs/exploration/EXPLORATION_MAP.md` (Thread 99 appended)
- `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md` (Q-019, Q-020, Q-021 added)

## D-328 | 2026-07-07 | Multi-Floor Architecture & Pascal Fork Resolution (Q-041 Resolved)

**Decision:** SentinelTwin implements multi-floor building support by extending its native flat `SecurityScene` schema with a `levels: Level[]` collection and optional `levelId?: string` assignments across all 15 node collections (`cameras`, `walls`, `doors`, `windows`, `obstructions`, `criticalZones`, `privacyZones`, `sensors`, `lights`, `paths`, `comments`, `entryPoints`, `fences`, `gates`, `bollards`). We explicitly reject reactivating the parked `@pascalapp/core` fork or adopting its heavy Site → Building → Level hierarchy and flat-dictionary store. In Studio, multi-floor editing is governed by `activeLevelId` and `activeLevelMode` ("solo" | "stacked") in `layout-slice`, with `useFilteredScene()` providing dynamic store filtering. When an operator deletes a floor via `deleteLevel`, all assigned nodes across all 15 collections are cleanly purged to prevent orphan geometry and maintain store integrity.

**Rationale:**
- Per long-term first principles and motto_v3 ("if the fork regresses the app, we nit-pick the better stuff"), reactivating the full Pascal Editor fork would have introduced massive architectural churn, breaking SentinelTwin's deterministic raycasting engine, Zod validation schemas, and React Three Fiber rendering pipeline.
- Extending our flat schema with `levels` and `levelId` achieves full multi-floor capability (floor switching, solo/stacked visualization, per-floor node attribution) while preserving 100% backward compatibility for single-floor scenes (where `levelId` is undefined).
- Automatic level assignment in `addNode` and comprehensive multi-collection cleanup in `deleteLevel` ensure that operators editing specific floors never create orphan nodes or experience referential integrity failures.

**Alternatives rejected:**
- Reactivating `@pascalapp/core` and porting SentinelTwin to its flat-dictionary store: rejected because it would regress the simulation engine and violate our typed Zod schema foundation.
- Designing a separate multi-scene hierarchy where each floor is a distinct `SecurityScene`: rejected per D-002 (single source of truth); multi-floor risk models must compute vertical stairwells, outdoor coverage, and whole-building metrics across floors in a single scene document.

**Updated in this pass:**
- `packages/core/src/schema/security-scene.ts` (levels collection and levelId assignments)
- `apps/studio/src/store/slices/core/scene-slice.ts` (addLevel, deleteLevel cleanup, addNode level attribution)
- `apps/studio/src/store/slices/core/layout-slice.ts` (activeLevelId, activeLevelMode)
- `apps/studio/src/store/studio-store.ts` (useFilteredScene selector)
- `apps/studio/src/components/workspace/overlays/LevelSwitcher.tsx` (UI switcher)
- `packages/core/src/__tests__/multi-floor-schema.test.ts` (verified schema tests)
- `apps/studio/src/schema/__tests__/multi-floor-store.test.ts` (verified store & cleanup tests)
- `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md` (Q-041 resolved)

---

## D-327 | 2026-07-07 | Canonical 4-Step Creation Flow Shell (Q-043 Resolved)

**Decision:** The intake and creation lifecycle across Studio (`SiteIntakeHub`, `SiteDraftReview`, and onboarding steps) is standardized around a canonical layout wrapper: `CreationFlowShell.tsx`. This shell enforces a consistent 4-step stepper (1. Source Intake, 2. AI Compilation, 3. Review Draft, 4. Studio Testbed) and a unified header displaying provenance, maturity badges, and warning-gated confidence via `renderConfidence` (Trust Pass T1).

**Rationale:**
- Prior to this standardization, the creation flow suffered from UI fragmentation: switching from intake selection (`SiteIntakeHub`) to review (`SiteDraftReview`) caused jarring layout shifts, inconsistent header titles, and differing confidence formatting.
- Establishing a single container component (`CreationFlowShell`) ensures visual continuity, predictable navigation (Back / Return to Studio), and adherence to the layout rhythm and density defined in `SentinelTwin_UI_Design_Pack.md` (OQ-UI-03 Option 4 canonical).
- It unifies the intake lifecycle from `SiteIntakeSession` → `SiteTwinDraft` → `SiteDraftApprovalResult` without requiring parallel state models or unbounded rewrites.

**Alternatives rejected:**
- Maintaining separate header and layout implementations per intake stage: rejected because it creates visual drift, duplicates confidence gating logic, and violates UI design pack alignment.

**Updated in this pass:**
- `apps/studio/src/components/site-intake/CreationFlowShell.tsx` (new canonical shell)
- `apps/studio/src/components/site-intake/SiteIntakeHub.tsx` (rewired to compose inside CreationFlowShell)
- `apps/studio/src/components/site-intake/SiteDraftReview.tsx` (rewired to compose inside CreationFlowShell)
- `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md` (Q-043 resolved)

---

## D-325 | 2026-07-07 | Canonical Schema Deduplication via Re-Export Shim

**Decision:** The frontend Studio application (`apps/studio/src/schema/security-scene.ts`) strictly re-exports the canonical `SecurityScene` schema and Zod definitions from `@sentineltwin/core`. No parallel type definitions or duplicate Zod schemas are permitted in `studio`, `viewer`, `editor`, `simulation`, or `report`.

**Rationale:**
- SentinelTwin is built around the fundamental rule that `SecurityScene` is the single source of truth across all packages, simulation engines, UI panels, and AI agent prompts (D-002).
- Defining duplicate or parallel interfaces in consuming apps risks silent schema drift where frontend components expect properties that simulation engines or backend validators do not know about.
- A 1-line re-export shim (`export * from "@sentineltwin/core";`) preserves clean local import paths (`@/schema/security-scene`) while guaranteeing 100% type and runtime schema identity across the entire monorepo.

**Alternatives rejected:**
- Maintaining a separate UI-specific scene interface in `studio`: rejected because it violates D-002 (no parallel scene representations) and causes type mismatches during serialization/simulation.

**Updated in this pass:**
- `apps/studio/src/schema/security-scene.ts` (verified re-export shim)
- `apps/studio/src/schema/organization.ts` (verified re-export shim)
- `apps/studio/src/schema/SceneOperation.ts` (verified re-export shim)
- `apps/studio/src/lib/workspace-catalog.ts` (verified re-export shim)
- `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md` (Q-042 resolved)

---

## D-326 | 2026-07-07 | App-wide UI exposure dial: showcase / focused / full chrome postures

**Decision:** One store-backed dial (`uiExposure` in layout-slice, persisted) composes the chrome controls that already existed (`visibleComponents`, dock collapse, `clientDemoOptions`, hint bars) into three coherent postures: **showcase** (sales demos: canvas-first, docks collapsed, simplified labels, hints/compass/minimap quiet), **focused** (default working posture: contextual docks, hints on, debug lanes hidden), **full** (everything pinned, debug/governance lanes included). Presets live in `apps/studio/src/lib/ui-exposure.ts`; the switcher is the DEMO/WORK/PRO cycle button in `ViewControls`. The dial is a composer, not a lock — it applies a preset over the existing toggles and users can still override any single control afterwards. Nothing is removed at any level.

**Why (the Pascal lesson):** pascalorg/editor's entire editor chrome is ~5 components — one toolbar, contextual tooltips, a save button, a scene loader. Its smoothness is not animation polish; it is that the default surface is one canvas + one toolbar and everything else is progressive disclosure. SentinelTwin had ~12 chrome regions on by default (docks, hint bar, compass, minimap, legend, status, banners), each individually well-built but collectively overwhelming — especially in a sales demo. The levers existed; the missing piece was a single composed default.

**Adoption path:** any new chrome must consume `visibleComponents`/`uiExposure` gating rather than rendering unconditionally. Surfaces not yet gated (product home rails, launcher maturity chips) adopt the same dial incrementally — tracked as follow-up, not silently dropped.

**Files:** `lib/ui-exposure.ts` (+ 4 unit tests), `store/slices/core/layout-slice.ts`, `workspace/overlays/ViewControls.tsx`.

---

## D-331 | 2026-07-08 | LevelSwitcher (D-328 multi-floor) gated through the D-326 exposure dial

**Decision:** `LevelSwitcher.tsx` — the multi-floor level picker landed by the parallel D-328 (Q-041) work — was mounting unconditionally as permanent top-left canvas chrome, including for the overwhelming majority of scenes that have zero or one floor. Added `level_switcher` as a new `WorkspaceComponentId`, wired it into `BASE_COMPONENT_VISIBILITY`, the `showcase`/`focused`/`full` exposure presets (hidden in showcase, visible otherwise — same treatment as `north_compass`/`control_hint_bar`), the View Settings component-toggle list, and gated the `WorkspaceCanvas.tsx` mount behind `visibleComponents.level_switcher`.

**Why this couldn't just be deleted or hidden outright:** `LevelSwitcher` is the *only* UI entry point that calls the `addLevel` store action (confirmed via full-codebase search before touching it). Hiding it unconditionally for the zero-level case would have silently removed the only way to create a building's first floor — a real feature regression, not a chrome cleanup. Gating through the existing exposure system (built earlier the same day, D-326) preserves 100% of the capability while fixing the clutter: `focused`/`full` show it by default so the capability stays fully discoverable, and `showcase` hides it along with the other ambient chrome for sales demos, exactly as D-326 already specified for exactly this situation ("any new chrome must consume visibleComponents/uiExposure gating rather than rendering unconditionally").

**How this was found:** discovered during pre-commit due diligence on a large parallel-session diff (D-325 schema dedup, D-327 CreationFlowShell, D-328 multi-floor, D-329 org/catalog model, D-330 compliance reporting, all committed in `9fb0b20` before this session's own work landed) rather than by request — the diff review itself is documented as its own practice going forward for any commit that merges concurrent-agent work.

**Also fixed in the same pass (real, not cosmetic, breakage found via `tsc --noEmit` + `bun test` re-run against the full merged tree):**
- `apps/studio/src/lib/__tests__/live-evidence.test.ts`: added the now-required `levels: []` field to a hand-typed `SecurityScene` literal (D-328 made `levels` a non-optional field on the inferred TS type via Zod `.default([])`).
- `apps/studio/src/schema/__tests__/multi-floor-store.test.ts`: removed a `label` field that doesn't exist on `CameraNode` (schema field is `name`), and replaced three hand-rolled, under-specified camera literals with the canonical `createCameraNode()` factory from `@sentineltwin/core` (avoids re-inventing the ~20-field camera contract per test and stays correct as the schema evolves).
- `apps/studio/src/store/slices/core/scene-slice.ts`: `addLevel`'s declared type required `id`, but the implementation always generates one when omitted (`levelInput.id || \`lvl_${...}\``) — narrowed the type to `Omit<SceneLevel, "id"> & { id?: string }` so the signature is honest about the real contract instead of the test having to fabricate an id the implementation would ignore.
- `packages/report`: `tsc --noEmit` was failing on stale composite-build references into `packages/core/dist` — resolved by rebuilding via the already-documented `tsc -b --force` (D-286), not a new workaround.

**Files:** `apps/studio/src/store/slices/core/layout-slice.ts`, `apps/studio/src/lib/workspace-layouts.ts`, `apps/studio/src/lib/ui-exposure.ts` (+ 1 new test), `apps/studio/src/components/layout/ViewSettingsModal.tsx`, `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`, `apps/studio/src/lib/__tests__/live-evidence.test.ts`, `apps/studio/src/schema/__tests__/multi-floor-store.test.ts`, `apps/studio/src/store/slices/core/scene-slice.ts`.

---

## D-324 | 2026-07-07 | Native-style transform gizmo + quiet hover chrome (no feature removals)

**Decision:** Object manipulation now uses an industry-standard gizmo (Unity/three.js editor convention): red X arrow and blue Z arrow for axis-constrained moves, green up-arrow for height, a circular ground ring for rotation, and a center puck for free move — with hover-highlighted parts and hover-only labels. The gizmo is presentation only: every part routes into the existing `TransformHandles` drag machinery (SnapEngine, preview, `updateNode` commit, undo, evidence trail). New `move_x` / `move_z` handle kinds add axis-constrained movement (`constrainMoveDelta`, unit-tested); all previous handle kinds (wall endpoints, polygon/path vertices, midpoint inserts, camera pitch, obstruction W/D scale) are preserved, with inserts and secondary handles dimmed until hovered. Sensors — previously not manipulable on canvas — get the same move gizmo, and sensors were added to the selection lookup.

**Why not `THREE.TransformControls` / drei `<TransformControls>`:** the stock control mutates an `Object3D` matrix directly, which would bypass the snap engine, schema validation, store commit/undo, and the evidence ledger — and half our nodes are not single transforms (walls are segments, zones are polygons, obstruction height re-anchors the pivot). Building the native *look* (arrows + ring, screen-constant scale via `GizmoRig`, depth-test-off overdraw) on the canonical drag pipeline keeps determinism and topology editing intact.

**Hover overload fixes (features kept, presentation gated):**
- Heatmap cell explainability card is dwell-gated (~350 ms pointer rest), never shows while a mouse button is held (orbit/box-select/drag sweeps used to pop it constantly), and hides during transforms.
- Handle labels appear only when the pointer is over a handle; midpoint insert handles render at 45% opacity until hovered.
- `SelectionContextBar` already hid while transforming; unchanged.

**Also in this pass:** `PCFSoftShadowMap` (deprecated in three r184, warned once per canvas) replaced with `PCFShadowMap` across `r3f-rendering.ts` and all `<Canvas shadows>` call sites; `PlanView2D` now measures its container immediately (ResizeObserver alone never fires in throttled background tabs); dev-only `window.__SENTINEL_STUDIO_STORE__` handle for DevTools/QA automation.

**Files:** `editing/GizmoParts.tsx` (new), `editing/TransformHandles.tsx`, `editing/__tests__/gizmo-constraints.test.ts` (new), `WorkspaceCanvas.tsx`, `PlanView2D.tsx`, `lib/r3f-rendering.ts` (+ test), `store/studio-store.ts`, view canvases (shadow prop).

---

## D-323 | 2026-07-07 | Three-mode canvas: 3D orbit, 2.5D orthographic, and a true-2D architectural plan built on the map subsystem

**Decision:** The workspace canvas now has three explicit representations. `orbit_3d` (unchanged) and `topdown_2d` — now labeled **2.5D** in the UI because it is an orthographic top-down projection of the extruded 3D geometry — remain R3F surfaces. A new `plan_2d` mode renders a **true 2D architectural plan** through the existing SVG map subsystem (`MapCanvas` / `MapLayers` / `MapProjection`, the same layers behind the minimap and path map), extended with an `architectural` rendering pass: walls drawn at real thickness with a poché core, door swing arcs (hinge + quarter-circle, suppressed for locked doors), wall-aligned window glazing lines, camera FOV wedges, zone fills, and the coverage heatmap.

**Rationale:**
- The previous "2D" button was an orthographic 3D camera — useful, but not a floor plan. Security consultants and stakeholders read plans; a real plan view makes the twin legible in the format the industry already uses.
- D-002 forbids parallel scene representations: the plan view renders from the same `SecurityScene` through the already-canonical map layers instead of a new renderer. The architectural pass is a flag on `MapLayers`, so the minimap/path map inherit zero behavior change.
- Door/window orientation comes from `wallId` when present, otherwise the nearest wall segment (`nearestWallAngle` in `map-geometry.ts`) — no new schema fields needed.
- Selection routes through the canonical store (`selectNode`), so the inspector (including the D-322 appearance sections) works identically in 2D.

**Scope note:** the plan view is a review/selection surface in this pass; placement/drawing tools remain in the 3D/2.5D modes. Extending the tool rail into the plan is the natural next step and shares `MapProjection.svgToScene`.

**Implementation impact:**
- `CanvasMode` gains `plan_2d` (`layout-slice.ts`, `workspace-layouts.ts` guard); `MapState` gains a `planView` viewport (zoom/pan/fit generalized in `scene-slice.ts`, defaults in governance/telemetry slices).
- `map-geometry.ts`: `nearestWallAngle`, `doorSwingPath`, `wallAlignedSegment` (+ unit tests in `__tests__/plan-geometry.test.ts`).
- `MapLayers.tsx` / `MapCanvas.tsx`: optional `architectural` prop.
- `components/workspace/PlanView2D.tsx` (new): container-measured plan surface wired to store selection/hover/layers/viewport; honors the shared `Reset canvas view` control.
- `WorkspaceCanvas.tsx`: renders `PlanView2D` instead of the R3F `<Canvas>` when `canvasMode === "plan_2d"`; `ViewControls.tsx` exposes the 3D / 2.5D / 2D triple toggle.

---

## D-322 | 2026-07-07 | Scene appearance layer: scene-persisted visual customization with Pascal-style material presets

**Decision:** SentinelTwin now has a first-class, user-editable visual customization layer. An optional `sceneAppearance` block on `SecurityScene` (in `@sentineltwin/core`) carries per-environment-mode lighting overrides (ambient/hemisphere/key/fill intensities, light colors, practical ceiling lights, background), fog (enabled/color/near/far), environment controls (IBL intensity scale, tone-mapping exposure, shadows), and default floor/wall surface materials. Walls, doors, windows, and obstructions additionally carry an optional per-node `appearance` override. Material customization follows the pattern adopted from pascalorg/editor (MIT): a preset id (`plaster`, `paint`, `brick`, `concrete`, `wood`, `tile`, `marble`, `carpet`, `metal`, `fabric`, `custom`) plus explicit PBR property overrides, resolved by a single merge function (`applyNodeAppearance`), with resolution precedence built-in spec → scene surface default → node override.

**Hard constraint:** the appearance layer is rendering-only. Simulation-relevant surface semantics stay in the existing `material` / `visionTransmission` fields; `cloneSecuritySceneSimulation` strips `sceneAppearance` so the coverage engine can never observe cosmetic state (D-003 determinism). Appearance edits route through `commitSceneChange` (undo/redo + evidence trail) with a new `markSimulationDirty: false` option so cosmetic changes never trigger recomputes.

**Rationale:**
- Lighting themes and textures were hardcoded in `SharedScene.tsx`; the only customization was the day/dusk/night mode switch. Buyers/consultants need site twins that read like their actual site (brick shopfront, wood floor, concrete warehouse), and the rendering roadmap (`Docs/exploration/3D_REALISTIC_RENDERING_ROADMAP_2026-07-04.md`) already called for a canonical material library.
- Persisting appearance inside `SecurityScene` keeps D-002 intact (single source of truth — appearance travels with export/import/snapshots) instead of creating a parallel per-workspace theme store.
- Pascal's preset + override + `resolveMaterial()` merge is a proven shape for this exact problem (their `packages/core/src/schema/material.ts`, `material-library.ts`, `scene-material.ts`), and adopting the pattern (not the code) keeps us aligned with the fork decision D-001 while D-010 keeps the full fork parked.
- Procedural canvas textures (no external assets, no network) preserve the local-first constraint for sensitive site reviews.

**Alternatives rejected:**
- View-level (non-persisted) appearance settings in View Settings: rejected — appearance is a property of the site twin document, not of the local layout; it must survive export/import and snapshots.
- Full texture-map pipeline (albedo/normal/roughness image uploads) as in Pascal's `MaterialPresetPayload.maps`: deferred — procedural styles cover the current need without asset management, uploads can extend `NodeAppearance` later without schema breakage.
- Reusing the simulation `material` enum for looks: rejected — conflates occlusion semantics with cosmetics and would let visual edits change coverage results.

**Implementation impact:**
- `packages/core/src/schema/security-scene.ts`: `appearancePresetIdSchema`, `nodeAppearanceSchema`, `environmentLightingOverrideSchema`, `sceneAppearanceSchema`; `appearance` on wall/door/window/obstruction nodes; `sceneAppearance` on the scene; stripped in `cloneSecuritySceneSimulation`.
- `apps/studio/src/lib/scene-appearance.ts` (new): canonical `ENVIRONMENT_THEMES` (moved from SharedScene), `APPEARANCE_PRESETS` catalog, `applyNodeAppearance`, `resolveAppearanceTextureStyle/Scale`, `resolveSceneLighting`, picker choice lists. Pure module, unit-tested.
- `apps/studio/src/lib/procedural-textures.ts` (new): canvas-generated albedo+normal pairs for tile/plaster/concrete/wood/carpet/marble/brick with style- and repeat-keyed caches (original floor/wall generators moved here from SharedScene).
- `apps/studio/src/components/workspace/SharedScene.tsx`: `SceneLighting`, `SceneFloor`, `SceneWalls`, `SceneDoors`, `SceneWindows`, `ObstructionGeometry` all resolve appearance; `SceneEnvironmentSetup` accepts IBL intensity scale + exposure; selection/locked/glass state styling always wins over cosmetic overrides.
- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`: canvas lighting/fog/shadows/background now come from `resolveSceneLighting`; floor/wall surface defaults passed through. Same for `CompareView`, `CameraWallView`, `PathReplayView`, `SceneFeedCanvas`.
- `apps/studio/src/store/slices/core/scene-slice.ts`: `updateSceneAppearance` + `updateNodeAppearance` actions; `commitSceneChange` gains the `markSimulationDirty` option.
- `apps/studio/src/components/inspector/SceneAppearancePanel.tsx` (new): scene-level editor shown in the inspector when nothing is selected (replaces the empty `NoSelection` state).
- `apps/studio/src/components/inspector/NodeAppearanceSection.tsx` (new) + `ColorInput` control: per-node appearance UI in `ObstructionInspector`, `WallInspector`, `DoorWindowInspector`.
- Tests: `apps/studio/src/lib/__tests__/scene-appearance.test.ts` (new), appearance cases in `apps/studio/src/schema/__tests__/security-scene.test.ts`, updated source-contract assertions in `inspector-panel.test.ts` / `workspace-canvas.test.ts`.

**Open questions:** OQ-3D-04 and OQ-3D-05 resolved by this decision (see `OPEN_QUESTIONS_ADDENDUM.md`). Image-based texture uploads and per-zone/floor-region materials remain future extensions.

---

## D-321 | 2026-07-01 | Camera Wall uses Drei PerformanceMonitor + AdaptiveDpr with a formal performance budget

**Decision:** Every R3F `<Canvas>` in `CameraWallView` is now wrapped with Drei's `<PerformanceMonitor>` and `<AdaptiveDpr pixelated />`. A new shared module, `@/lib/adaptive-dpr-budget`, defines the FPS thresholds, DPR ranges, and draw-call/GPU-memory budget constants for both wall and single-canvas modes. Dense mode gets a more aggressive DPR cap than quad/overview mode.

**Rationale:**
- The Camera Wall can render up to 16 live POV tiles plus a 3D overview map simultaneously. On lower-end GPUs the aggregate WebGL load can drop below interactive FPS.
- `PerformanceMonitor` measures per-tile FPS over a short sliding window and signals DPR adjustments; `AdaptiveDpr` applies them declaratively without per-tile state plumbing.
- `frameloop="demand"` is preserved so tiles only render when the simulation/playback actually changes, while the adaptive path still responds when continuous rendering happens (live feeds, replay playback).
- Dense mode deserves a distinct DPR range: 16 small tiles are more tolerant of pixelation than 4 large tiles, so we cap max DPR lower to protect aggregate GPU load.
- Security-critical overlays (heatmap, DORI, actor, blindspot highlights) must remain visible under degradation; DPR reduction is safe because it only lowers resolution, it does not remove layers.

**Alternatives rejected:**
- Manual `setPixelRatio` in `useEffect`: rejected because it fights R3F's own DPR management and is harder to test.
- Single global quality toggle instead of per-tile adaptation: rejected because different tiles have different load profiles (overview map renders the full heatmap; POV tiles render `SceneFeedGeometry`).
- Removing `frameloop="demand"` to give PerformanceMonitor more data: rejected because demand rendering is the larger win for static wall operation.

**Implementation impact:**
- `apps/studio/src/lib/adaptive-dpr-budget.ts` (new): unified budget constants + helpers for wall and single-canvas modes.
- `apps/studio/src/lib/camera-wall-performance-budget.ts` (updated): re-export shim for backwards compatibility.
- `apps/studio/src/components/view/CameraWallView.tsx`: wraps both the per-camera POV canvas and the `WallOverviewPanel` canvas; passes `isDense` through `CameraSlotButton` → `CameraFeedPanel` to select the right DPR range.
- `apps/studio/src/components/view/CameraViewMode.tsx`: single full-screen canvas wrapped with `PerformanceMonitor` + `AdaptiveDpr`, using the higher single-canvas DPR range.
- `apps/studio/src/components/view/PathReplayView.tsx`: full replay canvas wrapped with `PerformanceMonitor` + `AdaptiveDpr`, using the single-canvas budget.
- `apps/studio/src/components/view/__tests__/camera-wall-perf-guard.test.ts`: extended to assert PerformanceMonitor/AdaptiveDpr/budget integration for all three surfaces.
- `apps/studio/src/lib/__tests__/camera-wall-performance-budget.test.ts` (new): unit tests for the unified budget contract.

**Skills referenced:** `r3f-drei`, `threejs-performance`.

**Open questions:**
- OQ-3D-02: Should the Camera Wall budget be enforced by a CI performance test or is manual QA sufficient until v1?
- OQ-3D-03 RESOLVED: Single-canvas modes (`CameraViewMode`, `PathReplayView`) reuse the same adaptive wrapper pattern with a dedicated, higher DPR range. See updated `OPEN_QUESTIONS_ADDENDUM.md`.

---

## D-320 | 2026-06-30 | Canonical camera manipulation uses the shared transform model, not a camera-only side channel

**Decision:** Camera selection now uses the same canonical object manipulation path as the rest of the workbench: arrow keys nudge the selected object, `Q`/`E` rotate it, `PageUp`/`PageDown` adjust its vertical position, the contextual right-click menu exposes the same actions, and the camera inspector explains those controls explicitly. The same contract now also surfaces wall height controls and keeps the movement/rotate affordances visible for lights and other editables so non-camera objects do not lose discoverability.

**Rationale:**
- The camera workflow already had the right primitives: contextual actions, drag handles, and canonical store updates. The missing part was user-facing consistency and discoverability, not a new camera-specific editor.
- A separate camera-only control path would duplicate movement semantics, drift from the rest of the transform model, and create another place where selection behavior could silently diverge.
- `PageUp`/`PageDown` preserve the existing global shortcuts while giving operators a conflict-free keyboard path for vertical adjustments.
- The inspector and shortcut sheet need to teach the control contract where the operator is already looking, otherwise the feature still feels absent even when the code exists.

**Alternatives rejected:**
- Add a separate camera editor mode: rejected because it would fork the canonical selection/transform model.
- Reuse conflicting global shortcuts like `R`/`F` for camera transforms: rejected because those keys already have global product meaning.
- Hide the behavior behind mouse-only handles: rejected because keyboard control is a core operator workflow, not an advanced bonus.

**Updated in this pass:**
- `apps/studio/src/hooks/use-studio-keyboard.ts`
- `apps/studio/src/components/workspace/editing/object-context-actions.ts`
- `apps/studio/src/components/workspace/editing/ObjectContextMenu.tsx`
- `apps/studio/src/components/layout/ShortcutsModal.tsx`
- `apps/studio/src/components/inspector/CameraInspector.tsx`
- `apps/studio/src/components/workspace/editing/__tests__/object-context-actions.test.ts`
- `apps/studio/src/components/__tests__/camera-inspector.test.ts`
- `apps/studio/src/components/__tests__/studio-shell-shortcuts.test.ts`
- `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md`

---

## D-329 | 2026-07-07 | Canonical Organization, Account, and Workspace Catalog Model

**Decision:** Promoted the canonical organization, account, quota, entitlement, and member schemas along with the workspace catalog model (`workspace-catalog.ts`) from `apps/studio` into `@sentineltwin/core`. Converted `apps/studio/src/schema/organization.ts`, `apps/studio/src/schema/SceneOperation.ts`, and `apps/studio/src/lib/workspace-catalog.ts` into 1-line re-export shims (`export * from "@sentineltwin/core";`).

**Rationale:**
- Establishes a single source of truth across the monorepo for organization boundaries, quotas, and workspace catalogs without breaking existing frontend import surfaces.
- Guarantees 100% type and runtime identity across studio tests and components while preparing for server-side control plane sync and backend validation.
- Aligns with D-325 (Canonical Schema Deduplication) by ensuring that zero duplicate type definitions or Zod schemas exist across the frontend and core libraries.

**Alternatives rejected:**
- Maintaining duplicate organization/catalog schemas in studio: rejected because it risks schema drift between client-side catalogs and backend control planes.
- Creating parallel backend-only types: rejected because D-002 and D-325 mandate unified canonical definitions.

**Updated in this pass:**
- `packages/core/src/schema/organization.ts` (new canonical location)
- `packages/core/src/lib/workspace-catalog.ts` (new canonical location)
- `packages/core/src/index.ts` (exports organization and workspace-catalog)
- `apps/studio/src/schema/organization.ts` (verified re-export shim)
- `apps/studio/src/schema/SceneOperation.ts` (verified re-export shim)
- `apps/studio/src/lib/workspace-catalog.ts` (verified re-export shim)

---

## D-330 | 2026-07-08 | Compliance Reporting Suite & Policy-Driven Redaction (Q-020/021/022 Resolved)

**Decision:** Created a canonical compliance reporting suite (`compliance-templates.ts` in `@sentineltwin/report`) with standard templates for GDPR (UK ICO, French CNIL Art. L251-1 CSI, German BfDI BDSG §4), PCI DSS Section 9, and BIPA/HIPAA. Integrated a policy-driven redaction engine (`applyPolicyRedaction`) that enforces redaction rules (`redactCameraIps`, `redactGpsCoordinates`, `redactPatrolRoutes`, `maskVulnerabilities`) across both single and comparison reports when visibility is not set to `internal`. In Studio, upgraded `ReportView.tsx` with a Regulatory Compliance Selector and interactive Redaction Policy toggles.

**Rationale:**
- Physical security digital twins contain sensitive operational metadata (IP addresses, GPS coordinates, patrol routes, blindspot vulnerabilities) that cannot be safely exported or shared with external contractors, auditors, or regulators without redaction.
- Hardcoding or manually editing markdown reports creates compliance risk and error-prone redactions. A deterministic redaction engine embedded in `buildReportData` and `buildCompareReportData` ensures that redaction rules are automatically applied based on template mandates and report visibility.
- Aligns with IEC 62676-4:2025 and privacy regulations by providing pre-validated regulatory mandates and retention limits directly in exported reports.

**Alternatives rejected:**
- Client-side only UI redaction: rejected because exported JSON/HTML/markdown data would still contain unredacted sensitive metadata. Redaction must happen during report generation in `@sentineltwin/report`.
- Ad-hoc regex stripping in export functions: rejected because structured report data (e.g. `cameras` array, `issues` ledger, `zoneChanges`) needs field-level sanitization while preserving structural integrity for formatting and comparison.

**Updated in this pass:**
- `packages/report/src/compliance-templates.ts` (new canonical compliance registry and redaction engine)
- `packages/report/src/index.ts` (integrated compliance templates, buildReportData/buildCompareReportData redaction hooks, CompareReportData template field)
- `apps/studio/src/components/view/ReportView.tsx` (Regulatory Compliance Selector, Redaction Policy toggles, template preview)
- `apps/studio/src/components/bottom-panel/ReportLiteTab.tsx` (Regulatory Mandates Active banner, redaction badges, safe template access)
- `packages/report/src/__tests__/compliance-templates.test.ts` (verified regression test suite)
- `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md` (Q-020, Q-021, Q-022 resolved)

