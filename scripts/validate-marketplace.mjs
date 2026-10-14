#!/usr/bin/env node
// Structural linter for this marketplace. No dependencies.
// Complements `claude plugin validate`, which does not check that relative
// sources exist, that entry and manifest names match, or line endings.
//
// Usage: node scripts/validate-marketplace.mjs [repo-root]

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? join(import.meta.dirname, '..'));
const errors = [];
const warnings = [];

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const FORBIDDEN_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-'];
const FORBIDDEN_NAMES = ['claude', 'anthropic', 'claude-code'];
const SHELL_EXT = ['.sh', '.bash'];
const SKIP_DIRS = new Set(['.git', 'node_modules']);

const rel = (p) => relative(root, p).split(sep).join('/') || '.';

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${rel(file)}: invalid JSON (${e.message})`);
    return null;
  }
}

function checkName(name, where) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    errors.push(`${where}: name "${name}" must be kebab-case (a-z, 0-9, -)`);
    return;
  }
  if (FORBIDDEN_NAMES.includes(name) || FORBIDDEN_PREFIXES.some((p) => name.startsWith(p))) {
    errors.push(`${where}: name "${name}" uses a reserved name or prefix`);
  }
}

function checkRelPath(p, where) {
  if (typeof p !== 'string') return false;
  if (!p.startsWith('./')) errors.push(`${where}: path "${p}" must start with ./`);
  if (p.includes('\\')) errors.push(`${where}: path "${p}" must use forward slashes`);
  if (p.split('/').includes('..')) errors.push(`${where}: path "${p}" must not contain ..`);
  return true;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function checkPlugin(entry, index) {
  const where = `marketplace.json plugins[${index}]`;
  if (!entry || typeof entry !== 'object') {
    errors.push(`${where}: must be an object`);
    return;
  }
  checkName(entry.name, where);
  if (!entry.description) warnings.push(`${where} (${entry.name}): missing description`);

  if (typeof entry.source !== 'string') {
    // External sources (github, git-subdir, …) must be pinned to a commit.
    if (entry.source && typeof entry.source === 'object') {
      if (['github', 'url', 'git-subdir'].includes(entry.source.source) && !/^[0-9a-f]{40}$/.test(entry.source.sha ?? '')) {
        errors.push(`${where} (${entry.name}): external source must pin a 40-char "sha"`);
      }
    } else {
      errors.push(`${where} (${entry.name}): missing source`);
    }
    return;
  }

  checkRelPath(entry.source, where);
  const dir = resolve(root, entry.source);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    errors.push(`${where} (${entry.name}): source "${entry.source}" does not exist`);
    return;
  }

  // Components belong at the plugin root, not inside .claude-plugin/.
  const metaDir = join(dir, '.claude-plugin');
  if (existsSync(metaDir)) {
    for (const f of readdirSync(metaDir)) {
      if (f !== 'plugin.json') errors.push(`${rel(join(metaDir, f))}: only plugin.json belongs in .claude-plugin/`);
    }
  }

  const manifestPath = join(metaDir, 'plugin.json');
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    if (manifest) {
      if (manifest.name !== entry.name) {
        errors.push(`${rel(manifestPath)}: name "${manifest.name}" must equal marketplace entry name "${entry.name}"`);
      }
      if (manifest.version !== undefined && entry.version !== undefined) {
        errors.push(`${entry.name}: set "version" in plugin.json only, not also in marketplace.json`);
      }
      for (const key of ['skills', 'commands', 'agents', 'hooks', 'mcpServers', 'outputStyles']) {
        const value = manifest[key];
        for (const p of Array.isArray(value) ? value : [value]) {
          if (typeof p === 'string') checkRelPath(p, `${rel(manifestPath)} ${key}`);
        }
      }
    }
  } else {
    warnings.push(`${entry.name}: no .claude-plugin/plugin.json (marketplace entry acts as the manifest)`);
  }

  if (!existsSync(join(dir, 'README.md'))) errors.push(`${entry.name}: missing README.md`);
  if (existsSync(join(dir, 'SKILL.md'))) {
    warnings.push(`${entry.name}: SKILL.md at plugin root loads the whole plugin as one skill; use skills/<name>/SKILL.md`);
  }

  const hooksPath = join(dir, 'hooks', 'hooks.json');
  if (existsSync(hooksPath)) {
    const hooks = readJson(hooksPath);
    if (hooks && (typeof hooks.hooks !== 'object' || hooks.hooks === null)) {
      errors.push(`${rel(hooksPath)}: must have a top-level "hooks" object`);
    }
  }

  const skillsDir = join(dir, 'skills');
  if (existsSync(skillsDir)) {
    for (const s of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!s.isDirectory()) continue;
      const skillFile = join(skillsDir, s.name, 'SKILL.md');
      if (!existsSync(skillFile)) {
        errors.push(`${rel(join(skillsDir, s.name))}: missing SKILL.md`);
        continue;
      }
      const text = readFileSync(skillFile, 'utf8');
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
      if (!fm) errors.push(`${rel(skillFile)}: missing YAML frontmatter`);
      else if (!/^description:\s*\S/m.test(fm[1])) errors.push(`${rel(skillFile)}: frontmatter needs a description`);
    }
  }

  for (const file of walk(dir)) {
    if (SHELL_EXT.some((ext) => file.endsWith(ext)) && readFileSync(file, 'utf8').includes('\r\n')) {
      errors.push(`${rel(file)}: shell script has CRLF line endings; use LF`);
    }
  }
}

const marketplacePath = join(root, '.claude-plugin', 'marketplace.json');
if (!existsSync(marketplacePath)) {
  errors.push('.claude-plugin/marketplace.json not found');
} else {
  const m = readJson(marketplacePath);
  if (m) {
    checkName(m.name, 'marketplace.json');
    if (!m.owner?.name) errors.push('marketplace.json: owner.name is required');
    if (!Array.isArray(m.plugins)) {
      errors.push('marketplace.json: plugins must be an array');
    } else {
      const seen = new Set();
      m.plugins.forEach((p, i) => {
        if (p?.name && seen.has(p.name)) errors.push(`marketplace.json: duplicate plugin name "${p.name}"`);
        seen.add(p?.name);
        checkPlugin(p, i);
      });
      // Folders in plugins/ that the catalog does not list.
      const pluginsDir = join(root, 'plugins');
      if (existsSync(pluginsDir)) {
        const listed = new Set(m.plugins.map((p) => typeof p?.source === 'string' && resolve(root, p.source)));
        for (const d of readdirSync(pluginsDir, { withFileTypes: true })) {
          if (d.isDirectory() && !listed.has(join(pluginsDir, d.name))) {
            warnings.push(`plugins/${d.name}: folder is not listed in marketplace.json`);
          }
        }
      }
    }
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error:   ${e}`);
console.log(
  errors.length
    ? `\n✗ ${errors.length} error(s), ${warnings.length} warning(s)`
    : `✓ marketplace OK (${warnings.length} warning(s))`,
);
process.exit(errors.length ? 1 : 0);
