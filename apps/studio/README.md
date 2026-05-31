# SentinelTwin Studio (`apps/studio`)

SentinelTwin is an AI-native physical security simulation platform.
Core loop: `Edit scene → run simulation → inspect impact → compare → report`.

## Requirements

- Node.js `>=24.13.0`
- pnpm `>=11.4`
- Bun (for tests)

## Run

```bash
cd apps/studio
pnpm install
pnpm dev
```

Studio runs on `http://localhost:3000`.

## Build and Test

```bash
# production build
pnpm build

# lint
pnpm lint

# tests (bun)
pnpm test

# watch mode
pnpm test:watch
```

## Deploy

**Vercel (recommended):** `https://sentinel-twin-studio.vercel.app`

```bash
cd apps/studio
npx vercel --prod
```

Or connect GitHub via Vercel dashboard (root dir: `apps/studio`).

See `DEPLOY.md` for Docker/Railway/Hetzner options.

## Product Architecture

Product-level views routed via `ProductViewRouter`:

- `product_home` — StudioDashboardHome (current site twin preview, security status, mode launcher)
- `site_intake` — Create Site Twin (scan, AI draft, floor plan, import, manual build, footage verify)
- `scan_site` — Manual-assisted or guided scan photo intake
- `manual_builder` — Scene Builder Wizard (blank/template)
- `floor_plan_import` — Floor plan image import
- `ai_layout_draft` — Prompt-to-scene AI draft
- `site_draft_review` — Review and approve before activation
- `studio` — Security Twin Studio (coverage, camera view/wall, path replay, compare, report)

Studio sub-modes: Coverage, Camera Operations, Incident Review, Counterfactual Fix, Audit Report.

## Key Design Principles

- **Draft gating**: All creation/import paths produce a `SiteTwinDraft` that must pass through `SiteDraftReview` before activation. No flow bypasses this.
- **AI proposes, simulation verifies**: AI generates structured scene edits; the simulation engine computes coverage deltas.
- **Deterministic simulation**: Coverage, occlusion, DORI quality scoring, and path visibility are deterministic geometry — not AI.
- **Defensive framing**: Output is expressed as "coverage failure analysis" and "hardening recommendations."

## Product Language

- **Site Twin** — The canonical security scene (what the product works with)
- **Security Twin Studio** — The 3D editor workspace
- **Draft** — Unactivated scene pending review
- **Audit Report** — Security assessment output
