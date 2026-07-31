'use client';

import { InstrumentPlate } from '@/components/instrument-plate';

/** Quiet mods-folder plate for the Drop room. */
export function ModsPlate({ className = '' }: { className?: string }) {
  return (
    <InstrumentPlate className={className} elevation="flat">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-low)]">
          mods/
        </div>
        <code className="break-all font-mono text-[0.9375rem] font-medium leading-relaxed text-[color:var(--wt-text)]">
          mods/watchtower-*.jar
        </code>
        <p className="m-0 text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          Restart the dedicated server once after the jar is in place.
        </p>
      </div>
    </InstrumentPlate>
  );
}
