# Visual Scorecard — SentinelTwin Studio

**Purpose:** Regression-test rendering realism improvements without visual drift. Each surface has a Playwright canvas-snapshot baseline that must be updated deliberately when the rendering changes.

**Status:** Baseline established 2026-07-04. All 5 R3F surfaces are covered.

---

## Surfaces

| Surface | File | Tier | IBL | Shadows | Post-Processing | Baseline Snapshot |
|---------|------|------|-----|---------|-----------------|-------------------|
| Workspace Canvas | `WorkspaceCanvas.tsx` | high | RoomEnvironment | PCFSoft | none | `workspace-canvas.png` |
| Camera View | `CameraViewMode.tsx` | theme-driven | RoomEnvironment | PCFSoft | Noise + Vignette | `camera-view.png` |
| Camera Wall (tile) | `CameraWallView.tsx` | low | RoomEnvironment | PCFSoft | Noise + Vignette (0.5x) | `camera-wall-tile.png` |
| Camera Wall (overview) | `CameraWallView.tsx` | medium | RoomEnvironment | PCFSoft | none | `camera-wall-overview.png` |
| Path Replay | `PathReplayView.tsx` | high | RoomEnvironment | PCFSoft | none | `path-replay.png` |
| Inspector Feed | `CameraFeedCanvas.tsx` | medium | RoomEnvironment | PCFSoft | Noise + Vignette | `inspector-feed.png` |

## Rendering Modules

| Module | Purpose | Test File | Tests |
|--------|---------|-----------|-------|
| `lib/pbr-materials.ts` | Canonical PBR surface parameters | `lib/__tests__/pbr-materials.test.ts` | 13 |
| `lib/r3f-rendering.ts` | Canvas presets, IBL, shadow config | `lib/__tests__/r3f-rendering.test.ts` | 7 |
| `components/view/CameraFeedPostProcessing.tsx` | Camera-feed grain/vignette | — | — |
| `packages/simulation/src/wasm-vision-bridge.ts` | WASM vision bridge (frontier) | `__tests__/wasm-vision-bridge.test.ts` | 4 |

## Quality Tiers

| Tier | DPR Range | Shadows | IBL Intensity | Antialias | Post-Processing |
|------|-----------|---------|---------------|-----------|-----------------|
| high | [1, 2] | PCFSoft 2048 | 0.7 | yes | full |
| medium | [1, 1.5] | PCFSoft 1024 | 0.55 | yes | reduced |
| low | [0.75, 1] | PCFSoft 512 | 0.4 | no | minimal |

## Regression Protocol

1. **Before any rendering change:** run `tools/webwright/run-sentineltwin-qa.sh` to capture current baselines.
2. **After change:** re-run the same script. If any snapshot differs, inspect the diff.
3. **Intentional changes:** update the baseline by deleting the old snapshot and re-running.
4. **Unintentional changes:** fix the regression before shipping.

## Open Questions

- OQ-3D-10: Should the scorecard be enforced in CI, or is manual review sufficient until v1?
- OQ-3D-06: Should camera-feed post-processing be quality-tier gated or always-on?
