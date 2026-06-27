# SentinelTwin Live Floor-Plan Demo Session (2026-06-30)

Date: 2026-06-30
Workspace: `/Users/pranay/Projects/SentinelTwin`
Version under review: live recovery run

## Scope

Buyer-style live walkthrough on implemented UI for floor-plan intake with negative signal handling, objection handling, and route/state continuity.

## Live flow transcript (screen-by-screen)

### Screen 1 — Runtime anchor mismatch discussion

- **Observed screen:** `Create Site Twin` intake hub (left rail shows `Create Site Twin`, `Studio`, intake mode cards).
- **Question from user:** “why does opening localhost:3001 open this page and not the starting page we were testing?”
- **Response (demo rule):** Explain persisted product-view state and workspace bootstrap behavior; confirm we are intentionally continuing from the current route.
- **Issue observed:** route/state surprise breaks first-time expectation.
- **Recommendation given:** stay on the live route for continuity, then return intentionally to intake target.
- **Buyer note:** user called out trust friction around first-click state and expected home path.

### Screen 2 — Upload flow selected

- **Observed screen:** `Upload Floor Plan` card selected.
- **Question:** “ok, i selected but do i click this other link?”
- **Response:** do the main intake action for this source, not side links.
- **Issue observed:** crowded right-side metadata panel, low-density preview, cramped list text.
- **Recommendation:** follow the primary CTA, then clean up counts in review lane before any finalization.
- **Buyer note:** visual layout is still a major UX obstacle under first pass.

### Screen 3 — Upload confirmation + review

- **Observed screen:** floor plan preview + detection summary.
- **Question:** “what do i do here? what are those checkboxes? 1335 walls detected?”
- **Response:** checkboxes are keep/exclude semantics for candidate geometry; large numbers are raw candidates likely including legends/text in legacy plan content.
- **Issue observed:** user saw 1335 and then 1245 counts and interpreted them as final geometry, while system was not clear enough before interaction.
- **Recommendation:** treat counts as candidates, run auto-filter + targeted excludes, verify floor dimensions changed by calibration audit row before moving on.
- **Buyer note:** confidence remains low if raw/kept semantics are not visually enforced with a stronger comparison cue.

### Screen 4 — Calibration interaction

- **Observed screen:** calibration panel fields and dimensions.
- **Question:** “values are not visible changed / apply not noticeable.”
- **Response:** confirmed calibration is authoritative to footprint scale; advised watching action message + wall summary deltas.
- **Issue observed:** visual deltas are subtle or near-invisible in image-space.
- **Recommendation:** call out this design contract clearly and only proceed once delta message + metric cards match expectation.
- **Buyer note:** this is currently the highest ambiguity point in the lane.

### Screen 5 — Backtracking to configure

- **Observed screen:** back from review to configure.
- **Question:** “we were on create scene or this screen?”
- **Response:** clarify strict flow boundary:
  - `Next: Review` (or equivalent review transition)
  - `Create Draft Scene` only on final lane.
- **Issue observed:** button intent was still ambiguous despite previous fixes.
- **Recommendation:** continue correction pass on configure/review lane only.
- **Buyer note:** repeated ambiguity significantly affects decision to continue demo.

### Screen 6 — Review wall list and cleanup

- **Observed screen:** wall list (collapsed then expanded), auto-filter + apply corrections.
- **Question:** “what do i need to correct?”
- **Response:** prioritize coarse cleanup first, preserve minimal clean wall topology for the store; avoid aggressive edits on ambiguous segments.
- **Issue observed:** long lists still create operator fatigue.
- **Recommendation:** list-scale control and clearer preview-geometry diff remain needed.
- **Buyer note:** flow is recoverable but still not “buy-ready” in one pass.

### Outcome

- User concluded with negative purchase signal: too much friction to trust import in one iteration.
- Session ended with explicit defect capture request and request for follow-up implementation work.

## High-impact defects captured during run

1. Route/state continuity: `localhost:3001` startup mismatch remains user-facing confusion.
2. Floor-plan lane density and readability: cramped metadata panel and tiny preview.
3. Candidate count trust: raw-vs-kept semantics need stronger on-screen reinforcement.
4. Calibration UX: authoritative scale changes with subtle image-space feedback.
5. Step intent: `Next` vs `Create Draft Scene` still requires repeated explicit coaching in live sessions.

## Immediate next actions

1. Add calibration diff badge + before/after footprint row in preview card.
2. Add an explicit “candidate source” row with kept/raw and confidence delta.
3. Expand wall list ergonomics (show all, batch actions, filter by reason).
4. Improve route entry determinism for first-time `/` -> `Create Site Twin` flow.
5. Keep this exact run format as reusable demo template for future negative/objection sessions.
