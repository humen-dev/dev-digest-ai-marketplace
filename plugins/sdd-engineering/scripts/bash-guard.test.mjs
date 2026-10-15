/**
 * Tests for bash-guard.mjs — run from the plugin root: node --test scripts/bash-guard.test.mjs
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

const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bash-guard.mjs');

const IMPLEMENTER = 'sdd-engineering:implementer';
const VERIFIER = 'sdd-engineering:plan-verifier';
const RUNNERS = [IMPLEMENTER, VERIFIER];

function project(config) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-bg-'));
  if (config !== undefined) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude', 'sdd.json'), typeof config === 'string' ? config : JSON.stringify(config));
  }
  return dir;
}

const DEFAULT_PROJECT = project();
const CHECK = 'node scripts/check.mjs';
const ARCH = 'node scripts/arch-check.mjs src --strict';
const CONFIGURED = project({
  checkCommand: CHECK,
  architectureCheck: ARCH,
  modules: [
    { name: 'api', path: 'services/api' },
    { name: 'web', path: './apps/web/' },
  ],
});
const CHAINED = project({ checkCommand: 'pnpm lint && cargo test --workspace' });
const TEMPLATED = project({
  checkCommand: 'node scripts/check.mjs {module} {files}',
  architectureCheck: 'node scripts/arch-check.mjs {module}/src --strict',
  modules: [
    { name: 'root', path: '.' },
    { name: 'api', path: 'services/api' },
  ],
});

function run(input, root) {
  const { CLAUDE_PROJECT_DIR: _drop, ...base } = process.env;
  return spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8', cwd: root, env: base });
}

const payload = (agent, command, root) =>
  JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: root, ...(agent ? { agent_type: agent } : {}) });

function assertAllowed(agent, command, root = CONFIGURED) {
  const res = run(payload(agent, command, root), root);
  assert.equal(res.status, 0, `expected ${agent} to be allowed: ${command}\ngot ${res.status}: ${res.stderr}`);
  assert.equal(res.stderr, '');
}

function assertBlocked(agent, command, root = CONFIGURED, raw = false) {
  const res = run(raw ? command : payload(agent, command, root), root);
  assert.equal(res.status, 2, `expected a block for ${agent}: ${command}`);
  assert.match(res.stderr, /^sdd-engineering bash-guard: /);
  return res.stderr;
}

test('main session, other plugins and unknown agents are never touched', () => {
  for (const agent of [undefined, 'general-purpose', 'Explore', 'research-tools:researcher', 'other-plugin:implementer', 'implementer']) {
    for (const cmd of ['git commit -m x', 'npm install', 'rm -rf build', 'echo $HOME > x']) assertAllowed(agent, cmd);
  }
});

test('architecture-review:architecture-reviewer is not affected (its own plugin guards it)', () => {
  for (const cmd of ['git status', 'git commit -m x', 'pnpm install']) assertAllowed('architecture-review:architecture-reviewer', cmd);
});

test('fail-closed: empty stdin, invalid JSON, no command', () => {
  assertBlocked(VERIFIER, '', CONFIGURED, true);
  assertBlocked(VERIFIER, '{not json', CONFIGURED, true);
  assertBlocked(VERIFIER, JSON.stringify({ tool_name: 'Bash', tool_input: {}, cwd: CONFIGURED, agent_type: VERIFIER }), CONFIGURED, true);
});

test('fail-closed on a malformed sdd.json for guarded agents only', () => {
  const broken = project('{');
  assert.match(assertBlocked(VERIFIER, 'git status', broken), /sdd\.json is not valid JSON/);
  assertAllowed(undefined, 'git status', broken);
});

test('spec-creator and implementation-planner have no shell at all', () => {
  for (const agent of ['sdd-engineering:spec-creator', 'sdd-engineering:implementation-planner']) {
    assert.match(assertBlocked(agent, 'git status'), /no shell access/);
  }
});

test('every runner: read-only git allowed', () => {
  for (const agent of RUNNERS) {
    for (const cmd of [
      'git status',
      'git diff main...HEAD',
      'git log --oneline -5',
      'git show HEAD:package.json',
      'git merge-base main HEAD',
      'git ls-files services/api',
      'git blame src/a.ts',
      'git diff --stat main...HEAD | git log -1',
    ]) assertAllowed(agent, cmd);
  }
});

test('every runner: git state changes, installs, writes, substitution and escapes blocked', () => {
  for (const agent of RUNNERS) {
    for (const cmd of [
      'git add .',
      'git commit -m x',
      'git checkout -- src/x.ts',
      'git switch -c x',
      'git reset --hard',
      'git rebase main',
      'git push',
      'git stash',
      'git merge main',
      'git restore src/x.ts',
      'git rm src/x.ts',
      'git mv a b',
      'git -c core.pager=sh log',
      'git diff --output=x',
      'git diff --output x',
      'git log -o x',
      'git diff main...HEAD > out.txt',
      'git log < in.txt',
      'pnpm install',
      'npm install',
      'npm ci',
      'yarn add x',
      'pnpm add -D x',
      'pip install x',
      'rm -rf x',
      'mv a b',
      'echo $(id)',
      'echo ${HOME}',
      'git log `id`',
      'echo x | tee y',
      'git status & rm -rf x',
      'FOO=1 git status',
      'cd ..',
      'cd /tmp',
      'cd src',
      'cd services/api',
      'cd services/api && git status',
      'cat src/a.ts',
      'ls src',
      'grep -r x src',
      'head -5 src/a.ts',
      'gh pr create',
      'curl https://example.com',
      'docker compose down -v',
      'powershell -c "git commit"',
    ]) {
      const reason = assertBlocked(agent, cmd);
      assert.match(reason, new RegExp(`${agent.split(':')[1]} may not`));
      assert.match(reason, /allowed commands:/, 'reason must say what to do instead');
    }
  }
});

test('checkCommand and architectureCheck: prefix match with extra arguments', () => {
  for (const agent of RUNNERS) {
    for (const cmd of [
      CHECK,
      `${CHECK} services/api/src/a.ts services/api/test/a.test.ts`,
      `${CHECK} --full`,
      ARCH,
      `${ARCH} --output-type err`,
    ]) assertAllowed(agent, cmd);
    for (const cmd of [
      'node scripts/check.mjs ../../etc/passwd',
      'node scripts/other.mjs',
      'node scripts',
      'node scripts/arch-check.mjs lib',
    ]) assertBlocked(agent, cmd);
  }
});

test('a chained checkCommand allows each of its segments', () => {
  assertAllowed(IMPLEMENTER, 'pnpm lint && cargo test --workspace', CHAINED);
  assertAllowed(IMPLEMENTER, 'cargo test --workspace -p api', CHAINED);
  assertBlocked(IMPLEMENTER, 'cargo build', CHAINED);
});

test('placeholders: {module} = a configured module path, {files} = 0+ project-relative paths', () => {
  for (const agent of RUNNERS) {
    for (const cmd of [
      'node scripts/check.mjs services/api',
      'node scripts/check.mjs services/api services/api/src/a.ts services/api/test/a.test.ts',
      'node scripts/check.mjs . src/a.ts',
      'node scripts/check.mjs ./services/api/ services/api/src/a.ts',
      'node scripts/arch-check.mjs services/api/src --strict',
      'node scripts/arch-check.mjs ./src --strict',
    ]) assertAllowed(agent, cmd, TEMPLATED);
    for (const cmd of [
      'node scripts/check.mjs',
      'node scripts/check.mjs apps/web src/a.ts',
      'node scripts/check.mjs services/api --watch',
      'node scripts/check.mjs services/api ../../etc/passwd',
      'node scripts/check.mjs services/api src/a.ts --fix',
      'node scripts/arch-check.mjs services/api/src --strict --output-to x',
      'node scripts/arch-check.mjs lib/src --strict',
    ]) assertBlocked(agent, cmd, TEMPLATED);
  }
});

test('missing sdd.json → defaults: only read-only git (plus test runners for the implementer)', () => {
  assertAllowed(IMPLEMENTER, 'git status', DEFAULT_PROJECT);
  assertAllowed(VERIFIER, 'git status', DEFAULT_PROJECT);
  assertAllowed(IMPLEMENTER, 'pnpm test', DEFAULT_PROJECT);
  const reason = assertBlocked(IMPLEMENTER, CHECK, DEFAULT_PROJECT);
  assert.match(reason, /no checkCommand is configured/);
  assertBlocked(VERIFIER, 'pnpm test', DEFAULT_PROJECT);
});

test('plan-verifier runs only git reads and the configured checks — no other runners', () => {
  for (const cmd of ['pnpm test', 'npm run typecheck', 'npx vitest run src', 'node --test scripts/']) assertBlocked(VERIFIER, cmd);
});

test('implementer test runners: plain runs allowed; snapshot update, coverage, watch blocked', () => {
  for (const cmd of [
    'pnpm test',
    'pnpm typecheck',
    'npm test',
    'npm run typecheck',
    'yarn test',
    'pnpm exec vitest run apps/web/src/app/x',
    'pnpm exec vitest related src/app/x/X.tsx --run --reporter=dot',
    'npx vitest run specs/x.test.ts',
    'pnpm exec vitest run src --exclude src/slow',
    'pnpm exec vitest run --exclude=src/slow -t "renders row"',
  ]) assertAllowed(IMPLEMENTER, cmd);
  for (const cmd of [
    'pnpm exec vitest run -u',
    'pnpm exec vitest run --update',
    'pnpm exec vitest run --coverage',
    'pnpm exec vitest run --watch',
    'pnpm exec vitest run --outputFile=x.json',
    'pnpm exec vitest',
    'pnpm test -u',
    'npx vitest run -u',
    'pnpm dev',
  ]) assertBlocked(IMPLEMENTER, cmd);
});
