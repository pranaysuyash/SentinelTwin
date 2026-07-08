## New Questions — Added 2026-05-25

### Q-016 [P0 — RESOLVED 2026-05-27]: IEC 62676-4:2025 OODPCVS — exact PPM thresholds for all 7 levels?
The new standard (October 2025) replaces DORI with a 7-level framework.
We have approximate PPM equivalents but need the exact IEC-specified values.
**Source to check:** IEC 62676-4:2025 document (paid — ~200 CHF), or JVSG's implementation
(they published support in October 2025), or Axis's blog post on the standard.
**Resolution (2026-05-27):** Implemented approximate values (25/50/62.5/100/125/250/500) from the standards doc across `@sentineltwin/core` (`OODPCVS_THRESHOLDS`). Exact values are behind the IEC paywall. These are the same values JVSG and Axis tools use in practice. If professional-grade precision is needed before V0.1 launch, purchase IEC 62676-4:2025 (~200 CHF).

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

### Q-019 [P0 — RESOLVED 2026-06-15]: IEC 62676-4:2025 — update quality model from DORI to OODPCVS.
The simulation must use the current standard. Old DORI (4 levels) was superseded October 2025.
**Resolution (D-010 / D-328):** Implemented OODPCVS (7 levels: Monitor, Detect, Observe, Recognize, Identify, Inspect, Verify) as the default quality scoring standard across `@sentineltwin/core` (`OODPCVS_THRESHOLDS`), `@sentineltwin/simulation` (`odpcvs.ts`, `coverage.ts`), and `@sentineltwin/report` (`oodpcvs-audit` template). DORI (4 levels) is preserved as a selectable legacy option in `SimulationAssumptions.doriStandard`.

### Q-020 [P1 — RESOLVED 2026-07-08]: GDPR DPA report formats — what does each DPA actually require?
UK ICO, French CNIL, German BfDI each have different documentation requirements.
CNIL is most aggressive on enforcement (€200k+ in fines 2025/2026).
**Resolution (D-330):** Implemented explicit regulatory compliance generators in `@sentineltwin/report` (`compliance-templates.ts`): UK ICO (`gdpr-ico`), French CNIL Art. L251-1 CSI (`gdpr-cnil`), and German BfDI BDSG §4 (`gdpr-bfdi`). Each template embeds specific statutory requirements, mandatory redaction policies (`redactCameraIps`, `redactGpsCoordinates`, `redactPatrolRoutes`), and statutory retention limits (30d UK/FR, 72h DE).

### Q-021 [P1 — RESOLVED 2026-07-08]: Insurance underwriters — which carriers explicitly ask for camera coverage documentation?
Name specific carriers if possible. This is a B2B distribution channel, not just market context.
**Resolution (D-330 / D-048):** Built dedicated insurance underwriting and liability risk audit templates (`insurance-audit`) referencing Travelers, Chubb, Hartford, and Zurich commercial property questionnaires. Reports include verified DORI/OODPCVS coverage metrics, blindspot exposure scores, and liability mitigation evidence.

### Q-022 [P2 — RESOLVED 2026-07-08]: PCI DSS Section 9 — exact camera coverage requirements?
PCI DSS requires video cameras/access controls for sensitive areas.
What exactly does it specify? What zones require what quality?
**Resolution (D-330):** Implemented `pci-dss-sec9` template in `@sentineltwin/report/compliance-templates.ts`, enforcing PCI DSS Section 9.1.1 (server room/cardholder data environment surveillance) and 9.1.1.1 (90-day retention audit trail). Also implemented `bipa-hipaa` template for biometric and healthcare privacy compliance.

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

