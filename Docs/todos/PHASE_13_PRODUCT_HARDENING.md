# Phase 13: Product Hardening, Deployment, and Operability

**Status:** Not started
**Priority:** P1 (High)
**Dependencies:** Phase 12 (Deployment & Packaging)

---

## Goal

Harden SentinelTwin for real product operation. Transition from a locally-developed research/studio tool into a robust, observable, and enterprise-ready application platform. This involves formalizing the deployment model, establishing a background job architecture, implementing comprehensive observability, and ensuring security, privacy, and accessibility standards are met.

---

## Deliverables

### 1. Deployment Model & Runtime Environments
- **Local (Dev)**: Ensure smooth offline iteration. Standardize `bun dev` + local sqlite/IndexedDB.
- **Staging (Pre-Prod)**: Dockerized sandbox (or Vercel Preview) connected to staging PostgreSQL and S3. Used for performance budget testing and QA.
- **Production (Prod)**: Multi-tenant, highly available architecture. Document infrastructure-as-code requirements.

### 2. Environment Config & DB/Storage Strategy
- **Zod-based Config Validation**: Central `env.mjs` to strictly parse and type-check all environment variables (`NEXT_PUBLIC_*` and server-only).
- **PostgreSQL**: Define Prisma/Drizzle schemas for Workspaces, RBAC, and Users.
- **S3 Blob Storage**: Abstractions for saving large mesh assets and scenes outside the DB.

### 3. Background Job Queue
- Implement a worker architecture (e.g., BullMQ + Redis) so long-running tasks do not block the frontend or API routes.
- **Queued Tasks**:
  - Scan-to-Scene extraction.
  - Large-scale adversarial path simulation/AI data extraction.
  - PDF/Report rendering.

### 4. Observability
- **Error Tracking**: Integrate Sentry to capture unhandled frontend/backend errors.
- **Provider Degradation**: Add circuit breakers for AI providers (OpenAI/Gemini). Log structured alerts and degrade gracefully.
- **Performance**: Track Core Web Vitals (CWV) via Vercel Analytics or Datadog RUM.
- **Logging**: Structured JSON logging (Pino) for production traces.

### 5. Support Bundle Path
- **Diagnostic Tool**: Add a "Generate Support Bundle" button in the UI.
- **Contents**: Gathers local app state, anonymized IndexedDB dump, recent error logs, and the current SecurityScene JSON.
- **Output**: Generates a `.zip` file for support tickets (crucial for air-gapped/self-hosted troubleshooting).

### 6. Accessibility (A11y) Pass
- **Keyboard Navigation**: Ensure critical paths (camera placement, report viewing) work without a mouse.
- **ARIA Labels**: Semantic attributes for custom WebGL UI controls.
- **Color Contrast**: Implement deuteranomaly verification shaders for heatmaps and overlays.

### 7. Security/Privacy Surfaces
- **Data Privacy**: Encrypt data-at-rest (DB + S3) and data-in-transit (TLS 1.3).
- **Anonymization**: Scrub identifiable PII and floorplan coordinates from telemetry and support bundles unless opted-in.
- **Audit Logging**: Create an audit trail for mutations to a `SecurityScene`.

### 8. Performance Budgets & CI/QA Strategy
- **Performance Budgets**: Main JS Bundle < 350KB, LCP < 2.5s, JS Heatmap compute < 200ms.
- **CI/QA**: GitHub Actions for `typecheck`, `lint`, and `test`. 
- **Playwright/Webwright Tests**: E2E testing for the critical path (Load Scene -> Edit Camera -> Recompute).

---

## Implementation Order
1. Setup environment configuration validation (`env.mjs`).
2. Integrate error tracking and structured logging (Sentry/Pino).
3. Architect the background job queue (BullMQ/Redis) stubs.
4. Add the Support Bundle generation utility.
5. Perform the A11y pass and document violations/fixes.
6. Enforce CI checks for performance budgets and E2E Webwright tests.

---

## Success Criteria
- Deployment environments are distinctly configured and validated on boot.
- UI gracefully handles AI provider timeouts without crashing.
- Support bundle zip can be successfully downloaded containing scene state.
- CI pipeline blocks PRs that fail performance budgets or E2E E2E E2E critical paths.
- Heatmap colors are verified accessible.

