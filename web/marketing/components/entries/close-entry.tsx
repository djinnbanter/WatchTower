'use client';

import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { MarginNote } from '@/components/type/margin-note';
import { Reveal } from '@/components/reveal';
import { DeskShapeGrid, MagnetHit, useSpark } from '@/components/motion';
import { ShiftEntry } from '@/components/shift-log/entry';
import { nightById } from '@/content/night';
import { DEMO_URL, CLOSE_BODY, CLOSE_HEADLINE, FOOTNOTE, LINKS } from '@/content/product';

const meta = nightById('close');

/** Soft night echo — zenith + lantern, no grass / no full star field. */
function CloseAmbient() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(36rem 18rem at 50% 120%, var(--wt-zenith), transparent 55%), radial-gradient(36rem 20rem at 12% 100%, var(--wt-glow-lantern), transparent 62%), radial-gradient(28rem 16rem at 88% 0%, var(--wt-glow-accent), transparent 58%)',
        }}
      />
      <DeskShapeGrid />
    </>
  );
}

export function CloseEntry() {
  const { burst } = useSpark();

  return (
    <ShiftEntry {...meta} ambient={<CloseAmbient />}>
      <div className="relative z-[1] grid items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
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
    </ShiftEntry>
  );
}