### Q-026 [P1 — RESOLVED 2026-07-07]: What is the canonical organization, account, and billing model?
**Resolution (D-329):** Promoted organization, account, quota, entitlement, and member schemas along with `workspace-catalog.ts` into `@sentineltwin/core`. Converted studio files into 1-line re-export shims (`export * from "@sentineltwin/core";`). This establishes a local-first catalog bridge and canonical schema boundary for organizations, accounts, quotas, and members, preparing for remote control plane sync while preserving 100% type and runtime identity across studio tests and components.
**Priority:** P1 — resolved.
**Source:** `packages/core/src/schema/organization.ts`, `packages/core/src/lib/workspace-catalog.ts`, `apps/studio/src/schema/organization.ts`.

### Q-041 [P0 — RESOLVED 2026-07-07]: Pascal fork reactivation conditions
D-001 parked the Pascal Editor fork (`@pascalapp/core` not installed in `node_modules`).
The Pascal contract (Site → Building → Level hierarchy, `AnyNode` extension point, flat-dictionary
Zustand store, spatial grid, CSG cutouts) has architectural references throughout the codebase
but zero runtime.
**Resolution (D-328):** Option (b) / (c) selected and implemented. Per long-term first principles and motto_v3 ("if the fork regresses the app, we nit-pick the better stuff"), we did NOT reactivate the heavy `@pascalapp/core` hierarchy or flat-dictionary store, which would have regressed SentinelTwin's simulation engine and Zod validation. Instead, we extended our flat `SecurityScene` schema with lightweight multi-floor primitives (`levels: Level[]` and optional `levelId` on nodes), implemented dynamic store filtering (`useFilteredScene`, `activeLevelId`), and added canonical level management and cleanup (`deleteLevel` purges assigned nodes across all 15 node collections).
**Priority:** P0 — resolved.
**Source:** `Docs/decisions/DECISION_LOG_ADDENDUM.md` (D-328), `packages/core/src/schema/security-scene.ts`, `apps/studio/src/store/slices/core/scene-slice.ts`.

### Q-042 [P0]: packages/core vs apps/studio schema duplication — resolution path [RESOLVED]
**Resolution (D-325):** Option (b) selected and verified. `apps/studio/src/schema/security-scene.ts` is strictly a 1-line re-export shim (`export * from "@sentineltwin/core";`). This prevents all schema drift without breaking any existing `@/schema/security-scene` import surfaces across Studio. Zero stray or duplicate type definitions exist across `@sentineltwin/viewer`, `@sentineltwin/editor`, `@sentineltwin/simulation`, or `@sentineltwin/report`.
**Priority:** P0 — resolved.
**Source:** Both schema files, `apps/studio/tsconfig.json` path aliases.

### Q-043 [P1]: Unified creation component vs entry-point-specific growth [RESOLVED]
**Resolution (D-327):** Option (b) selected and implemented. Created `CreationFlowShell.tsx` as the canonical layout wrapper for the intake and creation lifecycle. `SiteIntakeHub` and `SiteDraftReview` now both compose inside `CreationFlowShell`, sharing a consistent 4-step stepper (Source Intake → AI Compilation → Review Draft → Studio Testbed) and Trust Pass T1 confidence gating (`renderConfidence`). This eliminates layout shift, unifies header provenance, and enforces UI design pack rhythm across all creation surfaces.
**Priority:** P1 — resolved.
**Source:** `apps/studio/src/components/site-intake/CreationFlowShell.tsx`, `SiteIntakeHub.tsx`, `SiteDraftReview.tsx`.

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

### OQ-3D-01 | 3D skill whitelist
Should SentinelTwin maintain a project-local 3D skill whitelist (`Docs/quality/SKILL_WHITELIST.md`) so parallel agents know which 3D skills are in-bounds for security digital twin work versus game/VFX work? Without it, agents may default to flashy VFX skills that conflict with deterministic, professional coverage visualization.

### OQ-3D-02 | Camera Wall CI performance budget
Should the Camera Wall performance budget (`apps/studio/src/lib/camera-wall-performance-budget.ts`) be enforced by an automated CI test, or is manual QA sufficient until v1? A CI test would need a headless WebGL environment and stable baseline fixtures.

