'use client';

import { InstrumentPlate } from '@/components/instrument-plate';

const FILES = [
  { name: 'facts.json', note: 'Redacted' },
  { name: 'brief.md', note: 'Plain English' },
  { name: 'evidence/', note: 'Logs + crashes' },
] as const;

/** Compact support-pack peek - no DeskSurface exists for Support, so this is hand-built. */
export function SupportPeek({ className = '' }: { className?: string }) {
  return (
    <InstrumentPlate className={className} elevation="flat">
      <div className="desk-surface">
        <div className="desk-support-peek">
          <div className="desk-support-peek__head">
            <span className="desk-support-peek__title">Support pack</span>
            <span className="desk-support-peek__status">Ready</span>
          </div>
          <ul className="desk-support-peek__list">
            {FILES.map((f) => (
              <li key={f.name} className="desk-support-peek__row">
                <span className="desk-support-peek__file">{f.name}</span>
                <span className="desk-support-peek__note">{f.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </InstrumentPlate>
  );
}
