/**
 * Tests for bash-guard.mjs — run: node --test "plugins/architecture-review/scripts/*.test.mjs"
 * Each case spawns the real hook with a PreToolUse payload on stdin, in a
 * temporary project directory with its own .claude/sdd.json.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.join(HERE, 'bash-guard.mjs');
const AGENT = 'architecture-review:architecture-reviewer';

const TMP = mkdtempSync(path.join(tmpdir(), 'arch-guard-'));
after(() => rmSync(TMP, { recursive: true, force: true }));

/** Create a fake project (with a `.git` marker) and optional .claude/sdd.json. */
function project(name, config) {
  const dir = path.join(TMP, name);
  mkdirSync(path.join(dir, '.git'), { recursive: true });
  if (config !== undefined) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude', 'sdd.json'), typeof config === 'string' ? config : JSON.stringify(config));
  }
  return dir;
}

const CONFIGURED = project('configured', {
  architectureCheck: 'npx depcruise src --config .dependency-cruiser.cjs',
  modules: [
    { name: 'api', path: 'packages/api' },
    { name: 'web', path: './packages/web/' },
    { name: 'escape', path: '../outside' },
  ],
});
const MULTI = project('multi', { architectureCheck: 'cd packages/api && npm run lint:arch' });
const BARE = project('bare');
const BROKEN = project('broken', '{not json');
const UNSAFE = project('unsafe', { architectureCheck: 'npx depcruise src > out.txt' });

function run(input, cwd = CONFIGURED) {
  return spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8', cwd });
}

const payload = (command, { agent = AGENT, cwd = CONFIGURED } = {}) =>
  JSON.stringify({
    session_id: 's',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
    cwd,
    ...(agent === null ? {} : { agent_type: agent }),
  });

function assertAllowed(command, opts = {}) {
  const res = run(payload(command, opts), opts.cwd);
  assert.equal(res.status, 0, `expected allowed: ${command}\nstderr: ${res.stderr}`);
  assert.equal(res.stdout, '', 'allow must print nothing');
  assert.equal(res.stderr, '', 'allow must print nothing');
}

function assertBlocked(command, opts = {}, raw = false) {
  const res = run(raw ? command : payload(command, opts), opts.cwd);
  assert.equal(res.status, 2, `expected blocked (exit 2): ${command}\nstderr: ${res.stderr}`);
  assert.match(res.stderr, /^architecture-review bash-guard: /);
  return res.stderr;
}

test('inert for other agents: any command allowed silently', () => {
  for (const agent of ['sdd-engineering:implementer', 'research-tools:researcher', 'architecture-reviewer', 'Explore']) {
    assertAllowed('rm -rf / && npm install', { agent });
    assertAllowed('echo $(id) > x', { agent });
  }
});

test('inert for the main session (no agent_type)', () => {
  assertAllowed('npm install && rm -rf build', { agent: null });
  assertAllowed('git commit -m x', { agent: null });
});

test('fail-closed for the reviewer: bad input, empty command, broken or unsafe config', () => {
  assertBlocked('', {}, true);
  assertBlocked('{not json', {}, true);
  assertBlocked(JSON.stringify({ agent_type: AGENT, tool_name: 'Bash', tool_input: {}, cwd: CONFIGURED }), {}, true);
  assertBlocked('   ');
  assert.match(assertBlocked('git status', { cwd: BROKEN }), /could not read/);
  assert.match(assertBlocked('git status', { cwd: UNSAFE }), /architectureCheck .* contains redirection/);
});

test('read-only git allowed', () => {
  for (const cmd of [
    'git status',
    'git status --porcelain',
    'git diff main...HEAD',
    'git diff --name-status abc123',
    'git log --oneline -5',
    'git show HEAD:packages/api/package.json',
    'git merge-base main HEAD',
    'git rev-parse HEAD',
    'git ls-files --others --exclude-standard',
    'git branch --show-current',
    'git diff --stat main...HEAD | git log -1',
    'git merge-base main HEAD && git diff --name-status main',
  ]) assertAllowed(cmd);
});

test('writes, installs, substitution and escapes blocked', () => {
  for (const cmd of [
    'rm -rf x',
    'npm install',
    'pnpm install',
    'npm test',
    'npx tsc --noEmit',
    'git add .',
    'git commit -m x',
    'git checkout -- src/x.ts',
    'git stash',
    'git branch new-branch',
    'git branch -D main',
    'git -c core.pager=sh log',
    'git -C /tmp status',
    'git diff --output=x',
    'git diff --output x',
    'git log -o x',
    'git diff main...HEAD > out.txt',
    'git log < in.txt',
    'cat src/index.ts',
    'echo $(id)',
    'echo ${HOME}',
    'git log `id`',
    'echo x | tee y',
    'git status & rm -rf x',
    'FOO=1 git status',
    'git status; rm -rf x',
    'git status && npm install',
    'cd ..',
    'cd /tmp',
    'cd ../outside',
    'cd packages/api && rm -rf src',
    'powershell -c "git commit"',
  ]) {
    const reason = assertBlocked(cmd);
    assert.match(reason, /architecture-reviewer may not/);
    assert.match(reason, /allowed commands:/, 'reason must say what to do instead');
  }
});

test('cd only into configured module paths', () => {
  assertAllowed('cd packages/api && git status');
  assertAllowed('cd ./packages/web/ && git ls-files');
  assertBlocked('cd packages/other && git status');
  assertBlocked('cd packages/api', { cwd: BARE }); // no modules configured
});

test('configured architectureCheck allowed (exact prefix, extra args ok)', () => {
  assertAllowed('npx depcruise src --config .dependency-cruiser.cjs');
  assertAllowed('npx depcruise src --config .dependency-cruiser.cjs --output-type err-long');
  assertAllowed('git diff --name-only main && npx depcruise src --config .dependency-cruiser.cjs');
  assertAllowed('cd packages/api && npx depcruise src --config .dependency-cruiser.cjs');
  // not a prefix of the configured command
  assertBlocked('npx depcruise src');
  assertBlocked('npx depcruise lib --config .dependency-cruiser.cjs');
  assertBlocked('npx depcruise src --config .dependency-cruiser.cjs && rm -rf src');
  assertBlocked('npx depcruise src --config .dependency-cruiser.cjs > report.txt');
});

test('multi-segment architectureCheck allowed as a whole, not in parts', () => {
  assertAllowed('cd packages/api && npm run lint:arch', { cwd: MULTI });
  assertAllowed('cd packages/api && npm run lint:arch -- --format json', { cwd: MULTI });
  assertBlocked('npm run lint:arch', { cwd: MULTI });
  assertBlocked('cd packages/api && npm run build', { cwd: MULTI });
});

test('no architectureCheck configured: no checker assumed', () => {
  const reason = assertBlocked('npx depcruise src --config .dependency-cruiser.cjs', { cwd: BARE });
  assert.match(reason, /no architectureCheck is configured/);
  assertAllowed('git diff main...HEAD', { cwd: BARE });
});

test('config found from a subdirectory cwd, not above the repository root', () => {
  const sub = path.join(CONFIGURED, 'packages', 'api');
  mkdirSync(sub, { recursive: true });
  assertAllowed('npx depcruise src --config .dependency-cruiser.cjs', { cwd: sub });
  // BARE has its own .git, so it never picks up a config from TMP or above
  writeFileSync(path.join(TMP, 'sdd.json'), '{}');
  assertBlocked('npx depcruise src --config .dependency-cruiser.cjs', { cwd: BARE });
});
