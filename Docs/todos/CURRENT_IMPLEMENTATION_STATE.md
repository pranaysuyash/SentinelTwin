# Current Implementation State — Camera Studio

**Updated:** 2026-07-08 (LevelSwitcher exposure-gating fix + merged-tree validation D-331; compliance reporting D-330; organization catalog D-329; appearance D-322; 2D/2.5D D-323; gizmo + quiet hover D-324; UI exposure dial D-326)

## LevelSwitcher exposure-gating fix + merged-tree validation (2026-07-08, D-331)

- `level_switcher` added as a `WorkspaceComponentId`; the multi-floor picker (D-328) now follows the same showcase/focused/full rule as compass/hint-bar chrome instead of always rendering — capability unchanged (still the only `addLevel` entry point, still on by default in focused/full), only the default-clutter problem is fixed ✅
- Found and fixed real breakage surfaced by re-running `tsc --noEmit` + `bun test` against the full merged working tree (this session's D-322/323/324/326 work plus the parallel session's D-325/327/328/329/330, already committed at `9fb0b20`): a hand-typed `SecurityScene` test fixture missing the new required `levels` field, a new multi-floor test using a nonexistent `label` camera field and under-specified camera literals (now built via the canonical `createCameraNode()` factory), an `addLevel` type signature that didn't match its own optional-id implementation, and a stale `packages/core/dist` composite build breaking `packages/report` typecheck (rebuilt via the existing `tsc -b --force`, D-286) ✅
- Verified live in the browser: DEMO/WORK/PRO exposure cycle correctly shows/hides the "All Floors" level chip; full suite 1251/1251 pass across studio + core + report; typecheck clean in all three packages ✅

## Compliance Reporting Suite & Policy-Driven Redaction (2026-07-08, D-330)

- `compliance-templates.ts` in `@sentineltwin/report`: canonical compliance registry with standard generators for GDPR (`gdpr-ico`, `gdpr-cnil`, `gdpr-bfdi`), PCI DSS Section 9 (`pci-dss-sec9`), and BIPA/HIPAA (`bipa-hipaa`). Includes statutory requirements, mandatory redaction policies, and retention limits ✅
- Policy-driven redaction engine (`applyPolicyRedaction`): enforces redaction rules (`redactCameraIps`, `redactGpsCoordinates`, `redactPatrolRoutes`, `maskVulnerabilities`) automatically during `buildReportData` and `buildCompareReportData` when visibility is not `internal` ✅
- Studio UI upgrades: `ReportView.tsx` features a Regulatory Compliance Selector, interactive Redaction Policy toggles, and real-time template preview; `ReportLiteTab.tsx` displays active regulatory mandates and redaction badges ✅
- Verified: 10 automated unit tests in `compliance-templates.test.ts` passing; full monorepo build and test suite clean ✅

## Canonical Organization & Workspace Catalog (2026-07-07, D-329)

- Promoted canonical organization, account, quota, entitlement, and member schemas along with `workspace-catalog.ts` from `apps/studio` into `@sentineltwin/core` ✅
- Converted `apps/studio/src/schema/organization.ts`, `apps/studio/src/schema/SceneOperation.ts`, and `apps/studio/src/lib/workspace-catalog.ts` into 1-line re-export shims (`export * from "@sentineltwin/core";`) per D-325 canonical schema deduplication ✅
- Verified: 100% type identity across core and studio; full suite pass ✅

## UI exposure dial (2026-07-07, D-326)

- `uiExposure` (showcase/focused/full) in layout-slice, persisted; presets in `lib/ui-exposure.ts` compose the existing `visibleComponents` + dock collapse + `clientDemoOptions` toggles — a composer, not a lock; no chrome removed at any level ✅
- DEMO/WORK/PRO cycle button in `ViewControls`; 4 preset-invariant unit tests; typecheck clean ✅
- Verification caveat: exercised via unit tests + typecheck; the dev-preview tab served stale chunks at session end, so give the cycle button one manual click-through. Remaining follow-up: gate launcher/product-home chrome through the same dial.

## Transform gizmo + hover-chrome quieting (2026-07-07, D-324)

- Unity/three.js-editor-style gizmo replaces the labeled handle-sphere cluster: X/Z axis arrows (new axis-constrained `move_x`/`move_z` handle kinds), green height arrow, circular rotation ring, center free-move puck; screen-constant scale (`GizmoRig`), depth-test-off overdraw, hover-highlight + hover-only labels. All existing handle kinds preserved (wall endpoints, vertices, midpoint inserts — now dimmed until hover, pitch, W/D scale). Presentation-only: same SnapEngine/preview/commit/undo pipeline (see D-324 for why stock `TransformControls` was rejected) ✅
- Sensors added to the selection lookup and given the move gizmo (previously not manipulable on canvas) ✅
- Heatmap cell explainability card: 350 ms dwell gate, suppressed while any mouse button is down and while transforming — pointer sweeps no longer spam the card ✅
- `PCFSoftShadowMap` deprecation warnings eliminated (three r184): `PCFShadowMap` across presets and canvases ✅
- `PlanView2D` container measurement hardened (immediate measure + resize fallback; ResizeObserver alone never fires in throttled tabs) ✅
- Dev-only `window.__SENTINEL_STUDIO_STORE__` handle for DevTools/QA automation ✅
- Verified live: obstruction gizmo (arrows/ring/puck) and camera gizmo (with yaw tick) render and stay quiet until hover; typecheck clean; suite 1241/1242 pass (the one failure is `operational-evidence-archive.test.ts` 5s-timeout flakiness under full parallel load — passes in isolation).

## True-2D architectural plan + 2.5D canvas modes (2026-07-07, D-323)

- `CanvasMode` is now `orbit_3d | topdown_2d | plan_2d`; the view toggle reads 3D / 2.5D / 2D (the old "2D" orthographic mode is honestly labeled 2.5D) ✅
- New `PlanView2D` workspace surface renders a true architectural plan from the same `SecurityScene` through the canonical map subsystem (`MapCanvas`/`MapLayers` with a new `architectural` pass): real wall thickness with poché core, door swing arcs, wall-aligned glazing, FOV wedges, zone fills, coverage heatmap ✅
- Store: `mapState.planView` viewport (zoom/pan/fit generalized); plan honors the shared Reset canvas view control; selection/hover route through the canonical store so all inspectors (incl. D-322 appearance) work in 2D ✅
- Geometry helpers `nearestWallAngle` / `doorSwingPath` / `wallAlignedSegment` in `map-geometry.ts` with unit tests (`plan-geometry.test.ts`) ✅
- Verified live: mode toggle, plan rendering with retail demo, wall selection → Wall inspector; full suite 1237 pass / typecheck clean ✅
- Not yet in plan mode: placement/drawing tools (remain 3D/2.5D); context menu in plan view — natural next step via `MapProjection.svgToScene`.

## Scene appearance customization (2026-07-07, D-322)

- Optional `sceneAppearance` block on `SecurityScene` (`@sentineltwin/core`): per-mode lighting overrides (day/dusk/night), fog, IBL intensity + exposure + shadows, and default floor/wall surface materials. Per-node cosmetic `appearance` override added to walls, doors, windows, and obstructions. Strictly rendering-only: `cloneSecuritySceneSimulation` strips it and appearance edits never mark the simulation dirty (`commitSceneChange` gained a `markSimulationDirty: false` option) ✅
- `lib/scene-appearance.ts`: canonical environment themes (moved out of SharedScene), Pascal-style material preset catalog (plaster/paint/brick/concrete/wood/tile/marble/carpet/metal/fabric/custom), `applyNodeAppearance` merge (built-in → scene surface default → node override), `resolveSceneLighting` used by all canvases ✅
- `lib/procedural-textures.ts`: canvas-generated albedo+normal texture pairs for 7 styles with style/repeat-keyed caching; original floor tile + wall plaster generators moved here ✅
- Rendering wired in `SharedScene.tsx` (lighting, floor, walls, doors, windows, obstructions) and all canvases (`WorkspaceCanvas`, `CompareView`, `CameraWallView`, `PathReplayView`, `SceneFeedCanvas`); selection/locked/glass state styling always wins over cosmetic overrides ✅
- UI: `SceneAppearancePanel` replaces the inspector's empty no-selection state (lighting sliders per active env mode, fog, IBL/exposure/shadows, floor/wall material pickers with reset affordances); `NodeAppearanceSection` (+ new `ColorInput` control) added to Obstruction/Wall/DoorWindow inspectors; store actions `updateSceneAppearance` / `updateNodeAppearance` ✅
- Tests: 20 unit tests in `lib/__tests__/scene-appearance.test.ts`, 4 schema round-trip/strip tests in `schema/__tests__/security-scene.test.ts`; verified live in the browser (brick walls + wood floor + lighting slider, sim stays `Up to date`) ✅
- Known pre-existing unrelated failure: `agents/__tests__/provider-selection.test.ts` "summarizes estimated cost and latency policy per stage" fails when API keys are present in the environment (asserts `blocked` without keys) — not touched by this work.
- Follow-up completed same day: true-2D plan + 2.5D modes (see D-323 section above).

## Brainstorm-driven features (2026-06-21)

### Camera Model Library
15 real manufacturer models from Hikvision (3), Dahua (3), Axis (3), Hanwha (3), Bosch (2), Vivotek (1) added alongside the 8 generic presets. `CameraPreset` interface extended with `manufacturer`, `modelNumber`, `focalLengthMm`, `category` fields. `getGenericPresets()`, `getManufacturerPresets()`, `getManufacturerNames()`, `getPresetsByManufacturer()` helpers added. `applyCameraPreset()` now passes `focalLengthMm` through. Tests: 13 tests covering generic spec compliance + manufacturer model invariants ✅

### Camera Preset Picker UI
Now groups presets by category (Generic Profiles / per-manufacturer groups) with collapsible sections and manufacturer model number display ✅

### Posture Score (300-850)
`packages/simulation/src/posture-score.ts` — pure computation from `SimulationResult` fields. Five weighted factors: Coverage Completeness (25%), Temporal Resilience (20%), Adversarial Path Resistance (25%), Redundancy Depth (15%), Response Window (15%). Score maps to bands: poor/fair/good/excellent/exceptional. Supports delta tracking. Fixed to use correct schema field names (`peakVulnerabilityWindows`, `overallCoveragePct`, `waypoints`/`detectionQuality` on adversarial path). Tests: 12 tests ✅

**Store wiring:** `postureScore` field added to `SimulationSlice`. Computed automatically via `buildSimulationState()` after every simulation run (both `setSimulationResult` and `runSimulation` paths). Previous score passed through for delta tracking ✅

**UI:** `PostureScoreCard` component added to `MetricsTab` as headline metric. Shows score (300-850) with band label, delta from previous run, progress bar, and all 5 factor sub-scores. Band-colored styling (violet/green/blue/amber/red) ✅

### Adversary Shadow (always-on adversarial path overlay)
New `adversaryShadow` overlay filter (default: on) added to `OverlayFilterId`. Adversarial path now renders independently of the `layers.paths` toggle in both 3D WorkspaceCanvas and 2D MapLayers. When shown as shadow (paths layer off), renders as ghosted red dashed line at 35% opacity. When paths layer is also on, shows full quality-colored segments at normal opacity. Toggle available in CoverageLegend overlay filters ✅

### FORECAST (weather-metaphor temporal dashboard)
`ForecastStrip` component added to `TemporalProfileView` — weather-style summary at top of temporal panel. Conditions: Clear Skies (≥85% coverage, no high-severity windows), Fair (≥70%), Degraded (≥50%), Watch (<50%), Storm Warning (any high-severity windows). Provides lead-time countdown to next vulnerability window ("opens in 47 minutes, duration: 23 minutes") and active-window remaining-time display. Non-expert-readable plain-language copy ✅

### Fix Ranker (audit — already complete)
`CounterfactualPanel` in bottom panel already implements the full Fix Ranker concept: deterministic sim scan generates ranked fix candidates (rotate camera, move obstruction, add camera, add light) with cost tiers (free/low/medium/high), coverage delta verification via full simulation, Preview/Apply/Revert workflow, batch compare table, and Before/After snapshot flow. No new implementation needed ✅

### Thread 147 Crowd/Populated Scenes (audit — already complete)
Full audit confirmed all layers are wired: simulation engine (Poisson model), 4 archetypes, schema (Rule 5), pipeline integration, store action, CrowdProfileEditor UI with zone picker and 24h scrubber, Analytics Dashboard crowd impact section, CrowdChokepointOverlay on canvas, truth audit registration. The Poisson statistical model is the correct first-principles approach for coverage analysis. 7 tests ✅

### Temporal-Crowd Integration Fix
`temporal.ts` now passes `currentTime` (hour/minute) to `simulateStudio` so crowd profiles sample at the correct hour instead of defaulting to 12:00. `overallCoveragePct` in temporal snapshots is now crowd-adjusted (effective coverage). Added `geometricCoveragePct` and `crowdAgentCount` fields to hourly snapshots in both `packages/core` and `apps/studio` schema copies (Rule 5 compliance). FORECAST strip now shows crowd agent count when available ✅

### Analytics Deduplication
Removed redundant `computeCrowdOcclusion` sweep from `buildTemporalAnalytics` in `security-analytics.ts`. The temporal engine now handles crowd integration directly — analytics reads `overallCoveragePct` (crowd-adjusted) and `geometricCoveragePct` (baseline) from hourly snapshots instead of recomputing. Eliminated unused `CrowdProfile`, `CoverageCellResult` imports and simplified function signature ✅

### Plain-Language Report Translation
`lib/report-plain-language.ts` — pure function that converts technical simulation data into everyday English narrative for non-security-professionals. `PlainLanguageReport` interface: headline, overallAssessment, coverageNarrative, zoneNarrative, vulnerabilityNarrative, postureNarrative, temporalNarrative, crowdNarrative, actionItems, confidence. Translation maps convert DORI qualities to plain descriptions ("identification" → "identify individuals by face"), coverage percentages to descriptive bands, posture scores to credit-score analogies. Generates concrete action items from simulation recommendations. `formatPlainLanguageMarkdown()` renders sections into readable markdown. Wired into `ReportLiteTab` as "Plain Language" mode alongside Technical and Before/After. Tests: 14 tests ✅

### Coverage Provenance / Forensic Audit Trail
`lib/coverage-provenance.ts` — ties every coverage claim back to specific cameras, zones, and simulation engine outputs with verification paths. `CoverageClaimAnchor` interface: claimId, claim, value, evidenceSources, confidence, verificationPath. Claims generated: total coverage (with per-camera evidence + obstruction impact), DORI quality distribution, per-zone compliance (with covering camera references), adversarial path exposure, k-robustness, posture score (5 factor breakdown). Camera evidence chain captures review status and geometry validity per camera. Zone evidence chain maps covering camera names. Audit notes auto-flag: unreviewed cameras, suspect geometry, uncalibrated scene, AI-extracted source. `formatProvenanceMarkdown()` renders full audit trail with evidence chain tables. "Export Provenance" button added to ReportLiteTab. Tests: 15 tests ✅

### SectionCard action prop
`SectionCard` extended with optional `action?: React.ReactNode` prop, rendered alongside truthLabel in header. Used by `EventConfigPanel` for inline header actions ✅

### Camera preset icon fallback
`cameraPresetIcon` changed from `Record<CameraPresetId, string>` to `Partial<Record<...>>` with property-based fallback logic — PTZ → ⚙, thermal → ⚡, fisheye → ◉, ceiling → ◔, wall → ▶, default → ○. Handles all 23 preset IDs including manufacturer models without requiring explicit icon mapping ✅

## Temporal simulation, GDPR report, and component refactors (2026-06-17)
**Source:** Direct code audit of apps/studio/src/
**Purpose:** Accurate baseline of what is actually built, tested, and rendering.
Use this instead of the earlier CAMERASTUDIO_GAP_ANALYSIS.md which was written
before the Phase 2 audit. This doc supersedes the gap analysis for "what exists."
For the full-vision gap inventory and next-slice sequencing, see
`Docs/todos/FULL_VISION_GAP_INVENTORY.md`.

## Temporal simulation, GDPR report, and component refactors (2026-06-17)

- `WorkspaceCanvas.tsx` overlay components extracted to `workspace/overlays/` — `NorthCompass`, `ViewControls`, `ControlHintBar` are now standalone files; `view-settings-entrypoints.test.ts` updated to assert against the extracted ViewControls source ✅
- Tool constants (`TOOL_GHOST_COLORS`, `TOOL_ICONS`, `TOOL_LABELS`) extracted from `WorkspaceCanvas.tsx` to `lib/tool-constants.tsx` ✅
- `InspectorPanel.tsx` (2390 lines) split into 9 focused sub-inspectors plus a thin routing component; no behavioral changes ✅
- The top-canvas `ViewModeBar` now acts like a real studio navigator, with grouped workspace/review mode chips, descriptive tab labels, keyboard shortcut hints, and richer active-mode context chips for map, camera, wall, replay, compare, report, and analytics modes ✅
- Camera View now has Focus Mode (`F`) to prioritize a full-iframe operator canvas while collapsing nonessential overlays and retaining a quick path back to map review; the shell now routes `F` to the active full-canvas surface instead of a separate global layout state. ✅
- Path Replay and Camera Wall now also expose the same Focus Mode shortcut (`F`) through the same active-surface shortcut bridge, so the three main review surfaces share one low-chrome inspection pattern. ✅
- `ScheduleEditor` component added at `components/inspector/ScheduleEditor.tsx` — full site-schedule configuration UI covering interior lights, exterior lights, occupancy periods, guard patrol rounds, and site location for seasonal lighting ✅
- `SectionCard` extended with optional `icon` prop, wired into the section header ✅
- `updateTimeSchedule` store action added to `scene-slice.ts` — patches `scene.timeSchedule` via `commitSceneChange` for undo/redo compatibility ✅
- `TemporalProfileView` now exposes a collapsible `Schedule` toggle that renders `ScheduleEditor` inline so temporal configuration is co-located with the 24h profile viewer ✅
- Guard patrol deterrence integrated into temporal simulation engine (`packages/simulation/src/temporal.ts`): `getActiveGuardCount()` computes active guard count per time point, `TimeSliceState` extended with `guardPatrolActive` / `activeGuardCount`, adversarial exposure reduced 35% per active guard during patrol rounds, guard patrol round transitions added to the change-timeline optimization ✅
- GDPR privacy compliance section added to `buildHtmlReport` in `ReportLiteTab.tsx`: `buildPrivacyComplianceSection()` generates a privacy zone inventory table, GDPR Article 25 checklist (Art. 5(1)(c), Art. 25, Art. 25(2), Art. 32, Art. 35), and a camera–restricted-zone matrix with per-camera privacy risk flag ✅

## Product integrity hardening (2026-05-30)

- Product home simulation-derived metric cells now render stable pre-hydration placeholders and swap to live values after mount, eliminating the dashboard hydration mismatch that forced React to regenerate the tree on first load ✅
- Site intake source taxonomy is now canonical in compiler/session state (`scan`, `ai_prompt`, `floor_plan`, `json`, `manual`, `camera_evidence`) with explicit normalization for legacy aliases (`json_import`, `footage_verify`) ✅
- Site draft approval is now explicit and review-first: the approved draft scene is validated before activation, promoted into active scene state, and baseline simulation is only kicked off from that approved scene when prerequisites exist ✅
- Security outcome zone semantics are now split: `zoneFindings` holds all critical-zone evaluations while `failedZones` is strict non-pass only ✅
- Site draft review no longer uses a placeholder preview; it renders a real read-only 2D spatial draft preview from `draft.scene` with entity overlays and warning highlights ✅
- Security narrative wording is now shared through a canonical narrative helper used by SecurityOutcome and report-summary/report-export surfaces, reducing cross-surface narrative drift ✅
- Product home action hierarchy now matches the approved security-first command-center shape: primary mode actions include Coverage, Camera Operations, Incident Review, Compare Fix, and Audit Report, while create/import/scan/AI paths are docked as secondary actions ✅
- Product home language now centers Site Twin / Audit wording (Current Site Twin, Site Risk, Recent Site Twins, Site Twin Memory Search) and avoids unfinished hydration/unknown-state copy on first load ✅
- Product home left navigation now routes into real product sections (`site_intake`, `studio`, `audit_report`, `reference_sites`, `settings`) instead of static placeholder labels ✅
- Site intake recent-site cards now route to real scene-open actions, and intake quick-import now triggers JSON import directly from the intake surface ✅
- Header scene/environment indicators on home are now explicit status chips (non-dropdown) to avoid false click affordances ✅
- Canonical product demo walk-through is now documented at `Docs/product/SITE_TWIN_CREATION_DEMO_FLOW.md` with activation-gate acceptance criteria ✅
- In-studio walkthrough content is aligned to the timed judge script (problem framing, deterministic simulation, failure case, compare/report, close thesis) ✅

