#!/usr/bin/env node
/**
 * sdd-engineering PreToolUse guard for Bash — wired in hooks/hooks.json:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/bash-guard.mjs"
 *
 * Acts only when the hook payload's `agent_type` is one of this plugin's agents;
 * the main session and every other agent (including
 * architecture-review:architecture-reviewer, which its own plugin guards) pass
 * through untouched.
 *
 *   sdd-engineering:plan-verifier → read-only git, the project's `checkCommand`
 *                                   and `architectureCheck` from .claude/sdd.json
 *                                   (`{module}` / `{files}` placeholders filled in)
 *   sdd-engineering:implementer   → the same, plus the common test/typecheck
 *                                   runners (pnpm|npm|yarn test|typecheck, vitest
 *                                   run|related) — no watch, update or coverage
 *   sdd-engineering:spec-creator,
 *   sdd-engineering:implementation-planner → no Bash at all
 *
 * An allow-list, not a block-list: the command is split into segments
 * (`&&` `||` `;` `|` newline) and EVERY segment must match. Before that, anything
 * that could smuggle a write or a second command past the tokenizer
 * (redirection, substitution, background `&`, `tee`, `$` expansion, env
 * assignments) is rejected outright. So git state changes (add, commit,
 * checkout, reset, rebase, push, stash, …), package installs, `cd`, `rm`, `mv`,
 * `cat` and everything else not listed are blocked; commands run from the
 * project root. Being over-strict is cheap: the agent
 * gets a reason that lists what it may run instead.
 */
import { allow, agentType, block, projectRoot, readPayload, segments, tokenize } from './lib/guard-io.mjs';
import { loadConfig, normalizeDir } from './lib/sdd-config.mjs';

const GUARD = 'bash-guard';
const PREFIX = 'sdd-engineering:';
const RUNNERS = new Set([`${PREFIX}implementer`, `${PREFIX}plan-verifier`]);
const NO_BASH = new Set([`${PREFIX}spec-creator`, `${PREFIX}implementation-planner`]);

const GIT_READ = new Set(['status', 'diff', 'log', 'show', 'merge-base', 'rev-parse', 'ls-files', 'blame', 'grep']);

/** Read-only git without any output-to-file or external-program flag. */
const isGitRead = (t) =>
  t[0] === 'git' &&
  GIT_READ.has(t[1]) &&
  !t.slice(2).some((a) => a === '-o' || a === '--output' || a.startsWith('--output=') || a.startsWith('--ext-diff') || a === '-O' || a.startsWith('--open-files-in-pager'));

/**
 * Vitest arguments: paths plus a few harmless flags. Anything that writes
 * (`-u`, `--update`, `--coverage`, `--outputFile`) or never exits (`--watch`)
 * falls outside the list and is blocked.
 */
const VITEST_FLAGS = new Set(['--', '--run', '--exclude', '-t', '--testNamePattern', '--passWithNoTests', '--silent', '--reporter=dot']);
const vitestArgsOk = (args) =>
  args.every((a) => !a.startsWith('-') || VITEST_FLAGS.has(a) || a.startsWith('--exclude=') || a.startsWith('--testNamePattern='));

const eq = (t, ...words) => t.length === words.length && words.every((w, i) => t[i] === w);
const startsWith = (t, ...words) => t.length >= words.length && words.every((w, i) => t[i] === w);

/** Common test and typecheck runners (no install, no watch, no snapshot update). */
function isTestRun(t) {
  for (const pm of ['pnpm', 'npm', 'yarn']) {
    if (eq(t, pm, 'typecheck') || eq(t, pm, 'run', 'typecheck')) return true;
    if (startsWith(t, pm, 'test')) return vitestArgsOk(t.slice(2));
    if (startsWith(t, pm, 'run', 'test')) return vitestArgsOk(t.slice(3));
  }
  if (startsWith(t, 'pnpm', 'exec', 'vitest', 'run') || startsWith(t, 'pnpm', 'exec', 'vitest', 'related')) return vitestArgsOk(t.slice(4));
  if (startsWith(t, 'npx', 'vitest', 'run') || startsWith(t, 'npx', 'vitest', 'related')) return vitestArgsOk(t.slice(3));
  return false;
}

/**
 * Configured commands (`checkCommand`, `architectureCheck`) become templates —
 * one per segment, so `"pnpm typecheck && pnpm test"` allows both segments.
 * Placeholders (shared contract with the agents and run-plan):
 *   `{module}` → the `path` of any configured module (`.` for the root module)
 *   `{files}`  → zero or more project-relative file paths (never a flag, never `..`)
 * A template without placeholders matches the command as written, plus extra
 * path arguments (the implementer may scope a plain command to its files).
 */
