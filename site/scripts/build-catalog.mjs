#!/usr/bin/env node
// Builds the catalog the site renders (docs/specs/catalog-site.md §6, §6.1, §8.2)
// from .claude-plugin/marketplace.json, plugins/ and git history. Runs at build
// time only; the browser never reads the repository.
//
// Usage:
//   node scripts/build-catalog.mjs [--root <dir>] [--out <file>] [--sample]
//                                  [--history <file>] [--repo <owner/name>]
//
//   --root     marketplace root (default: the repository root)
//   --out      output JSON (default: site/src/generated/catalog.json)
//   --sample   mark the catalog as sample data (fixtures)
//   --history  JSON file with { "<plugin>": { "updated", "changes" } } used
//              instead of git history (fixtures, tests)
//   --repo     GitHub "owner/name" (default: parsed from the origin remote)
//
// Rules:
// - MCP `env` values are never read into the output; only variable names.
// - Output is deterministic: no wall-clock time, sorted where order is not
//   given by the input. Two runs on the same commit give identical bytes.
// - Only what scripts/validate-marketplace.mjs treats as an error fails the
//   build. Everything else is a diagnostic, printed as a warning.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const SITE_DIR = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(SITE_DIR, '..');
const VALIDATOR = join(REPO_ROOT, 'scripts', 'validate-marketplace.mjs');
const DEFAULT_OUT = join(SITE_DIR, 'src', 'generated', 'catalog.json');
const DEFAULT_REPO = 'humen-dev/dev-digest-ai-marketplace';

/** Plain-text body kept per artifact for search (§6 `bodyText`). */
export const BODY_LIMIT = 8000;
/** Commit subjects kept per plugin as "Recent changes". */
export const CHANGES_LIMIT = 5;

const KIND_ORDER = { skill: 0, agent: 1, command: 2 };
/** Variables Claude Code provides itself; not something the user sets. */
const BUILTIN_VARS = new Set(['CLAUDE_PLUGIN_ROOT', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_PROJECT_DIR']);

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const posix = (p) => p.split(sep).join('/');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* ---------- small readers ---------- */

function readText(file) {
  return readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

function listDir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name));
  } catch {
    return [];
  }
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const isFile = (p) => existsSync(p) && statSync(p).isFile();

/* ---------- markdown ---------- */

/**
 * Quotes top-level plain values that contain ": ", e.g.
 * `description: Use after a commit, with scope: all` — strict YAML rejects
 * these, but Claude Code reads such frontmatter fine.
 */
