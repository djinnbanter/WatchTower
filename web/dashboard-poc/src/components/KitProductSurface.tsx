import type { ReactNode } from 'react';
import { Plate } from './Plate';
import { DeskPieChart, DeskRadialGauge, DeskTreemap } from './charts/DeskCharts';
import { DeskHeatmap, HashMeter, SeriesChart, SparkBars } from './charts';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { cn } from '@/lib/utils';

function KitBlock({
  id,
  file,
  note,
  children,
  className,
}: {
  id: string;
  file: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn(className)}>
      <Plate className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <p className="m-0 font-mono text-[0.7rem] text-muted-foreground">{file}</p>
          {note ? (
            <p className="m-0 max-w-[28rem] text-right text-[0.65rem] text-muted-foreground">{note}</p>
          ) : null}
        </div>
        <div className="space-y-3 p-4 md:p-5">{children}</div>
      </Plate>
    </div>
  );
}

const series = Array.from(
  { length: 36 },
  (_, i) => 0.4 + Math.sin(i / 4) * 0.22 + (i % 7) * 0.01,
);
const hours = Array.from(
  { length: 24 },
  (_, i) => 0.15 + Math.sin(i / 3) * 0.12 + (i > 17 && i < 22 ? 0.35 : 0),
);

/**
 * Product-shaped templates built only on shadcn Chart (Recharts) + Base UI primitives.
 */
