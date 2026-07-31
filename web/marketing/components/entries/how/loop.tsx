'use client';

import { ProductDesk } from '@/components/desk/product-desk';
import { MarginNote } from '@/components/type/margin-note';
import { TourBrings } from '@/components/type/tour-brings';
import { ShiftEntry } from '@/components/shift-log/entry';
import { LoopPath } from '@/components/how/loop-path';
import { howNightById } from '@/content/how-night';
import { HOW } from '@/content/how-it-works';

const meta = howNightById('loop');

export function HowLoopEntry() {
  return (
    <ShiftEntry {...meta}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <h2 className="wt-entry text-[color:var(--wt-text)]">{HOW.loop.title}</h2>
          <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {HOW.loop.capability}
          </p>
          <TourBrings items={HOW.loop.brings} />
          <MarginNote className="mt-5">{HOW.loop.note}</MarginNote>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <LoopPath className="w-full" />
          <ProductDesk
            surface="issues"
            cut="bands"
            chrome="bare"
            pointerGlow="warn"
            className="w-full"
          />
        </div>
      </div>
    </ShiftEntry>
  );
}
