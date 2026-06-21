# SentinelTwin UI Review — Executive Summary

**Date:** 2026-06-19
**Full review:** `Docs/review/UI_REVIEW_2026-06-19.md`
**One-line verdict:** The UI's #1 problem is not missing features — it is **cognitive load and trust surface area**. The simulation engine is strong; the UI under-leverages it and over-shows operator-grade infrastructure to first-run buyers.

---

## The reframing

The 2026-06-17 buyer demo failed on **trust, complexity, and value clarity** — not on feature gaps. Four passes of fixes (06-18, 06-19) made the surface legible to engineers, not to buyers. The same three objections survived.

This review weights findings by their effect on **operator legibility and trust**, not by feature completeness. A feature that exists but is illegible scores harder than a feature that is missing.

---

## The four jobs the UI must do (in priority order)

1. Make the current security posture legible at a glance (~2s to "are we covered / where are we blind / how bad").
2. Make cause legible on edit (the *why* of a coverage change in the same gesture).
3. Make proposed changes defensible (verified delta + source, buyer-repeatable language).
4. Stay honest about computed vs assumed vs unknown (truth labels weighted to decision impact).

The product thesis — "every edit updates the risk map, the simulation must feel alive" — is the test being failed. The five verbs of the core loop are all built; they are not visually connected in time.

---

## Diagnosis — 6 groupings

| Group | Severity | Headline |
|---|---|---|
| **A. Trust & confidence surface** | 🔴 | `100% confidence` next to red warnings. Truth labels too small. Locked vs derived values look identical. *This is what lost the buyer.* |
| **B. Cognitive load / density** | 🔴 | Bottom panel = **19 tabs**. Dashboard = 11 toggleable sections. **Three independent navigation grammars** (`ProductView`, `ViewMode`, bottom tabs). The contextual layer that knows *which tabs matter for the current context* already exists in the store (`buildContextualSelectionPatch`, `contextualBottomTabForNode`, `enabledAnalysisModules`, `dockAttention`); the rendering layer renders all 19 flat regardless. **Not a deletion problem — an arrangement/contextual-visibility problem.** |
| **C. Core loop doesn't pulse** | 🟠 | No live edit-delta after recompute. Recommendations not causally threaded to the edit that triggered them. "AI proposes, sim verifies" is invisible — AI proposals look identical to manual edits. |
| **D. Intake / first-run** | 🔴 | Three competing intake surfaces. ScanSiteWizard built looser than the approved design. Floor-plan correction UX is still engineer-grade (checkbox wall lists). |
| **E. Visual system** | 🟡 | Canonical map token board not enforced as code. DockPanel "collapsed" fully hides (design wanted icon rail). No type scale. |
| **F. Mobile / compact** | 🟡 | One binary 720px breakpoint. No field-tablet story for on-site intake. |

---

## Long-term direction — four options (feature-preserving by construction)

*None of these delete features. The contextual layer that knows what's relevant already exists in the store; the task is making the rendering honor it.*

1. **Three-plane re-architecture (Risk / Authoring / Evidence)** — re-organizes around *what the operator is doing right now*. Bold; staged; changes product visual identity. Remains a valid longer-term evolution.
2. **Tab consolidation only** — two-level group nav. Cheapest; treats symptom not cause.
3. **Workspace presets as primary navigator** — per-mode tab manifests. Studio-only; doesn't fix dashboard density.
4. **Contextual priority (recommended first move)** — *don't re-architect.* Make the 19-tab strip render contextually-prioritized tabs (foreground = relevant to current selection/mode/workflow; "more" affordance for the rest, never deleted). The contextual computation already exists (`scene-slice.ts:686`, `contextualBottomTabForNode`, `dockAttention`); only the display layer needs to honor it. Lowest disruption, highest fidelity to the existing architecture, scales as new features land.

**Recommendation:** Option 4 first (panel density) + navigation reconciliation (D2) + contextual dashboard sections (B2). Option 1 remains available as a later evolution *on top of* Option 4 if contextual priority proves insufficient.

---

## Improvement passes (prioritized)

### Trust Pass — fixes the buyer trust break
- **T1.** Honest confidence renderer: banded + source-tagged, ban `100%` when warnings exist. *Smallest change, largest effect.*
- **T2.** Visual lock treatment for user-authoritative values (color + icon + border, not just a badge).
- **T3.** AI-proposal visual grammar — distinct "pending verification" state so the canonical rule is *visible*.

### Density Pass — fixes the "too complicated" objection (feature-preserving)
*Not "hide features behind a disclosure." The task is contextual arrangement: connect the rendering layer to the contextual layer the store already computes.*
- **D1.** Render the 19-tab panel by contextual priority (foreground = tabs relevant to current selection/mode/workflow; "more" affordance for the rest) — Option 4. Data and contextual selectors already exist (`TAB_GROUPS`, `buildContextualSelectionPatch`, `contextualBottomTabForNode`).
- **D2.** Unify three navigation grammars (`ProductView` / `ViewMode` / bottom-tabs) into one vocabulary — reconciliation, not removal.
- **D3.** Operator-grade surfaces (Governance, ONVIF, Provider Governance, Model Eval, Support Delivery, Identity Conflict, Sensors) surface when their trigger context is active and are reachable on demand otherwise — never removed, always arranged.

### Loop Pass — makes the product feel alive
- **L1.** Ambient edit-delta chips on metrics after every edit (reuse `DeltaMetricsBar`).
- **L2.** Causal issue threading — issues touched by the last edit float to top with a tag.

### Intake Pass — fixes the actual buyer path
- **I1.** One intake surface (`SiteIntakeHub` only); subordinate or remove the others.
- **I2.** Build ScanSiteWizard as designed (10-step horizontal stepper, per design pack).
- **I3.** Buyer-grade floor-plan correction — canvas-direct keep/drop, not checkbox lists.

### Visual Pass — coherence
- **V1.** Enforce canonical map token board as the only color source (lint).
- **V2.** Three-state DockPanel collapse (icon rail, not invisible).
- **V3.** Document a type scale.

---

## If only one thing ships next

**Trust Pass T1 (honest confidence renderer).**

It is the smallest change with the largest effect on the 06-17 failure, the cleanest contract fix under `motto_v3 §0.11 / §0.2`, and it can be locked against regression by extending the existing `truth-audit` harness.

If two things ship: **T1 + I3** (buyer-grade floor-plan correction). Together they close both halves of the 06-17 trust break — the confidence lie and the unworkable correction surface.

---

## What is *not* the problem

- **The simulation engine.** Strong, fast, deterministic, well-tested. The UI under-leverages it.
- **Feature inventory.** Large but tracked in `FULL_VISION_GAP_INVENTORY.md`. Not the burning platform.
- **The trust-audit harness.** Exists, good, should be extended to cover confidence language (T1).

## What needs a decision before the Density Pass

- **OQ-UI-03:** Try Option 4 (contextual priority) first, or commit to Option 1 (planes) / Option 2 (tab consolidation) / Option 3 (presets)? All four are feature-preserving; the question is arrangement model. Option 4 is recommended first because it requires no re-architecture. Needs a brainstorm, not an implementation, to confirm.
- **OQ-UI-01:** Primary persona = operator (daily, known site) or buyer/consultant (one-time author + handoff)? Different default UIs; current serves neither.
