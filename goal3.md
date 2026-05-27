Below is the repo audit from the lens of: **“From the planned SentinelTwin product areas, what is actually done, what is incomplete, what is hidden/demoware, and what should an agent fix next?”**

I am basing this on direct repo reads through GitHub, not runtime execution.

---

# Executive verdict

**SentinelTwin is currently a serious Camera Studio / Camera Coverage Testbed, not yet the full AI Security Digital Twin product.**

The core testbed is real: schema, simulation, coverage engine, DORI-like quality, path replay, report-lite, compare view, local scene JSON, camera view, and camera wall are present.

But the larger product modes we discussed — **Scan-first mode, AI layout draft, true floor-plan import, real camera footage verification, multi-model CV pipeline, project onboarding, and client audit workflow** — are either missing, partial, or hidden as docs/prototypes.

The app root directly renders `StudioShell`, and the comment explicitly says: **“Camera Studio — opens directly into the loaded testbed. No landing page.”**  That explains why every server start still looks like the camera testbed.

---

# Status matrix: done vs incomplete vs not done

## 1. App shell / routing / product entry

### Status: **Poor/incomplete from product perspective**

What is done:

The app has a working `StudioShell` with multiple internal modes: map, camera view, camera wall, replay, compare. `WorkspaceArea` switches between `WorkspaceCanvas`, `CameraWallView`, `CameraViewMode`, `PathReplayView`, and `CompareView`. 

Keyboard shortcuts also switch modes 1–5. 

What is missing:

There is no visible product entry like:

* New Project
* Audit Existing Setup
* Design New Setup
* Import Floor Plan
* Guided Scan
* Attach Camera Footage
* Generate Client Report

The product starts inside the testbed. This is why the rest of SentinelTwin feels absent.

**Verdict:** Good internal shell, bad product onboarding.

---

## 2. Camera Coverage Testbed

### Status: **Mostly done / strongest part**

What is done:

The schema has strong camera modeling: position, yaw, pitch, roll, mount type, FOV, range, resolution, lens type, status, night mode, IR range, thermal, PTZ, clarity, notes, tags. 

The coverage engine does real deterministic work:

* uses Three.js,
* uses `three-mesh-bvh`,
* builds vision geometry,
* checks FOV,
* checks range,
* raycasts occlusion,
* applies material/lighting/clarity penalties,
* maps to quality labels.  

This is not fake UI. This is the core product engine.

What is incomplete:

Some simulation assumptions are still arbitrary and should be documented/calibrated. Previous code review already called out lighting penalty constants like `0.12`, `0.32`, `0.18`, `0.88`, etc. as undocumented assumptions that could affect report claims. 

There are also known model-quality issues like hardcoded 16:9 fallback for resolution width. 

**Verdict:** The camera testbed is the best-built part. It now needs calibration, cleanup, and product framing.

---

## 3. Scene schema / SecurityScene model

### Status: **Done well**

What is done:

The data model supports:

* walls,
* doors,
* windows,
* cameras,
* lights,
* obstructions,
* critical zones,
* privacy zones,
* entry points,
* paths,
* simulation assumptions,
* results,
* recommendations,
* blind regions,
* temporal profiles.

Critical zones include required quality, target type, night requirement, redundancy requirement, and privacy flag. 

Simulation results include coverage cells, critical zone results, camera results, path results, issues, recommendations, adversarial path, blind regions, and thresholds. 

What is incomplete:

Schema is ahead of UI. Many concepts exist in types but are not visible as clean product flows.

**Verdict:** Strong foundation. The app has not caught up with its own model.

---

## 4. Map editor / scene editing tools

### Status: **Partial**

What is done:

The left panel includes tools for:

* select,
* camera,
* obstruction,
* light,
* path,
* zone,
* door/window,
* wall,
* measure,
* comment. 

It also has layer toggles for cameras, cones, obstructions, lights, critical zones, privacy zones, paths, heatmap, grid, walls/floors, labels. 

What is incomplete:

The existence of a tool button does not mean each tool is fully production-grade. The repo needs a tool-by-tool audit:

* Can each tool place objects correctly?
* Are properties editable?
* Does undo/redo work?
* Does simulation recompute correctly?
* Does save/export preserve them?
* Are wall/door/window/measure/comment tools actually complete?

**Verdict:** Tool surface exists, but likely uneven. Needs interaction QA.

---

## 5. Camera view mode

### Status: **Substantially done**

What is done:

