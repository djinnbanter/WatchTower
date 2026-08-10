'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { HeroSideRail } from '@/components/home/hero-side-rail';
import { useLivePulse } from '@/components/shift-log/live-pulse-context';
import {
  DEMO_URL,
  HERO_CONTEXT,
  HERO_DISPLAY,
  HERO_OVERVIEW,
  HERO_PRIMARY_CTA,
  HERO_SCROLL_CUE,
  HERO_SECONDARY_CTA,
  HERO_V2_DETAIL,
  HERO_V2_NOTE,
  LINKS,
} from '@/content/product';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Full-viewport marketing hero (edge-to-edge; header reveals after scroll).
 * Mobile: single column, thumb-zone CTAs, horizontal wordmark (no tall side rail).
 */
export function HomeHero() {
  const { alive } = useLivePulse();
  const reduce = useReducedMotion();

  const rise = (delay: number, y = 16) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: EASE },
        };

  const titleLines = HERO_DISPLAY.includes('\n')
    ? HERO_DISPLAY.split('\n')
    : [HERO_DISPLAY];

  return (
    <section
      className="wt-snap-panel relative flex min-h-[100dvh] w-full flex-col border-b border-[color:var(--wt-line)] bg-transparent"
      aria-label="WatchTower"
    >
      <div className="relative z-10 flex h-full min-h-0 w-full flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative flex flex-col justify-center px-4 py-10 sm:px-5 md:px-10 md:py-16 lg:py-20 lg:pl-[max(3rem,calc((100vw-1600px)/2+2rem))] lg:pr-16">
            <div className="relative z-10 mx-auto flex w-full max-w-[42rem] flex-col gap-5 md:gap-8 lg:mx-0">
              <motion.div className="flex flex-wrap items-center gap-3" {...rise(0.06)}>
                <span
                  aria-hidden
                  className={`inline-block h-2.5 w-2.5 shrink-0 ${
                    alive ? 'bg-[color:var(--wt-ok)]' : 'bg-[color:var(--wt-text-low)]'
                  }`}
                />
                <p className="wt-meta text-[color:var(--wt-text-mid)]">
                  WatchTower · {HERO_CONTEXT} · {alive ? 'watching' : 'stopped'}
                </p>
              </motion.div>

              <h1 className="wt-display max-w-[14ch] text-[clamp(2.35rem,9vw,5.25rem)] leading-[0.92] text-[color:var(--wt-text)]">
                {titleLines.map((line, i) => (
                  <motion.span
                    key={line}
                    className="block"
                    {...rise(0.14 + i * 0.1, 22)}
                  >
                    {line}
                  </motion.span>
                ))}
              </h1>

              <motion.div
                className="h-1.5 w-24 origin-left bg-[color:var(--wt-accent)]"
                aria-hidden
                {...(reduce
                  ? { initial: false }
                  : {
                      initial: { scaleX: 0, opacity: 0 },
                      animate: { scaleX: 1, opacity: 1 },
                      transition: { duration: 0.45, delay: 0.34, ease: EASE },
                    })}
              />

              {/* Phone: brand lockup as a ruled strip — vertical rail is desktop-only. */}
              <motion.p
                className="wt-display m-0 select-none tracking-[-0.04em] lg:hidden"
                aria-hidden
                {...rise(0.36)}
              >
                <span className="text-[clamp(2rem,11vw,3.25rem)] leading-none text-[color:var(--wt-text)]">
                  WATCH
                </span>
                <span className="text-[clamp(2rem,11vw,3.25rem)] leading-none text-[color:var(--wt-accent)]">
                  TOWER
                </span>
              </motion.p>

              <motion.aside
                className="flex flex-col gap-2 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                aria-label={HERO_V2_NOTE}
                {...rise(0.38)}
              >
                <span className="desk-pill desk-pill--warn shrink-0 self-start">{HERO_V2_NOTE}</span>
                <p className="m-0 text-sm leading-snug text-[color:var(--wt-text-mid)]">
                  {HERO_V2_DETAIL}
                </p>
              </motion.aside>

              <motion.p
                className="max-w-xl text-[0.9375rem] font-normal normal-case leading-relaxed tracking-normal text-[color:var(--wt-text-mid)] md:text-lg"
                {...rise(0.42)}
              >
                {HERO_OVERVIEW}
              </motion.p>

              <motion.div className="flex flex-wrap items-center gap-2 pt-1" {...rise(0.46)}>
                {[
                  { label: 'What Is It', id: 'what' },
                  { label: 'Health Overview', id: 'overview' },
                  { label: 'Fix Inbox', id: 'issues' },
                  { label: 'Crash Center', id: 'crashes' },
                  { label: 'Storage Insights', id: 'insights' },
                ].map(({ label, id }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="inline-flex items-center gap-1.5 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-2.5 py-1 font-mono text-[0.75rem] uppercase tracking-[0.1em] text-[color:var(--wt-text-mid)] no-underline transition-colors duration-200 hover:border-[color:var(--wt-accent)] hover:text-[color:var(--wt-accent)]"
                  >
                    <span>{label}</span>
                    <span aria-hidden className="text-[color:var(--wt-accent)]">
                      ↓
                    </span>
                  </a>
                ))}
              </motion.div>

              <motion.div
                className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch"
                {...rise(0.5)}
              >
                <Cta
                  href={LINKS.modrinth}
                  withArrow
                  className="min-h-12 w-full sm:w-auto"
                  leading={
                    <ModrinthMark className="h-3.5 w-3.5 transition-colors duration-200 group-hover:text-[#1BD96A] group-active:text-[#1BD96A]" />
                  }
                >
                  {HERO_PRIMARY_CTA}
                </Cta>
                <Cta
                  href={DEMO_URL}
                  variant="ghost"
                  className="min-h-12 w-full sm:w-auto"
                  newTab
                >
                  {HERO_SECONDARY_CTA}
                </Cta>
              </motion.div>
            </div>
          </div>

          <motion.div
            className="relative hidden min-h-0 w-fit flex-col overflow-hidden border-l border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] lg:flex"
            {...rise(0.28, 20)}
          >
            <HeroSideRail />
          </motion.div>
        </div>

        <motion.div
          className="flex shrink-0 flex-col gap-3 border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-4 py-4 sm:px-5 md:px-10 lg:pl-[max(2.5rem,calc((100vw-1600px)/2+2rem))] lg:pr-10 sm:flex-row sm:items-center sm:justify-between"
          {...rise(0.58, 10)}
        >
          <div className="flex items-center gap-3 font-mono text-xs text-[color:var(--wt-text-low)]">
            <span className="text-[color:var(--wt-ok)]">● LOCAL-FIRST OPS</span>
            <span>///</span>
            <span>ZERO CLOUD REQUIRED</span>
            <span className="hidden md:inline">///</span>
            <span className="hidden md:inline text-[color:var(--wt-text-mid)]">ADVISORY ONLY</span>
          </div>
          <Link
            href="#what"
            className="group inline-flex min-h-11 items-center justify-center gap-3 border border-[color:var(--wt-accent)] bg-[color:var(--wt-accent-soft)] px-4 py-2.5 no-underline transition-colors active:bg-[color:var(--wt-accent)] active:text-[color:var(--wt-accent-ink)] hover:bg-[color:var(--wt-accent)] hover:text-[color:var(--wt-accent-ink)] sm:w-auto"
          >
            <span className="wt-meta font-semibold tracking-[0.14em] text-[color:var(--wt-accent)] group-hover:text-[color:var(--wt-accent-ink)] group-active:text-[color:var(--wt-accent-ink)]">
              {HERO_SCROLL_CUE}
            </span>
            <motion.span
              aria-hidden
              className="font-mono text-lg leading-none text-[color:var(--wt-accent)] group-hover:text-[color:var(--wt-accent-ink)] group-active:text-[color:var(--wt-accent-ink)]"
              {...(reduce
                ? {}
                : {
                    animate: { y: [0, 5, 0] },
                    transition: { duration: 1.35, repeat: Infinity, ease: 'easeInOut' },
                  })}
            >
              ↓
            </motion.span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
