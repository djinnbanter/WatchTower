'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

/** quiet: no plate when the header is transparent over the hero */
export function ThemeToggle({ quiet = false }: { quiet?: boolean }) {
  const { theme, preference, toggle, setPreference } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      onContextMenu={(e) => {
        // Right-click returns to following the OS theme.
        e.preventDefault();
        setPreference('system');
      }}
      aria-label={
        preference === 'system'
          ? isDark
            ? 'Using system dark. Click for light'
            : 'Using system light. Click for dark'
          : isDark
            ? 'Switch to light theme'
            : 'Switch to dark theme'
      }
      title={preference === 'system' ? 'Following system · right-click to reset' : 'Theme override · right-click to follow system'}
      className="inline-flex h-9 w-9 items-center justify-center text-[color:var(--wt-text-mid)] transition-[color,border-color,background-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--wt-text)] active:scale-[0.96]"
      style={{
        borderRadius: 'var(--wt-radius-md)',
        border: quiet ? '1px solid transparent' : '1px solid var(--wt-line-strong)',
        background: quiet ? 'transparent' : 'var(--wt-bg1)',
      }}
    >
      {isDark ? <Sun size={16} strokeWidth={1.5} aria-hidden /> : <Moon size={16} strokeWidth={1.5} aria-hidden />}
    </button>
  );
}
