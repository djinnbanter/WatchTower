import type { CSSProperties } from 'react';
import { ACCENT_PRESETS, type AccentId, type ThemeMode } from '@/app/accents';
import { useTheme } from '@/app/theme';
import { Eclipse, Moon, Monitor, Sun, type WtIcon } from '@/ui/icons';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: WtIcon }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'black', label: 'Black', icon: Eclipse },
  { id: 'system', label: 'System', icon: Monitor },
];

export function AppearanceControls({
  idPrefix = 'wt-appearance',
  compact = false,
  embedded = false,
}: {
  idPrefix?: string;
  compact?: boolean;
  embedded?: boolean;
}) {
  const { themeMode, accent, setThemeMode, setAccent } = useTheme();

  return (
    <div
      className={cn(
        'wt-appearance',
        compact && 'wt-appearance--compact',
        embedded && 'wt-appearance--embedded',
      )}
    >
      <div
        className="wt-appearance__themes"
        role="radiogroup"
        aria-label="Colour theme"
      >
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const on = themeMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              id={`${idPrefix}-theme-${opt.id}`}
              role="radio"
              aria-checked={on}
              aria-label={`${opt.label} theme`}
              title={opt.label}
              className={cn('wt-appearance__theme-btn', on && 'wt-appearance__theme-btn--on')}
              onClick={() => setThemeMode(opt.id)}
            >
              <Icon size={14} aria-hidden />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div
        className="wt-appearance__accents"
        role="radiogroup"
        aria-label="Accent colour"
      >
        {ACCENT_PRESETS.map((p) => {
          const on = accent === p.id;
          return (
            <button
              key={p.id}
              type="button"
              id={`${idPrefix}-accent-${p.id}`}
              role="radio"
              aria-checked={on}
              aria-label={p.label}
              title={p.label}
              className={cn('wt-appearance__swatch', on && 'wt-appearance__swatch--on')}
              style={{ '--wt-swatch': p.swatch } as CSSProperties}
              onClick={() => setAccent(p.id as AccentId)}
            />
          );
        })}
      </div>
    </div>
  );
}
