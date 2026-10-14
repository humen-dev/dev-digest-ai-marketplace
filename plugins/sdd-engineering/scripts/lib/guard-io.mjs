/**
 * Shared I/O for the sdd-engineering PreToolUse guards (write-guard, bash-guard).
 *
 * The guards are plugin hooks: they fire for EVERY tool call in every session
 * where the plugin is enabled. Each guard therefore first checks `agent_type`
 * and returns immediately (exit 0, no output) for the main session and for any
 * agent it does not own. Only for its own agents does it apply an allow-list.
 *
 * For those agents every helper here is fail-closed: anything the guard cannot
 * read or resolve becomes a block, never an allow. A guard that silently opens
 * on bad input is worse than no guard, because the agent's prompt assumes it holds.
 *
 * Blocking = exit code 2 with the reason on stderr (Claude Code shows it to the
 * agent, which then knows what it may do instead).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Block the tool call: reason on stderr, exit 2. */
export function block(guard, reason) {
  process.stderr.write(`sdd-engineering ${guard}: ${reason}\n`);
  process.exit(2);
}

/** Allow = exit 0 with no output. */
export function allow() {
  process.exit(0);
}

/** Read the hook payload from stdin; empty or unparsable input is a block. */
export function readPayload(guard) {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    block(guard, 'could not read hook input — refusing the call.');
  }
  if (!raw.trim()) block(guard, 'empty hook input — refusing the call.');
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    block(guard, 'could not parse hook input — refusing the call.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) block(guard, 'hook input is not an object — refusing the call.');
  return payload;
}

/** `agent_type` of the caller, or `null` for the main session. */
export function agentType(payload) {
  return typeof payload.agent_type === 'string' && payload.agent_type ? payload.agent_type : null;
}

/**
 * Project root: `$CLAUDE_PROJECT_DIR` (set by Claude Code for hooks), else the
 * payload `cwd`, else the process cwd. `.claude/sdd.json` is read from here.
 */
export function projectRoot(payload) {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd());
}

/**
 * Project-relative path with `/` separators for a tool path argument, resolved
 * against the hook's `cwd`; `null` when it escapes the project root (`..`,
 * another drive, an absolute path elsewhere) or names the root itself.
 * Backslashes are normalized first so Windows-style input behaves the same on
 * every platform.
 */
export function projectRelative(payload, p) {
  const root = projectRoot(payload);
  const base = payload.cwd ? path.resolve(root, String(payload.cwd)) : root;
  const abs = path.resolve(base, String(p).replaceAll('\\', '/'));
  const rel = path.relative(root, abs).replaceAll('\\', '/');
  if (!rel || rel === '..' || rel.startsWith('../') || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null;
  return rel;
}

/** Case-insensitive on Windows (its file system is), exact elsewhere. */
export const samePath = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

/** `rel` lies inside directory `dir` (canonical, `''` = project root). */
export function isUnder(rel, dir) {
  if (dir === '') return true;
  const r = process.platform === 'win32' ? rel.toLowerCase() : rel;
  const d = process.platform === 'win32' ? dir.toLowerCase() : dir;
  return r.startsWith(`${d}/`);
}

/** Split a shell command into segments that each start a new command. */
export function segments(command) {
  return command.split(/&&|\|\||;|\||\n/g).map((s) => s.trim()).filter(Boolean);
}

/** Whitespace tokenizer that keeps quoted runs together. */
export function tokenize(segment) {
  const tokens = [];
  let cur = '';
  let quote = null;
  for (const ch of segment) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (/\s/.test(ch)) {
      if (cur) { tokens.push(cur); cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}
