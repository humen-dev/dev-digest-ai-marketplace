import type { Kind } from '../data/types';
import type { Item } from './catalog';
import { envVars } from './catalog';

export type HasFlag = 'hooks' | 'mcp' | 'env';
export type SortKey = 'relevance' | 'name' | 'updated';
/** null = let the query decide (kind intent), 'all' = user cleared the filter. */
export type KindChoice = Kind | 'all' | null;

export interface ParsedQuery {
  terms: string[];
  intentKind: Kind | null;
  types: Kind[];
  has: { flag: HasFlag; negate: boolean }[];
  plugin: string | null;
}

const STOP = new Set(
  (
    'i,need,a,an,the,for,to,me,my,something,that,which,with,want,looking,help,some,of,and,in,on,can,how,do,is,it,find,get,show,all,any,' +
    'мені,треба,потрібен,потрібна,потрібно,для,і,й,та,в,у,на,щоб,який,яка,яке,якийсь,щось,з,по,хочу,шукаю,знайди'
  ).split(','),
);

const KIND_WORDS: Record<string, Kind> = {
  skill: 'skill', skills: 'skill', скіл: 'skill', скіли: 'skill', скілл: 'skill', навичка: 'skill', навички: 'skill',
  agent: 'agent', agents: 'agent', subagent: 'agent', subagents: 'agent', агент: 'agent', агента: 'agent', агенти: 'agent',
  command: 'command', commands: 'command', slash: 'command', команда: 'command', команди: 'command', команду: 'command',
  hook: 'hook', hooks: 'hook', хук: 'hook', хуки: 'hook',
  mcp: 'mcp', server: 'mcp', servers: 'mcp', сервер: 'mcp',
};
const PLUGIN_WORDS = new Set(['plugin', 'plugins', 'плагін', 'плагіни']);

const words = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const asKind = (v: string): Kind | null => {
  const k = KIND_WORDS[v.toLowerCase()];
  return k ?? null;
};

export function parseQuery(q: string): ParsedQuery {
  const types: Kind[] = [];
  const has: ParsedQuery['has'] = [];
  let plugin: string | null = null;
  const free: string[] = [];

  for (const raw of q.split(/\s+/).filter(Boolean)) {
    const m = /^(-?)(type|has|plugin):(.+)$/i.exec(raw);
    if (!m) {
      free.push(raw);
      continue;
    }
    const [, neg, key, val] = m;
    const v = val.toLowerCase();
    if (key.toLowerCase() === 'type') {
      const k = asKind(v);
      if (k) types.push(k);
    } else if (key.toLowerCase() === 'has') {
      if (v === 'hooks' || v === 'hook') has.push({ flag: 'hooks', negate: !!neg });
      else if (v === 'mcp') has.push({ flag: 'mcp', negate: !!neg });
      else if (v === 'env') has.push({ flag: 'env', negate: !!neg });
    } else {
      plugin = v;
    }
  }

  const toks = words(free.join(' '));
  const intents = toks.map((t) => KIND_WORDS[t]).filter((k): k is Kind => !!k);
  const terms = toks.filter((t) => !STOP.has(t) && !KIND_WORDS[t] && !PLUGIN_WORDS.has(t));
  return { terms, intentKind: intents[0] ?? null, types, has, plugin };
}

/** Prefix used for loose matching: "notes" matches "note", "release" matches "releases". */
export const stem = (t: string) => (t.length < 4 ? t : t.slice(0, Math.max(4, t.length - 3)));

const matches = (term: string, list: string[]) => {
  if (term.length < 4) return list.includes(term);
  const s = stem(term);
  return list.some((w) => w.startsWith(s));
};

interface Scored {
  item: Item;
  score: number;
  hits: number;
}

/** Generated skills, agents and commands also carry their body text and headings (§6, §7.1). */
type WithBody = Item & { headings?: string[]; body?: string };

interface Fields {
  name: string[];
  kw: string[];
  desc: string[];
  plug: string[];
  head: string[];
  body: string[];
}

// Bodies can be up to 8,000 characters: split each item once, not per keystroke.
const fieldCache = new WeakMap<Item, Fields>();

