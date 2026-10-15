import { KeyIcon, LightningIcon, PlugsIcon, ShieldCheckIcon, ShieldWarningIcon, WrenchIcon, type Icon } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router';
import { CopyButton, InstallCmd, KindIcon, SetToggle, UnpinnedBadge } from '../components/ui';
import {
  KIND_LABEL,
  envVars,
  findPlugin,
  formatDate,
  hookMeta,
  hookName,
  hookSummary,
  installCommand,
  isUnpinned,
  items,
  marketplaceAddCommand,
  mcpSummary,
  sourceUrl,
  versionLabel,
} from '../lib/catalog';
import { NotFound } from './NotFound';

interface Run {
  key: string;
  icon: Icon;
  kind: string;
  meta: string;
  command: string;
  summary: string;
  note: string | undefined;
  unpinned: boolean;
}

export function PluginPage() {
  const { name = '' } = useParams();
  const plugin = findPlugin(name);
  if (!plugin) return <NotFound what={`plugin “${name}”`} />;

  const env = envVars(plugin);
  const contents = items.filter((it) => it.plugin === plugin);
  const notes = plugin.notes;
  // §8: every hook, MCP server, env var and requested tool, each with its templated summary (§8.1) and author note (§8.2).
  const runs: Run[] = [
    ...plugin.hooks.map((h) => {
      const n = hookName(h);
      return { key: `hook:${n}`, icon: LightningIcon, kind: 'Hook', meta: hookMeta(h), command: h.command, summary: hookSummary(h), note: notes[n], unpinned: isUnpinned(h.command) };
    }),
    ...plugin.mcp.map((m) => ({
      key: `mcp:${m.name}`,
      icon: PlugsIcon,
      kind: 'MCP server',
      meta: `${m.name} · ${m.transport}`,
      command: m.command ?? m.url ?? '',
      summary: mcpSummary(m),
      note: notes[m.name],
      unpinned: isUnpinned(m.command),
    })),
    ...env.map((v) => ({
      key: `env:${v}`,
      icon: KeyIcon,
      kind: 'Env var',
      meta: 'read by MCP server',
      command: v,
      summary: `Read by MCP server ${plugin.mcp.filter((m) => m.env.includes(v)).map((m) => m.name).join(', ')}.`,
      note: notes[v],
      unpinned: false,
    })),
    ...(plugin.tools.length
      ? [{ key: 'tools', icon: WrenchIcon, kind: 'Allowed tools', meta: 'pre-approved', command: plugin.tools.join('\n'), summary: 'Claude can run these without asking.', note: undefined, unpinned: false }]
      : []),
  ];
  const executes = plugin.hooks.length + plugin.mcp.length > 0;
  const cmd = installCommand(plugin.name);

  return (
    <div className="page wrap">
      <div className="plugin-grid">
        <div className="plugin-main">
          <div>
            <div className="crumbs"><Link to="/">Catalog</Link> / Plugins / {plugin.name}</div>
            <h1 className="plugin-name">{plugin.name}</h1>
            <p className="plugin-desc">{plugin.description}</p>
            <div className="badges">
              {plugin.hooks.length > 0 && <span className="badge exec"><LightningIcon aria-hidden />{plugin.hooks.length} hook{plugin.hooks.length > 1 ? 's' : ''}</span>}
              {plugin.mcp.length > 0 && <span className="badge exec"><PlugsIcon aria-hidden />{plugin.mcp.length} MCP server{plugin.mcp.length > 1 ? 's' : ''}</span>}
              {env.map((v) => <span key={v} className="badge exec"><KeyIcon aria-hidden />Needs {v}</span>)}
              {!executes && <span className="badge exec"><ShieldCheckIcon aria-hidden />No hooks or MCP</span>}
            </div>
          </div>

          <section id="runs" className={`runs${executes ? '' : ' none'}`} aria-labelledby="runs-title">
            <div className="runs-head">
              {executes ? <ShieldWarningIcon size={20} aria-hidden /> : <ShieldCheckIcon size={20} aria-hidden />}
              <h3 id="runs-title">What this runs on your machine</h3>
              <span>Parsed from hooks.json and .mcp.json at build</span>
            </div>
            <div className="runs-body">
              {runs.length ? (
                runs.map((r) => (
                  <div className="run" key={r.key}>
                    <div>
                      <span className="k"><r.icon aria-hidden />{r.kind}</span>
                      <span className="m">{r.meta}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <code>{r.command}</code>
                      <span className="note">{r.summary}</span>
                      {r.note && <span className="note author">{r.note}</span>}
                      {r.unpinned && <UnpinnedBadge />}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ margin: '14px 0 0' }}>No hooks, MCP servers or pre-approved tools. This plugin only adds instructions.</p>
              )}
            </div>
          </section>

          <section className="contents" aria-labelledby="contents-title">
            <h3 id="contents-title">Contents · {contents.length}</h3>
            {contents.map((it) => (
              <div className="content-row" key={it.id}>
                <span className="ic" title={KIND_LABEL[it.kind]}><KindIcon kind={it.kind} size={17} /></span>
                <span className="name">{it.name}</span>
                <span className="desc">{it.description}</span>
                <code>{it.invocation ?? it.meta}</code>
              </div>
            ))}
          </section>

          <section className="readme" aria-label="README">
            <div className="eyebrow">README.md</div>
            <h2>{plugin.readme.title}</h2>
            {plugin.readme.body.map((p) => <p key={p}>{p}</p>)}
          </section>
        </div>

        <aside className="aside">
          <div className="install-box">
            <div className="eyebrow">Install</div>
            <div className="cmd">
              <code><InstallCmd text={cmd} /></code>
              <CopyButton text={cmd} label="Copy install command" className="icon-btn" iconOnly />
            </div>
            <SetToggle plugin={plugin.name} size="lg" long />
            <span className="hint">First time? Run <code>{marketplaceAddCommand()}</code></span>
          </div>
          <dl className="facts">
            <dt>Version</dt><dd>{versionLabel(plugin)}</dd>
            <dt>Updated</dt><dd>{formatDate(plugin.updated, true)}</dd>
            <dt>Owners</dt><dd>{plugin.owners.length ? plugin.owners.join(', ') : '—'}</dd>
            <dt>License</dt><dd>{plugin.license ?? '—'}</dd>
            <dt>Source</dt><dd><a href={sourceUrl(plugin)}>plugins/{plugin.name}</a></dd>
          </dl>
          {plugin.changes.length > 0 && (
            <div className="changes">
              <div className="eyebrow">Recent changes</div>
              <ul>
                {plugin.changes.map((c) => <li key={c.version + c.text}><span className="muted">{c.version}</span> · {c.text}</li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
