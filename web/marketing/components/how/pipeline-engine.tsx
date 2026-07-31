'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { InstrumentPlate } from '@/components/instrument-plate';

/**
 * Real WatchTower analysis work - category labels only.
 * Sources: PRODUCT.md, watchtower-core analyzers / ops evaluators.
 */
const STAGES = [
  { id: 'crash', label: 'Crash patterns', tick: 'fingerprint · group + classify' },
  { id: 'lag', label: 'Lag signals', tick: 'mspt window · sticky lag band' },
  { id: 'world', label: 'World pressure', tick: 'entities · items · loaded chunks' },
  { id: 'join', label: 'Join / pack sync', tick: 'rejection signatures · sync clinic' },
  { id: 'oom', label: 'External kill / OOM', tick: 'host kill · journal + cgroup' },
  { id: 'silent', label: 'Silent script fails', tick: 'log signatures · quiet errors' },
  { id: 'mods', label: 'Mod jar drift', tick: 'checksum baseline · inventory diff' },
  { id: 'restart', label: 'Restart hygiene', tick: 'when to restart · caution window' },
  { id: 'score', label: 'Health scorecard', tick: 'grade · needs-attention list' },
  { id: 'digest', label: 'Weekly digest', tick: 'schedule · load · storage rollup' },
  { id: 'storage', label: 'Storage pressure', tick: 'dimension scan · disk headroom' },
  { id: 'spark', label: 'Spark profiles', tick: 'optional lag proof · profile read' },
  { id: 'rank', label: 'Issue ranking', tick: 'issues_live · next step each' },
] as const;

const CYCLE_MS = 1600;

/**
 * Live analysis-engine instrument: one stage at a time rotates through real
 * WatchTower work. Signal Blue edge glow on the perimeter. Reduced motion
 * shows a static first stage.
 */
export function PipelineEngine({
  label,
  detail,
  active,
}: {
  label: string;
  detail: string;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  const [hit, setHit] = useState(0);

  useEffect(() => {
    if (!active || reduce) return;
    const id = window.setInterval(() => {
      setHit((h) => (h + 1) % STAGES.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [active, reduce]);

  const live = active && !reduce;
  const stage = STAGES[reduce || !active ? 0 : hit];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={active || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-xl"
    >
      <div
        className="relative overflow-hidden p-[2px]"
        style={{ borderRadius: 'var(--wt-radius-lg)' }}
      >
        {live ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2 will-change-transform"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0%, transparent 68%, color-mix(in srgb, var(--wt-accent) 20%, transparent) 78%, color-mix(in srgb, var(--wt-accent) 70%, transparent) 86%, var(--wt-accent) 92%, color-mix(in srgb, var(--wt-accent) 75%, white) 96%, transparent 100%)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
          />
        ) : null}

        <div className="relative" style={{ borderRadius: 'calc(var(--wt-radius-lg) - 1px)' }}>
          <InstrumentPlate elevation="flat" className="w-full">
            <div className="relative bg-[color:var(--wt-bg1)]">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--wt-line)] px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 ${live ? 'animate-pulse' : ''}`}
                    style={{
                      borderRadius: 'var(--wt-radius-sm)',
                      background: live ? 'var(--wt-accent)' : 'var(--wt-ok)',
                      boxShadow: live
                        ? '0 0 10px color-mix(in srgb, var(--wt-accent) 55%, transparent)'
                        : undefined,
                    }}
                  />
                  <span className="font-mono text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text)]">
                    {label}
                  </span>
                </div>
                <span
                  className={`font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] ${
                    live ? 'text-[color:var(--wt-accent)]' : 'text-[color:var(--wt-ok)]'
                  }`}
                >
                  {live ? 'Reading' : 'Ready'}
                </span>
              </div>

              <div className="flex flex-col gap-4 px-4 py-4">
                <p className="m-0 text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)] text-balance">
                  {detail}
                </p>

                <div
                  className="relative overflow-hidden border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-3 py-3"
                  style={{ borderRadius: 'var(--wt-radius-sm)' }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="mb-1.5 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
                    Now reading
                  </div>
                  <div className="relative min-h-[1.75rem]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={stage.id}
                        initial={live ? { opacity: 0, y: 8 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={live ? { opacity: 0, y: -8 } : undefined}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center gap-2.5"
                      >
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0"
                          style={{
                            borderRadius: '1px',
                            background: 'var(--wt-accent)',
                            boxShadow: live
                              ? '0 0 8px color-mix(in srgb, var(--wt-accent) 50%, transparent)'
                              : undefined,
                          }}
                        />
                        <span className="font-mono text-[0.9375rem] font-semibold uppercase tracking-[0.1em] text-[color:var(--wt-accent)]">
                          {stage.label}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[0.75rem] tabular-nums text-[color:var(--wt-text-low)]">
                    <span>
                      {String((reduce || !active ? 0 : hit) + 1).padStart(2, '0')} /{' '}
                      {String(STAGES.length).padStart(2, '0')}
                    </span>
                    <span className="flex gap-1" aria-hidden>
                      {STAGES.map((s, i) => (
                        <span
                          key={s.id}
                          className="h-1 w-1"
                          style={{
                            borderRadius: '1px',
                            background:
                              i === (reduce || !active ? 0 : hit)
                                ? 'var(--wt-accent)'
                                : 'var(--wt-line-strong)',
                          }}
                        />
                      ))}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-[color:var(--wt-line)] pt-3 font-mono text-[0.75rem] text-[color:var(--wt-text-low)]">
                  <span aria-hidden className="text-[color:var(--wt-accent)]">
                    ›
                  </span>
                  <span className="min-w-0 truncate tabular-nums tracking-wide">{stage.tick}</span>
                  {live ? (
                    <motion.span
                      aria-hidden
                      className="inline-block h-3 w-px bg-[color:var(--wt-accent)]"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </InstrumentPlate>
        </div>
      </div>
    </motion.div>
  );
}
