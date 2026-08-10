import type { Metadata } from 'next';
import Link from 'next/link';
import { BoardFrame, BoardPageHeader } from '@/components/board';
import { Pipeline } from '@/components/how/pipeline';
import { HowClose } from '@/components/how/how-close';
import {
  HOW_COMPANIONS,
  HOW_FIRST_RUN,
  HOW_LAYERS,
  HOW_PAGE,
  HOW_SAFETY,
} from '@/content/how';
import { PAGE_META, LINKS } from '@/content/product';

export const metadata: Metadata = {
  title: { absolute: PAGE_META.how.title },
  description: PAGE_META.how.description,
};

export default function HowItWorksPage() {
  return (
    <main>
      <BoardFrame ariaLabel="How it works board">
        <BoardPageHeader
          meta={`WatchTower · ${HOW_PAGE.label}`}
          title={HOW_PAGE.title}
          lead={HOW_PAGE.body}
        />

        <div className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <Pipeline />
        </div>

        <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] md:grid-cols-3">
          {HOW_LAYERS.map((layer) => (
            <article key={layer.id} className="bg-[color:var(--wt-bg0)] p-5 md:p-6">
              <p className="wt-meta text-[color:var(--wt-accent)]">{layer.label}</p>
              <h2 className="mt-3 wt-display max-w-[22ch] text-[clamp(1.25rem,2.5vw,1.75rem)] text-[color:var(--wt-text)]">
                {layer.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                {layer.body}
              </p>
              <p className="wt-meta mt-4 text-[color:var(--wt-text-low)]">{layer.note}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] lg:grid-cols-2">
          <article className="bg-[color:var(--wt-bg1)] p-5 md:p-8">
            <p className="wt-meta text-[color:var(--wt-accent)]">{HOW_FIRST_RUN.label}</p>
            <h2 className="mt-3 wt-display max-w-[22ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
              {HOW_FIRST_RUN.title}
            </h2>
            <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
              {HOW_FIRST_RUN.body}
            </p>
            <Link
              href="/install"
              className="wt-meta mt-5 inline-flex text-[color:var(--wt-accent)] no-underline hover:text-[color:var(--wt-text)]"
            >
              {HOW_FIRST_RUN.cta}
            </Link>
          </article>

          <article className="bg-[color:var(--wt-bg0)] p-5 md:p-8">
            <p className="wt-meta text-[color:var(--wt-accent)]">{HOW_COMPANIONS.label}</p>
            <h2 className="mt-3 wt-display max-w-[22ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
              {HOW_COMPANIONS.title}
            </h2>
            <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
              {HOW_COMPANIONS.body}
            </p>
            <ul className="mt-5 m-0 list-none space-y-4 p-0">
              {HOW_COMPANIONS.items.map((item) => (
                <li key={item.title}>
                  <p className="font-medium text-[color:var(--wt-text)]">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-5 md:p-8">
          <p className="wt-meta text-[color:var(--wt-accent)]">{HOW_SAFETY.label}</p>
          <h2 className="mt-3 wt-display max-w-[18ch] text-[clamp(1.5rem,3vw,2.25rem)] text-[color:var(--wt-text)]">
            {HOW_SAFETY.title}
          </h2>
          <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-[color:var(--wt-text-mid)]">
            {HOW_SAFETY.body}
          </p>
          <Link
            href={LINKS.wikiInstall}
            className="wt-meta mt-5 inline-flex text-[color:var(--wt-accent)] no-underline hover:text-[color:var(--wt-text)]"
          >
            {HOW_PAGE.cta}
          </Link>
        </div>

        <HowClose />
      </BoardFrame>
    </main>
  );
}
