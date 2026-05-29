#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<'USAGE'
Usage:
  run-sentineltwin-qa.sh [--bootstrap] [--run] [--dry-run] [--base-url URL] [--output-dir DIR] [--routes ROUTES]

Optional:
  --bootstrap      Create/reuse shared uv venv and attempt Webwright install.
  --run            Run Webwright tasks when dependencies are fully installed.
  --dry-run        Print planned actions without mutating files.
  --base-url URL   Override Sentineltwin base URL (default: http://localhost:3010)
  --output-dir DIR Root output directory for artifacts (default: <repo>/qa-output)
  --routes ROUTES  Comma-separated routes to check (default: /,/?mode=camera_view,/?mode=wall,/?mode=replay,/?mode=compare)
  --help           Show this help text

Notes:
  - This script is designed to use Python 3.13 and uv for package setup.
  - It prefers one shared venv:
      /tmp/webwright-sentinel
  - Webwright still needs Playwright and browser binaries at runtime.
USAGE
}

BASE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VENV_PATH="${WEBWRIGHT_VENV_PATH:-/tmp/webwright-sentinel}"
WEBWRIGHT_SRC="${WEBWRIGHT_SOURCE:-/Users/pranay/.codex/.tmp/marketplaces/webwright}"
UV_CACHE_DIR="${WEBWRIGHT_UV_CACHE_DIR:-/private/tmp/uv-cache}"
PYTHON_BIN="${WEBWRIGHT_PYTHON_BIN:-python3.13}"
MSWEBA_GLOBAL_CONFIG_DIR="${MSWEBA_GLOBAL_CONFIG_DIR:-/private/tmp/webwright-config}"
WEBWRIGHT_BOOTSTRAP_ERROR=""
OUT_ROOT="${WEBWRIGHT_QA_OUTPUT:-$BASE_DIR/qa-output}"
BASE_URL="${SENTINELTWIN_BASE_URL:-http://localhost:3010}"
PLAYWRIGHT_CACHE="${PLAYWRIGHT_CACHE_DIR:-/private/tmp/ms-playwright}"
RUN_WEBWRIGHT=0
DRY_RUN=0
BOOTSTRAP_ONLY=0
ROUTES="/,/?mode=camera_view,/?mode=wall,/?mode=replay,/?mode=compare"

WEBWRIGHT_READY=0
WEBWRIGHT_RUN_MODE="absent"
PLAYWRIGHT_READY=0

action_count=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run)
      RUN_WEBWRIGHT=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --bootstrap)
      BOOTSTRAP_ONLY=1
      shift
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --output-dir)
      OUT_ROOT="$2"
      shift 2
      ;;
    --routes)
      ROUTES="$2"
      shift 2
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Run with --help for usage." >&2
      exit 1
      ;;
  esac
done

action() {
  local msg="$1"
  action_count=$((action_count + 1))
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$msg"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "MISSING: $cmd"
    return 1
  fi
  return 0
}

ensure_python() {
  if ! require_command "$PYTHON_BIN"; then
    echo "ERROR: python command '$PYTHON_BIN' not found. Set WEBWRIGHT_PYTHON_BIN to a valid interpreter." >&2
    return 1
  fi

  local version
  version="$($PYTHON_BIN - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY)"
  if [[ "$version" != 3.13 ]]; then
    echo "WARN: python version is $version, expected 3.13 for this project venv contract."
  fi
}

ensure_dependencies() {
  if ! require_command uv; then
    echo "ERROR: uv is not installed." >&2
    return 1
  fi

  if [ ! -f "$WEBWRIGHT_SRC/pyproject.toml" ]; then
    echo "ERROR: WEBWRIGHT source not found: $WEBWRIGHT_SRC" >&2
    return 1
  fi
}

prepare_venv() {
  if [ -d "$VENV_PATH" ] && [ -x "$VENV_PATH/bin/python" ]; then
    action "Reusing existing venv at $VENV_PATH"
    return 0
  fi

  action "Creating venv at $VENV_PATH"
  if [[ "$DRY_RUN" == "1" ]]; then
    action "DRY RUN: skip uv venv creation"
    return 0
  fi

  UV_CACHE_DIR="$UV_CACHE_DIR" uv venv --python "$PYTHON_BIN" "$VENV_PATH"
}

