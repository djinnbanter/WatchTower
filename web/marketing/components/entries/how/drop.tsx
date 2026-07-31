'use client';

import Link from 'next/link';
import { MarginNote } from '@/components/type/margin-note';
import { TourBrings } from '@/components/type/tour-brings';
import { ShiftEntry } from '@/components/shift-log/entry';
import { ModsPlate } from '@/components/how/mods-plate';
import { howNightById } from '@/content/how-night';
import { HOW } from '@/content/how-it-works';
import { LINKS } from '@/content/product';

const meta = howNightById('drop');

export function HowDropEntry() {
  return (
    <ShiftEntry {...meta}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <h1 className="wt-entry text-[color:var(--wt-text)]">{HOW.drop.title}</h1>
          <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {HOW.drop.capability}
          </p>
          <TourBrings items={HOW.drop.brings} />
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href="/install"
              className="text-[0.9375rem] font-medium text-[color:var(--wt-text)] underline-offset-2 hover:underline"
            >
              Install steps
            </Link>
            <a
              href={LINKS.modrinth}
              className="text-[0.9375rem] font-medium text-[color:var(--wt-text)] underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Modrinth
            </a>
            <a
              href={LINKS.wikiInstall}
              className="text-[0.9375rem] font-medium text-[color:var(--wt-text-mid)] underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Installation wiki
            </a>
          </div>
          <MarginNote className="mt-5">{HOW.drop.note}</MarginNote>
        </div>
        <div className="min-w-0">
          <ModsPlate className="w-full" />
        </div>
      </div>
    </ShiftEntry>
  );
}