## Scene editor workbench hardening (2026-05-29)

- The editor now uses a shared store-backed feedback channel for placement and transform validation, so wall/zone/path/selection warnings are visible in the same place instead of being split between local and store state ✅
- Keyboard delete/backspace now removes selected scene nodes or trims the active wall/zone/path draft, and Cmd/Ctrl+D duplicates the active selection through the canonical store actions ✅
- Zone polygons now support edge insertion and vertex deletion, and path polylines now support midpoint insertion and point deletion, so the workbench can actually shape authored geometry instead of only moving whole objects ✅
- Door and window inspector panels now expose a one-click `Snap to Nearest Wall` action that projects openings back onto the closest wall segment using the same editor geometry helpers as placement ✅
- The 3D workbench now exposes a right-click contextual object menu for cameras, doors, windows, walls, obstructions, zones, paths, sensors, and lights, with object-specific actions routed through the same store-backed patch/duplicate/delete/focus/camera-view paths as the rest of the editor ✅

## Path replay / camera-view sync (2026-05-29)

- Path replay now has a single shell-owned shared progress clock for map/camera/wall modes. The 3D workspace actor consumes replay state without publishing global progress from the R3F frame loop, and replay progress publication is bounded to 24 Hz to reduce app-wide re-render churn while preserving Camera View / Camera Wall / Timeline synchronization ✅
- Path Replay now writes its play/pause, seek, reset, and path-change state back into the shared replay store, so Camera View and Camera Wall stay synchronized with the active replay progress instead of reading a local-only loop ✅
- The replay timeline now also surfaces a follow-actor focus cue, lead-camera summary, coverage reach count, and replay status strip so the operator can read the current path state without leaving the timeline surface ✅
- The replay timeline camera bars are now keyboard-accessible timeline sliders with arrow/page/home/end seek support, and the demo walkthrough’s temporary night/off-camera failure case is restored on exit so the workspace does not stay tainted by the demo-only stress scenario ✅
- Path Replay transport chrome, Camera Wall live-feed badges, and Camera View focus/offline chrome now consume canonical UI tone/type tokens for the visible status chrome, reducing raw color drift in the replay surfaces ✅
- The same replay/camera/wall surfaces now also share a canonical studio surface helper for their dense dark panels and focus chips, so the highest-traffic chrome reads consistently across the audited views without inventing a second global token system ✅

## Shared-workspace access / identity conflict (2026-05-29)

- The Governance tab now exposes a local shared-workspace access surface with active member routing, single-user/shared mode toggles, and per-member approval posture so the current actor and reviewer path are visible in-product ✅
- Workspace access changes now flow through the canonical store, evidence ledger, support bundle, and `/api/workspace-identity-conflict` archive boundary, so local membership drift, approval routing, and shared-identity conflict replay are all represented as canonical product state instead of ad-hoc test fixtures ✅
- The shared approval route now carries a stable route key plus route-scope and active-member eligibility metadata, and the archive loaders normalize older route records into that canonical route contract so remote identity/routing decisions can be replayed consistently across live and archived workspace state ✅
- The shared approval route now also carries an explicit route sync source (`Local-only routing` vs `Archive-backed replay`), so the Governance tab can separate live workspace decisions from archive-backed replay without guessing whether the route depends on backend sync ✅
- The Governance tab now surfaces that route key and route-scope directly in the Approval Routing card, along with the active-member eligibility reason, so operators can see the backend identity token and why the route is direct, review-gated, or reconcile-blocked without leaving the control plane ✅
- The workspace membership archive and identity-conflict cards now also surface the same route key, including the replay result, so the canonical routing token stays visible across live, archived, and replayed shared-identity records ✅

## API CORS / origin handling (2026-05-30)

- The Studio API routes now share a canonical CORS helper and respond to `OPTIONS` preflight requests, with loopback/local dev origins allowed by default and extra origins configurable through `SENTINELTWIN_API_ALLOWED_ORIGINS` so cross-origin browser access no longer depends on each route hand-rolling its own headers ✅
- The launcher now also renders a local workspace catalog summary with scope, organization, owner, and visibility breakdown plus the local-first catalog bridge note, so the org/account boundary is visible in-product even though canonical billing, invites, and ownership transfer remain open ✅

## Workspace memory retrieval (2026-05-29)

- The launcher now exposes a workspace memory search surface that can query the current scene, saved workspaces, evidence trail, report snapshot, and archive histories from one query, so the product begins to behave like a retrieval workspace instead of only a workspace list ✅
- Workspace search hits now seed a timeline focus target and open the checkpoint view near the selected timestamp, with branch-bearing archive hits jumping straight into the timeline and carrying `branch:`, `after:`, `before:`, and `time:` query tokens for direct branch/time jumps ✅
- Scene Intelligence now uses a canonical share-link helper so checkpoint links can be copied or opened with the same provenance node/edge plus timeline branch/time state, and the page bootstrap restores that link state back into the timeline view ✅
- The debug recovery panel now exposes a browser-openable operational evidence archive handoff link, so an exported archive can rehydrate the merge-preflight flow directly from a URL instead of only from a local file picker ✅
- The debug recovery panel now also offers a browser share-sheet archive handoff action when the device/browser supports the Web Share API, with copy/open fallbacks so the recovery flow remains usable everywhere ✅
- The debug panel now also offers a focused `Runtime Truth` download alongside the broader diagnostic and support bundles, so runtime incidents, traces, alerts, and journey-health evidence can be exported as a dedicated observability artifact ✅
- Launcher workspace-memory results now expose explicit destination metadata (`Target`, `Route`) so archive and report hits read like concrete navigation actions instead of opaque snippets ✅
- The launcher’s start-project cards now show explicit maturity labels (`Complete`, `Available`, `Preview`, `Planned`) so the visible entry flows stay honest about what is actually ready versus still aspirational ✅
- Saved workspaces now carry local `workspaceOrganization`, `workspaceOwner`, and `workspaceVisibility` metadata, and the launcher editor/browser surfaces those fields so the workspace catalog reads like an org-aware boundary instead of a flat local list ✅
- The launcher now also renders a local workspace account summary with plan posture, soft quota, and entitlement posture, so the org/account boundary is visible as a derived local bridge instead of only per-card metadata ✅
- Operational evidence archives now carry that workspace account profile too, so recovery and merge-preflight preserve the local account bridge instead of dropping back to defaults ✅
- Governance now exposes a real branch-sync comparison against the latest archived operational evidence branch, so the sync control is no longer a mock remote placeholder ✅
- The visible walkthrough and focus preset labels now use guided-workflow language (`Guided Walkthrough`, `Enter/Exit Guided Walkthrough`, `Focused workspace with all docks hidden`) instead of demo-first copy, while the underlying walkthrough and focus behavior remain the same ✅

## Guided scan assistant (2026-05-29)

- The launcher’s guided scan path now opens a real guided assistant over the existing scan wizard, so capture prep gets structured guidance and auto-path hints without forking the manual-assisted compile pipeline ✅
- The assistant still compiles into the canonical `SecurityScene` through the same candidate-review, warning-acknowledgement, and evidence-logging flow as the manual scan path ✅

## Homepage / layout surface update (2026-05-28)

- Root no longer uses the older centered form/checklist launcher; `/` now resolves to the Studio dashboard home surface (`StudioDashboardHome`) ✅
- The implemented root target aligns with the `StudioDashboardHome_CurrentWorkspacePreview_RiskStatusPanel` direction for V0.1 Studio-first flow ✅
- The root dashboard now uses a compact operator top bar, live current-workspace preview, risk/status right panel, metric/action rail, and first-viewport recent/quick-start dock instead of a large marketing-style hero ✅
- The root launcher top bar now matches the reference more closely by keeping the primary actions to Open Studio / Run Simulation / Import JSON / New Scene, while full entry-goal selection is available through the Project Start Launcher ✅
- The Project Start Launcher now treats the seeded retail scene as the reference baseline while surfacing blank-scene, import, scan, AI draft, and report entry points as real workflows with maturity labels instead of implying the demo is the only complete path ✅
- The live dashboard preview hydration path now uses an explicit mounted flag, avoiding the previous client-store shim that could leave the preview stuck on `Loading preview` after hydration ✅
- The fixed-port Studio bootstrap now seeds the dev prerender manifest and uses a non-mutating document shim, so clean dev boots can render the root shell and API routes instead of throwing first-load 500s ✅
- `PlatformHome_CommandCenter_RecentWorkspaceRiskOverview` is retained as a future V1+ concept and is intentionally not the immediate root implementation ✅
- The Studio homepage now auto-runs the demo simulation on first load when the canonical demo scene is present, so the dashboard does not start in a misleading `Simulation pending` state for the retail demo ✅
- Demo bootstrap and manual `Run Simulation` now both call the store-backed `runSimulation()` action (instead of direct engine calls in the page component), preserving async guardrails like in-flight dedupe and stale-scene checks ✅
- Demo workspaces and layouts are seeded when local storage is empty, so the homepage now has visible recent/demo surfaces instead of a blank shell ✅
- A full `View Settings` / layout manager is wired into the shell, top bar, and viewport controls, covering main view, canvas mode, scene layers, dock visibility, component visibility, analysis modules, right-panel mode, bottom drawer mode, workspace presets, and saved layouts ✅
- The workspace now treats report as a first-class view path and stores custom layouts separately from scenes so the site model and the shell composition stay independent ✅
- The homepage now has a dedicated `Scene Work` surface that foregrounds `New Blank Scene`, `Import SecurityScene JSON`, `Scan a Site`, and `AI Layout Draft` so demo scenes are clearly the baseline rather than the end state ✅
- The AI Layout Draft flow now compiles a direct scene blueprint from prompt output when a model provider is available, so prompt-to-scene is no longer just a template selector with a few prompt hints ✅
- The AI Layout Draft modal now also exposes an editable raw `SecurityScene` JSON view with validation before apply, so users can inspect or hand-edit the generated scene without leaving the preview-first flow ✅
- The AI Layout Draft launcher now generates a reviewable preview card first and only applies the draft to the workspace after explicit confirmation, matching the safer review-before-commit pattern used by the scan/import flows ✅
- The AI Layout Draft preview now includes a compact current-vs-draft workspace comparison strip so users can see replacement impact before they apply the draft ✅
- The AI Layout Draft preview now also exposes the generated `SecurityScene` JSON behind an expandable disclosure with copy support, so users can inspect the exact structure before applying it ✅
- The launcher project browser is now split into `Your Workspaces` and `Reference Demo`, so user-created/imported/scanned scenes are visually distinct from the canonical retail baseline ✅
- The launcher project browser now also includes a source filter row (`All sources`, `Demo`, `Draft`, `Import`, `Scan`, `AI`, `Preset`) so scene origin can be filtered directly from the browser instead of only inferred from badges ✅
- The selected-workspace launcher card now includes Duplicate Workspace and Rename Workspace actions, so local scenes can be copied or retitled from the launcher before entering Studio ✅
- The canonical top-bar scene selector now mirrors those Duplicate/Rename actions on each saved scene row, so workspace management is available from the primary shell too ✅
- The homepage center column now includes a `Scene Starter Gallery` of visual cards so scene creation/import/scan actions read like primary workflows instead of utility buttons ✅
- The `Your Workspaces` region now includes starter tiles for blank/import/scan/AI workspace entry, making the section behave like a workspace hub instead of a passive saved-scene list ✅
- The launcher left rail now includes a task-first `Security Jobs` surface with explicit `Available` / `Preview` / `Planned` status per workflow so users see product maturity before entering Studio ✅
- The launcher now also exposes a job-first `Start Project` chooser modal, so users can pick their intent (audit, design, import, scan, draft, verify, report) before falling into the studio shell ✅
- The launcher now opens `Guided Scan Reconstruction` directly into the guided scan assistant, while `Verify real footage` opens the real Camera View verification workflow directly instead of routing into a separate preview modal ✅
- Addendum (2026-05-30): the real Camera View verification workflow now records saved reference-frame snapshots into the operational evidence ledger, so verification captures are part of the canonical audit trail instead of living only in the local panel state ✅
- Dashboard hero preview now includes explicit 2D/3D controls, compass/north indicator, canonical PPM legend chips, and obstruction warning callout so the root scene preview reads like a live simulation surface instead of a static banner ✅
- The root dashboard first-viewport dock now pairs compact `Recent Workspaces` cards with direct quick-start actions for blank scenes, JSON import, floor-plan import, manual-assisted scan, and AI layout draft ✅
- Root dashboard now includes an explicit footer/status row (`Security Simulation Studio`, version badge, systems operational, feedback/help affordances) matching the studio-home target structure ✅
- Camera View selection persistence was hardened: entering camera view now preserves previously selected camera without forcibly overriding selection unless no valid camera selection exists ✅
- `SceneBuilderWizard` blank-scene creation now uses the canonical blank-scene factory (`createBlankSecurityScene`) and room-dimension wall generation, removing the previous demo-scene clone-and-strip path ✅
- Floor-plan import now also has a dedicated launcher entry path (`forceImportMethod="floor_plan"`), so floor-plan users are not routed through the generic new-scene method picker ✅
- Floor-plan scene generation now emits the required `sensors: []` field so floor-plan output remains valid against the current `SecurityScene` schema ✅
- SceneBuilderWizard review now includes a floor-plan commit summary card (confidence, unresolved warning count, detected counts, and warning preview) before scene creation ✅
- Launcher now opens the real Camera View verification workflow directly from `Verify real footage`, keeping the reference-frame upload, overlay alignment, and video frame extraction tools in the existing camera view shell ✅
- Root launcher query boot now initializes client-side (effect-driven) to avoid server/client render divergence that can trigger runtime hydration errors in production builds ✅
- `ScanSiteWizard` now runs as a stronger manual-assisted product flow: photo upload + metadata, multiple local photos with per-photo previews/status, marker placement/drag/retype/delete, explicit review warnings, and compile-to-canonical `scan` scene output ✅
- `ScanSiteWizard` now also surfaces a visible `Needs Review` queue summary plus direct `Accept` / `Review` / `Reject` actions per candidate, making correction of extracted objects more explicit before compile ✅
- `ScanSiteWizard` now includes explicit camera/light mount defaults, critical-zone night requirement controls, and a review step that summarizes what will be created before handoff ✅
- The new Area 1 site-intake design targets (`SiteIntakeHub_CreateSiteTwin_SourceSelection.png` and `ScanSiteWizard_GuidedCapture_RoomDimensionsOverviewPhotos.png`) are now captured in the design pack, but the live launcher still routes through the existing scan wizard rather than a dedicated create-site hub entry ✅
- Scan compile mapping now includes deterministic conversion for doors/windows/entry points/cameras/lights/obstructions/critical zones/path points plus schema validation and explicit warning codes, and it now canonicalizes explicit entry markers ahead of door-derived fallback entries so the compiled scene does not double-count the same threshold ✅
- Scan handoff now sets launch notice counts and auto-runs baseline simulation when both camera and critical zone are present ✅
- Launcher scene replacement flows (`New Scene`, `Import Floor Plan`, `Scan Site`, `AI Layout Draft`, `Import Scene JSON`) now warn before replacing a dirty workspace, reducing destructive mistakes ✅
- AI layout draft now enriches prompt-to-scene drafts with front-entry hints, prompt-driven lighting, and a basic entry-to-counter path when the prompt asks for a shop-like layout, so the generated scene reads more like authored space rather than a bare template ✅
- Saved workspace cards now include compact scene thumbnails so the workspace hub reads like a gallery of real site layouts rather than a text-only list ✅
- Scene starter cards and workspace seed tiles now carry explicit origin badges (`Blank`, `Import`, `Scan`, `AI`) so users can differentiate scene entry paths at a glance ✅
- The selected workspace detail panel now reuses the same origin badge language so demo/reference and user workspaces stay consistent across the launcher ✅
- The studio shell keyboard map now covers the full visible tool rail (`V`, `C`, `B`, `L`, `P`, `Z`, `D`, `W`, `M`, `T`), the single-key actions (`R`, `N`, `F`, `S`), and view keys `1–6`, so the on-screen hints and actual handlers match ✅
- The `Debug` analysis tab now exposes live overlay density controls, debug overlay toggles, auto-recompute, scene-graph stats, camera-failure chips, and layer visibility from the store-backed diagnostics state ✅
- Analysis and context chrome readability was raised in high-traffic surfaces (top bar subtitle, right dock headers/tabs, and bottom drawer headers/badges) so dense mode remains compact without relying on 8px text in primary navigation/status areas ✅
- Bottom analysis drawer now includes an explicit `Explain this panel` action with per-tab intent copy, giving first-time users contextual guidance without leaving the active workflow ✅
- The `Help` analysis tab now functions as a real workflow guide with a step-by-step map, shortcut groups derived from the live shell keymap, and recovery guidance instead of a minimal placeholder panel ✅
- The AI command bar now surfaces an explicit offline-first residency banner and a cloud-backed availability chip so the local-vs-cloud behavior is visible in-product instead of implied by code ✅
- A store-backed `Local Only Mode` toggle now appears in View Settings and is enforced by the AI command bar, AI draft launcher, counterfactual proposals, and report generation so cloud-backed AI can be disabled by policy instead of only inferred from missing keys ✅
- The active AI provider is now store-backed and visible in View Settings, and the command layer / AI draft launcher read the same provider source of truth ✅
- The `Debug` analysis tab now exposes a `Provider Governance` surface with active provider, active model, local-only policy, cloud availability, and explicit fallback order so provider selection is visible as an operational control plane instead of a hidden setting ✅
- The `Debug` analysis tab now also exposes a `Provider Health Dashboard` plus a canonical `Prompt Registry`, and it also exposes a `Model Eval Suite` that exercises the current provider/model against canonical structured-output fixtures for command parsing, counterfactuals, report generation, and AI layout drafting, with visible pass/fail/skip results, a budget-policy readout, and a persisted run history/comparison trail ✅
- The command bar and AI draft launcher now mirror the provider-health summary so the same active-provider readiness truth appears at the point of use instead of only inside Debug ✅
- The command bar, AI draft launcher, and Debug panel now also show an estimated cost/latency policy summary and stage readiness thresholds so provider governance is visible as a practical budget class instead of only as a raw provider label ✅
- The command bar, AI draft launcher, and Debug panel now also record and display measured AI action telemetry (stage, prompt lineage, duration, estimated token count, token source) plus a simple recent-vs-previous trend summary so the provider story includes a live per-run trail instead of only estimated budget classes ✅
- The debug/provider-control surfaces now share canonical prompt definitions from a single registry file, the measured AI telemetry now persists prompt id/version/title/agent/schema lineage alongside each action, the prompt registry now also keeps a persisted history trail, the provider governance surface now keeps a persisted selection/policy history trail, the AI telemetry trail now also compares recent runs against a longer-horizon policy baseline, and the telemetry policy itself is persisted and editable so the command parser, counterfactual agent, report agent, AI layout draft, and provider policy can be audited and tuned across time instead of only at the current snapshot ✅
- Every R3F canvas entry point now imports the local `three-compat` shim, so the current Three.js r184 `Clock` deprecation warning is consistently mitigated across the studio canvases.
- `ReportLiteTab` now exposes Copy, Export Markdown, Export HTML, and Print actions directly in the report toolbar, keeping the handoff surface self-contained ✅
- Placement Oracle now exports the best candidate position and score in the report handoff, matching the live novel panel's placement summary ✅
- The live camera feed and inspector feed now surface a nearest-sensor `Sensor Fusion` overlay with distance, state, coverage, and active-count context, so the fusion boundary is visible in the actual verification view as well as the inspector analytics tab ✅
- Sensor add/update/remove actions now emit sensor-specific operational evidence events, so the sensor layer has an auditable history in the same provenance ledger as other scene edits ✅
- Sensor triggers, heartbeats, faults, and restores now record a live event feed in the sensors tab and camera overlays, so the operator can stage live evidence without leaving the twin ✅
- Scene Intelligence now surfaces sensor live evidence alongside the provenance ledger, making the sensor trail visible in the temporal/operator story instead of only in the sensor panel ✅
- The debug panel now reuses the same sensor metadata parser for pasted live metadata, so support/debug workflows can feed the canonical sensor evidence trail without a separate ingest path ✅
- A dedicated `/api/sensor-ingest` route now accepts pasted sensor metadata as a history-backed backend-shaped intake seam and resolves it into canonical sensor live events ✅

