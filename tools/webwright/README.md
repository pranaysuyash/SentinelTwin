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

## Full app demo recorder

`record_full_demo.py` is the rerunnable browser evidence path for the product home and Studio demo.
It records a continuous browser video, step screenshots, console/page-error summaries, and a
structured `run-log.json`. The target may be local or deployed; the recorder only checks that
`SENTINELTWIN_DEMO_URL` is reachable and does not start or manage the app server.

The current flow covers:

1. command center load,
2. Create Site Twin intake,
3. sample JSON import into Site Twin Review,
4. product settings,
5. Studio entry,
6. run-review simulation flow,
7. coverage, lighting, and blindspot overlays,
8. view settings,
9. camera view,
10. camera wall,
11. path replay,
12. compare,
13. report,
14. map return.

Run against a local server:

```bash
source tools/webwright/venv.env
SENTINELTWIN_DEMO_URL=http://127.0.0.1:3000 \
SENTINELTWIN_DEMO_RUN_ID=full-flow-$(date +%Y%m%d-%H%M%S) \
"${WEBWRIGHT_VENV_PATH}/bin/python" tools/webwright/record_full_demo.py
```

Run against a deployed target:

```bash
source tools/webwright/venv.env
SENTINELTWIN_DEMO_URL=https://sentinel-twin-studio.vercel.app/ \
"${WEBWRIGHT_VENV_PATH}/bin/python" tools/webwright/record_full_demo.py
```

Useful overrides:

- `SENTINELTWIN_DEMO_RUN_ID=<name>` to make artifact paths deterministic.
- `SENTINELTWIN_DEMO_OUT_DIR=qa-output/full-demo/<name>` to pin artifact location.
- `SENTINELTWIN_DEMO_MAX_SECONDS=<seconds>` to cap the whole run with the recorder watchdog.
- `SENTINELTWIN_DEMO_SCREENSHOT_TIMEOUT_MS=<ms>` to tune per-screenshot capture timeout.
- `SENTINELTWIN_DEMO_SAMPLE_JSON_PATH=<path>` to use a different import sample.
- `SENTINELTWIN_DEMO_REQUIRE_JSON_SAMPLE=0` to attempt sample import but keep recording when it is unavailable.
- `SENTINELTWIN_DEMO_STRICT=1` to make home/mode/operator-edit/demo-signal checks fail the run.

Artifacts land under `qa-output/full-demo/<run-id>/` with screenshots, video, and `run-log.json`.
The JSON intake check sets the app's `.json` file input directly through Playwright and verifies the
review screen with the imported scene name from the sample payload, avoiding brittle dependence on
button or heading copy. `run-log.json` includes `target_ready`, `video_artifacts`,
`screenshot_artifacts`, and `artifact_dir` entries so deployed and local runs report artifacts with
the same labels.

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

### Run mode meaning

`run-sentineltwin-qa.sh` reports `webwright_run_mode` in `qa-output/manifest.json`:

- `venv_cli`: `WEBWRIGHT_VENV_PATH/bin/webwright` is available.
- `source_module`: Python source is importable through the local Webwright checkout with `-m webwright.run.cli` and can be executed without a package install.
- `venv_module`: installed module available but no dedicated `webwright` CLI binary.
- `absent`: no executable module path discovered.

If DNS/network prevents package install, you may still see `source_module` and keep running `--dry-run` checks; runtime route execution still requires model keys and browser availability.

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
