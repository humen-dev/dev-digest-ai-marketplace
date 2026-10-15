import { DownloadSimpleIcon, LightningIcon, PackageIcon, PlugsIcon, ShieldWarningIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CopyButton } from '../components/ui';
import { t } from '../i18n/en';
import { envVars, findPlugin, items, unpinnedCount } from '../lib/catalog';
import { parseSet, sameSet, sessionCommands, settingsJson, shellCommands } from '../lib/install';
import { useAppState } from '../lib/state';

type Tab = 'shell' | 'session' | 'settings';

const TABS: { id: Tab; label: string; help: string; file: string; type: string }[] = [
  { id: 'shell', ...t.install.tabs.shell, file: 'install-plugins.sh', type: 'text/x-sh' },
  { id: 'session', ...t.install.tabs.session, file: 'plugin-commands.txt', type: 'text/plain' },
  { id: 'settings', ...t.install.tabs.settings, file: 'settings.json', type: 'application/json' },
];

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text.endsWith('\n') ? text : text + '\n'], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function InstallPage() {
  const { set: local, replaceSet } = useAppState();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('shell');

  // §9.4: when ?set= is present it is the source of truth for this page.
  const urlSet = params.has('set') ? parseSet(params.get('set')) : null;
  const view = urlSet ?? local;
  const synced = sameSet(view, local);
  const go = (names: string[]) => navigate({ search: `?set=${names.join(',')}` }, { replace: true });

  useEffect(() => {
    if (urlSet === null && local.length) go(local);
    // Nothing to lose when the local selection is empty: adopt the link's set.
    else if (urlSet && urlSet.length && !local.length) replaceSet(urlSet);
  }, [params]);

  const remove = (name: string) => {
    const next = view.filter((n) => n !== name);
    if (synced) replaceSet(next);
    go(next);
  };

  const plugins = view.map(findPlugin).filter((p) => !!p);

  if (!plugins.length) {
    return (
      <div className="page wrap">
        <h1 className="page-title">{t.install.title}</h1>
        <div className="empty">
          <PackageIcon size={24} className="muted" aria-hidden />
          <h3>{t.install.emptyTitle}</h3>
          <p>{t.install.emptyText}</p>
          <Link className="btn primary lg" to="/">{t.install.browse}</Link>
        </div>
      </div>
    );
  }

  const hooks = plugins.reduce((n, p) => n + p.hooks.length, 0);
  const mcp = plugins.reduce((n, p) => n + p.mcp.length, 0);
  const unpinned = plugins.reduce((n, p) => n + unpinnedCount(p), 0);
  const env = [...new Set(plugins.flatMap(envVars))];
  const shareUrl = `${location.origin}${import.meta.env.BASE_URL}install/?set=${view.join(',')}`;
  const outputs: Record<Tab, string> = { shell: shellCommands(view), session: sessionCommands(view), settings: settingsJson(view) };
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="page wrap">
      {!synced && (
        <div className="note-box confirm" role="alert" style={{ marginTop: 0, marginBottom: 24 }}>
          <PackageIcon size={18} aria-hidden />
          <span style={{ flex: 1 }}>
            {t.install.linkHas} <strong>{t.install.plugins(view.length)}</strong>{t.install.savedSet(local.length, local.join(', '))}
          </span>
          <button type="button" className="btn primary" onClick={() => replaceSet(view)}>{t.install.replaceSet}</button>
          <button type="button" className="btn" onClick={() => go(local)}>{t.install.keepSet}</button>
        </div>
      )}
      <div className="install-grid">
        <div>
          <h1 className="page-title">{t.install.title}</h1>
          <p className="lede">{t.install.lede}</p>
          {plugins.map((p) => {
            const count = items.filter((it) => it.plugin === p).length;
            return (
              <div className="set-row" key={p.name}>
                <div className="info">
                  <Link className="name" to={`/plugins/${p.name}/`}>{p.name}</Link>
                  <div className="sum">{t.install.artifactsSummary(count, p.description)}</div>
                </div>
                {p.hooks.length > 0 && <span className="ic-badge" title={t.install.hookTitle}><LightningIcon aria-label={t.install.runsHooks} /></span>}
                {p.mcp.length > 0 && <span className="ic-badge" title={t.install.mcpTitle}><PlugsIcon aria-label={t.install.startsMcp} /></span>}
                <button type="button" className="icon-btn" onClick={() => remove(p.name)} aria-label={t.install.remove(p.name)}><XIcon aria-hidden /></button>
              </div>
            );
          })}
          {hooks + mcp > 0 && (
            <div className="note-box">
              <ShieldWarningIcon size={18} aria-hidden />
              <span>
                {t.install.setRuns} <strong>{t.install.hooks(hooks)}</strong> {t.install.andStarts}{' '}
                <strong>{t.install.mcpServers(mcp)}</strong>.
                {env.length > 0 && <> {t.install.needs} <code className="code-inline">{env.join(', ')}</code>.</>}
                {unpinned > 0 && <> {t.install.unpinned(unpinned)}</>}{' '}
                <Link to={`/security/?set=${view.join(',')}`}>{t.install.review}</Link>
              </span>
            </div>
          )}
          <div style={{ marginTop: 18 }}>
            <CopyButton text={shareUrl} label={t.install.copyShareLink} className="btn" />
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="tabs" role="tablist" aria-label={t.install.outputLabel}>
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={current.label}>
            <div className="out-head">
              <span className="s">{current.help}</span>
              <div className="acts">
                <button type="button" className="btn sm" onClick={() => download(current.file, current.type, outputs[tab])}><DownloadSimpleIcon aria-hidden />{t.install.download}</button>
                <CopyButton text={outputs[tab]} label={t.install.copy} className="btn sm" />
              </div>
            </div>
            <pre className="out">{outputs[tab]}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
