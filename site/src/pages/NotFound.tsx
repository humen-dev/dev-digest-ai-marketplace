import { MagnifyingGlassIcon, MagnifyingGlassMinusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { t } from '../i18n/en';

// §9.11: 404 page with a search box.
export function NotFound({ what = t.notFound.page }: { what?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div className="page wrap">
      <div className="empty">
        <MagnifyingGlassMinusIcon size={24} className="muted" aria-hidden />
        <h3>{t.notFound.title(what)}</h3>
        <p>{t.notFound.text}</p>
        <form
          className="search-box"
          role="search"
          style={{ height: 46, marginBottom: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
          }}
        >
          <MagnifyingGlassIcon size={18} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.notFound.searchPlaceholder} aria-label={t.notFound.searchLabel} />
        </form>
        <Link className="btn lg" to="/">{t.notFound.back}</Link>
      </div>
    </div>
  );
}
