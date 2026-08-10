import type { Metadata } from 'next';
import { BoardFrame, BoardPageHeader } from '@/components/board';
import { Cta } from '@/components/cta';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { FaqFoot, FaqLedger } from '@/components/faq/faq-ledger';
import { FAQ_ITEMS, FAQ_PAGE } from '@/content/faq';
import { DEMO_URL, LINKS, PAGE_META } from '@/content/product';

export const metadata: Metadata = {
  title: { absolute: PAGE_META.faq.title },
  description: PAGE_META.faq.description,
};

export default function FaqPage() {
  const count = String(FAQ_ITEMS.length).padStart(2, '0');

  return (
    <main>
      <BoardFrame ariaLabel="FAQ board">
        <BoardPageHeader
          meta={`WatchTower · ${FAQ_PAGE.label} · ${count} Answers`}
          title={FAQ_PAGE.title}
          lead={
            <div className="space-y-4">
              <p>{FAQ_PAGE.body}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs text-[color:var(--wt-text-low)]">
                <span>/// TOPICS:</span>
                <span className="text-[color:var(--wt-text-mid)]">DATA PRIVACY</span>
                <span>•</span>
                <span className="text-[color:var(--wt-text-mid)]">RESTARTS</span>
                <span>•</span>
                <span className="text-[color:var(--wt-text-mid)]">PERFORMANCE</span>
                <span>•</span>
                <span className="text-[color:var(--wt-text-mid)]">CLI RECOVERY</span>
              </div>
            </div>
          }
          right={
            <div className="flex flex-col justify-between gap-5 h-full">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-3.5">
                  <p className="wt-meta text-[color:var(--wt-accent)]">Knowledge Base</p>
                  <p className="mt-1 font-display text-lg leading-tight text-[color:var(--wt-text)] sm:text-xl">
                    {count} Answers
                  </p>
                </div>
                <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-ok)]/20 border-[color:var(--wt-ok)]/40 p-3.5">
                  <p className="wt-meta text-[color:var(--wt-ok)]">License</p>
                  <p className="mt-1 font-display text-lg leading-tight text-[color:var(--wt-text)] sm:text-xl">
                    GPL-3.0
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

        <div className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <FaqLedger />
        </div>

        <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="bg-[color:var(--wt-bg1)] p-6 md:p-8">
            <FaqFoot />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 bg-[color:var(--wt-bg0)] p-6 md:p-8">
            <Cta href={LINKS.wiki} newTab className="flex-1 min-w-[130px]">
              Explore Wiki
            </Cta>
            <Cta
              href={`${LINKS.github}/issues`}
              variant="ghost"
              newTab
              className="flex-1 min-w-[130px]"
            >
              GitHub Issues
            </Cta>
          </div>
        </div>
      </BoardFrame>
    </main>
  );
}
