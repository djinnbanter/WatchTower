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
          meta={`WatchTower · ${FAQ_PAGE.label} · ${count} answers`}
          title={FAQ_PAGE.title}
          lead={FAQ_PAGE.body}
        />

        <div className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <FaqLedger />
        </div>

        <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="bg-[color:var(--wt-bg1)] p-6 md:p-8">
            <FaqFoot />
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
