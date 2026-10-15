import { ArrowUpRightIcon, CaretDownIcon, CaretUpIcon, CheckIcon, EyeSlashIcon, MagnifyingGlassIcon, MagnifyingGlassMinusIcon, PlugsIcon, SquaresFourIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CopyButton, Highlight, KindIcon, SetToggle } from '../components/ui';
import { catalog } from '../data/catalog';
import type { Kind } from '../data/types';
import { t } from '../i18n/en';
import {
  KIND_LABEL,
  KIND_PLURAL,
  KINDS,
  formatDate,
  installCommand,
  items,
  lastUpdated,
  requestSkillUrl,
  runsSummary,
  versionLabel,
  type Item,
} from '../lib/catalog';
import { search, type KindChoice, type SortKey } from '../lib/search';

const EXAMPLES = t.home.examples;
const SORTS = Object.entries(t.home.sorts) as [SortKey, string][];

function readKind(v: string | null): KindChoice {
  if (v === 'all') return 'all';
  return (KINDS as string[]).includes(v ?? '') ? (v as Kind) : null;
}

/** Invocation with its own copy icon, or the <Event> · <matcher> / <transport> · <package> line (§7.5, §6.1). */
function Invocation({ item }: { item: Item }) {
  if (!item.invocation) return <span className="invoke meta">{item.meta}</span>;
  return (
    <span className="invoke">
      <code>{item.invocation}</code>
      <CopyButton text={item.invocation} label={t.home.copyInvocation(item.invocation)} className="icon-btn xs" iconOnly />
    </span>
  );
}

// §7.5: the whole card links to the plugin page; the buttons inside do not navigate.
function ArtifactCard({ item, terms }: { item: Item; terms: string[] }) {
  const p = item.plugin;
  const runs = runsSummary(p);
  return (
    <article className="card">
      <div className="card-top">
        <span className="badge kind"><KindIcon kind={item.kind} />{KIND_LABEL[item.kind]}</span>
        <span className="in">{t.home.in} <span className="plug">{p.name}</span></span>
        <span className="ver">{versionLabel(p)}</span>
      </div>
      <div>
        <h3><Link className="card-link" to={`/plugins/${p.name}/`}><Highlight text={item.name} terms={terms} /></Link></h3>
        <p><Highlight text={item.description} terms={terms} /></p>
      </div>
      <Invocation item={item} />
      {runs && <span className="badge exec" style={{ alignSelf: 'flex-start' }}><PlugsIcon aria-hidden />{t.home.pluginRuns(runs)}</span>}
      <div className="card-actions">
        <CopyButton text={installCommand(p.name)} label={t.home.copyInstall} className="btn primary" title={installCommand(p.name)} />
        <SetToggle plugin={p.name} />
      </div>
    </article>
  );
}

