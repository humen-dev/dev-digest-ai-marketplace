import { MagnifyingGlassMinusIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="page wrap">
      <div className="empty">
        <MagnifyingGlassMinusIcon size={24} className="muted" aria-hidden />
        <h3>No such {what}</h3>
        <p>It may have been renamed or removed from the marketplace.</p>
        <Link className="btn primary lg" to="/">Search the catalog</Link>
      </div>
    </div>
  );
}
