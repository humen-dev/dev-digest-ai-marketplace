#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Bash) of the architecture-review plugin.
 *
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/bash-guard.mjs"   (stdin: hook payload JSON)
 *
 * Plugin hooks fire in every session and subagent where the plugin is enabled,
 * so the guard is inert unless the payload's `agent_type` is
 * `architecture-review:architecture-reviewer`: anything else (the main session,
 * other agents, other plugins) exits 0 with no output.
 *
 * For the reviewer it is an allow-list, not a block-list: the command is split
 * into segments (`&&` `||` `;` `|` newline) and EVERY segment must be one of
 *   - `cd <module path>` (paths from `modules` in .claude/sdd.json),
 *   - read-only git without output-to-file flags,
 *   - the project's `architectureCheck` command from .claude/sdd.json
 *     (token-prefix match: extra arguments may follow it).
 * Before that, anything that could smuggle a write or a second command past
 * the tokenizer (redirection, substitution, background `&`, `tee`, `$`
 * expansion) is rejected outright. Being over-strict is cheap: the agent gets
 * a reason telling it what it may run instead.
 *
 * Allow  = exit 0, no output.
 * Block  = exit 2, reason on stderr (Claude Code shows it to the agent).
 * Fail-closed for the reviewer: unreadable config or input becomes a block.
 *
 * Self-contained: Node built-ins only, no dependencies.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const GUARD = 'architecture-review bash-guard';
const AGENT = 'architecture-review:architecture-reviewer';
const ROLE = 'architecture-reviewer';

const GIT_READ = new Set([
  'status',
  'diff',
  'log',
  'show',
  'merge-base',
  'rev-parse',
  'ls-files',
  'ls-tree',
  'cat-file',
  'blame',
  'describe',
]);
const GIT_BRANCH_FLAGS = new Set(['--show-current', '--list', '-a', '--all', '-r', '--remotes', '-v', '-vv']);

