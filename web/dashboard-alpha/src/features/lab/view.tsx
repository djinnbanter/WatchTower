import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, FlaskConical, Gauge as GaugeIcon, RotateCcw } from '@/ui/icons';
import type { RouteState } from '@/app/router';
import { BorderGlow, ClickSpark, FadeIn, Magnet, PageEnter, ShimmerText, SpotlightCard, Stagger, useCountUp } from '@/ui/motion';
import { Button, EmptyState, ErrorState, MetricReadout, QueueRow, Section, StatusPill } from '@/ui/patterns';
import {
  AreaLineChart,
  BarMeter,
  ChartFrame,
  CompareBars,
  demoSeries,
  Heatmap,
  HourBars,
  matrixToHeatmapColumns,
  PieChart,
  RadarChart,
  Sparkline,
  WtAreaChart,
  WtBarChart,
  WtCpuGauge,
  WtDiskGauge,
  WtHeatmap,
  WtHeapGauge,
  WtLineChart,
  WtMsptGauge,
  WtMultiRing,
  WtRing,
  WtThermalGauge,
  WtTpsGauge,
} from '@/ui/charts';

const TPS_DEMO = demoSeries(60, 19.5, 0.6, 3);
const MSPT_DEMO = demoSeries(60, 14, 6, 7);
const HEAP_DEMO = demoSeries(60, 5400, 300, 11);
const CPU_DEMO = demoSeries(60, 42, 18, 17);

const DEMO_ROWS = Array.from({ length: 48 }, (_, i) => ({
  date: new Date(Date.now() - (47 - i) * 60_000),
  tps: TPS_DEMO[i % TPS_DEMO.length]!,
  mspt: MSPT_DEMO[i % MSPT_DEMO.length]!,
  cpu: CPU_DEMO[i % CPU_DEMO.length]!,
  heap: HEAP_DEMO[i % HEAP_DEMO.length]!,
}));

const HEATMAP_ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_COLS = Array.from({ length: 12 }, (_, i) => String(i * 2));
const HEATMAP_VALUES = HEATMAP_ROWS.map((_, r) =>
  HEATMAP_COLS.map((_, c) => Math.max(0, Math.min(1, 0.3 + 0.5 * Math.sin((r + c) / 3) + (c > 8 ? 0.2 : 0)))),
);

function LabSection({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <Section title={title} hint={hint}>
        {children}
      </Section>
    </section>
  );
}

