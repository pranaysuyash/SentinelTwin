# SentinelTwin Issue Review

Date: 2026-06-18
Source session: `Docs/notes/live_demo_session_2026-06-17.md`
Surface: `apps/studio` floor-plan intake and scene-builder workflow

## Outcome

The live buyer walkthrough ended with a negative response. The core objections were trust, complexity, and value clarity:

- the floor-plan import felt buggy and hard to trust
- the workflow felt too complicated for a first-run buyer demo
- imported values and review summaries did not match the uploaded source plan

## Highest-severity product failures

### 1. Manual calibration was not authoritative

- The user entered known dimensions from the source plan.
- After `Apply Calibration`, the app recomputed and replaced those values with a different derived footprint.
- This made calibration feel like a fake control instead of a user-owned override.

Impact:

- destroys trust in the import pipeline
- prevents buyers from confidently correcting a noisy extraction
- makes source-of-truth ownership ambiguous between the user and the detector

### 2. Review stage surfaced generic or stale scene metadata

- The direct `Upload Floor Plan` flow skipped meaningful scene setup.
- The review screen showed blank or generic values such as default dimensions instead of imported or calibrated values.
- The user had no clear place to set the scene name during the forced floor-plan path.

Impact:

- the review step looked unfinished
- the system appeared to ignore user input and source data
- the commit stage felt unsafe

### 3. Detector confidence and readiness messaging overstated quality

- The UI showed `100%` confidence even while wall counts were implausibly high and warnings were severe.
- `Tier 1 Gate` language was not explained in buyer-facing terms.
- Manual-review and low-trust states were presented with too much certainty.

Impact:

- confidence language contradicted observed behavior
- gate status added jargon instead of clarity
- buyers were asked to trust the system against their own evidence

### 4. The correction stage had weak affordances and feedback

- `Apply Calibration` produced subtle or unclear visual feedback.
- The spatial preview was too small to support a reliable correction task.
- The checkbox/fragment workflow required expert interpretation without adequate signifiers.

Impact:

- the correction workflow felt like internal tooling rather than guided product behavior
- users could not easily tell what changed or what to do next

## Root-cause framing

This was not only a styling problem. The trust break came from a deeper contract issue:

- detector-derived geometry was allowed to overwrite user-supplied calibration
- wizard state for direct floor-plan entry was not synchronized with imported scene metadata
- UI confidence/readiness language reflected raw detection values more than operator trustworthiness

## Long-term fix direction

1. User-supplied calibration must become authoritative once applied.
2. Direct floor-plan entry must own scene metadata instead of inheriting blank/default wizard state.
3. Review messaging must distinguish:
   - detector confidence
   - review readiness
   - manual gate status
4. Correction affordances must provide visible feedback and clear next actions.

## Acceptance criteria for recovery

- applying calibration preserves the entered dimensions through later normalization and correction steps
- floor-plan configure and review stages show the real imported or calibrated dimensions, not generic defaults
- the user can set or edit the scene name in the floor-plan flow itself
- confidence and gate messaging communicate uncertainty honestly when warnings remain
- correction actions provide visible feedback that a buyer can understand during a live demo

## 2026-06-18 follow-up (current session continuation)

### Additional findings from active buyer-flow iteration

- The import step still presented raw wall counts in a way that was confusing on first pass.
  - We clarified this as a raw-candidate count vs structured wall count and surfaced that legend/text-linework is the likely source of inflation in busy drawings.

- The right-side floor-plan metadata panel was dense and had low-visibility values.
  - We increased preview emphasis (`Spatial Preview` height) and added clearer, denser status language for where values are coming from and what action is next.

- The flow decision point between `Next` and `Create Draft Scene` remained a real confusion source.
  - We updated copy and step hints so users are explicitly told when they are in configuration review vs final creation.

- Name input in the floor-plan review path was previously hard to discover.
  - We added an explicit editable scene name input in the review step (and preserved it through configure metadata fields).

### Post-change expected behavior check list

- Raw wall segment count (`rawWallSegmentCount`) is retained in floor-plan import result and reported alongside structured walls.
- Manual footprint application message is now explicit in UI.
- Navigation labels now disambiguate `Next: Review and Commit` from `Create Draft Scene`.

### Runtime fixes completed in this continuation

