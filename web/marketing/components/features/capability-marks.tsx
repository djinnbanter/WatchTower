/**
 * Instrument marks for Features capability cards.
 * Stroke glyphs sized for gauge faces — ops desk vernacular, not Lucide kits.
 */

import type { ReactNode } from 'react';
import type { FeatureTone } from '@/content/features';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Mark({ children, size = 'md' }: { children: ReactNode; size?: 'md' | 'lg' }) {
  const px = size === 'lg' ? '2.75rem' : '1.5rem';
  return (
    <svg viewBox="0 0 24 24" width={px} height={px} aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

function paths(id: string, size: 'md' | 'lg'): ReactNode {
  const m = (nodes: ReactNode) => <Mark size={size}>{nodes}</Mark>;
  switch (id) {
    case 'health-grade':
      return m(
        <>
          <path {...stroke} d="M6 18V9l6-5 6 5v9" />
          <path {...stroke} d="M10 18v-5h4v5" />
        </>,
      );
    case 'fix-inbox':
      return m(
        <>
          <path {...stroke} d="M4 7h16M4 12h12M4 17h8" />
          <path {...stroke} d="M18 14l2 2 3-4" />
        </>,
      );
    case 'join-clinic':
      return m(
        <>
          <circle {...stroke} cx="9" cy="10" r="3" />
          <circle {...stroke} cx="16" cy="10" r="3" />
          <path {...stroke} d="M4 19c1.2-2.2 3-3.5 5-3.5S12.8 16.8 14 19" />
          <path {...stroke} d="M14 15.5c1 .4 2 1.2 3 3.5" />
        </>,
      );
    case 'world-pressure':
      return m(
        <>
          <circle {...stroke} cx="12" cy="12" r="8" />
          <path
            {...stroke}
            d="M4.5 12h15M12 4.5c2.5 2.2 3.8 4.6 3.8 7.5S14.5 17.3 12 19.5c-2.5-2.2-3.8-4.6-3.8-7.5S9.5 6.7 12 4.5z"
          />
        </>,
      );
    case 'support-pack':
      return m(
        <>
          <path {...stroke} d="M5 8h14v11H5z" />
          <path {...stroke} d="M9 8V6.5A3 3 0 0 1 15 6.5V8" />
          <path {...stroke} d="M9 13h6" />
        </>,
      );
    case 'live-vitals':
      return m(<path {...stroke} d="M3 14h3l2-6 3 10 2-7 2 3h6" />);
    case 'gc-ram':
      return m(
        <>
          <rect {...stroke} x="5" y="6" width="14" height="12" rx="1" />
          <path {...stroke} d="M9 6V4M15 6V4M9 20v-2M15 20v-2" />
          <path {...stroke} d="M8 12h8" />
        </>,
      );
    case 'crash-fingerprints':
      return m(
        <>
          <path {...stroke} d="M12 4v6M9 8l3 3 3-3" />
          <path {...stroke} d="M6 14h12v6H6z" />
          <path {...stroke} d="M10 17h4" />
        </>,
      );
    case 'external-kill':
      return m(
        <>
          <path {...stroke} d="M12 5v7" />
          <circle {...stroke} cx="12" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
          <path {...stroke} d="M7 8.5A7 7 0 1 0 17 8.5" />
        </>,
      );
    case 'silent-fails':
      return m(
        <>
          <path {...stroke} d="M5 7h10l4 4v8H5z" />
          <path {...stroke} d="M9 12h6M9 15h4" />
        </>,
      );
    case 'mods-modrinth':
      return m(
        <>
          <path {...stroke} d="M7 5h10v14H7z" />
          <path {...stroke} d="M10 8h4M10 12h4M10 16h3" />
        </>,
      );
    case 'jar-drift':
      return m(
        <>
          <path {...stroke} d="M8 6h8v4H8zM8 14h8v4H8z" />
          <path {...stroke} d="M12 10v4M10 12h4" />
        </>,
      );
    case 'jar-disable':
      return m(
        <>
          <path {...stroke} d="M8 5h8v14H8z" />
          <path {...stroke} d="M11 5V3.5h2V5" />
          <path {...stroke} d="M7 17l10-10" />
        </>,
      );
    case 'mod-configs':
      return m(
        <>
          <path {...stroke} d="M6 5h12v14H6z" />
          <path {...stroke} d="M9 9h6M9 12h4M9 15h5" />
        </>,
      );
    case 'schedule-load':
      return m(
        <>
          <circle {...stroke} cx="12" cy="12" r="8" />
          <path {...stroke} d="M12 8v4.5l3 2" />
        </>,
      );
    case 'storage-runway':
      return m(
        <>
          <path {...stroke} d="M4 16h16M6 16V9l6-4 6 4v7" />
          <path {...stroke} d="M9 16v-3h6v3" />
        </>,
      );
    case 'storage-space-map':
      return m(
        <>
          <path {...stroke} d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />
        </>,
      );
    case 'weekly-digest':
      return m(
        <>
          <path {...stroke} d="M6 5h12v14H6z" />
          <path {...stroke} d="M9 9h6M9 12h6M9 15h4" />
        </>,
      );
    case 'config-audit':
      return m(
        <>
          <circle {...stroke} cx="12" cy="12" r="3" />
          <path
            {...stroke}
            d="M12 5v2M12 17v2M5 12h2M17 12h2M7.2 7.2l1.4 1.4M15.4 15.4l1.4 1.4M7.2 16.8l1.4-1.4M15.4 8.6l1.4-1.4"
          />
        </>,
      );
    case 'spark':
      return m(<path {...stroke} d="M13 3L6 13h5l-1 8 8-12h-5l0-6z" />);
    case 'spark-map':
      return m(
        <>
          <path {...stroke} d="M5 5h14v14H5z" />
          <path {...stroke} d="M5 12h14M12 5v14" />
          <circle {...stroke} cx="15" cy="9" r="1.5" fill="currentColor" stroke="none" />
        </>,
      );
    case 'backups':
      return m(
        <path
          {...stroke}
          d="M6 8a6 6 0 0 1 12 0v2h1a2 2 0 0 1 0 4h-1v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H5a2 2 0 0 1 0-4h1z"
        />,
      );
    case 'activity':
      return m(<path {...stroke} d="M4 18V7h4v11M10 18V11h4v7M16 18V5h4v13" />);
    case 'logs':
      return m(
        <>
          <path {...stroke} d="M6 5h12v14H6z" />
          <path {...stroke} d="M9 9h6M9 12h6M9 15h4" />
          <path {...stroke} d="M6 5l2-1h8l2 1" />
        </>,
      );
    case 'startup':
      return m(
        <>
          <path {...stroke} d="M12 19V9" />
          <path {...stroke} d="M8 12l4-4 4 4" />
          <path {...stroke} d="M6 19h12" />
        </>,
      );
    case 'sources':
      return m(
        <>
          <circle {...stroke} cx="12" cy="12" r="2.5" />
          <path {...stroke} d="M12 5v2.5M12 16.5V19M5 12h2.5M16.5 12H19" />
          <path
            {...stroke}
            d="M7.5 7.5l1.8 1.8M14.7 14.7l1.8 1.8M7.5 16.5l1.8-1.8M14.7 9.3l1.8-1.8"
          />
        </>,
      );
    case 'accounts':
      return m(
        <>
          <circle {...stroke} cx="12" cy="9" r="3" />
          <path {...stroke} d="M6 19c1.5-3 3.5-4.5 6-4.5S16.5 16 18 19" />
        </>,
      );
    case 'theme-accent':
      return m(
        <>
          <circle {...stroke} cx="9" cy="12" r="4" />
          <circle {...stroke} cx="15" cy="12" r="4" />
          <path {...stroke} d="M9 8h6M9 16h6" />
        </>,
      );
    case 'auth':
      return m(
        <>
          <path {...stroke} d="M8 11V8a4 4 0 0 1 8 0v3" />
          <path {...stroke} d="M7 11h10v9H7z" />
          <circle {...stroke} cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
        </>,
      );
    case 'help':
      return m(
        <>
          <circle {...stroke} cx="12" cy="12" r="8" />
          <path {...stroke} d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" />
          <circle {...stroke} cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </>,
      );
    case 'cli-dr':
      return m(
        <>
          <path {...stroke} d="M5 7h14v10H5z" />
          <path {...stroke} d="M8 11l2.5 2L8 15M13 15h3" />
        </>,
      );
    default:
      return m(<circle {...stroke} cx="12" cy="12" r="6" />);
  }
}

export function CapabilityMark({ id, size = 'md' }: { id: string; size?: 'md' | 'lg' }) {
  return paths(id, size);
}

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
