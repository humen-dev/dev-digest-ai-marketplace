/**
 * Tests for plan-tools.mjs — run from the plugin root: node --test skills/run-plan/scripts/plan-tools.test.mjs
 * Parsing is checked on synthetic plans inside temporary projects (with and
 * without a .claude/sdd.json); skill resolution on a fake plugin cache.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS } from '../../../scripts/lib/sdd-config.mjs';
import {
  IMPLEMENTER,
  expandBraces,
  fillCommand,
  ownedPaths,
  owners,
  parsePlan,
  resolveSkill,
  unitAgent,
  unitModule,
  unitSkills,
  unitWave,
} from './plan-tools.mjs';

const TOOL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'plan-tools.mjs');
const TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../templates/plan.md');

const CFG = {
  ...structuredClone(DEFAULTS),
  plansDir: 'planning/',
  checkCommand: 'node scripts/check.mjs {module} {files}',
  architectureCheck: 'node scripts/arch-check.mjs {module}/src',
  runStateDir: '.state/',
  modules: [
    { name: 'root', path: '.', specsDir: null },
    { name: 'api', path: 'services/api', specsDir: 'services/api/specs/' },
    { name: 'web', path: 'apps/web', specsDir: null },
  ],
};

const SYNTHETIC = `# X — development plan

| Field | Value |
|---|---|
| Status | approved |
| Execution mode | multi-agent (parallel waves) |
| Requirements source | specs/2026-10-01-x.md (SPEC-07) |

## 3. Contracts
\`\`\`ts
export type A = string;
\`\`\`

## 4. Work units

### U0 — Contracts
| Field | Value |
|---|---|
| Kind | orchestrator |
| Skills | none |
| Module | api |
| Wave | 0 |
| Owns (create/modify) | \`services/api/src/contracts/a.ts\`, \`package.json\` |

### U1 — api: service
| Field | Value |
|---|---|
| Kind | backend |
| Skills | \`engineering-paved-path:onion-architecture\`, \`engineering-paved-path:zod\` |
| Module | api |
| Wave | 1 |
| Owns (create/modify) | \`services/api/src/a/{service,routes}.ts\`, \`test/a.test.ts\` |

### U2 — web: card
| Field | Value |
|---|---|
| Kind | ui |
| Skills | engineering-paved-path:react-best-practices, engineering-paved-path:frontend-ui-architecture |
| Module | web |
| Wave | 1 |
| Owns (create/modify) | \`apps/web/src/a/ACard/**\` |

### U3 — docs update (orchestrator)
| Field | Value |
|---|---|
| Kind | docs |
| Skills | none |
| Wave | 2 |
| Owns (create/modify) | \`AGENTS.md\` |

### U4 — api: service again (single-agent re-own)
| Field | Value |
|---|---|
| Kind | backend |
| Skills | none |
| Wave | 2 |
| Owns (create/modify) | \`services/api/src/a/service.ts\` |

## 5. Waves
`;

function project(cfg, files = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-pt-'));
  if (cfg) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude', 'sdd.json'), typeof cfg === 'string' ? cfg : JSON.stringify(cfg));
  }
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    writeFileSync(path.join(dir, p), text);
  }
  return dir;
}

const cli = (cwd, ...args) => spawnSync(process.execPath, [TOOL, ...args], { cwd, encoding: 'utf8' });

test('expandBraces expands every group', () => {
  assert.deepEqual(expandBraces('a/{b,c}/{d,e}.ts'), ['a/b/d.ts', 'a/b/e.ts', 'a/c/d.ts', 'a/c/e.ts']);
  assert.deepEqual(expandBraces('a/b.ts'), ['a/b.ts']);
});

test('synthetic plan: header, units, waves, agents (orchestrator vs the one implementer)', () => {
  const plan = parsePlan(SYNTHETIC);
  assert.equal(plan.header.Status, 'approved');
  assert.deepEqual(plan.units.map((u) => u.id), ['U0', 'U1', 'U2', 'U3', 'U4']);
  assert.deepEqual(plan.units.map(unitWave), [0, 1, 1, 2, 2]);
  assert.deepEqual(plan.units.map(unitAgent), ['orchestrator', IMPLEMENTER, IMPLEMENTER, 'orchestrator', IMPLEMENTER]);
  // unit blocks stop at the next section, not at the end of the file
  assert.ok(!plan.lines.slice(plan.units[4].start, plan.units[4].end + 1).join('\n').includes('## 5.'));
});

test('unitSkills: backticked or comma-separated, "none" → []', () => {
  const [u0, u1, u2] = parsePlan(SYNTHETIC).units;
  assert.deepEqual(unitSkills(u0), []);
  assert.deepEqual(unitSkills(u1), ['engineering-paved-path:onion-architecture', 'engineering-paved-path:zod']);
  assert.deepEqual(unitSkills(u2), ['engineering-paved-path:react-best-practices', 'engineering-paved-path:frontend-ui-architecture']);
});

test('ownedPaths: braces expanded, module prefix inherited; unitModule from field or paths', () => {
  const root = project();
  const [, u1, u2, u3, u4] = parsePlan(SYNTHETIC).units;
  assert.deepEqual(ownedPaths(u1, CFG, root), ['services/api/src/a/service.ts', 'services/api/src/a/routes.ts', 'services/api/test/a.test.ts']);
  assert.equal(unitModule(u1, CFG, root).name, 'api');
  assert.equal(unitModule(u2, CFG, root).name, 'web');
  assert.equal(unitModule(u4, CFG, root).name, 'api', 'no Module field → inferred from owned paths');
  assert.equal(unitModule(u3, CFG, root).name, 'root');
});

test('owners: exact, glob, unowned, latest wave wins on re-own', () => {
  const root = project();
  const plan = parsePlan(SYNTHETIC);
  const res = owners(plan, ['services/api/src/a/routes.ts', 'apps/web/src/a/ACard/ACard.tsx', 'services/api/src/other.ts', 'services/api/src/a/service.ts'], CFG, root);
  assert.deepEqual(res.map((r) => [r.status, r.owner, r.agent]), [
    ['owned', 'U1', IMPLEMENTER],
    ['owned', 'U2', IMPLEMENTER],
    ['unowned', null, 'orchestrator'],
    ['owned', 'U4', IMPLEMENTER],
  ]);
  assert.equal(res[3].candidates.length, 2);
});

test('fillCommand: {module} and {files} filled; globs and other modules dropped; no files → full check', () => {
  const files = ['services/api/src/a.ts', 'services/api/test/a.test.ts', 'services/api/src/x/**', 'apps/web/b.ts'];
  assert.equal(fillCommand('node scripts/check.mjs {module} {files}', 'services/api', files), 'node scripts/check.mjs services/api services/api/src/a.ts services/api/test/a.test.ts');
  assert.equal(fillCommand('node scripts/check.mjs {module} {files}', 'services/api', []), 'node scripts/check.mjs services/api');
  assert.equal(fillCommand('pnpm test -- {files}', '.', ['a.ts', 'b/c.ts']), 'pnpm test -- a.ts b/c.ts');
  assert.equal(fillCommand('make check', 'services/api', files), 'make check');
  assert.equal(fillCommand(null, '.', files), null);
});

test('resolveSkill: marketplace checkout layout and versioned cache layout, newest version first', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'sdd-skills-'));
  const skill = (p) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, '---\nname: x\n---\n'); return p; };
  // cache: <cache>/<marketplace>/<plugin>/<version>/
  const cacheMkt = path.join(tmp, 'cache', 'mkt');
  const sddRoot = path.join(cacheMkt, 'sdd-engineering', '1.0.0');
  mkdirSync(sddRoot, { recursive: true });
  skill(path.join(cacheMkt, 'engineering-paved-path', '1.2.0', 'skills', 'zod', 'SKILL.md'));
  const newest = skill(path.join(cacheMkt, 'engineering-paved-path', '1.10.0', 'skills', 'zod', 'SKILL.md'));
  assert.equal(resolveSkill('engineering-paved-path:zod', sddRoot), newest);
  assert.equal(resolveSkill('zod', sddRoot), newest, 'bare names mean engineering-paved-path');
  assert.equal(resolveSkill('engineering-paved-path:nope', sddRoot), null);
  assert.equal(resolveSkill('../../etc:passwd', sddRoot), null);
  // checkout: plugins/<plugin>/
  const plugins = path.join(tmp, 'repo', 'plugins');
  const sddCheckout = path.join(plugins, 'sdd-engineering');
  const own = skill(path.join(sddCheckout, 'skills', 'ears-requirements', 'SKILL.md'));
  const direct = skill(path.join(plugins, 'engineering-paved-path', 'skills', 'security', 'SKILL.md'));
  assert.equal(resolveSkill('engineering-paved-path:security', sddCheckout), direct);
  assert.equal(resolveSkill('sdd-engineering:ears-requirements', sddCheckout), own);
});

test('CLI with sdd.json: waves, unit, brief, skills, owner, state under runStateDir', () => {
  const root = project(CFG, { 'planning/x.md': SYNTHETIC });
  const waves = cli(root, 'waves', 'x');
  assert.equal(waves.status, 0, waves.stderr);
  assert.match(waves.stdout, /^plan: planning\/x\.md/);
  assert.match(waves.stdout, /Status: approved/);
  assert.match(waves.stdout, /Wave 1:\n\s+U1\s+sdd-engineering:implementer\s/);
  assert.match(waves.stdout, /module: api .* skills: engineering-paved-path:onion-architecture, engineering-paved-path:zod/);

  const unit = cli(root, 'unit', 'planning/x.md', 'U2');
  assert.equal(unit.status, 0, unit.stderr);
  assert.match(unit.stdout, /^<!-- planning\/x\.md · U2 · lines \d+-\d+ · agent: sdd-engineering:implementer -->/);
  assert.match(unit.stdout, /§3 Contracts: .* lines \d+-\d+/);
  assert.match(unit.stdout, /### U2 — /);
  assert.doesNotMatch(unit.stdout, /### U3 — /);

  const brief = cli(root, 'brief', 'x', 'U1');
  assert.equal(brief.status, 0, brief.stderr);
  assert.match(brief.stdout, /^plan: planning\/x\.md\nunit: U1\nmode: build\n/);
  assert.match(brief.stdout, /module: api \(services\/api\)/);
  assert.match(brief.stdout, /checkCommand: node scripts\/check\.mjs services\/api services\/api\/src\/a\/service\.ts services\/api\/src\/a\/routes\.ts services\/api\/test\/a\.test\.ts/);
  assert.match(brief.stdout, /architectureCheck: node scripts\/arch-check\.mjs services\/api\/src/);
  assert.match(brief.stdout, /engineering-paved-path:zod: (NOT FOUND|.*SKILL\.md)/);
  assert.match(cli(root, 'brief', 'x', 'U0').stdout, /orchestrator unit/);

  const skills = JSON.parse(cli(root, 'skills', 'x', 'U1').stdout);
  assert.deepEqual(skills.map((s) => s.name), ['engineering-paved-path:onion-architecture', 'engineering-paved-path:zod']);

  const owner = JSON.parse(cli(root, 'owner', 'x', 'services\\api\\src\\a\\routes.ts').stdout);
  assert.equal(owner[0].owner, 'U1');

  const set = cli(root, 'state', 'set', 'x', 'phase=wave0', 'wave=0', 'flags=["--strict"]');
  assert.equal(set.status, 0, set.stderr);
  const stateFile = path.join(root, '.state', 'run-plan', 'x', 'state.json');
  assert.ok(existsSync(stateFile));
  assert.deepEqual(JSON.parse(readFileSync(stateFile, 'utf8')).flags, ['--strict']);
  assert.equal(JSON.parse(cli(root, 'state', 'get', 'x').stdout).wave, 0);
  assert.equal(cli(root, 'state', 'dir', 'x').stdout.trim(), path.join(root, '.state', 'run-plan', 'x'));
});

test('CLI without sdd.json: defaults (docs/plans/, .sdd/, no checkCommand)', () => {
  const root = project(null, { 'docs/plans/y.md': SYNTHETIC });
  const cfg = JSON.parse(cli(root, 'config').stdout);
  assert.deepEqual(cfg, DEFAULTS);
  const brief = cli(root, 'brief', 'y', 'U1');
  assert.equal(brief.status, 0, brief.stderr);
  assert.match(brief.stdout, /checkCommand: not configured/);
  assert.match(brief.stdout, /module: root \(\.\)/);
  cli(root, 'state', 'set', 'y', 'phase=done');
  assert.ok(existsSync(path.join(root, '.sdd', 'run-plan', 'y', 'state.json')));
});

test('the shipped plan template parses: no unit blocks (placeholders only), header fields present', () => {
  if (!existsSync(TEMPLATE)) return; // templates/ is authored separately; skip until it exists
  const plan = parsePlan(readFileSync(TEMPLATE, 'utf8'));
  assert.ok('Status' in plan.header);
  assert.equal(plan.units.length, 0);
});

test('CLI errors exit 2 with a reason', () => {
  const root = project(CFG, { 'planning/x.md': SYNTHETIC, 'planning/free.md': '# Free-form\n\nJust prose.\n' });
  for (const args of [['unit', 'x', 'U99'], ['waves', 'free'], ['waves', 'no-such-plan'], ['state', 'get', 'Bad_Slug'], ['nope'], ['brief', 'x']]) {
    const r = cli(root, ...args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /^plan-tools: /);
  }
  const broken = project('{');
  const r = cli(broken, 'config');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /sdd\.json is not valid JSON/);
});
