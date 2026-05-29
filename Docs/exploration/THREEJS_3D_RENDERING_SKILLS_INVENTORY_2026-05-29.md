# Three.js / 3D / Rendering Skills Inventory

Date: 2026-05-29
Scope: Skills discovered from local agent-configured skill roots under `/Users/pranay` and verified online sources.

## Why this document exists

This captures a deduplicated reference of 3D/rendering-related skills so future task routing can quickly choose the most relevant skill without re-scanning all roots.

## Local discovery scope (configured roots)

- `/Users/pranay/.claude/skills`
- `/Users/pranay/.agents/skills`
- `/Users/pranay/.hermes/skills`
- `/Users/pranay/Projects/skills`
- `/Users/pranay/Projects/external-skills`
- `/Users/pranay/Projects/openai-skills`
- `/Users/pranay/.codex/skills`

## High-signal deduplicated skill slugs (local)

### Core Three.js

- `threejs-fundamentals`
- `threejs-geometry`
- `threejs-materials`
- `threejs-lighting`
- `threejs-textures`
- `threejs-animation`
- `threejs-loaders`
- `threejs-interaction`
- `threejs-shaders`
- `threejs-postprocessing`
- `threejs-performance`
- `threejs-skills` (meta/index pattern)

### R3F / WebGL / WebGPU / Shader

- `r3f-drei`
- `webgl-shaders`
- `webgpu`
- `shader-programming-glsl`

### 3D web experience and interaction

- `3d-web-experience`
- `3d-scroll-animations`
- `threejs-web-interactive`
- `headed-chrome-3d-testing`

### Blender / DCC integration

- `blender-3d-modeling`
- `blender-mcp`
- `llm-blender-agent`
- `spline-3d-integration`

### Engine-adjacent game/real-time skills

- `unity-developer`
- `unity-ecs-patterns`
- `game-development/3d-games`

### Adjacent but relevant ecosystem skills

- `ai-3d`
- `ar-vr-development`
- `game-development/game-art`
- `game-development/pc-games`
- `game-development/web-games`

## Representative local locations

- `/Users/pranay/Projects/skills/threejs/`
- `/Users/pranay/Projects/skills/3d-web/`
- `/Users/pranay/Projects/skills/r3f-drei/`
- `/Users/pranay/Projects/skills/webgpu/`
- `/Users/pranay/.hermes/skills/projects/skills/`
- `/Users/pranay/Projects/external-skills/sickn33__antigravity-awesome-skills/skills/`
- `/Users/pranay/Projects/external-skills/davila7__claude-code-templates/cli-tool/components/skills/`

## Online sources verified

### 1) CloudAI-X Three.js skills repository

- Repo: https://github.com/CloudAI-X/threejs-skills
- Skills directory: https://github.com/CloudAI-X/threejs-skills/tree/main/skills
- Confirms dedicated modules:
  - `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-textures`, `threejs-animation`, `threejs-loaders`, `threejs-shaders`, `threejs-postprocessing`, `threejs-interaction`

### 2) zocomputer skills (External)

- External directory: https://github.com/zocomputer/skills/tree/main/External
- Confirms corresponding Three.js skill family in index listings.

### 3) MCP Market (skills + related MCP ecosystem)

- Three.js fundamentals skill listing:
  - https://mcpmarket.com/tools/skills/three-js-scene-fundamentals
- Related 3D/engine MCP entries:
  - Blender MCP: https://mcpmarket.com/server/blender-model-context-protocol
  - Unity MCP: https://mcpmarket.com/server/unity
  - Game-dev category: https://mcpmarket.com/categories/game-development

## Notes on deduplication

- Many matches are mirrored across multiple roots (e.g., `.hermes`, `Projects/skills`, `Projects/external-skills`).
- This inventory deduplicates by skill slug/topic family, not by physical file count.
- Generic words like `render` can cause false positives (for example deployment-focused skills); those were excluded from the high-signal list above.

## Recommended routing priority for 3D/rendering tasks

1. `threejs-fundamentals`
2. Targeted module (`threejs-geometry` / `threejs-materials` / `threejs-lighting` / etc.)
3. `threejs-shaders` + `shader-programming-glsl` for visual effects
4. `r3f-drei` for React Three Fiber tasks
5. `webgpu` if modern GPU pipeline is explicitly requested
6. `blender-mcp` / `blender-3d-modeling` for DCC-assisted workflows

## Status

- Local scan: complete
- Online verification: complete
- Curated inventory: complete