## QA infra state (2026-05-29)

- Webwright QA bootstrap exists and is wired through `tools/webwright/run-sentineltwin-qa.sh`.
- Shared venv contract is:
  - Python: `python3.13`
  - Package manager: `uv`
  - Venv: `/tmp/webwright-sentinel`
  - UV cache: `/private/tmp/uv-cache`
  - Playwright cache: `/private/tmp/ms-playwright`
- Webwright QA is now bootstrapped into `/tmp/webwright-sentinel` using Python `3.13` + `uv`.
- `--bootstrap` succeeds with network-permitted runs; in DNS/network-restricted shells it may still fail unless run with an allowed network path.
- `--dry-run` (route checks + manifest) and `--run` smoke routes still produce `qa-output/manifest.json`, `qa-output/routes.txt`, and `qa-output/route_urls.txt` without mutation.

---

## What is verified built and working

### Simulation engine (src/simulation/) — complete, tested
- `coverage.ts` — BVH-accelerated raycasting, DORI scoring, material penalties, lighting model ✅
- `coverage.ts` — trust-hardening updates now enforce camera `rangeM` gates before scoring, wire scene `pixelsPerMeter` assumptions into quality mapping, emit per-camera evaluation metadata (`cameraEvaluations`) and mark privacy/coverage-denominator cells for traceable KPIs ✅
- `coverage.ts` — live cell-quality scoring now uses the scene's active PPM thresholds in DORI mode, so stricter/looser assumptions change the actual evaluation path instead of only downstream summary metrics ✅
- `coverage.ts` — camera evaluations now include `visible` plus machine-readable `reasonCodes`, and the debug/report surfaces show active PPM thresholds ✅
- `coverage.ts` / coverage tests — door and window states now participate in deterministic vision occlusion with regression coverage for closed/open doors plus glass, grill, curtain, and reflective window behavior ✅
- `simulation/__tests__/golden-simulation-claims.test.ts` — golden product-claim suite verifies door/window behavior, night+IR recovery, obstruction counterfactual improvement, privacy flagging, and redundancy preservation under single-camera failure ✅
- `grid.ts` / grid tests — rotated obstruction footprints now have explicit walkability regression coverage ✅
- `adversarial-path.ts` — Dijkstra minimum-exposure pathfinding now surfaced with defensive aliases (`coverageFailurePath`, coverage-gap/camera-without-coverage/critical-zone-reachable fields) while preserving backward-compatible payload keys ✅
- `dori.ts` — PPM thresholds, quality ordering, quality comparators ✅
- `grid.ts` — floor sampling grid with walkability ✅
- `geometry.ts` — yaw/pitch direction vectors, polygon helpers ✅
- `path-analysis.ts` — path visibility over time ✅
- `simulate-studio.ts` — orchestrates full simulation run ✅
- `simulate-studio.ts` — camera failure offline-impact analysis now recomputes a degraded scene with the selected camera disabled, so redundancy and downstream zone loss come from a fresh scenario comparison instead of baseline inference ✅
- `coverage.ts` / `vision-collider-mesh.ts` — coverage evaluators now expose explicit disposal for Three.js geometry/material/BVH resources, and long-running simulation analytics dispose shared evaluators after use instead of retaining collider resources beyond the computation window ✅
- `coverage-fragility.ts` — Coverage Fragility Field: per-cell distance-to-DORI-threshold score (0=robust, 1=fragile), `computeCoverageFragility()` pure function with `FragilitySummary` output ✅
- `simulate-studio.ts` — Coverage Fragility wired: per-cell `fragility` field + `fragilitySummary` attached to every `SimulationResult` ✅
- `simulate-studio.ts` — zone quality uses target-height profiles, privacy coverage issues are surfaced, and all aggregate metrics are computed over non-privacy walkable cells for canonical coverage denominators ✅
- `PathReplayView` / `TimelineTab` — authored `scene.paths` are now the primary replay/timeline focus, with coverage-failure replay retained as secondary defensive analysis ✅
- `PathReplayView` / `TimelineTab` — replay follow state is now shared through the store, so the Follow toggle actually pans the replay camera toward the actor instead of changing only button chrome ✅
- `studio-store` / store tests — obstruction counterfactuals now have direct regression coverage for simulated deltas and obstruction-id tracking ✅
- Confirmed performance: ~10.8ms average on 40×28 grid with 2 cameras — under 16ms target ✅
- Zero React/DOM imports confirmed ✅

### Temporal Simulation (src/simulation/temporal.ts) — complete, tested
- `temporal.ts` — 24-hour security profile engine: change-timeline optimization (10-15 transitions/day, not 96 full sims) ✅
- `computeTemporalProfile(scene)` — full end-to-end: builds change timeline, patches scene per time slice, runs coverage at transitions, interpolates intermediates ✅
- `computeTimeSliceStateForHour(hour, minute)` — public helper for time-slice state queries ✅
- `detectVulnerabilityWindows()` — classifies high/medium/low severity windows from snapshot analysis ✅
- `findSafestPeriods()` — identifies continuous safe coverage windows ✅
- `patchSceneForTimeSlice()` — clones scene, patches assumptions (timeOfDay, interiorLightLevel, security light status, camera night mode) ✅
- Fixed operator precedence bug in `getExteriorLightState` for 0:00-2:00 (D-035) ✅
- 29 unit tests covering time-slice states, profile structure, snapshot count, vulnerability windows, safest periods, zone coverage, camera/light counts, timer cutout behavior ✅
- **ISSUE-005 resolved:** Engine now reads `scene.timeSchedule` when present (interior/exterior light schedules, occupancy periods). Falls back to `DEFAULT_SCHEDULES` when scene has no schedule. Schedule resolution uses `timeInPeriod()` for wrap-around midnight ranges ✅
- **97-snapshot off-by-one fixed:** Engine now produces exactly 96 snapshots (24h × 4 per hour at 15-min resolution) ✅
- **Not implemented:** Seasonal/location-aware lighting (suncalc.js), guard patrol integration, occupancy-based camera obstruction multiplier, door lock schedules — deferred to V0.2/V0.3

### Temporal Schema Types (src/schema/security-scene.ts) — complete
- `timeScheduleSchema` with location, interior/exterior light schedules, occupancy, guard patrols ✅
- `temporalSecurityProfileSchema` with hourlySnapshots, vulnerability windows, safest periods, zone coverage by hour ✅
- `hourlySecuritySnapshotSchema`, `vulnerabilityWindowSchema` ✅
- Scene fields: `timeSchedule: timeScheduleSchema.optional()`, `temporalProfile: temporalSecurityProfileSchema.optional()` ✅

### Temporal Store Integration (src/store/studio-store.ts) — complete
- `temporalProfile` state (TemporalSecurityProfile | null) ✅
- `temporalScrubHour` / `temporalScrubMinute` for time-scrubbing UI ✅
- `setTemporalScrub(hour, minute)` — auto-switches environmentMode (day/night/dusk) ✅
- `computeTemporalProfile` action — runs engine and stores result ✅

### Temporal UI (src/components/bottom-panel/TemporalProfileView.tsx) — complete
- 24-hour clickable timeline bar (96 slots, color-coded by coverage quality) ✅
- Vulnerability window cards (expandable, severity-colored, with "Jump to start") ✅
- State transition map (visual bar showing Business Hours, After Hours, Night, etc.) ✅
- Summary cards: Worst Coverage, Vulnerability Windows count, Safest Periods count ✅
- Zone coverage stability chart (per-zone average + variance) ✅
- Compute / Recompute button ✅
- "24H PROFILE" tab in BottomPanel TABS array (surfaced 2026-05-27) ✅

### Temporal Report Integration (src/report/index.ts) — complete
- TemporalProfileSummary in report data ✅
- HTML export: vulnerability windows, worst coverage, safest periods ✅
- Markdown + JSON export: temporal profile section ✅
- Report exports now include provenance sections with scene source, source counts, revision depth, snapshot counts, and source/confidence history for the canonical scene graph ✅
- Report exports now also include an operational evidence appendix with change-log counts, evidence counts, sensor-related evidence, and recent evidence entries, so stakeholder handoff artifacts carry the same ledger story as the in-app provenance surface ✅
- The Report Lite preview now mirrors that operational evidence appendix, so the live handoff view and the exported artifacts stay aligned ✅
- The Report Lite handoff now also carries a Temporal Operational Twin section with scene-event counts, reconstructable checkpoints, branch heads, checkpoint age, and current-vs-checkpoint deltas ✅
- Compare exports now also carry the same evidence counts and before/after evidence trail, so the side-by-side artifact remains ledger-aware instead of reporting only simulation deltas ✅
- The compact report summary strip now includes an `Evidence Trail` line so the first-glance report card shows the ledger story before the user opens the full handoff view ✅
- The report and compare surfaces now also export a dedicated JSON evidence bundle, carrying the scene, report data, compare context, and evidence trail as a reusable handoff artifact ✅
- Report exports and the report workspace header now surface a Sensors count from the canonical scene model, and the editor now exposes a dedicated sensor tool, sensor inspector, and sensor inventory tab while the broader live fusion layer remains camera-first ✅
- The camera inspector analytics tab now surfaces a live `Sensor Fusion` preview with the nearest sensor, distance, state, and coverage mode so the editor can show the current fusion boundary even before full ONVIF/live ingestion exists ✅
- The camera inspector now also exposes a live camera binding section, a camera metadata ingest bridge, and a camera spec import workflow that can paste JSON or raw spec text and stamp parsed optics values back onto the selected camera through the canonical store, while the camera metadata ingest bridge now also maps ONVIF WS-Notification envelopes into operational evidence events and persists them through the same archive/history path, and the live connection probe/archive boundary now understands JSON, NDJSON, and ONVIF-style XML responses, retries real Basic/Digest challenge-response probes on both the device and advertised event-subscription endpoints when the device challenges the first request, carries stored ONVIF credentials through the inspector request path, preserves event-subscription URI/reference/expiry through the probe response, live connection event stream, camera node, session registry, and HUD surfaces, renews the ONVIF event subscription on heartbeat when the lease is near expiry, supports session refreshes while connected, captures transport response and auth challenge metadata on real negotiation steps, and surfaces an active session lease registry with expiry timestamps plus a transport-session handle so the remaining device-protocol seam stays honest ✅
- The debug/support bundle now carries both the sensor ingest archive and the camera live connection archive, including the live session snapshot fields, transport-session metadata, and refresh history, while the inspector also shows the active lease registry, expiry, and transport handle, and the debug runtime lane now exposes the live AI provider selector plus the agent coordinator status panel so the operator handoff package keeps the live metadata story together with the rest of the evidence trail ✅
- Scene Intelligence now has an explicit temporal replay scrubber with point-in-time reconstruction and restore actions, so the operational evidence trail can be scrubbed and previewed instead of only listed as recent events ✅
- Scene Intelligence now also surfaces a temporal operational twin summary with scene-event counts, reconstructable checkpoints, published checkpoints, branch heads, checkpoint age, published age, and current-vs-checkpoint / current-vs-published deltas so the operator can answer “what did we know, and when?” without leaving the evidence surface ✅
- The latest published checkpoint now also has an explicit compare-and-restore surface in Scene Intelligence, so the published branch can be promoted back into the active compare workflow instead of staying a summary-only card ✅
- The operational evidence layer now also has a canonical event-centered timeline builder plus a state-at-time-T resolver, so the temporal story is backed by a reusable temporal object model instead of only UI-side sorting and checkpoint lookup, and published checkpoints stay explicit instead of collapsing into generic snapshots ✅
- Operational evidence events now validate through a canonical zod event schema plus companion input schema, with build-time canonicalization for blank titles/details and snapshot validation before events can enter the ledger, so the event contract is defined in one place instead of being hand-maintained across callers ✅
- The temporal twin now resolves published checkpoints through a canonical publication helper rather than inline publication filtering, so published-vs-reconstructable semantics stay explicit and reusable across report and Scene Intelligence surfaces ✅
- Workspace approval route summaries now validate through a canonical schema before entering archive or replay helpers, so the governance route identity is explicit and reusable rather than being rebuilt ad hoc in each loader ✅
- The canonical scene graph now carries node-level evidence history metadata for selected entities, so the graph node inspector can show evidence count and latest change directly on the selected node ✅
- Scene Intelligence now also exposes a real node-specific evidence trail for the selected scene/entity node, with recent ledger events and preview/restore actions instead of only counter-style history metadata ✅
- Scene Intelligence now also lets selected node trail entries drive the existing branch comparison and restore workflow, so the node evidence view can set left/right branches or restore directly from the trail ✅
- The selected node evidence trail now also shows active left/right comparison markers plus a node-local comparison summary, so the branch state is visible directly in the provenance surface instead of only in the global compare panel ✅
- Camera metadata ingest now also writes a durable live metadata event stream that shows up in the camera feed overlays and Scene Intelligence provenance surface alongside the existing sensor evidence trail ✅

### Schema (src/schema/security-scene.ts) — complete
- All Zod schemas + TypeScript types ✅
- All node types: Camera, ObstructionNode, SecurityLightNode, WallNode, DoorNode, WindowNode,
  CriticalZoneNode, PrivacyZoneNode, EntryPointNode, ScenarioPath ✅
- `sensors: SensorNode[]` exists as a zero-default schema boundary for future multi-sensor work, and dedicated sensor tools / inspector / inventory surfaces are now wired into the editor while live sensor events, pasted metadata intake, the external feed bridge, the camera live binding stream, the camera live-connection probe/archive route, the camera metadata ingest bridge, the temporal replay surface, the camera metadata event stream, and the sensor ingest history archive now feed the canonical evidence trail, while the ONVIF probe now runs through a real SOAP client that parses device information, retries authenticated challenge/response probes, and renews the event-subscription lease through the heartbeat path instead of a mock session manager ✅
- Full SimulationResult with coverageCells, criticalZoneResults, adversarialPath ✅
- `CoverageCellResult.fragility?: number` (0=robust, 1=fragile) ✅
- `SimulationResult.fragilitySummary?: { meanFragility, fragileCellCount, robustCellCount, totalCells }` ✅
- SceneSnapshot schema ✅
- parseSecurityScene, safeParseSecurityScene, cloneSecurityScene utilities ✅

### Store (src/store/studio-store.ts) — complete
- Full Zustand store with all CRUD operations (addNode, updateNode, removeNode) ✅
- importScene / exportScene with Zod validation ✅
- Snapshots system with 4 pre-built demo snapshots ✅
- Layer visibility (11 layers) ✅
- `sceneIntelligenceGraph` derived from the canonical `SecurityScene` and rebuilt on scene edits, snapshot changes, simulation writes, undo/redo, import, and create-new flows ✅
- `heatmapMode: "quality" | "fragility"` — store-backed heatmap mode with `setHeatmapMode` action ✅
- Environment mode (day/dusk/night) ✅
- Active tool tracking ✅
- Shared minimap/path-map viewport state is store-backed, resets on scene import/load/create, and no longer gets silently re-fit by map remounts ✅
- simulationDirty / simulationRunning / autoRecompute ✅
- getSelectedCamera() helper ✅

### use-simulation hook — working
- Runs simulation on first mount ✅
- Auto-recompute on scene change with 400ms debounce ✅
- Manual runSimulation() callback ✅
- Defers to setTimeout to allow React to paint loading state first ✅

### TopBar — complete
- SentinelTwin Studio identity + scene selector dropdown ✅
- SimStatus badge (Needs Recompute / Running / Up to date) ✅
- Environment mode dropdown (Day/Dusk/Night) ✅
- Run Simulation button (wired, triggers simulation) ✅
- Night Mode and Camera Failure quick actions are wired to live scene state changes, and the Camera Failure action now jumps the operator into the redundancy analysis view after the toggle ✅
- Save Snapshot, Compare, and Generate Report actions are wired ✅
- Scene name dynamically displays `scene.name` (no longer hardcoded) ✅
- "New Scene..." opens SceneBuilderWizard modal with template/blank/floor-plan creation ✅
- SceneBuilderWizard (560 lines) was dead code — now wired into TopBar as modal overlay ✅
- 5 scene templates accessible from wizard: retail-shop, open-office, warehouse, classroom, parking-garage ✅
- Floor-plan import scale control now feeds the actual extractor config instead of acting as a dead UI field ✅
- Floor-plan import validation now emits structural diagnostics for duplicate wall pairs, short fragments, off-wall door/window markers, wall orientation mix, and image-bounds coverage; the review UI surfaces those flags before scene creation ✅
- Floor-plan imports now carry extraction and diagnostics notes into the canonical scene change log, so the review surface can show what was parsed versus what remains heuristic ✅
- The target switcher now shows the current target label in-place, so the user sees `Target: Cash Counter` versus `Target: Mixed` without opening the dropdown ✅
- The top bar now exposes a dedicated `Assumptions` shortcut that jumps the right panel and bottom drawer to the assumptions surface ✅
- TopBar scene menu now also exposes `Scan a Site...`, which opens the dedicated manual-assisted scan intake flow and compiles into a canonical `scan` scene ✅

### Scan-to-scene intake — built and visible
- Launcher page now has a visible `Scan a Site` entry point alongside scene creation/import and AI layout draft ✅
- `ScanSiteWizard` handles manual-assisted site photo intake, candidate placement/classification, review, and compile-to-scene handoff ✅
- Scan review now shows a provenance summary before compile, and the compiled scene carries provenance notes into the canonical `SecurityScene` change log ✅
- Scan intake provenance now preserves accepted candidate evidence in the canonical scene log, so the review surface can show what the guided/manual-assisted compiler actually accepted ✅
- `apps/studio/src/lib/scene-skeleton.ts` centralizes the blank-scene shell used by both new-scene creation and scan compilation ✅
- `apps/studio/src/lib/scan-to-scene.ts` converts scan candidates into real `SecurityScene` nodes without introducing a parallel scene model ✅
- Scan sessions remain separate from the final scene until compile, and the UI labels the flow as manual-assisted rather than claiming AI perception ✅
- The guided capture backend is still intentionally open: RoomPlan is the native Apple reference for coached LiDAR capture, while SAM 2 / Depth Anything V2 / VGGT / SpatialLM remain the research anchors for future segmentation, depth, reconstruction, and structure extraction ✅
- The launcher/home card now presents `Scan a Site` as `Preview / Manual-assisted`, so the scan-first path reads like a first-class product entry rather than a buried utility action ✅
- Sensor nodes now have a canonical factory, selection bounds, transform support, and workspace rendering, so the schema extension is visible inside Studio instead of being a dead field ✅

### Launcher resume / status surface — now explicit
- Root launcher now renders `StudioDashboardHome` as a full-screen dashboard with the current workspace preview, risk summary, mode entry points, searchable project browser, folder/tag/pin metadata management, selected-workspace actions, and secondary quick-start actions instead of the old centered setup card ✅
- Launcher page now exposes a workspace-resume card with direct resume, coverage entry, and saved-scene shortcuts pulled from local storage ✅
- Workspace footer status now surfaces active workflow progress (`Workflow: <flow> step/total`) from `activeWorkflowId`, `activeWorkflowStep`, and `activeWorkflowSteps`, so users can see guided flow state directly while operating the shell ✅
- Root dashboard labels now explicitly match operator-control semantics (`Workspace selector`, `Status`, `Last run`, `Environment mode`) and section headings (`CURRENT WORKSPACE`, `SECURITY STATUS`) for closer design-pack parity ✅
- Shared mode naming is now normalized in the mode bar and footer status bar to goal-aligned labels (`Coverage - Map & Analysis`, `Camera View - Single Camera`, `Camera Wall - Multi Camera`, `Path Replay - Route Analysis`, `Compare - Before / After`, `Report Lite - Quick Report`) ✅
- Camera View chrome now uses canonical header labeling and includes explicit bottom-strip replay context chips (`Timeline / Path Replay`, `Events`, `Quality Over Time`, `Camera Wall Preview`, `Scenario / Path`) so operator replay context is visible in-view without leaving Camera View ✅
- Product feature maturity remains tracked in docs and launch flows, but the root dashboard itself now prioritizes the workspace preview, security status, and quick-start actions instead of an in-surface maturity panel ✅
- AI layout draft launcher modal now warns that the generated scene replaces the current workspace and discloses the model-backed vs heuristic fallback path ✅
- AI layout draft now records provenance on the scene change log and forwards provenance-backed notices into the launcher/status surface instead of passing opaque warning text alone ✅
- AI layout draft results now leave a launcher status banner so the fallback/model outcome stays visible after the modal closes ✅

