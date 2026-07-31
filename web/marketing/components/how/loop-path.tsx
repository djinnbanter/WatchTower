'use client';

import { motion, useReducedMotion } from 'motion/react';
import { InstrumentPlate } from '@/components/instrument-plate';
import { READOUTS } from '@/content/product';

/**
 * Signature mechanism: Watching → Scanning → Fix inbox.
 * Path draws once on enter; completes instantly under reduced motion.
 */
export function LoopPath({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <InstrumentPlate className={className} elevation="flat">
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <svg
          viewBox="0 0 320 56"
          className="h-auto w-full max-w-md"
          aria-hidden
        >
          <motion.path
            d="M16 28 H112 M112 28 H208 M208 28 H304"
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
          {[16, 112, 208, 304].map((x, i) => (
            <motion.circle
              key={x}
              cx={x}
              cy={28}
              r={i === 3 ? 5 : 4}
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

        <div className="grid gap-5 sm:grid-cols-3">
          {READOUTS.map((r) => (
            <div key={r.label}>
              <div className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-low)]">
                {r.label}
              </div>
              <div className="mt-2 font-mono text-[0.9375rem] font-medium text-[color:var(--wt-text)]">
                {r.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </InstrumentPlate>
  );
}
