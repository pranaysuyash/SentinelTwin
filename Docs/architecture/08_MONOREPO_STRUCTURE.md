# Monorepo Structure

**Status:** Design — 2026-05-25
**Foundation:** Turborepo monorepo forked from `pascalorg/editor`

---

## Directory Layout

```
sentineltwin/
├── apps/
│   └── editor/                    — main SentinelTwin web app (Next.js)
│       ├── src/
│       │   ├── app/               — Next.js App Router pages
│       │   ├── components/        — app-level components
│       │   │   ├── canvas/        — R3F canvas and scene
│       │   │   ├── panels/        — inspector, tray, metrics, timeline
│       │   │   ├── overlays/      — coverage heatmap, adversarial path viz
│       │   │   └── report/        — report preview panel
│       │   ├── tools/             — security editing tools
│       │   │   ├── CameraTool.tsx
│       │   │   ├── SecurityLightTool.tsx
│       │   │   ├── ObstructionTool.tsx
│       │   │   ├── CriticalZoneTool.tsx
│       │   │   └── PathTool.tsx
│       │   └── hooks/             — app-level hooks
│       ├── public/
│       │   ├── presets/           — camera preset JSONs
│       │   └── demo-scenes/       — pre-built demo scenes (small shop, lobby, etc.)
│       └── package.json
│
├── packages/
│   ├── core/                      — scene schema, store, systems (no React)
│   │   ├── src/
│   │   │   ├── schema/            — TypeScript types + Zod schemas
│   │   │   │   ├── SecurityScene.ts
│   │   │   │   ├── CameraNode.ts
│   │   │   │   ├── SecurityLightNode.ts
│   │   │   │   ├── ObstructionNode.ts
│   │   │   │   ├── CriticalZoneNode.ts
│   │   │   │   ├── ScenarioPath.ts
│   │   │   │   └── SimulationResult.ts
│   │   │   ├── store/
│   │   │   │   └── useSecurityScene.ts  — Zustand store (extends Pascal's useScene)
│   │   │   ├── systems/           — Pascal pattern: process dirty nodes each frame
│   │   │   │   ├── CameraSystem.ts
│   │   │   │   └── ObstructionSystem.ts
│   │   │   └── presets/
│   │   │       └── cameraPresets.ts
│   │   └── package.json
│   │
│   ├── viewer/                    — R3F rendering (requires React)
│   │   ├── src/
│   │   │   ├── renderers/         — per-node-type R3F components
│   │   │   │   ├── CameraNodeRenderer.tsx
│   │   │   │   ├── SecurityLightRenderer.tsx
│   │   │   │   └── ObstructionRenderer.tsx
│   │   │   ├── overlays/          — simulation visualization
│   │   │   │   ├── CoverageHeatmap.tsx
│   │   │   │   ├── CameraFrustum.tsx
│   │   │   │   ├── AdversarialPathViz.tsx
│   │   │   │   └── BlindspotHighlight.tsx
│   │   │   ├── camera-feed/
│   │   │   │   ├── CameraFeedCanvas.tsx
│   │   │   │   └── CameraWallPanel.tsx
│   │   │   └── replay/
│   │   │       ├── PersonActor.tsx
│   │   │       └── PathReplayController.tsx
│   │   └── package.json
│   │
│   ├── simulation/                — coverage engine, adversarial, temporal (NO React)
│   │   ├── src/
│   │   │   ├── coverage/
│   │   │   │   ├── computeCoverage.ts      — main entry point
│   │   │   │   ├── gridSampler.ts
│   │   │   │   ├── fovTest.ts
│   │   │   │   ├── raycastOcclusion.ts
│   │   │   │   ├── qualityScoring.ts       — DORI formula
│   │   │   │   └── lightingPenalty.ts
│   │   │   ├── adversarial/
│   │   │   │   ├── buildNavGraph.ts
│   │   │   │   ├── computeExposureCosts.ts
│   │   │   │   ├── findMinExposurePath.ts  — Dijkstra implementation
│   │   │   │   └── adversarialResult.ts
│   │   │   ├── temporal/
│   │   │   │   ├── buildChangeTimeline.ts
│   │   │   │   ├── computeTemporalProfile.ts
│   │   │   │   └── vulnerabilityWindows.ts
│   │   │   ├── worker/
│   │   │   │   └── simulation.worker.ts    — wraps computeCoverage for Web Worker
│   │   │   └── bvh/
│   │   │       └── buildVisionBVH.ts       — merges vision colliders + builds BVH
│   │   └── package.json
│   │
│   ├── agents/                    — AI agent pipeline (model-agnostic)
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   │   ├── ModelProvider.ts        — abstract interface
│   │   │   │   ├── OpenAIProvider.ts
│   │   │   │   ├── GeminiProvider.ts
│   │   │   │   └── QwenProvider.ts
│   │   │   ├── agents/
│   │   │   │   ├── CommandAgent.ts
│   │   │   │   ├── CounterfactualAgent.ts
│   │   │   │   ├── ReportAgent.ts
│   │   │   │   └── SceneUnderstandingAgent.ts
│   │   │   ├── tools/
│   │   │   │   └── sentineltwinTools.ts    — tool definitions for structured outputs
│   │   │   └── prompts/
│   │   │       ├── command.ts
│   │   │       ├── counterfactual.ts
│   │   │       └── report.ts
│   │   └── package.json
│   │
│   └── report/                    — report generation and export
│       ├── src/
│       │   ├── builders/
│       │   │   ├── buildReportData.ts      — assemble from SimulationResult
│       │   │   └── buildBeforeAfterDelta.ts
│       │   ├── renderers/
│       │   │   ├── ReportPreviewPanel.tsx
│       │   │   └── ReportPDFExport.ts
│       │   └── templates/
│       │       └── standardAuditReport.ts
│       └── package.json
│
├── experiments/                   — model bakeoff, CV experiments
│   ├── command_parsing/
│   ├── scene_understanding/
│   ├── depth_estimation/
│   ├── segmentation/
│   └── BAKEOFF_RESULTS.md
│
├── Docs/                          — architecture, decisions, exploration (this folder)
│
├── turbo.json
├── package.json
├── tsconfig.base.json
└── eslint.config.base.js
```

