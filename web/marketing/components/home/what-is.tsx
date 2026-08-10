'use client';

import Link from 'next/link';
import { BoardSection } from '@/components/board';
import { InstrumentPlate } from '@/components/instrument-plate';
import { LiveGauges } from '@/components/home/live-gauges';
import { useLivePulse } from '@/components/shift-log/live-pulse-context';
import {
  HOME_OVERVIEW_CTA,
  WHAT_IS_FACTS,
  WHAT_IS_LABEL,
  WHAT_IS_LEAD,
  WHAT_IS_TITLE,
} from '@/content/product';

/**
 * Product boundary + live sample gauges in one snap panel.
 * Gauges mock is desktop-only — phones get facts + copy only.
 */
export function WhatIs() {
  const { alive } = useLivePulse();

  return (
    <BoardSection
      id="what"
      index={1}
      label={WHAT_IS_LABEL}
      title={WHAT_IS_TITLE}
      metaRight="on your host"
      lead={WHAT_IS_LEAD}
      fullViewport
    >
      <div className="grid min-h-0 flex-1 gap-px bg-[color:var(--wt-line)] lg:h-full lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <dl className="m-0 grid min-h-0 gap-px bg-[color:var(--wt-line)] sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
          {WHAT_IS_FACTS.map((fact) => (
            <div
              key={fact.label}
              className="bg-[color:var(--wt-bg1)] p-3 md:p-5 lg:flex lg:min-h-0 lg:flex-col lg:justify-center"
            >
              <dt className="wt-meta text-[color:var(--wt-accent)]">{fact.label}</dt>
              <dd className="mt-1.5 m-0 text-sm font-normal normal-case leading-snug tracking-normal text-[color:var(--wt-text-mid)] md:mt-2 md:leading-relaxed">
                {fact.detail}
              </dd>
            </div>
          ))}
        </dl>
        <div className="hidden min-h-0 flex-col bg-[color:var(--wt-bg0)] p-3 md:p-6 lg:flex lg:h-full">
          <p className="wt-meta mb-2 shrink-0 text-[color:var(--wt-text-low)] md:mb-3">
            Live · sample vitals · {alive ? 'drifting' : 'frozen'}
          </p>
          <InstrumentPlate className="min-h-0 flex-1">
            <div className="desk-surface flex h-full min-h-0 flex-col justify-center p-3 sm:p-5">
              <LiveGauges alive={alive} fill />
            </div>
          </InstrumentPlate>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wt-line)] px-4 py-2.5 md:px-6 md:py-3">
        <p className="wt-meta text-[color:var(--wt-text-low)]">Keep going</p>
        <Link
          href="#overview"
          className="wt-meta inline-flex min-h-11 items-center gap-2 text-[color:var(--wt-accent)] no-underline active:text-[color:var(--wt-text)] hover:text-[color:var(--wt-text)]"
        >
          {HOME_OVERVIEW_CTA}
          <span aria-hidden>↓</span>
        </Link>
      </div>
    </BoardSection>
  );
}