function quoteColonValues(src) {
  const keys = [];
  const text = src
    .split('\n')
    .map((line) => {
      const m = /^([A-Za-z][\w-]*):[ \t]+(.+)$/.exec(line);
      if (!m || /^["'[{|>&*!]/.test(m[2]) || !/:\s/.test(m[2])) return line;
      keys.push(m[1]);
      return `${m[1]}: ${JSON.stringify(m[2].trimEnd())}`;
    })
    .join('\n');
  return { text, keys };
}

/** Splits YAML frontmatter from a markdown file. Invalid YAML → `error`, empty data. */
export function splitFrontmatter(text) {
  const m = /^---[ \t]*\n([\s\S]*?)\n?---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return { data: {}, body: text, error: null };
  const body = text.slice(m[0].length);
  try {
    const data = parseYaml(m[1]) ?? {};
    if (!isObject(data)) return { data: {}, body, error: 'frontmatter is not a YAML mapping' };
    return { data, body, error: null };
  } catch (e) {
    const lenient = quoteColonValues(m[1]);
    if (lenient.keys.length) {
      try {
        const data = parseYaml(lenient.text) ?? {};
        if (isObject(data)) {
          return { data, body, error: `frontmatter is not strict YAML (unquoted ": " in ${lenient.keys.join(', ')}); read leniently` };
        }
      } catch {
        /* fall through to the original error */
      }
    }
    return { data: {}, body, error: `invalid YAML frontmatter (${String(e.message).split('\n')[0]})` };
  }
}

/** Strips inline markdown: links, images, code spans, emphasis markers, HTML tags. */
export function inlineText(s) {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`+/g, '')
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[\s(])[*_](?=\S)([^*_]*?\S)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits markdown into blocks: { type: 'heading', level, text } |
 * { type: 'paragraph', text } | { type: 'other', text }.
 */
export function mdBlocks(md) {
  const blocks = [];
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  let para = [];
  let fence = null;
  let code = [];
  const flush = () => {
    if (!para.length) return;
    const first = para[0].trimStart();
    const other = /^([-*+]\s|\d+[.)]\s|>|\||<)/.test(first);
    blocks.push({ type: other ? 'other' : 'paragraph', text: other ? para.join('\n') : inlineText(para.join(' ')) });
    para = [];
  };
  for (const line of lines) {
    if (fence) {
      if (line.trimStart().startsWith(fence)) {
        blocks.push({ type: 'other', text: code.join('\n') });
        fence = null;
        code = [];
      } else code.push(line);
      continue;
    }
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (f) {
      flush();
      fence = f[1];
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      flush();
      blocks.push({ type: 'heading', level: h[1].length, text: inlineText(h[2]) });
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line);
  }
  if (fence) blocks.push({ type: 'other', text: code.join('\n') });
  flush();
  return blocks;
}

/** Plain text of a markdown body for search, truncated to BODY_LIMIT characters. */
export function bodyText(md) {
  const text = mdBlocks(md)
    .map((b) => (b.type === 'other' ? inlineText(b.text.replace(/^\s*([-*+]|\d+[.)]|>)\s+/gm, '').replace(/\|/g, ' ')) : b.text))
    .filter(Boolean)
    .join(' ');
  const chars = [...text];
  return chars.length > BODY_LIMIT ? chars.slice(0, BODY_LIMIT).join('') : text;
}

const headings = (md) => mdBlocks(md).filter((b) => b.type === 'heading' && b.text).map((b) => b.text);

const firstParagraph = (md) => mdBlocks(md).find((b) => b.type === 'paragraph')?.text ?? '';

/**
 * Plugin README → { title, body, notes }. `title` is the first H1, `body` the
 * plain-text paragraphs outside "## What it runs", and `notes` maps each
 * "### <name>" under "## What it runs" to its first paragraph (§8.2).
 */
export function parseReadme(md, fallbackTitle) {
  let title = null;
  const body = [];
  const notes = {};
  let inRuns = false;
  let noteName = null;
  for (const b of mdBlocks(md)) {
    if (b.type === 'heading') {
      if (b.level === 1 && title === null) {
        title = b.text;
        inRuns = false;
        continue;
      }
      if (b.level <= 2) {
        inRuns = b.level === 2 && b.text === 'What it runs';
        noteName = null;
      } else if (inRuns && b.level === 3) {
        noteName = b.text;
        notes[noteName] ??= null;
      }
      continue;
    }
    if (b.type !== 'paragraph' || !b.text) continue;
    if (inRuns) {
      if (noteName && notes[noteName] === null) notes[noteName] = b.text;
    } else body.push(b.text);
  }
  const kept = Object.fromEntries(Object.entries(notes).filter(([, v]) => v !== null));
  return { title: title || fallbackTitle, body, notes: kept, noteNames: Object.keys(notes) };
}

/* ---------- frontmatter fields ---------- */

const str = (v) => (v === undefined || v === null ? '' : Array.isArray(v) ? v.map(String).join(' ') : String(v)).replace(/\s+/g, ' ').trim();

/** `allowed-tools` / `tools`: a YAML list or a comma-separated string ("Read, Bash(git log:*)"). */
export function toolList(v) {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.map((t) => String(t).trim()).filter(Boolean);
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(v)) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((t) => t.trim()).filter(Boolean);
}

/* ---------- hooks and MCP ---------- */

/** Mirrors hookName() in src/lib/catalog.ts; used only to check README note names. */
function hookName(h) {
  const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+?)(?:\.\w+)?(?=["'\s]|$)/.exec(h.command);
  if (m) return m[1];
  return h.matcher ? `${h.event}:${h.matcher}` : h.event;
}

/** `{ "<Event>": [{ "matcher": "...", "hooks": [{ "type": "command", "command": "..." }] }] }` → Hook[]. */
export function extractHooks(events, where, diag) {
  const out = [];
  if (!isObject(events)) {
    diag(where, 'hooks must be an object keyed by event');
    return out;
  }
  for (const [event, groups] of Object.entries(events)) {
    if (!Array.isArray(groups)) {
      diag(where, `hooks.${event} must be an array`);
      continue;
    }
    for (const g of groups) {
      if (!isObject(g) || !Array.isArray(g.hooks)) {
        diag(where, `hooks.${event}: each entry needs a "hooks" array`);
        continue;
      }
      const matcher = typeof g.matcher === 'string' && g.matcher !== '' ? g.matcher : null;
      for (const h of g.hooks) {
        if (!isObject(h)) continue;
        const command = typeof h.command === 'string' ? h.command : `(${h.type ?? 'unknown'} hook)`;
        out.push({ event, matcher, command });
      }
    }
  }
  return out;
}

const varRefs = (s) => [...String(s ?? '').matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}/g)].map((m) => m[1]);

/**
 * One MCP server config → McpServer. Reads `env` KEYS only (never values) plus
 * ${VAR} references in command, args, url and headers.
 */
export function extractMcpServer(name, cfg) {
  const type = String(cfg.type ?? '').toLowerCase();
  const transport = type === 'sse' ? 'sse' : type === 'http' || type === 'streamable-http' || (!cfg.command && cfg.url) ? 'http' : 'stdio';
  const args = Array.isArray(cfg.args) ? cfg.args.map(String) : [];
  const command = transport === 'stdio' ? [cfg.command, ...args].filter((p) => p !== undefined && p !== null && p !== '').map(String).join(' ') || null : null;
  const url = transport === 'stdio' ? null : typeof cfg.url === 'string' ? cfg.url : null;
  const names = new Set(isObject(cfg.env) ? Object.keys(cfg.env) : []);
  const headerValues = isObject(cfg.headers) ? Object.values(cfg.headers) : [];
  for (const v of [cfg.command, ...args, cfg.url, ...headerValues].flatMap(varRefs)) names.add(v);
  for (const b of BUILTIN_VARS) names.delete(b);
  return { name, transport, command, url, env: [...names].sort(cmp) };
}

/* ---------- CODEOWNERS ---------- */

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return re;
}

/** Parses CODEOWNERS into [{ pattern, owners, re }]. */
export function parseCodeowners(text) {
  const rules = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!line) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    let p = pattern.replace(/\/$/, '');
    const anchored = p.includes('/');
    p = p.replace(/^\//, '');
    if (!p) continue;
    const body = globToRegex(p);
    rules.push({ pattern, owners, re: new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`) });
  }
  return rules;
}

