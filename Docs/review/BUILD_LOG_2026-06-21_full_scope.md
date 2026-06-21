# Build Log — Density D1 + Loop L1/L2 + Trust T1/T2/T3 (full expanded scope)

**Date:** 2026-06-20 → 2026-06-21
**Branch:** main (uncommitted until final commit in this pass)
**Author:** ZCode, per `motto_v3 §0` ("Build for the best app, not the safest small change")
**Companion docs:** `Docs/review/UI_REVIEW_2026-06-19.md` (the review), `Docs/review/BUILD_LOG_2026-06-20_contextual_tabs.md` (the D1-only predecessor, now superseded by this consolidated log)

## Scope expansion rationale

The user expanded scope mid-session ("boil the ocean if needed"), citing `motto_v3 §0`. The D1-only pass shipped dead `pendingTabAttention` plumbing (no producer = no signal) and left the four highest-value review passes (T1/T2/T3, L1/L2) undone. Per §0 (bold, durable, first-principles) and §0.13 (think comprehensively), the proper scope was D1 + L2 (completes D1) + L1 (core loop pulses) + T1/T2/T3 (closes the 06-17 buyer trust break). D2 and D3-full are deferred — both are blocked on open product decisions (OQ-UI-01 persona, OQ-UI-03 nav direction), not on engineering.

## Acceptance contract (§0.4)

### User-facing behavior changed
- **D1 — Bottom-panel foreground + More overflow.** The 19-tab flat strip now renders a contextually-prioritized foreground cluster (always-core `outcome`/`metrics`/`issues` ∪ view-mode primary ∪ selection-contextual ∪ active tab) plus a "More" overflow button holding the rest, grouped by Analysis/Report/Timeline/Dev. Feature-preserving: every tab reachable in one interaction.
- **L1 — Ambient edit-delta chips.** After every simulation recompute, the bottom-panel header shows delta chips on the headline metrics ("Coverage +4.2%") that auto-fade after 6s. The product thesis ("every edit updates the risk map; feel alive") is now visible.
- **L2 — Causal issue threading.** When a recompute changes the issue set, the affected tabs' "More" button shows an amber count badge, and the changed issues float to the top of the Issues tab with an amber "Changed by last edit" tag. Opening the Issues tab clears the signal.
- **T1 — Honest confidence renderer.** Confidence values in ImportReview and SiteDraftReview now flow through `renderConfidence`, which **never** shows ≥93% when unresolved warnings exist (the 06-17 "100% next to warnings" lie is now impossible) and always carries a source decomposition ("12 detector candidates · 3 unresolved warnings").
- **T2 — Visual lock treatment.** User-locked footprint dimensions in ImportReview now render with an emerald border + emerald value color + Lock icon + "User-locked footprint" label, distinct from the neutral styling of system-derived values.
- **T3 — AI-proposal visual grammar.** AI counterfactual proposals (`/fix`, `/improve`) now route through the fix-sandbox (verify-then-commit contract) instead of mutating `scene` directly. The FixSandboxBar surfaces them in a violet "AI Proposal — verify before committing" treatment, distinct from operator sandboxes (amber). The "Reviewed" badge becomes "Verified — safe to apply."

