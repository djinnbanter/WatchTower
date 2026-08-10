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
          lead={
            <div className="space-y-4">
              <p>{FEATURE_PAGE.body}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { label: 'Monitor', id: 'monitor' },
                  { label: 'Triage', id: 'triage' },
                  { label: 'Operations', id: 'operations' },
                  { label: 'System & Sharing', id: 'system-sharing' },
                ].map(({ label, id }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="inline-flex items-center gap-1.5 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-2.5 py-1 font-mono text-[0.75rem] uppercase tracking-[0.1em] text-[color:var(--wt-text-mid)] no-underline transition-colors duration-200 hover:border-[color:var(--wt-accent)] hover:text-[color:var(--wt-accent)]"
                  >
                    <span>{label}</span>
                    <span aria-hidden className="text-[color:var(--wt-accent)]">↓</span>
                  </a>
                ))}
              </div>
            </div>
          }
          right={
            <div className="flex flex-col justify-between gap-5 h-full">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-3.5">
                  <p className="wt-meta text-[color:var(--wt-accent)]">24 Tools</p>
                  <p className="mt-1 font-display text-lg leading-tight text-[color:var(--wt-text)] sm:text-xl">
                    4 Core Modules
                  </p>
                </div>
                <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-3.5">
                  <p className="wt-meta text-[color:var(--wt-ok)]">100% Local</p>
                  <p className="mt-1 font-display text-lg leading-tight text-[color:var(--wt-text)] sm:text-xl">
                    Zero Cloud
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Cta href={DEMO_URL} withArrow newTab className="flex-1 min-w-[130px]">
                  Live demo
                </Cta>
                <Cta
                  href={LINKS.modrinth}
                  variant="ghost"
                  leading={<ModrinthMark className="h-3.5 w-3.5" />}
                  className="flex-1 min-w-[130px]"
                >
                  Modrinth
                </Cta>
              </div>
            </div>
          }
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
