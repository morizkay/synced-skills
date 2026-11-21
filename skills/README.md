# Custom Skills

Put your own personal skills here! Every subfolder containing a `SKILL.md` file is automatically discovered by `npx skills add morizkay/synced-skills` alongside the synced upstream submodules under `repos/`, and is never touched by submodule updates.

## Adding a Custom Skill

Create a directory with a `SKILL.md` file:

```text
skills/
└── my-skill/
    ├── SKILL.md
    ├── scripts/        # optional helper scripts
    └── references/     # optional reference docs
```

Example `SKILL.md`:

```markdown
---
name: my-skill
description: Brief description of what this skill does and when the agent should use it.
---

# My Skill

Clear, step-by-step instructions for the agent to follow when this skill is activated.
```

After adding a skill, regenerate the catalog:

```bash
node scripts/generate-catalog.mjs
```
