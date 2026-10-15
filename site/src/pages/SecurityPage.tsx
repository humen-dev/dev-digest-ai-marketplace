import { ShieldCheckIcon, XIcon } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { catalog } from '../data/catalog';
import { t } from '../i18n/en';
import { FLAG_LABEL, HEURISTIC_FLAGS, envVars, executes, securityDocUrl, securityFlags, unpinnedCount, type SecurityFlag } from '../lib/catalog';
import { parseSet } from '../lib/install';

const FLAGS = Object.keys(FLAG_LABEL) as SecurityFlag[];
type Filter = SecurityFlag | 'none';

// §9.4a: one row per plugin, filterable and sortable by flag, scoped by ?set=.
export function SecurityPage() {
  const [params, setParams] = useSearchParams();
  const active = new Set((params.get('flag') ?? '').split(',').filter(Boolean) as Filter[]);
  const scope = params.has('set') ? parseSet(params.get('set')) : null;
  const sort = params.get('sort') === 'flags' ? 'flags' : 'name';

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const toggle = (f: Filter) => {
    const next = new Set(active);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    update('flag', [...next].join(',') || null);
  };

  const inScope = catalog.plugins.filter((p) => !scope || scope.includes(p.name));
  const rows = inScope.map((p) => ({ p, flags: securityFlags(p) }));
  const count = (f: Filter) => rows.filter((r) => (f === 'none' ? !executes(r.p) : r.flags.includes(f))).length;
  const shown = rows
    .filter((r) => [...active].every((f) => (f === 'none' ? !executes(r.p) : r.flags.includes(f))))
    .sort((a, b) => (sort === 'flags' ? b.flags.length - a.flags.length : 0) || a.p.name.localeCompare(b.p.name));
  const quiet = count('none');

  return (
    <div className="page wrap">
      <h1 className="page-title">{t.security.title}</h1>
      <p className="lede">
        {t.security.lede}{' '}
        {t.security.execCount(inScope.length - quiet, inScope.length, quiet)}
      </p>

      {scope && (
        <p style={{ margin: '0 0 14px' }}>
          <span className="filter-chip">
            {t.security.scope(scope.length)}
            <button type="button" aria-label={t.security.showAll} onClick={() => update('set', null)}><XIcon size={12} aria-hidden /></button>
          </span>
        </p>
      )}

      <div className="sec-tools">
        <div className="badges" role="group" aria-label={t.security.filterByFlag}>
          {[...FLAGS, 'none' as const].map((f) => (
            <button key={f} type="button" className={`pill${active.has(f) ? ' on' : ''}`} aria-pressed={active.has(f)} onClick={() => toggle(f)}>
              {f === 'none' ? <><ShieldCheckIcon aria-hidden />{t.security.noHooksOrMcp}</> : FLAG_LABEL[f]} <span className="count">{count(f)}</span>
            </button>
          ))}
        </div>
        <label className="sort-select">
          {t.security.sort}
          <select value={sort} onChange={(e) => update('sort', e.target.value === 'flags' ? 'flags' : null)}>
            <option value="name">{t.security.sortName}</option>
            <option value="flags">{t.security.sortFlags}</option>
          </select>
        </label>
      </div>

      <div className="sec-table" role="table" aria-label={t.security.tableLabel}>
        <div className="sec-row head" role="row">
          <span role="columnheader">{t.security.columns.plugin}</span>
          <span role="columnheader">{t.security.columns.hooks}</span>
          <span role="columnheader">{t.security.columns.mcp}</span>
          <span role="columnheader">{t.security.columns.env}</span>
          <span role="columnheader">{t.security.columns.bash}</span>
          <span role="columnheader">{t.security.columns.flags}</span>
        </div>
        {shown.map(({ p, flags }) => {
          const env = envVars(p);
          const bash = p.tools.filter((t) => /^Bash\b/.test(t));
          const unpinned = unpinnedCount(p);
          return (
            <div className="sec-row" role="row" key={p.name}>
              <span role="cell"><Link className="plug" to={`/plugins/${p.name}/#runs`}>{p.name}</Link></span>
              <span role="cell" data-label={t.security.cellLabels.hooks}>{p.hooks.length ? `${p.hooks.length} · ${[...new Set(p.hooks.map((h) => h.event))].join(', ')}` : t.empty}</span>
              <span role="cell" data-label={t.security.cellLabels.mcp}>{p.mcp.length ? p.mcp.map((m) => `${m.name} (${m.transport})`).join(', ') : t.empty}</span>
              <span role="cell" data-label={t.security.cellLabels.env}>{env.length ? <code>{env.join(', ')}</code> : t.empty}</span>
              <span role="cell" data-label={t.security.cellLabels.bash}>{bash.length ? t.security.yes : t.empty}</span>
              <span role="cell" className="flags">
                {flags.length
                  ? flags.map((f) =>
                      HEURISTIC_FLAGS.includes(f) ? (
                        <a key={f} className="badge heur" href={securityDocUrl()}>{FLAG_LABEL[f]}{f === 'unpinned-dependency' && unpinned > 1 ? ` · ${unpinned}` : ''}</a>
                      ) : (
                        <span key={f} className="badge exec">{FLAG_LABEL[f]}</span>
                      ),
                    )
                  : <span className="muted">{t.security.none}</span>}
              </span>
            </div>
          );
        })}
        {!shown.length && <div className="sec-row" role="row"><span className="muted" role="cell">{t.security.noMatch}</span></div>}
      </div>
      <p className="hint" style={{ marginTop: 16 }}>
        {t.security.disclaimer} <a href={securityDocUrl()}>{t.security.securityDoc}</a>.
      </p>
    </div>
  );
}
