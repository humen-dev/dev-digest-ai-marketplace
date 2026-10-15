import { KeyIcon, LightningIcon, PlugsIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { Fragment } from 'react';
import { Link, useSearchParams } from 'react-router';
import { catalog } from '../data/catalog';
import { envVars, executes } from '../lib/catalog';

type Filter = 'hooks' | 'mcp' | 'env' | 'none';

export function SecurityPage() {
  const [params, setParams] = useSearchParams();
  const active = new Set((params.get('has') ?? '').split(',').filter(Boolean) as Filter[]);
  const toggle = (f: Filter) => {
    const next = new Set(active);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    setParams(next.size ? { has: [...next].join(',') } : {});
  };

  const plugins = catalog.plugins;
  const counts = {
    hooks: plugins.filter((p) => p.hooks.length).length,
    mcp: plugins.filter((p) => p.mcp.length).length,
    env: plugins.filter((p) => envVars(p).length).length,
    none: plugins.filter((p) => !executes(p)).length,
  };

  const rows = plugins.flatMap((p) => [
    ...p.hooks.map((h) => ({ plugin: p.name, kind: 'hooks' as const, type: 'Hook', command: h.command, trigger: [h.event, h.matcher].filter(Boolean).join(' · ') })),
    ...p.mcp.map((m) => ({ plugin: p.name, kind: 'mcp' as const, type: 'MCP', command: m.command, trigger: m.env.length ? `env: ${m.env.join(', ')}` : m.transport })),
  ]);
  const shown = rows.filter((r) => {
    const kinds = [...active].filter((f) => f === 'hooks' || f === 'mcp');
    if (kinds.length && !kinds.includes(r.kind)) return false;
    if (active.has('env') && !envVars(catalog.plugins.find((p) => p.name === r.plugin)!).length) return false;
    return true;
  });
  const quiet = plugins.filter((p) => !executes(p));

  const pills: [Filter, string, typeof LightningIcon][] = [
    ['hooks', `has:hooks · ${counts.hooks}`, LightningIcon],
    ['mcp', `has:mcp · ${counts.mcp}`, PlugsIcon],
    ['env', `has:env · ${counts.env}`, KeyIcon],
    ['none', `No hooks or MCP · ${counts.none}`, ShieldCheckIcon],
  ];

  return (
    <div className="page wrap">
      <h1 className="page-title">What runs on your machine</h1>
      <p className="lede">
        Every hook command and MCP server in the marketplace, read from the plugin manifests at build time.{' '}
        {plugins.length - counts.none} of {plugins.length} plugins execute code; {counts.none} run nothing (no hooks or MCP).
      </p>
      <div className="badges" style={{ marginBottom: 18 }} role="group" aria-label="Filter">
        {pills.map(([f, label, I]) => (
          <button key={f} type="button" className={`pill${active.has(f) ? ' on' : ''}`} aria-pressed={active.has(f)} onClick={() => toggle(f)}>
            <I aria-hidden />{label}
          </button>
        ))}
      </div>

      {active.has('none') && active.size === 1 ? (
        <div className="sec-table">
          <div className="sec-row head"><span>Plugin</span><span>Type</span><span>Description</span><span /></div>
          {quiet.map((p) => (
            <div className="sec-row" key={p.name}>
              <Link className="plug" to={`/plugins/${p.name}/`}>{p.name}</Link>
              <span className="type"><ShieldCheckIcon aria-hidden />Prompts</span>
              <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{p.description}</span>
              <span />
            </div>
          ))}
        </div>
      ) : (
        <div className="sec-table">
          <div className="sec-row head"><span>Plugin</span><span>Type</span><span>Command</span><span>Trigger / env</span></div>
          {shown.map((r, i) => (
            <Fragment key={r.plugin + r.command}>
              <div className="sec-row">
                <span className="plug">{i && shown[i - 1].plugin === r.plugin ? '' : <Link to={`/plugins/${r.plugin}/`}>{r.plugin}</Link>}</span>
                <span className="type">{r.kind === 'hooks' ? <LightningIcon aria-hidden /> : <PlugsIcon aria-hidden />}{r.type}</span>
                <code>{r.command}</code>
                <span className="trig">{r.trigger}</span>
              </div>
            </Fragment>
          ))}
          {!shown.length && <div className="sec-row"><span className="muted">Nothing matches these filters.</span></div>}
        </div>
      )}
      <p className="hint" style={{ marginTop: 16 }}>
        Informational, not a safety rating. See <a href={`https://github.com/${catalog.repo}/blob/main/docs/SECURITY.md`}>docs/SECURITY.md</a>.
      </p>
    </div>
  );
}
