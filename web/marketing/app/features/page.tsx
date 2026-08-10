import type { Metadata } from 'next';
import { BoardFrame, BoardPageHeader } from '@/components/board';
import { CapabilityCatalog } from '@/components/features/capability-catalog';
import { Cta } from '@/components/cta';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { FEATURE_PAGE } from '@/content/features';
import { DEMO_URL, LINKS, PAGE_META } from '@/content/product';

export const metadata: Metadata = {
  title: { absolute: PAGE_META.features.title },
  description: PAGE_META.features.description,
};

export default function FeaturesPage() {
  return (
    <main>
      <BoardFrame ariaLabel="Features board">
        <BoardPageHeader
          meta={`WatchTower · ${FEATURE_PAGE.label}`}
          title={FEATURE_PAGE.title}
          lead={FEATURE_PAGE.body}
        />

        <div className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)]">
          <CapabilityCatalog />
        </div>

        <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="bg-[color:var(--wt-bg1)] p-6 md:p-8">
            <p className="max-w-[40ch] text-base leading-relaxed text-[color:var(--wt-text-mid)]">
              Experience the complete WatchTower dashboard with real-time fake server data. No need
              to install or sign up.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 bg-[color:var(--wt-bg0)] p-6 md:p-8">
            <Cta href={DEMO_URL} withArrow newTab>
              Try the live demo
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
      </BoardFrame>
    </main>
  );
}