/**
 * Owners of a folder: the last rule (GitHub semantics) whose pattern matches
 * the folder itself or one of its ancestors. Rules for paths inside the
 * folder (e.g. `**\/hooks/`) do not own the plugin as a whole.
 */
export function ownersFor(rules, folder) {
  const parts = folder.split('/');
  const candidates = parts.map((_, i) => parts.slice(0, i + 1).join('/'));
  let owners = [];
  for (const r of rules) if (candidates.some((c) => r.re.test(c))) owners = r.owners;
  return [...owners];
}

function readCodeowners(root) {
  for (const p of ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']) {
    const file = join(root, p);
    if (isFile(file)) return parseCodeowners(readText(file));
  }
  return [];
}

/* ---------- git ---------- */

function gitLog(root, folder) {
  try {
    const out = execFileSync(
      'git',
      ['-c', 'core.quotepath=off', '-c', 'log.showSignature=false', '-C', root, 'log', '--no-merges', `-n${CHANGES_LIMIT}`, '--format=%cs%x09%s', '--', folder],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [date, ...rest] = l.split('\t');
        return { version: date, text: rest.join('\t').trim() };
      });
  } catch {
    return null;
  }
}

export function repoFromRemote(root) {
  try {
    const url = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/* ---------- components ---------- */

/** Paths from a plugin.json component field: a string or an array of strings. */
const pathList = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((p) => typeof p === 'string') : []);

function mdFiles(dir, recursive) {
  const out = [];
  for (const e of listDir(dir)) {
    const full = join(dir, e.name);
    if (e.isDirectory() && recursive) out.push(...mdFiles(full, true));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function skillFiles(dir) {
  if (isFile(join(dir, 'SKILL.md'))) return [join(dir, 'SKILL.md')];
  return listDir(dir)
    .filter((e) => e.isDirectory() && isFile(join(dir, e.name, 'SKILL.md')))
    .map((e) => join(dir, e.name, 'SKILL.md'));
}

/** Files for one component kind. Custom `skills` paths add to skills/; custom `agents`/`commands` replace the default folder. */
function componentFiles(dir, manifest, kind) {
  const custom = pathList(manifest[kind === 'skill' ? 'skills' : kind === 'agent' ? 'agents' : 'commands']).map((p) => resolve(dir, p));
  const defaults = join(dir, kind === 'skill' ? 'skills' : kind === 'agent' ? 'agents' : 'commands');
  const roots = kind === 'skill' ? [defaults, ...custom] : custom.length ? custom : [defaults];
  const files = new Set();
  for (const r of roots) {
    if (isFile(r)) files.add(r);
    else if (isDir(r)) for (const f of kind === 'skill' ? skillFiles(r) : mdFiles(r, kind === 'command')) files.add(f);
  }
  return [...files];
}

function readArtifact(kind, file, ctx) {
  const { data, body, error } = splitFrontmatter(readText(file));
  if (error) ctx.diag(ctx.rel(file), error);
  const fallback = kind === 'skill' ? basename(dirname(file)) : basename(file, '.md');
  const name = kind === 'command' ? fallback : str(data.name) || fallback;
  const description = str(data.description) || (kind === 'command' && !error ? firstParagraph(body) : '');
  if (!description && !error) ctx.diag(ctx.rel(file), 'no description');
  for (const t of [...toolList(data['allowed-tools']), ...toolList(data.tools)]) ctx.tools.add(t);
  const artifact = { kind, name, description, keywords: str(data.keywords ?? data.tags), path: ctx.rel(file) };
  const heads = headings(body);
  const text = bodyText(body);
  if (heads.length) artifact.headings = heads;
  if (text) artifact.body = text;
  return artifact;
}

function readJsonFile(file, ctx) {
  try {
    return JSON.parse(readText(file));
  } catch (e) {
    ctx.diag(ctx.rel(file), `invalid JSON (${e.message})`);
    return null;
  }
}

/* ---------- plugins ---------- */

function externalSource(source) {
  if (!isObject(source)) return null;
  if (source.source === 'github' && typeof source.repo === 'string') return `https://github.com/${source.repo}`;
  if (typeof source.url === 'string') return source.path ? `${source.url.replace(/\.git$/, '')}/tree/HEAD/${source.path}` : source.url;
  if (typeof source.package === 'string') return `https://www.npmjs.com/package/${source.package}`;
  return null;
}

function externalPlugin(entry) {
  const plugin = {
    name: entry.name,
    version: typeof entry.version === 'string' ? entry.version : null,
    description: str(entry.description),
    updated: '',
    owners: [],
    license: typeof entry.license === 'string' ? entry.license : null,
    tools: [],
    hooks: [],
    mcp: [],
    artifacts: [],
    notes: {},
    readme: { title: entry.name, body: [] },
    changes: [],
    external: true,
  };
  const src = externalSource(entry.source);
  if (src) plugin.source = src;
  return plugin;
}

function localPlugin(entry, ctx) {
  const dir = resolve(ctx.root, entry.source);
  const folder = posix(relative(ctx.root, dir));
  const tools = new Set();
  const pctx = { ...ctx, tools };

  const manifestPath = join(dir, '.claude-plugin', 'plugin.json');
  const manifest = (isFile(manifestPath) && readJsonFile(manifestPath, ctx)) || entry;

  const artifacts = ['skill', 'agent', 'command']
    .flatMap((kind) => componentFiles(dir, manifest, kind).map((f) => readArtifact(kind, f, pctx)))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || cmp(a.name, b.name) || cmp(a.path, b.path));

  // Hooks: hooks/hooks.json, then plugin.json `hooks` (file paths or an inline object).
  const hooks = [];
  const hookFiles = new Set([join(dir, 'hooks', 'hooks.json')]);
  for (const p of pathList(manifest.hooks)) hookFiles.add(resolve(dir, p));
  for (const f of hookFiles) {
    if (!isFile(f)) continue;
    const json = readJsonFile(f, ctx);
    if (json) hooks.push(...extractHooks(json.hooks, ctx.rel(f), ctx.diag));
  }
  if (isObject(manifest.hooks)) {
    const inline = isObject(manifest.hooks.hooks) ? manifest.hooks.hooks : manifest.hooks;
    hooks.push(...extractHooks(inline, `${ctx.rel(manifestPath)} hooks`, ctx.diag));
  }

  // MCP servers: .mcp.json, then plugin.json `mcpServers` (file paths or inline). First definition of a name wins.
  const mcp = [];
  const seen = new Set();
  const addServers = (json, where) => {
    const servers = isObject(json?.mcpServers) ? json.mcpServers : json;
    if (!isObject(servers)) return;
    for (const [name, cfg] of Object.entries(servers)) {
      if (!isObject(cfg)) {
        ctx.diag(where, `MCP server "${name}" must be an object`);
        continue;
      }
      if (seen.has(name)) continue;
      seen.add(name);
      mcp.push(extractMcpServer(name, cfg));
    }
  };
  const mcpFiles = new Set([join(dir, '.mcp.json')]);
  for (const p of pathList(manifest.mcpServers)) mcpFiles.add(resolve(dir, p));
  for (const f of mcpFiles) if (isFile(f)) addServers(readJsonFile(f, ctx), ctx.rel(f));
  if (isObject(manifest.mcpServers)) addServers(manifest.mcpServers, `${ctx.rel(manifestPath)} mcpServers`);

  // README: title, body paragraphs and author notes (§8.2).
  const readmePath = join(dir, 'README.md');
  const readme = isFile(readmePath) ? parseReadme(readText(readmePath), entry.name) : { title: entry.name, body: [], notes: {}, noteNames: [] };
  const known = new Set([...hooks.map(hookName), ...mcp.map((m) => m.name), ...mcp.flatMap((m) => m.env)]);
  for (const n of readme.noteNames) {
    if (!known.has(n)) ctx.diag(ctx.rel(readmePath), `"What it runs" note "${n}" matches no hook, MCP server or env var`);
  }
  const notes = Object.fromEntries(Object.entries(readme.notes).sort(([a], [b]) => cmp(a, b)));

  // Dates and recent changes: git history of the folder, or the --history file.
  let history;
  if (ctx.history) history = ctx.history[entry.name] ?? { updated: '', changes: [] };
  else {
    const log = gitLog(ctx.root, folder) ?? [];
    if (!log.length) ctx.diag(folder, 'no git history; "updated" is empty');
    history = { updated: log[0]?.version ?? '', changes: log };
  }

  const version = typeof manifest.version === 'string' ? manifest.version : typeof entry.version === 'string' ? entry.version : null;
  const license = typeof manifest.license === 'string' ? manifest.license : typeof entry.license === 'string' ? entry.license : null;

  return {
    name: entry.name,
    version,
    description: str(entry.description) || str(manifest.description),
    updated: history.updated ?? '',
    owners: ownersFor(ctx.codeowners, folder),
    license,
    tools: [...tools].sort(cmp),
    hooks,
    mcp,
    artifacts,
    notes,
    readme: { title: readme.title, body: readme.body },
    changes: (history.changes ?? []).map((c) => ({ version: String(c.version), text: String(c.text) })),
    source: folder,
  };
}

/**
 * Builds the catalog from a marketplace root. Does not run the validator; see main().
 *
 * @param {{
 *   root: string,
 *   sample?: boolean,
 *   history?: Record<string, { updated: string, changes: { version: string, text: string }[] }> | null,
 *   repo?: string | null,
 * }} options
 * @returns {{ catalog: import('../src/data/types').Catalog, diagnostics: import('../src/data/types').Diagnostic[] }}
 */
export function buildCatalog({ root, sample = false, history = null, repo = null }) {
  root = resolve(root);
  const diagnostics = [];
  const diag = (path, message) => diagnostics.push({ path, message });
  const rel = (p) => posix(relative(root, p)) || '.';
  const marketplace = JSON.parse(readText(join(root, '.claude-plugin', 'marketplace.json')));
  const ctx = { root, history, diag, rel, codeowners: readCodeowners(root) };

  const plugins = (Array.isArray(marketplace.plugins) ? marketplace.plugins : [])
    .filter((e) => isObject(e) && typeof e.name === 'string')
    .map((e) => (typeof e.source === 'string' ? localPlugin(e, ctx) : externalPlugin(e)));

  diagnostics.sort((a, b) => cmp(a.path, b.path) || cmp(a.message, b.message));
  const catalog = {
    marketplace: marketplace.name,
    repo: repo ?? repoFromRemote(root) ?? DEFAULT_REPO,
    sample,
    plugins,
    diagnostics,
  };
  return { catalog, diagnostics };
}

export const serialize = (catalog) => `${JSON.stringify(catalog, null, 2)}\n`;

/** Runs scripts/validate-marketplace.mjs on the root. Returns its exit status and output. */
export function validate(root) {
  const r = spawnSync(process.execPath, [VALIDATOR, resolve(root)], { encoding: 'utf8' });
  return { ok: r.status === 0, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function parseArgs(argv) {
  const args = { root: REPO_ROOT, out: DEFAULT_OUT, sample: false, history: null, repo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--root') args.root = resolve(next());
    else if (a === '--out') args.out = resolve(next());
    else if (a === '--history') args.history = resolve(next());
    else if (a === '--repo') args.repo = next();
    else if (a === '--sample') args.sample = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const v = validate(args.root);
  if (!v.ok) {
    console.error(v.output);
    console.error('build-catalog: the marketplace has validation errors; not writing the catalog.');
    process.exit(1);
  }
  const history = args.history ? JSON.parse(readText(args.history)) : null;
  const { catalog, diagnostics } = buildCatalog({ root: args.root, sample: args.sample, history, repo: args.repo });
  for (const d of diagnostics) console.warn(`warning: ${d.path}: ${d.message}`);
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, serialize(catalog));
  const artifacts = catalog.plugins.reduce((n, p) => n + p.artifacts.length, 0);
  console.log(`catalog: ${catalog.plugins.length} plugin(s), ${artifacts} artifact(s) → ${posix(relative(process.cwd(), args.out))}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