export function PageView({ route: _route }: { route: RouteState }) {
  const [gaugeValue, setGaugeValue] = useState(72);
  const [tempC, setTempC] = useState(62);
  const [countValue, setCountValue] = useState(1280);
  const [chartState, setChartState] = useState<'ok' | 'loading' | 'error' | 'empty'>('ok');
  const countedUp = useCountUp(countValue);

  const heatmapData = useMemo(
    () => matrixToHeatmapColumns(HEATMAP_ROWS, HEATMAP_COLS, HEATMAP_VALUES),
    [],
  );

  const barRows = useMemo(
    () => [
      { name: 'Overworld', value: 88 },
      { name: 'Nether', value: 22 },
      { name: 'End', value: 14 },
      { name: 'Modded', value: 31 },
    ],
    [],
  );

  const navLinks = [
    ['motion', 'Motion'],
    ['patterns', 'Patterns'],
    ['gauges', 'Colored gauges'],
    ['series', 'Interactive series'],
    ['heatmap', 'Heatmap'],
    ['sparklines', 'Sparklines'],
    ['distribution', 'Distribution'],
  ] as const;

  return (
    <PageEnter className="space-y-10">
      <SpotlightCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-wt-accent-soft via-transparent to-transparent p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-wt-accent/15 text-wt-accent">
              <FlaskConical size={22} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-wt-text-low">Visual lab</div>
              <h2 className="text-2xl font-bold tracking-tight">UI kit gallery</h2>
              <p className="mt-1 max-w-xl text-sm text-wt-text-mid">
                Demo playground for charts, motion primitives, and UI patterns — all fixture data, nothing from your
                server. Hover every chart to try tooltips and enter animations.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {navLinks.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full border border-wt-line bg-wt-bg2/60 px-3 py-1.5 text-xs font-medium text-wt-text-mid hover:border-wt-accent/40 hover:text-wt-text"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </SpotlightCard>

      <LabSection
        id="motion"
        title="Motion primitives"
        hint="Watchtower-owned React Bits–style motion — no react-bits package."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <SpotlightCard className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">SpotlightCard</div>
            <p className="text-sm text-wt-text-mid">Move your cursor over this card — the highlight follows the pointer.</p>
          </SpotlightCard>
          <SpotlightCard className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">useCountUp</div>
            <div className="font-mono text-3xl font-semibold tabular-nums">{countedUp.toFixed(0)}</div>
            <Button className="mt-3" onClick={() => setCountValue((v) => (v === 1280 ? 4820 : 1280))}>
              <RotateCcw size={13} className="mr-1.5" /> Randomize
            </Button>
          </SpotlightCard>
          <SpotlightCard className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Stagger</div>
            <Stagger className="space-y-1.5">
              {['One', 'Two', 'Three'].map((t) => (
                <div key={t} className="rounded-lg bg-wt-bg2 px-2.5 py-1.5 text-sm">
                  {t}
                </div>
              ))}
            </Stagger>
          </SpotlightCard>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <BorderGlow tone="accent" className="rounded-[var(--radius-wt)]" intensity={1} glowRadius={260}>
            <div className="rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">BorderGlow</div>
              <p className="text-sm text-wt-text-mid">
                Move near the edges — cone + bleed + aura follow the pointer (React Bits–inspired).
              </p>
            </div>
          </BorderGlow>
          <SpotlightCard className="space-y-3 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">ShimmerText</div>
            <ShimmerText className="text-2xl font-semibold tracking-tight">Nominal grade</ShimmerText>
            <FadeIn>
              <p className="text-sm text-wt-text-mid">FadeIn wraps this line on mount.</p>
            </FadeIn>
          </SpotlightCard>
          <SpotlightCard className="space-y-3 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Magnet + ClickSpark</div>
            <Magnet className="inline-flex">
              <ClickSpark>
                <Button kind="primary">Hover + click me</Button>
              </ClickSpark>
            </Magnet>
          </SpotlightCard>
        </div>
      </LabSection>

      <LabSection id="patterns" title="UI patterns" hint="Section, MetricReadout, Button, QueueRow, StatusPill, EmptyState, ErrorState.">
        <div className="grid gap-4 lg:grid-cols-2">
          <SpotlightCard className="space-y-4 p-5">
            <MetricReadout label="MetricReadout" value={19.87} unit="tps" tone="ok" />
            <div className="flex flex-wrap gap-2">
              <Button kind="default">Default</Button>
              <Button kind="primary">Primary</Button>
              <Button kind="ghost">Ghost</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="neutral">neutral</StatusPill>
              <StatusPill tone="ok">ok</StatusPill>
              <StatusPill tone="warn">warn</StatusPill>
              <StatusPill tone="danger">danger</StatusPill>
              <StatusPill tone="info">info</StatusPill>
            </div>
            <QueueRow title="QueueRow title" detail="Supporting detail text goes here." action={<Button kind="ghost">Action</Button>} />
          </SpotlightCard>
          <div className="grid gap-4">
            <SpotlightCard className="p-4">
              <EmptyState title="EmptyState">Nothing to show yet — this is the empty state.</EmptyState>
            </SpotlightCard>
            <SpotlightCard className="p-4">
              <ErrorState title="ErrorState">Something went wrong — this is the error state.</ErrorState>
            </SpotlightCard>
          </div>
        </div>
      </LabSection>

      <LabSection id="gauges" title="Colored Bklit gauges" hint="Notched Gauge with semantic gradients — thermal cool→hot, vitals warn/crit.">
        <SpotlightCard className="mb-4 flex flex-wrap items-center gap-4 p-4">
          <GaugeIcon size={15} className="text-wt-accent" />
          <label className="flex items-center gap-2 text-sm text-wt-text-mid">
            Load
            <input
              type="range"
              min={0}
              max={100}
              value={gaugeValue}
              onChange={(e) => setGaugeValue(Number(e.target.value))}
              className="w-40 accent-wt-accent"
            />
            <span className="font-mono text-sm">{gaugeValue}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-wt-text-mid">
            Temp °C
            <input
              type="range"
              min={30}
              max={100}
              value={tempC}
              onChange={(e) => setTempC(Number(e.target.value))}
              className="w-40 accent-wt-accent"
            />
            <span className="font-mono text-sm">{tempC}</span>
          </label>
        </SpotlightCard>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SpotlightCard className="flex flex-col items-center p-5">
            <WtTpsGauge value={(gaugeValue / 100) * 20} />
          </SpotlightCard>
          <SpotlightCard className="flex flex-col items-center p-5">
            <WtMsptGauge value={(gaugeValue / 100) * 55} />
          </SpotlightCard>
          <SpotlightCard className="flex flex-col items-center p-5">
            <WtCpuGauge value={gaugeValue} />
          </SpotlightCard>
          <SpotlightCard className="flex flex-col items-center p-5">
            <WtDiskGauge value={gaugeValue} />
          </SpotlightCard>
          <SpotlightCard className="flex flex-col items-center p-5">
            <WtHeapGauge usedMb={gaugeValue * 80} maxMb={8000} />
          </SpotlightCard>
          <SpotlightCard className="flex flex-col items-center p-5">
            <WtThermalGauge celsius={tempC} label="Package" />
          </SpotlightCard>
          <SpotlightCard className="flex flex-col items-center p-5">
            <WtThermalGauge celsius={tempC - 12} label="Ambient" minC={20} maxC={50} />
          </SpotlightCard>
          <SpotlightCard className="flex flex-col items-center p-5">
            <WtRing value={gaugeValue} label="Pregen" color="var(--wt-ok)" />
          </SpotlightCard>
          <SpotlightCard className="col-span-full flex flex-col items-center p-5 md:col-span-2">
            <WtMultiRing
              rings={[
                { label: 'CPU', value: gaugeValue, color: 'var(--wt-ch-cpu)' },
                { label: 'Heap', value: Math.max(10, 100 - gaugeValue), color: 'var(--wt-ch-heap)' },
                { label: 'Disk', value: 40 + gaugeValue * 0.2, color: 'var(--wt-ch-disk, #38bdf8)' },
              ]}
              centerLabel="Host"
            />
          </SpotlightCard>
        </div>
      </LabSection>

      <LabSection id="series" title="Interactive series" hint="Bklit Area / Line / Bar with Grid, axes, ChartTooltip, and enter animation.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartFrame title="WtAreaChart · TPS / MSPT" layer="bklit">
            <WtAreaChart
              data={DEMO_ROWS}
              series={[
                { dataKey: 'tps', color: 'var(--wt-ch-tps)' },
                { dataKey: 'mspt', color: 'var(--wt-ch-mspt)' },
              ]}
            />
          </ChartFrame>
          <ChartFrame title="WtLineChart · CPU / Heap" layer="bklit">
            <WtLineChart
              data={DEMO_ROWS}
              series={[
                { dataKey: 'cpu', color: 'var(--wt-ch-cpu)' },
                { dataKey: 'heap', color: 'var(--wt-ch-heap)', type: 'line' },
              ]}
            />
          </ChartFrame>
          <ChartFrame title="WtBarChart · dimensions" layer="bklit">
            <WtBarChart data={barRows} color="var(--wt-accent)" />
          </ChartFrame>
          <ChartFrame
            title="ChartFrame states"
            layer="interactive"
            loading={chartState === 'loading'}
            error={chartState === 'error' ? 'Simulated fetch failure.' : null}
            empty={chartState === 'empty'}
            actions={
              <div className="flex gap-1">
                {(['ok', 'loading', 'error', 'empty'] as const).map((s) => (
                  <Button key={s} kind={chartState === s ? 'primary' : 'ghost'} onClick={() => setChartState(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            }
          >
            <WtAreaChart data={DEMO_ROWS} series={[{ dataKey: 'cpu', color: 'var(--wt-accent)' }]} />
          </ChartFrame>
        </div>
      </LabSection>

      <LabSection id="heatmap" title="Heatmap" hint="Bklit HeatmapChart with cells, axes, and HeatmapTooltip.">
        <ChartFrame title="Hour-of-week intensity" layer="bklit">
          <WtHeatmap data={heatmapData} />
        </ChartFrame>
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Legacy SVG Heatmap (reference)</div>
          <Heatmap rows={HEATMAP_ROWS} cols={HEATMAP_COLS} values={HEATMAP_VALUES} />
        </div>
      </LabSection>

      <LabSection id="sparklines" title="Sparklines only" hint="Static AreaLineChart kept for dense strips — not for primary panels.">
        <div className="grid gap-4 md:grid-cols-3">
          <SpotlightCard className="p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Sparkline · accent</div>
            <Sparkline series={TPS_DEMO} tone="accent" />
          </SpotlightCard>
          <SpotlightCard className="p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Sparkline · warn</div>
            <Sparkline series={MSPT_DEMO} tone="warn" />
          </SpotlightCard>
          <SpotlightCard className="p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Compact AreaLine</div>
            <AreaLineChart series={[CPU_DEMO]} height={48} colors={['var(--wt-accent)']} />
          </SpotlightCard>
        </div>
      </LabSection>

      <LabSection id="distribution" title="Distribution helpers" hint="Pie / Radar / BarMeter / HourBars / CompareBars.">
        <div className="grid gap-4 lg:grid-cols-3">
          <SpotlightCard className="p-5">
            <div className="mb-3 text-sm font-semibold">PieChart</div>
            <PieChart
              segments={[
                { label: 'Overworld', value: 88 },
                { label: 'Nether', value: 8 },
                { label: 'End', value: 4 },
                { label: 'Modded', value: 4 },
              ]}
            />
          </SpotlightCard>
          <SpotlightCard className="p-5">
            <div className="mb-3 text-sm font-semibold">RadarChart</div>
            <RadarChart
              axes={[
                { label: 'TPS', value: 96 },
                { label: 'MSPT', value: 62 },
                { label: 'Heap', value: 71 },
                { label: 'CPU', value: 44 },
                { label: 'Disk', value: 48 },
              ]}
            />
          </SpotlightCard>
          <SpotlightCard className="space-y-4 p-5">
            <div className="mb-1 text-sm font-semibold">BarMeter</div>
            <BarMeter label="Heap pressure" value={72} tone="warn" />
            <BarMeter label="Disk usage" value={42} tone="accent" />
            <BarMeter label="Backup coverage" value={94} tone="ok" />
          </SpotlightCard>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SpotlightCard className="p-5">
            <div className="mb-3 text-sm font-semibold">HourBars</div>
            <HourBars hours={Array.from({ length: 24 }, (_, i) => 20 + Math.sin(i / 3) * 15)} />
          </SpotlightCard>
          <SpotlightCard className="p-5">
            <div className="mb-3 text-sm font-semibold">CompareBars</div>
            <CompareBars
              rows={[
                { label: 'TPS avg', current: 19.6, previous: 19.2 },
                { label: 'MSPT p95', current: 28, previous: 34 },
                { label: 'Players', current: 8, previous: 6 },
              ]}
            />
          </SpotlightCard>
        </div>
        <SpotlightCard className="mt-4 flex items-start gap-3 border-wt-warn/30 bg-wt-warn/5 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-wt-warn" />
          <p className="text-sm text-wt-text-mid">
            Product pages must use Wt* Bklit wrappers for panel charts and dials. Sparklines remain the only static SVG path.
          </p>
        </SpotlightCard>
      </LabSection>
    </PageEnter>
  );
}
