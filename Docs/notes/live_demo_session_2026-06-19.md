# SentinelTwin Live Floor-Plan Demo Session (Post-Fix Recovery Pass)

Date: 2026-06-19
Version under review: `6ab0dc0`

## Objective
Run the same buyer floor-plan flow with the recovery script from the updated import/understanding lane and document blockers as transcript-grade items.

## Transcript format (required)
- Screen observed
- User action requested
- System response
- Defect observed
- Next recommendation
- Buyer note

## Session script (live buyer role)

### Step A — Confirm route
**Sales rep cue:** “You’re on Create Site Twin, on Floor Plan import lane. We’ll stay in review mode until geometry, scale, and warnings are coherent.”

- If wrong page appears (`localhost:3001` mismatch), call out product view restore behavior and switch to Create Site Twin first.

### Step B — Start upload lane
- Action: Choose `Upload Floor Plan` and open/drop a plan image.
- Expected: Configure step shows source-profile selector and import action.

### Step C — Choose source profile
- Action: If plan is hand-drawn/photo, select `Hand-drawn / sketch` or `Low-res / phone snapshot`.
- Expected: Source profile hint updates, detector behavior changes via tuned thresholds.

### Step D — Interpret candidate counts
- Action: Open review details after upload.
- Explain: “Detected walls are reported as raw candidates and kept geometry. `kept/removed-by-filter` is the shell used for draft creation.”
- Expected: Header shows `kept / raw` values in the wall metric card.

### Step E — Optional scale correction
- Action: Enter known room dimensions and click `Apply Calibration`.
- Explain: This updates authoritative footprint/scale, but image anchors remain pixel-stable.
- Expected: `lastActionMessage` includes from/to dimensions delta.
- Defect handling: If preview feels unchanged, continue via warning/metrics changes (confidence, dimensions, warning list).

### Step F — Cleanup checks
- Action: Use `Auto-filter short walls` then inspect keep/exclude decisions.
- Action: bulk-exclude obvious legend/text candidates, apply corrections.
- Expected: kept counts and wall list totals should reduce in an understandable way.

### Step G — Transition boundary
- Action: When review is clean enough, click `Next: Review`.
- Explicit: Do **not** use `Create Draft Scene` here.

### Step H — Final review and close
- Action: Confirm summary fields (walls kept, confidence, gate, unresolved warnings, profile source, footprint source).
- If stable: click `Create Draft Scene`.
- If unstable: stop and hand back as actionable blockers.

## Current known defects (open follow-up)
- Calibration visual feedback can still feel subtle in preview-only layouts.
- Legend/text denoising is still mostly post-detection and benefits from optional preprocess controls.
- Large wall lists rely on manual scrolling; no filter/search yet.

## Outcome tracking
- Session owner should fill:
  - did `Next: Review` resolve safely in ≤2 minutes?
  - did applied calibration delta show before/after confirmation?
  - are 1245/1335-class counts explained to buyer as candidates vs kept?
  - was `Create Draft Scene` only used after review lane completion?

## Follow-up action map
- If user confidence is still low, mark blockers under:
  1) detector trust explanation,
  2) calibration model, 3) correction UX throughput.
- File blockers in `Docs/notes/sentineltwin_issue_review_2026-06-18.md` and route follow-up into `Docs/exploration/EXPLORATION_MAP.md` thread 11b.

## 2026-06-19 follow-up pass execution notes (post UX hardening)

- New runtime behavior expected after recovery:
  - Step labels in floor-plan configure/review read as review-lane actions: `Next: Review and Commit` (not finalize).
  - Floor-plan import preview is larger and has explicit kept/exclude semantics in the checkbox legend.
  - Wall/door/window rows are capped with an explicit `Show all` toggle to prevent overload on noisy plans.
  - The wall count language now distinguishes raw candidates from kept geometry in both configure and review summaries.
  - Manual calibration message includes an explicit authoritative lock row and source clarity.
- Remaining watchpoint in live guidance:
  - `Apply Calibration` still updates footprint values and warning text more clearly, but visual preview scale cannot be obvious in all aspect ratios due image-anchor behavior.

### Transcript-ready coaching cue updates used in this pass

| Screen observed | User action requested | System response | Defect observed | Next recommendation | Buyer note |
|---|---|---|---|---|---|
| Floor-plan configure with uploaded plan | Keep on this screen and run cleanup checks | Checklist sections show kept/excluded counts and explicit row legend | 1335/1245-like counts still look high without context | Treat as candidate vs kept and continue with auto-filter + manual exclude | Counts are detector candidates, not final geometry |
| Floor-plan calibration panel | Update dimensions and click Apply Calibration | Action message now prints full from→to footprint delta and lock badge | Visual geometry looks unchanged in image-space | Confirm change via footprint card + warnings + summary card | Pixel-anchored preview is by design; dimensions are now authoritative |
| Floor-plan checklist | Toggle long wall/opening list to “Show all” | Additional rows render in deterministic order | Long lists still noisy | Use exclude/keep-all + Apply Corrections in small batches | Keeps list tractable for large scans |
