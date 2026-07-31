import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { InstrumentPlate } from '@/components/instrument-plate';
import { Reveal } from '@/components/reveal';
import { CLOSE_BODY, CLOSE_HEADLINE, DEMO_URL, LINKS } from '@/content/product';

/** Full-width CTA tray: title left, support + actions right - matched section scale. */
export function Close() {
  return (
    <section className="border-t border-[color:var(--wt-line)] py-16 md:py-24">
      <div className="mx-auto w-full max-w-[84rem] px-4 md:px-5 lg:px-8">
        <Reveal kind="lift">
          <InstrumentPlate>
            <div className="relative overflow-hidden px-5 py-10 md:px-10 md:py-12 lg:px-12">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(36rem 20rem at 12% 100%, var(--wt-glow-lantern), transparent 62%), radial-gradient(28rem 16rem at 88% 0%, var(--wt-glow-accent), transparent 58%)',
                }}
              />
              <div className="relative grid gap-8 md:grid-cols-2 md:items-center md:gap-10 lg:gap-14">
                <h2 className="wt-display-sm max-w-[18ch] text-[color:var(--wt-text)]">
                  {CLOSE_HEADLINE}
                </h2>
                <div className="flex flex-col gap-5 md:gap-6">
                  <p className="max-w-[42ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)] text-balance md:text-[1.125rem]">
                    {CLOSE_BODY}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <Cta href={DEMO_URL} withArrow>
                      Open the demo
                    </Cta>
                    <Cta
                      href={LINKS.modrinth}
                      variant="ghost"
                      leading={<ModrinthMark className="h-3.5 w-3.5" />}
                    >
                      Get it on Modrinth
                    </Cta>
                  </div>
                </div>
              </div>
            </div>
          </InstrumentPlate>
        </Reveal>
      </div>
    </section>
  );
}
