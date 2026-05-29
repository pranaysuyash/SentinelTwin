# Webwright QA for SentinelTwin

This folder contains a reusable QA bootstrap for browser-based checks using **Webwright**.

## What this does

- Creates/reuses a shared uv venv at `/tmp/webwright-sentinel` (Python `3.13`).
- Installs Webwright into that venv when possible.
- Checks SentinelTwin route reachability.
- Optionally runs Webwright smoke checks when model credentials are configured.
- Emits a run manifest and route artifacts under `qa-output/`.

This contract is intentionally shared by all agents and automation to avoid duplicated
Python environments and inconsistent package state.

## Venv contract (shared for all agents)

- Environment: `python3.13`
- Package manager: `uv`
- Shared venv: `/tmp/webwright-sentinel`
- Shared UV cache: `/private/tmp/uv-cache`
- Shared Playwright cache: `/private/tmp/ms-playwright`

Recommended agent usage:

```bash
source tools/webwright/venv.env
```

All future Python/Webwright work in this repo should reuse this venv unless there is a compatibility reason to create a new one.

If a session requires Playwright-only usage outside Webwright, pass the same cache envs and venv path so browser binaries stay shared.

```bash
source tools/webwright/venv.env
"${WEBWRIGHT_VENV_PATH}/bin/python" -m playwright install chromium
```

Any new Python tooling in `tools/` should follow this same contract:
install/run from `/tmp/webwright-sentinel` with `uv pip ... --python` and avoid unrelated new local venvs.

## Prerequisites

- Internet access to install Python packages and Playwright browsers.
- `python3.13` and `uv` available on PATH.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENROUTER_API_KEY` when running model-backed Webwright tasks.

## Run

From repo root:

```bash
# Dry check only
./tools/webwright/run-sentineltwin-qa.sh --dry-run

# Prepare shared venv + attempt install once (offline hosts will record bootstrap_error in manifest)
./tools/webwright/run-sentineltwin-qa.sh --bootstrap

# Smoke check with HTTP reachability only
./tools/webwright/run-sentineltwin-qa.sh

# Execute Webwright routes (requires model key + installed dependencies)
./tools/webwright/run-sentineltwin-qa.sh --run
```

## Troubleshooting (offline-first)

If package installs fail with DNS errors for `pypi.org`, this host cannot fetch dependencies.
In that state:

- Do not rerun package install in a tight loop.
- Keep the script for checks and evidence collection.
- Re-run once DNS/network is restored.

For browser failures after install, run:

```bash
UV_CACHE_DIR=/private/tmp/uv-cache python3.13 -m playwright install chromium
```

(with an online host).

## Current session status

- `uv` and `python3.13` are available in this environment.
- Webwright bootstrap is currently blocked by outbound DNS/network to `pypi.org`; manifest will show `bootstrap_error` until host network is available.
- `--dry-run` checks and route artifact capture still work while waiting for network recovery.

If you need a full offline trace without trying installs, use `--dry-run`.
