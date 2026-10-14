/**
 * Tests for write-guard.mjs — run from the plugin root: node --test scripts/write-guard.test.mjs
 * Each case spawns the real hook with a PreToolUse payload on stdin, in a
 * temporary project with (or without) a `.claude/sdd.json`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'write-guard.mjs');

const SPEC = 'sdd-engineering:spec-creator';
const PLANNER = 'sdd-engineering:implementation-planner';
const VERIFIER = 'sdd-engineering:plan-verifier';
const IMPLEMENTER = 'sdd-engineering:implementer';

function project(config) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-wg-'));
  if (config !== undefined) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude', 'sdd.json'), typeof config === 'string' ? config : JSON.stringify(config));
  }
  return dir;
}

const DEFAULT_PROJECT = project();
const MODULES_PROJECT = project({
  specsDir: 'specs/',
  plansDir: 'planning/',
  specTemplate: 'specs/spec-template.md',
  modules: [
    { name: 'api', path: 'services/api', specsDir: 'services/api/specs/' },
    { name: 'web', path: 'apps/web', specsDir: null },
  ],
});

function run(input, root = DEFAULT_PROJECT, env = {}) {
  const { CLAUDE_PROJECT_DIR: _drop, ...base } = process.env;
  return spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8', cwd: root, env: { ...base, ...env } });
}

const payload = (agent, filePath, root = DEFAULT_PROJECT, extra = {}) =>
  JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath }, cwd: root, ...(agent ? { agent_type: agent } : {}), ...extra });

function assertAllowed(agent, filePath, root = DEFAULT_PROJECT) {
  const res = run(payload(agent, filePath, root), root);
  assert.equal(res.status, 0, `expected ${agent} to be allowed to write ${filePath}, got ${res.status}: ${res.stderr}`);
  assert.equal(res.stdout, '');
  assert.equal(res.stderr, '');
}

function assertBlocked(agent, input, root = DEFAULT_PROJECT, raw = false) {
  const res = run(raw ? input : payload(agent, input, root), root);
  assert.equal(res.status, 2, `expected a block for ${agent} ${raw ? '(raw input)' : input}, got ${res.status}`);
  assert.match(res.stderr, /^sdd-engineering write-guard: /);
  return res.stderr;
}

test('main session, other plugins and unknown agents are never touched', () => {
  for (const agent of [undefined, 'general-purpose', 'Explore', 'architecture-review:architecture-reviewer', 'research-tools:researcher', 'other-plugin:spec-creator', 'spec-creator']) {
    assertAllowed(agent, 'src/app.ts');
    assertAllowed(agent, '../outside.md');
  }
});

test('implementer is not write-guarded (its scope is the plan file ownership)', () => {
  assertAllowed(IMPLEMENTER, 'src/app.ts');
});

test('fail-closed for guarded agents: empty stdin, invalid JSON, no file_path', () => {
  assertBlocked(SPEC, '', DEFAULT_PROJECT, true);
  assertBlocked(SPEC, '{not json', DEFAULT_PROJECT, true);
  assertBlocked(SPEC, JSON.stringify({ tool_name: 'Write', tool_input: {}, cwd: DEFAULT_PROJECT, agent_type: SPEC }), DEFAULT_PROJECT, true);
});

test('fail-closed on a malformed .claude/sdd.json; other agents unaffected', () => {
  const broken = project('{ "specsDir": ');
  assert.match(assertBlocked(SPEC, 'specs/x.md', broken), /sdd\.json is not valid JSON/);
  const wrongType = project({ plansDir: 42 });
  assert.match(assertBlocked(PLANNER, 'docs/plans/x.md', wrongType), /"plansDir" must be/);
  const escaping = project({ specsDir: '../elsewhere/' });
  assert.match(assertBlocked(SPEC, '../elsewhere/x.md', escaping), /"specsDir" must be/);
  assertAllowed(undefined, 'src/x.ts', broken);
});

test('missing sdd.json → defaults: spec-creator writes *.md under specs/ only', () => {
  for (const p of ['specs/2026-10-04-severity-filter.md', 'specs/README.md', 'specs/billing/2026-10-04-x.md', 'specs\\2026-10-04-y.md']) {
    assertAllowed(SPEC, p);
  }
  for (const p of [
    'specs/_TEMPLATE.md',
    'specs/2026-10-04-x.json',
    'src/app.ts',
    'AGENTS.md',
    'docs/plans/x.md',
    'docs/specs/x.md',
    'specsx/a.md',
    'specs.md',
    '../specs/x.md',
    'specs/../src/x.md',
  ]) {
    const reason = assertBlocked(SPEC, p);
    assert.match(reason, /spec-creator may not/);
    assert.match(reason, /write only Markdown specs under specs\//, 'reason must say what to do instead');
  }
});

test('spec-creator: absolute paths are normalized; outside the project is blocked', () => {
  assertAllowed(SPEC, path.join(DEFAULT_PROJECT, 'specs', 'a.md'));
  assertBlocked(SPEC, path.join(DEFAULT_PROJECT, 'src', 'a.md'));
  assertBlocked(SPEC, path.resolve(DEFAULT_PROJECT, '..', 'elsewhere', 'specs', 'a.md'));
});

test('relative path resolves against the hook cwd', () => {
  const input = payload(SPEC, '2026-10-04-x.md', DEFAULT_PROJECT, { cwd: path.join(DEFAULT_PROJECT, 'specs') });
  const res = run(input, DEFAULT_PROJECT, { CLAUDE_PROJECT_DIR: DEFAULT_PROJECT });
  assert.equal(res.status, 0, res.stderr);
  const escape = payload(SPEC, '../src/x.md', DEFAULT_PROJECT, { cwd: path.join(DEFAULT_PROJECT, 'specs') });
  assert.equal(run(escape, DEFAULT_PROJECT, { CLAUDE_PROJECT_DIR: DEFAULT_PROJECT }).status, 2);
});

test('configured specsDir + module specsDir; configured template protected', () => {
  for (const p of ['specs/2026-10-04-x.md', 'services/api/specs/2026-10-04-y.md', 'services/api/specs/README.md']) {
    assertAllowed(SPEC, p, MODULES_PROJECT);
  }
  for (const p of ['specs/spec-template.md', 'apps/web/specs/x.md', 'services/api/src/x.md', 'services/api/specs/x.ts', 'planning/x.md']) {
    assertBlocked(SPEC, p, MODULES_PROJECT);
  }
});

test('missing sdd.json → defaults: implementation-planner writes *.md directly in docs/plans/ only', () => {
  assertAllowed(PLANNER, 'docs/plans/severity-counters.md');
  assertAllowed(PLANNER, path.join(DEFAULT_PROJECT, 'docs', 'plans', 'x.md'));
  for (const p of ['docs/plans/sub/x.md', 'docs/plans/x.txt', 'docs/x.md', 'specs/x.md', 'src/app.ts', 'docs/plans/../x.md', '../docs/plans/x.md']) {
    const reason = assertBlocked(PLANNER, p);
    assert.match(reason, /implementation-planner may not/);
    assert.match(reason, /directly in docs\/plans\//);
  }
});

test('implementation-planner honours a configured plansDir', () => {
  assertAllowed(PLANNER, 'planning/x.md', MODULES_PROJECT);
  assertBlocked(PLANNER, 'docs/plans/x.md', MODULES_PROJECT);
});

test('plan-verifier may not write anything', () => {
  for (const p of ['docs/plans/x.md', 'specs/x.md', 'src/a.ts']) {
    assert.match(assertBlocked(VERIFIER, p), /plan-verifier is read-only/);
  }
});
