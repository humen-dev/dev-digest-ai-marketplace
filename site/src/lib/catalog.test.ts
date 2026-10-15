import { describe, expect, it } from 'vitest';
import { findPlugin, hookName, hookSummary, isUnpinned, items, mcpMeta, mcpSummary, securityFlags } from './catalog';

const item = (id: string) => items.find((i) => i.id === id)!;

describe('hooks (§6.1, §8.1)', () => {
  it('names a hook after the script it runs, else <Event>:<matcher>', () => {
    expect(hookName({ event: 'PreToolUse', matcher: 'Bash', command: '${CLAUDE_PLUGIN_ROOT}/scripts/block-dangerous.sh' })).toBe('block-dangerous');
    expect(hookName({ event: 'PostToolUse', matcher: 'Edit|Write', command: 'npx prisma validate' })).toBe('PostToolUse:Edit|Write');
    expect(hookName({ event: 'Stop', matcher: null, command: 'echo done' })).toBe('Stop');
    // Quoted form recommended by docs/PLUGIN-GUIDELINES.md.
    expect(hookName({ event: 'PreToolUse', matcher: 'Bash', command: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/check.sh" --strict' })).toBe('check');
  });

  it('uses the templated summaries', () => {
    expect(hookSummary({ event: 'PreToolUse', matcher: 'Bash', command: '' })).toBe('Runs before Claude uses Bash. Can block the call.');
    expect(hookSummary({ event: 'PostToolUse', matcher: 'Edit|Write', command: '' })).toBe('Runs after every file Claude edits or writes.');
    expect(hookSummary({ event: 'PostToolUse', matcher: 'Bash', command: '' })).toBe('Runs after Claude uses Bash.');
    expect(hookSummary({ event: 'SessionStart', matcher: null, command: '' })).toBe('Runs when a session starts.');
    expect(hookSummary({ event: 'Notification', matcher: null, command: '' })).toBe('Runs on Notification.');
  });
});

describe('MCP servers (§6.1, §8.1)', () => {
  it('summarises launcher, local and remote servers', () => {
    expect(mcpSummary({ name: 'pg', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres', url: null, env: [] })).toBe(
      'Starts with Claude Code. Downloads the package from npm on first run.',
    );
    expect(mcpSummary({ name: 'x', transport: 'stdio', command: 'uvx mcp-server-time', url: null, env: [] })).toMatch(/PyPI/);
    expect(mcpSummary({ name: 'x', transport: 'stdio', command: './bin/server --port 1', url: null, env: [] })).toBe(
      'Starts ./bin/server as a local process with Claude Code.',
    );
    expect(mcpSummary({ name: 's', transport: 'http', command: null, url: 'https://mcp.sentry.dev/mcp', env: [] })).toBe('Connects to mcp.sentry.dev.');
  });

  it('shows <transport> · <package or url>, never tool names', () => {
    expect(mcpMeta({ name: 'pg', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres $DATABASE_URL', url: null, env: [] })).toBe(
      'stdio · @modelcontextprotocol/server-postgres',
    );
    expect(item('devdigest-backend/mcp/postgres').invocation).toBeNull();
  });
});

describe('unpinned-dependency heuristic (§8)', () => {
  it('flags launched packages without an exact version', () => {
    expect(isUnpinned('npx -y @modelcontextprotocol/server-postgres $DATABASE_URL')).toBe(true);
    expect(isUnpinned('npx -y @modelcontextprotocol/server-postgres@0.6.2')).toBe(false);
    expect(isUnpinned('uvx mcp-server-time==1.2.0')).toBe(false);
    expect(isUnpinned('npx some-tool@latest')).toBe(true);
    expect(isUnpinned('${CLAUDE_PLUGIN_ROOT}/scripts/block-dangerous.sh')).toBe(false);
    expect(isUnpinned(null)).toBe(false);
  });
});

describe('invocations (§6, §15.5)', () => {
  it('skills and commands use /plugin:name; agents show only the name; hooks show <Event> · <matcher>', () => {
    expect(item('devdigest-release/skill/release-notes').invocation).toBe('/devdigest-release:release-notes');
    expect(item('devdigest-backend/agent/backend-reviewer').invocation).toBe('backend-reviewer');
    const hook = item('devdigest-security/hook/block-dangerous');
    expect(hook.invocation).toBeNull();
    expect(hook.meta).toBe('PreToolUse · Bash');
  });
});

describe('security flags (§8)', () => {
  it('derives flags from config', () => {
    expect(securityFlags(findPlugin('devdigest-backend')!)).toEqual(['runs-hooks', 'starts-mcp', 'shell-tools', 'unpinned-dependency']);
    expect(securityFlags(findPlugin('devdigest-observability')!)).toEqual(['remote-mcp']);
    expect(securityFlags(findPlugin('devdigest-docs')!)).toEqual([]);
  });

  it('still has 30 artifacts across 7 plugins', () => {
    expect(items.length).toBe(30);
  });
});
