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
