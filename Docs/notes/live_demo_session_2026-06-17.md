# SentinelTwin Live Sales Demo Session

Date: 2026-06-17
Workspace: `/Users/pranay/Projects/SentinelTwin`

## Scope

Document the live buyer-style walkthrough from the actual implemented UI, including the user's responses and the demo narration.

## Transcript

### Turn 1

Sales rep:
“Welcome in. We’ll walk the product like a live screen-share. I’ll narrate what we’re seeing and we’ll move step by step through the actual app.”

User:
“consider me as a potential buyer exploring the app for our project, walk me through step by step as if you are giving a demo”

### Turn 2

Sales rep:
“I’ll do a live run-through based on the implemented code paths and the app that’s already running. I’ll confirm the active local URL, open the real screens, and then give you a click-by-click buyer walkthrough with the exact component names and issues I can spot from the live behavior.”

User:
“nope, i mean actual walkthrough, you look at code and based on that run me as if you are actually showing me screens , components etc, while i click and do what you say, highlight issues etc, you document this whole run”

### Turn 3

Sales rep:
“I’ve got the live shell and the main navigation mapped. I’m checking just the one or two view files that define the home screen content so the walkthrough matches what you’ll actually see on this build, not the docs.”

User:
“its runing already, and also dont make the docs your source of truth, tell me according to the actual implemented code”

### Turn 4

Sales rep:
“I’ll do the real live flow and keep the narration tied to the implemented code paths.”

User:
“continue”

### Turn 5

Sales rep:
“I’ve got the right file now. I’m reading the launcher home section and the studio entry points so I can give you a clean ‘click this, then that’ buyer walkthrough that matches the live build.”

User:
“you dont do the clicking, you just guide me by giving each step like you should be on this page, click this for this and so on”

### Turn 6

Sales rep:
“Perfect. I’ll switch into the sales-demo role and run this like a live screen-share session on the actual SentinelTwin build, grounded in the implemented flows.”

User:
“nope, you are the company selling sentineltwin and you being the sales guy has to walk me through, you will assume that role and act , think being on a video call or live demo session where you have a projector running the app and have handed me a laptop where you tell me everything and walk me through each screens etc, so something like you say we are on screen one where you see options like scan etc, what would you like to try, i say upload floor plan and click and report etc and we keep doing, and then you document the full session as a proper training /simulation , very detailed”

Sales rep:
“Perfect. I’ll switch into the sales-demo role and run this like a live screen-share session on the actual SentinelTwin build.”

### Turn 7

Sales rep:
“I’ll continue the demo from the product home and walk through the main screens and controls.”

User:
Attached a screenshot of the actual app and replied:
“i see none of those (you have to document everything that goes in this session including my responses)”

### Observed live screen

- Current page: `Create Site Twin`
- Left rail: `Create Site Twin`, `Studio`
- Main options:
  - `Scan Site Photos`
  - `Describe with AI`
  - `Upload Floor Plan`
  - `Import Site Twin`
  - `Build Manually`
  - `Verify from Footage`
- Right-side detail panel for the selected option
- Lower section: `Recent Site Twins`
- Left lower card: `Reference Baseline` with `Open Reference`

### Notes from implemented code

- The page is implemented in `apps/studio/src/components/site-intake/SiteIntakeHub.tsx`.
- The selected default intake path is `scan`.
- The CTA on the right updates based on the selected intake source.
- `Upload Floor Plan` is marked `Working` and outputs a `Scene Shell`.
- `Verify from Footage` is currently `Preview` only.

## Issues spotted during the walkthrough

- The earlier narration mentioned screens that are not on this actual page, so the demo needs to stay anchored to the intake hub the user is currently seeing.
- The flow needs to be conversational and driven by the buyer’s choice from the available intake cards.

### Turn 8

Sales rep:
“I’ve got the right screen now: this is the `Create Site Twin` intake hub, not the studio dashboard. I’m going to stay anchored here.”

User:
Attached a screenshot of the selected `Upload Floor Plan` state and asked:
“ok, i selected but do i click this other link? (also keep noting the issues you see yourself in screenshots i share, like here the right side is crowded/overlapping text and such ui/ux issues)”

Observed UI issues in screenshot:

- Right-side detail panel is visually crowded and text is stacking too tightly.
- The `What you’ll do` step list is compressed against the information card on the right.
- The `Open Studio Library` link appears visually detached and competes with the primary CTA.
- The overall density makes the selected card feel harder to parse than the left-side options.

### Turn 9

Sales rep:
“Do not click the other link first. Click the main CTA at the bottom right: `Upload Plan`.”

User:
Asked:
“ux needs review, text not visible proper, preview is cramed and too small, what do i do here? what are those checkboxes? 1335 walls detected? it seems to count the legend as walls?”

