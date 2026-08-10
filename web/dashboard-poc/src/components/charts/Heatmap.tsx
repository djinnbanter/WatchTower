import { Fragment } from 'react';
import { cn } from '@/lib/utils';

/** Insights schedule-style heatmap (CSS grid). */
export function Heatmap({
  values,
  rows,
  cols,
  ink = 'var(--wt-ch-mspt, var(--primary))',
  formatValue,
  className,
}: {
  values: number[][];
  rows: string[];
  cols: string[];
  ink?: string;
  formatValue?: (v: number) => string;
  className?: string;
}) {
  let min = Infinity;
  let max = -Infinity;
  for (const row of values) {
    for (const v of row) {
      if (!Number.isFinite(v)) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    min = 0;
    max = 1;
  }
  const span = max - min;

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div
        className="grid gap-px bg-border"
        style={{
          gridTemplateColumns: `4.5rem repeat(${cols.length}, minmax(1.75rem, 1fr))`,
        }}
      >
        <div className="bg-background" />
        {cols.map((c) => (
          <div
            key={c}
            className="bg-background px-0.5 py-1 text-center font-mono text-[0.6rem] text-muted-foreground"
          >
            {c}
          </div>
        ))}
        {rows.map((rowLabel, ri) => (
          <Fragment key={rowLabel}>
            <div className="flex items-center bg-background px-2 font-mono text-[0.65rem] text-muted-foreground">
              {rowLabel}
            </div>
            {(values[ri] ?? []).map((v, ci) => {
              const t = (v - min) / span;
              return (
                <div
                  key={`${ri}-${ci}`}
                  title={`${rowLabel} ${cols[ci]}: ${formatValue?.(v) ?? v}`}
                  className="flex min-h-7 items-center justify-center bg-background font-mono text-[0.6rem] tabular-nums"
                  style={{
                    background: `color-mix(in srgb, ${ink} ${Math.round(12 + t * 78)}%, var(--background))`,
                    color: t > 0.55 ? 'var(--foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  {formatValue ? formatValue(v) : v.toFixed(0)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 wt-meta text-muted-foreground">
        <span>low</span>
        <div
          className="h-1.5 flex-1 border border-border"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, ${ink} 12%, var(--background)), ${ink})`,
          }}
        />
        <span>high</span>
      </div>
    </div>
  );
}

export function demoHeatmap(): { values: number[][]; rows: string[]; cols: string[] } {
  const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cols = ['00', '04', '08', '12', '16', '20'];
  const values = rows.map((_, ri) =>
    cols.map((_, ci) => Math.round(20 + ((ri * 3 + ci * 7) % 11) * 4 + (ci === 4 ? 18 : 0))),
  );
  return { values, rows, cols };
}

/** Simplified storage treemap (product StorageTreemap shape). */
export function SimpleTreemap({
  nodes,
  className,
}: {
  nodes: Array<{ id: string; label: string; value: number; tone?: string }>;
  className?: string;
}) {
  const total = nodes.reduce((s, n) => s + n.value, 0) || 1;
  const sorted = [...nodes].sort((a, b) => b.value - a.value);

  return (
    <div
      className={cn(
        'grid min-h-40 grid-cols-6 grid-rows-4 gap-px border border-border bg-border',
        className,
      )}
      role="img"
      aria-label="Treemap"
    >
      {sorted.map((n, i) => {
        const share = n.value / total;
        const span = Math.max(1, Math.round(share * 12));
        const colSpan = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(span * 2))));
        const rowSpan = Math.min(4, Math.max(1, Math.ceil(span / colSpan)));
        return (
          <div
            key={n.id}
            className="flex flex-col justify-between p-2"
            style={{
              gridColumn: `span ${colSpan}`,
              gridRow: `span ${i === 0 ? Math.min(4, rowSpan + 1) : rowSpan}`,
              background: `color-mix(in srgb, ${n.tone ?? 'var(--primary)'} 35%, var(--card))`,
            }}
            title={`${n.label}: ${n.value}`}
          >
            <p className="m-0 truncate text-[0.7rem] font-medium">{n.label}</p>
            <p className="m-0 font-mono text-[0.75rem] tabular-nums">{n.value}</p>
          </div>
        );
      })}
    </div>
  );
}
