'use client';

import { ProductDesk } from '@/components/desk/product-desk';
import { Reveal } from '@/components/reveal';
import { ShippingStrip } from '@/components/sections/shipping-strip';
import { HOME_SHOWCASES } from '@/content/showcases';
import type { DeskCut, DeskChrome } from '@/components/desk/product-desk';

type TileVisual = {
  cut: DeskCut;
  chrome: DeskChrome;
  span: string;
  /** Stacked copy→desk keeps the same width; height follows content. */
  layout: 'stack' | 'split';
  compact?: boolean;
};

const VISUAL: Record<string, TileVisual> = {
  live: {
    cut: 'vitals',
    chrome: 'bar',
    span: 'md:col-span-6',
    layout: 'stack',
    compact: true,
  },
  issues: {
    cut: 'bands',
    chrome: 'bar',
    span: 'md:col-span-6',
    layout: 'stack',
    compact: true,
  },
  crashes: {
    cut: 'list',
    chrome: 'bar',
    span: 'md:col-span-6',
    layout: 'stack',
    compact: true,
  },
  insights: {
    cut: 'full',
    chrome: 'bar',
    span: 'md:col-span-6',
    layout: 'stack',
    compact: true,
  },
};

/**
 * 2×2 instrument bento. Each row matches heights; rows stay independent (no global stretch).
 */
export function Showcases() {
  return (
    <section className="relative border-t border-[color:var(--wt-line)]" id="showcases">
      <div className="mx-auto max-w-[84rem] px-5 pb-3 pt-10 lg:px-8 md:pt-12">
        <Reveal>
          <h2 className="wt-display-sm max-w-3xl text-[color:var(--wt-text)]">
            Live, Issues, Crashes, Insights.
          </h2>
          <p className="wt-lead mt-3 max-w-2xl">
            Sample fixtures from the real dashboard UI. Open the demo if you want to click around.
          </p>
        </Reveal>
      </div>

      <div className="mx-auto grid max-w-[84rem] gap-3 px-5 pb-8 md:grid-cols-12 md:gap-4 lg:px-8">
        {HOME_SHOWCASES.map((item, i) => {
          const visual = VISUAL[item.id] ?? {
            cut: 'full' as const,
            chrome: 'bar' as const,
            span: 'md:col-span-6',
            layout: 'stack' as const,
            compact: true,
          };
          const stacked = visual.layout === 'stack';
          return (
            <Reveal key={item.id} delay={i * 0.04} className={`${visual.span} flex h-full min-w-0 flex-col`}>
              <article
                className="relative flex h-full flex-col overflow-hidden border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)]/35"
                style={{ borderRadius: 'var(--wt-radius-lg)' }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-80"
                  style={{
                    background:
                      i % 2 === 0
                        ? 'radial-gradient(28rem 16rem at 90% 0%, var(--wt-glow-accent), transparent 65%)'
                        : 'radial-gradient(28rem 16rem at 10% 0%, var(--wt-glow-lantern), transparent 65%)',
                  }}
                  aria-hidden
                />
                <div
                  className={
                    stacked
                      ? 'relative flex flex-1 flex-col gap-3 p-4 md:gap-3.5 md:p-5'
                      : 'relative grid flex-1 gap-4 p-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-start md:gap-5 md:p-5'
                  }
                >
                  <div className="shrink-0">
                    <h3 className="text-base font-semibold tracking-tight text-[color:var(--wt-text)] md:text-lg">
                      {item.title}
                    </h3>
                    <p className="mt-1 font-mono text-[0.6875rem] text-[color:var(--wt-lantern)] md:text-[0.75rem]">
                      {item.readout}
                    </p>
                    <p className="mt-2 max-w-[48ch] text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-mid)] md:text-[0.875rem]">
                      {item.blurb}
                    </p>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <ProductDesk
                      surface={item.id}
                      cut={visual.cut}
                      chrome={visual.chrome}
                      compact={visual.compact}
                      sweep={false}
                      className="h-full flex-1"
                    />
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>

      <ShippingStrip />
    </section>
  );
}
