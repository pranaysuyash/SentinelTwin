#!/usr/bin/env bash
set -euo pipefail

echo "=== SentinelTwin Pre-Merge Check ==="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "--- 1. Build core packages ---"
for pkg in core simulation report agents; do
  echo "[$pkg] building..."
  (cd "packages/$pkg" && pnpm build 2>&1 | tail -3)
done

echo ""
echo "--- 2. Typecheck all packages ---"
for pkg in core simulation report agents; do
  echo "[$pkg] typecheck..."
  (cd "packages/$pkg" && pnpm typecheck)
done

echo ""
echo "--- 3. Studio quality gate ---"
bash "$ROOT_DIR/tools/studio-quality-gate.sh"

echo ""
echo "--- 4. Summary ---"
echo "All checks passed."
