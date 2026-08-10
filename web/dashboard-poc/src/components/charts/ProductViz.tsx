import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { toneColor } from './tone';
import type { Tone } from '../../fixtures';

const DEFAULT_COLORS = [
  'var(--primary)',
  'var(--wt-ok)',
  'var(--wt-warn)',
  'var(--wt-info)',
  'var(--wt-danger)',
];

export type PieSegment = { label: string; value: number; color?: string };

/** Product-parity pie + legend (industrial: zero radius). */
export function PieChart({
  segments,
  size = 140,
  className,
  dense = false,
}: {
  segments: PieSegment[];
  size?: number;
  className?: string;
  dense?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;

  const arcs = useMemo(() => {
    let angle = -Math.PI / 2;
    return segments.map((seg, i) => {
      const slice = (seg.value / total) * Math.PI * 2;
      const x1 = cx + Math.cos(angle) * r;
      const y1 = cy + Math.sin(angle) * r;
      angle += slice;
      const x2 = cx + Math.cos(angle) * r;
      const y2 = cy + Math.sin(angle) * r;
      const large = slice > Math.PI ? 1 : 0;
      return {
        d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
        color: seg.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]!,
        label: seg.label,
        value: seg.value,
        pct: (seg.value / total) * 100,
      };
    });
  }, [segments, total, cx, cy, r]);

  const active = hover != null ? arcs[hover] : null;

  return (
    <div className={cn('relative flex items-center gap-3', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label="Distribution">
          {arcs.map((a, i) => (
            <path
              key={a.label}
              d={a.d}
              fill={a.color}
              stroke="var(--background)"
              strokeWidth={2}
              opacity={hover != null && hover !== i ? 0.4 : 1}
              style={{ cursor: 'pointer' }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <title>{`${a.label} · ${a.value} · ${a.pct.toFixed(0)}%`}</title>
            </path>
          ))}
        </svg>
        {active ? (
          <p className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap border border-border bg-card px-2 py-1 font-mono text-[0.7rem]">
            {active.label} · {active.value} · {active.pct.toFixed(0)}%
          </p>
        ) : null}
      </div>
      <ul className={cn('m-0 min-w-0 list-none space-y-1 p-0', dense ? 'text-[0.75rem]' : 'text-sm')}>
        {segments.map((s, i) => (
          <li
            key={s.label}
            className={cn(
              'flex cursor-pointer items-center gap-2 px-1 py-0.5',
              hover != null && hover !== i && 'opacity-45',
            )}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span
              className="inline-block size-2.5 shrink-0"
              style={{ background: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length] }}
            />
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-mono tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Product-parity area sparkline (Overview vitals). */
export function Sparkline({
  series,
  tone = 'ok',
  ink,
  className,
  height = 40,
}: {
  series: number[];
  tone?: Tone;
  ink?: string;
  className?: string;
  height?: number;
}) {
  const color = ink ?? toneColor(tone);
  const w = 120;
  const pad = 2;
  const pts = series.length ? series : [0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(0.001, max - min);
  const coords = pts.map((v, i) => {
    const x = pad + (i / Math.max(1, pts.length - 1)) * (w - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const line = coords.join(' ');
  const area = `${pad},${height - pad} ${line} ${w - pad},${height - pad}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className={cn('w-full', className)}
      style={{ height }}
      role="img"
      aria-label="Sparkline"
    >
      <polygon points={area} fill={color} opacity={0.18} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

/** Product BarMeter — zero-radius industrial track. */
export function BarMeter({
  label,
  value,
  valueLabel,
  tone = 'ok',
  ink,
}: {
  label: string;
  value: number;
  valueLabel?: string;
  tone?: Tone;
  ink?: string;
}) {
  const color = ink ?? toneColor(tone);
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">
          {valueLabel ?? `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden border border-border bg-background">
        <div className="h-full origin-left" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Current vs previous compare bars (World / Spark). */
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
          <p className="mb-1 m-0 text-sm">{r.label}</p>
          <div className="space-y-1.5">
            <div className="h-2.5 border border-border bg-background">
              <div
                className="h-full bg-primary"
                style={{ width: `${(r.current / max) * 100}%` }}
              />
            </div>
            <div className="h-2.5 border border-border bg-background">
              <div
                className="h-full bg-muted-foreground/40"
                style={{ width: `${(r.previous / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Hour-of-day bars (Insights schedule). */
export function HourBars({ hours, ink }: { hours: number[]; ink?: string }) {
  const max = Math.max(...hours, 1);
  const color = ink ?? 'var(--primary)';
  return (
    <div className="flex h-24 items-end gap-px" role="img" aria-label="Hour bars">
      {hours.map((h, i) => (
        <div
          key={i}
          className="min-w-0 flex-1"
          title={`${i}:00 · ${h.toFixed(1)}`}
          style={{
            height: `${Math.max(4, (h / max) * 100)}%`,
            background: color,
            opacity: 0.3 + (h / max) * 0.7,
          }}
        />
      ))}
    </div>
  );
}
