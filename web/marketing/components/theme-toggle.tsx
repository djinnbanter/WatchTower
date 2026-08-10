'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--wt-text)] transition-colors duration-200 hover:border-[color:var(--wt-text)] hover:text-[color:var(--wt-accent)] lg:h-9 lg:w-9"
      style={{ border: '1px solid var(--wt-line)' }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