### Scene intelligence / provenance spine — visible
- `sceneIntelligenceGraph` now summarizes source lineage, entity counts, revision depth, snapshots, and simulation linkages as a derived store field ✅
- `PROVENANCE` bottom-panel tab exposes the scene spine in-product so operators can inspect the canonical scene source, assumptions, snapshots, and source distribution without leaving the studio ✅
- The provenance tab is now interactive: graph nodes and relations are selectable, and the inspector can jump between source and target nodes to trace scene lineage end to end ✅
- Provenance selections are URL-backed and shareable via a deep link so a specific node/edge trace can be reopened directly ✅
- Operational evidence memory now records scene edits, scene loads, snapshot saves, simulation runs, counterfactual runs, duplicate-node actions, scan-session compiles, and AI draft proposals as a visible event ledger in the provenance surface, with event-kind counts, before/after scene summaries, reconstructable checkpoints for snapshot-bearing events, lifecycle branch labels for draft / recovered / published history, branch-head filters/navigation, and append-only journal-backed persistence with merge batches, while exportable archives preserve the journal payload itself instead of flattening it away ✅
- The provenance tab now also shows a visible evidence ledger with recent snapshots, change-log entries, and operational memory events, making the temporal history easier to audit from the UI ✅
- The provenance tab now also exposes branch-head previews and a visible parent-chain lineage view, so point-in-time evidence can be inspected directly before restoring a checkpoint ✅
- The provenance tab now also exposes a branch-comparison panel with common-ancestor and delta summaries, giving the operator a merge-preflight view before any future branch policy work lands ✅
- The Governance tab now also exposes a visible approval trail backed by the operational evidence ledger, so review requests, approvals, rejections, annotations, role changes, and policy changes can be audited from the same control plane that issues them ✅
- The Governance tab now also exposes a remote governance handoff queue backed by `/api/governance-archive`, so the approval trail can be dispatched into a canonical archive before any real remote approval service exists ✅
- The Governance tab now also exposes a workspace membership handoff queue backed by `/api/workspace-membership-archive`, so the active member, team roster, routing policy, approval route, and drift against the latest archived snapshot can be archived as a canonical backend-identity record before shared identity services exist ✅
- The Governance tab now also exposes a `Sync Membership Snapshot` action that reconciles the live workspace against the latest archived membership snapshot and logs the drift back into the operational evidence ledger ✅
- The provenance tab now also exposes merge-readiness guidance for branch comparisons, including fast-forward versus diverged branch guidance before any future merge policy lands ✅
- The provenance tab now also exposes explicit restore-to-branch actions from branch comparison, so operators can reconstitute a selected head as draft, recovered, or published state instead of only previewing lineage ✅
- The provenance surface now exposes a `Publish current scene` action that promotes the active scene into the published branch and persists the branch label into saved workspace metadata ✅
- The new `Governance` bottom-panel tab exposes a local role selector, review-required vs open-publish policy, request/approve/reject actions, and review annotations, all logged into the evidence ledger so publish policy is auditable in-product ✅
- The `Governance` tab now also exposes a shared-workspace access surface with active member selection, single-user vs shared mode, and explicit routing labels so the current actor and review path are visible in-product ✅
- The `Governance` tab now also exposes an action gate with allow/blocked status plus route reasons for edit, annotate, request review, approve, reject, publish, and restore so RBAC/ABAC is visible at the action level ✅
- The `Governance` tab now also exposes a workspace membership archive queue so shared-workspace identity, routing policy, and snapshot drift can be archived and fanned out through a backend-shaped handoff instead of only living in local store state, and it can now sync the live state back to the latest archived snapshot when the operator chooses to reconcile ✅
- The `Governance` tab now also exposes a `Resolve Approval Route` action that archives the resolved approval route through `/api/workspace-approval-route`, records a `workspace_approval_routed` evidence event, and surfaces the route status and target reviewer in the control plane ✅
- The `Governance` tab now also exposes a workspace identity conflict resolution/archive backed by `/api/workspace-identity-conflict`, plus a selectable conflict diff view and replay result that recomputes the selected archived conflict against the current live workspace state, so drift can be captured, replayed, and turned into a canonical remote-shared-identity policy recommendation before a real backend identity service exists ✅
- The right-rail Governance review panel now shows an actual structural branch comparison against `main` with before/after counts plus added, changed, and removed scene nodes, so the review surface no longer advertises a placeholder diff summary ✅
- The trust-audit manifest now covers the shared-identity conflict surface copy, so the Governance tab's conflict-resolution lane is verified alongside the approval and membership handoff surfaces ✅
- The Governance tab now records identity conflict resolution itself as a first-class `workspace_identity_conflict_resolved` evidence event, so the governance trail distinguishes the conflict resolution from the generic membership-sync action that accompanied it ✅
- The sensor panel now also exposes an external feed bridge that can pull JSON/NDJSON from a live URL through `/api/sensor-ingest`, so live metadata can enter the canonical evidence trail without paste-only intake ✅
- The provenance surface now also supports branch-target checkpoint restore actions so a reconstructable event can be reopened as draft, recovered, or published instead of only a generic restore ✅
- The debug diagnostics panel now exports a full operational evidence archive, loads uploaded archives into a merge-preflight preview, can restore the latest archived checkpoint with an explicit draft/recovered/published branch selector, preserves archive export time and requested restore branch on restore events, and can apply a conflict-free divergent branch merge when the live ledger has forked, so recovery/backups travel with the scene, ledger, journal, and governance state instead of only a support bundle ✅
- Trust-sensitive launcher and provenance surfaces now have a reusable `truth-audit` harness that checks the visible claim copy against the manifest so placeholder drift gets caught in tests instead of slipping back into the UI ✅
- The provenance surface now includes ledger search/filtering so operators can narrow events and checkpoints by scene, node, note, event type, lifecycle stage, or branch label instead of scanning the full history manually ✅
- The debug panel now exports a support-ready diagnostic bundle with scene, simulation, graph, evidence, governance, approval-route, and runtime truth fields so failures can be handed off with context instead of just a screenshot ✅
- The support bundle now also includes the canonical report evidence bundle, so the support handoff carries the same scene/report/evidence package as the operator-facing report export ✅
- The support bundle now also carries the recent sensor ingest archive, so live metadata handoff travels with the diagnostic/report evidence package instead of living only behind the sensor ingest route ✅
- The debug panel now also exposes a dedicated `Download Evidence Bundle` action so the canonical report evidence package can be exported directly from the support/control plane ✅
- The debug panel now also exposes a runtime health summary plus a runtime journey trace with import/scan/AI/render/save/publish path health cards, and it now surfaces a runtime incident log plus a performance trace list and a runnable truth-audit report so the operator can see both path health, failure/timing evidence, and trust-surface drift from inside the studio shell ✅
- The trust-audit UI now expands the formatted report output alongside the per-surface counts, so the debug panel shows exact missing and forbidden phrases instead of only a pass/fail summary ✅
- The debug panel now also exposes a support bundle summary card with incident snapshot, latest incident/performance trace, AI telemetry trend, and a dedicated `Download Support Bundle` action so the support handoff artifact is visible in-product instead of buried behind a single export button ✅
- The debug panel now also exposes a paste-based `External Log Capture` lane, persists external log entries locally, and includes them in the support bundle so browser/app/device logs can be handed off with the incident snapshot instead of living only in ad hoc copy-paste notes ✅
- The debug panel now also exposes an `Automated Alerting` summary that turns runtime incidents and captured external logs into prioritized alert candidates, with a high-priority recommendation to attach external logs before escalation ✅
- The debug panel now also exposes a `Remote Support Ingest` action that routes the current runtime incidents, external logs, and AI telemetry through a canonical `/api/support-ingest` endpoint so the support handoff can be tested against a backend-shaped response before the deeper remote pipeline exists ✅
- The debug panel now also persists a visible `Support Ingest History`, backed by the `/api/support-ingest` server archive, so routed submissions remain auditable across refreshes instead of disappearing after a single response ✅
- The debug panel now also exposes a `Remote Support Delivery` action, a remote webhook URL input, and a delivery archive backed by `/api/support-delivery`, so the support handoff can be dispatched into a canonical queue before any real external fan-out exists ✅

### WorkspaceCanvas — good 3D foundation with view-mode shell wired
- Instanced mesh heatmap with quality/fragility mode toggle ✅
- Camera frustum cones ✅
- Camera markers with labels and status ✅
- Wall segments with glass material handling ✅
- Obstruction boxes with click-to-select + highlight ✅
- Decorative shelving ✅
- Critical zone overlays with pass/fail badges ✅
- Obstruction warning labels ✅
- Path lines (dashed, start/end markers) ✅
- Adversarial path (red dashed line) ✅
- Entry door label ✅
- Ceiling light markers ✅
- Environment themes (day/dusk/night) with fog ✅
- NorthCompass, ViewControls, ControlHintBar ✅
- View mode switching now routes through `StudioShell` for Map View / Camera View / Camera Wall / Path Replay / Compare ✅
- Full-canvas view modes are wired for the canvas shell ✅
- Camera View mode is a dedicated full-canvas single-camera POV with a live HUD, DORI overlay card, mode filters, overlay toggles, camera header navigation, and a back-to-map control ✅
- Camera View mode now also renders the replay actor in the POV with a screen-space detection box and tighter CCTV-style exposure tuning so the subject reads in-frame like the reference footage ✅
- Camera Wall mode now uses an adaptive live feed grid (selected-first, active-first) with 1-6 camera feeds plus a 3D map overview slot, active/offline counters, and per-camera zone-quality summaries sourced from the current simulation result ✅
- Compare mode now renders side-by-side baseline/proposed 3D panels with delta cards, issue/recommendation notes, a quality-over-time trend, and scenario notes ✅
- Compare mode now exposes explicit Baseline / Proposed selectors so comparison pairs do not drift silently when new snapshots are saved ✅
- Compare mode now exports JSON, Markdown, and HTML compare artifacts, can open the active replay view directly, and still supports captured visual evidence for report export ✅
- MiniMap now uses the shared 2D map system with reusable projection/layers, zoom/fit controls, hover/selection sync, and replay actor visibility ✅
- MiniMap now supports collapsed / compact / expanded / hover-preview states, shared map tokens, layer/display controls, legend, scale, north, and empty-map focus handoff to the 3D workspace ✅
- PathMap now uses the shared 2D map system with quality-banded path rendering, current-state replay panel, path events list, segment details, and inline play/open-in-3D controls ✅
- Shell/map controls now use explicit accessible labels and pressed/expanded states for the core mode toggles, viewport controls, legend filters, and overflow controls ✅
- Canvas reset now re-centers the 3D workspace without forcing a full canvas remount, so view resets are cheaper and less disruptive ✅
- Camera placement presets are now reactive and store-backed instead of hidden module state, so the camera tool picker reflects the current preset and placement reads one canonical source ✅
- The scene workbench now supports a canonical duplicate-node action with keyboard shortcut support, so selected cameras/obstructions/walls/zones/paths can be copied and reselected instead of rebuilt manually ✅
- Camera selection now participates in the canonical transform contract: arrow keys nudge the selected camera/object, `PageUp`/`PageDown` adjust vertical position, and `Q`/`E` rotate through the same store-backed contextual action model that powers the right-click menu and drag handles ✅
- The shared transform contract now also surfaces wall height controls in the right-click menu and keeps the same movement/rotate affordances visible for lights and other editables, so vertical movement is discoverable instead of being camera-only UI knowledge ✅
- The scene workbench now has shared grouped selection state, shift/meta multi-select, and drag-select bounds so the canvas can capture more than one object without losing the primary inspector selection ✅
- The scene workbench now supports grouped move/delete/duplicate operations from the shared selection model, so multi-select behaves like a real edit set instead of just a visual highlight ✅
- The workbench transform layer now exposes obstruction width/depth resize handles and camera pitch affordances in addition to move/rotate/height controls ✅
- The camera inspector now includes an explicit move/rotate help card that points operators at the on-canvas handles, keyboard shortcuts, and right-click menu, so the transform affordances are visible instead of being discoverable only from source or memory ✅
- Path editing now includes segment-insert handles, so routes can be reshaped from the middle instead of only dragging existing waypoints ✅
- The inspector now surfaces grouped selection actions plus a waypoint list for paths, so multi-select and route editing are visible in the right dock instead of being canvas-only concepts ✅
- View mode switching is implemented for Map / Camera View / Camera Wall / Path Replay ✅
- Path replay animation and actor playback are implemented in the dedicated replay view ✅
- Path replay now renders replay-proof overlays: legalized samples avoid obvious obstruction overlap, the scene shows camera frustums, and the floor is tiled so breach/collision explanations read directly from the canvas ✅
- Full-canvas replay mode now uses the workspace shell, not the docked layout ✅
- Compare mode now renders a full before/after comparison shell with scene panels, comparison cards, and lower analysis bands; verified in production build via `?mode=compare` ✅
- Compare mode now keeps the selected snapshot pair explicit in the header and still uses canonical `saveSnapshot()` for adding a comparison snapshot ✅
- Path replay and compare are deep-linkable via `?mode=replay` and `?mode=compare`, which makes visual QA deterministic in the local browser flow ✅
- `apps/studio/next.config.ts` now allows local dev origins (`127.0.0.1`, `localhost`) so browser-based QA can hydrate the app cleanly in development ✅
- Path replay now uses the night-stage theme in the production bundle, which matches the reference mood more closely and keeps the replay surface distinct from map/compare ✅
- Production-browser verification on `http://localhost:3010/?mode=replay` and `http://localhost:3010/?mode=compare` matched the stored reference screenshots after scale normalization; `replay-live-current.png` and `compare-final.png` are the current proof captures ✅

### CameraFeedCanvas — inspector PIP, intentionally lighter than the full camera view
- Renders R3F canvas from camera's perspective ✅
- Shows walls, obstructions, floor geometry ✅
- Night overlay (CSS filter) ✅
- Camera name + resolution label ✅
- DORI overlay card now shows the selected target zone, current quality, required range, distance, angle, best camera, and lighting summary ✅
- Local view-mode toggles now provide Normal / IR / Low Light / Thermal visual states for the inspector feed ✅
- Uses a live camera rig, so the inspector feed follows camera edits instead of freezing at the initial pose ✅
- Renders the active replay path actor when a path exists, so the preview feels like a live CCTV feed instead of a static room still ✅
- Dirty/offline/blocked/malfunctioning cues now add feed artifacts and status badges instead of leaving the preview visually identical across failure states ✅
- Camera placement presets now live in the same product vocabulary as the inspector, with a deliberate preset library and `Clear selection` state instead of a tiny toggle rail ✅
- This is still the smaller inspector preview; the full-screen `camera_view` shell now owns the richer HUD and overlay stack ✅

### CameraViewMode — full-canvas single-camera POV
- Full-canvas camera view with live HUD, DORI overlay card, LIVE MODE banner, overlay controls, mode filters, and back-to-map button ✅
- Camera selector header with previous/next buttons and store-backed camera selection sync ✅
- Mode toggles cover Normal / IR / Low Light / Thermal, and the overlay strip can show overlays, path, zones, timestamp, and grid state ✅
- DORI overlay target label now derives from the active critical zone target type instead of a generic "Face / Person" string ✅
- The camera feed now renders the active replay actor when a path exists, so the POV behaves like a live CCTV feed instead of a static room still ✅

### InspectorPanel — wired and working
- CameraInspector with 5 tabs ✅
- Properties: position XYZ inputs (wired to updateNode), yaw/pitch sliders (wired), FOV slider (wired), height ✅
- Status: on/off toggle (wired), night mode selector (wired), clarity selector (wired) ✅
- Analytics: coverage %, zone pass/fail, offline impact notes ✅
- View: CameraFeedCanvas (working but minimal — see above) ✅
- View tab now leads with a dedicated View Mode card and Target Info card above the live feed, while the DORI overlay summary and overlay toggles remain wired to the same feed state ✅
- Properties tab now includes a placement preset library with `Best fit` and `Tool rail` context, plus one-click preset application to the selected camera ✅
- Failures: camera failure simulation controls (offline/dirty/night-disabled), criticality scoring, redundancy analysis, and impact notes are implemented ✅
- The camera failures tab now deep-links into the redundancy analysis view after a failure toggle or restore, so the operator lands on the matrix that explains the impact instead of stopping at the switch itself ✅
- ObstructionInspector: position, rotation, dimensions, material (all wired to updateNode) ✅
- "Test Without This Obstruction" button is wired to counterfactual simulation with delta metrics ✅
- Aim at Zone button: wired ✅
- Duplicate camera button: wired ✅
- Delete camera button: wired ✅
- InspectorPanel now mounts as a full-width dock shell inside the contextual right panel, so the right dock can reclaim canvas space instead of reserving a fixed-width inner island ✅
- The dock headers were tightened further so toggles live on each section without turning the header chrome into the dominant visual element ✅

### LeftPanel — UI complete
- All 10 tool buttons with keyboard shortcut labels ✅
- Layer visibility toggles for all 11 layers (wired to toggleLayer) ✅
- MiniMap is now powered by the shared map module, not a panel-local SVG, and renders coverage cells, zones, walls, paths, adversarial path, cameras, path replay actor, and interactive zoom/fit/select controls ✅
- Camera Wall now memoizes the live tiles and reuses stable per-camera path-visibility props so selection changes do not force every feed tile to rebuild its shared scene shell ✅
- Canvas tool placement is wired for cameras, obstructions, lights, walls, doors/windows, paths, and zones; the canvas now places objects directly from the active tool instead of acting as UI-only chrome ✅
- LeftPanel now behaves as a full-width dock shell with collapsible subpanels for Scene Tools, Scene Layers, and Mini-Map, instead of a fixed-width inner column that wasted canvas space ✅
- Section headers now use compact badges and slimmer toggle controls so the sidebar gives more space back to tools and content ✅

### BottomPanel tabs — mostly complete

- BottomPanel tab strip now also surfaces `REDUNDANCY`, matching the existing render branch so redundancy analysis is reachable without hidden state changes ✅
- BottomPanel tab strip now also surfaces `PROVENANCE`, which renders the derived scene intelligence graph as a visible provenance spine instead of a hidden debug-only structure ✅

**MetricsTab** ✅
- 7 core metric cards: coverage, critical zones, cameras, avg quality, worst area, recognition %, identification %
- 8th card (Coverage Fragility) renders when simulation includes fragility data ✅
- DonutChart component for coverage and quality
- All values from simulationResult
- Coverage delta is computed from prior snapshots, not hardcoded ✅
- Global target-type switcher now lives in the top bar and applies a retargeting sweep to all critical zones from one control surface ✅

**IssuesTab** ✅
- Severity icons and badges
- Affected zones / cameras displayed
- Recommendations list
- Recommendation actions now include `Preview Fix`, `Apply Fix`, and `Revert Preview` for verified transform recommendations ✅

**ThreatAnalysisPanel** ✅
- `Run Coverage Failure Analysis` now calls the shared simulation recompute path instead of only revealing cached details ✅
- The panel auto-refreshes its breakdown from the latest `simulationResult`, so the route metrics and waypoint ribbon always reflect the current scene state ✅

**CameraInspector / RedundancyMatrixPanel** ✅
- Camera failure-impact placeholders now expose a real `Run Simulation` action in-place instead of only instructing the user to leave the panel and use the top bar ✅
- The redundancy matrix empty state now also offers the shared simulation action so the analysis can be refreshed from the panel itself ✅
- The full security outcome / report workspace now carries the redundancy matrix through the handoff, with per-camera criticality and vulnerable-zone summaries mirrored into HTML, Markdown, and text exports ✅

