import type { Metadata } from 'next';
import { BoardFrame, BoardPageHeader } from '@/components/board';
import { Pipeline } from '@/components/how/pipeline';
import { HowClose } from '@/components/how/how-close';
import { Cta } from '@/components/cta';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import {
  HOW_COMPANIONS,
  HOW_FIRST_RUN,
  HOW_LAYERS,
  HOW_PAGE,
  HOW_SAFETY,
} from '@/content/how';
import { PAGE_META, LINKS, DEMO_URL } from '@/content/product';

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
          lead={
            <div className="space-y-4">
              <p>{HOW_PAGE.body}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { label: 'Collect', id: 'how-collect' },
                  { label: 'Understand', id: 'how-understand' },
                  { label: 'Advise', id: 'how-advise' },
                  { label: 'Safety Guarantee', id: 'how-safety' },
                ].map(({ label, id }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="inline-flex items-center gap-1.5 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-2.5 py-1 font-mono text-[0.75rem] uppercase tracking-[0.1em] text-[color:var(--wt-text-mid)] no-underline transition-colors duration-200 hover:border-[color:var(--wt-accent)] hover:text-[color:var(--wt-accent)]"
                  >
                    <span>{label}</span>
                    <span aria-hidden className="text-[color:var(--wt-accent)]">
                      ↓
                    </span>
                  </a>
                ))}
              </div>
            </div>
          }
          right={
            <div className="flex flex-col justify-between gap-5 h-full">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-3.5">
                  <p className="wt-meta text-[color:var(--wt-accent)]">Pipeline</p>
                  <p className="mt-1 font-display text-lg leading-tight text-[color:var(--wt-text)] sm:text-xl">
                    3 Active Stages
                  </p>
                </div>
                <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-3.5">
                  <p className="wt-meta text-[color:var(--wt-ok)]">Lightweight</p>
                  <p className="mt-1 font-display text-lg leading-tight text-[color:var(--wt-text)] sm:text-xl">
                    &lt; 1% Overhead
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Cta href={DEMO_URL} withArrow newTab className="flex-1 min-w-[130px]">
                  Live demo
                </Cta>
                <Cta href="/install" variant="ghost" className="flex-1 min-w-[130px]">
                  Setup guide
                </Cta>
              </div>
            </div>
          }
        />

        {/* Interactive Pipeline Visual */}
        <div className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <div className="mb-6 flex items-center justify-between border-b border-[color:var(--wt-line)] pb-3">
            <div>
              <p className="wt-meta text-[color:var(--wt-accent)]">Architecture Overview</p>
              <h2 className="mt-1 font-display text-xl uppercase tracking-tight text-[color:var(--wt-text)] md:text-2xl">
                The WatchTower Event &amp; Triage Engine
              </h2>
            </div>
            <span className="hidden font-mono text-xs uppercase tracking-widest text-[color:var(--wt-text-low)] md:inline-block">
              [ REAL-TIME DIAGNOSTIC FLOW ]
            </span>
          </div>
          <Pipeline />
        </div>

        {/* 3-Layer Deep Dive Cards */}
        <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] md:grid-cols-3">
          {HOW_LAYERS.map((layer, idx) => (
            <article
              key={layer.id}
              className="group relative flex flex-col justify-between bg-[color:var(--wt-bg1)] p-6 transition-colors duration-200 hover:bg-[color:var(--wt-bg0)] md:p-7"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-accent)]">
                    {layer.label}
                  </span>
                  <span className="font-mono text-xs font-bold text-[color:var(--wt-text-low)]">
                    0{idx + 1}
                  </span>
                </div>
                <h3 className="font-display text-xl uppercase leading-snug tracking-tight text-[color:var(--wt-text)]">
                  {layer.title}
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                  {layer.body}
                </p>
              </div>
              <div className="mt-6 border-t border-[color:var(--wt-line)] pt-3">
                <p className="font-mono text-[0.75rem] leading-normal text-[color:var(--wt-text-low)]">
                  <span className="text-[color:var(--wt-accent)]">///</span> {layer.note}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* First Time Use & Integrations */}
        <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] lg:grid-cols-2">
          <article className="flex flex-col justify-between bg-[color:var(--wt-bg1)] p-6 md:p-8">
            <div>
              <span className="wt-meta text-[color:var(--wt-accent)]">{HOW_FIRST_RUN.label}</span>
              <h2 className="mt-2 wt-display max-w-[20ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
                {HOW_FIRST_RUN.title}
              </h2>
              <p className="mt-3 max-w-[50ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                {HOW_FIRST_RUN.body}
              </p>

              {/* Terminal Preview Card */}
              <div className="mt-6 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-4 font-mono text-xs">
                <div className="mb-2 flex items-center justify-between border-b border-[color:var(--wt-line)] pb-2">
                  <span className="text-[color:var(--wt-text-low)]">INITIAL WIZARD URL</span>
                  <span className="text-[color:var(--wt-ok)]">PORT 8787</span>
                </div>
                <div className="flex items-center gap-2 text-[color:var(--wt-text)]">
                  <span className="text-[color:var(--wt-accent)]">$</span>
                  <span>http://your-server-ip:8787</span>
                </div>
                <p className="mt-2 text-[0.75rem] text-[color:var(--wt-text-low)]">
                  Set password → Verify backup paths → Lock down security posture.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Cta href="/install" withArrow size="sm">
                {HOW_FIRST_RUN.cta}
              </Cta>
            </div>
          </article>

          <article className="flex flex-col justify-between bg-[color:var(--wt-bg0)] p-6 md:p-8">
            <div>
              <span className="wt-meta text-[color:var(--wt-accent)]">{HOW_COMPANIONS.label}</span>
              <h2 className="mt-2 wt-display max-w-[22ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
                {HOW_COMPANIONS.title}
              </h2>
              <p className="mt-3 max-w-[50ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                {HOW_COMPANIONS.body}
              </p>

              <div className="mt-6 space-y-3">
                {HOW_COMPANIONS.items.map((item) => (
                  <div
                    key={item.title}
                    className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 bg-[color:var(--wt-accent)]" />
                      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[color:var(--wt-text)]">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[color:var(--wt-text-mid)]">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>

        {/* Safety & Advisory Philosophy Banner */}
        <div id="how-safety" className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-6 md:p-8">
          <div className="max-w-3xl">
            <span className="wt-meta text-[color:var(--wt-accent)]">{HOW_SAFETY.label}</span>
            <h2 className="mt-2 wt-display text-[clamp(1.5rem,3vw,2.25rem)] text-[color:var(--wt-text)]">
              {HOW_SAFETY.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[color:var(--wt-text-mid)]">
              {HOW_SAFETY.body}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Cta
                href={LINKS.wikiInstall}
                variant="ghost"
                leading={<ModrinthMark className="h-3.5 w-3.5" />}
                newTab
              >
                {HOW_PAGE.cta}
              </Cta>
            </div>
          </div>
        </div>

        <HowClose />
      </BoardFrame>
    </main>
  );
}
