import { catalog } from '../data/catalog';
import type { Artifact, Kind, Plugin } from '../data/types';

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

export interface Item extends Artifact {
  id: string;
  plugin: Plugin;
}

export const items: Item[] = catalog.plugins.flatMap((plugin) =>
  plugin.artifacts.map((a) => ({ ...a, id: `${plugin.name}/${a.kind}/${a.name}`, plugin })),
);

export const findPlugin = (name: string) => catalog.plugins.find((p) => p.name === name);

export const installCommand = (pluginName: string) => `/plugin install ${pluginName}@${catalog.marketplace}`;

export const marketplaceAddCommand = () => `/plugin marketplace add ${catalog.repo}`;

export const versionLabel = (p: Plugin) => (p.version ? `v${p.version}` : 'tracks main');

/** How the artifact is used from Claude Code. */
export function invocation(item: Item): string {
  const p = item.plugin.name;
  switch (item.kind) {
    case 'skill':
    case 'command':
      return `/${p}:${item.name}`;
    case 'agent':
      return `@agent-${p}:${item.name}`;
    case 'hook': {
      const hook = item.plugin.hooks[0];
      return hook ? hook.event : 'hook';
    }
    case 'mcp':
      return `mcp__${item.name}__*`;
  }
}

export const envVars = (p: Plugin) => [...new Set(p.mcp.flatMap((m) => m.env))];

export const executes = (p: Plugin) => p.hooks.length + p.mcp.length > 0;

/** Short "1 hook · 1 MCP" summary, empty when the plugin runs nothing. */
export function runsSummary(p: Plugin): string {
  const parts: string[] = [];
  if (p.hooks.length) parts.push(`${p.hooks.length} hook${p.hooks.length > 1 ? 's' : ''}`);
  if (p.mcp.length) parts.push(`${p.mcp.length} MCP`);
  return parts.join(' · ');
}

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
