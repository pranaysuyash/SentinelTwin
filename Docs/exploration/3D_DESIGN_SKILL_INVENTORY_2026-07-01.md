# 3D Design Skill Inventory — SentinelTwin Applicability

**Date:** 2026-07-01  
**Scope:** Inventory and evaluate all agent-discoverable 3D-design-related skills across the workspace, then map the most relevant ones to SentinelTwin's rendering pipeline needs.  
**Trigger:** User asked to find 3D design skills, evaluate one, then run multi-agent evaluation and document everything.  
**Motto compliance:** `motto_v3.md` reviewed and attested before changes; documentation treated as first-class delivery; no code or git mutations performed.  

---

## 1. What We Did

1. Searched all configured skill locations under `/Users/pranay` for 3D-related skills.
2. Installed two external skill packs requested by the user:
   - `npx threejs-awesome-graphics-agent-skills@latest install --agent codex` → 22 skills in `~/.codex/skills`
   - `npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a codex -g -y` → 9 skills in `~/.agents/skills`
3. Dispatched 4 parallel agents to evaluate skill sets against SentinelTwin:
   - Vanilla Three.js foundational skills (`threejs-skills` + subskills)
   - R3F/Drei production stack (`r3f-drei`, `threejs-performance`)
   - Game-skills pack (`majidmanzarpour/threejs-game-skills`, 9 skills)
   - Procedural/graphics agent skills (`threejs-awesome-graphics-agent-skills`, 22 skills)
4. Synthesized findings into this report and an `EXPLORATION_MAP.md` thread.

---

## 2. Skills Discovered by Location

### 2.1 `~/.opencode/skills/` (26 skills)
```
2d-games, 3d-games, 3d-web, 3d-web-experience
blender-3d-modeling, blender-mcp
game-design, game-development, game-testing
headed-chrome-3d-testing
llm-blender-agent
mobile-games, pc-games
shader-programming-glsl
spline-3d-integration
threejs (router) + threejs-animation, fundamentals, geometry, interaction, lighting, loaders, materials, postprocessing, shaders, textures
web-games, webgl, webgpu
```

### 2.2 `~/.agents/skills/` (26 base + 9 newly installed)
Same base set plus:
```
threejs-3d-generator, threejs-aaa-graphics-builder, threejs-audio-generator
threejs-debug-profiler, threejs-game-director, threejs-game-ui-designer
threejs-gameplay-systems, threejs-image-generator, threejs-qa-release
```

### 2.3 `~/.codex/skills/` (26 base + 22 newly installed + 9 from game-skills)
Same base plus 22 procedural/graphics skills:
```
threejs-atmosphere-aerial-perspective, threejs-bloom, threejs-camera-direction
threejs-exposure-color-grading, threejs-image-pipeline
threejs-procedural-animation, threejs-procedural-architecture, threejs-procedural-fields
threejs-procedural-geometry, threejs-procedural-materials, threejs-procedural-planets
threejs-procedural-vegetation, threejs-procedural-vfx
threejs-raymarched-space-effects, threejs-screen-space-ambient-occlusion
threejs-shadow-systems, threejs-skill-router
threejs-spectral-ocean, threejs-temporal-surfaces
threejs-visual-validation, threejs-volumetric-clouds, threejs-water-optics
```
plus the 9 game skills above.

### 2.4 `~/.hermes/skills/` (28 skills)
Same base plus `3d-web-interactive`, `ai-3d`, `ai-games`.

### 2.5 `~/Projects/external-skills/` (40+ community skills)
Includes `market-sickn33__antigravity-awesome-skills` and `market-davila7__claude-code-templates-cli-tool-components-skills` mirrored 3D/game skills.

---

## 3. Skill-by-Skill Applicability for SentinelTwin

### 3.1 Highest Relevance — Use Now or Soon

