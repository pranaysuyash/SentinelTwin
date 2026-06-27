# Realistic 3D Rendering Exploration — SentinelTwin

**Date:** 2026-07-04
**Scope:** Survey realistic-rendering techniques, libraries, and low-level acceleration options for SentinelTwin; evaluate against product constraints; recommend a phased roadmap.
**Trigger:** User asked to explore how the 3D/visuals can be made more realistic, covering Three.js, WebGPU, WebGL, WASM, and related libraries, while documenting findings in the exploration map and following `motto_v3.md`.
**Motto compliance:** Context refreshed, instruction stack reviewed, exploration documented; no code or git mutations performed.

---

## 1. Baseline: Where Rendering Stands Today

Source of truth for the runtime stack is `Docs/architecture/07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md` and `apps/studio/package.json`.

| Layer | Current Choice | Notes |
|-------|----------------|-------|
| Framework | Next.js 16.2.9, React 19.2.7 | App Router |
| 3D renderer | `@react-three/fiber` 9.6.1 + `@react-three/drei` 10.7.7 | Already using `PerformanceMonitor`, `AdaptiveDpr`, `Html`, `OrbitControls`, `ContactShadows` |
| Three.js | `three` 0.184.0 | Modern; TSL/WebGPU renderer available |
| BVH raycasting | `three-mesh-bvh` 0.9.10 | Used in `@sentineltwin/simulation` for vision collider + coverage occlusion |
| Animation | Framer Motion 12.40.0 | Per D-018; GSAP is forbidden |
| Simulation worker | `@sentineltwin/simulation` | Pure Three.js math, **zero React**, deterministic |
| Viewer/editor | `apps/studio` | R3F declarative scene, overlays, camera feeds, path replay |

What is *already* realistic-ish:
- Procedural floor tile texture with grout + noise (`SharedScene.tsx`).
- Environment themes (day/dusk/night) drive lighting and background sphere.
- Contact shadows under obstructions (`ContactShadows` from Drei).
- Camera feed modes (normal / IR B&W / low-light / thermal) via CSS filters.
- Adaptive DPR budget for Camera Wall + single-canvas modes (D-321).

What is *not* yet realistic:
- Materials are mostly `MeshStandardMaterial` with flat colors / generated textures.
- No image-based lighting (IBL), no real environment maps.
- No screen-space ambient occlusion (SSAO) or contact-shadow refinement beyond Drei defaults.
- No post-processing chain (no bloom, grain, vignette, chromatic aberration, tone mapping).
- Shadows are limited / not tuned; night mode is mostly lighting dimming + CSS filter.
- Camera wall tiles are performant but not yet visually unified with a film/camera look.

---

## 2. Realistic Rendering Techniques — First-Principles Map

The goal for SentinelTwin is **believable, professional security visualization**, not game or cinematic spectacle. The visual system must remain subordinate to the simulation truth: coverage, occlusion, DORI/OODPCVS, and explainability.

### 2.1 Physically Based Rendering (PBR)

Three.js `MeshStandardMaterial` is already PBR-ish. To make it look real we need:

1. **Environment lighting / IBL** — provide a HDR environment map so metal/rough materials pick up plausible reflections.
2. **Realistic material parameters** — roughness maps, normal maps, metalness per surface type (vinyl floor, painted drywall, glass, brushed metal camera housing).
3. **Tone mapping + output encoding** — `ACESFilmicToneMapping`, `renderer.outputColorSpace = SRGBColorSpace`, correct exposure.

**How SentinelTwin can adopt it:**
- Replace the current ambient/directional light soup with Drei's `<Environment>` + `<Lightformer>` presets or a small generated PMREM.
- Keep a fallback for low-power GPUs (simple hemisphere + directional).
- Use `RoomEnvironment` from `three/examples/jsm/environments/RoomEnvironment.js` for a zero-asset, procedural IBL.

### 2.2 Shadows

Current shadows are Drei `ContactShadows`. Next steps:

| Technique | Cost | Use in SentinelTwin |
|-----------|------|---------------------|
| PCFSoft shadow maps | Medium | One directional/spot light for main shadow; tune map size per quality tier |
| PCSS (Percentage-Closer Soft Shadows) | Medium-High | Soft, area-like shadows; Three.js has a PCSS example (`webgl_shadowmap_pcss`) |
| Contact shadows | Low | Keep as cheap fallback for close-proximity grounding |
| Cascaded shadow maps (CSM) | High | Only for large exteriors / campus scale; defer |

