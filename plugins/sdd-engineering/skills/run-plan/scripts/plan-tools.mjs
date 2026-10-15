#!/usr/bin/env node
/**
 * Deterministic helpers for the /sdd-engineering:run-plan skill — parse a plan
 * written from the plugin's templates/plan.md (`### U<n> — title` blocks with a
 * `| Field | Value |` table: Kind, Skills, Module, Wave, Depends on, Owns, …),
 * resolve the per-unit brief and keep the run state. Run it from the PROJECT
 * ROOT (it reads `.claude/sdd.json` there). Usage:
 *
 *   node plan-tools.mjs config                    → resolved .claude/sdd.json (JSON)
 *   node plan-tools.mjs waves  <plan>             → units per wave + agent (text)
 *   node plan-tools.mjs unit   <plan> <U-id>      → the unit block to paste (text)
 *   node plan-tools.mjs brief  <plan> <U-id>      → the full implementer brief (text)
 *   node plan-tools.mjs skills <plan> <U-id>      → [{name, path|null}] (JSON)
 *   node plan-tools.mjs owner  <plan> <file…>     → file → owning unit (JSON)
 *   node plan-tools.mjs state  get|dir <slug>
 *   node plan-tools.mjs state  set <slug> <key>=<json|text>…
 *
 * <plan> is a path or a slug looked up in `plansDir`. Run state lives in
 * `<runStateDir>/run-plan/<slug>/` (git-ignored by the project).
 * Exit 2 on bad usage / bad config / unknown unit / unparsable plan.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, moduleDirs, normalizeDir } from '../../../scripts/lib/sdd-config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The installed sdd-engineering plugin root (…/skills/run-plan/scripts → plugin). */
export const PLUGIN_ROOT = path.resolve(HERE, '../../..');
const ORCHESTRATOR = 'orchestrator';
export const IMPLEMENTER = 'sdd-engineering:implementer';

function fail(msg) {
  console.error(`plan-tools: ${msg}`);
  process.exit(2);
}

/** Project root = the cwd the orchestrator runs from. */
export const projectRoot = () => process.cwd();

export function config(root = projectRoot()) {
  const { config: cfg, error } = loadConfig(root);
  if (error) fail(error);
  return cfg;
}

const rel = (root, abs) => path.relative(root, abs).replaceAll('\\', '/');

export function resolvePlan(arg, root = projectRoot(), cfg = config(root)) {
  if (!arg) fail('missing <plan> (path or slug)');
  const plans = normalizeDir(cfg.plansDir) ?? 'docs/plans';
  const candidates = [arg, path.join(plans, arg), path.join(plans, `${arg}.md`)];
  for (const c of candidates) {
    const abs = path.resolve(root, c);
    if (existsSync(abs) && abs.endsWith('.md')) return abs;
  }
  fail(`plan not found: ${arg} (looked in ${plans || '.'}/)`);
}

const cell = (s) => s.trim();

