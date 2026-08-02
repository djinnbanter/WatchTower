'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { MarginNote } from '@/components/type/margin-note';
import { Reveal } from '@/components/reveal';
import { ShiftEntry } from '@/components/shift-log/entry';
import { useLivePulse } from '@/components/shift-log/live-pulse-context';
import { MagnetHit, useSpark } from '@/components/motion';
import { nightById } from '@/content/night';
import {
  DEMO_URL,
  HERO_CONTEXT,
  HERO_OVERVIEW,
  LINKS,
  SCROLL_CUE,
  TAGLINE,
} from '@/content/product';

const meta = nightById('welcome');

/** Quiet page wash — soft Signal Blue radial, no canvas / no drift. */
function WelcomeAmbient() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 70% 55% at 12% 18%, color-mix(in srgb, var(--wt-accent) 7%, transparent), transparent 70%)',
      }}
    />
  );
}

export function WelcomeEntry() {
  const { alive } = useLivePulse();
  const reduce = useReducedMotion();
  const { burst } = useSpark();

  return (
    <ShiftEntry {...meta} ambient={<WelcomeAmbient />}>
      <div className="relative z-[1] min-w-0 max-w-[42rem]">
        <div className="mb-4 flex items-center gap-2">
          <motion.span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${
              alive ? 'bg-[color:var(--wt-ok)]' : 'bg-[color:var(--wt-text-low)]'
            }`}
            animate={alive && !reduce ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
            transition={
              alive && !reduce
                ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
                : undefined
            }
          />
          <MarginNote>{alive ? 'Live · watching' : 'Process stopped'}</MarginNote>
        </div>

        <Reveal>
          <h1 className="wt-hero text-[color:var(--wt-text)]">WatchTower</h1>
          <p className="wt-lead mt-5 max-w-[38ch]">{TAGLINE}</p>
          <p className="mt-4 max-w-[42ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {HERO_OVERVIEW}
          </p>
        </Reveal>
        <MarginNote className="mt-5 normal-case tracking-[0.08em]">{HERO_CONTEXT}</MarginNote>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <MagnetHit>
            <span
              onPointerDown={(e) => burst(e.clientX, e.clientY, 'accent')}
              className="inline-flex"
            >
              <Cta href={DEMO_URL} withArrow newTab>
                Open the demo
              </Cta>
            </span>
          </MagnetHit>
          <Cta
            href={LINKS.modrinth}
            variant="ghost"
            leading={<ModrinthMark className="h-3.5 w-3.5" />}
          >
            Get it on Modrinth
          </Cta>
        </div>

        <Link
          href="#live"
          className="mt-8 inline-flex items-center gap-2 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-mid)] transition-colors hover:text-[color:var(--wt-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wt-accent)]"
        >
          {SCROLL_CUE}
          <span aria-hidden className="text-[color:var(--wt-lantern)]">
            ↓
          </span>
        </Link>
      </div>
    </ShiftEntry>
  );
}