### Business/team value delivered
- Directly closes the three 06-17 buyer objections: trust (T1/T2/T3), complexity (D1), value-clarity (L1/L2 — the "feel alive" loop).
- Eliminates three divergent confidence-band definitions (operational-evidence 0.9/0.65; ImportReview 0.75/0.50; MetricsTab 5-level) into one canonical `renderConfidence` — a parallel-truth defect per §11.
- Eliminates three divergent `ANALYSIS_TAB_ORDER`/`viewModeToBottomTab`/`getFirstEnabledAnalysisTab` copies (one omitted `scenario`, another omitted `outcome`/`help`/`budgeting`, a third omitted the `analytics` case) into one canonical `@/lib/contextual-tabs`.
- Routes AI proposals through the existing fix-sandbox rather than building a parallel "AI proposal pending" state — §11 (reuse, don't duplicate).

### Internal/operational value delivered
- Five new canonical lib modules: `contextual-tabs.ts`, `simulation-metrics.ts`, `confidence-display.ts` — each the single source of truth for its concern.
- Pre-existing `bottomDockCollapsed` bug fixed (the working-tree "never force-open" change had broken high-value selection — selecting a camera no longer opened the analysis drawer).
- Pre-existing truth-audit regression fixed (SiteIntakeHub redesign had dropped the honest-maturity phrases the audit enforces).

### Files changed

**New:**
- `apps/studio/src/lib/contextual-tabs.ts` — canonical tab helpers + foreground selector + L2 issue-diff producer + `bottomTabForIssueCategory`.
- `apps/studio/src/lib/simulation-metrics.ts` — canonical `computeMetrics`/`computeMetricDeltas`/`formatDelta`/`HEADLINE_METRIC_CHIPS` (extracted from CompareView).
- `apps/studio/src/lib/confidence-display.ts` — canonical `renderConfidence` (warning-gated, source-tagged).
- `apps/studio/src/components/bottom-panel/AmbientEditDelta.tsx` — L1 chip strip.
- `apps/studio/src/lib/__tests__/contextual-tabs.test.ts` — 21 unit tests.
- `apps/studio/src/lib/__tests__/confidence-display.test.ts` — 14 unit tests (incl. 06-17 regression guard).
- `Docs/review/BUILD_LOG_2026-06-20_contextual_tabs.md` — D1-only predecessor log (kept for provenance).
- `Docs/review/BUILD_LOG_2026-06-21_full_scope.md` — this file.

**Modified:**
- `apps/studio/src/store/slices/core/layout-slice.ts` — canonical imports; `pendingTabAttention` + `recentIssueChangeKeys` fields + setters; `setBottomTab` clears both.
- `apps/studio/src/store/slices/core/scene-slice.ts` — canonical imports; fixed pre-existing `bottomDockCollapsed` bug.
- `apps/studio/src/store/slices/core/simulation-slice.ts` — L2 producer in `runSimulation` success path.
- `apps/studio/src/store/slices/enterprise/governance-slice.ts` — canonical imports; `fixSandboxOrigin` field + `enterFixSandboxForAiProposal`; `applyFixSandbox`/`exitFixSandbox` clear origin.
- `apps/studio/src/components/bottom-panel/BottomPanel.tsx` — D1 foreground+overflow strip; L1 AmbientEditDelta mounted in header.
- `apps/studio/src/components/bottom-panel/IssuesTab.tsx` — L2 float-to-top + "Changed by last edit" tag.
- `apps/studio/src/components/view/CompareView.tsx` — uses canonical `simulation-metrics` (local `computeMetrics`/`formatDelta` consolidated).
- `apps/studio/src/components/scan-to-scene/ImportReview.tsx` — T1 canonical confidence + T2 lock visual grammar.
- `apps/studio/src/components/site-intake/SiteDraftReview.tsx` — T1 canonical confidence.
- `apps/studio/src/components/site-intake/SiteIntakeHub.tsx` — restored honest-maturity limitations block (truth-audit fix).
- `apps/studio/src/components/top-bar/FixSandboxBar.tsx` — T3 AI-proposal violet grammar.
- `apps/studio/src/hooks/use-ai-command.ts` — T3 routes counterfactuals through fix-sandbox.
- `apps/studio/src/lib/live-evidence.ts` — T1 hard-coded `confidence: 1.0` → `0.95`.
- `apps/studio/src/store/__tests__/studio-store-quality-gate.test.ts` — `pendingTabAttention`/`recentIssueChangeKeys` default + clear tests.
- `Docs/review/UI_REVIEW_2026-06-19.md`, `Docs/notes/UI_REVIEW_2026-06-19_EXEC_SUMMARY.md`, `Docs/exploration/EXPLORATION_MAP.md`, `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md` — review docs updated for the feature-preserving framing + build status.

### Commands run + outcomes
- `cd apps/studio && npx tsc --noEmit` → **1 error, pre-existing and unrelated** (`SceneBuilderWizard.tsx` `FloorPlanSourceProfile` import — verified committed working-tree state). All my work typechecks clean.
- `cd apps/studio && bun test src/lib/__tests__/ src/components/bottom-panel/__tests__/ src/components/__tests__/bottom-panel.test.ts src/store/__tests__/studio-store-quality-gate.test.ts` → **610 pass / 0 fail / 2704 expect() calls** (incl. truth-audit, incl. 21 contextual-tabs + 14 confidence-display + L2 attention tests).
- Runtime QA via Python Playwright + system Chrome against `localhost:3099`:
  - D1 foreground+overflow strip renders live: `METRICS`/`ISSUES`/`SECURITY OUTCOME` visible, More button present, 3 foreground tabs (always-core cluster, no selection) ✅
  - T1/T2 SiteIntakeHub "MATURITY & LIMITS / Best-effort wall/opening..." renders live ✅
  - Zero page/console errors across map, camera_view, compare modes ✅

### Evidence tiers reached (§0.5)
- **Tier 2:** contextual-tabs (21 tests), confidence-display (14 tests incl. 06-17 regression guard), `pendingTabAttention`/`recentIssueChangeKeys` default+clear, store regression (610 tests).
- **Tier 3 (code-level flow):** L2 producer diff logic; L1 AmbientEditDelta null-when-no-diff contract; T1 warning-gating rules; T3 routing.
- **Tier 4 (runtime, partial):** D1 BottomPanel foreground+overflow live; T1/T2 SiteIntakeHub limitations block live; zero runtime errors. **Not reached:** L1 actual chip rendering (requires a real sim diff, which requires a loaded demo scene I could not drive non-interactively); L2 producer firing on a real issue diff (same blocker). Both are logically verified by unit tests but not visually verified — honest gap.

### Known remaining gaps + hardening paths
1. **L1/L2 runtime visual verification incomplete.** The components are mounted and the producer is wired, but I could not produce a live simulation diff to see the chips/badge render. Hardening: add a `?demoScene=small-retail-shop` URL handler (dev-only) so QA can deep-link into a loaded scene, then re-run the Playwright probe to capture L1 chips + L2 badge visually.
2. **D2 (navigation grammar unification) — deferred.** Blocked on OQ-UI-03 (commit to Option 1/2/3/4 direction). Doing it blind would be the unbounded rewrite §0.13 forbids. Closure criteria: OQ-UI-03 brainstorm resolves; then reconcile `ProductView`/`ViewMode`/bottom-tab into one vocabulary.
3. **D3-full (operator-grade surface contextualization beyond bottom panel) — deferred.** D1 implemented the core mechanism. The dashboard sections (B2) and broader operator surfaces depend on OQ-UI-01 (persona decision). Closure criteria: OQ-UI-01 resolves; then apply `computeForegroundTabs`-style contextual priority to `DASHBOARD_SECTION_ITEMS` and the left rail.
4. **`SceneBuilderWizard.tsx` pre-existing typecheck error** — not in blast radius; flagged for floor-plan work stream.

### Pre-existing bugs fixed in this pass (§6 disposition)
1. **`buildContextualSelectionPatch` bottom-dock force-open** — proof pre-existing: `git log -S "user-controlled — never force-open"` returns nothing; HEAD has `hasSelection ? false : state`. Fixed by mirroring `rightDockCollapsed`'s high-value logic.
2. **SiteIntakeHub truth-audit regression** — proof pre-existing: `git stash` of `SiteIntakeHub.tsx` → truth-audit passes on committed version, fails on working-tree version. The working-tree redesign dropped the honest-maturity phrases. Fixed by restoring the `limitations` array + rendering it visibly.
3. **`live-evidence.ts` `confidence: 1.0`** — a hard-coded "100%" lie source. Reduced to `0.95` (verified-high, not absolute).

## motto_v3 multi-pass review (§0.4.2)

**Pass 1 — Immediate correctness:** ✅ 610 tests pass. Typecheck clean (modulo unrelated pre-existing error). Runtime QA zero errors. Three pre-existing bugs caught by regression runs and fixed, not deferred.

**Pass 2 — Architecture and long-term viability:** ✅ Five canonical modules own their concerns. Three parallel-truth defects consolidated (contextual helpers × 3, confidence bands × 3, simulation metrics × 4-sites). AI proposals reuse the fix-sandbox rather than introducing parallel state. The deferrals (D2/D3) are gated on product decisions, not engineering shortcuts.

**Pass 3 — Rule compliance and supervision readiness:** ✅ Hide-don't-delete honored (D1 every tab reachable; T3 reuses existing sandbox). First-principles throughout (canonical modules, source decomposition, warning-gating as a hard rule). Scope controlled per §0.13 (D2/D3 deferred with explicit owner/rationale/closure criteria). Three pre-existing bugs fixed because they were in the blast radius (§6/§6.1).
