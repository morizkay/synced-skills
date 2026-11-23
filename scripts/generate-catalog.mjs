#!/usr/bin/env node
/**
 * Discovers all skills from `skills/` and `skills.sh.json`, validates frontmatter,
 * checks for duplicate skill names and broken preset references, and generates CATALOG.md.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__']);
const MAX_CONTAINER_DEPTH = 3;

// Upstream skills intentionally shadowed by an earlier entry in skills.sh.json
// (matches `npx skills` first-path-wins deduplication while still failing on
// unexpected new collisions).
const ALLOWED_SHADOWS = new Map([
  [
    'repos/mattpocock-skills/skills/engineering/prototype',
    'repos/emilkowalski-skills/skills/prototype',
  ],
]);

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const lines = match[1].split(/\r?\n/);
  const data = {};
  let currentKey = null;
  let blockStyle = null;
  let blockLines = [];

  const flushBlock = () => {
    if (!currentKey) return;
    if (blockStyle === '>' || blockStyle === '>-') {
      data[currentKey] = blockLines.join(' ').replace(/\s+/g, ' ').trim();
    } else {
      data[currentKey] = blockLines.join('\n').trim();
    }
    currentKey = null;
    blockStyle = null;
    blockLines = [];
  };

  for (const line of lines) {
    if (currentKey) {
      if (/^\s+/.test(line) || line.trim() === '') {
        blockLines.push(line.trim());
        continue;
      }
      flushBlock();
    }

    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    const trimmed = rawVal.trim();

    if (trimmed === '|' || trimmed === '|-' || trimmed === '>' || trimmed === '>-') {
      currentKey = key;
      blockStyle = trimmed;
      blockLines = [];
    } else if (trimmed === '' && (key === 'name' || key === 'description')) {
      currentKey = key;
      blockStyle = '>';
      blockLines = [];
    } else if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      data[key] = trimmed.slice(1, -1).trim();
    } else if (trimmed !== '') {
      data[key] = trimmed;
    }
  }
  flushBlock();
  return data;
}

function isInternalSkill(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return false;
  return /^\s+internal:\s*(true|"true"|'true'|1)\s*$/m.test(match[1]);
}

function parseGitmodules() {
  const gmPath = join(ROOT, '.gitmodules');
  if (!existsSync(gmPath)) return new Map();

  const text = readFileSync(gmPath, 'utf8');
  const map = new Map();
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = line.match(/^\[submodule\s+"(.+)"\]$/);
    if (header) {
      current = { id: header[1], path: '', url: '', branch: 'main' };
      continue;
    }
    if (!current) continue;
    const kv = line.match(/^([a-z]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    current[kv[1]] = kv[2].trim();
    if (current.path) {
      map.set(current.path, current);
    }
  }

  for (const info of map.values()) {
    try {
      const sha = execFileSync('git', ['-C', join(ROOT, info.path), 'rev-parse', '--short', 'HEAD'], {
        encoding: 'utf8',
      }).trim();
      info.sha = sha;
    } catch {
      info.sha = 'unknown';
    }
    info.repoSlug = info.url.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  }

  return map;
}

function walkContainer(dir, depth = 1) {
  if (depth > MAX_CONTAINER_DEPTH || !existsSync(dir)) return [];
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const child = join(dir, entry.name);
    const skillMd = join(child, 'SKILL.md');
    if (existsSync(skillMd)) {
      results.push(child);
      continue;
    }
    results.push(...walkContainer(child, depth + 1));
  }
  return results;
}

function escapeMd(text) {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text, max = 140) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function main() {
  const submodules = parseGitmodules();
  const configPath = join(ROOT, 'skills.sh.json');
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : { paths: [] };

  const containers = [
    { label: 'Custom Skills (`skills/`)', relPath: 'skills', sourceKey: 'custom' },
    ...(config.paths || []).map((p) => {
      const normalized = p.replace(/^\.\//, '').replace(/\/+$/, '');
      const parts = normalized.split('/');
      const subPath = parts.length >= 2 && parts[0] === 'repos' ? `${parts[0]}/${parts[1]}` : normalized;
      const sub = submodules.get(subPath);
      return {
        label: sub ? sub.repoSlug : normalized,
        relPath: normalized,
        sourceKey: sub ? sub.path : normalized,
        submodule: sub,
      };
    }),
  ];

  const grouped = new Map();
  const seenNames = new Map();
  const errors = [];
  const allSkills = [];

  for (const container of containers) {
    const absContainer = join(ROOT, container.relPath);
    if (!existsSync(absContainer)) {
      if (container.sourceKey !== 'custom') {
        errors.push(`Configured skills.sh.json path does not exist: ${container.relPath}`);
      }
      continue;
    }

    const dirs = walkContainer(absContainer);
    for (const skillDir of dirs) {
      const skillMdPath = join(skillDir, 'SKILL.md');
      const relSkillPath = relative(ROOT, skillDir).split('\\').join('/');
      const raw = readFileSync(skillMdPath, 'utf8');

      if (isInternalSkill(raw)) continue;

      const fm = parseFrontmatter(raw);
      if (!fm || !fm.name || !fm.description) {
        errors.push(`Invalid or incomplete SKILL.md frontmatter: ${relSkillPath}/SKILL.md`);
        continue;
      }

      if (seenNames.has(fm.name)) {
        const winnerPath = seenNames.get(fm.name);
        if (ALLOWED_SHADOWS.get(relSkillPath) === winnerPath) {
          continue;
        }
        errors.push(
          `Duplicate skill name "${fm.name}" found in ${relSkillPath} (already defined in ${winnerPath})`
        );
        continue;
      }
      seenNames.set(fm.name, relSkillPath);

      const entry = {
        name: fm.name,
        description: fm.description,
        path: relSkillPath,
        sourceKey: container.sourceKey,
      };
      allSkills.push(entry);

      if (!grouped.has(container.sourceKey)) {
        grouped.set(container.sourceKey, {
          label: container.label,
          submodule: container.submodule,
          skills: [],
        });
      }
      grouped.get(container.sourceKey).skills.push(entry);
    }
  }

  // Validate presets.json
  const presetsPath = join(ROOT, 'presets.json');
  let presetsData = { presets: {} };
  if (existsSync(presetsPath)) {
    presetsData = JSON.parse(readFileSync(presetsPath, 'utf8'));
    for (const [presetName, preset] of Object.entries(presetsData.presets || {})) {
      for (const skillName of preset.skills || []) {
        if (!seenNames.has(skillName)) {
          errors.push(`Preset "${presetName}" references unknown skill "${skillName}"`);
        }
      }
    }
  }

  // Generate CATALOG.md
  const lines = [
    '# Skill Catalog',
    '',
    '> Auto-generated by `node scripts/generate-catalog.mjs`. Do not edit manually.',
    '',
    `**Total discoverable skills:** ${allSkills.length} across ${submodules.size} synced upstream repositories`,
    '',
    '## Presets',
    '',
    '| Preset | Count | Description |',
    '| --- | ---: | --- |',
  ];

  for (const [name, preset] of Object.entries(presetsData.presets || {})) {
    lines.push(
      `| \`${name}\` | ${preset.skills.length} | ${escapeMd(preset.description || '')} |`
    );
  }
  lines.push(`| \`all\` | ${allSkills.length} | Every discoverable skill in this repository |`);
  lines.push('');

  lines.push('## Synced Repositories');
  lines.push('');
  lines.push('| Repository | Skills | Pinned Commit |');
  lines.push('| --- | ---: | --- |');
  for (const [subPath, sub] of submodules.entries()) {
    const count = grouped.get(subPath)?.skills.length ?? 0;
    const repoUrl = `https://github.com/${sub.repoSlug}`;
    const commitUrl = `${repoUrl}/commit/${sub.sha}`;
    lines.push(`| [${sub.repoSlug}](${repoUrl}) | ${count} | [\`${sub.sha}\`](${commitUrl}) |`);
  }
  lines.push('');

  for (const [, group] of grouped.entries()) {
    if (group.skills.length === 0) continue;
    const heading = group.submodule
      ? `[${group.label}](https://github.com/${group.submodule.repoSlug}) (\`${group.submodule.sha}\`)`
      : group.label;
    lines.push(`## ${heading}`);
    lines.push('');
    lines.push('| Skill | Description |');
    lines.push('| --- | --- |');
    for (const skill of group.skills.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`| \`${skill.name}\` | ${truncate(escapeMd(skill.description))} |`);
    }
    lines.push('');
  }

  writeFileSync(join(ROOT, 'CATALOG.md'), `${lines.join('\n')}\n`, 'utf8');

  console.log(`Generated CATALOG.md with ${allSkills.length} skills across ${submodules.size} submodules.`);

  if (errors.length > 0) {
    console.error('\nValidation errors:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
}

main();
