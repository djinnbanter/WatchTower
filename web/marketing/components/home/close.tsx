'use client';

import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { MagnetHit, useSpark } from '@/components/motion';
import {
  CLOSE_BODY,
  CLOSE_HEADLINE,
  CLOSE_LABEL,
  CLOSE_PRIMARY_CTA,
  CLOSE_SECONDARY_CTA,
  FOOTNOTE,
  LINKS,
} from '@/content/product';

export function HomeClose() {
  const { burst } = useSpark();

  return (
    <section
      id="close"
      className="wt-snap-panel relative flex min-h-0 flex-col border-t border-[color:var(--wt-line)] bg-transparent"
      aria-labelledby="close-title"
    >
      <div className="relative z-10 grid h-full min-h-0 flex-1 gap-px overflow-y-auto overscroll-y-contain bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex flex-col justify-center space-y-3 bg-[color:var(--wt-bg1)] p-5 md:space-y-4 md:p-8 lg:p-12">
          <p className="wt-meta text-[color:var(--wt-accent)]">[ 06 · {CLOSE_LABEL} ]</p>
          <h2
            id="close-title"
            className="wt-display max-w-[18ch] text-[clamp(1.75rem,6vw,3.5rem)] text-[color:var(--wt-text)]"
          >
            {CLOSE_HEADLINE}
          </h2>
        </div>
        <div className="flex flex-col justify-center gap-5 bg-[color:var(--wt-bg0)] p-5 md:gap-6 md:p-8 lg:p-12">
          <p className="max-w-[40ch] text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)] md:text-[0.975rem]">
            {CLOSE_BODY}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <MagnetHit>
              <span
                onPointerDown={(e) => burst(e.clientX, e.clientY, 'accent')}
                className="inline-flex w-full sm:w-auto"
              >
                <Cta
                  href={LINKS.modrinth}
                  withArrow
                  className="min-h-12 w-full sm:w-auto"
                  leading={<ModrinthMark className="h-3.5 w-3.5" />}
                >
                  {CLOSE_PRIMARY_CTA}
                </Cta>
              </span>
            </MagnetHit>
            <Cta href="/install" variant="ghost" className="min-h-12 w-full sm:w-auto">
              {CLOSE_SECONDARY_CTA}
            </Cta>
          </div>
          <p className="wt-meta text-[color:var(--wt-text-low)]">{FOOTNOTE}</p>
        </div>
      </div>
    </section>
  );
}
