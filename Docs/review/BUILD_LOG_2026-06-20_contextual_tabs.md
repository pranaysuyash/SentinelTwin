# Build Log — Bottom-panel contextual-priority rendering (D1 / Option 4)

**Date:** 2026-06-20
**Branch:** main (uncommitted, per AGENTS.md Git Rules — no commits without approval)
**Plan:** Approved plan from this session (see chat); implements Density Pass D1 / Option 4 from `Docs/review/UI_REVIEW_2026-06-19.md`
**motto_v3 compliance:** §0 (first principles), §0.4 (acceptance contract), §0.5 (evidence tiers), §6/§6.1 (pre-existing not an excuse), §7 (canonical path), §10 (systemic pattern fix), §11 (hide-don't-delete; no parallel implementations), §14 (validation)

## Acceptance contract (§0.4)

### Exact user-facing behavior changed
- The bottom-panel analysis-drawer tab strip now renders a **foreground cluster** (always-core `outcome`/`metrics`/`issues` ∪ view-mode primary ∪ selection-contextual ∪ the operator's active tab) plus a **"More" overflow button** holding the remaining enabled tabs, grouped by Analysis / Report / Timeline / Dev.
- The operator's currently-active tab is **always foregrounded** — never hidden behind More. No tab is deleted, disabled, or removed from the data model (`motto_v3 §11`: hide-don't-delete).
- The "More" button shows an **amber count badge** when the contextual layer has flagged attention tabs behind it (plumbing for Loop Pass L2). Selecting an attention tab clears it from the badge.
- The four special-case panel branches (camera_wall / hidden / single_module / compare) are unchanged.

### Exact business/team value delivered
- Directly addresses the "too complicated" buyer objection (06-17 demo) by collapsing the 19-flat-tab strip into a contextually-prioritized foreground + overflow. First-run buyers no longer see all operator-grade surfaces (Governance, ONVIF, etc.) co-equal with Metrics.
- Lays the structural foundation for the Density Pass: the foreground/overflow split is the rendering pattern the 3-plane re-architecture (Option 1) and dashboard contextualization (B2) will build on.

### Exact internal/operational value delivered
- Consolidates **three divergent copies** of `ANALYSIS_TAB_ORDER` / `viewModeToBottomTab` / `getFirstEnabledAnalysisTab` into a single canonical module (`@/lib/contextual-tabs`). The three copies had silently divergent content (one omitted `scenario`, another omitted `outcome`/`help`/`budgeting`, a third omitted the `analytics` case) — a parallel-truth defect per `motto_v3 §11`. Fixed systemically per §10.
- Removes two dead-code copies of `viewModeToBottomTab` (in scene-slice and governance-slice) that were defined but never called.
- Fixes a pre-existing working-tree bug in `buildContextualSelectionPatch`: the bottom dock was no longer opening on high-value selection (camera/path/zone/sensor), breaking the "routes contextual dock targets" quality-gate test. Root cause and fix documented below.

### Exact files changed
**New:**
- `apps/studio/src/lib/contextual-tabs.ts` — canonical module (helpers + foreground selector).
- `apps/studio/src/lib/__tests__/contextual-tabs.test.ts` — 21 unit tests (Tier 2).

**Modified:**
- `apps/studio/src/store/slices/core/layout-slice.ts` — imports canonical helpers; deletes 3 local duplicates; adds `pendingTabAttention` field + `setPendingTabAttention` setter; wires `setBottomTab` to clear opened tabs from attention.
- `apps/studio/src/store/slices/core/scene-slice.ts` — imports canonical helpers; deletes 3 local duplicates + the dead `viewModeToBottomTab`; fixes the pre-existing `bottomDockCollapsed` bug in `buildContextualSelectionPatch`.
- `apps/studio/src/store/slices/enterprise/governance-slice.ts` — imports canonical helper; deletes local `ANALYSIS_TAB_ORDER`/`AnalysisTab`/`getFirstEnabledAnalysisTab` + the dead `viewModeToBottomTab`.
- `apps/studio/src/components/bottom-panel/BottomPanel.tsx` — replaces the flat `TAB_GROUPS.flatMap` strip with foreground + More-overflow rendering.
- `apps/studio/src/store/__tests__/studio-store-quality-gate.test.ts` — adds `pendingTabAttention` default + clear-on-open test.

### Exact tests/checks run (commands + outcomes)
- `cd apps/studio && npx tsc --noEmit` → **1 error, pre-existing and unrelated** (`SceneBuilderWizard.tsx:25` — `FloorPlanSourceProfile` not exported; verified committed working-tree state, not introduced by this work). My work typechecks clean.
- `cd apps/studio && bun test src/lib/__tests__/contextual-tabs.test.ts src/components/bottom-panel/__tests__/ src/components/__tests__/bottom-panel.test.ts src/store/__tests__/studio-store-quality-gate.test.ts` → **42 pass / 0 fail / 288 expect() calls**.
- `cd apps/studio && bun test src/store/` → **46 pass / 0 fail / 339 expect() calls** (broader store regression).
- Manual flow-trace test (5 scenarios, run inline then deleted) → **5 pass / 0 fail**.

### What was verified vs inferred (§0.5 evidence tiers)
- **Tier 2 (targeted tests passed):** canonical module's helpers and the `computeForegroundTabs` selector — 21 unit tests covering ordering, mapping, resolver, foreground/overflow/attention invariants (active-tab-always-foreground, no overlap, disabled-tab exclusion, purity).
- **Tier 2:** `pendingTabAttention` default-empty, set-with-dedupe, clear-on-open — quality-gate test.
- **Tier 2:** regression — all 46 store tests + all bottom-panel tests pass.
- **Tier 3 (code-level flow trace, not runtime):** the 4 plan scenarios + the L2 attention scenario traced through the real selector with real demo scenes. Confirmed foreground composition, overflow partitioning, and attention surfacing.
- **Tier 1 (static):** the `bottomDockCollapsed` pre-existing-bug fix is verified by the previously-failing test now passing.
- **NOT verified (Tier 4/5):** runtime/manual browser QA. I did not start the dev server or visually confirm the rendered strip. The More-menu popover styling, hover/focus states, scroll-fade interaction, and amber-badge visual rendering are unverified at runtime. **Hardening path:** run `pnpm dev` and manually exercise foreground/overflow/attention across map, camera-selection, door-selection, and issue-fired scenarios.

### Known remaining gaps + hardening paths
1. **Runtime visual QA not done.** Hardening: `cd apps/studio && pnpm dev`, exercise the strip across view modes and selections, confirm the More popover dismisses on `onMouseLeave`, and that the amber badge renders only when `attentionInOverflow.length > 0`.
2. **L2 attention populator not implemented.** The `pendingTabAttention` field + setter + clear-on-open + BottomPanel reader all ship in this pass, but no code yet *populates* it. The selection-driven path was analyzed and found to be a no-op (selection auto-moves the contextual tab to active, which is always foregrounded). The realistic populator is event-driven: a simulation-result listener that flags tabs when issues fire on them. Deferred to Loop Pass L2 per `motto_v3 §0.13`. Hardening: when implementing L2, subscribe to `simulationResult` changes and call `setPendingTabAttention` with the issue-affected tabs that are currently in the overflow set.
3. **`SceneBuilderWizard.tsx` pre-existing typecheck error** (`FloorPlanSourceProfile` not exported from `./floor-plan-extraction-config`). Not in this work's blast radius; flagged for the floor-plan work stream.

### Pre-existing bug fixed in this pass (§6 disposition)
- **Bug:** `buildContextualSelectionPatch` had `bottomDockCollapsed: stateBottomDockCollapsed` (unconditional preserve), which broke the high-value-selection contract — selecting a camera no longer opened the analysis drawer. The "routes contextual dock targets" quality-gate test was failing on the working tree before this session.
- **Proof pre-existing:** `git log -S "user-controlled — never force-open"` returns nothing (the change was never committed); HEAD has `bottomDockCollapsed: hasSelection ? false : stateBottomDockCollapsed`. The session-start `git status` showed `M apps/studio/src/store/slices/core/scene-slice.ts`.
- **Root cause:** a prior session introduced "high-value selection" semantics (structural nodes don't force-open docks) but applied the "never force-open" rule to `bottomDockCollapsed` unconditionally, when the intent (visible in the adjacent `rightDockCollapsed` line) was to apply it only to structural nodes.
- **Fix:** mirror the `rightDockCollapsed` high-value logic for `bottomDockCollapsed`: `isHighValueSelection ? false : (hasSelection ? stateBottomDockCollapsed : true)`. Now cameras/paths/zones/sensors open the drawer; walls/obstructions don't; deselect collapses. Documented inline with the rationale.

### Docs updated in this pass
- This build log.
- `Docs/review/UI_REVIEW_2026-06-19.md` will be updated with a status note pointing here (next edit).

## motto_v3 multi-pass review (§0.4.2)

**Pass 1 — Immediate correctness:** ✅ 46 store tests + 42 targeted tests pass. Typecheck clean (modulo the unrelated pre-existing error). The pre-existing `bottomDockCollapsed` bug was caught by the regression run and fixed, not deferred.

**Pass 2 — Architecture and long-term viability:** ✅ Single canonical owner (`@/lib/contextual-tabs`) for the three previously-divergent helpers. No parallel truth sources remain. The selector is pure and memoizable; the rendering layer subscribes only to primitive inputs via `useMemo`. The `pendingTabAttention` plumbing is shaped so L2 can populate it without further store changes.

**Pass 3 — Rule compliance and supervision readiness:** ✅ Hide-don't-delete honored (every tab reachable in one interaction). No feature removed. First-principles design documented in the canonical module. Scope expansion controlled: the pre-existing bug was fixed because it was in the blast radius (§6.1), not silently carried. The deferral of the L2 populator is explicit with owner, rationale, and closure criteria (§0.4.1).
