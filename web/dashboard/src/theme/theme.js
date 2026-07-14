export const THEMES = ['dark', 'light', 'black'];

const STORAGE_KEY = 'wt.theme';
const LEGACY_KEY = 'watchtower-theme';

/** CSS custom properties exposed via chartPalette() (keys without --ui- prefix). */
const CHART_VARS = [
  '--ui-ch-tps',
  '--ui-ch-mspt',
  '--ui-ch-cpu',
  '--ui-ch-heap',
  '--ui-ch-players',
  '--ui-ch-disk',
  '--ui-ch-rx',
  '--ui-ch-tx',
  '--ui-ch-grid',
  '--ui-ok',
  '--ui-warn',
  '--ui-danger',
  '--ui-info',
  '--ui-accent',
  '--ui-text-low',
  '--ui-text-mid',
  '--ui-text-hi',
  '--ui-bg2',
  '--ui-line',
];

function readStoredTheme() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current && THEMES.includes(current)) return current;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && THEMES.includes(legacy)) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
      return legacy;
    }
  } catch {
    /* localStorage unavailable */
  }
  return 'dark';
}

export function getTheme() {
  const attr = document.documentElement.dataset.theme;
  if (attr && THEMES.includes(attr)) return attr;
  return readStoredTheme();
}

export function setTheme(name) {
  const theme = THEMES.includes(name) ? name : 'dark';
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  return theme;
}

export function cycleTheme() {
  const idx = THEMES.indexOf(getTheme());
  const next = THEMES[(idx + 1) % THEMES.length];
  return setTheme(next);
}

export function initTheme() {
  return setTheme(readStoredTheme());
}

/**
 * Resolved chart / semantic colors from CSS custom properties.
 * Keys are without the `--ui-` prefix, e.g. `ch-tps`, `ok`, `accent`.
 */
export function chartPalette() {
  const style = getComputedStyle(document.documentElement);
  const palette = {};
  for (const v of CHART_VARS) {
    palette[v.slice(5)] = style.getPropertyValue(v).trim(); // strip "--ui-"
  }
  return palette;
}

/**
 * Resolve a color for canvas drawing (uPlot cannot use CSS variables).
 * Accepts: hex/rgb, `var(--ui-…)`, bare token (`ok`, `ch-tps`, `tps`), or null.
 */
export function resolveColor(tokenOrHex, palette, seriesKey) {
  const p = palette || chartPalette();
  if (!tokenOrHex && seriesKey) {
    return p[`ch-${seriesKey}`] || p.accent || '#4C9EEA';
  }
  if (!tokenOrHex) return p.accent || '#4C9EEA';

  const s = String(tokenOrHex).trim();
  if (s.startsWith('var(')) {
    const m = s.match(/var\(\s*(--ui-[\w-]+)\s*\)/);
    if (m) {
      const key = m[1].slice(5);
      // Map legacy alias
      if (key === 'positive') return p.ok || '#3fb950';
      return p[key] || getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || p.accent;
    }
  }
  if (s.startsWith('#') || s.startsWith('rgb') || s.startsWith('hsl')) return s;
  // Bare token: ok, warn, ch-tps, tps, …
  if (s === 'positive') return p.ok || '#3fb950';
  if (p[s]) return p[s];
  if (p[`ch-${s}`]) return p[`ch-${s}`];
  if (seriesKey && p[`ch-${seriesKey}`]) return p[`ch-${seriesKey}`];
  return s;
}