| Skill | Location | Why It Fits SentinelTwin |
|---|---|---|
| `r3f-drei` | `~/.opencode/skills/r3f-drei/` | Project already uses R3F v9.6 / Drei v10.7. Direct mapping to Canvas setup, `useFrame`, `useThree`, `<Instances>`, `<Html>`/`Billboard`/`Text`, `PerformanceMonitor`, `AdaptiveDpr`, `OrbitControls`. |
| `threejs-performance` | `~/.opencode/skills/threejs-performance/` | Budgets, profiling, instancing, merge/batch, DPR cap, auto-degrade, LOD, texture strategy, disposal. Critical for multi-canvas Camera Wall. |
| `threejs-fundamentals` | `~/.opencode/skills/threejs/threejs-fundamentals/` | Scene graph, camera math, layers, instancing, LOD, resize, disposal. Foundation for coverage engine viewer. |
| `threejs-geometry` | `~/.opencode/skills/threejs/threejs-geometry/` | Frustum/cone geometry, custom `BufferGeometry`, `Points`, `InstancedMesh`. Core for camera coverage cones and heatmap points. |
| `threejs-shaders` | `~/.opencode/skills/threejs/threejs-shaders/` | DORI overlays, heatmap colorization, custom uniforms. Needed for distance-based quality rings. |
| `threejs-interaction` | `~/.opencode/skills/threejs/threejs-interaction/` | Raycasting for occlusion tests, object selection, screen/world transforms. Used by coverage engine. |
| `threejs-animation` | `~/.opencode/skills/threejs/threejs-animation/` | Path replay actor via `AnimationClip`/`AnimationMixer`. Must be adapted to Framer Motion per D-018. |
| `threejs-visual-validation` | `~/.codex/skills/threejs-visual-validation/` | Deterministic regression protocol: baselines, seed sweeps, GPU budgets. Matches SentinelTwin's need for explainable, reproducible coverage visualization. |
| `threejs-procedural-animation` | `~/.codex/skills/threejs-procedural-animation/` | Semantic state, frame-rate-independent replay, deterministic seeds — directly applicable to authorized incident replay. |
| `threejs-procedural-geometry` | `~/.codex/skills/threejs-procedural-geometry/` | Production mesh emission for camera housings, mounts, frusta, occluders. |
| `threejs-skill-router` | `~/.codex/skills/threejs-skill-router/` | Meta-skill that prevents defaulting to bloom/VFX for "make it look better" requests. Keeps work scoped to deterministic security visualization. |
| `threejs-debug-profiler` | `~/.agents/skills/threejs-debug-profiler/` | Blank canvas checklist, performance profiling, mobile input. Domain-agnostic and valuable. |
| `threejs-qa-release` | `~/.agents/skills/threejs-qa-release/` | Playwright canvas inspector (`inspect-threejs-canvas.mjs`) adaptable into `tools/webwright`. |

### 3.2 Medium Relevance — Selective Use

| Skill | Notes |
|---|---|
| `threejs-procedural-architecture` | Could speed up facility generation; must be evaluated against existing Pascal primitives. |
| `threejs-procedural-materials` | Useful for professional PBR materials; ignore exotic lava/embers examples. |
| `threejs-exposure-color-grading` | Helps day/night temporal simulation consistency; must avoid stylization. |
| `threejs-camera-direction` | Useful for view-mode handoffs (Map/Camera/Wall/Replay), not cinematic chase rigs. |
| `threejs-shadow-systems` | Relevant for site-scale day/night shadows; overkill for small interior rooms. |
| `threejs-screen-space-ambient-occlusion` | Can improve depth perception; adds cost and must keep no-post baseline. |
| `threejs-image-pipeline` | Only if multiple image-space systems need coordination. Risk of over-engineering. |
| `threejs-aaa-graphics-builder` | Visual scorecard and material libraries transfer well; ignore hero/player/game framing. |
| `threejs-game-ui-designer` | HUD/responsive/safe-area patterns transfer to security overlays; reframe game-state language. |
| `threejs-3d-generator` | Optional Tripo-based hero security assets (cameras, housings). |
| `threejs-image-generator` | Optional Gemini textures/icons/decals. |
| `blender-3d-modeling`, `blender-mcp`, `llm-blender-agent` | Useful if we ever generate or edit 3D assets in Blender. |
| `spline-3d-integration` | If we embed Spline scenes in marketing or UI. |

### 3.3 Low / No Relevance — Skill Bloat to Remove

| Skill | Why Not Relevant |
|---|---|
| `threejs-procedural-planets` | No planets in facility security. |
| `threejs-spectral-ocean` | No ocean simulation needed. |
| `threejs-water-optics` | Decorative water effects. |
| `threejs-volumetric-clouds` | Game weather; expensive and distracting. |
| `threejs-raymarched-space-effects` | Black holes/wormholes — pure spectacle. |
| `threejs-procedural-vfx` | Sparks/shockwaves — SFX-first. |
| `threejs-temporal-surfaces` | Touch-history frost — decorative. |
| `threejs-procedural-fields` | Terrain/vegetation masks; only if outdoor campuses. |
| `threejs-procedural-vegetation` | Landscaping; not core. |
| `threejs-bloom` | Cinematographic; risk of gamey UI. |
| `threejs-atmosphere-aerial-perspective` | Only for large outdoor geospatial views. |
| `threejs-game-director` | Orchestration is excellent but assumes "build a game" outcome. |
| `threejs-gameplay-systems` | Game loop/physics/controls are not applicable. |
| `threejs-audio-generator` | Audio is not core to SentinelTwin. |