function fields(item: Item): Fields {
  let f = fieldCache.get(item);
  if (!f) {
    const { headings, body } = item as WithBody;
    f = {
      name: words(item.name),
      kw: words(item.keywords),
      desc: words(item.description),
      plug: words(item.plugin.name),
      head: words(headings?.join(' ') ?? ''),
      body: words(body ?? ''),
    };
    fieldCache.set(item, f);
  }
  return f;
}

function score(item: Item, terms: string[]): Scored {
  const { name, kw, desc, plug, head, body } = fields(item);
  let total = 0;
  let hits = 0;
  for (const t of terms) {
    let s = 0;
    if (matches(t, name)) s += 5;
    if (matches(t, kw)) s += 3;
    if (matches(t, desc)) s += 2;
    if (matches(t, plug)) s += 1;
    // Headings and body text rank below name, keywords and description.
    if (matches(t, head)) s += 1;
    if (matches(t, body)) s += 0.5;
    if (s) hits++;
    total += s;
  }
  return { item, score: total, hits };
}

function hasFlag(item: Item, flag: HasFlag): boolean {
  const p = item.plugin;
  if (flag === 'hooks') return p.hooks.length > 0;
  if (flag === 'mcp') return p.mcp.length > 0;
  return envVars(p).length > 0;
}

export interface SearchResult {
  parsed: ParsedQuery;
  /** Items that match every term (everything when there are no terms). */
  best: Item[];
  /** Items that match some terms; only filled when there are fewer than 3 best matches. */
  related: Item[];
  /** Best matches hidden by the kind filter. */
  hidden: Item[];
  /** The kind filter in effect, and whether it came from the query. */
  kind: Kind | null;
  autoKind: boolean;
  /** Counts of best+related per kind before the kind filter. */
  kindCounts: Record<Kind, number>;
}

export function search(all: Item[], query: string, choice: KindChoice = null, sort: SortKey = 'relevance'): SearchResult {
  const parsed = parseQuery(query);
  const { terms } = parsed;

  const pool = all.filter(
    (it) =>
      parsed.has.every(({ flag, negate }) => hasFlag(it, flag) !== negate) &&
      (!parsed.plugin || it.plugin.name === parsed.plugin) &&
      (!parsed.types.length || parsed.types.includes(it.kind)),
  );

  let scored = pool.map((it) => score(it, terms));
  if (terms.length) scored = scored.filter((s) => s.hits > 0);

  // §7.2/§7.4: AND results form the main grid. When there are fewer than
  // three, OR results are added in a separate "Related" section.
  const bestAll = terms.length ? scored.filter((s) => s.hits === terms.length) : scored;
  const relatedAll = terms.length && bestAll.length < 3 ? scored.filter((s) => s.hits < terms.length) : [];

  const kindCounts = { skill: 0, agent: 0, command: 0, hook: 0, mcp: 0 } as Record<Kind, number>;
  for (const s of [...bestAll, ...relatedAll]) kindCounts[s.item.kind]++;

  let kind: Kind | null = null;
  let autoKind = false;
  if (choice && choice !== 'all') kind = choice;
  else if (choice === null && parsed.intentKind && !parsed.types.length) {
    kind = parsed.intentKind;
    autoKind = true;
    // Soft filter: never let the query's kind word hide every result.
    if (![...bestAll, ...relatedAll].some((s) => s.item.kind === kind)) {
      kind = null;
      autoKind = false;
    }
  }

  const order = (list: Scored[]) => {
    const out = [...list];
    if (sort === 'name') out.sort((a, b) => a.item.name.localeCompare(b.item.name));
    else if (sort === 'updated') out.sort((a, b) => b.item.plugin.updated.localeCompare(a.item.plugin.updated) || b.score - a.score);
    else out.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    return out.map((s) => s.item);
  };

  const keep = (s: Scored) => !kind || s.item.kind === kind;
  return {
    parsed,
    best: order(bestAll.filter(keep)),
    related: order(relatedAll.filter(keep)),
    hidden: order(bestAll.filter((s) => !keep(s))),
    kind,
    autoKind,
    kindCounts,
  };
}

export interface Part {
  text: string;
  hit: boolean;
}

/** Split text into parts, marking words that match a search term. */
export function highlight(text: string, terms: string[]): Part[] {
  const stems = terms.filter((t) => t.length >= 3).map((t) => stem(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!stems.length) return [{ text, hit: false }];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])((?:${stems.join('|')})[\\p{L}\\p{N}]*)`, 'giu');
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i), hit: false });
    parts.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}
