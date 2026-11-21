# synced-skills

One repository to sync and install your favorite AI coding agent skills across every device — compatible with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Antigravity, and every other tool supported by [`npx skills`](https://github.com/vercel-labs/skills).

Upstream skill repositories live as shallow Git submodules under [`repos/`](repos/), exposed cleanly via [`skills.sh.json`](skills.sh.json) (filtering out deprecated, in-progress, template, and duplicate folders), while [`skills/`](skills/) stays reserved for your own custom personal skills.

---

## Quick Install on Any Device

### Option 1: Install a Preset (Recommended)

Installs globally (`-g -y`) across your detected coding agents with one command:

```bash
# Install the 'core' daily-driver preset (~21 skills)
curl -fsSL https://raw.githubusercontent.com/morizkay/synced-skills/main/install.sh | bash -s -- core

# Combine multiple presets
curl -fsSL https://raw.githubusercontent.com/morizkay/synced-skills/main/install.sh | bash -s -- core frontend cloud

# Target specific agent(s) only
curl -fsSL https://raw.githubusercontent.com/morizkay/synced-skills/main/install.sh | bash -s -- -a claude-code -a cursor core

# Install into the current project instead of globally
curl -fsSL https://raw.githubusercontent.com/morizkay/synced-skills/main/install.sh | bash -s -- --local frontend

# Install every discoverable skill
curl -fsSL https://raw.githubusercontent.com/morizkay/synced-skills/main/install.sh | bash -s -- all
```

### Option 2: Direct via `npx skills`

```bash
# Interactive skill & agent picker
npx skills@latest add morizkay/synced-skills -g

# List all discoverable skills without installing
npx skills@latest add morizkay/synced-skills --list

# Install specific skills by name
npx skills@latest add morizkay/synced-skills -g --skill grill-me tdd frontend-design agent-browser

# Update already-installed skills on this device
npx skills@latest update
```

> [!NOTE]
> Use `npx skills@latest` (v1.9+) so the CLI automatically initializes Git submodules when cloning this repository.

---

## Available Presets

Defined in [`presets.json`](presets.json) (run `./install.sh --list` to inspect exact skill lists):

| Preset | Focus |
| --- | --- |
| `core` | Daily-driver engineering, planning (`grill-me`, `to-spec`), TDD, debugging, code review, UI (`frontend-design`, `ui-ux-pro-max`), and `agent-browser` |
| `frontend` | React, Next.js, React Native, design systems, UI/UX polish, accessibility, performance, and browser testing |
| `cloud` | Supabase/Postgres, Cloudflare Workers & Durable Objects, Vercel deploy/optimize, CI/CD, observability, and security |
| `docs` | PDF, DOCX, PPTX, XLSX, doc co-authoring, ADRs, and technical/agent writing |
| `obsidian` | Obsidian Markdown, Bases, JSON Canvas, Obsidian CLI, and web clipping |
| `all` | Every discoverable skill in this repository |

See **[`CATALOG.md`](CATALOG.md)** for the full auto-generated list of all skills and their descriptions.

---

## Synced Upstream Repositories

| Submodule | Upstream | Highlights |
| --- | --- | --- |
| `repos/anthropics-skills` | [anthropics/skills](https://github.com/anthropics/skills) | `frontend-design`, `skill-creator`, `mcp-builder`, `webapp-testing`, `pdf`/`docx`/`pptx`/`xlsx` |
| `repos/vercel-agent-skills` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React/Next.js/React Native best practices, web design guidelines, Vercel deploy |
| `repos/vercel-agent-browser` | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | Headless browser automation & UI verification (`agent-browser`) |
| `repos/mattpocock-skills` | [mattpocock/skills](https://github.com/mattpocock/skills) | `grill-me`, `tdd`, `to-spec`, `implement-spec`, `code-review`, `diagnosing-bugs`, `handoff`, `pr` |
| `repos/addyosmani-agent-skills` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | Spec-driven dev, code simplification, security hardening, accessibility, observability |
| `repos/ui-ux-pro-max-skill` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | UI/UX design intelligence, design systems, styling, brand, slides |
| `repos/supabase-agent-skills` | [supabase/agent-skills](https://github.com/supabase/agent-skills) | Supabase & Postgres best practices |
| `repos/cloudflare-skills` | [cloudflare/skills](https://github.com/cloudflare/skills) | Cloudflare Workers, Durable Objects, Wrangler, Agents SDK, Next.js on Cloudflare |
| `repos/obsidian-skills` | [obsidianmd/obsidian-skills](https://github.com/obsidianmd/obsidian-skills) | Obsidian Markdown, Bases, JSON Canvas, CLI, headless, `defuddle` |

---

## Managing This Repository

### Automated Weekly Sync (Pull Requests)

[`.github/workflows/sync-skills.yml`](.github/workflows/sync-skills.yml) runs every Monday at 09:00 UTC (and can be triggered manually from the **Actions** tab):

1. Updates all submodules to their latest upstream commits.
2. Validates all `SKILL.md` frontmatter, checks for duplicate skill names, verifies `presets.json`, and regenerates `CATALOG.md`.
3. Opens (or updates) a Pull Request with GitHub compare links (`old...new`) for every changed repo so you can audit upstream diffs before merging.

> [!IMPORTANT]
> For the automated PR workflow to open Pull Requests, ensure **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"** is enabled on this repository.

### Local Sync

```bash
git clone --recurse-submodules https://github.com/morizkay/synced-skills.git
cd synced-skills
./scripts/sync.sh
```

### Adding Another Upstream Skill Repo

```bash
./scripts/add-repo.sh <owner/repo> [skills-subpath] [branch]
# Example:
./scripts/add-repo.sh obra/superpowers skills main
```

### Adding Your Own Custom Skills

Create a folder under [`skills/`](skills/) with a `SKILL.md` file (see [`skills/README.md`](skills/README.md)), then run `node scripts/generate-catalog.mjs`.