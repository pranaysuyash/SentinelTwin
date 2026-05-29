# SentinelTwin Hackathon Readiness Audit

**Date:** 2026-05-29  
**Scope:** readiness for same-day hackathon submission and deployment

## Bottom Line

The studio is close, but it is not deploy-ready yet.

The current app is functionally coherent and the trust-audit surface passes, but the production gate is still blocked by:

1. a Next.js typecheck failure in a route file,
2. multiple ESLint errors in hot-path UI/report files,
3. four failing tests,
4. a README/runbook that still describes the wrong package-manager flow,
5. no explicit repo-level deploy target/config was found.

## What I Verified

- `apps/studio` is the active deployable surface.
- `apps/studio/package.json` defines the app scripts (`build`, `lint`, `test`, `start`, `dev`).
- `apps/studio/README.md` documents local run/build/test instructions.
- `apps/studio/src/lib/truth-audit.ts` passes with `Status: PASS`.
- Direct production build gets through compilation, then fails during typecheck.
- Direct lint fails with real code errors, not just warnings.
- Direct test run is mostly green, but four tests still fail.

## Blockers

### 1. Build blocker: TypeScript error in API route

- File: [`apps/studio/src/app/api/camera-live-connection/route.ts`](../apps/studio/src/app/api/camera-live-connection/route.ts)
- Symptom: `ok` is specified more than once in the object passed to `appendCameraLiveConnectionHistory(...)`.
- Why it matters: `next build --webpack` fails during typecheck, so this blocks a production deploy.
- Fastest fix path: remove the duplicate property or reorder the spread so the archive record is formed from one canonical `ok` field.
- Follow-up: the current live `route.ts` source no longer shows the duplicate `ok` property, so this item should be treated as resolved unless a fresh typecheck reproduces it.

### 2. Lint blockers: React hook purity / set-state-in-effect

These are not cosmetic. They are hard ESLint errors under the current rule set.

- [`apps/studio/src/app/page.tsx`](../apps/studio/src/app/page.tsx)
- [`apps/studio/src/components/bottom-panel/DebugTab.tsx`](../apps/studio/src/components/bottom-panel/DebugTab.tsx)
- [`apps/studio/src/components/bottom-panel/GovernanceTab.tsx`](../apps/studio/src/components/bottom-panel/GovernanceTab.tsx)
- [`apps/studio/src/components/bottom-panel/SceneIntelligenceTab.tsx`](../apps/studio/src/components/bottom-panel/SceneIntelligenceTab.tsx)
- [`apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx`](../apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx)
- [`apps/studio/src/components/view/CameraViewMode.tsx`](../apps/studio/src/components/view/CameraViewMode.tsx)
- [`apps/studio/src/components/view/CameraWallView.tsx`](../apps/studio/src/components/view/CameraWallView.tsx)

Typical failure shape:
- synchronous `setState(...)` inside `useEffect`
- impure render-time `Date.now()`
- conditional hook ordering

Why it matters:
- lint is part of the app’s release hygiene
- these files sit in the primary UI and review flows, so they are likely to regress user-facing behavior if left unresolved

### 3. Lint blockers: typing issues in report/render code

- [`apps/studio/src/components/view/PathReplayView.tsx`](../apps/studio/src/components/view/PathReplayView.tsx)
- [`apps/studio/src/report/index.ts`](../apps/studio/src/report/index.ts)
- [`apps/studio/src/report/__tests__/report-engine.test.ts`](../apps/studio/src/report/__tests__/report-engine.test.ts)

Observed issues:
- explicit `any` usage in the report mapping path
- `controlsRef as any` in `PathReplayView`
- report test expectation mismatch around `changeLogEntryCount`

Why it matters:
- the report path is a hackathon-facing deliverable
- these errors point to incomplete typing and/or a stale test contract

### 4. Test blockers

Failing tests from `bun test`:

- `CameraWallView > surfaces live/offline counts, a layout selector, and the selected camera in the wall header`
- `SceneIntelligenceTab > supports interactive provenance inspection and trace focus`
- `report engine > buildReportData produces complete report`
- `sensor-ingest route > pulls an external feed URL through the canonical ingest route`

Relevant files:
- [`apps/studio/src/components/view/CameraWallView.tsx`](../apps/studio/src/components/view/CameraWallView.tsx)
- [`apps/studio/src/components/bottom-panel/SceneIntelligenceTab.tsx`](../apps/studio/src/components/bottom-panel/SceneIntelligenceTab.tsx)
- [`apps/studio/src/report/index.ts`](../apps/studio/src/report/index.ts)
- [`apps/studio/src/app/api/sensor-ingest/route.ts`](../apps/studio/src/app/api/sensor-ingest/route.ts)
- [`apps/studio/src/lib/sensor-live-ingest.ts`](../apps/studio/src/lib/sensor-live-ingest.ts)

Likely causes:
- the Camera Wall and Scene Intelligence tests are out of sync with the current UI text/interaction contract
- the report engine no longer guarantees a non-empty evidence trail for a pristine demo scene
- the sensor ingest external-feed test probably uses a sensor fixture that no longer matches the current `sensorNodeSchema`

### 5. Documentation / release hygiene gaps

- [`apps/studio/README.md`](../apps/studio/README.md) still says `npm install` / `npm run dev` / `npm run build`, but the workspace is pnpm/Bun-based.
- No explicit `vercel.json`, Dockerfile, or other repo-level deploy manifest was found in the current tree.

Why it matters:
- a hackathon submission needs a clear and repeatable deploy path
- the current docs would send a new operator down the wrong setup route

## What Is Already Good

- The app-specific trust audit passes.
- The simulation and temporal suites are broadly healthy.
- The repo already has a coherent studio surface and a clear current-implementation baseline.
- The local-only / provider-health flow is visible in the product instead of hidden in code.

## Same-Day Recovery Path

1. Fix the build stopper in `apps/studio/src/app/api/camera-live-connection/route.ts`.
2. Clean up the hard ESLint errors in the UI files above.
3. Decide whether the failing tests need code fixes or expectation updates.
4. Re-run:
   - `./node_modules/.bin/next build --webpack`
   - `./node_modules/.bin/eslint`
   - `bun test`
5. Update `apps/studio/README.md` to match the real workspace commands.
6. Pick the actual deployment target and wire the submission URL.

## Notes

- The package-manager bootstrap failures I hit while running `pnpm` in parallel look environmental and were not the primary blocker. The direct app binaries were enough to surface the real code issues.
- The current audit is intentionally conservative: “close enough” is not the same as “safe to submit.” The repo is close, but the build/lint/test gates still need to go green.
