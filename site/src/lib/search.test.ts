import { describe, expect, it } from 'vitest';
import { items } from './catalog';
import { highlight, parseQuery, search } from './search';

const names = (list: { name: string; kind: string }[]) => list.map((i) => `${i.kind}:${i.name}`);

describe('parseQuery', () => {
  it('drops filler words and detects kind intent', () => {
    const q = parseQuery('I need a skill for writing release notes');
    expect(q.intentKind).toBe('skill');
    expect(q.terms).toEqual(['writing', 'release', 'notes']);
  });

  it('reads type:, has: and plugin: filters', () => {
    const q = parseQuery('migration type:skill -has:hooks has:mcp plugin:devdigest-backend');
    expect(q.terms).toEqual(['migration']);
    expect(q.types).toEqual(['skill']);
    expect(q.has).toEqual([{ flag: 'hooks', negate: true }, { flag: 'mcp', negate: false }]);
    expect(q.plugin).toBe('devdigest-backend');
  });

  it('understands Ukrainian kind words and stop words', () => {
    const q = parseQuery('мені треба скіл для релізу');
    expect(q.intentKind).toBe('skill');
    expect(q.terms).toEqual(['релізу']);
  });
});

describe('search', () => {
  it('ranks release-notes first for the spec example query', () => {
    const r = search(items, 'I need a skill for release notes');
    expect(r.best[0].name).toBe('release-notes');
    expect(r.kind).toBe('skill');
    expect(r.autoKind).toBe(true);
  });

  it('§14.8: the main grid has only skills matching all terms; weaker matches go to Related', () => {
    const r = search(items, 'I need a skill for release notes');
    expect(names(r.best)).toEqual(['skill:release-notes', 'skill:changelog-keeper']);
    expect(r.best.every((i) => i.kind === 'skill')).toBe(true);
    expect(names(r.hidden)).toEqual(['command:release-notes']);
    expect(r.related.every((i) => i.kind === 'skill')).toBe(true);
  });

  it('keeps items missing a term out of the main grid', () => {
    const r = search(items, 'skill for writing release notes');
    expect(r.best).toEqual([]);
    expect(names(r.related)).toEqual(expect.arrayContaining(['skill:release-notes', 'skill:readme-polish', 'skill:adr-writer']));
  });

  it('shows Related only when there are fewer than 3 AND matches', () => {
    const r = search(items, 'review', 'all');
    expect(r.best.length).toBeGreaterThanOrEqual(3);
    expect(r.related).toEqual([]);
  });

  it('finds the release skill from a Ukrainian query', () => {
    const r = search(items, 'мені треба скіл для релізу');
    expect(names(r.best).slice(0, 3)).toContain('skill:release-notes');
  });

  it('type:hook returns only hooks', () => {
    const r = search(items, 'type:hook');
    expect(r.best.length).toBeGreaterThan(0);
    expect(r.best.every((i) => i.kind === 'hook')).toBe(true);
  });

  it('-has:hooks excludes every plugin with hooks', () => {
    const r = search(items, '-has:hooks');
    expect(r.best.every((i) => i.plugin.hooks.length === 0)).toBe(true);
  });

  it('an explicit "all" choice turns off the kind intent', () => {
    const r = search(items, 'skill for release notes', 'all');
    expect(r.kind).toBeNull();
    expect(names(r.best)).toContain('command:release-notes');
  });

  it('drops the soft kind filter when it would hide everything', () => {
    const r = search(items, 'agent for release notes');
    expect(r.kind).toBeNull();
    expect(r.best.length).toBeGreaterThan(0);
  });
});

describe('highlight', () => {
  it('marks words that share a stem with a term', () => {
    const parts = highlight('Draft release notes from merged PRs', ['release', 'notes']);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['release', 'notes']);
  });
});
