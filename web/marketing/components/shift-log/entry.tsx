'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { NightBand, NightLayout } from '@/content/night';
import { useLogProgressContext } from '@/components/shift-log/use-log-progress';

export function ShiftEntry({
  id,
  temp,
  band,
  layout,
  ambient,
  children,
}: {
  /** Tour entry id (home night ids or how-it-works ids). */
  id: string;
  stamp: string | null;
  railLabel: string;
  temp: 'cool' | 'hot';
  band: NightBand;
  layout: NightLayout;
  /** Full-band absolute layer (radar, dots). Sits on the li, not the content column. */
  ambient?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const { setEntryNode } = useLogProgressContext();

  useEffect(() => {
    setEntryNode(id, ref.current);
    return () => setEntryNode(id, null);
  }, [id, setEntryNode]);

  const pad =
    layout === 'bleed'
      ? 'py-20 md:py-28'
      : layout === 'close'
        ? 'py-20 md:py-28'
        : 'py-[4.5rem] md:py-24';

  return (
    <li
      ref={ref}
      id={id}
      data-entry-id={id}
      data-temp={temp}
      data-band={band}
      className={`wt-tour-band relative scroll-mt-24 ${pad}`}
    >
      {ambient ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          {ambient}
        </div>
      ) : null}
      <div className="wt-tour-band__rule relative z-[1]" aria-hidden>
        <span className="wt-tour-band__lantern" />
      </div>
      <div
        className={
          layout === 'bleed'
            ? 'relative z-[1] w-full'
            : 'relative z-[1] mx-auto w-full max-w-[84rem] px-5 md:px-8'
        }
      >
        {children}
      </div>
    </li>
  );
}
