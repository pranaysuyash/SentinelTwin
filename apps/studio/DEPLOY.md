# SentinelTwin Studio — Deployment Checklists

## Local-Only (default)

```bash
# 1. Verify environment
cp .env.example .env.local
# Edit .env.local as needed (no API keys required)

# 2. Install
pnpm install

# 3. Run quality gate
bash ../../tools/studio-quality-gate.sh

# 4. Start
pnpm dev
# → http://localhost:3000
```

## Self-Hosted (Docker)

```bash
# 1. Build image
docker compose build

# 2. Configure
export NODE_ENV=production
export SENTINELTWIN_API_ALLOWED_ORIGINS=https://your-domain.com

# 3. Start
docker compose up -d
# → http://localhost:3000

# 4. Verify health
curl http://localhost:3000/api/health
```

## Cloud-Assisted (Vercel)

```bash
# 1. Deploy
cd apps/studio
npx vercel --prod

# 2. Configure env vars in Vercel dashboard:
#    - NODE_ENV=production
#    - OPENAI_API_KEY (optional)
#    - GEMINI_API_KEY (optional)
#    - QWEN_API_KEY (optional)

# 3. Verify
curl https://your-deployment.vercel.app/api/health
```

## Pre-Flight Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] `bun test` passes (or `pnpm test`)
- [ ] `bash ../../tools/studio-quality-gate.sh` passes
- [ ] `.env.local` configured for target profile
- [ ] Health endpoint responds `{ "ok": true, "status": "ok" }`
- [ ] CSP headers present in response (production only)
- [ ] No secrets committed to repository
