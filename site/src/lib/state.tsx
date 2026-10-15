import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { parseSet } from './install';

const SET_KEY = 'install-set';
const THEME_KEY = 'theme';

// Storage can be missing or throw (private mode, blocked site data); the site
// keeps working for the session without it.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export type Theme = 'light' | 'dark';

interface AppState {
  set: string[];
  inSet: (name: string) => boolean;
  toggle: (name: string) => void;
  replaceSet: (names: string[]) => void;
  clearSet: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<AppState | null>(null);

const systemTheme = (): Theme =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [set, setSet] = useState<string[]>(() => parseSet(read(SET_KEY)));
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = read(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : systemTheme();
  });

  useEffect(() => {
    write(SET_KEY, set.length ? set.join(',') : null);
  }, [set]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    write(THEME_KEY, t);
    document.documentElement.dataset.theme = t;
  }, []);

  const value = useMemo<AppState>(
    () => ({
      set,
      inSet: (n) => set.includes(n),
      toggle: (n) => setSet((s) => (s.includes(n) ? s.filter((x) => x !== n) : parseSet([...s, n].join(',')))),
      replaceSet: (names) => setSet(parseSet(names.join(','))),
      clearSet: () => setSet([]),
      theme,
      setTheme,
    }),
    [set, theme, setTheme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState outside AppStateProvider');
  return v;
}

/** Copy text and report which key was copied last, for a short "Copied" state. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1400);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
  }, []);
  return { copied, copy };
}
