# Architecture 10: Product Hardening, Deployment, and Operability

## 1. Deployment Model
SentinelTwin adopts a **Hybrid Deployment Model** to serve local development, enterprise self-hosting, and future SaaS capabilities.

- **Local-Only (Air-gapped/Desktop)**: The default V0.1 environment. Uses IndexedDB for state persistence. Runs entirely in the browser after serving static assets.
- **Self-Hosted (Enterprise On-Prem)**: A containerized environment using Docker Compose. Services include the Next.js frontend/BFF, PostgreSQL for relational data, and local file storage (or MinIO) for scenes/assets.
- **Cloud-Assisted (SaaS)**: A multi-tenant deployment architecture targeting AWS/Vercel. Leverages Vercel for the Next.js frontend, AWS RDS (PostgreSQL) for the database, AWS S3 for object storage, and AWS SQS/Redis for background jobs.

## 2. Runtime Environments
We define three distinct runtime environments:

1. **Local (Dev)**:
   - Command: `bun dev` or `npm run dev`
   - Database: Local SQLite or IndexedDB (browser-based fallback).
   - Storage: Local filesystem `tmp/` or IndexedDB.
   - Purpose: Rapid iteration, debugging, offline work.

2. **Staging (Pre-Prod)**:
   - Command: Dockerized container run or deployed to Vercel Preview environments.
   - Database: Managed PostgreSQL (sandbox).
   - Storage: S3-compatible sandbox bucket.
   - Purpose: QA, performance budget testing, stakeholder preview.

3. **Production (Prod)**:
   - Command: Optimized production build `bun run build && bun start` or container orchestration.
   - Database: Highly available PostgreSQL (e.g., AWS RDS).
   - Storage: Geo-redundant S3 buckets.
   - Purpose: End-user facing platform, strict SLA, metrics, and error tracking enabled.

## 3. Environment Config Strategy & DB/Storage Plan

**Config Strategy**:
- 12-Factor App methodology for configuration.
- A central `env.mjs` (using Zod) to parse and validate all environment variables at runtime/build-time.
- Variables categorized into: `NEXT_PUBLIC_*` (client-safe) and standard vars (server-only).

**DB / Storage Plan**:
- **Database**: PostgreSQL as the primary canonical data store for User Accounts, Workspaces, and RBAC (Role-Based Access Control). Prisma ORM to manage migrations.
- **Storage**: S3 API-compatible blob storage. Scene definitions, mesh assets (.glb/.gltf), and large analytical reports are stored in blob storage with references kept in the DB.

## 4. Background Job Queue
Long-running processes should not block the main Node.js event loop.
- **Queue Technology**: BullMQ backed by Redis for self-hosted/prod environments.
- **Worker Pools**: Distinct worker containers scale independently based on queue depth.
- **Tasks**:
  1. **Scan-to-Scene Processing**: Ingesting point clouds/LiDAR to generate base meshes.
  2. **Data Extraction**: AI agent asynchronous processing of coverage analysis and adversarial path finding.
  3. **Rendering & Export**: Generating high-fidelity coverage map PDFs and report bundling.

## 5. Observability (Errors, Performance, Provider Failures)
- **Error Tracking**: Sentry (or equivalent) for capturing unhandled exceptions on frontend and backend. 
- **Provider Failures**: AI Provider abstractions (OpenAI, Gemini) wrap calls in circuit breakers. If an AI provider degrades, the system falls back to a deterministic mode or alternative model and logs a structured alert.
- **Performance Monitoring**: Core Web Vitals (CWV) tracked via Vercel Analytics or Datadog RUM.
- **Logs**: Structured JSON logging (Pino) to centralize traces.

## 6. Support Bundle Path
To rapidly unblock enterprise users on air-gapped or self-hosted systems:
- A `Generate Support Bundle` diagnostic tool in the UI.
- Gathers: Local app state, browser IndexedDB dump (anonymized), error logs, and current SecurityScene JSON.
- Output: A downloaded `.zip` file the user can attach to support tickets.

## 7. Accessibility (A11y) Pass
SentinelTwin must be operable in diverse environments:
- **Keyboard Navigation**: Critical paths (placing a camera, viewing a report, panning the map) must have keyboard equivalents.
- **ARIA Labels**: All custom UI controls, especially the WebGL overlay controls, need semantic ARIA attributes.
- **Color Contrast**: WebGL scene overlays and heatmap colors are verified for deuteranomaly (red-green colorblindness) accessibility using specific post-processing shaders.

## 8. Security/Privacy Surfaces
- **Data Privacy**: SentinelTwin often handles sensitive physical security layouts. 
- **Encryption**: Data-at-rest encryption for the database and S3 buckets. Data-in-transit via TLS 1.3.
- **Anonymization**: The support bundle and telemetry modules scrub identifiable PII and floorplan coordinates unless explicitly opted-in by the tenant.
- **Audit Logging**: Every mutation to a `SecurityScene` is recorded in an audit trail for compliance purposes.

## 9. Performance Budgets & CI/QA Strategy
- **Performance Budgets**:
  - Main JS Bundle: < 350KB.
  - Initial Load (LCP): < 2.5s on baseline hardware.
  - Heatmap computation (Pure JS): < 200ms for up to 50 cameras.
- **CI/QA Strategy**:
  - GitHub Actions runs `typecheck`, `lint`, and `test` on every PR.
  - Playwright integration tests (Webwright-compatible) verify the critical path: Load Scene -> Edit Camera -> Verify Coverage recomputes.
  - Visual regression testing on WebGL canvas outputs for specific test scenes.
