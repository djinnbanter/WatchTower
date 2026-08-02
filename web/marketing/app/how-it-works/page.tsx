import type { Metadata } from 'next';
import { Pipeline } from '@/components/how/pipeline';
import { HowClose } from '@/components/how/how-close';
import { HOW_LEDE } from '@/content/how';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorksPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-[84rem] px-5 pb-10 pt-20 md:px-8 md:pb-12 md:pt-28">
        <h1 className="wt-display-sm max-w-[14ch] text-[color:var(--wt-text)] text-balance">
          How it works
        </h1>
        <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          {HOW_LEDE}
        </p>
      </section>

      <section
        aria-label="Mechanism pipeline"
        className="mx-auto w-full max-w-[84rem] px-5 pb-20 md:px-8 md:pb-28"
      >
        <Pipeline />
      </section>

      <HowClose />
    </main>
  );
}