/** Parse the plan into header fields, section line ranges and unit blocks. */
export function parsePlan(text) {
  const lines = text.split(/\r?\n/);
  const header = {};
  const sections = [];
  const units = [];
  let unit = null;
  const closeUnit = (end) => {
    if (unit) { unit.end = end; units.push(unit); unit = null; }
  };
  lines.forEach((line, i) => {
    const sec = /^## (.+)$/.exec(line);
    if (sec) {
      closeUnit(i - 1);
      if (sections.length) sections.at(-1).end = i - 1;
      sections.push({ title: sec[1].trim(), start: i, end: lines.length - 1 });
      return;
    }
    const u = /^### (U\d+[a-z]?)\b\s*[—–-]?\s*(.*)$/.exec(line);
    if (u) {
      closeUnit(i - 1);
      unit = { id: u[1], title: u[2].trim(), start: i, end: lines.length - 1, fields: {} };
      return;
    }
    if (/^### /.test(line)) { closeUnit(i - 1); return; }
    const row = /^\|([^|]+)\|(.*)\|\s*$/.exec(line);
    if (!row) return;
    const key = cell(row[1]);
    if (/^[-:\s]+$/.test(key) || key === 'Field') return;
    if (unit) unit.fields[key] = cell(row[2]);
    else if (!sections.length) header[key] = cell(row[2]);
  });
  closeUnit(lines.length - 1);
  return { lines, header, sections, units };
}

export function unitWave(u) {
  const m = /\d+/.exec(u.fields.Wave ?? '');
  return m ? Number(m[0]) : null;
}

/** Wave 0, Kind `orchestrator` or an "(orchestrator)" title → the run-plan main session; everything else → the implementer. */
export function unitAgent(u) {
  if (unitWave(u) === 0) return ORCHESTRATOR;
  if (/\borchestrator\b/i.test(`${u.fields.Kind ?? ''} ${u.title} ${u.fields.Wave ?? ''}`)) return ORCHESTRATOR;
  return IMPLEMENTER;
}

const ownsField = (u) => u.fields['Owns (create/modify)'] ?? u.fields.Owns ?? '';

/** `a/{b,c}.ts` → [`a/b.ts`, `a/c.ts`] (one level, repeated until stable). */
export function expandBraces(p) {
  const m = /\{([^{}]*)\}/.exec(p);
  if (!m) return [p];
  return m[1].split(',').flatMap((alt) => expandBraces(p.slice(0, m.index) + alt.trim() + p.slice(m.index + m[0].length)));
}

/** Longest configured (non-root) module directory that contains `p`, or `null`. */
export function moduleDirOf(p, cfg) {
  return moduleDirs(cfg).find((d) => p === d || p.startsWith(`${d}/`)) ?? null;
}

/**
 * Owned paths of a unit: every backticked token that looks like a path, braces
 * expanded, project-relative. A token without a module prefix inherits the
 * module of the previous prefixed token (plans sometimes write
 * `services/api/src/a.ts`, `test/b.ts`) unless it is a root path that exists.
 */
export function ownedPaths(u, cfg, root = projectRoot()) {
  const out = [];
  let mod = null;
  for (const [, raw] of ownsField(u).matchAll(/`([^`]+)`/g)) {
    // `…/X.tsx` (elided middle) → `**/X.tsx`, which then inherits the module prefix.
    const tok = raw.trim().replace(/^\.\//, '').replace(/^(?:…|\.\.\.)\//, '**/');
    if (!/[/.]/.test(tok) || /\s/.test(tok)) continue;
    for (const p of expandBraces(tok)) {
      const own = moduleDirOf(p, cfg);
      if (own) { mod = own; out.push(p); }
      else if (!mod) out.push(p);
      else if (/^(docs|specs|scripts|\.claude|\.github)\//.test(p) || (!p.includes('/') && /\.(md|json|ya?ml)$/.test(p))) {
        out.push(existsSync(path.join(root, p.replace(/\*.*$/, ''))) ? p : `${mod}/${p}`);
      } else out.push(`${mod}/${p}`);
    }
  }
  return [...new Set(out)];
}

/** The unit's module entry: the `Module` field by name (or path), else inferred from owned paths, else the first module. */
export function unitModule(u, cfg, root = projectRoot()) {
  const field = (u.fields.Module ?? '').replace(/`/g, '').trim();
  if (field) {
    const byName = cfg.modules.find((m) => m.name === field || normalizeDir(m.path ?? '.') === normalizeDir(field));
    if (byName) return byName;
  }
  const dirs = new Set(ownedPaths(u, cfg, root).filter((p) => !p.startsWith('**/')).map((p) => moduleDirOf(p, cfg)));
  if (dirs.size === 1) {
    const d = [...dirs][0];
    const m = cfg.modules.find((x) => normalizeDir(x.path ?? '.') === (d ?? ''));
    if (m) return m;
  }
  return cfg.modules.find((m) => normalizeDir(m.path ?? '.') === '') ?? cfg.modules[0];
}

