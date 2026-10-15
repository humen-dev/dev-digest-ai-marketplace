import { catalog } from '../data/catalog';
import type { Hook, Kind, McpServer, Plugin } from '../data/types';

export const KIND_LABEL: Record<Kind, string> = {
  skill: 'Skill',
  agent: 'Agent',
  command: 'Command',
  hook: 'Hook',
  mcp: 'MCP server',
};

export const KIND_PLURAL: Record<Kind, string> = {
  skill: 'Skills',
  agent: 'Agents',
  command: 'Commands',
  hook: 'Hooks',
  mcp: 'MCP',
};

export const KINDS: Kind[] = ['skill', 'agent', 'command', 'hook', 'mcp'];

/* ---------- Hooks and MCP servers (§6.1, §8, §8.1) ---------- */

/** Script basename when the hook runs ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.<ext>, else <Event>[:<matcher>]. */
export function hookName(h: Hook): string {
  const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+?)(?:\.\w+)?(?:\s|$)/.exec(h.command);
  if (m) return m[1];
  return h.matcher ? `${h.event}:${h.matcher}` : h.event;
}

export function hookSummary(h: Hook): string {
  switch (h.event) {
    case 'PreToolUse':
      return h.matcher ? `Runs before Claude uses ${h.matcher}. Can block the call.` : 'Runs before every tool call. Can block the call.';
    case 'PostToolUse':
      if (!h.matcher || h.matcher === 'Edit|Write') return 'Runs after every file Claude edits or writes.';
      return `Runs after Claude uses ${h.matcher}.`;
    case 'SessionStart':
      return 'Runs when a session starts.';
    case 'UserPromptSubmit':
      return 'Runs on every prompt you send.';
    case 'Stop':
      return 'Runs when Claude finishes a response.';
    default:
      return `Runs on ${h.event}.`;
  }
}

const LAUNCHERS = /^(npx|uvx|bunx)$/;

/** The package a launcher (npx/uvx/bunx) runs, if any. */
export function launchedPackage(command: string | null): { launcher: string; pkg: string } | null {
  if (!command) return null;
  const parts = command.trim().split(/\s+/);
  const i = parts.findIndex((p) => LAUNCHERS.test(p));
  if (i < 0) return null;
  const pkg = parts.slice(i + 1).find((p) => !p.startsWith('-'));
  return pkg ? { launcher: parts[i], pkg } : null;
}

/** Heuristic (§8 `unpinned-dependency`): a launched package without an exact version, or @latest. */
export function isUnpinned(command: string | null): boolean {
  if (!command) return false;
  if (/@latest\b/.test(command)) return true;
  const l = launchedPackage(command);
  if (!l) return false;
  const { pkg } = l;
  const versioned = pkg.startsWith('@') ? pkg.indexOf('@', 1) > 0 : /[@=]=?\d/.test(pkg);
  return !versioned;
}

export function mcpSummary(m: McpServer): string {
  if (m.transport !== 'stdio') {
    try {
      return `Connects to ${new URL(m.url ?? '').host}.`;
    } catch {
      return 'Connects to a remote server.';
    }
  }
  const l = launchedPackage(m.command);
  if (l) return `Starts with Claude Code. Downloads the package from ${l.launcher === 'uvx' ? 'PyPI' : 'npm'} on first run.`;
  return `Starts ${m.command?.split(/\s+/)[0] ?? 'a command'} as a local process with Claude Code.`;
}

/** What the invocation column shows for an MCP server: <transport> · <package or url>. */
export function mcpMeta(m: McpServer): string {
  const target = m.transport === 'stdio' ? launchedPackage(m.command)?.pkg ?? m.command?.split(/\s+/)[0] ?? '' : m.url ?? '';
  return `${m.transport} · ${target}`;
}

export const hookMeta = (h: Hook) => (h.matcher ? `${h.event} · ${h.matcher}` : h.event);

export const envVars = (p: Plugin) => [...new Set(p.mcp.flatMap((m) => m.env))];

export const executes = (p: Plugin) => p.hooks.length + p.mcp.length > 0;

export type SecurityFlag = 'runs-hooks' | 'starts-mcp' | 'remote-mcp' | 'shell-tools' | 'network-heuristic' | 'unpinned-dependency';

