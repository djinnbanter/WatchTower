'use client';

import { InstrumentPlate } from '@/components/instrument-plate';
import { HashMeter, RingGauge, SeriesChart } from '@/components/poc-charts';
import { DESK } from '@/content/baked/desk';

/**
 * Insights instrument for the home storage beat: runway days + dimension share.
 * Uses POC RingGauge / HashMeter / SeriesChart (not legacy CSS sparks).
 */
export function StorageRunwayReadout() {
  const s = DESK.insights.storage;
  const quiet = DESK.insights.quiet[0];
  const trend = s.trend;
  const max = Math.max(...trend, 1);
  const norm = trend.map((v) => v / max);

  return (
    <InstrumentPlate>
      <div className="desk-surface relative">
        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)]/55 px-4 py-2.5 md:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.75rem] text-[color:var(--wt-text-low)]">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: 'var(--wt-ch-disk)' }}
            />
            <span className="font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text)]">
              Insights · Storage runway
            </span>
            <span aria-hidden className="text-[color:var(--wt-text-low)]">
              |
            </span>
            <span>{DESK.insights.window} window</span>
          </div>
          <span className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)] px-1.5 py-0.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--wt-warn)]">
            {s.daysLeft}d left
          </span>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-12 md:gap-5 md:p-5">
          <div className="flex flex-col justify-between border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-4 md:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
                  Disk runway
                </div>
                <div className="mt-3 font-mono text-[2.5rem] font-semibold leading-none tabular-nums text-[color:var(--wt-warn)]">
                  ~{s.daysLeft}
                  <span className="ml-2 text-sm font-normal text-[color:var(--wt-text-low)]">days</span>
                </div>
                <p className="mt-3 max-w-[36ch] text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                  {DESK.insights.storageHint}
                </p>
              </div>
              <RingGauge
                pct={s.usedPct}
                ink="var(--wt-warn)"
                label="used"
                sizeClassName="mx-auto aspect-square max-h-28 w-28 shrink-0"
              />
            </div>
            <div className="mt-4 space-y-2 border-t border-[color:var(--wt-line)] pt-3">
              <HashMeter value={s.usedPct} ink="var(--wt-warn)" aria-label="Disk used" />
              {quiet ? (
                <p className="m-0 font-mono text-[0.7rem] text-[color:var(--wt-text-low)]">
                  Quiet slot {quiet.label}
                </p>
              ) : null}
            </div>
          </div>

          <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-4 md:col-span-7">
            <div className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
              Used % · 30d
            </div>
            <SeriesChart
              tracks={[{ id: 'disk', label: 'Used %', series: norm, color: 'var(--wt-warn)' }]}
              points={norm.length}
              mode="line"
              valueAtFull={max}
              unit="%"
              className="mt-2 h-28 md:h-32"
            />
            <div className="mt-4 grid gap-2">
              {s.dims.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 font-mono text-[0.65rem] text-[color:var(--wt-text-low)]">
                    {d.label}
                  </span>
                  <HashMeter value={d.pct} ink="var(--wt-ch-disk)" className="flex-1" />
                  <span className="w-16 shrink-0 text-right font-mono text-[0.7rem] tabular-nums">
                    {d.gb}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </InstrumentPlate>
  );
}
