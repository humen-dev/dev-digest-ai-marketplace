/**
 * Tests for trace.mjs — run from the plugin root: node --test scripts/trace.test.mjs
 * Each case spawns the real hook with a SessionStart / SubagentStart payload on
 * stdin, in a temporary project with (or without) `.claude/sdd.json`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identify } from './trace.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'trace.mjs');
const { version } = JSON.parse(
  readFileSync(path.join(path.dirname(HOOK), '..', '.claude-plugin', 'plugin.json'), 'utf8'),
);

function project(config) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-trace-'));
  if (config !== undefined) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude', 'sdd.json'), JSON.stringify(config));
  }
  return dir;
}

function run(dir, payload, raw) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: raw ?? JSON.stringify({ session_id: 's1', cwd: dir, ...payload }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
  return res;
}

const traceLines = (file) => readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('SessionStart reports the active version as additionalContext', () => {
  const res = run(project(), { hook_event_name: 'SessionStart', source: 'startup' });
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, new RegExp(`sdd-engineering@\\S+ version ${version.replaceAll('.', '\\.')}\\.`));
});

test('a project without sdd.json or .sdd/ gets no trace file', () => {
  const dir = project();
  run(dir, { hook_event_name: 'SessionStart', source: 'startup' });
  assert.equal(existsSync(path.join(dir, '.sdd')), false);
});

test('an opted-in project gets a SessionStart trace line with the version', () => {
  const dir = project({});
  run(dir, { hook_event_name: 'SessionStart', source: 'resume' });
  const [line] = traceLines(path.join(dir, '.sdd', 'trace.jsonl'));
  assert.equal(line.event, 'SessionStart');
  assert.equal(line.plugin, 'sdd-engineering');
  assert.equal(line.version, version);
  assert.equal(line.source, 'resume');
  assert.equal(line.session_id, 's1');
});

test('runStateDir from sdd.json decides where the trace goes', () => {
  const dir = project({ runStateDir: 'tmp/sdd-state/' });
  run(dir, { hook_event_name: 'SessionStart', source: 'startup' });
  assert.equal(traceLines(path.join(dir, 'tmp', 'sdd-state', 'trace.jsonl')).length, 1);
});

test('an existing .sdd/ directory opts in without sdd.json', () => {
  const dir = project();
  mkdirSync(path.join(dir, '.sdd'));
  run(dir, { hook_event_name: 'SessionStart', source: 'startup' });
  assert.equal(traceLines(path.join(dir, '.sdd', 'trace.jsonl')).length, 1);
});

test('SubagentStart traces only sdd-engineering agents, silently', () => {
  const dir = project({});
  const own = run(dir, { hook_event_name: 'SubagentStart', agent_type: 'sdd-engineering:plan-verifier', agent_id: 'a1' });
  const other = run(dir, { hook_event_name: 'SubagentStart', agent_type: 'general-purpose', agent_id: 'a2' });
  assert.equal(own.status, 0);
  assert.equal(own.stdout, '');
  assert.equal(other.stdout, '');
  const lines = traceLines(path.join(dir, '.sdd', 'trace.jsonl'));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].agent_type, 'sdd-engineering:plan-verifier');
  assert.equal(lines[0].agent_id, 'a1');
  assert.equal(lines[0].version, version);
});

test('bad input never fails the session', () => {
  const res = run(project({}), null, 'not json');
  assert.equal(res.status, 0);
});

test('identify reads the marketplace from the plugin cache layout', () => {
  const cache = mkdtempSync(path.join(os.tmpdir(), 'sdd-cache-'));
  const root = path.join(cache, 'my-market-stable', 'sdd-engineering', '1.0.0');
  mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'sdd-engineering', version: '1.0.0' }));
  assert.deepEqual(identify(root), { version: '1.0.0', marketplace: 'my-market-stable' });
  assert.deepEqual(identify(path.join(cache, 'plugins', 'sdd-engineering-checkout')).marketplace, 'local');
});
