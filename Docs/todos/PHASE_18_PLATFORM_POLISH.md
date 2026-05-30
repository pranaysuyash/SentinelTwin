# Phase 18: Platform Polish

**Status:** Not started  
**Priority:** P3 (Low)  
**Dependencies:** Phases 11–17

---

## Goal

Polish the platform for production readiness: accessibility auditing, performance optimization, error recovery, graceful degradation, and hardening the user experience for real-world use.

---

## Current State

- Basic accessibility (labeled controls exist)
- No systematic accessibility audit
- No performance budget enforcement
- No error recovery flows for edge cases
- No graceful degradation when backend/database unavailable

---

## Deliverables

### 1. Accessibility

- WCAG 2.1 AA audit
- Screen reader testing (VoiceOver on macOS)
- Focus management and keyboard navigation
- Color contrast verification
- ARIA labels on all interactive elements
- Focus trap management in modals/dialogs
- Reduced motion support for animations
- Touch target sizing for tablet use

### 2. Performance

- Performance budget:
  - Initial load: < 2s on 3G
  - Scene load: < 1s
  - Coverage recompute: < 100ms
  - Report generation: < 500ms
- Bundle size monitoring:
  - Main JS: < 300KB gzip
  - Three.js chunk: loaded on demand
- Image optimization pipeline
- Code splitting and lazy loading audit
- Animation frame budget (60fps guaranteed)

### 3. Error Recovery

- Global error boundary with:
  - Graceful error display
  - Retry action
  - "Reset to safe state" option
  - Error details for bug reporting
- Studio error boundary now exposes both Retry and Reset to safe state for blank-scene recovery.
- Simulation engine error handling:
  - Invalid scene → descriptive error message
  - Missing camera data → graceful fallback
  - BVH computation failure → fallback to simpler raycasting
- Storage error handling:
  - IndexedDB full → clear cache prompt
  - IndexedDB unavailable → in-memory fallback with warning
- Network error handling:
  - Backend unavailable → show cached data
  - Sync failure → local-only mode with notification

### 4. Loading & Empty States

- Skeleton screens for all loading states
- Empty state illustrations for:
  - No scenes yet
  - No cameras placed
  - No simulation run yet
  - No report generated
  - No search results
- Transition animations between states

### 5. Cross-Browser Testing

- Modern browsers: Chrome, Firefox, Safari, Edge
- Safari-specific fixes (WebGL, IndexedDB, CSS)
- Firefox-specific fixes
- Legacy browser graceful degradation

### 6. Telemetry & Monitoring (Opt-in)

- Error tracking integration (Sentry)
- Performance monitoring
- Feature usage analytics
- Privacy-preserving (opt-in, GDPR-compliant)
- No PII collected

### 7. Documentation Polish

- User guide / help system
- In-app tooltips for all tools and panels
- Keyboard shortcut reference
- FAQ / troubleshooting guide

---

## Implementation Order

1. Critical performance bottlenecks (bundle size, code splitting)
2. Error boundaries and simulation engine error handling
3. Loading and empty states
4. Accessibility audit (WCAG 2.1 AA)
5. Cross-browser testing and fixes
6. Telemetry setup (opt-in)
7. Documentation and help system

---

## Success Criteria

- WCAG 2.1 AA compliance verified
- Performance budgets met (measured)
- Scenes load without errors in Chrome, Firefox, Safari, Edge
- Invalid scene states produce helpful error messages
- Empty states are informative and actionable
- Telemetry captures errors without PII

---

## Related Docs

- `Docs/architecture/00_ARCHITECTURE_OVERVIEW.md`
- `apps/studio/package.json`
