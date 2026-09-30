#!/usr/bin/env bash
# cleanup-caches.sh — Remove disposable cache/build artifacts from the Mythos monorepo.
# Safe to run at any time; all targets are fully reproducible via `pnpm -r run build`.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Mythos Repository Cleanup ==="
echo "Repo root: $REPO"
echo ""

# Known disposable directories
targets=(
  "$REPO/artifacts/mythos-storyteller/node_modules/.vite"
  "$REPO/artifacts/mythos-storyteller/node_modules/.vite-temp"
  "$REPO/artifacts/mockup-sandbox/node_modules/.vite"
  "$REPO/artifacts/mockup-sandbox/node_modules/.vite-temp"
  "$REPO/artifacts/api-server/node_modules/.vite"
  "$REPO/artifacts/api-server/node_modules/.vite-temp"
  "$REPO/artifacts/api-server/dist"
  "$REPO/artifacts/mockup-sandbox/dist"
  "$REPO/artifacts/mythos-storyteller/dist"
)

removed=0
for target in "${targets[@]}"; do
  if [ -e "$target" ]; then
    echo "  ✗ Removing: ${target#$REPO/}"
    rm -rf "$target"
    ((removed++))
  fi
done

# Safety sweep: catch any stray Python/OS/lint artifacts
echo ""
echo "Running safety sweep for stray artifacts..."

# Directories
count=$(find "$REPO" -not -path '*/.git/*' -type d \( \
  -name '__pycache__' -o -name '.pytest_cache' -o -name '.ruff_cache' \
  -o -name '.mypy_cache' -o -name '.turbo' \
\) 2>/dev/null | tee /dev/stderr | wc -l)
if [ "$count" -gt 0 ]; then
  find "$REPO" -not -path '*/.git/*' -type d \( \
    -name '__pycache__' -o -name '.pytest_cache' -o -name '.ruff_cache' \
    -o -name '.mypy_cache' -o -name '.turbo' \
  \) -exec rm -rf {} + 2>/dev/null || true
  ((removed+=count))
fi

# Files
count=$(find "$REPO" -not -path '*/.git/*' -type f \( \
  -name '*.pyc' -o -name '*.pyo' -o -name '*.pyd' \
  -o -name '.DS_Store' -o -name 'Thumbs.db' -o -name '.eslintcache' \
  -o -name '*.tsbuildinfo' \
\) 2>/dev/null | tee /dev/stderr | wc -l)
if [ "$count" -gt 0 ]; then
  find "$REPO" -not -path '*/.git/*' -type f \( \
    -name '*.pyc' -o -name '*.pyo' -o -name '*.pyd' \
    -o -name '.DS_Store' -o -name 'Thumbs.db' -o -name '.eslintcache' \
    -o -name '*.tsbuildinfo' \
  \) -delete 2>/dev/null || true
  ((removed+=count))
fi

echo ""
if [ "$removed" -gt 0 ]; then
  echo "=== Done! Removed $removed artifact(s). ==="
else
  echo "=== Repository is already clean! ==="
fi
echo ""
echo "To rebuild: pnpm -r run build"
