'use client';

import { motion, useReducedMotion } from 'motion/react';
import { InstrumentPlate } from '@/components/instrument-plate';
import { DESK } from '@/content/baked/desk';

const TONE_INK: Record<string, string> = {
  ok: 'var(--wt-ok)',
  warn: 'var(--wt-warn)',
  danger: 'var(--wt-danger)',
  default: 'var(--wt-text)',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  warning: 'Warn',
  info: 'Info',
};

/**
 * Full-width hero instrument: chrome bar + health grade + fix inbox.
 * Composition borrowed from a dual-pane desk mock; data from DESK fixtures only.
 */
export function HeroReadout() {
  const reduce = useReducedMotion();
  const desk = DESK.overview;
  const ink = TONE_INK[desk.tone] ?? TONE_INK.default;
  const tps = desk.vitals.find((v) => v.label === 'TPS');
  const mspt = desk.vitals.find((v) => v.label === 'MSPT');
  const heap = desk.vitals.find((v) => v.label === 'Heap');
  const cpu = desk.vitals.find((v) => v.label === 'CPU');
  const players = desk.vitals.find((v) => v.label === 'Players');

  const inbox = DESK.issues.bands.flatMap((band) => [...band.items]).slice(0, 2);

  const inboxCount = DESK.issues.bands.reduce((n, b) => n + b.count, 0);
  const mc = DESK.identity.find((i) => i.label === 'MC')?.value ?? '1.21.1';

  return (
    <InstrumentPlate>
      <div className="desk-surface relative">
        {/* Chrome bar */}
        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)]/55 px-4 py-2.5 md:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.75rem] text-[color:var(--wt-text-low)]">
            <motion.span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--wt-ok)]"
              animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="font-semibold text-[color:var(--wt-text)]">
              http://localhost:8787
            </span>
            <span aria-hidden className="text-[color:var(--wt-text-low)]">
              |
            </span>
            <span>NeoForge {mc} Dedicated</span>
          </div>
          <div className="flex items-center gap-2.5 font-mono text-[0.75rem]">
            <span
              className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)] px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em] text-[color:var(--wt-text-mid)]"
              style={{ borderRadius: 'var(--wt-radius-sm)' }}
            >
              Auth active
            </span>
            {tps ? (
              <span
                className="font-semibold tabular-nums"
                style={{ color: TONE_INK[tps.tone] ?? TONE_INK.default }}
              >
                {tps.value} TPS
              </span>
            ) : null}
          </div>
        </div>

        {/* Dual pane */}
        <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-12 md:gap-4 md:p-5">
          {/* Health */}
          <div
            className="flex flex-col justify-between border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-4 md:col-span-4"
            style={{ borderRadius: 'var(--wt-radius-sm)' }}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
                  Overall health
                </span>
                <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-mid)]">
                  WatchTower grade
                </span>
              </div>
              <div className="mt-3 flex items-end gap-3">
                <span
                  className="font-mono text-[2.75rem] font-semibold leading-none tracking-tight"
                  style={{ color: ink }}
                  aria-label={`Health grade ${desk.letter}`}
                >
                  {desk.letter}
                </span>
                <div className="pb-1">
                  <div className="text-[0.8125rem] font-semibold text-[color:var(--wt-text)]">
                    {desk.headline}
                  </div>
                  <div className="mt-0.5 font-mono text-[0.75rem] uppercase tracking-[0.1em] text-[color:var(--wt-text-low)]">
                    {desk.word}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2 border-t border-[color:var(--wt-line)] pt-3.5">
              {[
                {
                  label: 'TPS / MSPT',
                  value:
                    tps && mspt
                      ? `${tps.value} / ${mspt.value}${mspt.unit ?? 'ms'}`
                      : null,
                },
                {
                  label: 'Heap',
                  value: heap ? `${heap.value}${heap.unit ?? '%'}` : null,
                },
                {
                  label: 'Players / CPU',
                  value:
                    players && cpu
                      ? `${players.value} / ${cpu.value}${cpu.unit ?? '%'}`
                      : null,
                },
              ]
                .filter((row) => row.value)
                .map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3 text-[0.75rem]"
                  >
                    <span className="text-[color:var(--wt-text-low)]">{row.label}</span>
                    <span className="font-mono font-medium tabular-nums text-[color:var(--wt-text)]">
                      {row.value}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Fix inbox */}
          <div
            className="flex flex-col justify-between border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-4 md:col-span-8"
            style={{ borderRadius: 'var(--wt-radius-sm)' }}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--wt-line)] pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--wt-warn)]"
                  />
                  <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text)]">
                    Issues fix inbox ({inboxCount} open)
                  </span>
                </div>
                <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--wt-accent)]">
                  View inbox
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {inbox.map((issue, i) => {
                  const severityInk =
                    issue.severity === 'critical'
                      ? 'var(--wt-danger)'
                      : issue.severity === 'warning'
                        ? 'var(--wt-warn)'
                        : 'var(--wt-accent)';
                  return (
                    <li
                      key={issue.title}
                      className="flex items-start justify-between gap-3 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] px-3 py-2.5"
                      style={{ borderRadius: 'var(--wt-radius-sm)' }}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="px-1.5 py-0.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.1em]"
                            style={{
                              borderRadius: 'var(--wt-radius-sm)',
                              color: severityInk,
                              background: `color-mix(in srgb, ${severityInk} 16%, transparent)`,
                            }}
                          >
                            {SEVERITY_LABEL[issue.severity] ?? issue.severity}
                          </span>
                          <span className="text-[0.8125rem] font-medium text-[color:var(--wt-text)]">
                            {issue.title}
                          </span>
                        </div>
                        <p className="font-mono text-[0.75rem] leading-snug text-[color:var(--wt-text-low)]">
                          {issue.narrative}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--wt-line)] pt-3 font-mono text-[0.75rem] text-[color:var(--wt-text-low)]">
              <span>
                Spark:{' '}
                <span className="text-[color:var(--wt-text-mid)]">optional companion</span>
              </span>
              <span>
                Local data:{' '}
                <span className="text-[color:var(--wt-text-mid)]">watchtower/</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </InstrumentPlate>
  );
}