---

## Turborepo Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "lint": {}
  }
}
```

---

## Package Dependency Rules

```
apps/editor
  depends on: @sentineltwin/core, @sentineltwin/viewer, @sentineltwin/simulation, 
              @sentineltwin/agents, @sentineltwin/report

@sentineltwin/viewer
  depends on: @sentineltwin/core
  has React dependency

@sentineltwin/simulation
  depends on: @sentineltwin/core
  NO React dependency (must run in Web Worker)

@sentineltwin/agents
  depends on: @sentineltwin/core, @sentineltwin/simulation
  NO React dependency (API calls only)

@sentineltwin/report
  depends on: @sentineltwin/core, @sentineltwin/simulation, @sentineltwin/agents
  React dependency for preview panel only

@sentineltwin/core
  depends on: NOTHING except Pascal core types
  NO React dependency
```

**No circular dependencies.** Enforce with Turborepo's dependency checking.
**`@sentineltwin/simulation` must have zero React deps** — it must be runnable in a Web Worker.

---

## Demo Scenes

Pre-built scenes in `apps/editor/public/demo-scenes/`:

```
demo-scenes/
├── small_retail_shop.json      — front door, counter, shelves, cameras, cupboard
├── apartment_lobby.json        — entry, lift, staircase, pillar, cameras
├── warehouse_bay.json          — loading shutter, racks, vehicle path, cameras
└── school_corridor.json        — long corridor, classrooms, stair turn, cameras
```

Each demo scene is a valid `SecurityScene` JSON.
The app loads `small_retail_shop.json` by default.

---

## Path Aliases

In `tsconfig.base.json`:
```json
{
  "paths": {
    "@sentineltwin/core": ["packages/core/src/index.ts"],
    "@sentineltwin/viewer": ["packages/viewer/src/index.ts"],
    "@sentineltwin/simulation": ["packages/simulation/src/index.ts"],
    "@sentineltwin/agents": ["packages/agents/src/index.ts"],
    "@sentineltwin/report": ["packages/report/src/index.ts"]
  }
}
```

---

## First Steps When Setting Up the Fork

```bash
# 1. Fork pascalorg/editor to github.com/{pranay}/sentineltwin
# 2. Clone
git clone https://github.com/{pranay}/sentineltwin
cd sentineltwin

# 3. Install (Pascal uses Bun)
bun install

# 4. Verify Pascal still runs
bun dev

# 5. Create SentinelTwin packages
mkdir -p packages/simulation packages/agents packages/report
# ... scaffold each package.json

# 6. Add to turbo.json pipeline

# 7. Create packages/core/src/schema/ with SecurityScene types
# (extend Pascal's existing core package)

# 8. Write first coverage engine test
# 9. Build demo scene JSON
# 10. Wire up in editor app
```
