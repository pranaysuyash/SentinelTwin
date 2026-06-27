## New Questions — Added 2026-05-25

### Q-016 [P0]: IEC 62676-4:2025 OODPCVS — exact PPM thresholds for all 7 levels?
The new standard (October 2025) replaces DORI with a 7-level framework.
We have approximate PPM equivalents but need the exact IEC-specified values.
**Source to check:** IEC 62676-4:2025 document (paid — ~200 CHF), or JVSG's implementation
(they published support in October 2025), or Axis's blog post on the standard.
**2026-05-27 resolution:** Implemented approximate values (25/50/62.5/100/125/250/500) from the standards doc.
Exact values are behind the IEC paywall. These are the same values JVSG and Axis tools use in practice.
If professional-grade precision is needed before V0.1 launch, purchase IEC 62676-4:2025 (~200 CHF).

### Q-017 [P1 — RESOLVED 2026-05-31]: GSAP → Framer Motion replacement — what exactly needs to change?
GSAP's license prohibits SaaS use without paid Club GSAP license.
Replacement: `motion` (Framer Motion v11, MIT).
**Resolution:**
- **Decision logs:** D-011 in `DECISION_LOG_ADDENDUM.md` (initial replacement decision), D-018 in `DECISION_LOG.md` (formal resolution with Motion One for path replay + Framer Motion for UI), D-259 in `DECISION_LOG.md` (final call).
- **Runtime truth:** `07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md` confirms GSAP is not in `package.json`; `framer-motion ^12.40.0` is the active dependency.
- **Architecture doc:** `07_RENDERING_PIPELINE.md` updated with addendum banner and corrected stack listing.
- **Doc trail closure:** 14 docs files originally referenced GSAP. Per addendum convention, base files retain historical references as provenance of the decision process. Resolution authority lives in this entry and the decision logs above.

### Q-018 [P1]: DUSt3R/MASt3R are CC BY-NC — confirm VGGT is a viable replacement.
DUSt3R and MASt3R are CC BY-NC-SA 4.0 — cannot be used commercially.
VGGT claims MIT license. Verify: check actual GitHub license file, not just README.
**Impact:** If VGGT is MIT, it's the V0.3 multi-photo 3D engine.
If VGGT is also non-commercial, we need COLMAP (BSD) as the fallback.

### Q-019 [P0]: IEC 62676-4:2025 — update quality model from DORI to OODPCVS.
The simulation must use the current standard. Old DORI (4 levels) was superseded October 2025.
**Action required:**
- Update `qualityScoring.ts` to support OODPCVS (7 levels) as default
- Keep DORI (4 levels) as legacy option in SimulationAssumptions
- Update DECISION_LOG.md with this as D-010 when resolved

### Q-020 [P1]: GDPR DPA report formats — what does each DPA actually require?
UK ICO, French CNIL, German BfDI each have different documentation requirements.
CNIL is most aggressive on enforcement (€200k+ in fines 2025/2026).
**Research:** Find the official guidance from each DPA on camera system documentation.
Then design report templates for each.

### Q-021 [P1]: Insurance underwriters — which carriers explicitly ask for camera coverage documentation?
Name specific carriers if possible. This is a B2B distribution channel, not just market context.
**Research approach:** Talk to security consultants who do insurance audits.
Look for commercial property insurance questionnaires that include camera coverage questions.

### Q-022 [P2]: PCI DSS Section 9 — exact camera coverage requirements?
PCI DSS requires video cameras/access controls for sensitive areas.
What exactly does it specify? What zones require what quality?
**Impact:** Retail-specific compliance report format.

### Q-023 [P1]: IFC open-source parsers — quality and completeness?
`ifcopenshell` (Python, LGPL) and `web-ifc` (JS/WASM, MIT) are the main options.
**Research:** Can either extract walls, doors, windows, and room geometries reliably
from real-world BIM files? What does the output look like?
**Impact:** V0.4 BIM import feature.

### Q-024 [P2]: NVIDIA Omniverse + Gaussian splat — does it overlap or complement?
NVIDIA is positioning Omniverse as a "digital twin platform."
Siemens announced Omniverse integration in January 2025.
**Research:** What does Omniverse provide? Is SentinelTwin a plugin for it or a competitor?
Could we integrate SentinelTwin's simulation as an Omniverse extension?

### Q-025 [P2]: OpenAI Agents SDK — multi-agent parallel execution in browser vs server?
SentinelTwin's AI pipeline runs in Next.js API routes (server-side).
Can the Agents SDK orchestrate agents that call back into the browser for simulation results?
Or does the simulation always run server-side in a worker?
**Impact:** Architecture of the command→verify→explain loop.