`CameraViewMode` has simulated live feed concepts: camera feed mode, overlay flags, DORI range overlay, target type labels, timestamp, camera name, resolution/FOV badge, night/IR/thermal visual modes, replay actor, and feed HUD.  

What is incomplete:

Needs runtime verification that it updates correctly when camera parameters change. Earlier code review flagged stale camera feed behavior in a different `CameraFeedCanvas` area. 

**Verdict:** Much better than a stub, but needs interaction testing.

---

## 6. Path replay / incident replay

### Status: **Substantially done**

What is done:

`PathReplayView` renders a replay scene, coverage heatmap, path actor, path markers, visibility timeline, and path collision/legalization logic.  

The schema also supports path timeline events with visible/lost/quality-change events and per-camera quality. 

What is incomplete:

This is still a simulation replay, not real incident reconstruction from footage. It needs clearer defensive language and UI copy so it does not feel like “avoid cameras” tooling.

**Verdict:** Good V0.1 incident/path replay foundation. Not V0.5 real video verification.

---

## 7. Compare / before-after

### Status: **Mostly done as demoware**

What is done:

`CompareView` has scenario selection, two scene panels, metrics, coverage/recognition/blindspot/critical-zone/path-visibility deltas, quality trend, issue notes, and recommendations.  

What is incomplete:

The compare scene panels appear to use the current scene geometry while feeding different coverage cells from snapshots. In `ScenePanel`, it reads `const scene = useStudioStore((s) => s.scene)` instead of rendering the snapshot’s own scene. 

That can visually desync before/after if the obstruction/camera layout changed. The heatmap may differ, but geometry may not.

**Verdict:** Feature exists, but visual truth may be compromised. Needs fix.

---

## 8. Report-lite / audit report

### Status: **Partial but useful**

What is done:

`ReportLiteTab` can:

* build default markdown from simulation,
* generate AI report,
* copy report,
* export HTML,
* print report. 

Default markdown includes assumptions, summary metrics, issues, zones needing hardening, action plan, recommendations, and limitations. 

What is incomplete:

It is still a “report-lite” panel. Missing production-grade pieces:

* screenshot/render export,
* before/after visuals in report,
* client branding,
* audit metadata,
* assumption disclaimer prominence,
* PDF export,
* issue evidence links back to scene objects,
* report state persistence.

**Verdict:** Better than stub, not yet client-ready audit product.

---

## 9. AI command / AI reports / counterfactuals

### Status: **Partial and OpenAI-only**

What is done:

`use-ai-command` parses commands, applies scene operations, supports moving/rotating cameras, changing FOV, toggling cameras/lights, moving/resizing/rotating obstructions, adding lights, setting time of day, saving snapshots, generating report, and running adversarial mode. 

It also proposes counterfactuals, applies them to a cloned scene, runs simulation, and calculates verified deltas. 

What is incomplete:

The runtime provider is hardcoded to `new OpenAIProvider()`. 

`OpenAIProvider` defaults to `gpt-4o` and uses Chat Completions.  

This does not yet match our planned model-agnostic architecture with Gemini/Qwen/MiniCPM/SAM/Depth/VGGT/SpatialLM experiments.

**Verdict:** AI command layer exists. Model-agnostic AI pipeline does not.

---

## 10. Floor-plan import

### Status: **Poor/incomplete**

What is done:

There is a `SceneBuilderWizard` with blank/template/floor-plan import method. 

There is a heuristic `floor-plan-import.ts` module using Canvas, grayscale, edge detection, wall tracing, openings, dimensions, and confidence. It explicitly says it is heuristic, not ML. 

What is incomplete / bad:

When floor-plan import succeeds, the wizard does **not** actually convert extracted walls/doors/windows into the scene. It creates a small retail shop base scene, changes name/dimensions/source, and stops. 

That is the biggest concrete product gap.

**Verdict:** Floor-plan upload exists as a prototype parser, but the feature is not functionally complete.

---

## 11. Guided scan-first mode

### Status: **Not done**

The original plan said scan-first should be the hero: user taps wall, door, cupboard, cash counter, existing camera, window, etc.; each tap segments/classifies, estimates 3D size/position, adds to scene, and asks for confirmation. 

Current repo has no real phone-camera guided scan flow, no segmentation pipeline, no object tap-to-mask, no depth estimate, no guided turn/rotate capture, no scan confirmation flow.

**Verdict:** Not implemented.

---

## 12. Real camera footage verification

### Status: **Not done**

The project roadmap says V0.5 is “Real Camera Snapshot/Video Verification.” 

Current repo has simulated camera views, not actual uploaded CCTV screenshot/video comparison.

Missing:

