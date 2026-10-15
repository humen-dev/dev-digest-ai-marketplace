import {
  BookOpenTextIcon,
  CheckIcon,
  CopyIcon,
  LightningIcon,
  PlugsIcon,
  PlusIcon,
  RobotIcon,
  TerminalWindowIcon,
  type Icon,
} from '@phosphor-icons/react';
import type { Kind } from '../data/types';
import { securityDocUrl } from '../lib/catalog';
import { highlight } from '../lib/search';
import { useAppState, useCopy } from '../lib/state';

export const KIND_ICON: Record<Kind, Icon> = {
  skill: BookOpenTextIcon,
  agent: RobotIcon,
  command: TerminalWindowIcon,
  hook: LightningIcon,
  mcp: PlugsIcon,
};

export function KindIcon({ kind, size = 14 }: { kind: Kind; size?: number }) {
  const I = KIND_ICON[kind];
  return <I size={size} aria-hidden />;
}

export { LightningIcon as HookIcon, PlugsIcon as McpIcon };

/** Text with query terms wrapped in <mark>. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}

export function SetToggle({ plugin, size = 'md', long = false }: { plugin: string; size?: 'md' | 'lg'; long?: boolean }) {
  const { inSet, toggle } = useAppState();
  const on = inSet(plugin);
  const label = on ? (long ? 'In install set' : 'In set') : long ? 'Add to install set' : 'Add to set';
  return (
    <button
      type="button"
      className={`btn${on ? ' on' : ''}${size === 'lg' ? ' lg' : ''}`}
      aria-pressed={on}
      onClick={() => toggle(plugin)}
    >
      {on ? <CheckIcon size={14} aria-hidden /> : <PlusIcon size={14} aria-hidden />}
      {label}
    </button>
  );
}

/** Button that copies text and briefly shows "Copied". */
export function CopyButton({ text, label, className = 'btn', iconOnly = false, title }: { text: string; label: string; className?: string; iconOnly?: boolean; title?: string }) {
  const { copied, copy } = useCopy();
  const done = copied !== null;
  return (
    <button
      type="button"
      className={`${className}${done && iconOnly ? ' done' : ''}`}
      onClick={() => copy('x', text)}
      title={title ?? label}
      aria-label={iconOnly ? title ?? label : undefined}
    >
      {done ? <CheckIcon size={iconOnly ? 15 : 14} aria-hidden /> : <CopyIcon size={iconOnly ? 15 : 14} aria-hidden />}
      {!iconOnly && (done ? 'Copied' : label)}
      <span className="sr-only" aria-live="polite">{done ? 'Copied to clipboard' : ''}</span>
    </button>
  );
}

/** Install command that may wrap only after "@" (§9.2): no mid-word breaks. */
export function InstallCmd({ text }: { text: string }) {
  const at = text.lastIndexOf('@');
  if (at < 0) return <span className="nowrap">{text}</span>;
  return (
    <>
      <span className="nowrap">{text.slice(0, at + 1)}</span>
      <wbr />
      <span className="nowrap">{text.slice(at + 1)}</span>
    </>
  );
}

/** Per-entry badge for the unpinned-dependency heuristic (§8). */
export function UnpinnedBadge() {
  return (
    <a className="badge heur" href={securityDocUrl()} title="npx/uvx/bunx package without an exact version. Heuristic: see docs/SECURITY.md">
      unpinned · heuristic
    </a>
  );
}
