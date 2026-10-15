import { ShieldCheckIcon, XIcon } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { catalog } from '../data/catalog';
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
      <h1 className="page-title">What runs on your machine</h1>
      <p className="lede">
        Every hook and MCP server in the marketplace, read from the plugin manifests at build time.{' '}
        {inScope.length - quiet} of {inScope.length} plugins execute code; {quiet} have no hooks or MCP.
      </p>

      {scope && (
        <p style={{ margin: '0 0 14px' }}>
          <span className="filter-chip">
            Install set · {scope.length}
            <button type="button" aria-label="Show all plugins" onClick={() => update('set', null)}><XIcon size={12} aria-hidden /></button>
          </span>
        </p>
      )}

      <div className="sec-tools">
        <div className="badges" role="group" aria-label="Filter by flag">
          {[...FLAGS, 'none' as const].map((f) => (
            <button key={f} type="button" className={`pill${active.has(f) ? ' on' : ''}`} aria-pressed={active.has(f)} onClick={() => toggle(f)}>
              {f === 'none' ? <><ShieldCheckIcon aria-hidden />No hooks or MCP</> : FLAG_LABEL[f]} <span className="count">{count(f)}</span>
            </button>
          ))}
        </div>
        <label className="sort-select">
          Sort
          <select value={sort} onChange={(e) => update('sort', e.target.value === 'flags' ? 'flags' : null)}>
            <option value="name">Name</option>
            <option value="flags">Most flags</option>
          </select>
        </label>
      </div>

      <div className="sec-table" role="table" aria-label="Plugins and what they run">
        <div className="sec-row head" role="row">
          <span role="columnheader">Plugin</span>
          <span role="columnheader">Hooks</span>
          <span role="columnheader">MCP servers</span>
          <span role="columnheader">Env vars</span>
          <span role="columnheader">Bash</span>
          <span role="columnheader">Flags</span>
        </div>
        {shown.map(({ p, flags }) => {
          const env = envVars(p);
          const bash = p.tools.filter((t) => /^Bash\b/.test(t));
          const unpinned = unpinnedCount(p);
          return (
            <div className="sec-row" role="row" key={p.name}>
              <span role="cell"><Link className="plug" to={`/plugins/${p.name}/#runs`}>{p.name}</Link></span>
              <span role="cell" data-label="Hooks">{p.hooks.length ? `${p.hooks.length} · ${[...new Set(p.hooks.map((h) => h.event))].join(', ')}` : '—'}</span>
              <span role="cell" data-label="MCP">{p.mcp.length ? p.mcp.map((m) => `${m.name} (${m.transport})`).join(', ') : '—'}</span>
              <span role="cell" data-label="Env">{env.length ? <code>{env.join(', ')}</code> : '—'}</span>
              <span role="cell" data-label="Bash">{bash.length ? 'yes' : '—'}</span>
              <span role="cell" className="flags">
                {flags.length
                  ? flags.map((f) =>
                      HEURISTIC_FLAGS.includes(f) ? (
                        <a key={f} className="badge heur" href={securityDocUrl()}>{FLAG_LABEL[f]}{f === 'unpinned-dependency' && unpinned > 1 ? ` · ${unpinned}` : ''}</a>
                      ) : (
                        <span key={f} className="badge exec">{FLAG_LABEL[f]}</span>
                      ),
                    )
                  : <span className="muted">none</span>}
              </span>
            </div>
          );
        })}
        {!shown.length && <div className="sec-row" role="row"><span className="muted" role="cell">No plugin matches these filters.</span></div>}
      </div>
      <p className="hint" style={{ marginTop: 16 }}>
        Informational, not a safety rating. Heuristic flags can be wrong; see <a href={securityDocUrl()}>docs/SECURITY.md</a>.
      </p>
    </div>
  );
}
