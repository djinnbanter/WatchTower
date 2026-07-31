/**
 * Thin instrument marks for Features tiles.
 * Stroke-only glyphs (1.5px) — ops desk vernacular, not thick icon kits.
 */

import type { ReactNode } from 'react';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Mark({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="1.25rem" height="1.25rem" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

export const CAPABILITY_MARKS: Record<string, ReactNode> = {
  'health-grade': (
    <Mark>
      <path {...stroke} d="M6 18V9l6-5 6 5v9" />
      <path {...stroke} d="M10 18v-5h4v5" />
    </Mark>
  ),
  'fix-inbox': (
    <Mark>
      <path {...stroke} d="M4 7h16M4 12h12M4 17h8" />
      <path {...stroke} d="M18 14l2 2 3-4" />
    </Mark>
  ),
  'join-clinic': (
    <Mark>
      <circle {...stroke} cx="9" cy="10" r="3" />
      <circle {...stroke} cx="16" cy="10" r="3" />
      <path {...stroke} d="M4 19c1.2-2.2 3-3.5 5-3.5S12.8 16.8 14 19" />
      <path {...stroke} d="M14 15.5c1 .4 2 1.2 3 3.5" />
    </Mark>
  ),
  'world-pressure': (
    <Mark>
      <circle {...stroke} cx="12" cy="12" r="8" />
      <path {...stroke} d="M4.5 12h15M12 4.5c2.5 2.2 3.8 4.6 3.8 7.5S14.5 17.3 12 19.5c-2.5-2.2-3.8-4.6-3.8-7.5S9.5 6.7 12 4.5z" />
    </Mark>
  ),
  'support-pack': (
    <Mark>
      <path {...stroke} d="M5 8h14v11H5z" />
      <path {...stroke} d="M9 8V6.5A3 3 0 0 1 15 6.5V8" />
      <path {...stroke} d="M9 13h6" />
    </Mark>
  ),
  'live-vitals': (
    <Mark>
      <path {...stroke} d="M3 14h3l2-6 3 10 2-7 2 3h6" />
    </Mark>
  ),
  'gc-ram': (
    <Mark>
      <rect {...stroke} x="5" y="6" width="14" height="12" rx="1" />
      <path {...stroke} d="M9 6V4M15 6V4M9 20v-2M15 20v-2" />
      <path {...stroke} d="M8 12h8" />
    </Mark>
  ),
  'crash-fingerprints': (
    <Mark>
      <path {...stroke} d="M12 4v6M9 8l3 3 3-3" />
      <path {...stroke} d="M6 14h12v6H6z" />
      <path {...stroke} d="M10 17h4" />
    </Mark>
  ),
  'external-kill': (
    <Mark>
      <path {...stroke} d="M12 5v7" />
      <circle {...stroke} cx="12" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
      <path {...stroke} d="M7 8.5A7 7 0 1 0 17 8.5" />
    </Mark>
  ),
  'silent-fails': (
    <Mark>
      <path {...stroke} d="M5 7h10l4 4v8H5z" />
      <path {...stroke} d="M9 12h6M9 15h4" />
    </Mark>
  ),
  'mods-modrinth': (
    <Mark>
      <path {...stroke} d="M7 5h10v14H7z" />
      <path {...stroke} d="M10 8h4M10 12h4M10 16h3" />
    </Mark>
  ),
  'jar-drift': (
    <Mark>
      <path {...stroke} d="M8 6h8v4H8zM8 14h8v4H8z" />
      <path {...stroke} d="M12 10v4M10 12h4" />
    </Mark>
  ),
  'schedule-load': (
    <Mark>
      <circle {...stroke} cx="12" cy="12" r="8" />
      <path {...stroke} d="M12 8v4.5l3 2" />
    </Mark>
  ),
  'storage-runway': (
    <Mark>
      <path {...stroke} d="M4 16h16M6 16V9l6-4 6 4v7" />
      <path {...stroke} d="M9 16v-3h6v3" />
    </Mark>
  ),
  'weekly-digest': (
    <Mark>
      <path {...stroke} d="M6 5h12v14H6z" />
      <path {...stroke} d="M9 9h6M9 12h6M9 15h4" />
    </Mark>
  ),
  'config-audit': (
    <Mark>
      <circle {...stroke} cx="12" cy="12" r="3" />
      <path {...stroke} d="M12 5v2M12 17v2M5 12h2M17 12h2M7.2 7.2l1.4 1.4M15.4 15.4l1.4 1.4M7.2 16.8l1.4-1.4M15.4 8.6l1.4-1.4" />
    </Mark>
  ),
  spark: (
    <Mark>
      <path {...stroke} d="M13 3L6 13h5l-1 8 8-12h-5l0-6z" />
    </Mark>
  ),
  backups: (
    <Mark>
      <path {...stroke} d="M6 8a6 6 0 0 1 12 0v2h1a2 2 0 0 1 0 4h-1v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H5a2 2 0 0 1 0-4h1z" />
    </Mark>
  ),
  activity: (
    <Mark>
      <path {...stroke} d="M4 18V7h4v11M10 18V11h4v7M16 18V5h4v13" />
    </Mark>
  ),
  logs: (
    <Mark>
      <path {...stroke} d="M6 5h12v14H6z" />
      <path {...stroke} d="M9 9h6M9 12h6M9 15h4" />
      <path {...stroke} d="M6 5l2-1h8l2 1" />
    </Mark>
  ),
  startup: (
    <Mark>
      <path {...stroke} d="M12 19V9" />
      <path {...stroke} d="M8 12l4-4 4 4" />
      <path {...stroke} d="M6 19h12" />
    </Mark>
  ),
  sources: (
    <Mark>
      <circle {...stroke} cx="12" cy="12" r="2.5" />
      <path {...stroke} d="M12 5v2.5M12 16.5V19M5 12h2.5M16.5 12H19" />
      <path {...stroke} d="M7.5 7.5l1.8 1.8M14.7 14.7l1.8 1.8M7.5 16.5l1.8-1.8M14.7 9.3l1.8-1.8" />
    </Mark>
  ),
  accounts: (
    <Mark>
      <circle {...stroke} cx="12" cy="9" r="3" />
      <path {...stroke} d="M6 19c1.5-3 3.5-4.5 6-4.5S16.5 16 18 19" />
    </Mark>
  ),
  auth: (
    <Mark>
      <path {...stroke} d="M8 11V8a4 4 0 0 1 8 0v3" />
      <path {...stroke} d="M7 11h10v9H7z" />
      <circle {...stroke} cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </Mark>
  ),
  help: (
    <Mark>
      <circle {...stroke} cx="12" cy="12" r="8" />
      <path {...stroke} d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" />
      <circle {...stroke} cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Mark>
  ),
  'cli-dr': (
    <Mark>
      <path {...stroke} d="M5 7h14v10H5z" />
      <path {...stroke} d="M8 11l2.5 2L8 15M13 15h3" />
    </Mark>
  ),
};

import type { FeatureTone } from '@/content/features';

export const TONE_CSS: Record<FeatureTone, string> = {
  accent: 'var(--wt-accent)',
  lantern: 'var(--wt-lantern)',
  danger: 'var(--wt-danger)',
  warn: 'var(--wt-warn)',
  ok: 'var(--wt-ok)',
  info: 'var(--wt-info)',
  tps: 'var(--wt-ch-tps)',
  mspt: 'var(--wt-ch-mspt)',
  disk: 'var(--wt-ch-disk)',
  heap: 'var(--wt-ch-heap)',
  players: 'var(--wt-ch-players)',
};
