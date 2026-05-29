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

## Git Ignore Audit

Use this before `git add -A` / commit to catch generated artifacts that should be ignored.

Run from repo root:

```bash
bun tools/git-ignore-audit.ts
```

Behavior:
- exits `0` when clean (no suspicious untracked artifacts)
- exits `1` when known generated artifacts are detected and prints suggested `.gitignore` entries
- exits `2` when run outside a git repository
