# SentinelTwin Demo Run Log

Transcripts for all buyer-facing demo sessions. Each run documents: screen observed, action taken, system response, defects observed, next recommendation, and buyer trust notes.

---

## RUN 1 — 2026-06-18 · Agent-driven (automated)

**Feature under demo:** Contextual panel UX — panels hidden by default, opening only on high-value object selection  
**Persona:** Retail security manager evaluating for multi-site deployment  
**Operator:** Agent (Claude) driving via canvas PointerEvents + eval  
**Scene:** Small Retail Shop Demo → New Blank Scene → back to Small Retail Shop Demo  

---

### Transcript

| # | Screen observed | Action taken | System response | Defect observed | Next recommendation | Buyer trust note |
|---|---|---|---|---|---|---|
| 1 | Studio default · Small Retail Shop Demo · 5 cameras · 82% coverage chip in ViewModeBar · **zero panels open** | None — baseline capture | Right dock = null. Bottom dock = null. Coverage chip visible in tab bar. | None | Confirm zero-panel default state with client — this is the pitch moment | High trust. Clean first impression. |
| 2 | Same — deselected state | Clicked scene picker → **New Blank Scene** | Loaded `createBlankSecurityScene()`: 10×8m empty room, 4 walls, 0 cameras, "Add your first camera" empty-state prompt, demo scene quick-access chips at bottom | None | Show client the blank canvas entry point — no wizard, no forced flow | High trust. Client sees they can start from scratch. |
| 3 | Blank scene · no panels | Dispatched PointerEvent at Camera 3 label position (clientX:415, clientY:178) on WebGL canvas | **Right panel opened** — Camera 3 Context Inspector: MARGINAL quality badge, ACTIVE status, 4MP Ceiling mount, DORI range table (Detect 11.0m, Recog 6.2m, Ident 3.1m), Feed mode controls, DORI overlay toggles | None | Walk client through each DORI band — this is the differentiator vs. legacy tools | High trust. Panel opens exactly on camera click. No bottom drawer. |
| 4 | Camera 3 selected · right panel open | Dispatched PointerEvent at wall/floor area (clientX:290, clientY:570) | Camera 4 entered **aiming mode** — "Drag to aim - release to place" status, camera preview appeared | ⚠️ **Aiming mode triggered unintentionally.** Clicking near existing cameras in the lower canvas area can activate Place Camera mode instead of selecting a wall. Escape recovers. | Avoid demonstrating wall-click-to-deselect in this area of the scene. Use Escape to exit modes. | Trust dip. Buyer could interpret this as "tool gets stuck." |
| 5 | Aiming mode active | Escape × 3 dispatched | Exited aiming mode. Camera 3 still selected. Right panel intact. | Aiming mode required multiple Escape events — first Escape didn't fully clear | Add single-Escape mode exit in Place Camera tool | Low risk, recoverable |
| 6 | Camera 3 selected · clean panel state | Canvas click at (clientX:150, clientY:220) — top-left corner | Camera 5 hover tooltip appeared ("8MP · Ceiling mount · CLICK TO SELECT") — camera 3 panel still active | Canvas coordinate targeting is unreliable at this scene angle and zoom. Cannot reliably click walls to demo silent-selection. | For live demos, pan camera to face a wall directly before clicking it, or use keyboard shortcut to deselect | Medium risk for demo. |

---

### Summary

**What worked:**
- Blank scene creation from scene picker — clean, immediate, no wizard
- Camera selection via canvas PointerEvent — right panel opened correctly with full Camera 3 DORI data
- Default state — zero panels confirmed via DOM snapshot (no dock nodes rendered)
- Coverage chip always visible — 82% in ViewModeBar tab without opening any drawer

**What was not trustworthy:**
- Wall-click silent selection could not be demonstrated — canvas coordinate targeting is fragile at current scene angle; clicked near a camera instead and triggered aiming mode
- Aiming mode required 3× Escape to exit

**Defects to fix before next run:**

| Defect | File | Priority |
|---|---|---|
| Single Escape should fully exit Place Camera aiming mode | `src/components/workspace/editing/` (camera placement tool) | Medium |
| Canvas PointerEvent targeting fragile at oblique angles | N/A — demo technique issue, not a product bug | Low |
| MARGINAL badge needs a buyer-friendly one-liner in the panel | `src/components/inspector/` | Low — prep, not a bug |

---

## RUN 2 — 2026-06-18 · Live (user at the wheel)

