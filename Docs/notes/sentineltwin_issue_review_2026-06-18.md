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
