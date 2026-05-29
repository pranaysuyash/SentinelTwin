# Rendering Pipeline Runtime Addendum (2026-05-29)

Status: Runtime truth snapshot (non-destructive addendum)
Related base doc: `Docs/architecture/07_RENDERING_PIPELINE.md`
Related audit: `Docs/decisions/R3F_DREI_FULL_AUDIT_2026-05-29.md`

## Why this addendum exists

The base rendering architecture document may intentionally include future-state planning.
To preserve that planning context while still recording current implementation truth, this addendum captures runtime stack evidence without overwriting the base document.

## Current runtime stack truth (apps/studio)

Source of truth: `apps/studio/package.json`

- `next`: `16.2.6`
- `react`: `19.2.6`
- `@react-three/fiber`: `^9.6.1`
- `@react-three/drei`: `^10.7.7`
- `three`: `^0.184.0`
- `three-mesh-bvh`: `^0.9.10`
- `framer-motion`: `^12.40.0`
- `GSAP`: not present as a dependency in `apps/studio/package.json`

## Active rendering surfaces (runtime evidence)

- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`
  - R3F `Canvas` + scene overlays
- `apps/studio/src/components/view/CameraViewMode.tsx`
  - Camera-view R3F surface + overlays
- `apps/studio/src/components/view/PathReplayView.tsx`
  - Replay rendering + motion controls
- `apps/studio/src/lib/three-compat.ts`
  - Three compatibility shim (`CompatClock`) used for controlled runtime compatibility

## Policy for future updates

1. Do not erase future-planning context in `07_RENDERING_PIPELINE.md`.
2. When implementation drifts, create a new dated addendum in this folder.
3. Cross-link addendum(s) from decision/audit docs so agents can reconcile plan-vs-runtime quickly.
