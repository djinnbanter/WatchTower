'use client';

import { InstrumentPlate } from '@/components/instrument-plate';

const NODES = [
  { name: 'watchtower/', kind: 'dir' as const },
  { name: 'ops-cache/', kind: 'child' as const },
  { name: 'state/', kind: 'child' as const },
  { name: 'spark/', kind: 'child' as const },
  { name: 'support/', kind: 'child' as const },
];

/** Compact on-disk tree for the watchtower/ folder. */
export function DiskTree({ className = '' }: { className?: string }) {
  return (
    <InstrumentPlate className={className} elevation="flat">
      <ul className="m-0 list-none p-5 font-mono text-[0.9375rem] sm:p-6">
        {NODES.map((n) => (
          <li
            key={n.name}
            className={`border-b border-[color:var(--wt-line)] py-2.5 last:border-b-0 last:pb-0 first:pt-0 ${
              n.kind === 'child' ? 'pl-5 text-[color:var(--wt-text-mid)]' : 'font-semibold text-[color:var(--wt-text)]'
            }`}
          >
            {n.name}
          </li>
        ))}
      </ul>
    </InstrumentPlate>
  );
}
