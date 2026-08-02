'use client';

import { ChartColumn, MonitorOff, Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { InstrumentPlate } from '@/components/instrument-plate';
import { Reveal } from '@/components/reveal';
import { NOT_OUR_JOB } from '@/content/product';

const MARKS: LucideIcon[] = [Server, ChartColumn, MonitorOff];

/**
 * Editorial split: copy left, full-bleed ledger right.
 * Fills the section without a narrow plate floating in empty air.
 */
export function Boundaries() {
  const reduce = useReducedMotion();

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto grid w-full max-w-[84rem] gap-10 px-4 md:px-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:items-end lg:gap-12 lg:px-8">
        <div className="max-w-md lg:pb-1">
          <h2 className="wt-display-sm text-[color:var(--wt-text)]">Not our job.</h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)] md:text-[1.125rem]">
            We stay out of these on purpose.
          </p>
          <div
            className="mt-8 hidden h-px w-16 bg-[color:var(--wt-lantern)] lg:block"
            aria-hidden
          />
        </div>

        <Reveal kind="lift" delay={0.04} className="min-w-0">
          <InstrumentPlate>
            <div className="overflow-hidden">
              <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-px border-b border-[color:var(--wt-line)] bg-[color:var(--wt-line)] md:grid">
                <div className="bg-[color:var(--wt-bg1)] px-5 py-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
                  We do not replace
                </div>
                <div className="bg-[color:var(--wt-bg1)] px-5 py-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
                  Use instead
                </div>
              </div>

              {NOT_OUR_JOB.map((row, i) => {
                const Mark = MARKS[i] ?? Server;
                const last = i === NOT_OUR_JOB.length - 1;
                return (
                  <motion.div
                    key={row.weDont}
                    className={`grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center md:gap-0 md:px-0 md:py-0 ${
                      last ? '' : 'border-b border-[color:var(--wt-line)]'
                    }`}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{
                      duration: 0.45,
                      delay: 0.06 + i * 0.07,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <div className="flex items-start gap-3.5 md:px-5 md:py-4">
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] text-[color:var(--wt-text-mid)]"
                        style={{ borderRadius: 'var(--wt-radius-sm)' }}
                        aria-hidden
                      >
                        <Mark size={15} strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[0.9375rem] font-semibold tracking-tight text-[color:var(--wt-text)] md:text-base">
                          {row.weDont}
                        </div>
                        <div className="mt-0.5 text-sm text-[color:var(--wt-text-low)]">
                          {row.detail}
                        </div>
                      </div>
                    </div>
                    <div className="border-[color:var(--wt-line)] pl-11 md:border-l md:px-5 md:py-4 md:pl-5">
                      <div className="mb-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-low)] md:hidden">
                        Use instead
                      </div>
                      <div className="text-[0.9375rem] leading-snug text-[color:var(--wt-text-mid)] md:text-base">
                        {row.useInstead}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </InstrumentPlate>
        </Reveal>
      </div>
    </section>
  );
}