export function KitProductSurface() {
  return (
    <>
      <section id="product-charts" className="scroll-mt-24 space-y-3">
        <div>
          <h2 className="wt-meta m-0 text-muted-foreground">Product charts</h2>
          <p className="mt-1 m-0 max-w-3xl text-[0.8rem] text-muted-foreground">
            Same jobs as Overview / Live / Insights / Spark — implemented with{' '}
            <code className="font-mono text-foreground">ui/chart</code> (Recharts) and Base UI
            Progress. No custom SVG chart kit.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <KitBlock
            id="kit-area"
            file="ui/chart · SeriesChart line"
            note="Area + line series"
            className="lg:col-span-2"
          >
            <SeriesChart
              points={36}
              windowMs={60 * 60 * 1000}
              mode="line"
              unit="ms"
              valueAtFull={50}
              tracks={[
                {
                  id: 'mspt',
                  label: 'MSPT',
                  series,
                  color: 'var(--primary)',
                },
                {
                  id: 'budget',
                  label: 'Budget',
                  series: series.map(() => 0.5),
                  color: 'var(--muted-foreground)',
                },
              ]}
            />
          </KitBlock>

          <KitBlock id="kit-bars" file="ui/chart · SeriesChart bar" note="Bar series">
            <SeriesChart
              points={24}
              windowMs={6 * 60 * 60 * 1000}
              mode="bar"
              unit="%"
              valueAtFull={100}
              tracks={[{ id: 'cpu', label: 'CPU', series, color: 'var(--primary)' }]}
            />
          </KitBlock>

          <KitBlock id="kit-hour-bars" file="ui/chart · SeriesChart bar" note="24h schedule bars">
            <SeriesChart
              points={hours.length}
              mode="bar"
              xLabels={hours.map((_, i) => String(i).padStart(2, '0'))}
              valueAtFull={1}
              unit=""
              formatValue={(v) => v.toFixed(2)}
              tracks={[{ id: 'load', label: 'Load', series: hours, color: 'var(--primary)' }]}
              className="h-28"
            />
          </KitBlock>

          <KitBlock id="kit-pie" file="ui/chart · Pie" note="Distribution">
            <DeskPieChart
              segments={[
                { name: 'Overworld', value: 42, fill: 'var(--wt-ok)' },
                { name: 'Nether', value: 18, fill: 'var(--wt-danger)' },
                { name: 'End', value: 9, fill: 'var(--wt-info)' },
                { name: 'Other', value: 7, fill: 'var(--wt-warn)' },
              ]}
            />
          </KitBlock>

          <KitBlock id="kit-spark" file="ui/chart · SparkBars" note="Compact spark">
            <div className="grid grid-cols-3 gap-3">
              <SparkBars samples={series.slice(-14)} />
              <SparkBars samples={series.slice(-14).map((v) => 1 - v)} />
              <SparkBars samples={series.slice(-14).map((v) => v * 0.7)} />
            </div>
          </KitBlock>

          <KitBlock id="kit-radial" file="ui/chart · RadialBar" note="Gauge / dial">
            <div className="flex flex-wrap justify-around gap-4">
              <DeskRadialGauge value={19.4} max={20} label="TPS" color="var(--wt-ok)" />
              <DeskRadialGauge value={48} max={50} label="MSPT" color="var(--wt-warn)" />
              <DeskRadialGauge value={71} max={100} label="Disk" color="var(--primary)" />
            </div>
          </KitBlock>

          <KitBlock id="kit-meters" file="ui/progress · HashMeter" note="Meters">
            <div className="space-y-4">
              <Progress value={61} className="w-full gap-2">
                <div className="mb-1 flex w-full justify-between">
                  <ProgressLabel>Heap pressure</ProgressLabel>
                  <ProgressValue />
                </div>
              </Progress>
              <Progress value={44} className="w-full gap-2">
                <div className="mb-1 flex w-full justify-between">
                  <ProgressLabel>CPU 15m</ProgressLabel>
                  <ProgressValue />
                </div>
              </Progress>
              <div>
                <p className="mb-2 m-0 wt-meta text-muted-foreground">Hash fill meter</p>
                <HashMeter value={62} />
              </div>
              <div>
                <p className="mb-2 m-0 wt-meta text-muted-foreground">Dual share (used / free)</p>
                <div className="flex h-3 w-full border border-border">
                  <div className="h-full bg-primary" style={{ width: '71%' }} />
                  <div className="h-full flex-1 bg-muted" />
                </div>
              </div>
            </div>
          </KitBlock>

          <KitBlock id="kit-compare" file="ui/progress" note="Current vs previous">
            <div className="space-y-4">
              {(
                [
                  { label: 'Entities', current: 78, previous: 65 },
                  { label: 'Chunks', current: 55, previous: 62 },
                ] as const
              ).map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <p className="m-0 text-sm">{row.label}</p>
                  <Progress value={row.current} />
                  <Progress value={row.previous} className="opacity-50" />
                </div>
              ))}
            </div>
          </KitBlock>

          <KitBlock
            id="kit-treemap"
            file="ui/chart · Treemap"
            note="Storage share"
            className="lg:col-span-2"
          >
            <DeskTreemap
              nodes={[
                { name: 'World', size: 48, fill: 'var(--wt-ok)' },
                { name: 'Mods', size: 22, fill: 'var(--wt-ch-heap, #9B8BD9)' },
                { name: 'Backups', size: 18, fill: 'var(--wt-warn)' },
                { name: 'Logs', size: 7, fill: 'var(--wt-info)' },
                { name: 'Other', size: 5, fill: 'var(--muted-foreground)' },
              ]}
            />
          </KitBlock>

          <KitBlock
            id="kit-heatmap"
            file="@nivo/heatmap · DeskHeatmap"
            note="MSPT schedule"
            className="lg:col-span-2"
          >
            <DeskHeatmap height={300} />
          </KitBlock>
        </div>
      </section>

      <section id="desk-patterns" className="scroll-mt-24 space-y-3">
        <div>
          <h2 className="wt-meta m-0 text-muted-foreground">Desk patterns</h2>
          <p className="mt-1 m-0 max-w-3xl text-[0.8rem] text-muted-foreground">
            Built from registry <code className="font-mono text-foreground">Badge</code>,{' '}
            <code className="font-mono text-foreground">Card</code>, and{' '}
            <code className="font-mono text-foreground">SparkBars</code>.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <KitBlock id="kit-status-pill" file="ui/badge.tsx" note="Status chips">
            <div className="flex flex-wrap gap-2">
              <Badge>Watching</Badge>
              <Badge variant="secondary">MSPT warm</Badge>
              <Badge variant="destructive">Disk critical</Badge>
              <Badge variant="outline">Info</Badge>
            </div>
          </KitBlock>

          <KitBlock id="kit-stat" file="ui/card.tsx" note="KPI readout">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Uptime</CardDescription>
                <CardTitle className="font-mono text-2xl tabular-nums">128.4 h</CardTitle>
              </CardHeader>
            </Card>
          </KitBlock>

          <KitBlock id="kit-vital-tile" file="ui/card · SparkBars" note="Vital strip" className="lg:col-span-2">
            <div className="grid gap-px bg-border sm:grid-cols-3">
              {(
                [
                  { label: 'TPS', value: '19.4', hint: 'target 20' },
                  { label: 'MSPT', value: '48 ms', hint: 'budget 50' },
                  { label: 'Players', value: '12', hint: 'of 40' },
                ] as const
              ).map((v) => (
                <Card key={v.label} className="rounded-none border-0 shadow-none">
                  <CardHeader className="pb-1">
                    <CardDescription>{v.label}</CardDescription>
                    <CardTitle className="font-mono text-xl tabular-nums">{v.value}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-2 m-0 text-[0.65rem] text-muted-foreground">{v.hint}</p>
                    <SparkBars samples={series.slice(-12)} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </KitBlock>
        </div>
      </section>
    </>
  );
}
