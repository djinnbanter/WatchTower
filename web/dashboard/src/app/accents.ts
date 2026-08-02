export type AccentId =
  | 'signal'
  | 'amber'
  | 'teal'
  | 'violet'
  | 'rose'
  | 'green'
  | 'coral'
  | 'slate';

export type ThemeMode = 'light' | 'dark' | 'black' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'black';

export const ACCENT_PRESETS: { id: AccentId; label: string; swatch: string }[] = [
  { id: 'signal', label: 'Signal blue', swatch: '#4C8DFF' },
  { id: 'amber', label: 'Lantern amber', swatch: '#F5A524' },
  { id: 'teal', label: 'Teal', swatch: '#2DD4BF' },
  { id: 'violet', label: 'Violet', swatch: '#A78BFA' },
  { id: 'rose', label: 'Rose', swatch: '#FB7185' },
  { id: 'green', label: 'Green', swatch: '#4ADE80' },
  { id: 'coral', label: 'Coral', swatch: '#FB923C' },
  { id: 'slate', label: 'Slate', swatch: '#94A3B8' },
];

const ACCENT_IDS = new Set(ACCENT_PRESETS.map((p) => p.id));

export function isAccentId(v: string | null | undefined): v is AccentId {
  return typeof v === 'string' && ACCENT_IDS.has(v as AccentId);
}

export function isThemeMode(v: string | null | undefined): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'black' || v === 'system';
}

/** System never resolves to black — only light or dark. */
export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

export function defaultAccent(): AccentId {
  return 'signal';
}

export function defaultThemeMode(): ThemeMode {
  return 'dark';
}
