# Phase 11: Monorepo Package Extraction

## Goal
Extract the working simulation engine, agent pipeline, report engine, core schema, and viewer components from the monolithic `apps/studio` into standalone Turborepo packages. This enables:
- Independent versioning and testing
- Web Worker execution for simulation (architectural requirement)
- Reuse by other apps (CLI, backend, future editor fork)
- Clearer dependency boundaries

## Current State
- Everything lives in `apps/studio/src/`
- Simulation engine (`src/simulation/`) has zero React deps — cleanest extraction candidate
- Agent pipeline (`src/agents/`) has zero React deps — strong extraction candidate
- Report engine (`src/report/`) has React deps only in preview panel — mixed extraction
- Core schemas (`src/schema/`) are pure TypeScript + Zod — clean extract
- Viewer components (`src/components/canvas/`, etc.) are heavily React-coupled
- Store (`src/store/`) is Zustand-coupled

## Extraction Order

### 1. `packages/simulation` — P0 (build first)
Contains: coverage engine, DORI/ODPCVS quality scoring, adversarial path, temporal simulation, grid, BVH, geometry helpers

**Status: NOT STARTED — code exists in `apps/studio/src/simulation/`**

Tasks:
- [ ] Create `packages/simulation/package.json` with `@sentineltwin/simulation` name
- [ ] Create `packages/simulation/tsconfig.json`
- [ ] Copy simulation source files, stripping `apps/studio`-specific imports
- [ ] Extract shared types to a `packages/core` or in-package types
- [ ] Create proper public API surface via `src/index.ts`
- [ ] Write extraction tests that pass against the standalone package
- [ ] Wire into `apps/studio` via workspace dependency
- [ ] Verify Web Worker compatibility (zero React/DOM/browser imports)
- [ ] Remove duplicated source from `apps/studio/src/simulation/`
- [ ] Verify all studio tests still pass

### 2. `packages/core` — P0 (build alongside simulation)
Contains: SecurityScene schema types, Zod schemas, node factories, camera presets

**Status: NOT STARTED — code exists in `apps/studio/src/schema/` and `apps/studio/src/lib/`**

Tasks:
- [ ] Create `packages/core/package.json` with `@sentineltwin/core` name
- [ ] Extract schema types (SecurityScene, all node types, SimulationResult)
- [ ] Extract Zod validation schemas
- [ ] Extract shared utilities (node factories, camera presets, quality helpers)
- [ ] Create public API surface
- [ ] Wire `@sentineltwin/simulation` to depend on `@sentineltwin/core`
- [ ] Wire `apps/studio` to depend on `@sentineltwin/core`

### 3. `packages/agents` — P1 (build after core + simulation)
Contains: Model providers (OpenAI, Gemini, Qwen), agent definitions, prompts, coordinator

**Status: NOT STARTED — code exists in `apps/studio/src/agents/`**

Tasks:
- [ ] Create `packages/agents/package.json` with `@sentineltwin/agents` name
- [ ] Extract provider interface + implementations
- [ ] Extract agent definitions (CommandAgent, ReportAgent, CounterfactualAgent)
- [ ] Extract prompt templates
- [ ] Extract coordinator + conversation memory
- [ ] Create public API surface
- [ ] Wire into `apps/studio` via workspace dependency

### 4. `packages/report` — P1 (build after core + simulation + agents)
Contains: Report builders, export templates, evidence bundle

**Status: NOT STARTED — code exists in `apps/studio/src/report/`**

Tasks:
- [ ] Create `packages/report/package.json` with `@sentineltwin/report` name
- [ ] Extract report data builders (non-React)
- [ ] Extract export renderers (non-React)
- [ ] Keep React preview components in `apps/studio`
- [ ] Create public API surface for non-React consumers

### 5. `packages/viewer` — P2 (after all others)
Contains: R3F rendering components, overlays, camera feed

**Status: NOT STARTED — code exists in `apps/studio/src/components/`**

Tasks:
- [ ] Create `packages/viewer/package.json` with `@sentineltwin/viewer` name
- [ ] Extract pure R3F/React rendering components
- [ ] Keep app-specific wiring in `apps/studio`
- [ ] Create public API surface

## Build Configuration

### Root `turbo.json` additions
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {},
    "typecheck": {
      "dependsOn": ["^typecheck"]
    }
  }
}
```

### Package dependency graph
```
apps/studio
  depends on: @sentineltwin/core, @sentineltwin/simulation, @sentineltwin/agents, @sentineltwin/report, @sentineltwin/viewer

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
  depends on: nothing except three.js types
  NO React dependency
```

### Path aliases in `tsconfig.base.json`
```json
{
  "paths": {
    "@sentineltwin/core": ["packages/core/src/index.ts"],
    "@sentineltwin/simulation": ["packages/simulation/src/index.ts"],
    "@sentineltwin/agents": ["packages/agents/src/index.ts"],
    "@sentineltwin/report": ["packages/report/src/index.ts"],
    "@sentineltwin/viewer": ["packages/viewer/src/index.ts"]
  }
}
```

## Key Decisions
- **Extract bottom-up**: simulation first (most independent), then core, then agents, then report, then viewer
- **Keep working**: `apps/studio` continues to work throughout extraction — no big-bang rewrite
- **Incremental adoption**: each package is wired into `apps/studio` as a workspace dependency as soon as it's extracted and tested
- **Non-breaking**: the original files in `apps/studio/src/` are preserved until the package is verified in CI
- **Copies, not moves**: copy files to packages first, verify, then remove originals

## Validation
- Each package: `tsc --noEmit` passes, `bun test` passes
- `apps/studio`: all existing tests pass after each extraction step
- `packages/simulation`: must compile and run in Node.js with no browser/React deps
