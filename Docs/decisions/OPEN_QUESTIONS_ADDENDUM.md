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
