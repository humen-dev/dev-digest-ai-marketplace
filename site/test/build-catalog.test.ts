import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildCatalog, ownersFor, parseCodeowners, serialize } from '../scripts/build-catalog.mjs';
import type { Catalog, Plugin } from '../src/data/types';

const SITE = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(SITE, '..');
const FIXTURES = join(SITE, 'test', 'fixtures');
const SCRIPT = join(SITE, 'scripts', 'build-catalog.mjs');
const HISTORY = JSON.parse(readFileSync(join(FIXTURES, 'history.json'), 'utf8'));
const REPO = 'humen-dev/dev-digest-ai-marketplace';

const fixture = (): Catalog => buildCatalog({ root: FIXTURES, sample: true, history: HISTORY, repo: REPO }).catalog;
const plugin = (c: Catalog, name: string): Plugin => c.plugins.find((p) => p.name === name)!;

const temps: string[] = [];
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A throwaway marketplace: { "path": "content" } relative to its root. */
function tempMarketplace(files: Record<string, string | object>): string {
  const root = mkdtempSync(join(tmpdir(), 'catalog-'));
  temps.push(root);
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

const marketplace = (plugins: object[]) => ({ name: 'test-market', owner: { name: 'humen-dev' }, plugins });
const localPlugin = (name: string, extra: Record<string, string | object> = {}) => ({
  [`plugins/${name}/.claude-plugin/plugin.json`]: { name, description: `${name} plugin` },
  [`plugins/${name}/README.md`]: `# ${name}\n\nAbout ${name}.\n`,
  ...Object.fromEntries(Object.entries(extra).map(([p, c]) => [`plugins/${name}/${p}`, c])),
});

const runCli = (args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

describe('fixture marketplace', () => {
  it('lists the 7 sample plugins in marketplace order with 30 catalog items', () => {
    const c = fixture();
    expect(c.sample).toBe(true);
    expect(c.marketplace).toBe('dev-digest-ai-marketplace');
    expect(c.repo).toBe(REPO);
    expect(c.plugins.map((p) => p.name)).toEqual([
      'devdigest-release',
      'devdigest-backend',
      'devdigest-frontend',
      'devdigest-security',
      'devdigest-docs',
      'devdigest-observability',
      'devdigest-testing',
    ]);
    const artifacts = c.plugins.flatMap((p) => p.artifacts);
    expect(artifacts).toHaveLength(24);
    expect(artifacts.length + c.plugins.reduce((n, p) => n + p.hooks.length + p.mcp.length, 0)).toBe(30);
    expect(c.diagnostics).toEqual([]);
  });

  it('reads skills, agents and commands with names, descriptions and keywords from frontmatter', () => {
    const backend = plugin(fixture(), 'devdigest-backend');
    expect(backend.artifacts.map((a) => `${a.kind}:${a.name}`)).toEqual([
      'skill:api-endpoint',
      'skill:db-migration',
      'agent:backend-reviewer',
      'command:migrate-check',
    ]);
    const migration = backend.artifacts.find((a) => a.name === 'db-migration')!;
    expect(migration.description).toBe('Reversible Postgres migrations with rollback plan and lock-time estimate.');
    expect(migration.keywords).toBe('migration database postgres schema sql rollback міграція');
    expect(migration.path).toBe('plugins/devdigest-backend/skills/db-migration/SKILL.md');
    expect(migration.headings).toEqual(['Postgres migrations', 'Rules', 'Rollback plan']);
    expect(migration.body).toContain('CREATE INDEX CONCURRENTLY');
  });

  it('follows custom component paths from plugin.json', () => {
    const docs = plugin(fixture(), 'devdigest-docs');
    expect(docs.artifacts.find((a) => a.kind === 'command')).toMatchObject({ name: 'adr', path: 'plugins/devdigest-docs/prompts/adr.md' });
    expect(docs.version).toBeNull();
  });

  it('extracts hooks from hooks.json and inline plugin.json hooks', () => {
    const c = fixture();
    expect(plugin(c, 'devdigest-backend').hooks).toEqual([
      { event: 'PostToolUse', matcher: 'Edit|Write', command: 'npx prisma validate --schema prisma/schema.prisma' },
    ]);
    expect(plugin(c, 'devdigest-security').hooks).toEqual([
      { event: 'PreToolUse', matcher: 'Bash', command: '${CLAUDE_PLUGIN_ROOT}/scripts/block-dangerous.sh' },
    ]);
    expect(plugin(c, 'devdigest-docs').hooks).toEqual([]);
  });

  it('extracts MCP servers from .mcp.json and inline mcpServers', () => {
    const c = fixture();
    expect(plugin(c, 'devdigest-backend').mcp).toEqual([
      { name: 'postgres', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres ${DATABASE_URL}', url: null, env: ['DATABASE_URL'] },
    ]);
    expect(plugin(c, 'devdigest-release').mcp).toEqual([
      { name: 'github', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-github', url: null, env: ['GITHUB_TOKEN'] },
    ]);
    expect(plugin(c, 'devdigest-observability').mcp).toEqual([
      { name: 'sentry', transport: 'http', command: null, url: 'https://mcp.sentry.dev/mcp', env: [] },
    ]);
  });

  it('unions requested tools from skills, agents and commands', () => {
    const c = fixture();
    expect(plugin(c, 'devdigest-release').tools).toEqual(['Bash(gh pr list:*)', 'Bash(git log:*)']);
    expect(plugin(c, 'devdigest-security').tools).toEqual(['Bash(gitleaks:*)', 'Bash(npm audit:*)']);
    expect(plugin(c, 'devdigest-frontend').tools).toEqual([]);
  });

  it('reads the README title, body and "What it runs" notes', () => {
    const c = fixture();
    const release = plugin(c, 'devdigest-release');
    expect(release.readme).toEqual({
      title: 'Release tooling',
      body: [
        'Turns merged pull requests and conventional commits into release notes and changelog entries.',
        'Export GITHUB_TOKEN before starting Claude Code.',
      ],
    });
    expect(release.notes).toEqual({ GITHUB_TOKEN: 'A fine-grained token with read access to pull requests and contents is enough.' });
    expect(plugin(c, 'devdigest-frontend').notes).toEqual({
      'lint-on-save': "Runs the project's own ESLint config with --fix on the files Claude changed.",
    });
    expect(plugin(c, 'devdigest-observability').notes).toEqual({ sentry: 'Signs in with your Sentry account on first use.' });
  });

  it('takes owners from the last CODEOWNERS rule matching the plugin folder', () => {
    const c = fixture();
    expect(plugin(c, 'devdigest-backend').owners).toEqual(['@backend-guild']);
    expect(plugin(c, 'devdigest-observability').owners).toEqual(['@sre']);
    // `**/hooks/` owns files inside plugins, not the plugin itself.
    expect(plugin(c, 'devdigest-release').owners).toEqual(['@humen-dev']);
  });

  it('uses the --history file for dates and changes', () => {
    const release = plugin(fixture(), 'devdigest-release');
    expect(release.updated).toBe('2026-10-09');
    expect(release.changes[0]).toEqual({ version: '0.9.2', text: 'changelog-keeper moves Unreleased on tag' });
  });

  it('is deterministic: two CLI runs write identical bytes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalog-out-'));
    temps.push(dir);
    const args = ['--root', FIXTURES, '--sample', '--history', join(FIXTURES, 'history.json'), '--repo', REPO];
    expect(runCli([...args, '--out', join(dir, 'a.json')]).status).toBe(0);
    expect(runCli([...args, '--out', join(dir, 'b.json')]).status).toBe(0);
    const a = readFileSync(join(dir, 'a.json'));
    expect(a.equals(readFileSync(join(dir, 'b.json')))).toBe(true);
    expect(a.toString()).toBe(serialize(fixture()));
  });
});

describe('CODEOWNERS matching', () => {
  const rules = parseCodeowners('*  @all\n/plugins/a/  @a-team\nplugins/b  @b-team\n**/hooks/  @sec\ndocs/**  @docs\n');
  it('applies GitHub "last match wins" to the plugin folder', () => {
    expect(ownersFor(rules, 'plugins/a')).toEqual(['@a-team']);
    expect(ownersFor(rules, 'plugins/b')).toEqual(['@b-team']);
    expect(ownersFor(rules, 'plugins/c')).toEqual(['@all']);
    expect(ownersFor([], 'plugins/c')).toEqual([]);
  });
});

describe('edge cases', () => {
  it('never emits MCP env values, only their names', () => {
    const root = tempMarketplace({
      '.claude-plugin/marketplace.json': marketplace([{ name: 'p', source: './plugins/p', description: 'P.' }]),
      ...localPlugin('p', {
        '.mcp.json': {
          mcpServers: {
            api: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server.mjs', '--token', '${API_TOKEN}'], env: { SECRET_KEY: 'sk-live-DO-NOT-LEAK', REGION: 'eu-west-1' } },
            remote: { type: 'sse', url: 'https://example.com/sse?k=${REMOTE_KEY}', headers: { Authorization: 'Bearer ${REMOTE_TOKEN}' } },
          },
        },
      }),
    });
    const { catalog } = buildCatalog({ root, history: {}, repo: REPO });
    const json = serialize(catalog);
    expect(json).not.toContain('sk-live-DO-NOT-LEAK');
    expect(json).not.toContain('eu-west-1');
    expect(json).not.toContain('Bearer');
    expect(catalog.plugins[0].mcp).toEqual([
      { name: 'api', transport: 'stdio', command: 'node ${CLAUDE_PLUGIN_ROOT}/server.mjs --token ${API_TOKEN}', url: null, env: ['API_TOKEN', 'REGION', 'SECRET_KEY'] },
      { name: 'remote', transport: 'sse', command: null, url: 'https://example.com/sse?k=${REMOTE_KEY}', env: ['REMOTE_KEY', 'REMOTE_TOKEN'] },
    ]);
  });

  it('lists external sources from the marketplace entry without crawling them', () => {
    const root = tempMarketplace({
      '.claude-plugin/marketplace.json': marketplace([
        { name: 'ext', description: 'External plugin.', version: '2.0.0', source: { source: 'github', repo: 'someone/ext', sha: 'a'.repeat(40) } },
      ]),
      // A local folder with the same name must not be read.
      ...localPlugin('ext', { 'skills/hidden/SKILL.md': '---\nname: hidden\ndescription: Must not appear.\n---\n' }),
    });
    const { catalog } = buildCatalog({ root, history: {}, repo: REPO });
    expect(catalog.plugins).toEqual([
      expect.objectContaining({ name: 'ext', external: true, version: '2.0.0', description: 'External plugin.', source: 'https://github.com/someone/ext', artifacts: [], hooks: [], mcp: [] }),
    ]);
    expect(serialize(catalog)).not.toContain('hidden');
  });

  it('lists an artifact with invalid frontmatter by filename and reports a diagnostic', () => {
    const root = tempMarketplace({
      '.claude-plugin/marketplace.json': marketplace([{ name: 'p', source: './plugins/p', description: 'P.' }]),
      ...localPlugin('p', {
        'skills/broken-skill/SKILL.md': '---\nname: [unclosed\ndescription: still here\n---\n\nBody.\n',
        'agents/broken-agent.md': '---\nname: a\nname: b\n---\n',
        'README.md': '# P\n\n## What it runs\n\n### nothing-here\n\nA note for an item that does not exist.\n',
      }),
    });
    const { catalog, diagnostics } = buildCatalog({ root, history: {}, repo: REPO });
    expect(catalog.plugins[0].artifacts.map((a) => `${a.kind}:${a.name}`)).toEqual(['skill:broken-skill', 'agent:broken-agent']);
    expect(diagnostics).toEqual([
      { path: 'plugins/p/README.md', message: '"What it runs" note "nothing-here" matches no hook, MCP server or env var' },
      { path: 'plugins/p/agents/broken-agent.md', message: expect.stringMatching(/^invalid YAML frontmatter/) },
      { path: 'plugins/p/skills/broken-skill/SKILL.md', message: expect.stringMatching(/^invalid YAML frontmatter/) },
    ]);
    expect(catalog.diagnostics).toEqual(diagnostics);
  });

  it('prints diagnostics as warnings and still writes the catalog', () => {
    const root = tempMarketplace({
      '.claude-plugin/marketplace.json': marketplace([{ name: 'p', source: './plugins/p', description: 'P.' }]),
      ...localPlugin('p', { 'skills/s/SKILL.md': '---\ndescription: ok\nkeywords: [a, b\n---\n' }),
    });
    const r = runCli(['--root', root, '--out', join(root, 'out.json'), '--history', join(FIXTURES, 'history.json')]);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warning: plugins\/p\/skills\/s\/SKILL.md: invalid YAML frontmatter/);
    expect(JSON.parse(readFileSync(join(root, 'out.json'), 'utf8')).plugins[0].artifacts[0].name).toBe('s');
  });

  it('fails only on validator errors', () => {
    const root = tempMarketplace({
      '.claude-plugin/marketplace.json': marketplace([{ name: 'Bad_Name', source: './plugins/missing' }]),
    });
    const r = runCli(['--root', root, '--out', join(root, 'out.json')]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/kebab-case/);
  });

  it('takes updated and changes from git history of the plugin folder', () => {
    const root = mkdtempSync(join(tmpdir(), 'catalog-git-'));
    temps.push(root);
    cpSync(FIXTURES, root, { recursive: true });
    const git = (args: string[], date?: string) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
        cwd: root,
        env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
        stdio: 'ignore',
      });
    git(['init', '-q']);
    git(['add', '.']);
    git(['commit', '-q', '-m', 'Add fixtures'], '2026-01-02T10:00:00Z');
    writeFileSync(join(root, 'plugins/devdigest-docs/README.md'), '# DevDigest docs\n\nUpdated.\n');
    git(['commit', '-q', '-am', 'docs: refresh README'], '2026-03-04T10:00:00Z');
    const { catalog } = buildCatalog({ root, repo: REPO });
    expect(plugin(catalog, 'devdigest-docs').updated).toBe('2026-03-04');
    expect(plugin(catalog, 'devdigest-docs').changes).toEqual([
      { version: '2026-03-04', text: 'docs: refresh README' },
      { version: '2026-01-02', text: 'Add fixtures' },
    ]);
    expect(plugin(catalog, 'devdigest-backend').changes).toEqual([{ version: '2026-01-02', text: 'Add fixtures' }]);
    expect(catalog.sample).toBe(false);
  });
});

describe('this repository', () => {
  it('builds with no plugins (the site shows its empty state)', () => {
    const { catalog } = buildCatalog({ root: REPO_ROOT, repo: REPO });
    expect(catalog).toMatchObject({ marketplace: 'dev-digest-ai-marketplace', sample: false });
    expect(Array.isArray(catalog.plugins)).toBe(true);
  });
});
