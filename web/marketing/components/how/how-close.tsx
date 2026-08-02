'use client';

import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { MarginNote } from '@/components/type/margin-note';
import { Reveal } from '@/components/reveal';
import { DeskShapeGrid, MagnetHit, SparkProvider, useSpark } from '@/components/motion';
import { DEMO_URL, CLOSE_BODY, CLOSE_HEADLINE, FOOTNOTE, LINKS } from '@/content/product';

function HowCloseInner() {
  const { burst } = useSpark();

  return (
    <div className="relative overflow-hidden border-t border-[color:var(--wt-line)] py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <DeskShapeGrid />
      </div>
      <div className="relative z-[1] mx-auto grid w-full max-w-[84rem] items-end gap-10 px-5 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
        <Reveal>
          <MarginNote className="mb-5 text-[0.8125rem]">End of shift</MarginNote>
          <h2 className="wt-display max-w-[16ch] text-[color:var(--wt-text)]">
            {CLOSE_HEADLINE}
          </h2>
        </Reveal>

        <Reveal delay={0.06} className="min-w-0">
          <p className="max-w-[40ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {CLOSE_BODY}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <MagnetHit>
              <span
                onPointerDown={(e) => burst(e.clientX, e.clientY, 'accent')}
                className="inline-flex"
              >
                <Cta href={DEMO_URL} withArrow newTab>
                  Open the demo
                </Cta>
              </span>
            </MagnetHit>
            <Cta
              href={LINKS.modrinth}
              variant="ghost"
              leading={<ModrinthMark className="h-3.5 w-3.5" />}
            >
              Get it on Modrinth
            </Cta>
          </div>
          <p className="mt-8 max-w-[46ch] font-mono text-[0.75rem] leading-relaxed text-[color:var(--wt-text-low)]">
            {FOOTNOTE}
          </p>
        </Reveal>
      </div>
    </div>
  );
}

export function HowClose() {
  return (
    <SparkProvider>
      <HowCloseInner />
    </SparkProvider>
  );
}
