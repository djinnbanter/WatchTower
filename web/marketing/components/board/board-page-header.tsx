import type { ReactNode } from 'react';

/**
 * Inner-page board header: meta stamp, display title, lead, optional right slot.
 */
export function BoardPageHeader({
  meta,
  title,
  lead,
  right,
  as: TitleTag = 'h1',
}: {
  meta: string;
  title: string;
  lead?: ReactNode;
  right?: ReactNode;
  as?: 'h1' | 'h2';
}) {
  return (
    <div
      className={`grid gap-px bg-[color:var(--wt-line)] ${
        right ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]' : ''
      }`}
    >
      <div className="space-y-4 bg-[color:var(--wt-bg1)] px-5 py-6 md:px-8 md:py-8">
        <p className="wt-meta text-[color:var(--wt-text-low)]">{meta}</p>
        <TitleTag className="wt-display max-w-[16ch] text-[clamp(2rem,5vw,3.5rem)] text-[color:var(--wt-text)]">
          {title}
        </TitleTag>
        {lead ? (
          <div className="max-w-[52ch] text-base font-normal normal-case leading-relaxed tracking-normal text-[color:var(--wt-text-mid)]">
            {lead}
          </div>
        ) : null}
      </div>
      {right ? (
        <div className="flex flex-col justify-between gap-4 border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-5 py-6 lg:border-l lg:border-t-0 md:px-8 md:py-8">
          {right}
        </div>
      ) : null}
    </div>
  );
}
