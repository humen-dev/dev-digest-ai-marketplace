#!/usr/bin/env node
/**
 * sdd-engineering version trace — wired in hooks/hooks.json for two events:
 *   SessionStart  → tells the session which sdd-engineering version is active
 *                   (one line of `additionalContext`) and records a trace line;
 *   SubagentStart → records a trace line when one of this plugin's agents
 *                   (`sdd-engineering:*`) starts; other agents are ignored.
 *
 * The version is read from this copy's own `.claude-plugin/plugin.json`, and
 * the marketplace (release channel) from the plugin cache layout
 * `<cache>/<marketplace>/sdd-engineering/<version>/` — so the trace shows what
 * actually loaded, not what a manifest somewhere claims.
 *
 * Trace lines are appended as JSON to `<runStateDir>/trace.jsonl` (default
 * `.sdd/trace.jsonl`), but only in a project that opted into the workflow: one
 * with `.claude/sdd.json` or an existing run-state directory. Other projects get
 * the context line and nothing on disk.
 *
 * Never blocks and never fails a session: every error ends in exit 0.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, normalizeDir } from './lib/sdd-config.mjs';

const PLUGIN = 'sdd-engineering';
const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** `{ version, marketplace }` of the copy this script belongs to. */
export function identify(root = pluginRoot) {
  let version = 'unknown';
  try {
    const manifest = JSON.parse(readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
    if (typeof manifest.version === 'string' && manifest.version) version = manifest.version;
  } catch {
    // keep "unknown"
  }
  // Cache layout: <cache>/<marketplace>/<plugin>/<version>/ — anything else is a
  // marketplace loaded in place from a local checkout.
  const parent = path.dirname(root);
  const marketplace = path.basename(parent) === PLUGIN ? path.basename(path.dirname(parent)) : 'local';
  return { version, marketplace };
}

/** Trace file for an opted-in project, else `null`. */
export function traceFile(projectDir) {
  const { config, file } = loadConfig(projectDir);
  const dir = normalizeDir(config.runStateDir) ?? '.sdd';
  const stateDir = path.join(projectDir, dir || '.');
  if (!file && !existsSync(stateDir)) return null;
  return path.join(stateDir, 'trace.jsonl');
}

function readPayload() {
  try {
    const parsed = JSON.parse(readFileSync(0, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function main() {
  const payload = readPayload();
  const event = payload.hook_event_name;
  const agent = typeof payload.agent_type === 'string' ? payload.agent_type : null;
  if (event === 'SubagentStart' && !agent?.startsWith(`${PLUGIN}:`)) return;

  const { version, marketplace } = identify();
  const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd());

  try {
    const file = traceFile(projectDir);
    if (file) {
      mkdirSync(path.dirname(file), { recursive: true });
      const line = {
        ts: new Date().toISOString(),
        event,
        plugin: PLUGIN,
        version,
        marketplace,
        session_id: payload.session_id ?? null,
        ...(event === 'SessionStart' ? { source: payload.source ?? null } : { agent_type: agent, agent_id: payload.agent_id ?? null }),
      };
      appendFileSync(file, `${JSON.stringify(line)}\n`);
    }
  } catch {
    // tracing is best-effort
  }

  if (event === 'SessionStart') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `Active plugin: ${PLUGIN}@${marketplace} version ${version}.`,
        },
      }),
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch {
    // never fail a session
  }
  process.exit(0);
}
