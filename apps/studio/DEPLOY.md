# Deploying SentinelTwin Studio

## Option 1: Vercel (simplest, free tier)

```bash
cd apps/studio
npx vercel --prod
```

Or connect GitHub via the Vercel dashboard:
- Import repo → root dir: `apps/studio`
- Framework: Next.js (auto-detect)
- Build: `NEXT_PRIVATE_WORKER_THREADS=false next build --turbopack`
- Install: `pnpm install --frozen-lockfile`

Free tier caps: 100GB bandwidth, 6000 build min/mo, 10 serverless fn invocations/day.
Auto-upgrade to Pro is never automatic — you must opt in.

## Option 2: Docker (self-host, Railway, Hetzner, GCP Cloud Run)

```bash
# Build image
cd apps/studio
docker build -t sentineltwin-studio ..
docker run -p 3000:3000 sentineltwin-studio
```

### Railway
```
# Point Railway at apps/studio/
# Builder: Dockerfile
```

### Hetzner VPS
```bash
# Transfer image or build on the VPS
docker run -d -p 3000:3000 --restart always sentineltwin-studio
# Put behind Caddy or nginx for TLS
```

## Option 3: Direct (VPS, no Docker)

```bash
git clone <repo>
cd sentineltwin
corepack enable && pnpm install
cd apps/studio
pnpm build
NODE_ENV=production PORT=3000 node_modules/.bin/next start
```

## Caveats

- **Filesystem storage**: Archives are written to `apps/studio/.support-ingest/` etc. These vanish on serverless platforms (Vercel, Railway). Fine for demos — add S3/etc later.
- **Health**: `GET /api/truth-audit` returns the deploy health status.
- **API routes**: 14 serverless endpoints — no external DB needed.

## First-thing-tomorrow checklist

- [ ] `cd apps/studio && npx vercel`
- [ ] Verify at the production URL:
  - [ ] Dashboard loads
  - [ ] New blank scene loads
  - [ ] Run Simulation completes
  - [ ] `GET /api/truth-audit` → `ok: true`
- [ ] Decide where to persist the URL for submission
- [ ] (optional) Wire a custom domain
