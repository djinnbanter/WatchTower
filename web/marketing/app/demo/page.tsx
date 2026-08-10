import type { Metadata } from 'next';
import { BoardFrame, BoardPageHeader } from '@/components/board';
import { Cta } from '@/components/cta';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { DEMO_PAGE } from '@/content/install';
import { DEMO_URL, LINKS, PAGE_META } from '@/content/product';

export const metadata: Metadata = {
  title: { absolute: PAGE_META.demo.title },
  description: PAGE_META.demo.description,
};

export default function DemoPage() {
  const demoConfigured = Boolean(process.env.NEXT_PUBLIC_DEMO_URL);

  return (
    <main>
      <BoardFrame ariaLabel="Demo board">
        <BoardPageHeader
          meta={`WatchTower · ${DEMO_PAGE.label}`}
          title={DEMO_PAGE.title}
          lead={DEMO_PAGE.body}
          right={
            <div className="flex flex-col gap-2.5">
              {demoConfigured ? (
                <Cta href={DEMO_URL} withArrow newTab className="w-full">
                  {DEMO_PAGE.primaryCta}
                </Cta>
              ) : (
                <p className="text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                  Demo hosting is not configured yet (`NEXT_PUBLIC_DEMO_URL`). Grab the jar from{' '}
                  <a
                    href={LINKS.modrinth}
                    className="text-[color:var(--wt-text)] underline-offset-2 hover:underline"
                  >
                    Modrinth
                  </a>{' '}
                  or{' '}
                  <a
                    href={LINKS.github}
                    className="text-[color:var(--wt-text)] underline-offset-2 hover:underline"
                  >
                    GitHub
                  </a>
                  .
                </p>
              )}
              <Cta
                href={LINKS.modrinth}
                variant="ghost"
                className="w-full"
                leading={<ModrinthMark className="h-3.5 w-3.5" />}
              >
                {DEMO_PAGE.secondaryCta}
              </Cta>
            </div>
          }
        />

        <section className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-5 md:p-8">
          <p className="wt-meta text-[color:var(--wt-accent)]">{DEMO_PAGE.noticeLabel}</p>
          <h2 className="mt-3 wt-display max-w-[22ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
            {DEMO_PAGE.noticeTitle}
          </h2>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
            {DEMO_PAGE.noticeBody}
          </p>
        </section>

        <div className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)]">
          <ul className="m-0 list-none p-0">
            {DEMO_PAGE.highlights.map((note, i) => (
              <li
                key={note.title}
                className={`grid gap-2 px-5 py-4 md:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] md:px-8 ${
                  i > 0 ? 'border-t border-[color:var(--wt-line)]' : ''
                }`}
              >
                <span className="font-medium text-[color:var(--wt-text)]">{note.title}</span>
                <span className="text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                  {note.body}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </BoardFrame>
    </main>
  );
}
