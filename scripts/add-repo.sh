#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/add-repo.sh <owner/repo> [skills-subpath] [branch]" >&2
  echo "Example: ./scripts/add-repo.sh obra/superpowers skills main" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REPO="$1"
SUBPATH="${2:-skills}"
BRANCH="${3:-main}"
DIR_NAME="$(echo "${REPO}" | tr '/' '-')"
TARGET_DIR="repos/${DIR_NAME}"

echo "Adding submodule ${REPO} (${BRANCH}) -> ${TARGET_DIR}..."
git submodule add --depth 1 -b "${BRANCH}" "https://github.com/${REPO}.git" "${TARGET_DIR}"

CONTAINER_PATH="./${TARGET_DIR}"
if [[ -n "${SUBPATH}" && "${SUBPATH}" != "." ]]; then
  CONTAINER_PATH="./${TARGET_DIR}/${SUBPATH}"
fi

echo "Registering ${CONTAINER_PATH} in skills.sh.json..."
node -e '
  const fs = require("fs");
  const file = "skills.sh.json";
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  const entry = process.argv[1];
  cfg.paths = cfg.paths || [];
  if (!cfg.paths.includes(entry)) {
    cfg.paths.push(entry);
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  }
' "${CONTAINER_PATH}"

echo "Regenerating CATALOG.md..."
node scripts/generate-catalog.mjs

echo "Done! Review changes with 'git status' and commit."
