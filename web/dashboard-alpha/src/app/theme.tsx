import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'black';

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  /** Next theme in the light → dark → black cycle */
  nextTheme: Theme;
};

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = 'wt-alpha-theme';
const ORDER: Theme[] = ['light', 'dark', 'black'];

function nextOf(theme: Theme): Theme {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
}

function isTheme(v: string | null): v is Theme {
  return v === 'light' || v === 'dark' || v === 'black';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // Tailwind `dark:` variants apply for both elevated dark and OLED black.
  document.documentElement.classList.toggle('dark', theme === 'dark' || theme === 'black');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY);
    return isTheme(saved) ? saved : 'dark';
  });

  useEffect(() => {
    apply(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeCtx>(() => {
    const nextTheme = nextOf(theme);
    return {
      theme,
      setTheme: setThemeState,
      nextTheme,
      toggleTheme: () => setThemeState((t) => nextOf(t)),
    };
  }, [theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