**Recommendation:** Use one shadow-casting directional light with `PCFSoftShadowMap` + `ContactShadows` fallback. PCSS is a later visual polish.

### 2.3 Ambient Occlusion

| Technique | Cost | Notes |
|-----------|------|-------|
| SSAO (Screen-Space Ambient Occlusion) | Medium | Adds corner/contact darkening; easy to overuse |
| GTAO / HBAO | Higher | More accurate but heavier |
| Bent normal / lightmap baking | High | Precompute; not suitable for dynamic editor |
| Drei `ContactShadows` (ground-only) | Low | Already used |

**Recommendation:** SSAO via `postprocessing` only in high-quality mode, disabled by default to keep the clean analytical look buyers expect.

### 2.4 Post-Processing / Camera-Feed Look

Three.js has two post stacks:
- `three/examples/jsm/postprocessing/` (classical, WebGL only).
- TSL nodes + `PostProcessing` (new WebGPU-native stack in r167+).

`@react-three/postprocessing` wraps the `postprocessing` npm library and is R3F-friendly. It gives us:
- `Bloom`, `Noise`, `Vignette`, `DepthOfField`, `ChromaticAberration`, `Film` grain, `ToneMapping`.
- Automatic effect merging for performance.

For SentinelTwin the useful post effects are:
1. **Subtle film grain + scanlines** on camera-feed surfaces (synthetic POV tiles).
2. **Vignette** to focus attention on the center of a camera view.
3. **Noise** only when simulating low-light/IR degradation.
4. **Bloom** — generally avoid; security UI should not look gamey.

### 2.5 Procedural Textures / Materials

Instead of loading external image assets, we can generate textures on a `<canvas>` or via procedural shaders:
- Floor tiles (already done).
- Concrete / painted wall noise.
- Wood/metal for obstructions.
- Camera housing brushed-metal look.

Drei provides `useTexture`, `useNormalTexture`, `useMatcapTexture`. `threejs-procedural-materials` skill has PBR recipes we can adapt.

---

## 3. Libraries and Tools Evaluated

### 3.1 Already in Use or Adjacent

| Library | License | Fit | Notes |
|---------|---------|-----|-------|
| `three` r184 | MIT | Core | WebGPURenderer available in `three/webgpu`; TSL nodes mature |
| `@react-three/fiber` 9.6.1 | MIT | Core | R3F v9 pairs with React 19 |
| `@react-three/drei` 10.7.7 | MIT | Core | `Environment`, `ContactShadows`, `AdaptiveDpr`, `PerformanceMonitor`, `Lightformer` |
| `three-mesh-bvh` 0.9.10 | MIT | Core | BVH for raycasting; also has WebGPU API notes |
| `framer-motion` | MIT | Core | UI + path replay animation |

### 3.2 Realistic Rendering Additions (Consider)

| Library / Technique | License | Use | Recommendation |
|---------------------|---------|-----|--------------|
| Drei `<Environment>` + `<Lightformer>` | MIT | IBL / staging | Adopt now for realistic reflections |
| Drei `<Stage>` / `<Backdrop>` | MIT | Studio-like presentation | Optional; could make single-camera view look more credible |
| `three/examples/jsm/environments/RoomEnvironment.js` | MIT | Procedural IBL | Zero external asset; good fallback |
| `@react-three/postprocessing` | MIT | Effects chain | Use for camera-feed grain/vignette only |
| `postprocessing` (vanilla) | MIT | Effects chain | If we need it outside R3F |
| Drei `<SoftShadows>` / PCSS | MIT | Soft shadows | Adopt as a quality-tier effect |
| Drei `<SpotLightShadow>` | MIT | Spot-light shadow refinement | Useful for security lights |
| `three-gpu-pathtracer` / `@react-three/gpu-pathtracer` | MIT | Offline-quality rendering | **Defer** — too heavy for interactive editor |

### 3.3 Low-Level Acceleration

