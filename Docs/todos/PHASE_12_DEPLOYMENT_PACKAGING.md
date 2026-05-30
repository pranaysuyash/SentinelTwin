# Phase 12: Deployment & Packaging

**Status:** Not started
**Priority:** P2 (Medium)
**Dependencies:** Phase 11 (Monorepo Packages)

---

## Goal

Take the locally-developed Camera Studio and produce reproducible deployment packages for multiple environments: local-only, self-hosted, and cloud-assisted. This includes release checklists, production profiles, environment configuration, and deployment automation.

---

## Deliverables

### 1. Deployment Matrix Definition

Define three deployment profiles:

| Profile | Target | Key Requirements |
|---------|--------|-----------------|
| **Local-only** | Single user, browser-based | IndexedDB persistence, no backend, static hosting (Vercel/Netlify) |
| **Self-hosted** | Enterprise on-premise | Docker compose, PostgreSQL/SQLite, file-based scene storage, backup/restore |
| **Cloud-assisted** | SaaS | Multi-tenant, authentication, cloud storage, usage tracking, team management |

### 2. Local-Only Build (V0.1 Default)

- Next.js static export or optimized SPA build
- All persistence via IndexedDB (already wired)
- No backend required
- Deployable to Vercel/Netlify/Cloudflare Pages in one command
- Verify: `build` passes, static export works, no server-side dependencies leak

### 3. Self-Hosted Package

- Dockerfile for the studio app
- Docker Compose with:
  - SentinelTwin app (Next.js)
  - PostgreSQL (optional, for advanced persistence)
  - Redis (optional, for session management)
- Environment variable catalog (.env.example with all possible vars)
- Backup/restore scripts for scenes and settings
- Health check endpoint
- Release checklist covering: secrets, ports, domain, SSL, storage volume

### 4. Cloud-Assisted Profile (Future)

- Authentication provider integration (NextAuth.js / Auth0 / Clerk)
- Scene storage API (S3/R2 bucket abstraction)
- Multi-user workspace sync foundation
- Usage/billing metering hooks (Stripe)
- Not required for V0.1 — design the contract now, implement later

### 5. Release Process

- Version numbering scheme (semver: `0.1.0`, `0.2.0`, etc.)
- CHANGELOG.md with keepachangelog format
- GitHub release workflow:
  - Tag → build → generate release notes → publish to npm/GitHub Releases
- Upgrade/migration notes for schema changes between versions

### 6. Production Profile Validation

- Production `next.config.js` with:
  - Image optimization
  - Bundle analysis
  - Strict CSP headers
  - Correct asset prefix for subpath deployments
- Environment validation on startup
- Graceful degradation when backend is unavailable

---

## Implementation Order

1. Local-only build production profile (next.config.js, build scripts)
2. Dockerfile + Docker Compose for self-hosted
3. Release process (CHANGELOG, version script, GitHub workflow)
4. Environment variable catalog + validation
5. Self-hosted deployment verification
6. Cloud-assisted contract design (future)

---

## Success Criteria

- `bun build` produces a deployable output for local-only profile
- Docker Compose starts the app with `docker compose up`
- Environment validation catches misconfiguration on startup
- Release workflow creates a tagged build with changelog
- Cloud-assisted contracts are documented for future implementation

---

## Related Docs

- `Docs/architecture/00_ARCHITECTURE_OVERVIEW.md` — system layers
- `Docs/architecture/08_MONOREPO_STRUCTURE.md` — package layout
- `apps/studio/package.json` — current build config
- `apps/studio/scripts/validate-deploy-profile.mjs` — existing validation script

## Implementation Notes

- The deploy-profile validator now resolves the studio root from its own script location, so the documented `cd apps/studio && npm run deploy:validate*` flow works reliably instead of depending on the caller's current working directory.
