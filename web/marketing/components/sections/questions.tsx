import { ProductDesk } from '@/components/desk/product-desk';
import { Reveal } from '@/components/reveal';
import { TWO_QUESTIONS } from '@/content/product';

/**
 * Layout family: full-bleed diptych with distinct desk cuts.
 * Q1 = mission + vitals (bar chrome). Q2 = issues bands (bare chrome).
 * Not the same visual card as the hero Overview rail.
 */
export function Questions() {
  return (
    <section className="wt-graticule border-y border-[color:var(--wt-line)]">
      <div className="mx-auto grid max-w-[84rem] md:grid-cols-2">
        <Reveal
          delay={0}
          className="border-b border-[color:var(--wt-line)] px-5 py-10 md:border-b-0 md:border-r lg:px-8 lg:py-12"
        >
          <h2 className="wt-display-sm max-w-md text-[color:var(--wt-text)]">
            {TWO_QUESTIONS[0].q}
          </h2>
          <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {TWO_QUESTIONS[0].detail}
          </p>
          <div className="mt-6">
            <ProductDesk surface="overview" cut="mission" chrome="bar" />
          </div>
        </Reveal>
        <Reveal delay={0.06} className="px-5 py-10 lg:px-8 lg:py-12">
          <h2 className="wt-display-sm max-w-md text-[color:var(--wt-text)]">
            {TWO_QUESTIONS[1].q}
          </h2>
          <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {TWO_QUESTIONS[1].detail}
          </p>
          <div className="mt-6">
            <ProductDesk surface="issues" cut="bands" chrome="bare" compact />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
