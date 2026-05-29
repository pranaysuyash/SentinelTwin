# Tools

Reusable repo-level helpers live here.

## Truth Audit

The trust audit checks the current studio claim surfaces against the product manifest so placeholder drift or stale copy gets caught early.

Run it from `apps/studio`:

```bash
bun ../../tools/truth-audit.ts
```

Or run it from the repo root with an explicit app root:

```bash
bun tools/truth-audit.ts --root apps/studio
```

The audit currently covers:
- project launcher scan flow copy
- guided scan kickoff copy
- product feature status manifest
- provenance and operational memory surface
- bottom-panel sensor wiring
