#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "Initializing and updating all submodules from upstream..."
git submodule update --init --recursive --remote --depth 1

echo "Regenerating CATALOG.md and validating skills + presets..."
node scripts/generate-catalog.mjs

echo ""
echo "Summary of changes:"
git status -s
