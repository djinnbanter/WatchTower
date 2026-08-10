import { useMemo } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

export type SeriesTrack = {
  id: string;
  label: string;
  /** 0–1 samples */
  series: number[];
  color: string;
};

function slice(series: number[], points: number): number[] {
  return series.slice(-points);
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function defaultFormatValue(value: number, unit?: string): string {
  const abs = Math.abs(value);
  let text: string;
  if (abs >= 100) text = value.toFixed(0);
  else if (abs >= 10) text = value.toFixed(1);
  else text = value.toFixed(2);
  return unit ? `${text} ${unit}` : text;
}

function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const pad = max * 1.08;
  const mag = 10 ** Math.floor(Math.log10(pad));
  return Math.ceil(pad / mag) * mag;
}

/** Shared Live/Overview time-series — shadcn Chart + Recharts, industrial (radius 0). */
export function SeriesChart({
  tracks,
  points,
  mode = 'bar',
  className,
  showGrid = false,
  /** Window length ending at now — builds X timestamps. */
  windowMs,
  /** Explicit X labels (e.g. Overview 24h hours). Overrides windowMs. */
  xLabels,
  /** Absolute value when a sample is 1.0 (denormalize 0–1 series). */
  valueAtFull,
  /** Per-track override for valueAtFull. */
  valueAtFullByTrack,
  unit,
  formatValue,
}: {
  tracks: SeriesTrack[];
  points: number;
  mode?: 'bar' | 'line';
  className?: string;
  showGrid?: boolean;
  windowMs?: number;
  xLabels?: string[];
  valueAtFull?: number;
  valueAtFullByTrack?: Record<string, number>;
  unit?: string;
  formatValue?: (value: number, trackId: string) => string;
}) {
  const n = Math.max(1, points);
  const now = useMemo(() => Date.now(), []);
  const trackKey = tracks.map((t) => t.id).join('|');
  const scaleKey = JSON.stringify(valueAtFullByTrack ?? null);

  const data = useMemo(() => {
    const scaleFor = (trackId: string) =>
      valueAtFullByTrack?.[trackId] ?? valueAtFull ?? 1;

    return Array.from({ length: n }, (_, i) => {
      const at =
        windowMs != null && n > 1
          ? now - ((n - 1 - i) * windowMs) / (n - 1)
          : now;
      const label =
        xLabels?.[i] ?? (windowMs != null ? formatClock(at) : String(i + 1));
      const row: Record<string, number | string> = { step: i, label, at };
      for (const t of tracks) {
        const samples = slice(t.series, n);
        const norm = samples[i] ?? 0;
        row[t.id] = norm * scaleFor(t.id);
      }
      return row;
    });
  }, [tracks, n, windowMs, xLabels, now, valueAtFull, scaleKey, trackKey]);

  const yMax = useMemo(() => {
    let max = 0;
    for (const row of data) {
      for (const t of tracks) {
        const v = Number(row[t.id] ?? 0);
        if (v > max) max = v;
      }
    }
    return niceCeil(max);
  }, [data, tracks]);

  const config = useMemo(() => {
    const cfg: ChartConfig = {};
    for (const t of tracks) {
      cfg[t.id] = { label: t.label, color: t.color };
    }
    return cfg;
  }, [tracks]);

  const formatAbs = (value: number, trackId: string) =>
    formatValue?.(value, trackId) ?? defaultFormatValue(value, unit);

  if (tracks.length === 0) return null;

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto h-36 w-full md:h-40', className)}
      initialDimension={{ width: 480, height: 160 }}
    >
      <ComposedChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          horizontal
          stroke="var(--border)"
          strokeDasharray="2 4"
          strokeOpacity={showGrid ? 0.85 : 0.55}
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          tickMargin={6}
          minTickGap={28}
          interval="preserveStartEnd"
          tick={{
            fill: 'var(--muted-foreground)',
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        />
        <YAxis
          domain={[0, yMax]}
          width={44}
          tickLine={false}
          axisLine={false}
          tickCount={4}
          tickMargin={4}
          tick={{
            fill: 'var(--muted-foreground)',
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
          }}
          tickFormatter={(v: number) => {
            const abs = Math.abs(v);
            if (abs >= 100) return String(Math.round(v));
            if (abs >= 10) return v.toFixed(1);
            return v.toFixed(2);
          }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as
                  | { label?: string; at?: number }
                  | undefined;
                if (row?.at != null && windowMs != null) return formatClock(row.at);
                return String(row?.label ?? '');
              }}
              formatter={(value, name, item) => {
                const trackId = String(item.dataKey ?? name);
                const num = typeof value === 'number' ? value : Number(value);
                const label =
                  config[trackId]?.label ?? tracks.find((t) => t.id === trackId)?.label ?? trackId;
                return (
                  <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatAbs(Number.isFinite(num) ? num : 0, trackId)}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        {mode === 'bar'
          ? tracks.map((t, idx) => (
              <Bar
                key={t.id}
                dataKey={t.id}
                fill={`var(--color-${t.id})`}
                radius={0}
                isAnimationActive={false}
                maxBarSize={tracks.length > 1 ? 6 : 10}
                fillOpacity={idx === 0 ? 0.95 : 0.55}
              />
            ))
          : tracks.flatMap((t, idx) => [
              <Area
                key={`${t.id}-area`}
                type="linear"
                dataKey={t.id}
                fill={`var(--color-${t.id})`}
                fillOpacity={idx === 0 ? 0.18 : 0.1}
                stroke="none"
                isAnimationActive={false}
              />,
              <Line
                key={`${t.id}-line`}
                type="linear"
                dataKey={t.id}
                stroke={`var(--color-${t.id})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />,
            ])}
      </ComposedChart>
    </ChartContainer>
  );
}

/** Live window length in ms. */
export const LIVE_WINDOW_MS = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
} as const;

/** Map metric headline value onto last sample so series reads in real units. */
export function valueAtFullFromMetric(value: string, series: number[]): number {
  const headline = Number.parseFloat(value);
  if (!Number.isFinite(headline)) return 1;
  const last = series[series.length - 1] ?? 0;
  if (last < 0.001) return Math.max(headline, 1);
  return headline / last;
}
