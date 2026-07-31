'use client';

import { InstrumentPlate } from '@/components/instrument-plate';

const STEPS = [
  'Account',
  'Options',
  'Initial discovery',
  'Backups',
  'Security',
] as const;

/** First-run step strip. Current step gets a Signal Blue mark (no fake form UI). */
export function WizardSteps({
  current = 0,
  className = '',
}: {
  /** 0-based index of the highlighted step. */
  current?: number;
  className?: string;
}) {
  return (
    <InstrumentPlate className={className} elevation="flat">
      <ol className="m-0 list-none p-5 sm:p-6">
        {STEPS.map((label, i) => {
          const active = i === current;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 border-b border-[color:var(--wt-line)] py-3.5 last:border-b-0 last:pb-0 first:pt-0 ${
                active ? '' : ''
              }`}
            >
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 ${
                  active
                    ? 'bg-[color:var(--wt-accent)]'
                    : 'bg-[color:var(--wt-bg3)]'
                }`}
                style={{ borderRadius: 'var(--wt-radius-sm)' }}
              />
              <span
                className={`text-[0.9375rem] leading-snug ${
                  active
                    ? 'font-semibold text-[color:var(--wt-text)]'
                    : 'text-[color:var(--wt-text-mid)]'
                }`}
              >
                {label}
              </span>
              {active ? (
                <span className="ml-auto font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-accent)]">
                  now
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </InstrumentPlate>
  );
}