Observed UI issues in screenshot:

- The preview area is tiny relative to the amount of information below it.
- The detection summary is hard to read because the typography is too small for the dense layout.
- The right-hand metadata area feels visually overloaded.
- The wall count likely reflects raw detections from the imported image rather than semantic room walls, so legend and annotation lines may be contributing to false positives.

Code-grounded clarification:

- In `apps/studio/src/components/scan-to-scene/ImportReview.tsx`, the checkboxes are keep/exclude toggles for each detected wall, door, and window.
- The button text says `Uncheck false detections, then apply.`
- `Apply Corrections` filters the result down to whatever remains checked.
- The `Split First Kept Wall`, `Merge First Two Kept Walls`, and `Snap Kept Walls Orthogonal` buttons are manual cleanup helpers.

### Turn 10

User:
Asked:
“also look at the actual image i uploaded which i ahve shared also server got killed”

Observed image notes from `floorplan_1.png`:

- The blueprint contains a large right-side legend/schedule block with text boxes and borders.
- There are multiple dimension lines, labels, and annotation strokes across the page.
- The plan has dense symbol markup for doors, windows, furniture, and title blocks.
- A wall detector that operates on raw line segments could easily over-count these non-wall elements.
- The user’s suspicion that the legend may be counted as walls is plausible.

Runtime note:

- Local check showed no active listener on `http://localhost:3001` at the time of this turn, so the server appears to have been killed.

### Turn 11

User:
Asked:
“why does opening localhost:3001 open this page and not the starting page we were testing (add this also as part of the demo question from the user- me as well)”

Code-grounded explanation:

- `apps/studio/src/store/product-view-store.ts` defaults the top-level product view to `product_home`.
- `apps/studio/src/components/product/ProductViewRouter.tsx` decides which full-page surface to render based on that store.
- The studio workspace state is persisted in localStorage through the layout/governance slices, so the last workspace mode can reopen on refresh.
- The current screen is the live studio workspace, not the generic launcher, because the app is restoring the prior workspace state.


## Continued demo session notes

- User asked to continue the live walkthrough after the PDF-library/documentation change.
- Demo rule reaffirmed: stay in demo mode until the walkthrough ends; no code changes during the demo.
- Current live flow is still the floor-plan review path.
- Noted UI issues in the uploaded floor plan flow:
  - preview is very small and visually cramped
  - right-side panel text crowds the panel and is hard to read
  - the detection count appears suspiciously high for walls and may be counting linework/legend elements
  - checkboxes in the review list appear to toggle detected items for inclusion/exclusion before applying corrections
- Suggested next step in the live flow: review and prune obvious false positives, then continue to the review/next step in the guided upload flow.

- Demo interruption: Next.js build error reported in browser.
  - Error: Module not found: Can't resolve 'pdf-lib'
  - Scope: client component browser and SSR traces both point at `apps/studio/src/lib/pdf-export.ts`
  - Demo impact: PDF export paths are blocked until the dependency is resolvable in the running app bundle.
  - Presenter note: this should be called out as a live showstopper, not hidden.

- Dependency blocker resolved: `pdf-lib` is now installed in the studio workspace package (`apps/studio/node_modules/pdf-lib`).
- Demo guidance: reload or restart the running dev server so the client bundle picks up the installed dependency and the floor-plan flow can continue.

- User reached the upload-confirmation point after importing the floor plan and asked whether to proceed.
- Presenter guidance: if the preview and detection list look acceptable for this room, click `Next` to continue to the review stage; if the wall count or false positives still look wrong, stop here and prune obvious bad detections first.

- User reached the review screen and reported that the name field was not editable, dimensions were defaulted instead of reflecting the uploaded image, detected walls showed 1335, confidence showed 100%, and Tier 1 Gate showed Manual Review.
- Presenter guidance: do not click `Create Scene` yet; this screen is not trustworthy as a final commit because the imported values look wrong and the wall detection count appears inflated.
- UI note: Tier 1 Gate / Manual Review appears to be a human verification checkpoint that flags the import as needing attention before scene creation.

- User hit `Back` from the review screen and returned to the configure/import screen.
- Presenter explanation: the back action returns to the correction stage so the floor-plan import can be edited before scene creation.
- Current recommendation: this is still not a commit-ready state because the preview remains tiny, the wall count is still suspicious, and the UI suggests the imported plan needs correction or a different source image.

- User confirmed the source image is good and shared the original floor plan.
- Presenter assessment: the image is valid; the issue is in the floor-plan extraction, which appears to be over-counting linework and likely confusing the legend/text blocks with walls.
- Current guidance: do not replace the image; continue in the correction/review flow and treat the import as needing calibration and false-positive cleanup.