### Q-041 [P0]: Pascal fork reactivation conditions
D-001 parked the Pascal Editor fork (`@pascalapp/core` not installed in `node_modules`).
The Pascal contract (Site → Building → Level hierarchy, `AnyNode` extension point, flat-dictionary
Zustand store, spatial grid, CSG cutouts) has architectural references throughout the codebase
but zero runtime. A new component that adds a nodeType or floor must either:
(a) reactivate Pascal (add it to the monorepo, rewire store consumers, port existing schema),
(b) extend the flat `SecurityScene` schema with a `zLevel` field, or
(c) design a new hierarchy independent of Pascal.
**Next:** Determine threshold conditions — what feature/capability justifies the cost of Pascal
reactivation? D-001 cited "Pascal is the spatial editing foundation." Is it still needed?
**Priority:** P0 — blocks multi-floor scenes.
**Source:** `Docs/architecture/02_PASCAL_EDITOR_INTEGRATION.md`, `packages/core/src/schema/`,
`selection-geometry.ts`.

### Q-042 [P0]: packages/core vs apps/studio schema duplication — resolution path
`apps/studio/src/schema/security-scene.ts` is a duplicate of `packages/core/src/schema/security-scene.ts`.
Both are imported by client code. Drift is currently suppressed only by D-286 (forced `tsc -b --force`).
Three resolution paths:
(a) Delete `apps/studio/src/schema/` and rewire all imports in `apps/studio/` to `@sentineltwin/core`.
(b) Keep `apps/studio/src/schema/` as a thin re-export shim (`export * from "@sentineltwin/core"`)
    that prevents drift without breaking import surface.
(c) Do nothing and rely on `tsc -b --force` to catch mismatches at compile time.
**Next:** Measure how many imports from `@/schema/security-scene` exist in `apps/studio/src/` vs
imports from `@sentineltwin/core`. Assess the drift risk quantitatively.
**Priority:** P0 — affects all schema-aware code in the app.
**Source:** Both schema files, `apps/studio/tsconfig.json` path aliases.

### Q-043 [P1]: Unified creation component vs entry-point-specific growth
Current intake surface is distributed across 5+ entry-point components
(`SceneBuilderWizard`, `ScanSiteWizard`, `GuidedCaptureAssistant`, `SiteIntakeHub`,
`AiLayoutDraftView`, `ImportReview`). `SiteIntakeHub` is the closest to "one shell for all
sources" but delegates to separate sub-flows per source. A canonical "creation flow" component
could own the per-source contract (source type → session → draft → review → activation) in a
single shell.
(b) Build a `CreationFlowShell` that composes per-source sub-components under a shared state
    contract (`IntakeSession` → `SiteTwinDraft` → `SiteDraftApprovalResult` → active scene).
(c) Continue with source-specific entry points and only unify if a 7th source type is added.
**Next:** Determine if a 7th source type is expected before V0.2. If yes, build the shell;
if no, keep distributed and re-evaluate at V0.3.
**Priority:** P1 — affects architecture cleanliness but not shipping.
**Source:** `apps/studio/src/components/site-intake/` + `scan-to-scene/` + `product/`
component directory listing.

## New Questions — Added 2026-06-19 (UI review, `Docs/review/UI_REVIEW_2026-06-19.md`)

### OQ-UI-01 [P0]: Primary persona — operator (daily, known site) or buyer/consultant (one-time author + handoff)?
The current UI tries to serve both and serves neither. A daily operator needs fast
re-entry into a known site with ambient risk status. A buyer/consultant needs a
trustworthy one-time authoring flow that produces a defensible handoff artifact.
These imply different *default contextual surfacing* (not different feature sets — the
features stay; what changes is which are foregrounded by default), different density
defaults, and different trigger contexts for operator-grade surfaces (Governance, ONVIF,
Sensors, Model Eval).
**Decision needed before:** Density Pass D1/D2/D3 scoping (`Docs/review/UI_REVIEW_2026-06-19.md`).
**Priority:** P0 — sets the default-foreground target for every subsequent density decision.
**Source:** UI review Group B/D, `StudioDashboardHome.tsx`, `SiteIntakeHub.tsx`.

### OQ-UI-02 [P1]: Should "AI proposes, simulation verifies" be a visible UI state or a behind-the-scenes contract?
The canonical rule (`AGENTS.md` → Canonical Rules) and the product's primary differentiator
say AI output is always a *proposal* pending verification. The current UI treats AI-suggested
scene changes identically to manual edits — no distinct pending state, no "verify now" affordance.
Making it visible (Trust Pass T3) strengthens the differentiator but adds interaction weight.
**Decision needed before:** Trust Pass T3 (`Docs/review/UI_REVIEW_2026-06-19.md`).
**Priority:** P1 — product-decision, not engineering. Affects `use-ai-command.ts`,
`AiLayoutDraftView.tsx`, counterfactual preview surfaces.
**Source:** UI review Group C3.