/** Skill names from the unit's `Skills` field (backticked or comma-separated; "none" → []). */
export function unitSkills(u) {
  const raw = u.fields.Skills ?? '';
  const ticked = [...raw.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  const names = ticked.length ? ticked : raw.split(/[,;·]/).map((s) => s.trim());
  return [...new Set(names.filter((n) => n && !/^(none|n\/a|-|—)$/i.test(n) && /^[a-z0-9:_-]+$/i.test(n)))];
}

const semverKey = (v) => (/^\d+(\.\d+)*/.exec(v)?.[0] ?? '').split('.').map(Number);
const newestFirst = (a, b) => {
  const x = semverKey(a);
  const y = semverKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) if ((y[i] ?? -1) !== (x[i] ?? -1)) return (y[i] ?? -1) - (x[i] ?? -1);
  return b.localeCompare(a);
};

/**
 * Absolute SKILL.md path of a namespaced skill (`engineering-paved-path:zod`;
 * a bare name means engineering-paved-path), or `null`. Plugins are installed
 * side by side — `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` —
 * or, in a marketplace checkout, `plugins/<plugin>/`. So this walks up from the
 * sdd-engineering plugin root and, at each ancestor, tries
 * `<plugin>/skills/<skill>/SKILL.md` and `<plugin>/<version>/skills/<skill>/SKILL.md`
 * (newest version first). The nearest ancestor wins (same marketplace).
 */