- User asked to walk through the exact correction choices one by one, live-call style.
- Presenter approach: use the correction screen in small steps, starting with low-risk verification before any apply/create action.

- Clarification: after clicking `Back`, the user is on the configure/import screen with `Next` at bottom right, not the review screen with `Create Scene`.
- Demo guidance: the correction walkthrough should happen on the configure/import screen first; `Create Scene` only appears after advancing to Review.

- User asked what needs correcting on the configure screen.
- Presenter assessment from the source image: the source floor plan is valid, but the imported scale is wrong and the detector is over-reading the drawing and legend text.
- Primary correction order recommended: fix scale calibration first, then prune any remaining false-positive wall/door detections if the counts still look inflated.

- User reported that `Apply Calibration` is not noticeably changing the preview or counts.
- Presenter issue note: the calibration control does not provide visible feedback, which makes the action feel untrustworthy and hard to demo.
- Demo guidance: if calibration has no visible effect, call that out as a UX defect and avoid pretending the state changed; continue with the live correction flow only if the UI reflects the adjustment.

- User clicked `Apply Calibration` and reported that the detected warnings updated.
- Presenter interpretation: calibration did affect detector state, even if the visual preview change was subtle.
- Next step in the walkthrough: review the updated warnings and then prune obvious false-positive wall entries if the counts remain inflated.

- Calibration now changed the detected state: walls show 1245, room size shows 12.5 x 7.9 m, and warnings changed to a new set including near-duplicate wall pairs, door/window marker mismatch, and many short wall fragments.
- Presenter read: the app is responding to calibration, but the calibrated footprint is still not aligned to the true source plan.
- Next demo step: keep this as a correction pass, inspect whether the current wall list is now closer to the actual perimeter, and avoid `Next` until the footprint and wall set look credible.

- User noted that the manually entered calibration values were replaced by `12.5 x 7.9` after apply.
- Presenter assessment: the app is not treating the entered dimensions as a hard override; it appears to be recomputing a normalized footprint from detector state.
- Demo issue note: this is confusing for users because the control suggests manual calibration but the UI substitutes a derived value without clearly explaining that behavior.

- User asked what to do next after the app normalized entered calibration values.
- Presenter guidance: stay on the correction screen, inspect the wall list first, and only uncheck obvious false-positive fragments or duplicates before considering `Next`.

- User shared the visible wall list after calibration.
- Current wall list is now only W1, W2, W3 plus D1 and D2 entries.
- Presenter read: the wall list is much cleaner than before and appears close to the real perimeter, so the demo should avoid aggressive pruning unless a duplicate is obviously present.

- Demo closed with a negative response from the user.
- User feedback: product felt buggy, complicated, and the imported values were wrong.
- Presenter outcome: demo ended without purchase interest; key objections were trust in extraction accuracy, calibration behavior, and overall UX clarity.

### Turn 12 (Continuation: implementation fix pass)

Sales rep:
“I’ve converted the walkthrough findings into concrete, executable behavior adjustments in the floor-plan import controls and demo runbook so we can test the same user journey without rewriting behavior during demo calls.

I completed the following implementation updates from the observed failure mode:
- Clarified kept-vs-raw wall counts in the review header and metric cards.
- Added `Auto-filter short walls` and explicit short-wall warnings in detection details.
- Improved calibration feedback with explicit source→target footprint changes.
- Added stronger correction action telemetry (`Applied corrections`) and reset confirmation.
- Kept demo mode contract in the skill so no code changes happen during live walkthroughs.

Outcome action:
- Next run should continue on imported-plan flow with explicit `Next` vs `Create Draft Scene` guidance, then use `Apply Calibration` with a known plan value, then `Auto-filter short walls`, then `Apply Corrections`, then `Next`.
- If any metric still looks wrong (`raw count` too high, footprint unstable, or warnings remain high), stop at review and document as explicit blockers.

### Turn 13 (Continuation: live post-fix flow + demo skill)

- We validated the demo-mode contract: `sentineltwin-demo-walkthrough` lives at `/Users/pranay/Projects/skills/sentineltwin-demo-walkthrough` and is surfaced to Codex via symlink at `/Users/pranay/.codex/skills/sentineltwin-demo-walkthrough`.
- In this run, the sales coach should now call out:
  - the raw-vs-kept wall split (`1335` raw candidate segments is not the same as kept shell),
  - the wall cleanup options (`Auto-clean short + duplicate walls`, `Apply Corrections`) before finalizing,
  - why manual dimensions appear to normalize after recalibration and what to verify after `Apply Calibration`.
- New implementation support to reduce user confusion in-floor:
  - `ImportReview` now includes stronger status messaging + cleaner wall summary text (`Keep W…` rows and kept/excluded totals),
  - auto-clean action for short/duplicate fragments,
  - importer-side noise-component filter plus raw segment provenance.