* attach footage to camera,
* detect landmarks,
* compare simulated vs actual view,
* estimate misalignment,
* detect obstructions/blur/night quality,
* produce verification report.

**Verdict:** Not implemented.

---

## 13. Docs/status honesty

### Status: **Poor/inconsistent**

Root README is high-level and says this is an in-progress studio workflow. That is honest enough. 

But `apps/studio/README.md` is still generic create-next-app text. 

Also, one phase doc says **Status: Complete (2026-05-29)**, which is future-dated relative to today, May 27, 2026. 

**Verdict:** Docs need a “current truth” pass immediately.

---

# What I would assign to an agent now

## Agent task: “Make SentinelTwin honest, navigable, and product-flow ready”

This agent should **not** try to build guided scan, real footage verification, or a new AI pipeline yet. The best next task is to fix the gap between “only camera testbed appears” and “larger product exists.”

This task should make the current repo clearly show:

1. what works,
2. what is partial,
3. what is not started,
4. how users enter the right workflow,
5. how floor-plan import becomes a real first non-testbed feature.

---

# Detailed task for agent

## Title

**SentinelTwin Product Entry + Status Audit + Floor-Plan Import Bridge**

## Mission

Turn the current `apps/studio` app from a hidden camera testbed into a truthful product shell that exposes SentinelTwin’s current capabilities and clearly marks future modes. Then make the existing floor-plan import path actually create scene geometry instead of only changing demo scene dimensions.

## Hard constraints

* Follow `motto_v2`.
* Work from long-term product truth, not hackathon shortcuts.
* Do not overclaim features.
* Do not introduce fake “done” flows.
* Do not run mutating git commands. Read-only git commands are okay only if needed, such as `git status`, `git diff`, `git branch -vv`, `git log`, `git show`.
* Do not rewrite unrelated files.
* Keep simulation truth separate from visual decoration.
* Do not add live CCTV/RTSP/ONVIF.
* Do not build guided scan in this task.
* Do not add new paid/cloud AI dependencies for floor-plan import.

---

## Files to inspect first

Start by reading these files carefully:

```txt
README.md
apps/studio/README.md
apps/studio/src/app/page.tsx
apps/studio/src/components/layout/StudioShell.tsx
apps/studio/src/components/layout/TopBar.tsx
apps/studio/src/components/scan-to-scene/SceneBuilderWizard.tsx
apps/studio/src/lib/floor-plan-import.ts
apps/studio/src/schema/security-scene.ts
apps/studio/src/store/studio-store.ts
apps/studio/src/demo-scenes/small-retail-shop.ts
apps/studio/src/lib/scene-templates.ts
apps/studio/src/components/view/CompareView.tsx
apps/studio/src/components/bottom-panel/ReportLiteTab.tsx
Docs/context/origin/project_brief_summary.md
Docs/todos/PHASE_6_DEMOWARE.md
Docs/decisions/CODE_QUALITY_REVIEW_2026-05-26.md
```

---

## Deliverable 1: Add truthful status documentation

Create or update a repo-level status doc:

```txt
CURRENT_STATUS.md
```

It should include:

```txt
# SentinelTwin Current Status

## Currently implemented
- Camera Studio / map view
- Scene schema
- Coverage simulation
- DORI/OODPCVS-like quality scoring
- Critical zones
- Path replay
- Camera view
- Camera wall
- Compare snapshots
- Report-lite
- Local JSON import/export
- AI command prototype

## Partial / incomplete
- Floor-plan import
- Scene builder wizard
- Camera presets
- Assumptions editing
- Redundancy / temporal / threat panels
- Report export
- Compare visual truth
- AI counterfactual UX

## Not started
- Guided scan-first mode
- Object segmentation
- Depth estimation
- Multi-photo reconstruction
- Real camera footage verification
- Multi-model provider runtime
- Project dashboard
- Full client audit workflow

## Known limitations
- Simulation assumptions are approximate.
- Lighting constants are heuristic.
- Report output is planning guidance, not forensic/legal proof.
- Floor-plan import is heuristic and requires review.
```

Also update `apps/studio/README.md` to remove the default create-next-app content and explain the actual app.

Acceptance criteria:

* No default Next.js boilerplate remains in `apps/studio/README.md`.
* A new developer can understand what runs, what works, and what is incomplete.

---

## Deliverable 2: Add product launcher / mode chooser

Currently `page.tsx` goes directly to `StudioShell`. Keep that option, but add a launcher screen or modal before the studio.

Possible implementation:

```txt
apps/studio/src/components/product/ProductLauncher.tsx
```