**CameraPresetPicker / View Settings** ✅
- The in-canvas camera preset picker is present when the camera tool is active, and View Settings now surfaces the preset library so common camera specs are discoverable before placement ✅

**Shared analysis empty states** ✅
- Metrics, issues, redundancy, novel algorithms, camera summary, replay, and security outcome empty states now use the shared simulation prompt instead of passive instructions ✅

**BeforeAfterTab** ✅
- Metric comparison still shows the before/after deltas, and the tab now also reuses the compare evidence pipeline to show a side-by-side visual diff when compare thumbnails are available ✅
- A one-click `Open Compare View` handoff now jumps from the bottom drawer into the richer compare workspace while preserving the selected snapshot pair ✅

**TimelineTab** ✅
- Active authored path selector
- Playback controls with play/pause, scrubber, and speed presets
- Timeline event table with actor position, camera, quality, and reason columns
- Quality-over-time view backed by VisibilityTimeline
- Camera summary cards for the active path

**TemporalProfileView (24H PROFILE)** ✅
- 24-hour clickable timeline bar (96 slots, color-coded) with compute/recompute button
- Vulnerability window cards, safest periods, zone coverage stability chart
- Time-scrubbing into 3D scene (auto-switches environment mode)
- See "Temporal UI" section above for full detail

**BeforeAfterTab** ✅
- Shows before/after coverage % from last 2 snapshots
- Delta coverage calculation
- Shows issues count and zone pass rate
- No visual canvas comparison (numbers only)

**ReportLiteTab** ✅
- Generates markdown report
- Copy to clipboard button
- Shows all issues and recommendations
- Audience selector now frames exports for operator, auditor, insurer, installer, or privacy reviewer, and the same audience mode flows through single-scene and compare exports ✅
- Report catalog presets and visibility selectors now let exports choose internal/shared/privacy-safe framing before the user exports or copies the artifact ✅
- Exported reports use a lightweight uncertainty sampling budget so handoff generation stays interactive, while deeper analysis tabs can still increase the sample count when needed ✅

**DebugTab** ✅
- Toggle switches for all 11 layers
- Simulation debug stats (coverage %, quality breakdown, issues count)

### Analysis drawer and current-state overlays ✅
- BottomPanel now exposes `COUNTERFACTUAL` and `THREAT REVIEW` in the visible tab strip instead of leaving those routes hidden behind inactive branches ✅
- BottomPanel also includes stronger mode-aware summary headers for wall and compare modes so the drawer reads like a deliberate analysis surface ✅
- ScenarioPathPanel now shows no-path, no-simulation, and current-issue states so the route summary remains useful even before simulation data exists ✅
- CameraViewMode now explains the current quality with a reason line, plus replay quality/segment context and best-camera handoff inside the feed HUD ✅
- CameraWallView now highlights the best camera feed in both the header and the tile chrome ✅
- PathReplayView now includes a current-state card with time, segment, quality, best camera, and next event so replay reads like an analysis mode, not a raw playhead ✅

### ScenarioPathPanel ✅
- Active path selector wired to `activePathId`
- Path length, estimated time, visible % stats
- Coverage ribbon now uses interpolated path sampling instead of authored point-only sampling
- Shared SVG path map with walls, zones, path, start/end markers, replay actor, and pan/zoom/fit controls
- Edit Path / Play Path buttons are wired (`Edit`: map+path tool, `Play`: replay mode + timeline) ✅

### BottomRow ✅ (more complete than expected)
- Snapshots panel with thumbnail cards + "New Snapshot" button
- Assumptions panel now surfaces a concise model summary and an explicit "Edit Assumptions" button, with the full assumptions editor available in the bottom drawer ✅
- The assumptions summary is now live and data-derived in the right inspector, showing the active standard, time of day, and lighting state ✅
- Report Summary panel with 4 bullet points (dynamic from simulation result)
- Environment panel now shows scene-derived mode, light state, window handling, door handling, and exterior lux instead of synthetic weather values ✅
- AI command bar (`use-ai-command.ts`) handles: `/night`, `/dusk`, `/day`, `/report`, `/compare`, `/snapshot`, `/simulate`, `/run`, `/fail`, `/camera-failure`, `/fix`, `/improve`, `/target` and now falls back to an offline parser for common natural-language scene edits when no API key is present ✅
- `/target <type>` — sets targetType on all critical zones (face, face_recognition, face_identification, vehicle_detection, license_plate, package, cash, door, perimeter, person) ✅

### StatusBar — exists (not read in detail)
### Demo scene — validated ✅
- small_retail_shop.json loads and validates
- Cupboard confirmed to occlude Camera 1 view of cash counter

---

## Reference image parity status

**Image 2: CameraView_TimelinePathReplay_Camera1InspectorViewtab.png**

The reference is now largely matched in behavior. The remaining deltas are mostly visual polish, and the actor replay HUD in the camera feed / camera view now shows path name and completion progress instead of just a generic active badge, not missing workspace modes.

### [MISS-01] View mode tab bar above canvas ✅
The reference shows: Map View | Camera View (active) | Camera Wall | Path Replay
Current code: the workspace now switches between map, full-canvas camera view, camera wall, compare, and path replay.

### [MISS-02] Camera View mode filling the full canvas ✅
When Camera View is active, the entire canvas area shows the selected camera's perspective.
This is different from the small inspector PIP (CameraFeedCanvas) — it's full screen.

### [MISS-03] Path replay animation with actor ✅
The reference shows a person figure walking through the scene.
Time is shown in the replay overlay and the actor animates along the authored path.

### [MISS-04] DORI quality overlays on camera view ✅
Camera View now renders DORI overlay insights for a critical zone with required-quality status framing,
current quality, best camera, distance, angle, and lighting context.

### [MISS-05] LIVE MODE overlay on camera view ✅
"LIVE MODE (Simulated) | Time: 8.4s | Path: Night Entry → Cash Counter | Speed: 1.0x"

### [MISS-06] Canvas overlays control bar ✅
"Overlays | DORI | Path | Zones | Timestamp | Grid | More | Back to Map View"

### [MISS-07] Camera Wall mode ✅
Adaptive multi-camera grid: selected-first, active-first, 1-6 feeds, plus 3D map overview and status counters
"Views" counter and feed sorting are store-backed rather than fixed to 4 panels

### [MISS-08] Enhanced Timeline with per-camera DORI quality ✅
The reference shows a detailed table with:
- TIMELINE (Path Replay) | EVENTS | QUALITY OVER TIME sub-tabs
- Full playback controls: << | pause | >> | time display 00:08.4 / 00:10.2 | speed 1.4x | Follow Actor checkbox
- Table rows: Time(s), Actor Position, CAM 1, CAM 2, Quality (Best), Event
- Each row shows DORI quality per camera as colored badges
- e.g., "4.3 | Behind Cupboard | NONE | DETECTION | DETECTION | Partially obscured"
Current code: replay controls, a path selector, event table, and quality-over-time panels are implemented. The row-level view is still a streamlined interpretation of the reference, but the missing debug-only stub has been replaced.

### [MISS-09] Inspector View tab showing DORI Overlay section ✅
In the reference, the right inspector (Camera 1 selected, View tab) shows:
- VIEW MODE: Normal | IR (B/W) | Low Light | Thermal
- VIEW OPTIONS: Show DORI Labels, Show Path Actor, Show Zones, Show Timestamp, Show Bounding Box (checkboxes)
- DORI OVERLAY (At Target): "OBSERVATION" / "62.5–125 PPM"
- TARGET INFO: Target Type, Distance, PPM (est.), Angle from center, Lighting
Current CameraInspector now surfaces a dedicated View Mode card, a Target Info card, a DORI overlay summary, and the local view toggles wired into the live camera feed, while `camera_view` carries the richer CCTV HUD with the tracked actor overlay, path visibility, and zone overlays.

### [MISS-10] Scenario/Path panel showing full active scenario details ✅
Reference shows right panel with:
- "Active Scenario: Night Entry → Cash Counter" dropdown
- Edit Path / Play Path buttons
- Path Length: 10.2m / Est. Time: 8.5 sec
- Start / --- Path --- / End (Cash Counter) legend
- Path Visibility Timeline link
Current ScenarioPathPanel now surfaces the same information hierarchy as the reference: active
scenario selector, explicit scenario summary card, actor/intent/speed chips, path length,
estimated time, visible route legend, timeline link, and edit/play actions. Remaining work is now
pixel-level polish only.

---

## Current follow-up work

The reference-image feature set is now fully built. The remaining work is now narrower: novel algorithms, deeper V0.2 work, and any future pixel-tight polish.
- The path replay timeline now shows explicit `Follow Actor` labeling and a compact camera reach summary strip above the event table, making the replay HUD more reference-like without changing the underlying model ✅
- The shell-level target-type switcher is now a true global default: the top bar always exposes the dropdown, it stores the current default target type, and the manual critical-zone placement tool uses that default when creating new zones ✅

- The canonical demo scene now boots with a seeded simulation result, so the homepage shows real coverage and last-run state on first paint instead of a pending placeholder.
- The studio app now has a real app-level error boundary that renders the shared `ErrorFallback` component plus a divider-backed recovery message, so route/runtime failures land in a canonical recovery shell instead of a blank crash surface.
- The default project list now also includes one manual draft workspace, so a fresh profile shows at least one real user-workspace object alongside the reference demos.
- The seeded manual draft workspace now contains a real small scene layout with walls, camera, light, obstruction, critical zone, entry point, and path instead of an empty placeholder.
- The seeded manual draft workspace now carries draft-specific launcher styling, so it reads as in-progress user work rather than another generic saved scene.
- The seeded draft workspace is now named `Shop Layout Draft` and carries its own computed simulation result on boot, so the non-demo workspace feels like a real analyzed site instead of a stub.
- Launcher timestamps now use hydration-stable formatting, seeded saved projects have unique scene ids, and duplicate saved-project scene ids are deduped on load so the first render stays stable and warning-free.
- The launcher SVG scene previews now stay behind a client-only hydration gate with deterministic placeholders on the first paint, which removes the remaining preview geometry hydration mismatch.
- The launcher's Report Lite entry now opens the dedicated report workspace mode instead of entering through the map preset, so the report handoff feels like a real destination.
- The workspace canvas now handles click-to-place authoring for camera, obstruction, light, wall, zone, path, and door/window tools, so the core scene-building loop is interactive instead of read-only.
- The inspector's camera feed view now renders a live POV canvas with DORI overlay, actor replay, and failure-state artifacts, and the failures tab now exposes live offline/dirty/night counterfactual controls instead of a placeholder.
- The studio right rail now defaults to Security Status when nothing is selected, then returns to Inspector when an object is selected so the cockpit feels security-first instead of editor-first.
- The compact Security Status rail now keeps the assumption disclosure visible alongside the summary and top issues, so the default right rail shows the model posture without forcing a mode switch.
- The status bar now shows the current scene name, active view mode, selection summary, and a live coverage/issue summary alongside the existing engine/run controls, so the footer is a lightweight cockpit context strip instead of engine-only chrome.
- Security outcomes now include an explicit Privacy Review section that surfaces privacy zones, restricted cells, and privacy-specific issues instead of burying them only inside the generic issue stack.
- The Metrics tab now includes a second row of advanced live signals (coverage entropy, K-robustness, placement oracle, blind-spot fingerprint, reflective bounce, temporal anomalies, and occlusion blame counts) alongside the core coverage/zone/camera summary cards.
- The report workspace header now surfaces privacy summary stats alongside coverage, issues, recommendations, and critical zones, so the export/handoff surface reflects the same privacy posture as the detailed outcome panel.
- The report workspace header now also shows fragility and k-robustness summary cards, so the handoff surface communicates uncertainty and resilience in the same place as the headline outcome metrics.
- The report workspace header now also shows temporal anomaly count and worst coverage drop cards, so the handoff surface reflects the scene's time-based risk posture alongside the other summary metrics.
- The top bar now exposes a direct Provenance action alongside the scene, compare, report, and assumptions shortcuts, so the scene-intelligence graph is reachable from the primary shell.
- The Issues tab now includes an explicit `Test Fix` action alongside `Preview Fix`, `Apply Fix`, and `Revert Preview`, so recommendation triage can preview and re-run the simulation in one step before committing.
- Report Lite now starts with a four-bullet executive summary card (critical issue, primary cause, impact, recommendation) before the raw markdown report body, matching the bottom-row report summary pattern ✅
- The bottom-row report summary and Report Lite now share the same executive-summary helper, so the compact summary and handoff summary stay in sync ✅
- The root launch path now stays launcher-first, with the visible dashboard on `/` and the explicit workspace route on `/studio`; there is no hidden boot query on the root page.
- The camera inspector's View tab now has a dedicated View Mode card, Target Info card, DORI Overlay summary card, and explicit show/hide view options for DORI labels, path actor, zones, timestamp, bounding box, and grid, and those toggles are wired into the live camera feed ✅
- The camera inspector now exposes wall / ceiling / pole mount snap actions that reposition the selected camera to a mount target, raise it to a realistic mount height, and re-aim it toward the room interior, covering the remaining mount-snap interaction gap ✅
- A direct helper test now covers the wall / ceiling / pole snap math so the mount behavior is protected by more than source assertions ✅
- The light inspector now exposes brightness, type, status, range, and a live night-coverage toggle / impact summary, so security lights are editable and their simulation effect is visible in the inspector.
- Compare mode now includes a live camera comparison section that compares two cameras from the current scene using per-camera simulation results, coverage, zone counts, and DORI reach alongside the existing snapshot compare workflow.
- Compare and report exports now surface per-camera best zone quality and failed-zone counts alongside coverage, so the handoff artifacts read the same per-camera truth as the live wall and compare views.
- The camera inspector analytics tab now includes a per-camera privacy impact section that shows privacy issues, restricted cells, and affected zones for the selected camera, so privacy is actionable during camera tuning.
- The Issues tab now includes a dedicated privacy review section with privacy issue counts, restricted-cell counts, and clickable affected cameras/zones so privacy enforcement is visible in the triage workflow too.

1. Novel algorithms: Coverage Fragility Field, K-Robustness, Placement Oracle, Temporal Anomaly Detection.
2. V0.2 feature expansion and any later model-integration work.
3. Future pixel-level polish only if a new reference introduces a new mismatch.
4. [ ] End-to-end post-processing pipeline for camera surfaces (Camera Feed + Camera View + Camera Wall + Replay) with deterministic visual policy, performance budgets, and verification rules — planned as a full rendering pipeline task (not a feature-flag task).

### Novel algorithms bundle (2026-05-27)
- `coverage-fragility.ts`, `k-robustness.ts`, `placement-oracle.ts`, `occlusion-blame.ts`, and `temporal-anomaly.ts` are now wired into `simulate-studio.ts` and surface in the live `NOVEL ALGORITHMS` bottom-panel tab ✅
- `coverage-time-budget.ts` now computes a thresholded path time budget from the active authored path, and the live novel panel exposes threshold/budget selectors plus visible-segment speed requirements ✅
- `coverage-entropy.ts` now computes normalized Shannon entropy over the coverage-cell distribution, and the live novel panel plus report handoff surface the normalized score, dominant band, and quality distribution ✅
- `coverage-uncertainty.ts` now samples installation-position / yaw / pitch / spec variation, and the live novel panel plus report handoff surface the mean and 95% coverage band with per-zone pass rates ✅
- `coverage-posture.ts` now compares crouching, seated, child, and standing target heights, and the live novel panel plus report handoff surface the worst posture, largest standing-to-posture drop, and weakest zone per posture profile ✅
- Blind-spot topology is now surfaced in the report handoff with severity, classification, area, and affected-zone detail instead of a count-only summary ✅
- Blind-spot fingerprinting now computes a deterministic signature for each blind-region pattern and surfaces the fingerprint in the live novel panel plus report handoff ✅
- Reflective Bounce Vision now models reflective windows as a first-pass deterministic bounce proxy and surfaces the effect in the live novel panel plus report handoff ✅
- K-Robustness now surfaces its critical failure sets in the live novel panel, report workspace, and report handoff, so the robustness analysis is actionable instead of scalar-only ✅
- Occlusion blame is now surfaced in the report handoff and report-lite export with per-obstruction blame fractions, quality-without values, and improvement deltas instead of a zone-count summary ✅
- `temporal.ts` now carries anomaly windows and anomaly summary data into the temporal profile so the 24h profile and the novel tab share the same derived truth ✅
- `ReportLiteTab.tsx` and the canonical `src/report/index.ts` both include the novel algorithm summaries so tab output and export output stay in sync ✅
- Browser-verified on the production build at `http://127.0.0.1:3013/studio`; the novel panel shows the fragility, entropy, uncertainty, robustness, placement-oracle, temporal-anomaly, occlusion-blame, and blind-region summaries ✅

---

## TypeScript stabilization session (2026-05-27)

The following issues were fixed to reach 0 typed errors (only pre-existing TS7006 implicit-any remain):