---

## 4. First-Principles Assessment

### 4.1 Long-Term Architectural Fit

SentinelTwin's rendering pipeline is intentionally split:
- **Simulation worker (`@sentineltwin/simulation`)** — deterministic geometry, zero React. Raw Three.js math: raycasting, frustum construction, heatmap scoring.
- **Viewer/editor (`@sentineltwin/viewer`, `apps/studio`)** — React Three Fiber declarative scene, overlays, camera feeds, path replay.

Therefore:
- **Vanilla Three.js skills** (`threejs-*` subskills) are correct for the simulation/coverage-engine side.
- **R3F/Drei skills** are correct for the viewer/editor side.
- **Game/graphics packs** are useful only for their cross-cutting tooling (debug, QA, visual scorecard) and must be reframed away from game loops.

### 4.2 No Duplicate Pipeline Rule

Installing many skills does not create duplicate code paths, but it risks **skill bloat**: agents defaulting to irrelevant VFX or game patterns. The mitigation is:
1. Prefer `threejs-skill-router` and `r3f-drei` as gatekeepers.
2. Document this inventory so all agents know which skills are in-bounds.
3. Keep the inventory in repo docs, not just local chat context.

### 4.3 License & Dependency Check

- All installed skill scaffolds use MIT/Apache 2.0 dependencies (`three`, `lil-gui`, `@playwright/test`, `pngjs`, `vite`).
- No GPL, AGPL, CC-BY-NC, or BSL dependencies found.
- Tripo/Gemini/ElevenLabs API outputs are proprietary usage-policy matters, not license contamination.
- This satisfies SentinelTwin's open-source dependency rules.

---

## 5. Concrete Recommendations

### 5.1 Immediate (this week)

1. **Adopt `r3f-drei` patterns** for `CameraWallView` tiles:
   - `frameloop="demand"` when not replaying.
   - `dpr={[1, 2]}` cap.
   - `PerformanceMonitor` + `AdaptiveDpr` behind quality toggle.
2. **Adopt `threejs-performance` budgets** as a Camera Wall contract: draw calls < 100, GPU memory < 100MB per tile.
3. **Use `threejs-qa-release/scripts/inspect-threejs-canvas.mjs`** as a starting point for `tools/webwright` canvas verification.
4. **Create a SentinelTwin visual scorecard** (inspired by `threejs-aaa-graphics-builder`) mapped to security surfaces and store in `Docs/quality/VISUAL_SCORECARD.md`.

### 5.2 Near-Term (next sprint)

5. **Translate `threejs-shaders` DORI ring recipe** into an R3F `ShaderMaterial` component for Camera View.
6. **Evaluate `threejs-procedural-architecture`** against Pascal primitives in a spike; decide whether to adopt or defer.
7. **Implement `threejs-visual-validation` regression protocol** for coverage heatmap and path replay.

### 5.3 Cleanup

8. **Remove or archive** the 14 low/no-relevance skills listed in §3.3 to reduce agent skill-bloat. This is a local tooling cleanup, not a code change.

---

## 6. Open Questions

- OQ-3D-01: Should SentinelTwin create a project-local skill whitelist (`Docs/quality/SKILL_WHITELIST.md`) so parallel agents know which 3D skills to load?
- OQ-3D-02: Does the Camera Wall need a formal performance budget test in CI, or is manual QA sufficient until v1?
- OQ-3D-03: Should we generate hero security assets (cameras, housings) via Tripo, or keep procedural geometry only?

---

## 7. Cross-References

- `Docs/architecture/07_RENDERING_PIPELINE.md` — primary rendering design doc.
- `Docs/architecture/07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md` — runtime truth (R3F v9.6, Drei v10.7, Three r184).
- `Docs/decisions/DECISION_LOG_ADDENDUM.md` — D-018 (GSAP vs Framer Motion).
- `Docs/exploration/EXPLORATION_MAP.md` — Thread 12 added.
- `Docs/quality/VISUAL_SCORECARD.md` — to be created if recommendation 4 is accepted.

---

**Next action:** User decides whether to (a) keep this as reference-only documentation, (b) proceed with skill cleanup, or (c) implement one of the immediate recommendations.