- In `ImportReview`:
  - Wall statistics now separate raw candidates from kept geometry and show both in a visible metric context.
  - Wall counts in the header and KPI cards now show kept-vs-raw instead of only noisy raw count.
  - Added explicit short-wall summary (`short wall cutoff` and pending fragment count).
  - Added `Auto-filter short walls` to reduce first-pass noise quickly in dense drawings.
  - `Apply Corrections` now reports before/after kept vs removed counts.
  - `Apply Calibration` now prints an explicit `from -> to` delta in the action message.
  - `Reset` now confirms it restored extracted state.

- In `SceneBuilderWizard`:
  - Step navigation text is now role-aware:
    - `Next: Review and Commit` for floor-plan configure,
    - explicit `Back` labels (`Back to Method`, `Back to Import Review`).
  - Added in-flow guidance line and explicit `Create Draft Scene` copy.
  - Review step now allows editing `Scene Name` before final creation.

- Reusable demo skill now updated in `/Users/pranay/Projects/skills/sentineltwin-demo-walkthrough/SKILL.md`.
- Registered shared access point by linking:
  - `/Users/pranay/.codex/skills/sentineltwin-demo-walkthrough` -> `/Users/pranay/Projects/skills/sentineltwin-demo-walkthrough`

### Open follow-ups still pending

- Add stronger visible confirmation for `Apply Calibration` beyond metric text (for example short before/after diff badges in the preview frame).
- Improve legend/text masking in source plans with dense annotations so raw-candidate inflation is reduced at extraction time rather than only by manual correction.
- Capture a full runbook screen recording for bad-agent callouts (crowded metadata + inflated wall counts) as training material.

### 2026-06-18 post-fix follow-up

#### Implemented this pass

- `floor-plan-import.ts` now tracks `rawWallSegmentCount` before cleanup and applies a first-pass graph-based noise filter:
  - `removeNoisyWallComponents` drops isolated short components that are unlikely to be structural shell edges.
  - Endpoint-connectivity based clustering preserves major geometry while trimming annotation-like islands.
  - `rawWallSegmentCount` is preserved so UI can still report detection inflation without hiding provenance.
- `ImportReview.tsx` now includes:
  - explicit raw-vs-kept wall count and short-wall count messaging,
  - auto-clean action for short + near-duplicate wall fragments,
  - wall row text showing action intent (`Keep W…`) and segment length,
  - explicit kept/excluded counts in list summary.
- This materially addresses the "13xx walls / checkbox confusion / next-step uncertainty" failure pattern in the live screenshots.

#### Still pending

- Consider adding explicit UI guidance for user-provided / hand-drawn floor plans (expected low quality mode, optional preprocessing preset).
- Add a small "noise cleanup level" control so non-technical users can tune aggressiveness instead of implicitly using fixed thresholds.
- Replace static wall list cap (`slice(0, 20)`) with search/scrollable full list or filter chips, since large plans become hard to inspect quickly.

### 2026-06-18 Plan-understanding training pass

#### Completed in this pass

- Added explicit import-plan interpretation language in `ImportReview`:
  - raw candidate vs kept wall counts,
  - source-profile explanations for `hand_drawn`/`low_res_scan` behavior,
  - keep/exclude legend for each checkbox,
  - bulk keep/exclude actions for walls, doors, and windows,
  - larger preview panel to improve on-canvas understanding.
- Added calibration framing in `ImportReview` so manual dimension locking is clearly visible:
  - explicit note that preview anchors remain pixel-stable,
  - explicit message that recalibration changes scene scale/footprint,
  - action message now includes the known-before/after dimension delta.
- Strengthened `SceneBuilderWizard` navigation clarity:
  - configure label now routes as `Next: Review` and explicitly states this is review-only,
  - final action remains `Create Draft Scene` on Review step,
  - review summary now reports kept-vs-raw walls and manual-calibration source.
- Updated `sentineltwin-demo-walkthrough/SKILL.md` to require explicit review-vs-final workflow narration and transcript output columns.

#### Why this improves actual plan understanding

- Removes the perception that wall counts are arbitrary: user now sees that many detections are candidates before geometry cleanup.
- Changes checkbox meaning from “mystery toggles” to explicit include/exclude signals.
- Removes ambiguity on whether `Next` ends the flow or finalizes the draft.
- Gives the salesperson a reusable spoken script to convert the same UI into a deterministic buyer simulation.
