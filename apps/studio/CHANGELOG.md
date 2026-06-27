# Changelog

All notable changes to SentinelTwin Studio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-07-04

### Added
- First-run onboarding tour with 6-step guided walkthrough (`OnboardingTour.tsx`)
- Subscription scheduler for proactive ONVIF event subscription renewal (`subscription-scheduler.ts`)
- `POST /api/camera-live-connection/schedule` endpoint for manual renewal cycles
- Backend contract schemas for workspace governance (`workspace-backend-contract.ts`)
- Cross-surface integrity checks for timeline, report, compare, and publish (`integrity-checks.ts`)
- Report section deep-link system for drill-through from reports to simulation (`report-deep-links.ts`)
- Measure tool: distance-to-nearest-camera computation on click
- Comment tool: annotation placement via `addComment()`
- `docker-compose.yml` with healthcheck and env configuration
- Local contract check script (`tools/studio-contract-check.sh`)

### Fixed
- `PathReplayView.tsx`: added missing `setPlaying`, `setCurrentTime`, `setSpeed` to 4 `useCallback` dependency arrays
- `probeCameraLiveConnection`: refactored to use `buildCameraLiveConnectionRecord` constructor (eliminates inline literal drift)
- `buildCameraLiveConnectionRecord`: extended with `notes` and `timestamp` override parameters
- `deriveResolutionWidth` fallback: changed from 16:9 to 4:3 aspect ratio for more conservative PPM estimates

### Changed
- Camera model quality: resolution fallback now uses 4:3 aspect ratio (safer for compliance)
- All `useEffect` hooks verified to use `startTransition`/`queueMicrotask` correctly

### Security
- Health check endpoint `/api/health` with uptime and version info
- CSP headers and subpath asset prefixing in `next.config.js`
