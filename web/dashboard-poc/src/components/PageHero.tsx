import type { ReactNode } from 'react';
import { Plate } from './Plate';

/** Shared page chrome — Live header pattern for every POC page. */
export function PageHeader({
  group,
  title,
  sub,
  aside,
}: {
  group: string;
  title: string;
  sub: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-0.5">
      <div>
        <p className="wt-meta text-[color:var(--wt-accent)]">{group}</p>
        <h1 className="mt-2 wt-display text-[clamp(1.75rem,4vw,2.5rem)] text-[color:var(--wt-text)]">
          {title}
        </h1>
        <p className="mt-2 max-w-[48ch] text-[0.875rem] text-[color:var(--wt-text-mid)]">{sub}</p>
      </div>
      {aside ? <div className="flex flex-col items-end gap-3">{aside}</div> : null}
    </header>
  );
}

/**
 * Shared desk hero — Live Health | Signals plate.
 * Left: verdict. Right: signal list / secondary panel + optional CTA.
 */
export function DeskHero({
  label,
  title,
  titleColor,
  detail,
  sideLabel,
  side,
  sideClassName = 'bg-[color:var(--wt-bg0)]',
}: {
  label: string;
  title: ReactNode;
  titleColor?: string;
  detail: ReactNode;
  sideLabel: string;
  side: ReactNode;
  sideClassName?: string;
}) {
  return (
    <Plate className="grid gap-px overflow-hidden bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="bg-[color:var(--wt-bg1)] px-6 py-7 md:px-8 md:py-8">
        <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">{label}</p>
        <p
          className="mt-3 m-0 wt-display text-[clamp(2rem,5vw,3rem)] leading-none"
          style={titleColor ? { color: titleColor } : undefined}
        >
          {title}
        </p>
        <div className="mt-3 max-w-[36ch] text-[0.875rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          {detail}
        </div>
      </div>
      <div className={`${sideClassName} px-6 py-7 md:px-8 md:py-8`}>
        <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">{sideLabel}</p>
        {side}
      </div>
    </Plate>
  );
}

/** Border-left signal row used inside DeskHero side panels. */
export function DeskSignal({
  title,
  detail,
  toneColor: border,
}: {
  title: ReactNode;
  detail?: ReactNode;
  toneColor: string;
}) {
  return (
    <li className="border-l-2 pl-3" style={{ borderColor: border }}>
      <p className="m-0 text-[0.8125rem] font-semibold text-[color:var(--wt-text)]">{title}</p>
      {detail ? (
        <p className="mt-1 m-0 text-[0.75rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          {detail}
        </p>
      ) : null}
    </li>
  );
}