Launcher cards:

1. **Open Camera Studio**

   * Status: Available
   * Action: enters existing `StudioShell`

2. **Import Floor Plan**

   * Status: Preview
   * Action: opens `SceneBuilderWizard` in floor-plan mode

3. **Start Blank Scene**

   * Status: Available
   * Action: creates blank scene and opens Studio

4. **Use Demo Retail Shop**

   * Status: Available
   * Action: loads current demo and opens Studio

5. **Guided Site Scan**

   * Status: Not started
   * Disabled with explanation: “Planned: tap walls/doors/cameras from phone capture.”

6. **Verify Real Camera Footage**

   * Status: Not started
   * Disabled with explanation: “Planned: compare real footage with simulated view.”

7. **AI Layout Draft**

   * Status: Not started/Planned
   * Disabled or prototype-only if no implementation exists.

This directly fixes the user confusion: the other parts become visible, but not falsely advertised.

Acceptance criteria:

* User no longer lands blindly inside the testbed without context.
* User can still open the existing studio quickly.
* Not-started features are visibly marked as not started.
* No fake routes that pretend to work.

---

## Deliverable 3: Make floor-plan import actually create scene geometry

Current problem:

In `SceneBuilderWizard`, floor-plan import does this:

```ts
const base = createSmallRetailShopScene();
base.name = state.roomName;
base.dimensions = ...
base.source = "floor_plan_import";
scene = base;
```

That means the parsed floor-plan result is mostly ignored. 

Fix it by adding a converter:

```txt
apps/studio/src/lib/floor-plan-to-scene.ts
```

Suggested function:

```ts
export function floorPlanResultToSecurityScene(
  result: FloorPlanResult,
  options: {
    name: string;
    heightM: number;
  }
): SecurityScene
```

It should:

* create a new `SecurityScene`,
* set dimensions from `result.roomDimensions`,
* convert `result.walls` into `WallNode[]`,
* convert `result.doors` into `DoorNode[]`,
* convert `result.windows` into `WindowNode[]`,
* leave cameras/lights/obstructions/zones/paths empty,
* set source to `"import"` or existing schema-supported source,
* add assumptions using existing defaults,
* validate with `parseSecurityScene` / `safeParseSecurityScene`.

Important:

The current schema source enum is:

```ts
"manual" | "ai" | "scan" | "import" | "preset" | "demo"
```

So do **not** use invalid source strings like `"floor_plan_import"` unless the schema is updated consistently. The existing wizard currently uses `"floor_plan_import"` which does not match the schema source enum. 

Acceptance criteria:

* Uploading a floor-plan image produces walls in the scene.
* The resulting scene validates against `SecurityScene`.
* The scene starts with no fake retail-shop cameras/shelves unless user selected a template.
* The import review shows detected wall count, door count, window count, confidence, dimensions, and warnings.
* Low-confidence results clearly warn the user.
* The import path does not silently create a retail shop demo.

---

## Deliverable 4: Fix compare visual truth

Current issue:

`CompareView.ScenePanel` reads the current store scene:

```ts
const scene = useStudioStore((s) => s.scene);
```

rather than rendering each snapshot’s scene. 

That means scenario A/B can visually show the wrong geometry if object/camera positions changed between snapshots.

Fix:

* `ScenePanel` should accept a `scene` prop.
* Render `snapshotA.scene` in panel A.
* Render `snapshotB.scene` in panel B.
* Use that scene’s dimensions/walls/doors/windows/obstructions.
* Keep heatmap cells tied to that snapshot’s simulation.

Acceptance criteria:

* Baseline panel renders baseline geometry.
* Proposed panel renders proposed geometry.
* Moving an obstruction and saving a snapshot visibly changes geometry in comparison.
* Heatmap and geometry stay aligned.

---

## Deliverable 5: Fix docs/status mismatch

Review docs that claim completed work.

Specifically:

```txt
Docs/todos/PHASE_6_DEMOWARE.md
```

It says `Status: ✅ Complete (2026-05-29)`, which is future-dated relative to today. 

Agent should either:

* change status to “Planned / In progress / Needs verification,” or
* add a note that it is a target plan, not verified completed status.

Acceptance criteria:

* No future-dated “complete” claims remain unless justified by actual date context.
* Docs distinguish implemented vs planned vs aspirational.

---

## Deliverable 6: Add a visible “feature status” surface in the app

Add a small status/help panel, maybe under top bar “More” menu:

```txt
Product Status
```

It should show:

```txt
Available:
- Camera Studio
- Coverage simulation
- Path replay
- Camera view
- Compare
- Report-lite

Preview:
- Floor-plan import
- AI commands
- Counterfactual suggestions

Planned:
- Guided scan
- Real camera footage verification
- AI layout draft
- Multi-model CV pipeline
```

This helps prevent user confusion and aligns the product with reality.

Acceptance criteria:

* User can see what is done/not done from inside the app.
* The wording does not oversell planned features.

---

# Testing / verification instructions for agent

The agent should run whatever test commands already exist for the app, but should not use mutating git commands.

From `apps/studio/package.json`, scripts include:

```json
"dev": "next dev --webpack",
"build": "next build --webpack",
"lint": "eslint",
"test": "bun test"
```



Agent should verify:

```txt
bun test
bun run lint
bun run build
```

or equivalent from the correct workspace/package manager setup.

Also manually verify in browser:

1. Launcher appears.
2. Open Camera Studio works.
3. Demo retail shop still loads.
4. Blank scene works.
5. Floor-plan import creates actual walls.
6. Imported scene can run simulation.
7. Imported scene can be exported/imported as JSON.
8. Compare view uses snapshot-specific geometry.
9. Report-lite still works.
10. Not-started features are disabled/clearly marked.

---

# What agent should not do in this task

Do **not** build:

* phone guided scanning,
* SAM segmentation,
* Depth Anything,
* VGGT,
* SpatialLM,
* real CCTV upload,
* ONVIF/RTSP,
* authentication,
* project database,
* PDF engine,
* multiplayer/collaboration,
* camera marketplace/spec scraping.

Those are later tasks. This task is about making the repo honest, navigable, and product-flow ready.

---

# Suggested agent prompt

You can give another agent this directly:

```txt
You are working on pranaysuyash/SentinelTwin.

Follow motto_v2 and long-term product correctness. Do not run mutating git commands. Read-only git commands are allowed only for inspection. Do not use git checkout/reset/restore/clean/add/commit/rebase/merge or similar.

Task: Make SentinelTwin honest, navigable, and product-flow ready.

Problem:
The app currently opens directly into the Camera Coverage Testbed via apps/studio/src/app/page.tsx -> StudioShell. This makes users think only the camera testbed exists. The repo has many planned product areas in docs, but the running app does not expose them truthfully. Floor-plan import is especially incomplete: SceneBuilderWizard processes a floor plan but then creates createSmallRetailShopScene(), changes dimensions/name/source, and ignores extracted wall geometry.

Goals:
1. Add/update CURRENT_STATUS.md at repo root with implemented, partial, and not-started feature status.
2. Replace apps/studio/README.md default create-next-app text with real SentinelTwin Studio setup/status docs.
3. Add a product launcher / mode chooser before StudioShell or as an initial modal:
   - Open Camera Studio: available
   - Use Demo Retail Shop: available
   - Start Blank Scene: available
   - Import Floor Plan: preview
   - Guided Site Scan: planned/not started
   - Verify Real Camera Footage: planned/not started
   - AI Layout Draft: planned/not started
   Planned features must be disabled or clearly marked. Do not fake implementation.
4. Make floor-plan import create actual SecurityScene walls/doors/windows from FloorPlanResult instead of creating a small retail shop demo. Add a converter such as apps/studio/src/lib/floor-plan-to-scene.ts.
5. Ensure floor-plan-created scenes validate against security-scene schema. Use valid source enum values only: manual, ai, scan, import, preset, demo.
6. Fix CompareView visual truth: ScenePanel must render snapshotA.scene and snapshotB.scene, not the current global scene for both panels.
7. Fix future-dated or misleading docs, especially Docs/todos/PHASE_6_DEMOWARE.md if it claims complete status without verified current truth.
8. Add an in-app Product Status surface listing Available / Preview / Planned features.

Acceptance criteria:
- Existing Camera Studio still works.
- User no longer lands blindly into a testbed without product context.
- Floor-plan import produces scene walls from detected wall segments.
- Imported floor-plan scene does not contain fake retail shop cameras/shelves unless user selected a template.
- Compare view shows geometry from each selected snapshot, not current scene for both sides.
- README and CURRENT_STATUS clearly explain what is done, partial, and not started.
- No planned feature is presented as working.
- bun test, lint, and build pass from the appropriate workspace.
- Keep changes focused and do not rewrite unrelated architecture.
```

My recommendation: give this task to the next agent before any “cool AI scan” work. It will make the whole repo much easier to reason about and will stop the repeated confusion that the project is “only the camera testbed.”