### OQ-UI-03 [P1]: Density direction — contextual priority (Option 4), 3-plane re-architecture (Option 1), tab consolidation (Option 2), or workspace presets (Option 3)?
The UI review documents four options for the 19-tab / three-navigation-grammar density problem.
*All four are feature-preserving* — none delete features or logic; the question is how features
are arranged and surfaced.
- **Option 4 (contextual priority)** is the recommended first move: connect the rendering layer
  to the contextual layer the store already computes (`scene-slice.ts:686`, `contextualBottomTabForNode`,
  `enabledAnalysisModules`, `dockAttention`). Tabs render contextually-prioritized (foreground =
  relevant to current selection/mode/workflow; "more" for the rest, never deleted). No re-architecture.
- **Option 1 (3-plane)** remains a valid later evolution *on top of* Option 4 if contextual priority
  proves insufficient. Bold; changes product visual identity.
- **Option 2 (tab consolidation)** cheapest; treats symptom not cause.
- **Option 3 (workspace presets)** studio-only; doesn't fix dashboard density.
**Decision needed before:** Density Pass D1 implementation. Recommended path: try Option 4 first
(lowest disruption, highest fidelity to existing architecture), keep Option 1 available as a
later evolution. Should be confirmed via a dedicated brainstorm, not an implementation pass.
**Priority:** P1 — blocks the highest-leverage Density work but does not block Trust/Intake passes.
**Source:** UI review Part 3; `BottomPanel.tsx:51-77` (TAB_GROUPS); `scene-slice.ts:686`
(contextual infrastructure already exists).

### OQ-UI-04 [P2]: Field-tablet form factor — V1 commitment or V2+?
On-site tablet intake is the primary real-world intake context (operator scanning the site).
The current responsive story is phone (≤720px, canvas-only) + desktop. There is no tablet /
field-tablet layout. If tablet is V1, the responsive system needs a third breakpoint and the
ScanSiteWizard guided flow (I2) needs a tablet-first layout.
**Decision needed before:** Intake Pass I2 layout decisions; Visual Pass V3 type scale (may need
tablet-aware sizes).
**Priority:** P2 — affects Intake Pass layout but does not block Trust Pass.
**Source:** UI review Group F1; `StudioShell.tsx:124-130` (single compact-viewport breakpoint).

## Resolutions — Added 2026-06-23 (Visual / Intake / Density passes)

The three OQ-UI questions below were resolved by first-principles reasoning
during the V1-V3 / I1-I3 / D2-D3 implementation pass (per motto_v3 §0 —
"Build for the best app, not the safest small change"; the motto is the
answer, not the user). Documented here so future sessions inherit the
decisions rather than re-asking.

### OQ-UI-01 RESOLVED: Primary persona — default to buyer, disclose operator.
**Decision:** The UI defaults to buyer/consultant legibility on first run and
progressively discloses operator surfaces. Rationale from first principles:
the product thesis is a live security digital twin (operator framing), but the
06-17 demo was a buyer moment, and you can't sell to a buyer who bounces.
Operators are return users who'll learn the power surface; buyers are
one-shot. The D1 foreground+overflow model and D3 dashboard priority split
both implement this: buyer-relevant sections/tabs foreground; operator-grade
surfaces (Governance, Workspace library, Project Settings, Assumptions)
surface behind overflow but remain reachable in one interaction.
**Implemented in:** D1 (BottomPanel), D3 (StudioDashboardHome section picker).

### OQ-UI-03 RESOLVED: Density direction — Option 4 (contextual priority) canonical.
**Decision:** Option 4 is the committed direction. Options 1/2/3 remain
documented as evolution paths but are not being pursued — re-architecting now
would be the unbounded rewrite motto_v3 §0.13 forbids, and Option 4 is built,
tested, and working. The "three navigation grammars" (ProductView / ViewMode /
BottomTab) are NOT collapsed — they are documented as a deliberate layered
model (intent → canvas → analysis) in `product-view-store.ts`. The four
"studio sub-view" ProductView entries are deliberate intent-driven deep links,
not parallel truth.
**Implemented in:** D1, D2 (product-view-store.ts header comment).

### OQ-UI-04 RESOLVED: Field-tablet form factor — V1 commitment.
**Decision:** On-site tablet is V1. First principles: the primary real-world
intake context is an operator on-site with a tablet scanning the site — a
phone-only fallback defeats that use case. The V3 type scale is tablet-aware
(CSS variables bump up at ≤1024px width) so the on-site scan flow gets a
legible scale without per-component media queries. The ScanSiteWizard (I2)
layout is authored against the tablet-aware scale.
**Implemented in:** V3 (globals.css tablet media query + TYPE_SCALE).
