#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUDIO_DIR="$ROOT_DIR/apps/studio"

if [[ ! -d "$STUDIO_DIR" ]]; then
  echo "studio directory not found: $STUDIO_DIR" >&2
  exit 2
fi

cd "$STUDIO_DIR"

echo "[gate] installing deps"
npm install --no-audit --no-fund >/dev/null

echo "[gate] typecheck"
npx tsc --noEmit

echo "[gate] hex drift check"
bun ../../tools/hex-drift-detect.ts

echo "[gate] trust audit"
bun ../../tools/truth-audit.ts --root .

echo "[gate] focused goal4 tests"
bun test \
  src/components/__tests__/root-routing-contract.test.ts \
  src/components/__tests__/studio-route.test.ts \
  src/components/__tests__/launcher-dashboard-home.test.ts \
  src/components/__tests__/launcher-shell.test.ts \
  src/components/__tests__/view-mode-bar.test.ts \
  src/components/__tests__/status-bar.test.ts \
  src/components/__tests__/camera-view-mode.test.ts \
  src/components/__tests__/camera-wall-view.test.ts \
  src/components/__tests__/path-replay-view.test.ts \
  src/components/__tests__/compare-view.test.ts \
  src/components/__tests__/path-map.test.ts \
  src/components/__tests__/scenario-path-panel.test.ts \
  src/components/__tests__/site-intake-hub.test.ts

echo "[gate] build"
rm -f .next/lock
npm run build

echo "[gate] PASS"
