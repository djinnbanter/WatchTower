'use client';

import { HowDeskShell, HowPill } from '@/components/how/plate-shell';

const NODES = [
  {
    name: 'watchtower/',
    detail: 'Host root next to the game files',
    kind: 'root' as const,
    pill: 'On disk',
    tone: 'ok' as const,
  },
  {
    name: 'ops-cache/',
    detail: 'Scan and live status working cache',
    kind: 'child' as const,
    pill: 'Cache',
    tone: 'neutral' as const,
  },
  {
    name: 'state/',
    detail: 'Dashboard session and host state',
    kind: 'child' as const,
    pill: 'State',
    tone: 'neutral' as const,
  },
  {
    name: 'spark/',
    detail: 'Optional Spark profile uploads',
    kind: 'child' as const,
    pill: 'Optional',
    tone: 'info' as const,
  },
  {
    name: 'support/',
    detail: 'Support zips you build to share',
    kind: 'child' as const,
    pill: 'Packs',
    tone: 'info' as const,
  },
] as const;

/** On-disk watchtower/ tree as desk-queue rows. */
export function DiskTree({ className = '' }: { className?: string }) {
  return (
    <HowDeskShell
      title="On this host"
      badge={<HowPill tone="ok">Local</HowPill>}
      className={className}
    >
      <ul className="desk-queue desk-queue--padded m-0">
        {NODES.map((n) => (
          <li
            key={n.name}
            className={`desk-queue__row px-2 ${n.kind === 'child' ? 'pl-5' : ''}`}
          >
            <div className="min-w-0">
              <div className={`desk-queue__title font-mono ${n.kind === 'root' ? 'text-[0.875rem]' : ''}`}>
                {n.name}
              </div>
              <div className="desk-queue__detail">{n.detail}</div>
            </div>
            <HowPill tone={n.tone}>{n.pill}</HowPill>
          </li>
        ))}
      </ul>
      <p className="m-0 border-t border-[color:var(--wt-line)] px-3 py-3 text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-mid)]">
        Stays on the host unless you opt into a network feature.
      </p>
    </HowDeskShell>
  );
}
