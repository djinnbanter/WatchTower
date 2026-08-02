'use client';

import { ProductDesk } from '@/components/desk/product-desk';
import { MarginNote } from '@/components/type/margin-note';
import { TourBrings } from '@/components/type/tour-brings';
import { ShiftEntry } from '@/components/shift-log/entry';
import { nightById } from '@/content/night';
import { TOUR } from '@/content/product';

const meta = nightById('issues');

export function IssuesEntry() {
  return (
    <ShiftEntry {...meta}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <h2 className="wt-entry text-[color:var(--wt-text)]">Issues</h2>
          <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {TOUR.issues.capability}
          </p>
          <TourBrings items={TOUR.issues.brings} />
          <MarginNote className="mt-5">{TOUR.issues.note}</MarginNote>
        </div>

        <div className="min-w-0">
          <ProductDesk surface="issues" cut="bands" chrome="bare" pointerGlow="warn" className="w-full" />
        </div>
      </div>
    </ShiftEntry>
  );
}
