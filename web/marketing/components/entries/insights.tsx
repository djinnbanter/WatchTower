'use client';

import { ProductDesk } from '@/components/desk/product-desk';
import { EveningChart } from '@/components/evening-chart';
import { DeskSpotlight } from '@/components/motion/desk-spotlight';
import { Reveal } from '@/components/reveal';
import { MarginNote } from '@/components/type/margin-note';
import { TourBrings } from '@/components/type/tour-brings';
import { ShiftEntry } from '@/components/shift-log/entry';
import { nightById } from '@/content/night';
import { TOUR } from '@/content/product';

const meta = nightById('insights');

export function InsightsEntry() {
  return (
    <ShiftEntry {...meta}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <h2 className="wt-entry text-[color:var(--wt-text)]">Insights</h2>
          <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {TOUR.insights.capability}
          </p>
          <TourBrings items={TOUR.insights.brings} />
          <MarginNote className="mt-5">{TOUR.insights.note}</MarginNote>
        </div>

        <div className="min-w-0 space-y-4">
          <Reveal>
            <DeskSpotlight tone="accent">
              <EveningChart variant="panel" />
            </DeskSpotlight>
          </Reveal>
          <Reveal delay={0.06}>
            <ProductDesk
              surface="insights"
              cut="list"
              chrome="bare"
              compact
              pointerGlow="accent"
              className="w-full"
            />
          </Reveal>
        </div>
      </div>
    </ShiftEntry>
  );
}
