'use client';

import { MarginNote } from '@/components/type/margin-note';
import { TourBrings } from '@/components/type/tour-brings';
import { ShiftEntry } from '@/components/shift-log/entry';
import { DiskTree } from '@/components/how/disk-tree';
import { howNightById } from '@/content/how-night';
import { HOW } from '@/content/how-it-works';

const meta = howNightById('disk');

export function HowDiskEntry() {
  return (
    <ShiftEntry {...meta}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <h2 className="wt-entry text-[color:var(--wt-text)]">{HOW.disk.title}</h2>
          <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {HOW.disk.capability}
          </p>
          <TourBrings items={HOW.disk.brings} />
          <MarginNote className="mt-5">{HOW.disk.note}</MarginNote>
        </div>
        <div className="min-w-0">
          <DiskTree className="w-full" />
        </div>
      </div>
    </ShiftEntry>
  );
}