const templatesOf = (cmd) => (typeof cmd === 'string' && cmd.trim() ? segments(cmd).map(tokenize).filter((t) => t.length) : []);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const noClimb = (a) => !a.replaceAll('\\', '/').split('/').includes('..');
const isPathArg = (a) => !a.startsWith('-') && noClimb(a);

/** RegExp for one template token that embeds `{module}` / `{files}` (e.g. `--dir={module}`). */
function tokenRe(tpl, modulePaths) {
  const mod = `(?:${modulePaths.map(escapeRe).join('|')})`;
  const parts = tpl.split(/(\{module\}|\{files\})/);
  const re = parts.map((p) => (p === '{module}' ? mod : p === '{files}' ? '[^\\s]*' : escapeRe(p))).join('');
  return new RegExp(`^${re}$`);
}

/** Does the token list match the template (with backtracking over `{files}`)? */
function matchTemplate(t, tpl, modulePaths) {
  const hasPlaceholder = tpl.some((x) => /\{(module|files)\}/.test(x));
  const step = (i, j) => {
    if (j === tpl.length) return i === t.length || (!hasPlaceholder && t.slice(i).every(noClimb));
    const x = tpl[j];
    if (x === '{files}') {
      for (let k = i; k <= t.length; k += 1) {
        if (k > i && !isPathArg(t[k - 1])) break;
        if (step(k, j + 1)) return true;
      }
      return false;
    }
    if (i >= t.length) return false;
    const ok = /\{(module|files)\}/.test(x) ? tokenRe(x, modulePaths).test(t[i]) && noClimb(t[i]) : t[i] === x;
    return ok && step(i + 1, j + 1);
  };
  return step(0, 0);
}

/** Constructs rejected anywhere in the raw command, quoted or not. */
const FORBIDDEN = [
  [/[<>]/, 'redirection (< or >)'],
  [/`/, 'backtick substitution'],
  [/\$/, '$ expansion or substitution'],
  [/(^|[^&])&(?!&)/, 'background &'],
  [/(^|[\s|;&])tee(\s|$)/, 'tee'],
];

const payload = readPayload(GUARD);
const agent = agentType(payload);
if (!agent || !(RUNNERS.has(agent) || NO_BASH.has(agent))) allow();

const name = agent.slice(PREFIX.length);
if (NO_BASH.has(agent)) block(GUARD, `${name} has no shell access — read files with Read/Grep/Glob instead.`);

const { config, error } = loadConfig(projectRoot(payload));
if (error) block(GUARD, `${error} — fix the project config before ${name} runs commands.`);

const command = payload.tool_input?.command;
if (typeof command !== 'string' || !command.trim()) block(GUARD, `${name} may not run an empty command — refusing.`);

const modulePaths = [...new Set(config.modules.map((m) => normalizeDir(m.path ?? '.')).filter((d) => d !== null).flatMap((d) => (d ? [d, `./${d}`, `${d}/`, `./${d}/`] : ['.', './'])))];
const check = templatesOf(config.checkCommand);
const arch = templatesOf(config.architectureCheck);
const isImplementer = agent === `${PREFIX}implementer`;

const allowed = [
  'read-only git (status|diff|log|show|merge-base|rev-parse|ls-files|blame|grep)',
  config.checkCommand ? `the check command "${config.checkCommand}" ({module} = a module path, {files} = project-relative files)` : 'no checkCommand is configured in .claude/sdd.json',
  config.architectureCheck ? `the architecture check "${config.architectureCheck}"` : null,
  isImplementer ? 'pnpm|npm|yarn test|typecheck, pnpm exec vitest run|related [paths], npx vitest run|related [paths]' : null,
].filter(Boolean).join(', ');
const instead = `allowed commands: ${allowed} — run from the project root (no cd), chained only with && ; | ||, no redirection, env assignments or substitution. Read files with Read/Grep/Glob, not cat/ls/grep. Git state changes, installs, moves and deletes belong to the orchestrator: report them as BLOCKED.`;

for (const [re, what] of FORBIDDEN) {
  if (re.test(command)) block(GUARD, `${name} may not use ${what}; ${instead}`);
}

for (const seg of segments(command)) {
  const tokens = tokenize(seg);
  if (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) {
    block(GUARD, `${name} may not prefix commands with env assignments ("${seg}"); ${instead}`);
  }
  const ok =
    isGitRead(tokens) ||
    (isImplementer && isTestRun(tokens)) ||
    check.some((tpl) => matchTemplate(tokens, tpl, modulePaths)) ||
    arch.some((tpl) => matchTemplate(tokens, tpl, modulePaths));
  if (!ok) block(GUARD, `${name} may not run "${seg}"; ${instead}`);
}

allow();