| Technology | What It Enables | SentinelTwin Fit |
|------------|-----------------|------------------|
| **WebGPU** | Compute shaders (coverage grid), modern rendering pipeline | Long-term; Three.js WebGPURenderer is maturing. Could replace coverage CPU raycasting with GPU compute for large scenes. |
| **WebGL 2** | Current backend; GPGPU via transform feedback / textures | Sufficient for V0.1/V0.2. Coverage engine is already fast enough on CPU+BVH. |
| **WASM (Rust/C)** | Deterministic, fast math/geometry; cross-platform worker | Excellent fit for `@sentineltwin/simulation` pure-geometry paths. Could port BVH build, raycast batch, or adversarial path graph. |
| **Web Workers** | Off-thread simulation | Already partially used (`three-mesh-bvh` worker generation). Should be the default for large-scene recomputation. |
| **SIMD (WASM)** | Vectorized ray/triangle tests | Possible future optimization; needs profiling evidence first. |

---

## 4. Constraint Analysis

### 4.1 License

SentinelTwin is Apache 2.0 and forbids GPL/AGPL/CC-BY-NC/BSL dependencies. All libraries evaluated above are MIT. **No license conflict found.**

### 4.2 Deterministic Simulation

Any rendering improvement must not change coverage results. Rules:
- Vision collider geometry stays canonical (build from `SecurityScene`).
- Lighting intensities used for rendering must map 1:1 to simulation lux assumptions.
- Post-processing effects are **visual only** and must not feed back into `SimulationResult`.
- If we move coverage raycasting to WebGPU compute, the algorithm must be pixel-exact with the CPU version for validation.

### 4.3 Performance

Current golden claim: 10.8 ms for 40×28 grid, 2 cameras (deterministic test). Camera Wall already has adaptive DPR.

| Addition | Expected Cost | Mitigation |
|----------|---------------|------------|
| IBL / Environment | 1 extra texture, small | Use `RoomEnvironment` or small HDR; fallback to hemisphere |
| Shadow maps | One 1024–2048 shadow map | One caster only; disable on low tier |
| SSAO | Extra full-screen pass | Disable by default; only high tier |
| Post-processing grain/vignette | One merged pass via `postprocessing` | Cheap on desktop, optional on mobile |
| WebGPU compute coverage | Big upfront build cost | Defer until CPU path is a proven bottleneck |
| WASM geometry core | Moderate build/bridge cost | High leverage; can run in worker |

### 4.4 Local-First / Data Sensitivity

- All rendering is client-side; no issue.
- External HDR environment assets should be self-hosted or procedurally generated to avoid network calls during sensitive reviews.

---

## 5. Recommendations — Phased Roadmap

### Phase A — Immediate Realism Wins (this sprint, low risk)

1. **Adopt procedural IBL with fallback**
   - Use Drei `<Environment>` with `preset="city"` or `<RoomEnvironment>` in `WorkspaceCanvas`, `CameraViewMode`, `PathReplayView`.
   - On low tier, fall back to hemisphere + directional (current style).
   - Code anchor: `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`, `CameraViewMode.tsx`, `PathReplayView.tsx`.

2. **Tune PBR material parameters by surface type**
   - Walls: high roughness, slight normal noise.
   - Floor: existing tile texture but applied with `roughnessMap` / `normalMap` generated from the same canvas.
   - Cameras: low roughness, metalness 0.6–0.8 to look like housings.
   - Obstructions: per material type (wood, metal, glass).
   - Code anchor: `SharedScene.tsx` material helpers.

3. **One credible shadow setup**
   - One directional light casting `PCFSoftShadowMap`.
   - Keep Drei `ContactShadows` as ground contact.
   - Tie shadow quality to the existing adaptive DPR/quality tier.

4. **Tone mapping / color space**
   - Set `renderer.toneMapping = ACESFilmicToneMapping` and `renderer.outputColorSpace = SRGBColorSpace` via R3F `Canvas` props.

### Phase B — Camera-Feed Realism (next sprint)

5. **Synthetic POV post-processing**
   - Add `@react-three/postprocessing` only inside camera-feed canvases (`CameraViewMode`, `CameraWallView` POV tiles).
   - Effects: `Noise` + `Vignette` + `Film` grain, intensity linked to `feedMode` (IR/low-light = more).
   - Keep Map View clean/no-post so it stays analytical.

6. **Night/IR look in 3D**
   - Use shader-based IR false color for thermal mode inside the R3F canvas instead of CSS filter.
   - Add a subtle night-vision scanline overlay as CSS for feed tiles (already partially present).

