'use client';

import { MarginNote } from '@/components/type/margin-note';
import { TourBrings } from '@/components/type/tour-brings';
import { ShiftEntry } from '@/components/shift-log/entry';
import { CliPlate } from '@/components/how/cli-plate';
import { howNightById } from '@/content/how-night';
import { HOW } from '@/content/how-it-works';

const meta = howNightById('cli');

export function HowCliEntry() {
  return (
    <ShiftEntry {...meta}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <h2 className="wt-entry text-[color:var(--wt-text)]">{HOW.cli.title}</h2>
          <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {HOW.cli.capability}
          </p>
          <TourBrings items={HOW.cli.brings} />
          <MarginNote className="mt-5">{HOW.cli.note}</MarginNote>
        </div>
        <div className="min-w-0">
          <CliPlate className="w-full" />
        </div>
      </div>
    </ShiftEntry>
  );
}
