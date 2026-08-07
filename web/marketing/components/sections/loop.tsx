'use client';

import { Eye, Inbox, ScanSearch } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { InstrumentPlate } from '@/components/instrument-plate';
import { Reveal } from '@/components/reveal';
import { READOUTS } from '@/content/product';

const MARKS: LucideIcon[] = [Eye, ScanSearch, Inbox];

const BLURBS = [
  'Runs the whole time the game does.',
  'Logs, mods, crashes, and disk in the background.',
  'Ranked findings. Each one has a next step.',
] as const;

/**
 * One instrument: header + continuous three-step loop rail.
 * Reads as a single plate, not a bento of separate feature tiles.
 */
export function Loop() {
  const reduce = useReducedMotion();

  return (
    <section className="border-t border-[color:var(--wt-line)] py-16 md:py-24">
      <div className="mx-auto max-w-[84rem] px-4 md:px-5 lg:px-8">
        <Reveal kind="lift">
          <InstrumentPlate>
            <div className="relative overflow-hidden bg-[color:var(--wt-bg1)]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(42rem 22rem at 8% -10%, var(--wt-glow-accent), transparent 58%), radial-gradient(36rem 20rem at 92% 110%, var(--wt-glow-lantern), transparent 55%)',
                }}
              />

              {!reduce ? (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-[color:var(--wt-accent)]/8 to-transparent"
                  initial={{ x: '-30%' }}
                  animate={{ x: '380%' }}
                  transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: [0.16, 1, 0.3, 1],
                    repeatDelay: 2,
                  }}
                />
              ) : null}

              {/* Shared header */}
              <div className="relative flex flex-col gap-4 border-b border-[color:var(--wt-line)] px-5 py-6 md:flex-row md:items-end md:justify-between md:gap-8 md:px-7 md:py-7">
                <div className="min-w-0 max-w-2xl">
                  <h2 className="wt-display-sm text-[color:var(--wt-text)]">
                    Watching feeds the fix inbox.
                  </h2>
                  <p className="mt-3 text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)] md:text-[1.0625rem]">
                    No daily homework report. The loop is already running while you play.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-ok)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[color:var(--wt-ok)]"
                    aria-hidden
                  />
                  Live loop
                </div>
              </div>

              {/* Continuous step rail */}
              <ol className="relative grid md:grid-cols-3">
                {READOUTS.map((item, i) => {
                  const Mark = MARKS[i]!;
                  const last = i === READOUTS.length - 1;
                  return (
                    <motion.li
                      key={item.label}
                      className={`relative flex flex-col px-5 py-6 md:px-7 md:py-8 ${
                        last
                          ? ''
                          : 'border-b border-[color:var(--wt-line)] md:border-b-0 md:border-r'
                      }`}
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.35 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.05 + i * 0.07,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] text-[color:var(--wt-accent)]"
                          style={{ borderRadius: 'var(--wt-radius-sm)' }}
                          aria-hidden
                        >
                          <Mark size={15} strokeWidth={1.5} />
                        </span>
                        {!last ? (
                          <span
                            className="hidden h-px flex-1 bg-[color:var(--wt-line-strong)] md:block"
                            aria-hidden
                          />
                        ) : null}
                      </div>

                      <div className="mt-5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
                        {item.label}
                      </div>
                      <div className="mt-2 text-[1.125rem] font-semibold leading-snug tracking-tight text-[color:var(--wt-text)] md:text-[1.2rem]">
                        {item.value}
                      </div>
                      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                        {BLURBS[i]}
                      </p>
                    </motion.li>
                  );
                })}
              </ol>
            </div>
          </InstrumentPlate>
        </Reveal>
      </div>
    </section>
  );
}
