import { catalog } from '../data/catalog';
import { installCommand, marketplaceAddCommand } from './catalog';

/** For a terminal: the `claude` CLI. */
export function shellCommands(names: string[]): string {
  return [
    `claude plugin marketplace add ${catalog.repo}`,
    ...names.map((n) => `claude plugin install ${n}@${catalog.marketplace}`),
  ].join('\n');
}

/** For inside a Claude Code session: slash commands. */
export function sessionCommands(names: string[]): string {
  return [marketplaceAddCommand(), ...names.map(installCommand)].join('\n');
}

/** Project .claude/settings.json that registers the marketplace and enables the set. */
export function settingsJson(names: string[]): string {
  const mkt = catalog.marketplace;
  return JSON.stringify(
    {
      extraKnownMarketplaces: { [mkt]: { source: { source: 'github', repo: catalog.repo } } },
      enabledPlugins: Object.fromEntries(names.map((n) => [`${n}@${mkt}`, true])),
    },
    null,
    2,
  );
}

/** Parse ?set=a,b keeping only known plugins, in catalog order. */
export function parseSet(param: string | null): string[] {
  if (!param) return [];
  const wanted = new Set(param.split(',').map((s) => s.trim()).filter(Boolean));
  return catalog.plugins.map((p) => p.name).filter((n) => wanted.has(n));
}

export const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((n, i) => n === b[i]);