export const FLAG_LABEL: Record<SecurityFlag, string> = {
  'runs-hooks': 'Runs hooks',
  'starts-mcp': 'Starts MCP',
  'remote-mcp': 'Remote MCP',
  'shell-tools': 'Bash tools',
  'network-heuristic': 'Network · heuristic',
  'unpinned-dependency': 'Unpinned · heuristic',
};

export const HEURISTIC_FLAGS: SecurityFlag[] = ['network-heuristic', 'unpinned-dependency'];

export function securityFlags(p: Plugin): SecurityFlag[] {
  const flags: SecurityFlag[] = [];
  if (p.hooks.length) flags.push('runs-hooks');
  if (p.mcp.some((m) => m.transport === 'stdio')) flags.push('starts-mcp');
  if (p.mcp.some((m) => m.transport !== 'stdio')) flags.push('remote-mcp');
  if (p.tools.some((t) => /^Bash\b/.test(t))) flags.push('shell-tools');
  if (p.hooks.some((h) => /\b(curl|wget)\b|fetch\(|https?:\/\//.test(h.command))) flags.push('network-heuristic');
  if ([...p.hooks.map((h) => h.command), ...p.mcp.map((m) => m.command)].some(isUnpinned)) flags.push('unpinned-dependency');
  return flags;
}

export const unpinnedCount = (p: Plugin) => [...p.hooks.map((h) => h.command), ...p.mcp.map((m) => m.command)].filter(isUnpinned).length;

/** Short "1 hook · 1 MCP" summary, empty when the plugin runs nothing. */
export function runsSummary(p: Plugin): string {
  const parts: string[] = [];
  if (p.hooks.length) parts.push(`${p.hooks.length} hook${p.hooks.length > 1 ? 's' : ''}`);
  if (p.mcp.length) parts.push(`${p.mcp.length} MCP`);
  return parts.join(' · ');
}

/* ---------- Catalog items (§6) ---------- */

export interface Item {
  id: string;
  kind: Kind;
  name: string;
  description: string;
  keywords: string;
  plugin: Plugin;
  /** Copyable invocation: /plugin:name for skills and commands, the agent name for agents; null for hooks and MCP. */
  invocation: string | null;
  /** What the invocation column shows when there is none: <Event> · <matcher> or <transport> · <package>. */
  meta: string | null;
}

function pluginItems(p: Plugin): Item[] {
  const id = (kind: Kind, name: string) => `${p.name}/${kind}/${name}`;
  return [
    ...p.artifacts.map((a) => ({
      ...a,
      id: id(a.kind, a.name),
      plugin: p,
      // Agent mention syntax is unverified (§15.5): show only the agent name.
      invocation: a.kind === 'agent' ? a.name : `/${p.name}:${a.name}`,
      meta: null,
    })),
    ...p.hooks.map((h) => {
      const name = hookName(h);
      return { kind: 'hook' as const, name, description: hookSummary(h), keywords: `hook ${h.event} ${h.matcher ?? ''} ${h.command}`, id: id('hook', name), plugin: p, invocation: null, meta: hookMeta(h) };
    }),
    ...p.mcp.map((m) => ({
      kind: 'mcp' as const,
      name: m.name,
      description: mcpSummary(m),
      keywords: `mcp server ${m.command ?? ''} ${m.url ?? ''}`,
      id: id('mcp', m.name),
      plugin: p,
      invocation: null,
      meta: mcpMeta(m),
    })),
  ];
}

export const items: Item[] = catalog.plugins.flatMap(pluginItems);

export const findPlugin = (name: string) => catalog.plugins.find((p) => p.name === name);

export const installCommand = (pluginName: string) => `/plugin install ${pluginName}@${catalog.marketplace}`;

export const marketplaceAddCommand = () => `/plugin marketplace add ${catalog.repo}`;

export const versionLabel = (p: Plugin) => (p.version ? `v${p.version}` : 'tracks main');

export const lastUpdated = () => catalog.plugins.map((p) => p.updated).sort().at(-1) ?? '';

export function formatDate(iso: string, withYear = false): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' });
}

export function requestSkillUrl(query: string): string {
  const q = query.trim();
  const params = new URLSearchParams({ template: 'skill-request.yml', title: `Skill request: ${q}`, need: q });
  return `https://github.com/${catalog.repo}/issues/new?${params}`;
}

export const sourceUrl = (p: Plugin) => `https://github.com/${catalog.repo}/tree/main/plugins/${p.name}`;

export const securityDocUrl = () => `https://github.com/${catalog.repo}/blob/main/docs/SECURITY.md`;
