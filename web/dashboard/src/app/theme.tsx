import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/api/client';
import { useSessionStore } from '@/app/session-store';
import {
  type AccentId,
  type ResolvedTheme,
  type ThemeMode,
  defaultAccent,
  defaultThemeMode,
  isAccentId,
  isThemeMode,
  resolveThemeMode,
} from '@/app/accents';

/** @deprecated Prefer ThemeMode; kept for call sites that mean resolved theme. */
export type Theme = ResolvedTheme;

type ThemeCtx = {
  /** Selected mode including `system`. */
  themeMode: ThemeMode;
  /** Resolved surface theme after system preference. */
  resolvedTheme: ResolvedTheme;
  /** Alias of resolvedTheme for older call sites. */
  theme: ResolvedTheme;
  accent: AccentId;
  setThemeMode: (mode: ThemeMode) => void;
  /** Alias: accepts ThemeMode (including system). */
  setTheme: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  toggleTheme: () => void;
  nextTheme: ResolvedTheme;
};

const Ctx = createContext<ThemeCtx | null>(null);
const THEME_KEY = 'wt-theme';
const ACCENT_KEY = 'wt-accent';
const LEGACY_KEY = 'wt-alpha-theme';
const CYCLE: ResolvedTheme[] = ['light', 'dark', 'black'];

function prefersDarkMq(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDom(resolved: ResolvedTheme, accent: AccentId) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
  root.classList.toggle('dark', resolved === 'dark' || resolved === 'black');
}

function readStoredThemeMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY);
  if (isThemeMode(saved)) return saved;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === 'light' || legacy === 'dark' || legacy === 'black') {
    localStorage.setItem(THEME_KEY, legacy);
    return legacy;
  }
  return defaultThemeMode();
}

function readStoredAccent(): AccentId {
  const saved = localStorage.getItem(ACCENT_KEY);
  return isAccentId(saved) ? saved : defaultAccent();
}

function nextOf(resolved: ResolvedTheme): ResolvedTheme {
  return CYCLE[(CYCLE.indexOf(resolved) + 1) % CYCLE.length]!;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => readStoredThemeMode());
  const [accent, setAccentState] = useState<AccentId>(() => readStoredAccent());
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window !== 'undefined' ? prefersDarkMq() : true,
  );
  const session = useSessionStore((s) => s.session);
  const hydratedFromAccount = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushedDefaults = useRef(false);

  const resolvedTheme = resolveThemeMode(themeMode, prefersDark);
  const authenticated =
    !!session && session.authenticated !== false && session.fully_authenticated !== false;

  const persistLocal = useCallback((mode: ThemeMode, nextAccent: AccentId) => {
    localStorage.setItem(THEME_KEY, mode);
    localStorage.setItem(ACCENT_KEY, nextAccent);
  }, []);

  const scheduleAccountSave = useCallback(
    (mode: ThemeMode, nextAccent: AccentId) => {
      if (!authenticated) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void api.appearanceSave({ theme: mode, accent: nextAccent }).catch(() => {
          /* keep local; next successful save will sync */
        });
      }, 300);
    },
    [authenticated],
  );

  useEffect(() => {
    applyDom(resolvedTheme, accent);
    persistLocal(themeMode, accent);
  }, [resolvedTheme, accent, themeMode, persistLocal]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setPrefersDark(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Hydrate from account session once fully authenticated.
  useEffect(() => {
    if (!authenticated || !session) {
      hydratedFromAccount.current = false;
      pushedDefaults.current = false;
      return;
    }
    if (hydratedFromAccount.current) return;

    const accountTheme = typeof session.ui_theme === 'string' ? session.ui_theme : null;
    const accountAccent = typeof session.ui_accent === 'string' ? session.ui_accent : null;
    const hasTheme = isThemeMode(accountTheme);
    const hasAccent = isAccentId(accountAccent);

    if (hasTheme || hasAccent) {
      if (hasTheme) setThemeModeState(accountTheme);
      if (hasAccent) setAccentState(accountAccent);
      hydratedFromAccount.current = true;
      return;
    }

    if (!pushedDefaults.current) {
      pushedDefaults.current = true;
      hydratedFromAccount.current = true;
      const mode = readStoredThemeMode();
      const acc = readStoredAccent();
      void api.appearanceSave({ theme: mode, accent: acc }).catch(() => {
        /* ignore */
      });
    }
  }, [authenticated, session]);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setThemeModeState(mode);
      scheduleAccountSave(mode, accent);
    },
    [accent, scheduleAccountSave],
  );

  const setAccent = useCallback(
    (next: AccentId) => {
      setAccentState(next);
      scheduleAccountSave(themeMode, next);
    },
    [themeMode, scheduleAccountSave],
  );

  const value = useMemo<ThemeCtx>(() => {
    return {
      themeMode,
      resolvedTheme,
      theme: resolvedTheme,
      accent,
      setThemeMode,
      setTheme: setThemeMode,
      setAccent,
      nextTheme: nextOf(resolvedTheme),
      toggleTheme: () => setThemeMode(nextOf(resolvedTheme)),
    };
  }, [themeMode, resolvedTheme, accent, setThemeMode, setAccent]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
