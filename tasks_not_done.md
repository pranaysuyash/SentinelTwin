# SentinelTwin - Tasks Not Done

This document consolidates all the incomplete tasks, known blockers, and pending issues identified during the readiness audits and codebase reviews. We will keep adding to this list as new tasks are identified.

## 1. ESLint Errors & Warnings (Hard Blockers)
*   [ ] **Fix React Hook Purity/State Issues:** Resolve synchronous `setState` inside `useEffect` and conditional hook ordering.
    *   `apps/studio/src/components/bottom-panel/SceneIntelligenceTab.tsx` (Synchronous `setState` in effect)
    *   `apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx` (Synchronous `setState` in effect)
    *   `apps/studio/src/components/view/CameraWallView.tsx` (Conditional call of `useMemo` hook)
*   [ ] **Fix Typing & Hook Dependency Issues:**
    *   `apps/studio/src/report/__tests__/report-engine.test.ts` (Unexpected `any` usage)
    *   `apps/studio/src/components/view/PathReplayView.tsx` (Missing dependencies in `useCallback` hook)
*   [ ] **Audit Related Components:** Scan other frequently updated UI components to ensure similar anti-patterns haven't leaked elsewhere.

## 2. Documentation & Deployment Hygiene
*   [ ] **Update README Instructions:** Update `apps/studio/README.md` to reflect the correct package manager commands (`pnpm` and `bun`) instead of the stale `npm install` / `npm run dev` / `npm run build` instructions.
*   [ ] **Create Deployment Manifest:** Determine the explicit deployment target and add a `vercel.json`, `Dockerfile`, or other repository-level deployment configuration.
*   [ ] **Wire Submission URL:** Finalize the deployment target and configure the submission URL for the hackathon.
*   [ ] **Review Deployment CI/CD:** Ensure that the newly created deployment manifest integrates properly with the CI/CD pipeline being used for the hackathon deployment.

## 3. Verification/QA
*   [ ] **Run Final CI Checks:** Confirm readiness by getting all gates to pass:
    *   [ ] `./node_modules/.bin/eslint` (Currently failing)
    *   [ ] `./node_modules/.bin/next build --webpack` (Pending clean lint)

---
*Note: The product specification features (e.g., Camera Feed/Wall, Redundancy Matrix, Path Replay, Command Bar, DORI logic) and the `bun test` suite are currently passing and implemented.*