bootstrap_venv() {
  local venv_py="$VENV_PATH/bin/python"

  if [[ ! -x "$venv_py" ]]; then
    action "SKIP bootstrap: no venv python at $venv_py"
    return 1
  fi

  if [[ "$DRY_RUN" == "0" ]]; then
    action "Running ensurepip to seed bootstrap tooling in venv"
    "$venv_py" -m ensurepip --upgrade || true
  fi

  action "Attempting editable install of webwright from local source"
  if [[ "$DRY_RUN" == "1" ]]; then
    action "DRY RUN: skip webwright installation"
    return 0
  fi

  if UV_CACHE_DIR="$UV_CACHE_DIR" uv pip install --python "$venv_py" -e "$WEBWRIGHT_SRC"; then
    WEBWRIGHT_READY=1
    WEBWRIGHT_BOOTSTRAP_ERROR=""
    return 0
  fi
  WEBWRIGHT_BOOTSTRAP_ERROR="Install blocked: uv could not fetch build dependencies (offline index/seed)."

  # fallback without dependency resolution when build-system deps are unavailable
  if UV_CACHE_DIR="$UV_CACHE_DIR" uv pip install --python "$venv_py" --no-deps -e "$WEBWRIGHT_SRC"; then
    WEBWRIGHT_READY=1
    WEBWRIGHT_BOOTSTRAP_ERROR=""
    return 0
  fi
  WEBWRIGHT_BOOTSTRAP_ERROR="Install blocked: uv editable install failed without dependency resolution."

  if "$venv_py" -m pip install --no-deps -e "$WEBWRIGHT_SRC"; then
    WEBWRIGHT_READY=1
    WEBWRIGHT_BOOTSTRAP_ERROR=""
    return 0
  fi
  WEBWRIGHT_BOOTSTRAP_ERROR="Install blocked: pip editable install failed (missing setuptools.build_meta or cached build backend)."

  cat <<EOFERR
ERROR: Webwright install blocked (offline index/seed). To complete bootstrap:
1) Run on an online host with DNS/network.
2) Install build/runtime deps in $VENV_PATH: pip install -e "$WEBWRIGHT_SRC" .
3) Re-run with --bootstrap.
4) Confirm cache paths:
   - UV cache: $UV_CACHE_DIR
   - Playwright cache: $PLAYWRIGHT_CACHE
EOFERR
  WEBWRIGHT_READY=0
  return 0
}

check_webwright_install() {
  local venv_py="$VENV_PATH/bin/python"

  if [ -x "$VENV_PATH/bin/webwright" ]; then
    action "Webwright CLI found in venv"
    WEBWRIGHT_READY=1
    WEBWRIGHT_RUN_MODE="venv_cli"
    return 0
  fi

  if WEBWRIGHT_SOURCE="$WEBWRIGHT_SRC" "${venv_py}" - <<'PY' >/dev/null 2>&1
import os
import sys

sys.path.insert(0, os.path.join(os.environ.get("WEBWRIGHT_SOURCE", ""), "src"))

import webwright
from webwright.run import cli  # noqa: F401

sys.exit(0)
PY
  then
    action "Webwright module importable from venv/runtime source path"
    WEBWRIGHT_READY=1
    WEBWRIGHT_RUN_MODE="source_module"
    return 0
  fi

  if [ -f "$WEBWRIGHT_SRC/src/webwright/__init__.py" ]; then
    if WEBWRIGHT_SOURCE="$WEBWRIGHT_SRC" MSWEBA_GLOBAL_CONFIG_DIR="$MSWEBA_GLOBAL_CONFIG_DIR" "${venv_py}" - <<'PY' >/dev/null 2>&1
import os
import sys
sys.path.insert(0, os.path.join(os.environ["WEBWRIGHT_SOURCE"], "src"))
import webwright
from webwright.run import cli  # noqa: F401
sys.exit(0)
PY
    then
      action "Using local Webwright source in fallback mode"
      WEBWRIGHT_READY=1
      WEBWRIGHT_RUN_MODE="source_module"
      return 0
    fi
  fi

  WEBWRIGHT_READY=0
  WEBWRIGHT_RUN_MODE="absent"
  return 1
}

