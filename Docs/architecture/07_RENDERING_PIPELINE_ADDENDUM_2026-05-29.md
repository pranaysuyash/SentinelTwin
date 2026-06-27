# Rendering Pipeline Runtime Addendum (2026-05-29)

Status: Runtime truth snapshot (non-destructive addendum)
Related base doc: `Docs/architecture/07_RENDERING_PIPELINE.md`
Related audit: `Docs/decisions/R3F_DREI_FULL_AUDIT_2026-05-29.md`

## Why this addendum exists

The base rendering architecture document may intentionally include future-state planning.
To preserve that planning context while still recording current implementation truth, this addendum captures runtime stack evidence without overwriting the base document.

## Current runtime stack truth (apps/studio)

Source of truth: `apps/studio/package.json`

- `next`: `16.2.9`
- `react`: `19.2.7`
- `@react-three/fiber`: `^9.6.1`
- `@react-three/drei`: `^10.7.7`
- `three`: `^0.184.0`
- `three-mesh-bvh`: `^0.9.10`
- `framer-motion`: `^12.40.0`
- `GSAP`: not present as a dependency in `apps/studio/package.json`

## Active rendering surfaces (runtime evidence)

- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`
  - R3F `Canvas` + scene overlays (high tier, IBL + soft shadows + ACES tone mapping)
- `apps/studio/src/components/view/CameraViewMode.tsx`
  - Camera-view R3F surface + overlays (theme-driven tier: day→high, dusk→medium, night→low)
- `apps/studio/src/components/view/PathReplayView.tsx`
  - Replay rendering + motion controls (high tier)
- `apps/studio/src/components/view/CameraWallView.tsx`
  - Per-tile POV canvases (low tier) + wall overview canvas (medium tier)
- `apps/studio/src/components/inspector/CameraFeedCanvas.tsx`
  - Inspector feed (medium tier)
- `apps/studio/src/lib/three-compat.ts`
  - Three compatibility shim (`CompatClock`) used for controlled runtime compatibility

## Rendering realism modules (2026-07-04)

- `apps/studio/src/lib/pbr-materials.ts` — canonical surface PBR parameters and
  selection overlay. Used by `SharedScene.tsx` for floor, walls, doors,
  windows, and the path actor.
- `apps/studio/src/lib/r3f-rendering.ts` — Canvas presets (low / medium / high),
  IBL installer (`installRoomEnvironmentIBL`), default shadow caster
  factory (`defaultShadowCaster`), and pure-data tier helpers
  (`r3fCanvasPropsForTier`, `applyR3FCanvasPreset`,
  `environmentIntensityFor`, `shadowMapSizeFor`).
- `SharedScene` exports `SceneEnvironmentSetup` (IBL installer) and
  `SceneShadowCaster` (one PCFSoft shadow-casting directional light per
  Canvas) plus `tierForTheme(theme)` to map day/dusk/night to
  high/medium/low. Both are composed inside every R3F Canvas in the
  five surfaces above.

## Simulation frontier — WASM vision bridge (2026-07-04)

- `packages/simulation/src/wasm-vision-bridge.ts` — `VisionBridge`
  interface with two deterministic backends: `BvhJsVisionBridge`
  (existing `three-mesh-bvh` path) and `WasmVisionBridge` (a hand-built
  WebAssembly module compiled at runtime from inline bytes that proves
  the linear-memory contract a future Rust port would honor). The
  factory `createBridgeForScene(scene, "wasm-spike" | "bvh-js")` is
  the only call site change needed when the long-term Rust port lands.
- `packages/simulation/src/__tests__/wasm-vision-bridge.test.ts` —
  Tier-3 determinism parity test that asserts JS and WASM backends
  return byte-identical hits for the same batch of rays.

## Policy for future updates

1. Do not erase future-planning context in `07_RENDERING_PIPELINE.md`.
2. When implementation drifts, create a new dated addendum in this folder.
3. Cross-link addendum(s) from decision/audit docs so agents can reconcile plan-vs-runtime quickly.
