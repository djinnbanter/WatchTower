'use client';

import { InstrumentPlate } from '@/components/instrument-plate';

const RULES = [
  'Prefer localhost or an SSH tunnel.',
  'Do not expose 8787 to the open internet.',
  'Change the default login (watchtower / password).',
] as const;

/** Port callout for the Desk room. */
export function PortCallout({ className = '' }: { className?: string }) {
  return (
    <InstrumentPlate className={className} elevation="flat">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <div className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-low)]">
            Dashboard port
          </div>
          <div className="mt-2 font-mono text-[1.75rem] font-semibold tracking-tight text-[color:var(--wt-accent)]">
            :8787
          </div>
        </div>
        <ul className="m-0 list-none space-y-0 border-t border-[color:var(--wt-line)] p-0">
          {RULES.map((rule) => (
            <li
              key={rule}
              className="border-b border-[color:var(--wt-line)] py-3 text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)] last:border-b-0 last:pb-0"
            >
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </InstrumentPlate>
  );
}
