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
  sections = 'all',
}: {
  idPrefix?: string;
  compact?: boolean;
  /** Settings desk: fuller theme pills + larger accent swatches. */
  embedded?: boolean;
  /** Split theme / accent when needed (rail uses all). */
  sections?: 'all' | 'theme' | 'accent';
}) {
  const { themeMode, accent, setThemeMode, setAccent } = useTheme();
  const showTheme = sections === 'all' || sections === 'theme';
  const showAccent = sections === 'all' || sections === 'accent';
  /* Labels only when a single block is shown alone (stacked Settings rows). */
  const showLabels = embedded && !compact && sections !== 'all';

  return (
    <div
      className={cn(
        'wt-appearance',
        compact && 'wt-appearance--compact',
        embedded && 'wt-appearance--embedded',
        embedded && sections === 'all' && 'wt-appearance--row',
      )}
    >
      {showTheme ? (
        <div className="wt-appearance__block">
          {showLabels ? (
            <div className="wt-appearance__label" id={`${idPrefix}-theme-label`}>
              Theme
            </div>
          ) : null}
          <div
            className="wt-appearance__themes"
            role="radiogroup"
            aria-label="Colour theme"
            aria-labelledby={showLabels ? `${idPrefix}-theme-label` : undefined}
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
                  <Icon size={embedded ? 15 : 14} aria-hidden />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showAccent ? (
        <div className="wt-appearance__block">
          {showLabels ? (
            <div className="wt-appearance__label" id={`${idPrefix}-accent-label`}>
              Accent
            </div>
          ) : null}
          <div
            className="wt-appearance__accents"
            role="radiogroup"
            aria-label="Accent colour"
            aria-labelledby={showLabels ? `${idPrefix}-accent-label` : undefined}
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
      ) : null}
    </div>
  );
}
