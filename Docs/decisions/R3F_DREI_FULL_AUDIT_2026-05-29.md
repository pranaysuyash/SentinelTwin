# R3F / Drei Full Audit (motto_v2-aligned)

Date: 2026-05-29  
Scope owner: Copilot session audit  
Primary lens: `r3f-drei` and core Three.js rendering surfaces in `apps/studio`

## Skill usage metadata

- Initial audit pass skill mode: direct repo analysis under instruction stack + motto_v2 workflow
- Explicit Three.js skill invocation (owner-requested follow-up):
   - `threejs-fundamentals` (`/Users/pranay/Projects/skills/threejs/threejs-fundamentals/SKILL.md`)
   - `r3f-drei` (`/Users/pranay/Projects/skills/r3f-drei/SKILL.md`)
- Next Three.js module invocation (owner-requested continuation):
   - `threejs-geometry` (`/Users/pranay/Projects/skills/threejs/threejs-geometry/SKILL.md`)
   - Initiation result: geometry usage audit run over `apps/studio/src/**` with `69` geometry-related matches across rendering + simulation surfaces.
- Next Three.js module invocation (owner-requested continuation):
   - `threejs-postprocessing` (`/Users/pranay/Projects/skills/threejs/threejs-postprocessing/SKILL.md`)
   - Initiation result: post-processing pipeline scan over `apps/studio/src/**` for `EffectComposer`/passes/tone-mapping hooks returned no explicit post-processing stack usage in app source.
- Next Three.js module invocation (owner-requested continuation):
   - `threejs-shaders` (`/Users/pranay/Projects/skills/threejs/threejs-shaders/SKILL.md`)
   - Initiation result: shader-hook scan over `apps/studio/src/**` for `ShaderMaterial` / `onBeforeCompile` / custom GLSL entries returned no explicit custom shader pipeline in app source.
- Supporting artifact reviewed: `Docs/exploration/THREEJS_3D_RENDERING_SKILLS_INVENTORY_2026-05-29.md`

## Owner directive alignment (2026-05-29)

Per owner guidance, this audit treats architecture docs as potentially future-facing and avoids destructive rewrites.

- Focus order is **engineering correctness first**, documentation second.
- When runtime truth needs recording against future-plan docs, use **addendum files** rather than overwriting the base architecture document.

## Audit intent

This audit answers the request to execute and document a full, evidence-backed review of the studio's 3D/rendering stack, with emphasis on:

- Runtime stack truth vs architecture docs
- Rendering surface correctness signals
- Trust/claim audit outcomes
- Typecheck/test signals relevant to rendering paths
- Concrete closure actions

## Evidence sources reviewed

### Canonical docs/instructions

- `motto_v2.md`
- `AGENTS.md` and `CLAUDE.md` (repo-level)
- `apps/studio/AGENTS.md`
- `Docs/architecture/07_RENDERING_PIPELINE.md`
- `Docs/decisions/DECISION_LOG.md`
- `Docs/decisions/OPEN_QUESTIONS.md`

### Runtime/code truth snapshots

