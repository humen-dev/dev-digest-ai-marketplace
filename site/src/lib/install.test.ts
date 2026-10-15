import { describe, expect, it } from 'vitest';
import { installCommand } from './catalog';
import { parseSet, settingsJson, shellCommands } from './install';

describe('install set', () => {
  it('keeps only known plugins, in catalog order', () => {
    expect(parseSet('devdigest-testing,nope,devdigest-backend')).toEqual(['devdigest-backend', 'devdigest-testing']);
    expect(parseSet(null)).toEqual([]);
  });

  it('install command matches the spec format', () => {
    expect(installCommand('devdigest-backend')).toBe('/plugin install devdigest-backend@dev-digest-ai-marketplace');
  });

  it('shell commands add the marketplace first', () => {
    expect(shellCommands(['devdigest-backend']).split('\n')).toEqual([
      '/plugin marketplace add humen-dev/dev-digest-ai-marketplace',
      '/plugin install devdigest-backend@dev-digest-ai-marketplace',
    ]);
  });

  it('settings.json registers the marketplace and enables the set', () => {
    expect(JSON.parse(settingsJson(['devdigest-backend']))).toEqual({
      extraKnownMarketplaces: {
        'dev-digest-ai-marketplace': { source: { source: 'github', repo: 'humen-dev/dev-digest-ai-marketplace' } },
      },
      enabledPlugins: { 'devdigest-backend@dev-digest-ai-marketplace': true },
    });
  });
});