### OQ-3D-03 RESOLVED | Adaptive DPR for single-canvas modes
**Status:** Resolved by D-321.

**Decision:** Single-canvas modes (`CameraViewMode` and `PathReplayView`) use the same `PerformanceMonitor` + `AdaptiveDpr` wrapper pattern as `CameraWallView`, but with their own dedicated budget constants (`SINGLE_*`). The single-canvas DPR range (`[0.85, 1.5]`) is higher than the wall range to preserve full-screen crispness, while the lower bound still protects lower-end GPUs when the heatmap/path/actor are all visible.

**Implementation:** `apps/studio/src/components/view/CameraViewMode.tsx` and `apps/studio/src/components/view/PathReplayView.tsx` now wrap their `<Canvas>` children with `<PerformanceMonitor>` + `<AdaptiveDpr pixelated />`. Budget helpers live in `apps/studio/src/lib/adaptive-dpr-budget.ts`.

**Remaining work:** Add a headless Playwright/CI test that asserts the adaptive DPR path stays within budget on representative scenes (see OQ-3D-02).

### OQ-3D-04 RESOLVED | Shared IBL / Environment source across all canvases
**Status:** Resolved by D-322 (2026-07-07).

**Decision:** One shared source, customized per scene rather than per mode. All canvases use the same `RoomEnvironment` IBL (`SceneEnvironmentSetup`) and the same theme resolution path (`resolveSceneLighting` in `apps/studio/src/lib/scene-appearance.ts`), which merges the built-in day/dusk/night themes with the scene-persisted `scene.sceneAppearance` overrides. Per-mode divergence is expressed only through quality tiers and the caller's fog-distance defaults, not separate lighting systems.

### OQ-3D-05 RESOLVED | Canonical surface material library
**Status:** Resolved by D-322 (2026-07-07).

**Decision:** Two layers. (1) `apps/studio/src/lib/pbr-materials.ts` remains the canonical built-in PBR parameter library per surface kind. (2) User-facing customization goes through the appearance preset catalog (`APPEARANCE_PRESETS` in `apps/studio/src/lib/scene-appearance.ts`: plaster, paint, brick, concrete, wood, tile, marble, carpet, metal, fabric, custom) resolved as preset + explicit overrides — the pattern adopted from pascalorg/editor's material schema. Procedural textures for the presets live in `apps/studio/src/lib/procedural-textures.ts`.

### OQ-3D-06 | Camera-feed post-processing policy
Should the synthetic camera-feed post-processing (film grain, vignette, scanlines, chromatic aberration) be quality-tier gated, or always-on for all camera views? The effects improve realism but can obscure fine detail and may be inappropriate for analytical verification work.

### OQ-3D-07 | Coverage-engine CPU→GPU threshold
At what scene size should the deterministic coverage engine move from CPU+BVH raycasting to WebGPU compute shaders? Current CPU performance is ~10.8 ms for 40×28 grid × 2 cameras. We need a concrete threshold (grid cells, camera count, recomputation time) plus an exactness test harness before committing to GPU compute.

### OQ-3D-08 | WASM/Rust geometry core
Should `@sentineltwin/simulation` port its pure-geometry BVH build and batched raycast core to Rust/WASM for deterministic performance? The package is already zero-React and the BVH/raycast math is self-contained. A WASM port would be worker-friendly and could become a long-term performance foundation.

### OQ-3D-09 | SSAO for depth perception
Should SentinelTwin add screen-space ambient occlusion (SSAO) to improve depth perception, or does it conflict with the analytical/clean look of the security map and risk darkening coverage heatmap readability? If added, it must be quality-tier gated and off by default.

### OQ-3D-10 | Visual realism regression strategy
How should rendering realism improvements be regression-tested without visual drift? Options: a `Docs/quality/VISUAL_SCORECARD.md`, Playwright canvas pixel snapshots, or deterministic shader-output unit tests. We need a strategy before adding PBR/IBL/post-processing so changes can be defended.
