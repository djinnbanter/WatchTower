'use client';

import { HowDeskShell, HowPill } from '@/components/how/plate-shell';

const RULES = [
  {
    title: 'Reach it safely',
    detail: 'Prefer localhost or an SSH tunnel.',
    tone: 'ok' as const,
    pill: 'Preferred',
  },
  {
    title: 'Do not publish',
    detail: 'Do not expose 8787 to the open internet.',
    tone: 'warn' as const,
    pill: 'Hard rule',
  },
  {
    title: 'Change the login',
    detail: 'Default is watchtower / password. Change it on first run.',
    tone: 'warn' as const,
    pill: 'Required',
  },
] as const;

/** Settings-style read-only port callout for the Desk room. */
export function PortCallout({ className = '' }: { className?: string }) {
  return (
    <HowDeskShell
      title="Server identity"
      badge={<HowPill tone="info">Settings</HowPill>}
      className={className}
    >
      <div className="flex flex-col gap-1 px-3 pb-2 pt-1">
        <div
          className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)]/40 px-3 py-3"
          style={{ borderRadius: 'var(--wt-radius-sm)' }}
        >
          <div className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-low)]">
            Dashboard port
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[1.5rem] font-semibold tracking-tight text-[color:var(--wt-accent)]">
              8787
            </span>
            <HowPill tone="neutral">Read-only</HowPill>
          </div>
          <p className="mt-2 m-0 text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            Change the bind port in NeoForge config, then restart. The UI shows the live value.
          </p>
        </div>
      </div>

      <ul className="desk-queue desk-queue--padded m-0">
        {RULES.map((rule) => (
          <li key={rule.title} className="desk-queue__row px-2">
            <div className="min-w-0">
              <div className="desk-queue__title">{rule.title}</div>
              <div className="desk-queue__detail">{rule.detail}</div>
            </div>
            <HowPill tone={rule.tone}>{rule.pill}</HowPill>
          </li>
        ))}
      </ul>
    </HowDeskShell>
  );
}
