#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG="morizkay/synced-skills"
RAW_BASE="https://raw.githubusercontent.com/${REPO_SLUG}/main"
SOURCE_REPO="${REPO_SLUG}"

SCOPE_FLAG="-g"
YES_FLAG="-y"
DRY_RUN=false
LIST_ONLY=false
AGENTS=()
PRESETS=()

usage() {
  cat <<'EOF'
Install curated AI coding agent skills from morizkay/synced-skills.

Usage:
  ./install.sh [options] [preset ...]
  curl -fsSL https://raw.githubusercontent.com/morizkay/synced-skills/main/install.sh | bash -s -- [options] [preset ...]

Presets:
  core        Daily-driver engineering, planning, debugging, UI & browser skills (default)
  frontend    UI/UX design, React, Next.js, React Native, accessibility & testing
  cloud       Supabase/Postgres, Cloudflare Workers, Vercel, CI/CD & security
  docs        PDF, DOCX, PPTX, XLSX, ADRs & technical writing
  obsidian    Obsidian vault Markdown, Bases, Canvas & CLI workflows
  payments    Midtrans & Stripe payment gateway integrations
  all         Install every discoverable skill in the repository

Options:
  -a, --agent <name>   Install only for specific agent(s) (repeatable, e.g. claude-code, cursor, codex, opencode)
  --local, --project   Install into the current project instead of globally (-g)
  --interactive        Prompt interactively instead of passing -y
  --list               Show available presets and their skills
  --dry-run            Print the npx skills command without running it
  --repo <source>      Override source repo or local path (default: morizkay/synced-skills)
  -h, --help           Show this help message

Examples:
  ./install.sh                           # Install 'core' preset globally
  ./install.sh core frontend cloud       # Combine multiple presets globally
  ./install.sh -a claude-code -a cursor core
  ./install.sh --local frontend          # Install 'frontend' into current project
  ./install.sh all                       # Install all skills globally
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--agent)
      [[ $# -lt 2 ]] && { echo "Error: --agent requires a value" >&2; exit 1; }
      AGENTS+=("$2")
      shift 2
      ;;
    --local|--project)
      SCOPE_FLAG=""
      shift
      ;;
    --interactive)
      YES_FLAG=""
      shift
      ;;
    --list)
      LIST_ONLY=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --repo)
      [[ $# -lt 2 ]] && { echo "Error: --repo requires a value" >&2; exit 1; }
      SOURCE_REPO="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      PRESETS+=("$1")
      shift
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required (used by npx skills)." >&2
  exit 1
fi

# Locate presets.json locally (if running inside a cloned repo) or fetch from GitHub.
PRESETS_JSON=""
SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [[ -n "${SCRIPT_DIR}" && -f "${SCRIPT_DIR}/presets.json" ]]; then
  PRESETS_JSON="$(cat "${SCRIPT_DIR}/presets.json")"
elif [[ -f "./presets.json" ]]; then
  PRESETS_JSON="$(cat "./presets.json")"
else
  if ! command -v curl >/dev/null 2>&1; then
    echo "Error: curl is required to fetch presets.json when running remotely." >&2
    exit 1
  fi
  PRESETS_JSON="$(curl -fsSL "${RAW_BASE}/presets.json")"
fi

if [[ "${LIST_ONLY}" == true ]]; then
  PRESETS_JSON="${PRESETS_JSON}" node -e '
    const data = JSON.parse(process.env.PRESETS_JSON);
    for (const [name, p] of Object.entries(data.presets)) {
      console.log(`\n${name} (${p.skills.length} skills) — ${p.description}`);
      console.log(`  ${p.skills.join(", ")}`);
    }
    console.log("\nall — Every discoverable skill in the repository");
  '
  exit 0
fi

if [[ ${#PRESETS[@]} -eq 0 ]]; then
  PRESETS=("core")
fi

# Check if "all" was requested
INSTALL_ALL=false
for p in "${PRESETS[@]}"; do
  if [[ "$p" == "all" ]]; then
    INSTALL_ALL=true
    break
  fi
done

CMD=(npx --yes skills@latest add "${SOURCE_REPO}")
[[ -n "${SCOPE_FLAG}" ]] && CMD+=("${SCOPE_FLAG}")
[[ -n "${YES_FLAG}" ]] && CMD+=("${YES_FLAG}")

if [[ ${#AGENTS[@]} -gt 0 ]]; then
  for a in "${AGENTS[@]}"; do
    CMD+=(-a "$a")
  done
fi

if [[ "${INSTALL_ALL}" == true ]]; then
  CMD+=(--skill '*')
else
  # Resolve deduplicated skill names from requested presets using Node.js
  RESOLVED_SKILLS=()
  while IFS= read -r skill; do
    [[ -n "${skill}" ]] && RESOLVED_SKILLS+=("${skill}")
  done < <(
    PRESETS_JSON="${PRESETS_JSON}" node -e '
      const data = JSON.parse(process.env.PRESETS_JSON);
      const requested = process.argv.slice(1);
      const out = new Set();
      for (const name of requested) {
        const preset = data.presets[name];
        if (!preset) {
          console.error(`Error: Unknown preset "${name}". Run with --list to see available presets.`);
          process.exit(1);
        }
        for (const s of preset.skills) out.add(s);
      }
      for (const s of out) console.log(s);
    ' "${PRESETS[@]}"
  )

  if [[ ${#RESOLVED_SKILLS[@]} -eq 0 ]]; then
    echo "Error: No skills resolved for presets: ${PRESETS[*]}" >&2
    exit 1
  fi

  CMD+=(--skill "${RESOLVED_SKILLS[@]}")
fi

echo "Presets: ${PRESETS[*]}"
echo "Running: ${CMD[*]}"

if [[ "${DRY_RUN}" == true ]]; then
  exit 0
fi

exec "${CMD[@]}"
