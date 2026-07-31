'use client';

import { HowDeskShell, HowPill } from '@/components/how/plate-shell';

/**
 * mods/ drop plate - catalog rows like the real Mods inventory,
 * with WatchTower highlighted as the jar you just added.
 */
const ROWS = [
  {
    name: 'Spark',
    meta: '1.10.109 · spark',
    pill: 'Companion',
    tone: 'info' as const,
    highlight: false,
  },
  {
    name: 'Create',
    meta: '6.0.6 · create',
    pill: 'Server',
    tone: 'neutral' as const,
    highlight: false,
  },
  {
    name: 'WatchTower',
    meta: '1.1.9 · watchtower-neoforge-1.1.9+mc1.21.jar',
    pill: 'Just added',
    tone: 'ok' as const,
    highlight: true,
  },
] as const;

export function ModsPlate({ className = '' }: { className?: string }) {
  return (
    <HowDeskShell title="mods/" badge={<HowPill tone="ok">3 jars</HowPill>} className={className}>
      <ul className="desk-queue desk-queue--padded m-0">
        {ROWS.map((row) => (
          <li
            key={row.name}
            className={`desk-queue__row ${
              row.highlight
                ? 'bg-[color:var(--wt-accent-soft)]/55 px-2'
                : 'px-2'
            }`}
            style={
              row.highlight
                ? { borderRadius: 'var(--wt-radius-sm)', borderTopColor: 'transparent' }
                : undefined
            }
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center border border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)] font-mono text-[0.75rem] font-semibold uppercase text-[color:var(--wt-text-low)]"
                style={{ borderRadius: 'var(--wt-radius-sm)' }}
              >
                {row.name.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <div className="desk-queue__title">{row.name}</div>
                <div className="desk-queue__detail break-all font-mono">{row.meta}</div>
              </div>
            </div>
            <HowPill tone={row.tone}>{row.pill}</HowPill>
          </li>
        ))}
      </ul>
      <p className="m-0 border-t border-[color:var(--wt-line)] px-3 py-3 text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-mid)]">
        Drop <span className="font-mono text-[color:var(--wt-text)]">watchtower-neoforge-*.jar</span>{' '}
        into <span className="font-mono text-[color:var(--wt-text)]">mods/</span>, then restart once.
      </p>
    </HowDeskShell>
  );
}
