import type { Metadata } from 'next';
import { CapabilityCatalog } from '@/components/features/capability-catalog';
import { Cta } from '@/components/cta';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { FEATURE_LEDE } from '@/content/features';
import { DEMO_URL, LINKS } from '@/content/product';

export const metadata: Metadata = { title: 'Features' };

export default function FeaturesPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-[84rem] px-5 pb-10 pt-20 md:px-8 md:pb-12 md:pt-28">
        <h1 className="wt-display-sm max-w-[16ch] text-[color:var(--wt-text)] text-balance">
          Features
        </h1>
        <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          {FEATURE_LEDE}
        </p>
      </section>

      <section
        aria-label="Capability catalog"
        className="mx-auto w-full max-w-[84rem] px-5 pb-16 md:px-8 md:pb-20"
      >
        <CapabilityCatalog />
      </section>

      <section className="border-t border-[color:var(--wt-line)] py-16 md:py-20">
        <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-6 px-5 md:flex-row md:items-end md:justify-between md:px-8">
          <p className="max-w-[40ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            Open the demo on sample data, or get the jar on Modrinth.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Cta href={DEMO_URL} withArrow newTab>
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
      </section>
    </main>
  );
}
