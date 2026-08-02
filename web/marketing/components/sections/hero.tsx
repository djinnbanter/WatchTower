'use client';

import { motion, useReducedMotion } from 'motion/react';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { DeskDotGrid } from '@/components/desk-dot-grid';
import { HeroReadout } from '@/components/hero-readout';
import { HeroTagline } from '@/components/hero-tagline';
import { DEMO_URL, LINKS, SUPPORT_LINE } from '@/content/product';

/**
 * Stacked hero: reactive tagline + CTAs, then a full-width dual-pane desk instrument.
 * Content-height, not full viewport.
 */
export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="wt-hero-night" />
      <div aria-hidden className="wt-hero-stars" />
      <div aria-hidden className="pointer-events-none absolute inset-0 wt-block-grid opacity-70" />
      <DeskDotGrid />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[color:var(--wt-bg0)] to-transparent"
      />

      <div className="relative mx-auto max-w-[84rem] px-5 pb-16 pt-14 md:px-8 md:pb-20 md:pt-16 lg:px-8">
        <div className="mx-auto text-center">
          <motion.div {...rise(0)}>
            <HeroTagline />
          </motion.div>
          <motion.p
            className="mx-auto mt-4 max-w-[34ch] text-[0.9375rem] leading-snug tracking-[-0.01em] text-[color:var(--wt-text-low)] text-pretty md:mt-5 md:max-w-[38ch] md:text-[1rem] md:leading-relaxed"
            {...rise(0.06)}
          >
            {SUPPORT_LINE}
          </motion.p>

          <motion.div
            className="mt-6 flex flex-wrap items-center justify-center gap-2.5 md:mt-7"
            {...rise(0.12)}
          >
            <Cta href={DEMO_URL} withArrow newTab>
              Open the demo
            </Cta>
            <Cta
              href={LINKS.modrinth}
              variant="ghost"
              leading={<ModrinthMark className="h-3.5 w-3.5" />}
            >
              Get it on Modrinth
            </Cta>
          </motion.div>
          <div aria-hidden className="wt-grass-strip mt-5" />
        </div>

        <motion.div
          className="mt-12 w-full md:mt-14"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroReadout />
        </motion.div>
      </div>
    </section>
  );
}
