# Phase 17: SDK & Extensibility

**Status:** Not started  
**Priority:** P3 (Low)  
**Dependencies:** Phase 11 (Monorepo Packages)

---

## Goal

Expose SentinelTwin's simulation engine, schema, and reporting as a public API/SDK that third-party developers can use to build custom security simulation tools, integrate with existing security platforms, or extend SentinelTwin's functionality.

---

## Current State

- All code is internal to the monorepo
- No public API surface
- No documentation for external consumption
- No plugin system for extending functionality
- A curated Studio lib facade now exists at `apps/studio/src/lib/index.ts` for stable
  integration helpers, but the publishable package/docs/CI pieces are still not done.

---

## Deliverables

### 1. Public API Surface

Define what's public vs internal:

| Package | Public API | Status |
|---------|-----------|--------|
| `@sentineltwin/simulation` | Full: coverage engine, adversarial path, temporal sim | Internal only |
| `@sentineltwin/core` | Schema types, Zod validators, store interfaces | Internal only |
| `@sentineltwin/report` | Report data builders, export formats | Internal only |
| `@sentineltwin/agents` | Command parsing, structured output interfaces | Internal only |

Public API needs:
- Clean entry point exports (index.ts per package)
- No internal-only functions leaked
- TypeDoc/JSDoc on all public surfaces
- Versioned API (semver)

### 2. NPM Publication

- Each `@sentineltwin/*` package publishable to npm
- CI workflow for automated publishing
- Package README with usage examples
- Proper `package.json` (main, types, exports, module)

### 3. Documentation

- API reference docs (generated from JSDoc)
- Quickstart guide for each package
- Integration examples:
  - "Run coverage analysis from Node.js"
  - "Generate a compliance report programmatically"
  - "Build a custom camera placement optimizer"
- Migration guide for version bumps

### 4. Plugin System (Future)

- Plugin registration interface
- Lifecycle hooks: onSceneLoad, onSimulationRun, onReportGenerate, onExport
- Sandboxed plugin execution (Web Worker)
- Plugin manifest format (package.json-like)
- Plugin catalog/store concept

---

## Implementation Order

1. Clean public API surfaces per package
2. JSDoc/TypeDoc documentation
3. NPM publication CI workflow
4. Quickstart guides and examples
5. Plugin system design and prototyping (future)

---

## Success Criteria

- `npm install @sentineltwin/simulation` works and exposes documented API
- A developer can run coverage analysis in 5 lines of code from their project
- API docs are clear and complete
- Plugin interface design is documented

---

## Related Docs

- `Docs/architecture/08_MONOREPO_STRUCTURE.md`
- `Docs/todos/PHASE_11_MONOREPO_PACKAGES.md`
