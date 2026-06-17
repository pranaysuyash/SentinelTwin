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