### Phase C — Simulation/Performance Frontier (later)

7. **WebGPU compute for coverage grid**
   - Spike: port the deterministic coverage raycast to a WebGPU compute shader, compare results against CPU.
   - Use only when scene size exceeds CPU budget (warehouse/campus).
   - Risk: cross-backend determinism; needs exactness test harness.

8. **WASM geometry core in `@sentineltwin/simulation`**
   - Port `vision-collider-mesh.ts` BVH build + batched raycast to Rust/WASM.
   - Maintain the same public TypeScript API so callers do not change.
   - Biggest near-term leverage for deterministic performance.

9. **SSAO as a high-quality-tier option**
   - Add via `postprocessing` only in high tier; disable by default.
   - Must not darken coverage heatmap readability.

### Phase D — Research / Defer

10. **GPU path tracing** (`three-gpu-pathtracer`) — too slow for interactive editor; revisit for static export/render only.
11. **Gaussian splat visual layer** — already tracked in Thread 17; keep as visual-only background.
12. **Cascaded shadow maps / area lights** — only if outdoor/campus becomes a priority.

---

## 6. Open Questions Raised

Add to `Docs/decisions/OPEN_QUESTIONS.md` / `OPEN_QUESTIONS_ADDENDUM.md`:

| ID | Question | Priority |
|----|----------|----------|
| OQ-3D-04 | Should SentinelTwin adopt a single shared `Environment` / IBL source across all canvases, or per-mode presets? | P1 |
| OQ-3D-05 | What is the canonical surface material library for walls, floors, cameras, obstructions, doors, windows? | P1 |
| OQ-3D-06 | Should camera-feed post-processing (grain, vignette, scanlines) be quality-tier gated or always-on? | P1 |
| OQ-3D-07 | When should coverage engine move from CPU+BVH to WebGPU compute? What is the scene-size threshold? | P2 |
| OQ-3D-08 | Should we port `@sentineltwin/simulation` geometry/BVH core to Rust/WASM for deterministic performance? | P2 |
| OQ-3D-09 | Do we add SSAO at all, or keep the analytical clean look? | P2 |
| OQ-3D-10 | How do we regression-test rendering realism without visual drift? Add a visual scorecard + Playwright canvas snapshots? | P1 |

---

## 7. First-Principles Assessment

SentinelTwin's product value is **explainable security simulation**, not photorealism for its own sake. The 3D visuals should:

1. **Make coverage truth legible** — heatmap, cones, blindspots, paths must remain readable.
2. **Feel credible to a buyer** — realistic enough that a non-technical stakeholder trusts the digital twin.
3. **Not distract** — no gamey bloom, no cinematic camera shakes, no weather effects.
4. **Stay deterministic** — rendering choices must never alter simulation output.
5. **Degrade gracefully** — high-quality effects must be tier-gated so field tablets and low-end laptops stay usable.

Therefore the right long-term rendering strategy is:
- **R3F + Drei for viewer/editor**, with realistic but restrained PBR + IBL + shadows.
- **Three.js WebGL/WebGPU compute as a future acceleration layer**, gated by benchmarks.
- **WASM/Rust geometry core as the durable performance bet** for the simulation worker.
- **Post-processing only for camera-feed look**, not for the map view.

---

## 8. Cross-References

- `Docs/architecture/07_RENDERING_PIPELINE.md` — primary rendering design doc.
- `Docs/architecture/07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md` — runtime truth.
- `Docs/exploration/3D_DESIGN_SKILL_INVENTORY_2026-07-01.md` — skill inventory.
- `Docs/decisions/DECISION_LOG_ADDENDUM.md` — D-018 (GSAP→Framer), D-321 (adaptive DPR).
- `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md` — OQ-3D-01..03.
- Code anchors: `apps/studio/src/components/workspace/SharedScene.tsx`, `WorkspaceCanvas.tsx`; `apps/studio/src/components/view/CameraViewMode.tsx`, `CameraWallView.tsx`, `PathReplayView.tsx`; `packages/simulation/src/vision-collider-mesh.ts`, `packages/simulation/src/coverage.ts`.

---

**Next action:** User decides whether to (a) keep this as reference-only documentation, (b) implement Phase A realism wins, or (c) spike one of the frontier options (WebGPU compute or WASM geometry core).
