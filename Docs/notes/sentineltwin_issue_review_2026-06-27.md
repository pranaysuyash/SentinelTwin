# SentinelTwin Issue Review — 2026-06-27 (Floor-Plan Demo Recovery)

**Date:** 2026-06-27
**Scope:** `apps/studio/src/components/scan-to-scene/*`, `Docs/notes/live_demo_session_2026-06-19.md`, `Docs/exploration/EXPLORATION_MAP.md`, skill availability `Projects/skills/sentineltwin-demo-walkthrough`

## Session framing
- Mode: live sales demo coaching (agent role), no blind code-only flow changes during the user-facing call.
- User objections to address:
  - route mismatch when opening localhost:3001,
  - ambiguous “Next or Create Scene?” action,
  - huge wall count (“1335”) and unclear candidate semantics,
  - checkbox and checklist overload,
  - applied calibration not being visibly obvious.

## Transcript-style checkpoint notes

- **Screen observed:** Floor-plan configure screen with imported image and source-profile selector.
  - **User action requested:** “what should I click now?”
  - **System response:** Step currently in review lane with `Next: Review` call-to-action.
  - **Defect observed:** wording still referenced prior “Review and Commit” flow in places and did not fully signal final-action boundary.
  - **Next recommendation:** proceed with cleanup in step 2, keep `Next` for transition to review summary only.
  - **Buyer note:** this step is not scene creation.

- **Screen observed:** Wall preview/correction panel with high wall count.
  - **User action requested:** interpret counts and ask “what is excluded / kept?”
  - **System response:** wall metrics still showed compact stats and raw candidate count.
  - **Defect observed:** helper text still mentioned checkboxes while wall control is canvas-first.
  - **Next recommendation:** use canvas pickers and bulk actions for keep/exclude, then apply corrections.
  - **Buyer note:** candidates can be huge due legend/text artifacts; only kept walls go into the draft shell.

- **Screen observed:** Known footprint calibration panel.
  - **User action requested:** change dimensions and apply calibration.
  - **System response:** values updated in scene footprint fields and warning deltas.
  - **Defect observed:** visual change is subtle in image-space preview by design.
  - **Next recommendation:** verify via footprint card and review summary before moving forward.
  - **Buyer note:** pixel anchors stay stable while values are authoritative.

## Code-level fixes executed in this session

1. `SceneBuilderWizard.tsx`
   - Step-action clarity fix:
     - review-lane step button text now shows `Next: Review` for floor-plan path.
     - final step uses explicit `Create Draft Scene` only on step 3.
     - navigation hints/back labels were clarified to avoid mixed-step ambiguity.

2. `ImportReview.tsx`
   - Wall metric copy now explicitly says “raw candidates” and “kept” geometry.
   - Removed checkbox-only phrasing where wall corrections are performed via canvas picker.
   - Kept/remove summary wording now explains what “removed” means in working-shell terms.

3. `Docs/exploration/EXPLORATION_MAP.md`
   - Thread 11b updated with 2026-06-27 status and follow-up note.

## Live-demo script alignment (open questions retained)
- Route mismatch remains a context/state issue (`localhost:3001` opening prior view). This is still captured as user-visible follow-up until navigation bootstrap is explicitly validated end-to-end.
- Calibration visual delta remains subtle when geometry is pixel-anchored; this must be treated as a known UX confirmation gap rather than a data corruption issue.


## 2026-06-27 Recovery update (this pass)

### What changed in-code

- `apps/studio/src/lib/floor-plan-import.ts`
  - Added border-aware prefiltering for wall candidates with `borderTrimPx` and `longWallSeedPx` handling.
  - Wired extractor presets from `floor-plan-extraction-config.ts` through to extraction so source profile tuning also controls border-noise suppression.
  - `removeNoisyWallComponents` now honors `minWallLengthPx` from config.

- `apps/studio/src/components/scan-to-scene/ImportReview.tsx`
  - Fixed wall/door/window picker indexing when list preview is paginated.
  - Wall picker now maps visible rows back to global indexes so clicks in the first-`N` slice do not toggle the wrong element.
  - Door/window checkbox toggles now use visible-row global indexes to prevent hidden-row false toggles.

- `apps/studio/src/components/scan-to-scene/SceneBuilderWizard.tsx`
  - Removed stale review-copy artifact (“Next: Review and Commit”) and aligned messaging to `Next: Review` for the floor-plan flow.
- `apps/studio/src/lib/__tests__/floor-plan-import.test.ts`
  - Extended extraction-config assertions to include the new `borderTrimPx` and `longWallSeedPx` fields for both architectural and hand-drawn profiles.
- Agent tooling
  - Verified `sentineltwin-demo-walkthrough` exists under `Projects/skills` and added symlink availability under `/Users/pranay/.agents/skills/sentineltwin-demo-walkthrough` so all agents can discover it.

### Demo guidance impact

- The same screen is now explicit that the floor-plan step is review/cleanup (not creation).
- Wall metric wording + picker behavior now better matches the actual interaction model.
- Remaining ambiguity to monitor: first-pass scaling and anchor behavior still appear subtle in image preview by design; this should be presented as a scale-driven authoritative update rather than an immediate image deformation.