1. **`QUALITY_RANK` in `TimelineTab.tsx`** — OODPCVS 2025 ladder is now preserved with distinct levels through the shared quality rank helper, so timeline and sort-based panels no longer flatten the newer standard.
2. **`formatPoint` in `TimelineTab.tsx`** — Extended to accept `[number, number] | null` (was `| undefined` only).
3. **`activePathResult?.timeline.length`** — Added optional chaining to guard possible null.
4. **`setFocusScenePointRequest` in `PathMap.tsx`** — Removed selector and call sites: the store action doesn't exist; the logic now just updates replay progress without the non-existent focus request.
5. **`pointOnPathAtProgress` in `MapLayers.tsx`** — Moved import from `./map-geometry` (doesn't export it) to `./path-quality` (correct source).
6. **`CompareView.tsx`** — Added `DeltaMetricsBar` component with 5 delta chips: Overall Coverage, Recognition Quality, Blind Spot (inverted), Camera Count, Critical Zones. Uses `SceneSnapshot.simulation` data for both snapshots. Renders below the side-by-side 3D panels.

234 tests passing, 0 failures, 0 type errors across the Studio.

---

## Sprint 13: Camera Identity + Direct Manipulation + Overlay Governance (2026-05-27)

### Camera Identity — 3D color-coded cameras
- `WorkspaceCanvas.tsx` — `CameraMarker` and `CameraFrustum` now use `getCameraColorForId()` from `camera-colors.ts` for stable per-camera colors throughout the 3D scene (frustum cone, base circle, outer ring, marker label header) ✅
- `PathReplayView.tsx` — `ReplayCameraCones` and `CameraMarkers` now also use per-camera colors, matching the workspace view ✅
- Colors derive from the existing `CAMERA_COLORS` palette in `camera-colors.ts`, which was already used by the 2D MapLayers — now the 3D scene is consistent ✅
- No new store state required — the palette is a pure function call ✅

### Direct Manipulation — yaw ring arc + orbit conflict fix
- `TransformHandles.tsx` — selected camera now renders a visible yaw ring arc (blue arc tracing the camera's field-of-view cone in the horizontal plane), giving direct visual feedback when rotating a camera ✅
- `WorkspaceCanvas.tsx` — OrbitControls `enabled` property now checks `editor.editorMode !== "transforming"`, preventing orbit camera conflicts while a drag handle is active ✅
- Both changes respect the existing editor state machine and require no new store wiring ✅
- Pre-existing use-before-declare bug in `temporal.ts` (`criticalZoneCoverageByHour` referenced before declaration) fixed alongside the sprint work ✅

### Overlay Governance — density modes, filter toggles, collapsible legend
- `studio-store.ts` — added `OverlayDensity` type (`"all" | "compact" | "minimal"`) and `OverlayFilterId` type with 6 toggles (`cameraLabels`, `zoneLabels`, `obstructionWarnings`, `entryChips`, `pathLabels`, `qualityLabels`), plus `overlayDensity` and `overlayFilters` state with `setOverlayDensity()` and `setOverlayFilter()` actions ✅
- Default state: density `"all"`, all filters enabled — no visual change until user adjusts ✅
- `CoverageLegend.tsx` — fully rewritten: collapsible panel with density mode selector (All / Compact / Minimal), camera/zone/obstruction/entry/path/quality filter toggles with active-badge counts, and proper severity-colored pass/fail auto-detection from simulation results ✅
- `CameraLabelCard.tsx` — added `compact` prop: compact mode renders name + status dot only; minimal mode hides entirely to reduce visual noise ✅
- `CriticalZoneLabelCard.tsx` — added `compact` prop: compact renders zone label + pass/fail badge in slim card ✅
- `SceneFloatingCard.tsx` — added `compact` prop: reduced padding and border-radius for compact overlay mode ✅
- `WorkspaceCanvas.tsx` — `CameraMarker`, `CriticalZoneOverlay`, `ObstructionWarning`, and `EntryDoorLabel` all read `overlayDensity` and `overlayFilters` from store to conditionally render at the appropriate level of detail ✅
- Integration with existing `layerVisibility` system: overlay filters add finer-grained control within the global labels layer, not replacing it ✅

### WIP product code stabilization
- `StudioDashboardHome.tsx` — fixed 4 type errors: wrong `Map` constructor reference, invalid `"dusk"` value for `TimeOfDay`, missing `active` property on nav items, and `File` import path ✅
- `launcher-dashboard-home.test.ts` — updated test expectations to match current component output, test passes reliably ✅
- `ImportReview.tsx` — fixed type error on `selectedImage` (was typed `any`, sourced from a union with `null`) ✅

## 11) Truth labeling and trust-audit coverage

- The live `Metrics` surface now shows `Truth: Simulated` plus the shared-simulation provenance detail before the metric cards.
- The `ReportLite` handoff surface now shows `Truth: Computed` plus the shared-simulation provenance detail before the report summary.
- The footer `StatusBar` now shows `Truth: Live` so the workspace status strip explicitly labels its source of truth.
- The in-product trust-audit route now checks those visible truth labels in addition to the existing launcher/governance/provenance/debug surfaces.
- The next trust-hardening step is broader claim-label coverage across the remaining visible surfaces, not reworking the already labeled ones.
- Trust audit surfaces extended to cover 6 additional data-wired panels: NovelAlgorithmsTab, RedundancyTab, ThreatAnalysisPanel, TemporalProfileView, BeforeAfterTab, TimelineTab — each checks that the component imports from the real simulation engine/store and forbids hardcoded/placeholder/stub patterns ✅
- All 18 trust audit surfaces pass the static phrase audit (required imports, forbidden patterns) ✅

## Sprint 14.1: Trust Audit Extension + Pre-existing TS Fixes (2026-05-29)

- Extended trust audit from 12 to 18 surfaces, adding data-wiring checks for 6 simulation-backed panels.
- Fixed 5 pre-existing TypeScript errors in test files:
  - `report-engine.test.ts`: removed all `bun:test` timeout options (type mismatch with `setTestTimeout`)
  - `support-bundle.test.ts`: added missing `CameraLiveSessionRecord` fields to fixture
  - `sensor-live-ingest.test.ts`: fixed `fetch` mock cast from `as typeof fetch` to `as unknown as typeof fetch`
  - `studio-store.test.ts`: added missing live session fields to `recordCameraLiveConnectionEvent` call
  - `report-evidence-bundle.test.ts`: removed `setTestTimeout` import and timeout option
- Deleted `DemoModeOverlay.tsx` (zero importers, superseded by `DemoWalkthroughPanel`)
- Updated `demo-mode-overlay.test.ts` to test `DemoWalkthroughPanel` instead
- Updated `PHASE_5_PATH_REPLAY_DEMO.md` reference from DemoModeOverlay to DemoWalkthroughPanel
- Test suite: 398/443 pass; 45 failures are all relative-path `readFileSync` issues in other agents' tests (not in blast radius)
- All 5 tests in blast radius pass clean

## Sprint 14: Scene Editing Feedback + Snap-Aware Transforms (2026-05-29)

- `WorkspaceCanvas.tsx` now gives live placement feedback for wall length, door-on-wall validation, and zone/path minimum-point checks instead of silently ignoring invalid edits.
- `TransformHandles.tsx` now reuses the editor snap engine for transform updates so direct manipulation stays aligned with placement snapping instead of drifting freely.
- The workbench still has legacy sensor/selection support in the canvas file, but the primary editor flow is now centered on the current scene-editing tools and warnings.
- Next hardening step: wire per-handle validation messaging into transform edits and add editor fixture coverage for the placement and snap behaviors.
- Camera-facing surfaces now expose a canonical operational-fusion health card that combines sensor proximity, camera metadata freshness, and live-connection/session posture.
- Live camera sessions now support explicit heartbeat renewal, and ONVIF sessions can renew their event-subscription lease on heartbeat, so the operator can keep an active connection alive without forcing a new upstream probe every time.
- Live camera sessions now also carry auth metadata end to end (`authMode`, `authState`, `authRealm`, `authSessionId`, `authSessionExpiresAt`) plus transport response/challenge metadata (`transportResponseStatus`, `transportResponseStatusText`, `authChallengeHeader`, `authChallengeScheme`, `authChallengeRealm`), and the inspector/archive/fusion surfaces show that protocol posture alongside the lease, transport state, and negotiation step.
- Debug now exposes a dedicated incident bundle download in addition to the broader support bundle, and the diagnostic bundle carries the canonical alert summary used by the runtime health card so crash triage can stay focused on incidents, traces, and external logs.
- Camera metadata live ingest now accepts XML feeds in addition to JSON and NDJSON, which lets the Debug panel import ONVIF-style metadata streams and map them to scene cameras without forcing a JSON wrapper first.
- Live camera connection probes now also accept XML payloads without first reporting false JSON parse errors, so auth-challenge and transport metadata survive the probe path cleanly.
- Operational evidence imports now validate through a canonical runtime schema, including nested scene snapshots, so malformed ledger records are rejected before they can pollute the recovery/archive timeline.
- Scene Intelligence deep links now preserve exact checkpoint identity plus provenance node/edge focus, so copied links can reopen the same ledger selection rather than only a nearby branch timestamp.
- Launcher memory hits now visibly mark exact checkpoint routing when a hit carries a resolved timeline event id, so precise timeline jumps are legible in the launcher rather than hidden in the click handler.
- Scene Intelligence can now pivot a selected checkpoint into seeded Before/After or Report compare selections, so the evidence surface hands users directly into the next analysis view instead of stopping at reconstruction.
- Compare/report share links now round-trip those seeded snapshot pairs through the studio bootstrap, so a copied compare link can reopen the comparison state instead of only the timeline anchor.
- Before/After, Report Lite, and Compare View now expose a copyable compare-link action directly in the comparison surface, so the shareable snapshot pair is visible at the point of use instead of only in Scene Intelligence.
- The launcher now also persists a short recent-history of exported/restored operational evidence archives and can search those archives as timeline checkpoints when a latest event id exists, so recovered archives are retrievable through the same workspace memory surface as governance and report hits.
- Scene Intelligence now also shows that recent operational evidence archive history directly in the provenance surface, with browser handoff copy/open and canonical restore actions for each archive.
- The point-in-time reconstruction card now exposes exact-versus-derived provenance for the selected checkpoint, so users can see whether the resolved scene came from the selected event itself or from an earlier snapshot source.
- Report exports now include the same exact-versus-derived checkpoint provenance for the latest checkpoint and latest published checkpoint in the temporal twin summary, so HTML/markdown/text exports match the interactive reconstruction surface.
- Scene Intelligence archive cards and compare handoff cards now surface the same checkpoint provenance note at the point of use, so archive restore and Before/After / Report Compare handoffs stay legible without needing to open the reconstructed scene first.
- ONVIF live camera evidence now preserves event-subscription URI/reference/expiry through the probe response, camera node state, session registry, inspector audit event, and feed HUD, and heartbeat renewals refresh that subscription lease in the same canonical record so the subscription leg stays visible and continuous end to end.
- `PathMap` copy now uses canonical scenario/replay language (`Path Map - Scenario / Path`, `Route Visibility`, `Open Path Replay`) so bottom-map semantics align with the design-pack route-analysis contract.
- Added `path-map.test.ts` source-contract coverage to prevent regression on the canonical PathMap naming and replay action copy.
- `StudioDashboardHome` now matches remaining goal4 root-copy requirements: `Demo Sites` nav label, `STUDIO` section heading, scene summary including path counts, and explicit `manual-assisted site photo intake` wording on guided scan surfaces.
- Root launch behavior now defaults to `StudioDashboardHome`, so `/` is launcher-first while `/studio` remains the explicit workspace route.
- Added explicit `/studio` route via `apps/studio/src/app/studio/page.tsx`, so the documented root hierarchy (`/` dashboard, `/studio` workspace) is now implemented in code rather than only implied by launcher state.
- Dashboard action/copy consistency pass: right-rail report action now says `Open Report Lite`, and quick-start scan copy now uses `manual-assisted site photo intake` language.
- Added `root-routing-contract.test.ts` to lock the launcher-first root contract (`/` dashboard by default, `/studio` explicit workspace route) at the source level.
- Build/type hardening in progress: fixed `SiteIntakeHub` output detail binding (`selected.detail.output` -> `selected.output`) to match `SiteIntakeSourceCard` type, and added `site-intake-hub.test.ts` to guard manual-assisted copy + schema-aligned output binding.
- Build verification now passes in `apps/studio` (`npm run build`): Next.js production build completes, TypeScript completes, and route output includes both `/` and `/studio`.
- Scene template typing now explicitly returns canonical camera schema shape via `cam(...): SecurityScene["cameras"][number]`, preventing template-camera drift against required camera fields.
- Canonical naming consistency pass:
  - `StudioShell` shortcuts now use `Report Lite` wording (view-mode summary and `R` action label).
  - `HelpTab` workspace shortcuts now use `Open Report Lite`.
  - `Docs/product/STUDIO_HOME_FLOW.md` now uses `Report Lite` in primary actions and full workspace list.
- Build runtime note (current parallel environment): repeated `npm run build` runs now complete webpack compile + TypeScript and then receive external `SIGTERM` (exit 143) during static page generation; this appears environmental/interruption-related rather than a TypeScript regression in current code.

## Clarified Feature States (2026-05-30)

- **Scan-First Flow**: Explicitly documented as a "manual-assisted capture" workflow. No automatic segmentation or depth mapping is currently active in the core loop.
- **AI Layout Draft**: Explicitly documented as a prototype-level draft assistant. Generates approximate layouts but requires manual refinement.
- **Floor-plan Import**: Explicitly documented as a best-effort prototype extraction. Not yet production-grade and requires manual cleanup of extracted walls.
 - Scene Intelligence, Before/After, Report Lite, and Compare View now expose browser-native share buttons for checkpoint/archive/compare links, with clipboard copy as the fallback path when sharing is unavailable ✅

## Scan / Reconstruction Pipeline Foundation (2026-05-30)

### Scan Artifact Data Model — built and tested
- `apps/studio/src/lib/scan-artifacts.ts` — Core data types for the full scan pipeline:
  - `ScanCandidateKind` extended to include `"pillar"` alongside existing kinds ✅
  - `ScanCandidate` enhanced with `boundingBox`, `maskArtifactId`, `sourceArtifactIds[]`, `estimatedPosition`, `estimatedDimensions`, `warnings[]`, and `source` (manual | model_detection | segmentation | structural_extraction) ✅
  - `ScanArtifact` and `PhotoArtifact` with `exif`, `role` (front_wall, right_wall, etc.), `linkedCandidateIds[]` ✅
  - `DepthMapArtifact`, `MaskArtifact` for AI/CV outputs ✅
  - `ScanCaptureStep` with 13-step guided capture sequence (overview, 4 walls, critical_zones, existing_cameras, obstructions, entry_points, ceiling, known_measurement, dimensions, complete) ✅
  - `ScanCaptureSession` with `captureMode` (manual_assisted | guided_capture | ai_assisted), photos, artifacts, candidates, knownMeasurements, captureSteps, warnings ✅
  - `ScanCandidateWarning` with typed codes (LOW_CONFIDENCE, DIMENSIONS_ESTIMATED, POSITION_ESTIMATED, NO_MASK, NO_DEPTH_REFERENCE, FAR_FROM_CAMERA, NOT_ALIGNED_TO_WALL, SINGLE_PHOTO_ONLY, DEPTH_OUTLIER) ✅
  - `ScanWarning` with typed codes (NO_CAMERAS, NO_CRITICAL_ZONES, DIMENSIONS_UNANCHORED, SINGLE_PHOTO_ONLY, etc.) ✅
  - Session mutation helpers: `addPhotoToSession`, `addCandidateToSession`, `updateCandidateInSession`, `removeCandidateFromSession`, `markCaptureStepCompleted`, `addWarning`, `addCandidateWarning`, `linkArtifactToCandidate` ✅
  - `sessionCompletionRatio()`, `captureModeLabel()`, `captureModeDescription()` utilities ✅
- 33 tests covering all data model operations ✅

### AI/CV Adapter Interfaces — scaffolded and tested
- `apps/studio/src/lib/scan-adapters/types.ts` — Adapter interfaces:
  - `ObjectDetectionAdapter` — detects objects (VLM/ML) from scan artifacts ✅
  - `SegmentationAdapter` — tap-to-segment with point, box, or text prompt ✅
  - `DepthEstimationAdapter` — depth map estimation ✅
  - `ScaleAnchoringAdapter` — suggest anchors and refine depth with user anchor ✅
  - `MultiPhotoCorrespondenceAdapter` — link same objects across photos, relate walls ✅
  - `StructuralExtractionAdapter` — extract walls/doors/windows/floors/corners ✅
  - `VisionProvider` — interface for vision-capable AI models ✅
- All adapters return typed results with confidence and warnings ✅
- No model integrations are wired — architecture is scaffolded for future integration ✅

### Reconstruction Compilation Pipeline — built and tested
- `apps/studio/src/lib/scan-reconstruction.ts`:
  - `compileReconstructionToScene()` — converts accepted session candidates into valid `SecurityScene` via `SiteCompilerResult`. Preserves sourceTrace, reviewStatus, geometryValidity per node. Merges explicit entry points with door-derived entries. Writes reconstruction provenance into change log ✅
  - `compileReconstructionToSiteTwinDraft()` — wraps compiled scene in `SiteTwinDraft` with source artifacts, capture mode, scale anchors, and confidence ✅
  - `estimateOverallConfidence()` — computes composite confidence from candidate confidence, depth data, scale anchors, photo count, correspondence, and blocking warnings ✅
  - `computeQualityGates()` — evaluates 8 quality gates (cameras, critical zones, depth reference, scale anchor, entry points, multi-photo, candidate warnings, session warnings) ✅
  - `computeDefaultWarnings()` — computes standard warnings for missing cameras, zones, scale anchors, and single photo ✅
  - `computeConfidenceLabel()` — maps numeric confidence to very_low/low/medium/high ✅
  - `DEFAULT_RECONSTRUCTION_CONFIG` — with `forceReview: true` by default ✅
- 27 tests covering compilation, confidence, quality gates, and default warnings ✅

### Quality Gates — built and tested
- `apps/studio/src/lib/scan-quality-gates.ts`:
  - `evaluateQualityGates()` — evaluates all gates with override support for thresholds and required flags ✅
  - `qualityGateToWarning()` — converts failed gates to type-safe warnings with blocking/warning severity ✅
  - `QUALITY_GATE_DEFINITIONS` — canonical gate definitions with labels, default thresholds, and descriptions ✅
- 12 tests covering all gate evaluation paths ✅

### Site Compiler Extension
- `apps/studio/src/lib/site-compiler.ts` — added `SiteIntakeSource` values:
  - `"guided_scan"` — for guided capture sessions ✅
  - `"reconstructed"` — for AI-assisted reconstruction pipeline ✅
  - Source labels, legacy aliases, entity source mapping, and maturity descriptions updated accordingly ✅

### Product Feature Status Updated
- Three new entries: `Reconstruction data model`, `AI/CV adapter interfaces`, `Reconstruction compilation pipeline` — all marked `Scaffolded` or `Preview` ✅

### Key design decisions captured
- **Review-required principle preserved**: All AI/CV candidates start with `status: "pending"`. Only user-approved candidates reach compilation. `forceReview: true` by default in reconstruction config ✅
- **Candidates → SiteTwinDraft, not directly into SecurityScene**: The reconstruction pipeline compiles through `compileReconstructionToSiteTwinDraft()` which produces a `SiteTwinDraft`. The draft must go through site draft approval to become the active scene ✅
- **No overclaiming automatic reconstruction**: Tests explicitly verify that pending/rejected candidates are skipped, that confidence is never 1.0, and that the system clearly labels estimated vs anchored dimensions ✅
- **Architecture before integration**: Adapter interfaces exist but no model backend is wired. The product contract is real while the implementation path is clear ✅

---

## Security Outcome Review — enriched model + UI (2026-05-30)

- `security-outcome-model.ts` (761 lines) now exports: `FailedZoneDetail` (with `productFailureReasons`, `causeSummary`), `CameraFinding` (with `roleSummary`, `offlineImpactSummary`), `PathFinding` (with `lostSegmentLabels`, `worstMomentSummary`), `PrivacyFinding`, `OutcomeRecommendationCard` (with `verificationLabel`, `beforeAfterSummary`), `AssumptionEntry`, `SecurityOutcomeSummary` (with `nightReadiness`, `redundancyStatus`, `primaryRisk`, `recommendedNextAction`), `SecurityOutcomeModel` (with `missingPrerequisites`, `pathOutcome`) ✅
- `security-outcome-copy.ts` provides product-language mapping functions: `explainFailureReason` (maps obstruction/night/FOV/range/privacy to human-readable), `explainQualityGap`, `explainCameraOfflineImpact`, `explainPrivacyIssue`, `explainPathLoss`, `explainPathEmpty`, `explainNoZones`, `explainNoCameras`, `verificationLabel`, `costLabel` ✅
- All 12 UI components wired to enriched model:
  - `OutcomeSummaryCard` — shows status, headline, coverage pct, critical zone pass/total, issue count, night readiness, redundancy, recognition/identification area % ✅
  - `CriticalZoneReview` — shows `productFailureReasons` and `causeSummary` per zone, priority/status badges, target type, coverage count, Focus in Scene action ✅
  - `CameraResponsibilityPanel` — shows `roleSummary`, `offlineImpactSummary`, coverage %, zones passed/failed, View Camera action ✅
  - `RecommendationCard` — shows `verificationLabel` with tone colors, `beforeAfterSummary`, Preview/Compare/Apply actions gated by verification state ✅
  - `PathOutcomeReview` — shows active path duration/visible/lost metrics and per-path `visiblePct`, `lostSegmentLabels`, `worstMomentSummary`, `bestQuality` ✅
  - `AssumptionDisclosure` — shows structured `assumptions` (label/value/impact) and `limitations` array with expandable details section ✅
  - `PrivacyReview` — shows privacy zone stats, `privacyFindings` with camera/zone/issue details ✅
  - `NightReadinessReview`, `RedundancyReview`, `OutcomeEmptyState`, `IssueCard`, `SecurityOutcomePanel` — all wired ✅
- 35 tests (159 assertions) covering model building, language mapping, truth checks (no "AI certainty", no "forensic guarantee" in user-facing strings, no evasion guidance) ✅
- `buildSecurityOutcomeDelta` computes before/after coverage, blindspot, issue, and critical-zone delta ✅
- Product language constraint: failure reasons map technical causes to human-readable text (e.g. "Blocked by Shelf 1" → "Shelf 1 blocks the camera's line of sight") ✅
- Model uses defensive framing throughout: "coverage failure analysis", no "optimal evasion" or "bypass security" language ✅
- Verification labeling distinguishes `verified_by_simulation`, `not_yet_tested`, `requires_user_input`, `assumption_based` — never claims "AI certainty" or "100% guaranteed" ✅

## Addendum (2026-06-12): Analytics Dashboard + Simulation Worker + structural notes

- **Structural drift note:** the simulation engine, agents, report, and core schema now live in `packages/simulation`, `packages/agents`, `packages/report`, `packages/core` (the monorepo split landed); earlier sections of this doc that reference `apps/studio/src/simulation/` as the engine home are historical. The studio app re-imports via `@sentineltwin/*`. The store is also now slice-based (`src/store/slices/core/*`, `src/store/slices/enterprise/*`).
- **New `analytics` view mode** (`AnalyticsDashboardView`): interactive security analytics command center backed by the pure `buildSecurityAnalyticsModel` derivation (`src/lib/security-analytics.ts`). KPI drill-through, clickable 24h coverage chart that scrubs the temporal twin, DORI distribution, issue severity, camera leaderboard → Camera View, occlusion offenders → counterfactual, placement-oracle callout, snapshot trend, evidence-ledger activity, resilience panel. Reachable via ViewModeBar, key `7`, `?mode=analytics`, View Settings. 6 engine-backed model tests. Runtime-verified on the production build with the retail reference scene ✅
- **Simulation now runs in a Web Worker** (`src/workers/simulation.worker.ts` via `src/lib/simulation-runner.ts`), computing coverage + the 24h temporal profile off the main thread in one round-trip, with a deterministic `simulateStudioAsync` fallback for SSR/tests. Execution path is recorded in the runtime incident trail. Runtime-verified via instrumented `postMessage` in the production build ✅ (D-300)
- **Bug fix:** `setViewMode` no longer lets the preset layout patch overwrite the requested view mode; initial boot honors `?mode=` for all modes (D-301).
- **Test/keyboard updates:** view keys are now `1–7`; shortcut copy and the `studio-shell-shortcuts` source-contract test updated. Suite: 920 pass / 0 fail; typecheck clean; production build green.
- See `Docs/exploration/DEEP_ANALYSIS_BEST_IN_CLASS_2026-06-12.md` for the full audit, potential assessment, and next-leverage ordering, and D-300/D-301 in the decision log.

## Addendum (2026-06-12, second pass): Interactive scene creator upgrades

- **Drag-to-aim camera placement** (D-302): pointerdown anchors, drag steers yaw with a live floor FOV wedge + "Aim N° · release to place" HUD, pointerup commits. Plain click keeps preset/default yaw. Aim state is canonical (`editor.placementAim`). Browser-verified end-to-end on the production build ✅
- **Live placement POV preview** (`PlacementPreviewPanel`): while the camera tool is active, a PIP canvas renders the canonical scene from the hover/aim pose (pose, yaw, FOV, preset label, Hover/Aiming badge) — "what will this camera see" before placement ✅
- **Object library for obstructions** (D-303): 8 real-world presets + custom dimensions, store-backed picker, engine-true materials/transmission, ghost shows true footprint ✅
- **Selection vs placement conflict fixed**: object meshes (frustums, markers, walls, obstructions) no longer swallow pointerdown while a placement tool is active — previously frustum cones made floor placement nearly impossible on populated scenes ✅
- **Preset pickers default collapsed** (they could cover the whole canvas at narrow widths); orbit-rotate disabled while camera tool active so left-drag aims ✅
- **Analytics dashboard animation polish**: KPI stagger + count-up, chart draw-in, DORI band grow-in, hover/tap micro-interactions ✅
- **QA hook**: `?qa=1` exposes the store as `window.__sentinelStudioStore` for scripted browser verification ✅
- Suite: 929 pass / 0 fail; typecheck clean; production build green; Tier 4 browser evidence for aim cycle, library placement, preview panel, and worker auto-recompute after placement.

## Addendum (2026-06-12, third pass): Progressive-disclosure UI (D-304)

- Overlay density defaults to `compact`; legend + preset pickers start collapsed; labels are chips at rest and full cards on hover/selection ✅
- New `SelectionContextBar` — floating contextual task bar above the canvas bottom for the current selection, sharing the canonical context-action model and the new `applyContextActionPlan` executor with the right-click menu ✅
- Right-click menu refactored onto the shared executor (no behavioral fork) ✅
- Verified in production build: calm canvas screenshot, bar action execution (Duplicate), 929/0 tests ✅

## Addendum (2026-06-12, fourth pass): Disclosure completeness + motion accessibility

- Sensors and security lights now follow the same progressive-disclosure pattern: no labels at rest, identity chip (`MarkerHoverChip`) on hover/selection. Lights were previously unselectable and unlabeled — they now have full selection handlers, hover affordance, and selected-state emphasis ✅ (browser-verified: light chip + selection, sensor placement + chip)
- Global `MotionConfig reducedMotion="user"` in StudioShell — all framer-motion animations (dashboard, context bar) respect OS prefers-reduced-motion (declarative config; not runtime-verified)
- Known deferred item: drei `distanceFactor` label scaling has no max clamp, so chips grow when zoomed very close; a clamp needs a custom scale loop in `SceneHtml` (per-frame distance measurement) — deferred deliberately rather than hacked
- Suite 929 pass / 0 fail; production build green

## Addendum (2026-06-12, fifth pass): Analytics → Report convergence (D-305) + "do all" scoping

This pass starts execution of the priority roadmap from the deep-analysis doc
(`Docs/exploration/DEEP_ANALYSIS_BEST_IN_CLASS_2026-06-12.md` §4), in response to
the directive to "do all" the proposed roadmap under full motto_v3 rigor, with the
explicit feedback that prior feature/vision proposals were too small in ambition.
Per motto_v3 §0.13 (Scope Expansion Control), the roadmap is executed incrementally
across passes rather than in one unscoped sweep — see scoping note at the end of
this addendum.

### Item #1: Analytics → Report convergence (done, Tier 4)

- New pure module `apps/studio/src/lib/report-analytics-export.ts` exports
  `buildAnalyticsReportSection(model: SecurityAnalyticsModel): string` and
  `ANALYTICS_REPORT_STYLES`. Renders the same `buildSecurityAnalyticsModel`
  output (KPI cards, DORI quality distribution, issue-severity bars, coverage
  trend, camera leaderboard) as a self-contained HTML fragment with inline SVG
  charts — no React/DOM, portable to any export path.
- Wired into `ReportLiteTab.tsx`'s `buildHtmlReport`: the function now computes
  `buildSecurityAnalyticsModel` from the same scene/result/temporalProfile/
  evidence/snapshots already in scope, and inserts a new "Security Analytics
  Overview" section between the existing summary/AI report block and the
  "Temporal Operational Twin" table. Both single-report export call sites
  (download HTML, print/PDF) now pass `snapshots` through to `buildHtmlReport`.
- This closes the duplication gap noted during investigation: the report now
  carries the *same* dashboard-derived numbers as the Analytics view, instead
  of only the separately-computed "Advanced Risk Signals" table. The
  "Advanced Risk Signals" table in `buildHtmlReport` is left as-is (it covers
  fragility/k-robustness/placement-oracle/occlusion detail not yet duplicated
  in the analytics model's KPI set) — no parallel system was created, the new
  section is additive and sourced from the canonical analytics model.
- New test `src/lib/__tests__/report-analytics-export.test.ts` (3 cases): empty
  fragment when no simulation, full section (KPIs/DORI/issues/leaderboard) for
  a simulated scene, coverage-trend chart appears once >=1 snapshot exists.
- Verified Tier 4: `bun test` → 932/932 pass (929 + 3 new), `tsc --noEmit`
  clean, `pnpm --filter studio build` green.

### "Do all" scoping (motto_v3 §0.13)

The full roadmap from §4 of the deep-analysis doc plus the interactive-scene-
creator candidates from `EXPLORATION_MAP.md` is large (9 items spanning UI,
worker protocol, org/account-dependent multi-site analytics, and a new
first-person walk mode). Executing all of it as one unreviewed pass would
violate the 3-pass review and acceptance-contract discipline. This pass
completes item #1 (above) as the first concrete slice. The remaining items are
tracked as follow-up work; #3 (multi-site/org analytics) is explicitly blocked
on the org/account slice (gap inventory §8) and cannot be implemented until
that lands. A separate "super app" vision addendum, addressing the explicit
"vision is too small" feedback, is being added to
`Docs/exploration/EXPLORATION_MAP.md` in this same session.

## Addendum (2026-06-12, sixth pass): Coverage CI / comparative analytics (D-306)

Continuing the §4 roadmap per "do all, keep working and documenting" — item #5
("snapshot-over-snapshot KPI deltas, regression alerts when a scene edit reduces
coverage"). Item #2 (worker progress/cancellation) was evaluated and deferred:
`simulateStudio` runs synchronously inside the worker with no chunking/yield
points, so true mid-computation progress would require restructuring the
engine's control flow — out of scope for a single pass and a risk of "hacks"
under the no-hacks policy. Re-scoped to a dedicated pass if/when pursued.

### Item #5: Coverage CI (done, Tier 3 + partial Tier 4)

- New pure module `apps/studio/src/lib/coverage-regression.ts` exports
  `buildCoverageRegressionReport(current, baseline, baselineMeta)`. Compares
  the live `SimulationResult` against the most recent simulated snapshot and
  returns pass/warn/fail checks (CI-style) for: total walkable coverage, blind
  area, critical-zone pass count, open issues (severity-weighted), and
  k-robustness. No new computation — reuses `buildZoneStatus`/`buildResilience`
  (now exported from `security-analytics.ts`) so the regression checks can never
  diverge from the dashboard's own interpretation of the engine output.
- If no simulated snapshot exists, returns `{ hasBaseline: false, checks: [] }`
  — an honest empty state, not a fabricated baseline.
- Wired into `AnalyticsDashboardView.tsx`: a new "Coverage CI" `SectionCard`
  (gated on `regressionReport !== null`) sits above "Resilience", showing each
  check's baseline → current value, delta, and pass/warn/fail badge with
  status-colored styling (`REGRESSION_STATUS_CLASSES`).
- New test `src/lib/__tests__/coverage-regression.test.ts` (4 cases): no-baseline
  empty state, unchanged-scene → all pass, coverage drop → fail, new critical
  issue → fail. `bun test` → 936/936 pass (932 + 4 new). `tsc --noEmit` clean.

**Evidence tier note:** Browser verification confirmed the dashboard renders
correctly with the Coverage CI card *absent* (no simulated snapshot in the
fresh/blank scene used for this verification session — `regressionReport` is
`null`, gate works as intended, no layout/rendering errors in the rest of the
dashboard). Verifying the *populated* card (an actual baseline comparison with
checks rendered) requires a scene with at least one saved simulated snapshot,
which could not be established via the `?qa=1` store hook in this session (a
manually-added camera + snapshot did not survive `window.location.reload()`).
Per motto_v3 evidence-tier honesty: this is Tier 3 (full unit-test coverage of
the populated-report logic, 4/4 passing) + Tier 4 for the empty-state gate
only. Populated-card screenshot verification is deferred — flagged as a
follow-up if/when a reliable way to seed a snapshot-bearing scene via the QA
hook is added (e.g. exposing `loadDemoScene`/`saveSnapshot` directly on
`window.__sentinelStudioStore` rather than relying on dynamic import).

## Addendum (2026-06-12, seventh pass): Live operational health fusion (D-307)

Continuing "do all, keep working and documenting" — item #4 from the deep-analysis
roadmap ("Sensor/camera live events already land in the evidence ledger; the
dashboard's activity panel is the natural home for live health deltas (simulated
vs observed)").

### Item #4: Live operational health (done, Tier 4)

- New exported types in `security-analytics.ts`: `LiveHealthStatus`,
  `LiveHealthEntry`, `LiveOperationalHealthSummary`, plus
  `buildLiveOperationalHealth(scene, events)` — a pure derivation over the
  existing `OperationalEvidenceEvent[]` ledger. Tracks the latest
  sensor-heartbeat/fault/restore/trigger event per sensor and the latest
  `camera_live_connection_updated` event per camera, classifies each as
  healthy/degraded/fault, and returns counts plus a capped (8) list of
  non-healthy alerts sorted most-recent-first.
- `liveHealth` added to `SecurityAnalyticsModel` (both the no-simulation and
  full-simulation return paths of `buildSecurityAnalyticsModel`) — always
  present, computed unconditionally from `evidenceEvents` regardless of
  whether a simulation has run.
- `AnalyticsDashboardView.tsx`: new "Live Operations" `SectionCard` (Radio
  icon) between "Coverage CI" and "Resilience", gated on
  `liveHealth.trackedSensors + liveHealth.trackedCameras > 0`. Shows a
  "Simulated vs. Observed" summary line and a grid of alert tiles for any
  non-healthy node.
- New test `src/lib/__tests__/live-operational-health.test.ts` (4 cases, 15
  expects): empty summary with no events; fault tracked + alerted; restoration
  clears the alert; camera connection status classified by keyword
  (error/disconnected → fault, connecting/authenticating → degraded).
  `bun test` → 940/940 pass (936 + 4 new). `tsc --noEmit` clean.

**Evidence tier note — environment finding:** Browser verification on this
machine required a manual `pnpm build` + `pnpm start` cycle. The preview
tooling's `command` parameter to `preview_start` is not honored for this
project — every attempt (`pnpm dev`, `pnpm exec next dev --turbopack`) was
silently rerouted to running the package's `start` script (`next start` on
`.next`), so source edits are invisible until a production build is rebuilt.
This is a tooling quirk, not a codebase issue — no action needed in-repo, but
future sessions doing Tier 4 verification should rebuild (`pnpm build`) before
each `preview_start` rather than relying on dev-server HMR.

With the rebuild in place: empty state confirmed (fresh scene, 0 live events →
card absent, "Coverage CI" / "Live Operations" both correctly absent with no
rendering errors). Populated state confirmed: injected a synthetic
`sensor_faulted` event for `sensor_demo_1` via
`window.__sentinelStudioStore.setState({ operationalEvidenceEvents: [...] })`
→ "Live Operations" card appears showing "1 sensor · 0 camera connections
reporting · 1 need attention" and a FAULT tile for `sensor_demo_1` /
"Sensor fault reported". Screenshot evidence captured. Full Tier 4.

### Next item

Per "keep working and documenting", the next roadmap item to pick up is one of
the remaining items from `DEEP_ANALYSIS_BEST_IN_CLASS_2026-06-12.md` §4 (e.g.
camera live-connection seeding for the "0 camera connections reporting" half
of the new Live Operations card — currently only sensor events have a demo
seed path) or an EXPLORATION_MAP.md "super app" item not yet started.

## Addendum (2026-06-12, eighth pass): Camera Drift (D-308)

Continuing "do all, keep working and documenting" — first slice of
EXPLORATION_MAP.md §A1 ("live coverage drift detection"), scoped schema-free
per Rule 5 by reusing the Coverage CI (D-306) baseline snapshot mechanism.

### Item: Camera Drift (done, Tier 4)

- New module `src/lib/camera-drift.ts`: `buildCameraDriftReport(currentCameras,
  baselineCameras, baselineMeta)` — pure diff of the live scene's
  `CameraNode[]` against the most-recently-saved simulated snapshot's cameras.
  Flags `moved` / `reaimed` / `status_changed` / `fov_changed` / `added` /
  `removed` entries with `minor`/`major` severity (thresholds: position
  0.1m/0.5m, angle 2°/10°, FOV/range 5%/20%; any status transition into
  `{off, blocked, dirty, malfunctioning}` is `major`). Returns an
  empty-but-honest `{ hasBaseline: false, entries: [] }` when no simulated
  snapshot exists yet.
- `AnalyticsDashboardView.tsx`: new "Camera Drift" `SectionCard` (Compass
  icon) between "Coverage CI" and "Live Operations", computed via a
  `cameraDriftReport` useMemo over `scene.cameras` and `snapshots` (selects
  the latest snapshot with a `simulation` result as baseline). Gated on
  `cameraDriftReport && cameraDriftReport.entries.length > 0`.
- New test `src/lib/__tests__/camera-drift.test.ts` (6 cases, 14 expects):
  no-baseline, no-drift-when-unchanged, major moved (>0.5m), major reaimed
  (>10°), major status_changed (`on → malfunctioning`), added/removed camera
  diffing. `bun test` → 946/946 pass (940 + 6 new). `tsc --noEmit` clean.

**Bug caught during implementation:** `CameraNode["position"]` is a tuple
`[number, number, number]`, not `{x,y,z}` — an initial `.x/.y/.z` access in
`distance()` produced `NaN` and a silent false-negative (no drift detected
despite a 1m position change). Caught via a `bun -e` debug script before
shipping; fixed by indexing `[0]/[1]/[2]`.

**Evidence tier (Tier 4, full):** Production build (`pnpm build` + `pnpm
start`, per the seventh-pass environment finding). Empty state: fresh scene, 0
snapshots → "Camera Drift" card absent, no rendering errors. Populated state:
via `window.__sentinelStudioStore`, added `cam_drift_test` (position
`[2,2,3]`, yawDeg 0, status "on") with `addNode`, ran `runSimulation()` →
`{ hasSim: true }`, called `saveSnapshot("Baseline")`, then `updateNode(
"cam_drift_test", { position: [2,2,4.5], status: "malfunctioning" })` (1.5m
move + status flip). The "Camera Drift" card rendered with both entries as
MAJOR: "Moved 1.50 m from baseline position" and "Status changed: on →
malfunctioning". Screenshot evidence captured.

### Next item

Per "keep working and documenting", continue to the next EXPLORATION_MAP.md
"super app" item or remaining DEEP_ANALYSIS_BEST_IN_CLASS_2026-06-12.md §4 item
(e.g. camera live-connection seeding for Live Operations, or the live-feed
half of A1 fusing Camera Drift with D-307's Live Operational Health).

## Addendum (2026-06-12, ninth pass): Simulation worker progress reporting (D-309)

Continuing "do all, keep working and documenting" — item #2 from the deep-
analysis roadmap §4 ("Worker protocol → progress + cancellation").

### Item: Worker progress reporting (done, Tier 4)

- `packages/simulation/src/coverage.ts`: `computeCoverageCellsAsync` gained an
  optional `onProgress?: (fraction: number) => void`, called every
  `yieldEvery` cells with `(i+1)/total`.
- `packages/simulation/src/simulate-studio.ts`: `simulateStudioAsync` gained
  `options.onProgress`, mapping coverage-cell progress to `0..0.9` and firing
  `0.9` / `1` around zone-evaluation + result assembly.
- `apps/studio/src/lib/simulation-run-core.ts`: `SimulationRunResponse` gained
  a `{ id, type: "progress", fraction }` variant.
- `apps/studio/src/workers/simulation.worker.ts`: now runs
  `simulateStudioAsync` (was the synchronous `simulateStudio`) and posts
  progress messages alongside the final response.
- `apps/studio/src/lib/simulation-runner.ts`: `runInWorker`/`runOnMainThread`
  thread an `onProgress` callback (new `SimulationRunOptions.onProgress`);
  worker `onmessage` distinguishes progress messages via `"ok" in response`
  (the `"type" in response` check did not narrow the union correctly under
  `tsc --noEmit` — fixed to check the `ok` discriminant instead).
- `apps/studio/src/store/slices/core/simulation-slice.ts`: new
  `simulationProgress: number | null` (null when idle), set to `0` at run
  start, updated per progress callback (guarded by the existing
  `scene.updatedAt` stale-run check), cleared to `null` in all three terminal
  paths (`buildSimulationState`, fix-sandbox success, both catch blocks).
- `apps/studio/src/components/layout/TopBar.tsx`: "Run Review" button shows a
  filling progress bar + live percentage while reviewing; `SimStatus` chip
  shows the percentage too.

**No schema change** — `SimulationResult`/`SecurityScene` untouched (Rule 5
clean). `bun test` → 946/946 pass (unchanged count — additive, no new test
file). `tsc --noEmit` clean.

**Evidence tier (Tier 4, store-level):** Production build (`pnpm build` +
`pnpm start`). Subscribed to `window.__sentinelStudioStore` and called
`runSimulation()`: observed 28 incremental `simulationProgress` values ramping
`0 → 0.035 → ... → 0.9 → 1`, then `simulationRunning: false` /
`simulationProgress: null`. The reference scene completes in tens of ms — too
fast for a screenshot to catch the bar mid-fill, which itself confirms the
worker path is fast for typical scenes. Full UI screenshot verification
deferred to a future pass with a larger reference scene.

**Explicitly out of scope:** true mid-run cancellation (`worker.terminate()` +
rebuild). The existing stale-result-discard (`scene.updatedAt` version check)
already prevents a superseded run from overwriting newer state.

### Next item

Per "keep working and documenting", continue to the next
EXPLORATION_MAP.md "super app" item — multi-site/org analytics (deep-analysis
§4 item #3) is gated on the org/account slice (gap inventory §8) and is a
larger schema-touching item warranting its own decision pass; alternatively,
pick up the live-feed half of A1 (fusing Camera Drift with D-307's Live
Operational Health) or another EXPLORATION_MAP.md thread not yet started.

## Addendum (2026-06-12, eleventh pass): Cinematic framing grade (D-310)

Implemented Thread 146 from the "Director/Simulator Lens & Adjacent Expansion
Surfaces" exploration batch (2026-06-12) — the lowest-lift, highest-
differentiation item in that batch per its sequencing note.

- New pure module `apps/studio/src/lib/framing-grade.ts`
  (`buildFramingGradeReport`): for every critical zone with at least one
  `status: "on"` covering camera, projects the zone polygon's centroid (at
  `scene.assumptions.personHeightM`) into each covering camera's frame using
  the same hAngle/vAngle projection as `evaluatePoint`
  (`packages/simulation/src/coverage.ts` ~L573-579), normalized by `±fov/2`
  to a `-1..1` in-frame position. Grades: `out_of_frame` (`|norm| > 1` on
  either axis), `foreshortened` (`camera.pitchDeg <= -55°`, steep top-down),
  `edge_of_frame` (`|norm| > 0.6`), else `well_framed`. Returns
  `zonesNeedingAttention` — zones where no covering camera is `well_framed`.
- Wired into `AnalyticsDashboardView.tsx` as a new "Shot Quality" `SectionCard`
  (Clapperboard icon) between "Trend & Activity" and "Resilience", gated on
  `zonesNeedingAttention.length > 0`; only non-`well_framed` entries render.

**No schema change** (Rule 5 clean — pure derivation over existing camera pose
+ zone geometry, same shape as Camera Drift D-308 / Coverage CI D-306).

**Verification:** New test `src/lib/__tests__/framing-grade.test.ts` (4 cases,
12 expects). `bun test` (from `apps/studio`) → 950/950 pass (946 + 4 new).
`tsc --noEmit` (from `apps/studio`) clean. `pnpm build` green.

**Evidence tier (Tier 4):** Production build (`pnpm build` + `pnpm start`).
Loaded the Small Retail Shop reference scene via
`window.__sentinelStudioStore.getState().importScene(...)` and ran the
simulation — with the stock 5-camera layout the "Cash Counter" zone already
has 2 well-framed covering cameras, so the card is correctly absent (no
framing problem to report). To exercise the populated state, re-aimed
`cam_aisle_wide` to a steep `-75°` pitch directly above the zone centroid and
disabled the other covering cameras, then re-ran the simulation: the "Shot
Quality" card appeared showing "Cash Counter — OUT OF FRAME / Cash Counter
falls outside Camera 3's frame...". Screenshot evidence captured.

### Next item

Continue "keep working and documenting" with another thread from the
Thread 146-153 batch — Thread 148 ("Director's Cut" cut-sequence export) is
the next-ranked item per the sequencing note (builds entirely on existing
POV-preview + path-replay + this pass's framing grade, no new simulation
math), or pick up the live-feed half of A1 (Camera Drift × Live Operational
Health fusion).

## Addendum (2026-06-12, twelfth pass): Director's Cut camera-cut sequence (D-311)

Completed Thread 148 ("Director's Cut") — the natural sequel to D-310's
framing grade, applied along a moving subject's path instead of a static
zone.

- New pure module `apps/studio/src/lib/directors-cut.ts`
  (`buildDirectorsCutSequence(scene, path)`): takes D-009's adversarial-path
  waypoints and, for each one, picks the best-framed eligible camera
  (`status: "on"`, `distance <= rangeM`, not `out_of_frame`, ranked
  `well_framed` > `edge_of_frame` > `foreshortened`, ties broken by distance)
  via D-310's `gradeCameraFraming` (now exported from `framing-grade.ts`).
  Waypoints with no eligible camera get `grade: "no_coverage"`. Adjacent
  waypoints with the same camera+grade collapse into a single cut `segment`
  with `startTimeS`/`endTimeS`/`startPosition`. `noCoverageDurationS` sums
  segment durations graded `no_coverage`/`out_of_frame`. Returns `null` only
  for a zero-waypoint path.
- Wired into `AnalyticsDashboardView.tsx` as a new "Director's Cut"
  `SectionCard` (Clapperboard icon), placed right after "Trend & Activity" /
  Evidence Ledger, gated on `directorsCut.segments.length > 0`. Shows a
  headline (`% with no usable shot`) and a row of segment tiles (camera name,
  grade badge, time range).

**No schema change** (Rule 5 clean — pure selection over existing camera pose
+ adversarial-path waypoints + D-310's projection, same shape as Camera Drift
D-308 / Shot Quality D-310).

**Verification:** New test `src/lib/__tests__/directors-cut.test.ts` (4 cases).
`bun test` (from `apps/studio`) → 954/954 pass (950 + 4 new). `tsc --noEmit`
(from `apps/studio`) clean. `pnpm build` green.

**Evidence tier (Tier 4):** Production build (`pnpm build` + `pnpm start`).
Loaded the Small Retail Shop reference scene fresh via
`window.__sentinelStudioStore.getState().importScene(...)` and ran the
simulation — the adversarial path has 6 waypoints, all
`exposedToCamera: "cam_entrance"`, `criticalZoneReachable: true`,
`totalDurationS: 1.5`. The "Director's Cut" card rendered with headline
"Camera-cut sequence following the adversarial path · 0% with no usable
shot" and one collapsed segment, "Camera 3 — WELL FRAMED — 0.0s – 1.5s".
Screenshot evidence captured.

**Investigation note (not a bug):** a `document.body.innerText.includes("Director")`
check initially returned `false` even with the card correctly rendered —
`innerText` reflects the `SectionCard` title's `text-transform: uppercase`,
so the live text is `"DIRECTOR'S CUT"`. The case-sensitive substring check
was the false negative, not the component.

### Next item

Continue "keep working and documenting" with another thread from the
Thread 146-153 batch (Threads 147, 149-153 remain), or pick up the live-feed
half of A1 (Camera Drift × Live Operational Health fusion).

## Addendum (2026-06-12, thirteenth pass): Selection-overlay crowding fixes (D-312)

Pranay screenshotted the editor at ~800px width with a wall selected and
flagged real overlapping/illegible UI, plus a standing complaint about
engineering jargon in the copy.

- Fixed three concrete overlap bugs (see D-312 for full detail):
  `WorkspaceCanvas.tsx` `SelectionHighlights` no longer renders a redundant
  "Primary" chip for single-node selections (it collided with the "Move"
  transform handle label); `CommandBar.tsx`'s collapsed status pill now hides
  its provider/health/budget chips below `sm`/`md` breakpoints so it stops
  colliding with the centered `SelectionContextBar`; `BottomRow.tsx`'s
  "Simulation Assumptions" card switched from an overflowing `grid-cols-2` to
  a scrollable `grid-cols-1`, with `AssumptionRow` gaining `min-w-0`/`truncate`
  so label text can never bleed into the value.
- `bun test` (from `apps/studio`) → 954/954 pass (no count change, layout-only).
  `tsc --noEmit` clean. `pnpm build` green. Browser-verified at 800×830:
  before/after screenshots show the overlapping "OODPCVS 20/Window
  Handling/Night Penalty/..." text now rendering as clean stacked rows, no
  "Primary" chip on single selection, and the Guided-Edit pill collapsed to
  an icon clear of the selection task bar.
- Logged the jargon complaint as **Thread 154** in `EXPLORATION_MAP.md`
  ("Plain-language pass over dashboard/inspector copy") with candidate
  renames (K-Robustness, DORI Quality Distribution, OODPCVS 2025, Night
  Penalty Mode, Transmission, Budget blocked/guarded/ready) and an open
  question about dual-labeling (plain headline + technical term as secondary)
  vs. hiding technical terms behind tooltips entirely — deferred as its own
  pass since it's a copy audit across many files, not a layout fix.

### Next item

Thread 154 (plain-language copy pass) is the next-ranked item per Pranay's
most recent feedback — start with a small audit slice (Simulation
Assumptions card + Resilience/DORI section headers in the Analytics
dashboard) using the dual-label approach (plain headline, technical term as
a smaller secondary line or `ExplainBadge`), then expand file-by-file.
Otherwise, continue the Thread 146-153 batch (Threads 147, 149-153 remain) or
the live-feed half of A1.

## Addendum (2026-06-13, fourteenth pass): Plain-language copy pass, first slice (D-313)

- Implemented the first slice of Thread 154's dual-label pattern (plain
  headline + technical term as a smaller secondary label, never hidden):
  `BottomRow.tsx`'s `AssumptionRow` gained an optional `sublabel` prop
  (shown as `(sublabel)`, `hidden sm:inline`); `AnalyticsDashboardView.tsx`'s
  `SectionCard` gained an optional `subtitle` prop (smaller, non-uppercase,
  dimmer, next to the title).
- Renamed the eight "Simulation Assumptions" card rows: "Quality Model" →
  "Image quality" (sublabel "OODPCVS 2025"/"DORI 2014"), "Lighting Model" →
  "Indoor lighting", "Night Penalty" → "Night view" (sublabel "Night
  penalty"), "Window Handling" → "Windows", "Person Height" → "Person
  height", "Time of Day" → "Time of day", "Wall Height" → "Wall height",
  "Night Mode" → "Night mode". `AssumptionsPanel.tsx`'s editing-mode field
  labels were intentionally left as-is for this slice.
- Renamed "DORI Quality Distribution" → "What can you actually see?" (subtitle
  "DORI quality distribution") and "K-Robustness" → "Failure tolerance
  (k-robustness)" in the Resilience section, in `AnalyticsDashboardView.tsx`.
- `ContextRightPanel.tsx`'s collapsed "Simulation Assumptions" summary line
  ("IEC 62676-4:2025 · day · normal") rewritten to "Latest image standard
  (IEC 62676-4:2025) · day · normal light" / "Legacy image standard (DORI
  2014) · ..." — keeps the technical term as the dual-label parenthetical.
- `bun test` (from `apps/studio`) → 954/954 pass (no count change,
  copy-only). `tsc --noEmit` clean. `pnpm build` green. Confirmed via grep
  that "DORI Quality Distribution"/"K-Robustness" also appear in
  `security-analytics.ts`, `pdf-export.ts`, `coverage-regression.ts`,
  `report-analytics-export.ts` and their tests as the report/export
  pipeline's own independent section headings (D-305) — untouched, no
  conflict (`bun test` confirms). Browser-verified at 1280×900 ("WHAT CAN YOU
  ACTUALLY SEE? (DORI QUALITY DISTRIBUTION)" and "FAILURE TOLERANCE
  (K-ROBUSTNESS)" both render cleanly) and at 800×830 (the Simulation
  Assumptions card's new labels truncate gracefully with ellipsis in their
  ~102px column — single-line, no overlap, distinct from the D-312
  overlapping-text bug). See D-313 for full detail.
- **Caught during this slice:** the first attempt used longer labels ("Image
  quality standard", "Night-time estimate") with the sublabel always visible,
  which truncated to unreadable fragments ("Ima...", "Ni...") in the narrow
  Simulation Assumptions column. Fixed by shortening the labels and hiding
  the sublabel below `sm`.

### Next item

Continue Thread 154: `AssumptionsPanel.tsx`'s editing-mode field labels,
"Truth: Simulated", "Transmission" (glass material property), and "Budget
blocked/guarded/ready" (CommandBar telemetry chips — appears in 6+ files
including `WorkspaceCanvas.tsx`, `InspectorPanel.tsx`,
`SceneBuilderWizard.tsx` and several test files, so it needs its own audit
pass rather than a quick rename). Otherwise, continue the Thread 146-153
batch (Threads 147, 149-153 remain) or the live-feed half of A1.

## Addendum (2026-06-17, fifteenth pass): Confidence card, Thread 154 second slice (D-314)

### OverallConfidence card in MetricsTab (D-314a)

- `packages/simulation/src/confidence.ts`'s `formatConfidenceSummary` is now
  imported in MetricsTab via `@sentineltwin/simulation`.
- New `ConfidenceCard` component inline in `MetricsTab.tsx`: reads
  `(result as Record<string, unknown>).overallConfidence as ConfidenceBand |
  undefined` from the simulation result (the packages schema has it but the
  studio schema doesn't — accessed as a runtime value, not a typed field).
  Displays: level badge with color coding (verified/high/medium/low/none),
  `formatConfidenceSummary` narrative sentence, `sensitiveTo` input chips,
  and `reasonCodes` as smaller dim chips. Has `TruthBadge label="simulated"`.
- `CONFIDENCE_LEVEL_STYLE` map added with five levels and distinct colors.
- Two new surfaces added to `TRUST_AUDIT_SURFACES` in `truth-audit.ts`:
  - `"Scenario comparison panel truth badge"` — checks `ScenarioComparisonPanel.tsx`
    has `TruthBadge`, `label="simulated"`, `runScenarioComparison`,
    `runAssumptionSensitivity`.
  - `"Metrics confidence card wiring"` — checks `MetricsTab.tsx` has
    `ConfidenceCard`, `overallConfidence`, `formatConfidenceSummary`.

### Thread 154 second slice — operator-language copy pass (D-314b)

- `AssumptionsTab.tsx`:
  - "Night Penalty Mode" → "Night-time visibility" (with `(Night Penalty Mode)` dimmed sublabel)
  - Night mode button values: "none/simple/detailed" → rendered as "Off / Basic / Full model"
  - Coverage Standard buttons: "DORI 2014" → "2014 (legacy)", "IEC 62676-4:2025 (OODPCVS)" → "2025 (latest)"
  - "Quality Thresholds (px/m)" → "Resolution thresholds (px/m)"
  - "Standard-defined IEC 62676-4:2025 (7 levels)" → "Levels from IEC 62676-4:2025"
- `WallInspector.tsx`: `label="Transmission"` → `label="Light through (%)"`
- `DoorWindowInspector.tsx`: `label="Transmission"` → `label="Light through (%)"`
- `ObstructionInspector.tsx`: `label="Vision Transmission"` → `label="Camera sees through"`
- `CommandBar.tsx`:
  - Collapsed chips: "Healthy/Partial/Blocked" → "AI online/AI partial/AI offline"
  - Collapsed chips: "Budget ready/guarded/blocked" → "AI ready/AI limited/AI paused"
  - Expanded panel: "Provider healthy/partial/blocked" → "AI online/AI partial/AI offline"
  - Expanded panel: "Budget ready/guarded/blocked" → "AI ready/AI limited/AI paused"
- `truth-audit.ts`:
  - `"AI command provider health"` surface updated to check new labels ("AI ready", "AI limited", "AI online")
  - `"Workspace control-plane persistence route"` surface corrected: removed stale `normalizeWorkspaceAccessState` check (function lives in `workspace-identity-conflict/route.ts`, not `workspace-control-plane/route.ts`)
- `view-mode-bar.test.ts`: fixed pre-existing assertion mismatch — test expected `aria-pressed={viewMode === mode}` but `ModeButton` receives an `active` bool prop and renders `aria-pressed={active}`.

**Verification:** `bun test` (from `apps/studio`) → 1031/1031 pass (includes 5 new truth-audit checks).
`tsc --noEmit` clean. No schema change (Rule 5 clean).

### A1 live-feed fusion — "Observed vs Planned" card (D-315)

Implemented 2026-06-17.

- New pure module `src/lib/observed-vs-planned.ts`:
  - `ObservedVsPlannedReport` interface composing `CameraDriftEntry[]` + `LiveHealthEntry[]` + summary
  - `buildObservedVsPlannedReport(cameraDriftReport | null, liveHealth)` → derived `statusLabel`: "On plan" / "Minor deviations" / "Critical deviation"
- Tests: `src/lib/__tests__/observed-vs-planned.test.ts` — 12 tests, all pass
- `AnalyticsDashboardView.tsx`:
  - Removed separate "Camera Drift" `SectionCard` and "Live Operations" `SectionCard`
  - Added single "Observed vs Planned" `SectionCard` using `observedVsPlannedReport` useMemo
  - Status badge (green/amber/red) driven by `summary.statusLabel`
  - Two gated sub-sections: "Design drift" (from `driftEntries`) and "Live faults" (from `liveAlerts`)
  - Gate: `observedVsPlannedReport.hasData` (true when drift entries OR live alerts OR tracked nodes > 0)
  - Removed unused `Radio` Lucide import
- `truth-audit.ts`: Added "Observed vs Planned fusion card" surface; `forbiddenPhrases: ["Live Operations"]` guards against re-introducing the old card
- `tsc --noEmit` clean; all tests pass

### Thread 154 close-out (D-316)

Implemented 2026-06-17.

- `AnalyticsDashboardView.tsx` header subtext: `"Truth: Simulated · deterministic engine output"` → `"Simulation results · geometry-based, not from live feeds"` — plain operator language, trust signal preserved
- Audited `WorkspaceCanvas.tsx`, `InspectorPanel.tsx`, `SceneBuilderWizard.tsx` for stale "Budget blocked/guarded/ready" telemetry strings — **none found**. All "Budget" references in those files are the unrelated `CoverageBudget` / `maxBudget` domain concepts. Thread 154 is fully closed.

### Thread 148: Director's Cut PDF export (D-317)

Implemented 2026-06-17.

- `src/lib/pdf-export.ts`:
  - Added `exportDirectorsCutPdf({ scene, sequence, includeTimestamp? })` — async jsPDF generator
  - Cover page: scene name, gap % headline (color-coded: green/amber/red by severity), path metadata
  - Page 2: 6-cell summary card grid (total duration, gap time/%, well-framed time, segments, gap windows, cameras used)
  - Cut Sequence table: color-coded rows by grade (no_coverage=red, out_of_frame=amber, well_framed=green)
  - Coverage Gap Windows section: only rendered when gaps exist; describes unobserved path windows with position coordinates
  - Filename: `{scene_name}_directors_cut.pdf`
- `src/components/view/AnalyticsDashboardView.tsx`:
  - Extracted `DirectorsCutCard` component with `action` prop wired to export button
  - "Export PDF" button: async, disabled while exporting, shows "Exporting…" spinner text
  - `subtitle="incident replay"` on `SectionCard` (plain-language per Thread 154)
  - Added `Download` Lucide icon, `exportDirectorsCutPdf` import
- `src/lib/__tests__/directors-cut-export.test.ts`: 9 tests verifying export function presence, cover content, table structure, grade coverage, dashboard wiring
- `truth-audit.ts`: "Director's Cut PDF export" surface added
- `tsc --noEmit` clean; 1050/1051 tests pass (1 pre-existing env-key failure unrelated to this work)

### Thread 147/149/152 audit and hardening (D-318)

Implemented 2026-06-22.

Audit confirmed Threads 147 (crowd sim), 149 (perimeter integrity), and 152 (access control) were already fully implemented in a prior session:
- `packages/simulation/src/crowd-sim.ts` — Poisson-process crowd occlusion engine (8 tests passing)
- `packages/simulation/src/simulate-studio.ts` — calls `computeCrowdOcclusion` + `computePerimeterIntegrity`; `accessControlBarriers` wired in adversarial path
- `apps/studio/src/components/inspector/CrowdProfileEditor.tsx` — crowd profile editor in ScheduleEditor
- `AnalyticsDashboardView.tsx` — Crowd Impact, Perimeter Integrity, and Access Control cards all render from simulation result

Hardening pass:
- Thread 154 operator-language: "dynamic occlusion model" → "people blocking camera views" (Crowd Impact subtitle)
- Thread 154 operator-language: "Access Control on Adversarial Route" / "doors the attacker must breach" → "Access Control on Route" / "barriers the intruder must pass"
- Added missing `TruthBadge label="simulated"` to Access Control card
- Added trust-audit surfaces: "Perimeter Integrity analytics card" and "Access Control on adversarial route card"

### Next item

- Thread 151 (audio layer — PA/gunshot/glass-break) — research-stage, needs domain validation before commitment per EXPLORATION_MAP
- Thread 150 (VR walkthrough) — gated on C8 (first-person walk mode)
- Thread 153 (event/temporary site) — go-to-market packaging decision, low technical risk
- Pre-existing `tsc` errors in `camera-preset-utils.ts:502` (thermalCapable) and `SharedScene.tsx:645` (rotation on CylinderGeometry) — unrelated to Threads 147-154