function RelatedRow({ item, terms }: { item: Item; terms: string[] }) {
  const p = item.plugin;
  return (
    <div className="row">
      <span className="ic"><KindIcon kind={item.kind} size={16} /></span>
      <Link className="name" to={`/plugins/${p.name}/`}><Highlight text={item.name} terms={terms} /></Link>
      <span className="desc"><Highlight text={item.description} terms={terms} /></span>
      <span className="meta">{item.invocation ?? item.meta} · {p.name}</span>
      <CopyButton text={installCommand(p.name)} label={t.home.copyInstall} className="btn sm" title={installCommand(p.name)} />
    </div>
  );
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (s: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const label = SORTS.find(([k]) => k === value)?.[1];
  return (
    <div className="sort" ref={ref}>
      <button type="button" className="sort-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t.home.sortPrefix} <b>{label}</b>
        {open ? <CaretUpIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
      </button>
      {open && (
        <div className="menu" role="menu">
          {SORTS.map(([k, l]) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={k === value} onClick={() => { onChange(k); setOpen(false); }}>
              <span className="tick">{k === value && <CheckIcon aria-hidden />}</span>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Home() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const choice = readKind(params.get('type'));
  const sort = (SORTS.some(([k]) => k === params.get('sort')) ? params.get('sort') : 'relevance') as SortKey;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(query);

  // Keep the box in sync when the URL changes (back/forward, header search).
  useEffect(() => {
    setDraft(query);
  }, [query]);

  // Debounced URL update; the URL is the source of truth for the results.
  useEffect(() => {
    if (draft === query) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set('q', draft);
      else next.delete('q');
      next.delete('type');
      setParams(next, { replace: true });
    }, 100);
    return () => clearTimeout(t);
  }, [draft, query, params, setParams]);

  // "/" focuses the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const result = useMemo(() => search(items, query, choice, sort), [query, choice, sort]);
  const { best, related, hidden, kind, autoKind, kindCounts, parsed } = result;
  const terms = parsed.terms;
  const hasQuery = query.trim().length > 0;
  const total = best.length + related.length;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next);
  };
  const runExample = (ex: string) => {
    const next = draft.trim() ? `${draft.trim()} ${ex}` : ex;
    setDraft(next);
    inputRef.current?.focus();
  };

  const intentWord = parsed.intentKind ? query.split(/\s+/).find((w) => /^(skills?|agents?|commands?|hooks?|mcp|скіл\S*|агент\S*|команд\S*|хук\S*)$/i.test(w)) : null;

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-inner">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {t.home.stats(catalog.plugins.length, items.length, formatDate(lastUpdated()))}
            </div>
            <h1>{t.home.title}</h1>
            <p>{t.home.lede}</p>
            <form className="search-box" role="search" onSubmit={(e) => e.preventDefault()}>
              <MagnifyingGlassIcon size={19} aria-hidden />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.home.searchPlaceholder}
                aria-label={t.home.searchLabel}
                autoFocus
              />
              {draft ? (
                <button type="button" className="icon-btn" onClick={() => setDraft('')} aria-label={t.home.clearSearch}><XIcon aria-hidden /></button>
              ) : (
                <span className="kbd" aria-hidden>/</span>
              )}
            </form>
            <div className="refine">
              <span>{t.home.refine}</span>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="chip" onClick={() => runExample(ex)}>{ex}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="results wrap" aria-labelledby="results-title">
        <div className="results-head">
          <h2 id="results-title" aria-live="polite">
            {!hasQuery ? t.home.allArtifacts : best.length ? t.home.matches(best.length) : total || hidden.length ? t.home.noAllWords : t.home.noMatches}
          </h2>
          {kind && (
            <span className="filter-chip">
              <KindIcon kind={kind} />
              {KIND_PLURAL[kind]}
              {autoKind && <span className="auto">{t.home.auto}</span>}
              <button type="button" aria-label={t.home.removeFilter(KIND_PLURAL[kind])} onClick={() => setParam('type', 'all')}><XIcon size={12} aria-hidden /></button>
            </span>
          )}
          {kind && autoKind && (
            <span className="muted" style={{ fontSize: 13 }}>
              {t.home.autoFrom(intentWord ?? kind)}<button type="button" className="link-btn" onClick={() => setParam('type', 'all')}>{t.home.showAllTypesLower}</button>
            </span>
          )}
          {(hasQuery || kind) && <SortMenu value={sort} onChange={(s) => setParam('sort', s === 'relevance' ? null : s)} />}
        </div>

        {!kind && total > 0 && (
          <div className="kind-tabs" role="group" aria-label={t.home.filterByKind}>
            <button type="button" className="pill on"><SquaresFourIcon aria-hidden />{t.home.all} <span className="count">{total}</span></button>
            {KINDS.filter((k) => kindCounts[k]).map((k) => (
              <button key={k} type="button" className="pill" onClick={() => setParam('type', k)}>
                <KindIcon kind={k} />{KIND_PLURAL[k]} <span className="count">{kindCounts[k]}</span>
              </button>
            ))}
          </div>
        )}

        {!catalog.plugins.length ? (
          <div className="empty">
            <h3>{t.home.emptyTitle}</h3>
            <p>{t.home.emptyText}</p>
            <a className="btn primary lg" href={`https://github.com/${catalog.repo}/blob/main/CONTRIBUTING.md`}>{t.home.contributingGuide}</a>{' '}
            <a className="btn lg" href={requestSkillUrl(query)}>{t.home.requestSkill}</a>
          </div>
        ) : total > 0 || hidden.length > 0 ? (
          <>
            <div className="grid">
              {best.map((it) => <ArtifactCard key={it.id} item={it} terms={terms} />)}
              {hidden[0] && kind && (
                <div className="hidden-card">
                  <span className="why"><EyeSlashIcon aria-hidden />{t.home.hiddenBy(KIND_PLURAL[kind], hidden.length)}</span>
                  <span className="kind"><KindIcon kind={hidden[0].kind} />{KIND_LABEL[hidden[0].kind]}</span>
                  <code>{hidden[0].invocation ?? hidden[0].meta}</code>
                  <span className="desc">{hidden[0].description}</span>
                  <button type="button" className="link-btn" onClick={() => setParam('type', 'all')}>{t.home.showAllTypes}</button>
                </div>
              )}
            </div>
            {related.length > 0 && (
              <>
                <div className="section-title">
                  <h3>{t.home.related}</h3>
                  <span>{t.home.relatedHelp}</span>
                </div>
                <div className="rows">
                  {related.map((it) => <RelatedRow key={it.id} item={it} terms={terms} />)}
                </div>
              </>
            )}
            {hasQuery && (
              <div className="foot-note">
                {t.home.notWhatYouNeed} <a href={requestSkillUrl(query)}>{t.home.requestSkill}</a>{t.home.prefilled}
              </div>
            )}
          </>
        ) : (
          <div className="empty">
            <MagnifyingGlassMinusIcon size={24} className="muted" aria-hidden />
            <h3>{t.home.nothingCovers(query.trim())}</h3>
            <p>{t.home.nothingText}</p>
            <a className="btn primary lg" href={requestSkillUrl(query)}>{t.home.requestSkill}<ArrowUpRightIcon aria-hidden /></a>
          </div>
        )}
      </section>
    </>
  );
}