- `apps/studio/package.json`
- `apps/studio/src/components/view/CameraViewMode.tsx`
- `apps/studio/src/components/view/PathReplayView.tsx`
- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`
- `apps/studio/src/lib/three-compat.ts`
- `Docs/exploration/THREEJS_3D_RENDERING_SKILLS_INVENTORY_2026-05-29.md`

### Verification outputs used in-session

- Prior `bun run audit:truth` result in this session summary: FAIL with 2 missing trust-claim strings in `src/components/launcher/ProjectStartLauncher.tsx`.
- `bun tsc --noEmit` (session run): clean.
- `bun test` (session run): broad pass evidence captured across many component/simulation suites (full footer not captured in that specific run output snippet).
- Additional targeted suite evidence later in session indicates unrelated non-rendering failures in launcher/API route tests, and transport-session assertions in live-connection route tests.

### Reverification outputs (2026-05-29, same session)

- `bun run audit:truth` → **PASS** (no missing trust-claim strings)
- `bun tsc --noEmit && echo TSC_OK` → `TSC_OK`
- `bun test` → **PASS** (`493 pass`, `0 fail`, `8031 expect() calls`, `136 files`, runtime `153.11s`)

## Findings

### 1) Rendering runtime stack is modern and internally consistent (PASS)

From `apps/studio/package.json`:

- `@react-three/fiber`: `^9.6.1`
- `@react-three/drei`: `^10.7.7`
- `three`: `^0.184.0`
- `three-mesh-bvh`: `^0.9.10`
- `framer-motion`: `^12.40.0`

Interpretation: the codebase is on a current R3F + Drei + Three line with BVH acceleration and motion stack present.

### 2) Core rendering surfaces are actively wired through R3F/Drei (PASS)

Observed in source:

- `CameraViewMode.tsx` imports `Canvas` and `PerspectiveCamera` and renders live camera scene overlays.
- `WorkspaceCanvas.tsx` imports `Canvas`, `OrbitControls`, `OrthographicCamera`, `PerspectiveCamera`, and core scene overlays.
- `PathReplayView.tsx` uses R3F canvas + replay rendering and motion controls.
- `three-compat.ts` provides the compatibility clock shim used as a controlled mitigation layer.

Interpretation: rendering is not theoretical; it is live, centralized, and actively used across map/camera/replay views.

### 3) Architecture doc drift exists in rendering stack declaration (FAIL)

`Docs/architecture/07_RENDERING_PIPELINE.md` currently declares:

- `Next.js 15`
- `Three.js r168+`
- `GSAP` for replay timelines

Code/runtime truth shows:

- `next@16.2.6`
- `three@0.184.x`
- `framer-motion` in active replay surfaces
- no GSAP dependency in `apps/studio/package.json`

Impact:

- Onboarding/agent-routing confusion
- Incorrect design assumptions for replay/animation maintenance
- Slower incident debugging due to outdated architecture narrative

### 4) Trust-claim audit was not clean at audit checkpoint (FAIL)

Session-recorded `audit:truth` failure (at audit checkpoint):

- 2 missing trust-claim phrases in `ProjectStartLauncher.tsx`

Interpretation: trust copy contract was partially unmet at that checkpoint even though most trust checks passed.

### 5) Compile health at checkpoint was clean (PASS)

`bun tsc --noEmit` completed without TypeScript errors at the checkpoint captured in session summary.

### 6) Test evidence is strong but mixed across full-session timeline (MIXED)

- Broad pass evidence exists for many rendering/simulation/component suites.
- Separate targeted batches later in session surfaced unrelated failures (launcher copy assertions and camera live-connection route expectations).

Interpretation: rendering core is largely healthy, but adjacent product surfaces and API-session tests show regression risk that can affect release confidence.

## What next from the skill scans (actionable decisions)

The "not found" results for post-processing and custom shaders are not defects by themselves. They become product decisions via the matrix below.

### A) Post-processing pipeline (`threejs-postprocessing`)

- **Current decision (now):** Keep disabled by default in runtime architecture.
- **Why:** SentinelTwin is evidence-first; unnecessary image styling can blur trust boundaries and consume GPU budget without improving deterministic simulation truth.
- **When to introduce:**
   1. A specific visual requirement is accepted (for example: low-light readability in Camera View or report-grade cinematic replay exports).
   2. A hard performance budget is set per surface.
   3. A verification rule is defined that post effects never alter simulation metrics/labels.
- **Where to start:** `CameraViewMode` first, then `CameraFeedCanvas`, then `CameraWallView`, then replay.
- **Target implementation level:** composer stack with explicit pass order and measurable budgets, not ad-hoc one-off effects.

### B) Custom shaders (`threejs-shaders`)

- **Current decision (now):** Do not introduce custom GLSL in V0.1 runtime paths.
- **Why:** Existing visuals are functional, and no high-value effect currently requires shader complexity.
- **When to introduce:**
   1. A clear effect cannot be achieved with built-in material controls (example: physically meaningful IR/noise model, analytic visibility heat blending, confidence-aware edge highlighting).
   2. The effect has a deterministic spec and testable acceptance criteria.
   3. Shader scope is isolated to one surface first.
- **Where to start:** single-purpose material extension in camera surface overlays before any scene-wide shader rewrite.
- **Target implementation level:** one production shader at a time with documented uniforms, bounded cost, and fallback behavior.

### C) Geometry optimization (`threejs-geometry`)

- **Current decision (now):** Continue incremental geometry/perf hygiene in hot render paths.
- **Already applied in this session:** memoized path-geometry inputs in `CameraFeedCanvas` to reduce per-render allocations.
- **Next candidates:** remove inline temporary geometry allocations in repeatedly rendered overlays where safe; prefer memoized/reused geometry objects.

## Audit actionability standard for future runs

For each future skill audit outcome (including "not found"), require these four outputs:

1. **Should we use it?** (yes/no/not now)
2. **Where should it land first?** (exact component/surface)
3. **At what level?** (scope, pass order, isolation strategy)
4. **When should we trigger it?** (objective criteria + budget + verification rule)

This prevents passive audits and turns discovery into execution-ready decisions.

## Risk assessment

- **High:** doc-vs-runtime drift in `07_RENDERING_PIPELINE.md` (architecture trust erosion)
- **Medium:** trust-claim copy audit mismatch in launcher copy contract
- **Medium:** non-rendering but release-adjacent test instability in launcher/API route tests
- **Low:** core R3F/Drei wiring itself appears stable

## Required remediation sequence

1. **Close trust copy contract gaps**
   - Add required missing trust-claim strings in `ProjectStartLauncher.tsx`.
   - Re-run `bun run audit:truth` and archive full output.

2. **Stabilize adjacent failing tests**
   - Launcher expectation drift (`launcher-shell`, `launcher-dashboard-home`, camera-view copy assertions)
   - Live connection route session/transport assertions in `app/api/camera-live-connection/__tests__/route.test.ts`

3. **Re-run full verification gate**
   - `bun tsc --noEmit`
   - `bun test`
   - `bun run audit:truth`

4. **Publish runtime-truth architecture addendum (non-destructive)**
   - Do not overwrite `Docs/architecture/07_RENDERING_PIPELINE.md` if it carries future-state planning.
   - Record current stack truth in a dated addendum and cross-link from this audit.

## Audit verdict

For the requested 3D/r3f-drei rendering lens:

- **Implementation integrity:** mostly strong
- **Documentation integrity:** preserved via addendum strategy (`07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md`)
- **Trust/audit closure at checkpoint:** initial checkpoint had gaps; reverification is green

Overall verdict: **COMPLETE (CLOSED)** with fresh verification evidence.

## Closure criteria

This audit thread is only fully closed when all are true:

- `bun run audit:truth` passes with no missing trust-claim strings
- full `bun test` passes (or non-blocking failures are explicitly accepted and documented by owner)
- `Docs/architecture/07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md` exists with current runtime stack truth
- this file is updated with final pass evidence and timestamp

## Closure timestamp

Closed on: 2026-05-29 (session-local reverification complete)