**Feature under demo:** Same — contextual panel UX + blank scene clean flow  
**Persona:** Retail security buyer (played by Pranay)  
**Operator:** User driving browser · Agent coaching  
**Status:** 🟡 In progress  

---

### Step 1 — Pending user action

**Instruction given:** Open scene picker → click New Blank Scene → report what you see.

*(Transcript rows will be added as the run progresses)*

---

### Transcript

| # | Screen observed | Action taken | System response | Defect observed | Next recommendation | Buyer trust note |
|---|---|---|---|---|---|---|
| — | *awaiting first user action* | — | — | — | — | — |

---

*This file is appended after each demo run. Keep both runs in this file — do not archive mid-session.*

## RUN 3 — 2026-06-19 · Live (user at the wheel)

**Feature under demo:** Floor-plan import review lane — candidate understanding, calibration, and review-boundary navigation  
**Persona:** Retail security buyer (walkthrough, negative first-pass)  
**Operator:** User driving browser · Agent coaching

---

### Transcript

| # | Screen observed | Action taken | System response | Defect observed | Next recommendation | Buyer trust note |
|---|---|---|---|---|---|---|
| 1 | Floor-plan configure mode after upload | Confirm source profile and begin review checks | Source profile hint updates and candidate summary appears | Wall counts still appear inflated on noisy diagrams | Treat raw counts as candidates vs kept and move through cleanup lane | Trust starts to recover with better count transparency |
| 2 | Floor-plan calibrate panel | Enter dimensions and click `Apply Calibration` | Action message updates with explicit `from→to` diff and authoritative lock card | Pixel preview looks visually stable | Confirm through metrics and lock card; remind preview stays image-anchored | Removes “fake control” concern |
| 3 | Detection correction lists | Use auto-filter + show-all toggle and apply corrections | Kept/excluded counts shift; rows remain readable with toggle | Dense lists still long on very noisy scans | Keep batch operations, prefer coarse cleanup first | Better guidance for large plans than checkbox flood |
| 4 | Boundary check before finalization | Ask whether to `Next` or `Create Draft Scene` | Guidance now clarifies `Next: Review and Commit` then final `Create Draft Scene` | Historical ambiguity around this path | Use this exact progression rule in demo coaching | Reduces wrong-click risk in live demos |

### Outcome

- The review lane is now legible enough to continue even with ~1000+ segment inputs.
- Remaining improvement needed: preprocessing toggle for text/annotation suppression before detection.

## RUN 4 — 2026-06-30 · Live Recovery (buyer-style floor-plan objection handling)

**Feature under demo:** Floor-plan import trust recovery, route-state continuity, and review-lane transitions
**Persona:** Security buyer (negative on first pass, requires explicit trust repair)
**Operator:** User-driven flow with guided sales-mode narration

### Transcript (compressed)

| # | Screen observed | Action taken | System response | Defect observed | Next recommendation | Buyer trust note |
|---|---|---|---|---|---|---|
| 1 | Running URL opens prior scene (`localhost:3001`) | Confirmed current route and clarified restore state | Route matched persisted workspace state | Session start target mismatch | Continue from current route, then explicitly return to Create Site Twin if required | First-run trust impact (state continuity issue) |
| 2 | Upload Floor Plan intake card | Clicked primary source card | Source profile + import stage becomes active | Right metadata panel too dense, preview compact | Use primary CTA path only; avoid side links | UX density blocks first impression |
| 3 | Floor-plan configure with raw wall list | User asked about checkbox meaning and high wall count | Wall list exposed keep/exclude actions | “1335/1245” counts interpreted as final geometry | Reframe as raw candidates vs kept geometry before correction |
| 4 | Apply calibration | Entered dimensions, clicked Apply | Metrics and warnings changed | Preview did not visually shift as expected | Validate via action delta and calibration lock rows |
| 5 | Back/forward flow check | User asked if this is Next vs Create Scene | Corrected flow boundary: `Next` for review transition, `Create Draft Scene` for finalization | Button intent remained unclear without narration | Keep strict screen-by-screen coaching path |
| 6 | Wall list review + correction path | Asked exact correction steps | Cleaned to smaller kept set | List remains long and requires batch workflow | Keep batch actions, avoid one-off selection overload |

### Outcome

- Buyer sentiment remained negative due to trust + readability friction.
- Session ended with explicit request to treat this as a backlog pass and resurface only after recovery.

### Acceptance notes for next run

1. Route bootstrap should be deterministic on first open.
2. Calibration should show explicit before/after footprint and pixel-scale delta.
3. Wall metric semantics need persistent raw/kept context.
4. Review lane transition must remain explicit in copy and button labels.