check_playwright_browser() {
  if [[ ! -d "$PLAYWRIGHT_CACHE" ]]; then
    action "Playwright cache missing: $PLAYWRIGHT_CACHE"
    action "Run: UV_CACHE_DIR=$UV_CACHE_DIR PLAYWRIGHT_DOWNLOAD_HOST=<host> $PYTHON_BIN -m playwright install chromium"
    PLAYWRIGHT_READY=0
    return 1
  fi

  if find "$PLAYWRIGHT_CACHE" -maxdepth 6 -type d \( -name 'chromium-*' -o -name 'chrome-*' \) | grep -q .; then
    action "Playwright cache contains browser artifacts."
    PLAYWRIGHT_READY=1
    return 0
  fi

  action "Playwright cache exists but no obvious browser artifacts found."
  PLAYWRIGHT_READY=0
  return 1
}

url_from_route() {
  local route="$1"
  if [[ "$route" == http* ]]; then
    printf '%s' "$route"
    return
  fi

  if [[ "$route" == /* ]]; then
    printf '%s%s' "$BASE_URL" "$route"
  else
    printf '%s/%s' "$BASE_URL" "$route"
  fi
}

check_paths() {
  IFS=',' read -r -a ROUTE_LIST <<< "$ROUTES"
  for route in "${ROUTE_LIST[@]}"; do
    local route_url
    route_url="$(url_from_route "$route")"
    action "HTTP check: $route_url"
    if command -v curl >/dev/null 2>&1; then
      local code
      code="$(curl -L -o /dev/null -s -w "%{http_code}" "$route_url" || echo -1)"
      echo "${route}|${code}|curl" >> "${OUT_ROOT}/routes.txt"
    else
      echo "${route}|SKIP|curl_missing" >> "${OUT_ROOT}/routes.txt"
    fi

    # Artifact path for a future run
    echo "$route_url" >> "$OUT_ROOT/route_urls.txt"
  done
}

run_webwright_smoke() {
  if [[ "$RUN_WEBWRIGHT" != "1" ]]; then
    action "Skipping webwright run (use --run)."
    return 0
  fi

  if [[ "$RUN_WEBWRIGHT" == "1" ]] && [[ "$WEBWRIGHT_READY" != "1" ]]; then
    echo "SKIP webwright run: Webwright runtime unavailable. Re-run with --bootstrap." >&2
    return 0
  fi

  if [[ -z "${OPENAI_API_KEY:-}" ]] && [[ -z "${ANTHROPIC_API_KEY:-}" ]] && [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
    echo "SKIP webwright run: no model key available (OPENAI_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY)." >&2
    return 0
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    action "DRY RUN: webwright execution skipped."
    return 0
  fi

  local cmd
  local command_type
  local pythonpath_override=""
  if [[ "$WEBWRIGHT_RUN_MODE" == "venv_cli" ]]; then
    cmd=("$VENV_PATH/bin/webwright")
    command_type='cli'
  elif [[ "$WEBWRIGHT_RUN_MODE" == "venv_module" ]]; then
    cmd=("$VENV_PATH/bin/python" "-m" "webwright.run.cli")
    command_type='module'
  elif [[ "$WEBWRIGHT_RUN_MODE" == "source_module" ]]; then
    cmd=("$VENV_PATH/bin/python" "-m" "webwright.run.cli")
    command_type='source-module'
    pythonpath_override="$WEBWRIGHT_SRC/src"
  else
    echo "SKIP webwright run: no runnable webwright mode selected." >&2
    return 0
  fi

  local route_idx=0
  IFS=',' read -r -a ROUTE_LIST <<< "$ROUTES"
  for route in "${ROUTE_LIST[@]}"; do
    local route_url
    route_url="$(url_from_route "$route")"
    local task="Take a full-page check and screenshot for SentinelTwin route: ${route_url}"
    local task_id="sentinel-route-$(printf '%02d' "$route_idx")"
    ((route_idx+=1))

    action "Running webwright ($command_type) for $route_url"
    if [[ -n "$pythonpath_override" ]]; then
      MSWEBA_GLOBAL_CONFIG_DIR="$MSWEBA_GLOBAL_CONFIG_DIR" PYTHONPATH="$pythonpath_override:${PYTHONPATH-}" "${cmd[@]}" \
        -c base.yaml -c model_openai.yaml \
        -t "$task" \
        --start-url "$route_url" \
        --task-id "$task_id" \
        -o "$OUT_ROOT/webwright" || true
      continue
    fi

    MSWEBA_GLOBAL_CONFIG_DIR="$MSWEBA_GLOBAL_CONFIG_DIR" "${cmd[@]}" \
      -c base.yaml -c model_openai.yaml \
      -t "$task" \
      --start-url "$route_url" \
      --task-id "$task_id" \
      -o "$OUT_ROOT/webwright" || true
  done
}

record_manifest() {
  local manifest_path="$OUT_ROOT/manifest.json"
  MANIFEST_PATH="$manifest_path" \
  WEBWRIGHT_READY="$WEBWRIGHT_READY" \
  PLAYWRIGHT_READY="$PLAYWRIGHT_READY" \
  RUN_WEBWRIGHT="$RUN_WEBWRIGHT" \
  DRY_RUN="$DRY_RUN" \
  BOOTSTRAP_ONLY="$BOOTSTRAP_ONLY" \
  ROUTES="$ROUTES" \
  VENV_PATH="$VENV_PATH" \
  WEBWRIGHT_RUN_MODE="$WEBWRIGHT_RUN_MODE" \
  WEBWRIGHT_SRC="$WEBWRIGHT_SRC" \
  OUT_ROOT="$OUT_ROOT" \
  BASE_DIR="$BASE_DIR" \
  BASE_URL="$BASE_URL" \
  UV_CACHE_DIR="$UV_CACHE_DIR" \
  PLAYWRIGHT_CACHE="$PLAYWRIGHT_CACHE" \
  MSWEBA_GLOBAL_CONFIG_DIR="$MSWEBA_GLOBAL_CONFIG_DIR" \
  BOOTSTRAP_ERROR="$WEBWRIGHT_BOOTSTRAP_ERROR" \
  "$PYTHON_BIN" - <<'PY'
import json
import os
from pathlib import Path

manifest_data = {
    "base_dir": os.environ.get("BASE_DIR"),
    "base_url": os.environ.get("BASE_URL"),
    "venv_path": os.environ.get("VENV_PATH"),
    "webwright_source": os.environ.get("WEBWRIGHT_SRC"),
    "output_dir": os.environ.get("OUT_ROOT"),
    "run_webwright": os.environ.get("RUN_WEBWRIGHT") == "1",
    "bootstrap_only": os.environ.get("BOOTSTRAP_ONLY") == "1",
    "dry_run": os.environ.get("DRY_RUN") == "1",
    "webwright_ready": os.environ.get("WEBWRIGHT_READY") == "1",
    "webwright_run_mode": os.environ.get("WEBWRIGHT_RUN_MODE"),
    "playwright_ready": os.environ.get("PLAYWRIGHT_READY") == "1",
    "bootstrap_error": os.environ.get("BOOTSTRAP_ERROR", ""),
    "routes": os.environ.get("ROUTES", "").split(","),
    "route_status_file": "routes.txt",
    "notes": [
        "Set WEBWRIGHT_PYTHON_BIN=python3.13 (or configured interpreter) and use uv for environment management.",
        "Webwright still needs Playwright/browser binaries at runtime.",
        "Set UV cache and Playwright cache at: " + os.environ.get("UV_CACHE_DIR", "") + ", " + os.environ.get("PLAYWRIGHT_CACHE", ""),
        "Set config dir at: " + os.environ.get("MSWEBA_GLOBAL_CONFIG_DIR", "/private/tmp/webwright-config"),
        "No model key means --run is skipped even when Webwright is installed.",
    ],
}
Path(os.environ["MANIFEST_PATH"]).write_text(json.dumps(manifest_data, indent=2))
PY
}

export BASE_DIR VENV_PATH WEBWRIGHT_SRC WEBWRIGHT_RUN_MODE PYTHON_BIN OUT_ROOT BASE_URL ROUTES PLAYWRIGHT_CACHE RUN_WEBWRIGHT DRY_RUN
mkdir -p "$OUT_ROOT"
: > "$OUT_ROOT/routes.txt"
: > "$OUT_ROOT/route_urls.txt"

ensure_python
ensure_dependencies
prepare_venv

if [[ "$BOOTSTRAP_ONLY" == "1" ]]; then
  bootstrap_venv
  check_webwright_install || true
  check_playwright_browser || true
  record_manifest
  action "Bootstrap run complete. Artifacts in $OUT_ROOT"
  action "Manifest: $OUT_ROOT/manifest.json"
  echo "Status: completed."
  exit 0
fi

check_webwright_install || true
check_playwright_browser || true
check_paths
run_webwright_smoke
record_manifest

action "QA run complete. Artifacts in $OUT_ROOT"
action "Manifest: $OUT_ROOT/manifest.json"
echo "Status: completed."
