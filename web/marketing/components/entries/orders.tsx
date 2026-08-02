'use client';

import { InstrumentPlate } from '@/components/instrument-plate';
import { Reveal } from '@/components/reveal';
import { MarginNote } from '@/components/type/margin-note';
import { ShiftEntry } from '@/components/shift-log/entry';
import { NOT_OUR_JOB, PROMISES } from '@/content/product';

/** Kept for a future trust page - not on the home Shift Log. */
const meta = {
  id: 'orders',
  stamp: null,
  railLabel: 'Standing orders',
  temp: 'cool' as const,
  band: 'plate' as const,
  layout: 'ledger' as const,
  sources: ['PROMISES', 'NOT_OUR_JOB'],
};

/**
 * Standing orders: shared header, then a tight two-column ledger.
 * Promises and boundaries share a top edge so the room doesn't read empty.
 */
export function OrdersEntry() {
  return (
    <ShiftEntry {...meta}>
      <Reveal>
        <MarginNote className="mb-3">Field manual</MarginNote>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <h2 className="wt-entry max-w-[11ch] text-[color:var(--wt-text)]">Standing orders.</h2>
          <p className="max-w-[34ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)] sm:pb-1 sm:text-right">
            What we promise, and what we do not do.
          </p>
        </div>
      </Reveal>

      <div className="mt-8 grid items-start gap-8 border-t border-[color:var(--wt-line)] pt-8 lg:grid-cols-2 lg:gap-10">
        <ol className="m-0 list-none p-0">
          {PROMISES.map((p, i) => (
            <Reveal key={p.title} kind="lift" delay={0.04 + i * 0.05}>
              <li
                className={`grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 py-4 sm:gap-4 ${
                  i < PROMISES.length - 1 ? 'border-b border-[color:var(--wt-line)]' : ''
                }`}
              >
                <div className="flex items-center gap-2 pt-0.5">
                  <span
                    className="inline-block h-px w-3 shrink-0 bg-[color:var(--wt-lantern)]"
                    aria-hidden
                  />
                  <span className="font-mono text-[0.75rem] font-semibold tabular-nums tracking-[0.08em] text-[color:var(--wt-text-low)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[1.0625rem] font-semibold tracking-tight text-[color:var(--wt-text)]">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                    {p.body}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.1} className="min-w-0">
          <MarginNote className="mb-3">Boundaries</MarginNote>
          <InstrumentPlate>
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--wt-line)] px-4 py-3">
              <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
                We do not replace
              </span>
              <span className="hidden font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)] md:inline">
                Use instead
              </span>
            </div>
            <ul className="m-0 list-none p-0">
              {NOT_OUR_JOB.map((row, i) => (
                <li
                  key={row.weDont}
                  className={`grid gap-2 px-4 py-4 md:grid-cols-2 md:gap-4 ${
                    i < NOT_OUR_JOB.length - 1 ? 'border-b border-[color:var(--wt-line)]' : ''
                  }`}
                >
                  <div>
                    <div className="text-[0.9375rem] font-semibold tracking-tight text-[color:var(--wt-text)]">
                      {row.weDont}
                    </div>
                    <div className="mt-0.5 text-[0.8125rem] leading-snug text-[color:var(--wt-text-low)]">
                      {row.detail}
                    </div>
                  </div>
                  <div className="md:border-l md:border-[color:var(--wt-line)] md:pl-4">
                    <div className="mb-1 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-low)] md:hidden">
                      Use instead
                    </div>
                    <div className="text-[0.9375rem] leading-snug text-[color:var(--wt-text-mid)]">
                      {row.useInstead}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </InstrumentPlate>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-low)]">
            WatchTower sits beside your host panel. It does not try to be one.
          </p>
        </Reveal>
      </div>
    </ShiftEntry>
  );
}
