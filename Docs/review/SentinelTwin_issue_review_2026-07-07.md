# SentinelTwin Issue Review - 2026-07-07

**Review type:** random document audit
**Selected document:** `Docs/todos/PHASE_5_PATH_REPLAY_DEMO.md`
**Selection method:** pseudo-random via the live audit thread context; the path was chosen from the replay/demo phase notes already in the current worktree.
**Evidence tier:** Tier 2 for the targeted verification checks, with static source inspection used to reconcile document claims to code.

## Why this document was worth auditing

The phase note claimed the replay/demo lane was complete, but it also encoded several concrete behavior claims that were easy to verify against the live surface:

- a 7-step walkthrough
- demo compare snapshot auto-selection
- clickable replay timeline bars
- a browser-verified polish claim

That made it a good candidate for a first-principles audit because the doc could be checked directly against the code, tests, and runtime-safe state transitions.

## Document claims vs code reality

### 1) Replay timeline accessibility

**Document claim:** `VisibilityTimeline` had clickable bars for seeking.

**Verified code:**
- `apps/studio/src/components/view/VisibilityTimeline.tsx:172-179`
- `apps/studio/src/components/view/VisibilityTimeline.tsx:182-214`
- `apps/studio/src/components/view/VisibilityTimeline.tsx:264-276`

**Audit result:** The timeline is now keyboard-accessible as well as clickable. Each camera row is a `role="slider"` target with `tabIndex`, `aria-valuenow`, and keyboard seek handling for arrows, PageUp/PageDown, Home, and End.

**Disposition:** fixed and documented in `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md`.

### 2) Demo walkthrough state safety

**Document claim:** the demo overlay was purely a UI walkthrough.

**Verified code:**
- `apps/studio/src/components/demo/DemoWalkthroughPanel.tsx:218-230`
- `apps/studio/src/components/demo/DemoWalkthroughPanel.tsx:232-257`
- `apps/studio/src/components/demo/DemoWalkthroughPanel.tsx:266-309`
- `apps/studio/src/components/demo/DemoWalkthroughPanel.tsx:396-405`

**Audit result:** The failure-case step mutates real scene state, so the old "pure UI overlay" framing was false. The code now snapshots the pre-failure scene and environment, restores them on exit, and reruns simulation so the workspace is not left in a tainted demo state.

**Residual risk:** restoration currently happens on exit/skip/finish. If future UX allows abandoning the failure state via another step jump or route change, the restore path should be extended to those transitions too.

**Disposition:** fixed in code; residual risk documented above.

### 3) Compare/report snapshot selection

**Document claim:** `CompareView` auto-selected baseline vs latest snapshot at step >= 5.

**Verified code:**
- `Docs/todos/PHASE_5_PATH_REPLAY_DEMO.md:35-38`
- `Docs/todos/PHASE_5_PATH_REPLAY_DEMO_ADDENDUM_2026-07-07.md:8-11`
- `apps/studio/src/components/demo/DemoWalkthroughPanel.tsx:396-405`

**Audit result:** The claim is stale. Compare/report snapshot selection now belongs to the compare/report surfaces themselves; the demo panel no longer owns that behavior.

**Disposition:** corrected via addendum.

### 4) Walkthrough length and done criteria

**Document claim:** 7-step walkthrough, 5 guided demo steps.

**Verified code:**
- `Docs/todos/PHASE_5_PATH_REPLAY_DEMO.md:35-38`
- `Docs/todos/PHASE_5_PATH_REPLAY_DEMO.md:60-64`
- `Docs/todos/PHASE_5_PATH_REPLAY_DEMO_ADDENDUM_2026-07-07.md:8-11`
- `apps/studio/src/components/demo/DemoWalkthroughPanel.tsx:11-130`

**Audit result:** The current walkthrough has 9 steps. The base phase note was stale, and the addendum now corrects the historical record without rewriting it.

**Disposition:** corrected via addendum.

## Test baseline and verification

Targeted checks that passed:

- `bun test ./src/components/__tests__/visibility-timeline.test.ts ./src/components/__tests__/demo-mode-overlay.test.ts ./src/components/__tests__/path-replay-view.test.ts`
- `pnpm exec tsc -p apps/studio/tsconfig.json --noEmit`

What those checks proved:

- the replay timeline source-contract tests still pass after keyboard accessibility work
- the demo overlay tests still pass after the failure-state restoration changes
- the Studio TypeScript build remains clean

What they did not prove:

- full browser QA for the reworked demo exit path
- a live interaction test for step-jump behavior while the failure-case snapshot is active

## Deduced task register

1. Keep `VisibilityTimeline` keyboard accessible and maintain the slider contract in tests.
2. Keep the demo walkthrough failure case reversible and verify any future navigation path that can bypass the current exit cleanup.
3. Keep the phase note historical, but prefer addenda when correcting stale walkthrough claims.
4. If the compare/report surfaces change their snapshot selection behavior again, update the phase addendum and current implementation state together.

## Recommended next safe work unit

Audit the remaining adjacent replay surface in the same blast radius:

- `apps/studio/src/components/view/CameraViewMode.tsx`

The most useful next pass would be a focused consistency audit for token usage, state handoff, and any remaining stale UX copy on that surface, since the path replay and camera wall chrome have already been pushed toward the canonical token layer.
