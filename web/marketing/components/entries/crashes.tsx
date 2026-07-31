'use client';

import { useEffect, useRef } from 'react';
import { ProductDesk } from '@/components/desk/product-desk';
import { MarginNote } from '@/components/type/margin-note';
import { TourBrings } from '@/components/type/tour-brings';
import { ScanText, useSpark } from '@/components/motion';
import { ShiftEntry } from '@/components/shift-log/entry';
import { useLivePulse } from '@/components/shift-log/live-pulse-context';
import { useLogProgressContext } from '@/components/shift-log/use-log-progress';
import { nightById } from '@/content/night';
import { TOUR } from '@/content/product';

const meta = nightById('crashes');

export function CrashesEntry() {
  const { kill } = useLivePulse();
  const { activeId } = useLogProgressContext();
  const { burst } = useSpark();
  const fired = useRef(false);
  const deskRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeId === 'crashes' && !fired.current) {
      fired.current = true;
      kill();
      const el = deskRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        burst(rect.left + rect.width * 0.5, rect.top + rect.height * 0.28, 'danger');
      }
    }
  }, [activeId, kill, burst]);

  return (
    <ShiftEntry {...meta}>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <h2 className="wt-entry text-[color:var(--wt-text)]">
            <ScanText text="Crashes" active={activeId === 'crashes'} />
          </h2>
          <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {TOUR.crashes.capability}
          </p>
          <TourBrings items={TOUR.crashes.brings} />
          <MarginNote className="mt-5">{TOUR.crashes.note}</MarginNote>
        </div>

        <div ref={deskRef} className="min-w-0">
          <ProductDesk
            surface="crashes"
            cut="list"
            chrome="bare"
            pointerGlow="danger"
            className="w-full"
          />
        </div>
      </div>
    </ShiftEntry>
  );
}