export function resolveSkill(name, pluginRoot = PLUGIN_ROOT) {
  const [plugin, skill] = name.includes(':') ? name.split(':', 2) : ['engineering-paved-path', name];
  if (!/^[a-z0-9_-]+$/i.test(plugin) || !/^[a-z0-9_-]+$/i.test(skill)) return null;
  if (plugin === 'sdd-engineering') {
    const own = path.join(pluginRoot, 'skills', skill, 'SKILL.md');
    return existsSync(own) ? own : null;
  }
  let dir = pluginRoot;
  for (let depth = 0; depth < 5; depth += 1) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    const base = path.join(dir, plugin);
    if (!existsSync(base)) continue;
    const direct = path.join(base, 'skills', skill, 'SKILL.md');
    if (existsSync(direct)) return direct;
    let versions = [];
    try {
      versions = readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(newestFirst);
    } catch { /* unreadable — keep walking */ }
    for (const v of versions) {
      const p = path.join(base, v, 'skills', skill, 'SKILL.md');
      if (existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * Fill a configured command for one unit: `{module}` → module path (`.` for the
 * root), `{files}` → the unit's concrete owned files inside that module,
 * project-relative and space-separated (none → the module's full check).
 * A command without placeholders is returned as written; `null` stays `null`.
 */
export function fillCommand(template, modulePath, files = []) {
  if (!template) return null;
  const mod = normalizeDir(modulePath ?? '.') || '.';
  const inModule = files.filter((f) => !/[*?[\]{}]/.test(f) && (mod === '.' || f === mod || f.startsWith(`${mod}/`)));
  return template.replaceAll('{module}', mod).replaceAll('{files}', inModule.join(' ')).replace(/\s+/g, ' ').trim();
}

/** How a project-relative file matches an owned path: exact > glob > suffix (prefix-less tokens). */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') { re += '.*'; i += glob[i + 2] === '/' ? 2 : 1; }
    else if (ch === '*') re += '[^/]*';
    else re += ch.replace(/[.+?^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchKind(file, owned, cfg) {
  if (file === owned) return 'exact';
  if (owned.includes('*') && globToRegExp(owned).test(file)) return 'glob';
  if (owned.endsWith('/') && file.startsWith(owned)) return 'glob';
  if (!moduleDirOf(owned, cfg) && owned.includes('/') && file.endsWith(`/${owned}`)) return 'suffix';
  return null;
}

export function owners(plan, files, cfg, root = projectRoot()) {
  return files.map((f) => {
    const file = f.replaceAll('\\', '/').replace(/^\.\//, '');
    const hits = [];
    for (const u of plan.units) {
      for (const o of ownedPaths(u, cfg, root)) {
        const kind = matchKind(file, o, cfg);
        if (kind) { hits.push({ unit: u.id, wave: unitWave(u), agent: unitAgent(u), match: kind, owned: o }); break; }
      }
    }
    const best = hits.filter((h) => h.match === 'exact').length ? hits.filter((h) => h.match === 'exact') : hits;
    // A file is usually re-owned by later waves (single-agent plans): the latest wave is the current owner.
    const latest = best.length ? Math.max(...best.map((h) => h.wave ?? -1)) : null;
    const current = best.filter((h) => (h.wave ?? -1) === latest);
    return {
      file,
      owner: current.length === 1 ? current[0].unit : null,
      agent: current.length === 1 ? current[0].agent : ORCHESTRATOR,
      status: current.length === 1 ? 'owned' : current.length ? 'ambiguous' : 'unowned',
      candidates: hits,
    };
  });
}

// ── commands ─────────────────────────────────────────────────────────────────

function load(planArg) {
  const root = projectRoot();
  const cfg = config(root);
  const file = resolvePlan(planArg, root, cfg);
  return { root, cfg, file, rel: rel(root, file), plan: parsePlan(readFileSync(file, 'utf8')) };
}

function findUnit(plan, id) {
  if (!id) fail('missing <U-id>');
  const u = plan.units.find((x) => x.id.toLowerCase() === id.toLowerCase());
  if (!u) fail(`unit ${id} not in plan (have: ${plan.units.map((x) => x.id).join(', ') || 'none'})`);
  return u;
}

function cmdWaves(planArg) {
  const { root, cfg, rel: relPath, plan } = load(planArg);
  if (!plan.units.length) fail(`no "### U<n>" unit blocks in ${relPath} — free-form plan, run-plan needs the template shape`);
  console.log(`plan: ${relPath}`);
  for (const k of ['Status', 'Execution mode', 'Requirements source', 'Modules touched']) if (plan.header[k]) console.log(`${k}: ${plan.header[k]}`);
  const byWave = new Map();
  for (const u of plan.units) {
    const w = unitWave(u);
    if (!byWave.has(w)) byWave.set(w, []);
    byWave.get(w).push(u);
  }
  for (const w of [...byWave.keys()].sort((a, b) => (a ?? 99) - (b ?? 99))) {
    console.log(`\nWave ${w ?? '?'}:`);
    for (const u of byWave.get(w)) {
      const skills = unitSkills(u);
      console.log(`  ${u.id.padEnd(4)} ${unitAgent(u).padEnd(28)} ${u.title}`);
      console.log(`       kind: ${u.fields.Kind ?? '?'} · module: ${unitModule(u, cfg, root).name} · depends: ${u.fields['Depends on'] ?? '?'} · owns ${ownedPaths(u, cfg, root).length} path(s) · skills: ${skills.length ? skills.join(', ') : 'none'}`);
    }
  }
}

function unitText(relPath, plan, u, agent) {
  const contracts = plan.sections.find((s) => /^3\.|contracts/i.test(s.title));
  const out = [`<!-- ${relPath} · ${u.id} · lines ${u.start + 1}-${u.end + 1} · agent: ${agent} -->`];
  for (const k of ['Goal', 'Execution mode', 'Requirements source']) if (plan.header[k]) out.push(`- ${k}: ${plan.header[k]}`);
  if (contracts) out.push(`- §3 Contracts: ${relPath} lines ${contracts.start + 1}-${contracts.end + 1} (read only the contracts this unit Consumes/Produces)`);
  out.push('', plan.lines.slice(u.start, u.end + 1).join('\n').trimEnd());
  return out.join('\n');
}

function cmdUnit(planArg, id) {
  const { rel: relPath, plan } = load(planArg);
  const u = findUnit(plan, id);
  console.log(unitText(relPath, plan, u, unitAgent(u)));
}

function cmdSkills(planArg, id) {
  const { plan } = load(planArg);
  const u = findUnit(plan, id);
  console.log(JSON.stringify(unitSkills(u).map((name) => ({ name, path: resolveSkill(name) })), null, 2));
}

function cmdBrief(planArg, id) {
  const { root, cfg, rel: relPath, plan } = load(planArg);
  const u = findUnit(plan, id);
  const agent = unitAgent(u);
  const mod = unitModule(u, cfg, root);
  const owned = ownedPaths(u, cfg, root);
  const skills = unitSkills(u).map((name) => ({ name, path: resolveSkill(name) }));
  const check = fillCommand(cfg.checkCommand, mod.path, owned);
  const arch = fillCommand(cfg.architectureCheck, mod.path);
  const lines = [
    `plan: ${relPath}`,
    `unit: ${u.id}`,
    'mode: build',
    `cwd: ${root} — run every command from here; never cd`,
    `module: ${mod.name} (${normalizeDir(mod.path ?? '.') || '.'})`,
    `skills:${skills.length ? '' : ' none'}`,
    ...skills.map((s) => `  - ${s.name}: ${s.path ?? 'NOT FOUND — locate it before launching (see run-plan SKILL.md)'}`),
    `checkCommand: ${check ?? 'not configured — report BLOCKED: checkCommand not configured'}`,
    ...(arch ? [`architectureCheck: ${arch} (only if the unit's Checks lists it)`] : []),
    'Unit block (from plan-tools — your copy of the plan; read §3 only by the line range given):',
    unitText(relPath, plan, u, agent),
  ];
  if (agent === ORCHESTRATOR) lines.unshift(`<!-- NOTE: ${u.id} is an orchestrator unit — run-plan does it itself; do not dispatch -->`);
  console.log(lines.join('\n'));
}

function cmdOwner(planArg, files) {
  if (!files.length) fail('missing <file…>');
  const { root, cfg, plan } = load(planArg);
  console.log(JSON.stringify(owners(plan, files, cfg, root), null, 2));
}

export function stateDir(slug, root = projectRoot(), cfg = config(root)) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug ?? '')) fail(`bad slug "${slug ?? ''}" (kebab-case expected)`);
  const base = normalizeDir(cfg.runStateDir) ?? '.sdd';
  return path.join(root, base, 'run-plan', slug);
}

function cmdState(op, slug, pairs) {
  const dir = stateDir(slug);
  const file = path.join(dir, 'state.json');
  if (op === 'dir') { console.log(dir); return; }
  const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  if (op === 'get') { console.log(JSON.stringify(state, null, 2)); return; }
  if (op !== 'set') fail('state <get|dir|set> <slug> [key=value…]');
  if (!pairs.length) fail('state set needs key=value pairs');
  for (const p of pairs) {
    const eq = p.indexOf('=');
    if (eq < 1) fail(`bad pair "${p}"`);
    const raw = p.slice(eq + 1);
    let value;
    try { value = JSON.parse(raw); } catch { value = raw; }
    state[p.slice(0, eq)] = value;
  }
  state.updatedAt = new Date().toISOString();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  console.log(JSON.stringify(state, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'config') console.log(JSON.stringify(config(), null, 2));
  else if (cmd === 'waves') cmdWaves(rest[0]);
  else if (cmd === 'unit') cmdUnit(rest[0], rest[1]);
  else if (cmd === 'brief') cmdBrief(rest[0], rest[1]);
  else if (cmd === 'skills') cmdSkills(rest[0], rest[1]);
  else if (cmd === 'owner') cmdOwner(rest[0], rest.slice(1));
  else if (cmd === 'state') cmdState(rest[0], rest[1], rest.slice(2));
  else fail('usage: plan-tools.mjs <config|waves|unit|brief|skills|owner|state> …');
}
