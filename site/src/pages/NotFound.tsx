import { MagnifyingGlassIcon, MagnifyingGlassMinusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

// §9.11: 404 page with a search box.
export function NotFound({ what = 'page' }: { what?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div className="page wrap">
      <div className="empty">
        <MagnifyingGlassMinusIcon size={24} className="muted" aria-hidden />
        <h3>No such {what}</h3>
        <p>It may have been renamed or removed from the marketplace. Search the catalog instead:</p>
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. release notes" aria-label="Search the catalog" />
        </form>
        <Link className="btn lg" to="/">Back to the catalog</Link>
      </div>
    </div>
  );
}