/** Constructs rejected anywhere in the raw command, quoted or not. */
const FORBIDDEN = [
  [/[<>]/, 'redirection (< or >)'],
  [/`/, 'backtick substitution'],
  [/\$/, '$ expansion or substitution'],
  [/(^|[^&])&(?!&)/, 'background &'],
  [/(^|[\s|;&])tee(\s|$)/, 'tee'],
];

// ---------------------------------------------------------------- shell parsing

/** Split a shell command into segments that each start a new command. */
function segments(command) {
  return command
    .split(/&&|\|\||;|\||\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Whitespace tokenizer that keeps quoted runs together. */
function tokenize(segment) {
  const tokens = [];
  let cur = '';
  let quote = null;
  for (const ch of segment) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        tokens.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

const startsWith = (t, words) => t.length >= words.length && words.every((w, i) => t[i] === w);
const sameTokens = (a, b) => a.length === b.length && a.every((w, i) => w === b[i]);

// ---------------------------------------------------------------- matchers

/** Read-only git without an output-to-file flag or config/dir overrides. */
function isGitRead(t) {
  if (t[0] !== 'git' || t.length < 2) return false;
  if (t[1] === 'branch') return t.slice(2).every((a) => GIT_BRANCH_FLAGS.has(a));
  if (!GIT_READ.has(t[1])) return false;
  return !t.slice(2).some((a) => a === '-o' || a === '--output' || a.startsWith('--output=') || a === '--ext-diff');
}

/** Normalise a module path: forward slashes, no leading `./`, no trailing `/`. */
function normPath(p) {
  let s = String(p).replaceAll('\\', '/').trim();
  while (s.startsWith('./')) s = s.slice(2);
  while (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/** A module path is usable for `cd` only if it is relative and stays inside the project. */
function safeModulePath(p) {
  const s = normPath(p);
  if (!s || s === '.' || s.startsWith('/') || /^[A-Za-z]:/.test(s)) return null;
  if (s.split('/').some((part) => part === '..' || part === '')) return null;
  return s;
}

/** `cd <module path>` — the only way to change directory. */
function isCd(t, modulePaths) {
  if (t.length !== 2 || t[0] !== 'cd') return false;
  const target = normPath(t[1]);
  return modulePaths.has(target);
}

// ---------------------------------------------------------------- config

/** Find `.claude/sdd.json` from `cwd` upwards, stopping at the repository root (a `.git` entry). */
function findConfig(cwd) {
  let dir = path.resolve(cwd);
  for (;;) {
    const candidate = path.join(dir, '.claude', 'sdd.json');
    if (existsSync(candidate)) return candidate;
    if (existsSync(path.join(dir, '.git'))) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Load the parts of .claude/sdd.json this guard needs.
 * Returns { checkSegs: string[][] | null, checkText: string | null, modulePaths: Set<string> }.
 * Throws with a human-readable message when the file exists but is unusable.
 */
function loadConfig(cwd) {
  const file = findConfig(cwd);
  const config = { checkSegs: null, checkText: null, modulePaths: new Set() };
  if (!file) return config;
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`could not read ${file}: ${err.message}`);
  }
  if (!raw || typeof raw !== 'object') throw new Error(`${file} is not a JSON object`);

  if (raw.architectureCheck !== undefined && raw.architectureCheck !== null && raw.architectureCheck !== '') {
    const check = raw.architectureCheck;
    if (typeof check !== 'string') throw new Error(`architectureCheck in ${file} must be a string`);
    for (const [re, what] of FORBIDDEN) {
      if (re.test(check)) throw new Error(`architectureCheck in ${file} contains ${what}; the guard cannot allow it — use a plain command`);
    }
    const segs = segments(check).map(tokenize).filter((s) => s.length);
    if (segs.length) {
      config.checkSegs = segs;
      config.checkText = check.trim();
    }
  }

  if (Array.isArray(raw.modules)) {
    for (const m of raw.modules) {
      const p = m && typeof m === 'object' ? safeModulePath(m.path) : null;
      if (p) config.modulePaths.add(p);
    }
  }
  return config;
}

/**
 * Does the configured check start at segment index `i`?
 * All check segments but the last must match exactly; the last one is a token
 * prefix (extra arguments allowed). Returns the number of segments consumed, or 0.
 */
function matchCheckAt(segTokens, i, checkSegs) {
  if (!checkSegs || i + checkSegs.length > segTokens.length) return 0;
  const last = checkSegs.length - 1;
  for (let k = 0; k < checkSegs.length; k++) {
    const actual = segTokens[i + k];
    const expected = checkSegs[k];
    const ok = k === last ? startsWith(actual, expected) : sameTokens(actual, expected);
    if (!ok) return 0;
  }
  return checkSegs.length;
}

// ---------------------------------------------------------------- decision

/**
 * Pure decision function. Returns null to allow, or a reason string to block.
 * `config` is the result of loadConfig().
 */
function decide(command, config) {
  const allowedText = [
    config.modulePaths.size ? `cd <module path: ${[...config.modulePaths].join(' | ')}>` : null,
    'read-only git (status|diff|log|show|merge-base|rev-parse|ls-files|ls-tree|cat-file|blame|describe, branch --show-current)',
    config.checkText ? `the configured architectureCheck "${config.checkText}" [extra args]` : 'no architectureCheck is configured in .claude/sdd.json',
  ]
    .filter(Boolean)
    .join(', ');
  const instead = `allowed commands: ${allowedText} — chained only with && ; | ||, no redirection, env assignments or substitution. Read files with Read/Grep/Glob, not Bash.`;

  if (typeof command !== 'string' || !command.trim()) return `${ROLE} may not run an empty command; ${instead}`;

  for (const [re, what] of FORBIDDEN) {
    if (re.test(command)) return `${ROLE} may not use ${what}; ${instead}`;
  }

  const segs = segments(command);
  const segTokens = segs.map(tokenize);
  for (let i = 0; i < segs.length; ) {
    const tokens = segTokens[i];
    if (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) {
      return `${ROLE} may not prefix commands with env assignments ("${segs[i]}"); ${instead}`;
    }
    const consumed = matchCheckAt(segTokens, i, config.checkSegs);
    if (consumed) {
      i += consumed;
      continue;
    }
    if (isCd(tokens, config.modulePaths) || isGitRead(tokens)) {
      i += 1;
      continue;
    }
    return `${ROLE} may not run "${segs[i]}"; ${instead}`;
  }
  return null;
}

// ---------------------------------------------------------------- hook entry

function block(reason) {
  process.stderr.write(`${GUARD}: ${reason}\n`);
  process.exit(2);
}

function main() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    block('could not read hook input — refusing the call.');
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    block('could not parse hook input — refusing the call.');
  }
  if (!payload || typeof payload !== 'object') block('hook input is not an object — refusing the call.');

  // Inert for the main session and for every other agent.
  if (payload.agent_type !== AGENT) process.exit(0);

  let config;
  try {
    config = loadConfig(payload.cwd || process.cwd());
  } catch (err) {
    block(`${err.message} — refusing the command.`);
  }

  const reason = decide(payload.tool_input?.command, config);
  if (reason) block(reason);
  process.exit(0);
}

main();
