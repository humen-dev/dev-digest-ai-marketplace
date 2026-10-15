import { GithubLogoIcon, MagnifyingGlassIcon, MoonIcon, PackageIcon, StackIcon, SunIcon, XIcon } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { catalog } from '../data/catalog';
import { t } from '../i18n/en';
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
          <span className="brand-name">{t.brand}</span>
        </Link>
        <nav className="nav" aria-label={t.nav.label}>
          <NavLink to="/" end>{t.nav.catalog}</NavLink>
          <NavLink to="/security/">{t.nav.security}</NavLink>
          <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}>{t.nav.contribute}</a>
        </nav>
        <div className="header-tools">
          {!onHome && (
            <form className="header-search" role="search" onSubmit={submit}>
              <MagnifyingGlassIcon aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.header.searchPlaceholder} aria-label={t.header.searchLabel} />
            </form>
          )}
          <Link to="/install/" className={`set-btn${set.length ? ' on' : ''}`} aria-label={t.header.installSetLabel(set.length)}>
            <PackageIcon aria-hidden />
            <span className="label">{t.header.installSet}</span> ({set.length})
          </Link>
          <div className="theme-toggle" role="group" aria-label={t.header.themeLabel}>
            <button type="button" aria-pressed={theme === 'light'} aria-label={t.header.lightTheme} onClick={() => setTheme('light')}>
              <SunIcon aria-hidden />
            </button>
            <button type="button" aria-pressed={theme === 'dark'} aria-label={t.header.darkTheme} onClick={() => setTheme('dark')}>
              <MoonIcon aria-hidden />
            </button>
          </div>
          <a className="icon-link" href={REPO_URL} aria-label={t.header.repoLabel}>
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
    <div className="set-bar" role="region" aria-label={t.setBar.label}>
      <PackageIcon size={18} aria-hidden />
      <div>
        <div style={{ fontSize: 14 }}>{t.setBar.count(set.length)}</div>
        <div className="names">{set.join(', ')}</div>
      </div>
      <Link to={`/install/?set=${set.join(',')}`} className="btn primary lg">{t.setBar.generate}</Link>
      <button type="button" className="icon-btn" onClick={clearSet} aria-label={t.setBar.clearLabel} title={t.setBar.clearTitle}>
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
        {catalog.sample && <span>{t.footer.sample}</span>}
        {sha && (
          <span>
            {t.footer.builtFrom} <a href={`${REPO_URL}/commit/${sha}`}>{sha.slice(0, 7)}</a>
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
