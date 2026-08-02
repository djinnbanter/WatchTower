import { InstrumentPlate } from '@/components/instrument-plate';
import { Reveal } from '@/components/reveal';
import { PROMISES } from '@/content/product';

/**
 * One nested plate, 2×2 hairline cells.
 * Avoids four floating cards with icon wells and stacked shadows.
 */
export function Promises() {
  return (
    <section className="border-t border-[color:var(--wt-line)] py-16 md:py-24">
      <div className="mx-auto w-full max-w-[84rem] px-4 md:px-5 lg:px-8">
        <h2 className="wt-display-sm max-w-2xl text-[color:var(--wt-text)]">
          Promises that don't change.
        </h2>

        <Reveal kind="lift" className="mt-8 md:mt-10">
          <InstrumentPlate>
            <div className="grid gap-px bg-[color:var(--wt-line)] md:grid-cols-2">
              {PROMISES.map((p) => (
                <div
                  key={p.title}
                  className="flex min-h-[11.5rem] flex-col bg-[color:var(--wt-bg1)] p-5 md:min-h-[12.5rem] md:p-7"
                >
                  <div
                    className="mb-4 h-px w-8 bg-[color:var(--wt-lantern)]"
                    aria-hidden
                  />
                  <h3 className="text-[1.0625rem] font-semibold tracking-tight text-[color:var(--wt-text)]">
                    {p.title}
                  </h3>
                  <p className="mt-2.5 max-w-[42ch] flex-1 text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </InstrumentPlate>
        </Reveal>
      </div>
    </section>
  );
}
