# Map Layer Visual Language

**Date:** 2026-05-27
**Purpose:** Canonical color and layering guidance for the shared 2D map surfaces, so MiniMap, PathMap, coverage overlays, camera cones, and timeline badges read as one system.

## Canonical Sources

- `apps/studio/src/components/map/map-colors.ts` is the shared map color token file.
- `apps/studio/src/lib/quality-display.ts` is the canonical quality-tier palette and label source.
- `apps/studio/src/components/map/MapLayers.tsx` is the shared 2D rendering layer that consumes both.

## Design Rules

1. Keep one map language across MiniMap, PathMap, coverage overlays, inspector mini-feeds, and report visuals.
2. Do not invent new one-off colors in individual panels when a shared token already exists.
3. Use blue for camera- and viewport-related affordances.
4. Use amber/yellow for caution, partial, or weakening quality.
5. Use green for strong / passing / healthy outcomes.
6. Use red for failures, missing coverage, or critical issues.
7. Keep path and geometry strokes subdued so the overlay data reads first.

## Shared Tokens

| Token | Meaning | Current code source |
|---|---|---|
| `background`, `grid`, `panelBorder`, `panelFill` | Map chrome and surface framing | `map-colors.ts` |
| `viewport` | Active viewport / fit-to-view target | `map-colors.ts` |
| `selection` | Selected object or active focus | `map-colors.ts` |
| `replayActor` | Replay actor / path-follow avatar | `map-colors.ts` |
| `path`, `pathActive` | Inactive vs active authored path | `map-colors.ts` |
| `wall`, `wallGlass`, `wallGrill` | Boundary material states | `map-colors.ts` |
| `window`, `windowReflective` | Window states | `map-colors.ts` |
| `door`, `doorOpen`, `doorRestricted` | Door states | `map-colors.ts` |
| `lightOn`, `lightOff`, `lightFailed` | Lighting state | `map-colors.ts` |
| `priority.low/medium/high/critical` | Zone priority scale | `map-colors.ts` |
| `quality.*` | DORI / OODPCVS tier colors | `quality-display.ts` |

## Quality Tier Language

The quality tiers are intentionally explicit so the map can communicate more than a simple pass/fail state.

| Tier | Label | Color role |
|---|---|---|
| `none` | No usable coverage | Critical failure / empty state |
| `detection`, `overview`, `outline` | Barely usable | Warm caution range |
| `observation`, `discern` | Watchable / partial | Yellow warning range |
| `perceive` | Noticeable improvement | Lime bridge between caution and strong coverage |
| `recognition`, `characterize` | Strong coverage | Green pass state |
| `validate`, `identification` | Highest-confidence coverage | Blue highlight range for identity-grade outcomes |
| `scrutinize` | Specialized top tier | Sky accent for the strongest tier |

## Geometry Semantics

- Walls should stay visually dominant enough to read boundaries, but not so bright that they overpower coverage cells.
- Camera cones should be clearly identifiable as camera objects, not generic wedges.
- Active paths should win over inactive paths, but inactive paths still need to remain visible enough for comparison.
- Replay actors should be warm and distinct so the path replay surface feels alive.
- Critical zone fill should read as stateful, not decorative.
- Privacy zones should remain obviously separate from critical zones so compliance-related overlays do not blur into coverage overlays.

## Surface-Specific Notes

- **MiniMap** should prioritize selection, fit, and layer visibility over micro-detail.
- **PathMap** should prioritize route clarity, replay progress, and event interpretation over decorative rendering.
- **Coverage views** should prioritize quality cells and zone outcomes.
- **Camera-view overlays** should preserve the same state colors as the 2D map where possible, even when the live POV uses a different composition.

## Non-Goals

- Do not create separate color palettes for report mode, camera mode, and map mode.
- Do not encode meaning purely through hue if the same message can be reinforced with text or iconography.
- Do not diverge from the shared token files without updating this document and the related implementation notes.

