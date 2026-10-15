import { DownloadSimpleIcon, LightningIcon, PackageIcon, PlugsIcon, ShieldWarningIcon, XIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CopyButton } from '../components/ui';
import { envVars, findPlugin, items } from '../lib/catalog';
import { parseSet, settingsJson, shellCommands } from '../lib/install';
import { useAppState } from '../lib/state';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function InstallPage() {
  const { set, replaceSet, toggle } = useAppState();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fromUrl = params.get('set');

  // A shared link (?set=a,b) pre-fills the set once, then the URL follows the set.
  useEffect(() => {
    if (fromUrl !== null) replaceSet(parseSet(fromUrl));
  }, []);
  useEffect(() => {
    const want = set.join(',');
    if ((params.get('set') ?? '') !== want) navigate({ search: want ? `?set=${want}` : '' }, { replace: true });
  }, [set, params, navigate]);

  const plugins = set.map(findPlugin).filter((p) => !!p);
  const hooks = plugins.reduce((n, p) => n + p.hooks.length, 0);
  const mcp = plugins.reduce((n, p) => n + p.mcp.length, 0);
  const env = [...new Set(plugins.flatMap(envVars))];
  const shareUrl = `${location.origin}${import.meta.env.BASE_URL}install/?set=${set.join(',')}`;

  if (!plugins.length) {
    return (
      <div className="page wrap">
        <h1 className="page-title">Install set</h1>
        <div className="empty">
          <PackageIcon size={24} className="muted" aria-hidden />
          <h3>Your install set is empty</h3>
          <p>Add plugins from the catalog with “Add to set”, then come back here for the commands and a settings file for your team.</p>
          <Link className="btn primary lg" to="/">Browse the catalog</Link>
        </div>
      </div>
    );
  }

  const commands = shellCommands(set);
  const settings = settingsJson(set);

  return (
    <div className="page wrap">
      <div className="install-grid">
        <div>
          <h1 className="page-title">Install set</h1>
          <p className="lede">Share this page's URL, or commit the settings file so the whole team gets the same plugins.</p>
          {plugins.map((p) => {
            const count = items.filter((it) => it.plugin === p).length;
            return (
              <div className="set-row" key={p.name}>
                <div className="info">
                  <Link className="name" to={`/plugins/${p.name}/`}>{p.name}</Link>
                  <div className="sum">{count} artifacts · {p.description}</div>
                </div>
                {p.hooks.length > 0 && <span className="ic-badge" title="hook"><LightningIcon aria-label="Runs hooks" /></span>}
                {p.mcp.length > 0 && <span className="ic-badge" title="MCP server"><PlugsIcon aria-label="Starts MCP servers" /></span>}
                <button type="button" className="icon-btn" onClick={() => toggle(p.name)} aria-label={`Remove ${p.name}`}><XIcon aria-hidden /></button>
              </div>
            );
          })}
          {hooks + mcp > 0 && (
            <div className="note-box">
              <ShieldWarningIcon size={18} aria-hidden />
              <span>
                This set runs <strong>{hooks} hook{hooks === 1 ? '' : 's'}</strong>
                {mcp > 0 && <> and starts <strong>{mcp} MCP server{mcp === 1 ? '' : 's'}</strong></>}.
                {env.length > 0 && <> Needs <code className="code-inline">{env.join(', ')}</code>.</>}{' '}
                <Link to="/security/">Review</Link>
              </span>
            </div>
          )}
          <div style={{ marginTop: 18 }}>
            <CopyButton text={shareUrl} label="Copy share link" className="btn" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div>
            <div className="out-head">
              <span className="t">Shell commands</span>
              <span className="s">paste into Claude Code</span>
              <div className="acts"><CopyButton text={commands} label="Copy" className="btn sm" /></div>
            </div>
            <pre className="out">{commands}</pre>
          </div>
          <div>
            <div className="out-head">
              <span className="t">.claude/settings.json</span>
              <span className="s">commit to the project</span>
              <div className="acts">
                <button type="button" className="btn sm" onClick={() => download('settings.json', settings + '\n')}><DownloadSimpleIcon aria-hidden />Download</button>
                <CopyButton text={settings} label="Copy" className="btn sm" />
              </div>
            </div>
            <pre className="out">{settings}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
