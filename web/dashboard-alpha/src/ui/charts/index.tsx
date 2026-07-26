import { Fragment, useId, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState } from '@/ui/patterns';

export function ChartFrame({
  title,
  layer,
  children,
  className,
  actions,
  loading,
  error,
  empty,
}: {
  title: string;
  layer?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 p-4 shadow-[var(--wt-shadow)]',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {layer ? (
            <span className="rounded-full bg-wt-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-wt-accent">
              {layer}
            </span>
          ) : null}
        </div>
        {actions}
      </div>
      {loading ? <div className="h-40 animate-pulse rounded-xl bg-wt-bg3" /> : null}
      {!loading && error ? <ErrorState title="Chart error">{error}</ErrorState> : null}
      {!loading && !error && empty ? <EmptyState title="No samples yet">Waiting for fixture data.</EmptyState> : null}
      {!loading && !error && !empty ? children : null}
    </div>
  );
}

type Point = { x: number; y: number };

function pathFrom(points: Point[], width: number, height: number, minY: number, maxY: number) {
  if (!points.length) return '';
  const span = Math.max(1e-6, maxY - minY);
  return points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * width;
      const y = height - ((p.y - minY) / span) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function AreaLineChart({
  series,
  height = 180,
  colors,
  showGrid = true,
}: {
  series: number[][];
  height?: number;
  colors?: string[];
  /** Dashed horizontal guides — off for compact hero sparklines. */
  showGrid?: boolean;
}) {
  const gradId = useId().replace(/:/g, '');
  const width = 640;
  const pad = showGrid ? 8 : 2;
  const flat = series.flat();
  const minY = Math.min(...flat, 0);
  const maxY = Math.max(...flat, 1);
  const palette = colors || ['var(--wt-ch-tps)', 'var(--wt-ch-mspt)', 'var(--wt-ch-heap)', 'var(--wt-ch-cpu)'];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img">
      <defs>
        {series.map((_, i) => (
          <linearGradient key={i} id={`wt-fill-${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette[i % palette.length]} stopOpacity="0.35" />
            <stop offset="100%" stopColor={palette[i % palette.length]} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {showGrid
        ? [0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={0}
              x2={width}
              y1={pad + t * (height - pad * 2)}
              y2={pad + t * (height - pad * 2)}
              stroke="var(--wt-line)"
              strokeDasharray="4 6"
            />
          ))
        : null}
      {series.map((vals, i) => {
        const pts = vals.map((y, x) => ({ x, y }));
        const line = pathFrom(pts, width, height - pad * 2, minY, maxY);
        const area = `${line} L${width},${height - pad} L0,${height - pad} Z`;
        return (
          <g key={i} transform={`translate(0 ${pad})`}>
            <path d={area} fill={`url(#wt-fill-${gradId}-${i})`} />
            <path
              d={line}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth={showGrid ? 2.25 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 0 8px color-mix(in srgb, currentColor 25%, transparent))"
            />
          </g>
        );
      })}
    </svg>
  );
}

export function GaugeChart({
  value,
  max = 100,
  label,
  unit,
  color = 'var(--wt-accent)',
}: {
  value: number;
  max?: number;
  label?: string;
  unit?: string;
  color?: string;
}) {
  const pct = Math.min(1, Math.max(0, value / max));
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = c * 0.75;
  return (
    <div className="relative mx-auto grid w-[140px] place-items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--wt-bg3)"
          strokeWidth="12"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${dash * pct} ${c}`}
          strokeLinecap="round"
          transform="rotate(135 70 70)"
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {value.toFixed(0)}
            {unit ? <span className="text-sm text-wt-text-low">{unit}</span> : null}
          </div>
          {label ? <div className="text-[10px] uppercase tracking-[0.14em] text-wt-text-low">{label}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function RingChart({
  value,
  label,
  sublabel,
  color = 'var(--wt-accent)',
  size = 110,
}: {
  value: number;
  label?: string;
  sublabel?: string;
  color?: string;
  size?: number;
}) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value / 100));
  return (
    <div className="grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--wt-bg3)" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="48%" textAnchor="middle" className="fill-wt-text font-mono text-lg font-semibold">
          {Math.round(value)}%
        </text>
        {label ? (
          <text x="50%" y="62%" textAnchor="middle" className="fill-wt-text-low text-[10px] uppercase">
            {label}
          </text>
        ) : null}
      </svg>
      {sublabel ? <div className="-mt-2 text-xs text-wt-text-low">{sublabel}</div> : null}
    </div>
  );
}

export function BarMeter({
  label,
  value,
  valueLabel,
  tone = 'accent',
}: {
  label: string;
  value: number;
  valueLabel?: string;
  tone?: 'accent' | 'warn' | 'ok';
}) {
  const color = tone === 'warn' ? 'var(--wt-warn)' : tone === 'ok' ? 'var(--wt-ok)' : 'var(--wt-accent)';
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-wt-text-mid">{valueLabel ?? `${Math.round(value)}%`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-wt-bg3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function HourBars({ hours, tone = 'accent' }: { hours: number[]; tone?: 'accent' | 'warn' }) {
  const max = Math.max(...hours, 1);
  const color = tone === 'warn' ? 'var(--wt-warn)' : 'var(--wt-accent)';
  return (
    <div className="flex h-24 items-end gap-1">
      {hours.map((h, i) => (
        <div key={i} className="group relative flex-1">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{ height: `${(h / max) * 100}%`, background: color, opacity: 0.35 + (h / max) * 0.65 }}
            title={`${i}:00 — ${h.toFixed(1)}`}
          />
        </div>
      ))}
    </div>
  );
}

/** Named multi-stop scales for schedule heatmaps (low → high heat). */
export const HEATMAP_SCALES = {
  /** Tick lag — cool slate → amber → orange → red */
  mspt: ['#1e293b', '#64748b', '#fbbf24', '#f97316', '#ef4444'],
  /** Tick rate (use with invert) — healthy green → amber → red */
  tps: ['#064e3b', '#22c55e', '#facc15', '#fb923c', '#ef4444'],
  /** Player density — deep indigo → sky (not a health grade) */
  players: ['#0f172a', '#1e3a5f', '#2563eb', '#38bdf8', '#e0f2fe'],
} as const;

export type HeatmapScaleName = keyof typeof HEATMAP_SCALES;

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/** Sample a multi-stop hex palette at t ∈ [0, 1]. */
export function sampleHeatScale(stops: readonly string[], t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  if (stops.length === 1) return stops[0]!;
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - i;
  const [r1, g1, b1] = parseHex(stops[i]!);
  const [r2, g2, b2] = parseHex(stops[i + 1]!);
  return `rgb(${lerpChannel(r1, r2, local)} ${lerpChannel(g1, g2, local)} ${lerpChannel(b1, b2, local)})`;
}

function heatTextColor(bg: string): string {
  const m = bg.match(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)/);
  if (!m) return 'var(--wt-text)';
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? '#0c1018' : '#f8fafc';
}

export function Heatmap({
  values,
  rows,
  cols,
  color = 'var(--wt-ch-mspt)',
  scale,
  stops,
  invert = false,
  formatValue,
  emptyValue = 0,
  legendLow,
  legendHigh,
}: {
  values: number[][];
  rows: string[];
  cols: string[];
  /** Legacy single-color high end (used when scale/stops omitted). */
  color?: string;
  /** Named multi-stop palette. */
  scale?: HeatmapScaleName;
  /** Custom multi-stop hex colors (low → high heat). */
  stops?: readonly string[];
  /** When true, low values map to the hot end (e.g. TPS). */
  invert?: boolean;
  /** Format the number shown inside each cell. */
  formatValue?: (value: number) => string;
  /** Sentinel / missing fill when a cell is absent. */
  emptyValue?: number;
  legendLow?: string;
  legendHigh?: string;
}) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const row of values) {
    for (const raw of row) {
      if (!Number.isFinite(raw)) continue;
      min = Math.min(min, raw);
      max = Math.max(max, raw);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  const span = Math.max(1e-9, max - min);
  const fmt =
    formatValue ??
    ((v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)));

  const palette = stops ?? (scale ? HEATMAP_SCALES[scale] : null);

  const cellStyle = (heat: number): { background: string; color: string } => {
    if (palette) {
      const background = sampleHeatScale(palette, heat);
      return { background, color: heatTextColor(background) };
    }
    const mix = Math.round(14 + heat * 86);
    return {
      background: `color-mix(in srgb, ${color} ${mix}%, var(--wt-bg3))`,
      color: heat > 0.52 ? '#0c1018' : 'var(--wt-text)',
    };
  };

  return (
    <div className="in-heatmap">
      <div
        className="in-heatmap__grid"
        style={{ gridTemplateColumns: `2.25rem repeat(${cols.length}, minmax(0, 1fr))` }}
      >
        <div />
        {cols.map((c) => (
          <div key={c} className="in-heatmap__col">
            {c}
          </div>
        ))}
        {rows.map((row, ri) => (
          <Fragment key={row}>
            <div className="in-heatmap__row">{row}</div>
            {cols.map((c, ci) => {
              const v = values[ri]?.[ci] ?? emptyValue;
              const norm = Math.min(1, Math.max(0, (v - min) / span));
              const heat = invert ? 1 - norm : norm;
              const style = cellStyle(heat);
              return (
                <div
                  key={`${row}-${c}`}
                  className="in-heatmap__cell"
                  style={style}
                  title={`${row} ${c}:00 — ${fmt(v)}`}
                >
                  {fmt(v)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      {palette ? (
        <div className="in-heatmap__legend" aria-hidden>
          <span>{legendLow ?? (invert ? 'High' : 'Low')}</span>
          <div
            className="in-heatmap__legend-bar"
            style={{
              background: `linear-gradient(90deg, ${palette.join(', ')})`,
            }}
          />
          <span>{legendHigh ?? (invert ? 'Low' : 'High')}</span>
        </div>
      ) : null}
    </div>
  );
}

export function RadarChart({
  axes,
  size = 200,
}: {
  axes: Array<{ label: string; value: number; max?: number }>;
  size?: number;
}) {
  const n = Math.max(axes.length, 3);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const step = (Math.PI * 2) / n;
  const start = -Math.PI / 2;
  const point = (i: number, radius: number) => ({
    x: cx + Math.cos(start + i * step) * radius,
    y: cy + Math.sin(start + i * step) * radius,
  });
  const rings = [0.33, 0.66, 1].map((frac) =>
    Array.from({ length: n }, (_, i) => point(i, maxR * frac))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ') + ' Z',
  );
  const data = axes
    .map((ax, i) => {
      const frac = Math.min(1, Math.max(0, ax.value / (ax.max ?? 100)));
      return point(i, maxR * frac);
    })
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--wt-line-strong)" />
      ))}
      <path d={data} fill="color-mix(in srgb, var(--wt-accent) 22%, transparent)" stroke="var(--wt-accent)" strokeWidth="2" />
      {axes.map((ax, i) => {
        const p = point(i, maxR + 14);
        return (
          <text key={ax.label} x={p.x} y={p.y} textAnchor="middle" className="fill-wt-text-low text-[10px]">
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}

export function PieChart({
  segments,
  size = 160,
  className,
}: {
  segments: Array<{ label: string; value: number; color?: string }>;
  size?: number;
  className?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const colors = ['var(--wt-accent)', 'var(--wt-ok)', 'var(--wt-warn)', 'var(--wt-info)', 'var(--wt-danger)'];
  let angle = -Math.PI / 2;
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const arcs = segments.map((seg, i) => {
    const slice = (seg.value / total) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * r;
    const y1 = cy + Math.sin(angle) * r;
    angle += slice;
    const x2 = cx + Math.cos(angle) * r;
    const y2 = cy + Math.sin(angle) * r;
    const large = slice > Math.PI ? 1 : 0;
    const pct = (seg.value / total) * 100;
    return {
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: seg.color || colors[i % colors.length],
      label: seg.label,
      value: seg.value,
      pct,
    };
  });
  const active = hoverIndex != null ? arcs[hoverIndex] : null;

  return (
    <div className={cn('relative flex items-center gap-4', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label="Distribution chart">
          {arcs.map((a, i) => {
            const isActive = hoverIndex === i;
            const dimmed = hoverIndex != null && !isActive;
            const scale = isActive && !reduceMotion ? 1.04 : 1;
            return (
              <path
                key={a.label}
                d={a.d}
                fill={a.color}
                stroke="var(--wt-bg1)"
                strokeWidth="2"
                opacity={dimmed ? 0.45 : 1}
                transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}
                style={{ cursor: 'pointer', transition: reduceMotion ? undefined : 'opacity 140ms ease, transform 140ms ease' }}
                onPointerEnter={() => setHoverIndex(i)}
                onPointerLeave={() => setHoverIndex(null)}
              >
                <title>{`${a.label} · ${a.value} · ${a.pct.toFixed(0)}%`}</title>
              </path>
            );
          })}
        </svg>
        {active ? (
          <div
            className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-wt-line bg-wt-bg1 px-2.5 py-1 text-[11px] font-medium shadow-[var(--wt-shadow)]"
            role="status"
          >
            <span>{active.label}</span>
            <span className="mx-1 text-wt-text-low">·</span>
            <span className="font-mono tabular-nums">{active.value}</span>
            <span className="mx-1 text-wt-text-low">·</span>
            <span className="font-mono tabular-nums text-wt-text-mid">{active.pct.toFixed(0)}%</span>
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        {segments.map((s, i) => {
          const isActive = hoverIndex === i;
          const dimmed = hoverIndex != null && !isActive;
          return (
            <div
              key={s.label}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 transition-opacity',
                dimmed && 'opacity-45',
                isActive && 'bg-wt-bg3/80',
              )}
              onPointerEnter={() => setHoverIndex(i)}
              onPointerLeave={() => setHoverIndex(null)}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color || colors[i % colors.length] }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="shrink-0 font-mono tabular-nums text-wt-text-low">{s.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CompareBars({
  rows,
}: {
  rows: Array<{ label: string; current: number; previous: number }>;
}) {
  const max = Math.max(...rows.flatMap((r) => [r.current, r.previous]), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 text-sm">{r.label}</div>
          <div className="space-y-1.5">
            <div className="h-3 rounded-full bg-wt-bg3">
              <div className="h-full rounded-full bg-wt-accent" style={{ width: `${(r.current / max) * 100}%` }} />
            </div>
            <div className="h-3 rounded-full bg-wt-bg3">
              <div className="h-full rounded-full bg-wt-text-low/40" style={{ width: `${(r.previous / max) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ series, tone = 'accent' }: { series: number[]; tone?: 'accent' | 'warn' | 'ok' }) {
  const color = tone === 'warn' ? 'var(--wt-warn)' : tone === 'ok' ? 'var(--wt-ok)' : 'var(--wt-accent)';
  return <AreaLineChart series={[series]} height={48} colors={[color]} />;
}

export function demoSeries(n = 48, base = 20, amp = 2, seed = 1) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: n }, (_, i) => base + Math.sin(i / 5) * amp + rnd() * amp);
}

/** Interactive animated Bklit wrappers (preferred for product panels). */
export {
  toBklitRows,
  toLiveLinePoints,
  windowToMs,
  windowToMinutes,
  isLiveWindow,
  dailyToBklitRows,
} from './adapters';
export {
  WtGauge,
  WtTpsGauge,
  WtMsptGauge,
  WtCpuGauge,
  WtDiskGauge,
  WtDiskDualGauge,
  WtLinearDualGauge,
  WtHeapGauge,
  WtThermalGauge,
} from './wt-gauges';
export { WtRing, WtMultiRing } from './wt-ring';
export { WtAreaChart, WtLineChart, WtLiveChart, WtBarChart } from './wt-series';
export { WtHeatmap, matrixToHeatmapColumns } from './wt-heatmap';
export { useChartMotion } from './motion-defaults';
