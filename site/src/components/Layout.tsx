import { GithubLogoIcon, MagnifyingGlassIcon, MoonIcon, PackageIcon, StackIcon, SunIcon, XIcon } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { catalog } from '../data/catalog';
import { useAppState } from '../lib/state';

const REPO_URL = `https://github.com/${catalog.repo}`;

function Header() {
  const { set, theme, setTheme } = useAppState();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const onHome = pathname === '/';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
    setQ('');
  };

  return (
    <header className="header">
      <div className="wrap">
        <Link to="/" className="brand">
          <span className="brand-mark"><StackIcon aria-hidden /></span>
          <span className="brand-name">DevDigest Marketplace</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Catalog</NavLink>
          <NavLink to="/security/">Security</NavLink>
          <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}>Contribute</a>
        </nav>
        <div className="header-tools">
          {!onHome && (
            <form className="header-search" role="search" onSubmit={submit}>
              <MagnifyingGlassIcon aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalog" aria-label="Search catalog" />
            </form>
          )}
          <Link to="/install/" className={`set-btn${set.length ? ' on' : ''}`} aria-label={`Install set, ${set.length} plugins`}>
            <PackageIcon aria-hidden />
            <span className="label">Install set</span> ({set.length})
          </Link>
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button type="button" aria-pressed={theme === 'light'} aria-label="Light theme" onClick={() => setTheme('light')}>
              <SunIcon aria-hidden />
            </button>
            <button type="button" aria-pressed={theme === 'dark'} aria-label="Dark theme" onClick={() => setTheme('dark')}>
              <MoonIcon aria-hidden />
            </button>
          </div>
          <a className="icon-link" href={REPO_URL} aria-label="Repository on GitHub">
            <GithubLogoIcon aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}

function SetBar() {
  const { set, clearSet } = useAppState();
  const { pathname } = useLocation();
  if (!set.length || pathname.startsWith('/install')) return null;
  return (
    <div className="set-bar" role="region" aria-label="Install set">
      <PackageIcon size={18} aria-hidden />
      <div>
        <div style={{ fontSize: 14 }}>{set.length} plugin{set.length === 1 ? '' : 's'} in set</div>
        <div className="names">{set.join(', ')}</div>
      </div>
      <Link to={`/install/?set=${set.join(',')}`} className="btn primary lg">Generate install</Link>
      <button type="button" className="icon-btn" onClick={clearSet} aria-label="Clear install set" title="Clear set">
        <XIcon aria-hidden />
      </button>
    </div>
  );
}

function Footer() {
  const sha = __COMMIT__;
  return (
    <footer className="footer">
      <div className="wrap">
        {catalog.sample && <span>Preview with sample plugins: the marketplace has no published plugins yet.</span>}
        {sha && (
          <span>
            Built from <a href={`${REPO_URL}/commit/${sha}`}>{sha.slice(0, 7)}</a>
          </span>
        )}
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <SetBar />
    </>
  );
}
