'use client';

import { motion, useReducedMotion } from 'motion/react';
import { HowDeskShell, HowPill } from '@/components/how/plate-shell';
import { READOUTS } from '@/content/product';

const STAGE_TONE = ['ok', 'info', 'warn'] as const;

/**
 * Signature mechanism: Watching → Scanning → Fix inbox.
 * Path draws once on enter; completes instantly under reduced motion.
 */
export function LoopPath({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <HowDeskShell
      title="Continuous loop"
      badge={<HowPill tone="ok">Live</HowPill>}
      className={className}
    >
      <div className="flex flex-col gap-4 px-3 pb-4 pt-1">
        <svg
          viewBox="0 0 320 48"
          className="h-auto w-full"
          aria-hidden
        >
          <motion.path
            d="M28 24 H120 M120 24 H200 M200 24 H292"
            fill="none"
            stroke="var(--wt-accent)"
            strokeWidth="2"
            strokeLinecap="square"
            initial={reduce ? false : { pathLength: 0, opacity: 0.35 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 1.1, ease: [0.16, 1, 0.3, 1] }
            }
          />
          {[28, 120, 200, 292].map((x, i) => (
            <motion.rect
              key={x}
              x={x - 4}
              y={20}
              width={8}
              height={8}
              fill={i === 3 ? 'var(--wt-accent)' : 'var(--wt-bg1)'}
              stroke="var(--wt-accent)"
              strokeWidth="2"
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      duration: 0.35,
                      delay: 0.15 + i * 0.22,
                      ease: [0.16, 1, 0.3, 1],
                    }
              }
            />
          ))}
        </svg>

        <ul className="desk-queue m-0">
          {READOUTS.map((r, i) => (
            <li key={r.label} className="desk-queue__row px-1">
              <div className="min-w-0">
                <div className="desk-queue__title">{r.label}</div>
                <div className="desk-queue__detail">{r.value}</div>
              </div>
              <HowPill tone={STAGE_TONE[i] ?? 'neutral'}>
                {i === 2 ? 'Inbox' : 'On'}
              </HowPill>
            </li>
          ))}
        </ul>
      </div>
    </HowDeskShell>
  );
}
