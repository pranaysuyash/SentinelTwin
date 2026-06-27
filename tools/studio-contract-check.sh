#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUDIO_DIR="$ROOT_DIR/apps/studio"

if [[ ! -d "$STUDIO_DIR" ]]; then
  echo "studio directory not found: $STUDIO_DIR" >&2
  exit 2
fi

cd "$STUDIO_DIR"

echo "[contract] typecheck"
npx tsc --noEmit

echo "[contract] build"
rm -f .next/lock
npm run build

echo "[contract] PASS"
