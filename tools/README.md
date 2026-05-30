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

## Webwright QA

Use the shared Webwright bootstrap for screenshot + browser-flow checks:

```bash
source tools/webwright/venv.env
./tools/webwright/run-sentineltwin-qa.sh --bootstrap
./tools/webwright/run-sentineltwin-qa.sh --dry-run

# if model keys are available
./tools/webwright/run-sentineltwin-qa.sh --run
```

Contract:

- Use Python `3.13` for Python-based QA work in this repo.
- Use `uv` for venv + install operations (no one-off `pip` installs).
- Shared venv for all automation: `/tmp/webwright-sentinel`.
- Shared UV cache: `/private/tmp/uv-cache`.
- Shared Playwright cache: `/private/tmp/ms-playwright`.

```bash
source tools/webwright/venv.env
```

All agents should reuse this venv and avoid creating a new local Python env unless a new
Python runtime is required for non-webwright work.

For direct Playwright-only setup from the same venv:

```bash
source tools/webwright/venv.env
"${WEBWRIGHT_VENV_PATH}/bin/python" -m playwright install chromium
```

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

## Studio Quality Gate

Run the full studio quality gate used by CI:

```bash
./tools/studio-quality-gate.sh
```

It runs:
- TypeScript typecheck
- Trust audit
- Goal4-focused UI contract tests
- Production build

## Deployment Profile Validation

Deployment profiles live in `apps/studio/deploy/profiles/` and can be validated with:

```bash
cd apps/studio
npm run deploy:validate
npm run deploy:validate:self-hosted
npm run deploy:validate:cloud-assisted
```

The validator resolves the studio root from its own script location, so the same commands also work when they are invoked through `apps/studio/package.json` scripts.

## Store Method Injector

`store-method-injector.ts` is a code-injection script that uses regex-based search-and-replace
to add store methods to `apps/studio/src/store/studio-store.ts`. It was used by an agent
subagent to add counterfactual engine integration when direct file editing wasn't available.

**Purpose:** Documents the injection pattern for agent-based store patching when the store
file is too large for typical edit tools. The logic it injects (counterfactual plans,
preview/apply/revert workflow) is already committed — the script exists as a reference.

Run from repo root:
```bash
bun tools/store-method-injector.ts
```
