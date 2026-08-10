import { cn } from '@/lib/utils';
import { toneColor } from './tone';
import type { Tone } from '../../fixtures';

/** Product WtGauge-style arc dial (industrial notches, zero radius chrome). */
export function ArcGauge({
  value,
  max = 100,
  label,
  unit = '',
  tone = 'ok',
  ink,
  size = 140,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  unit?: string;
  tone?: Tone;
  ink?: string;
  size?: number;
  className?: string;
}) {
  const color = ink ?? toneColor(tone);
  const pct = Math.min(1, Math.max(0, value / Math.max(max, 1)));
  const r = size * 0.38;
  const stroke = Math.max(8, size * 0.08);
  const c = 2 * Math.PI * r;
  const dash = c * 0.75;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div
      className={cn('relative mx-auto grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? 'Gauge'}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="butt"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash * pct} ${c}`}
          strokeLinecap="butt"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Notch ticks */}
        {Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          const a = (135 + t * 270) * (Math.PI / 180);
          const x1 = cx + Math.cos(a) * (r - stroke * 0.15);
          const y1 = cy + Math.sin(a) * (r - stroke * 0.15);
          const x2 = cx + Math.cos(a) * (r + stroke * 0.35);
          const y2 = cy + Math.sin(a) * (r + stroke * 0.35);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--background)"
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="m-0 font-mono text-[1.35rem] font-semibold tabular-nums leading-none">
            {Number.isInteger(value) ? value : value.toFixed(1)}
            {unit ? <span className="ml-0.5 text-[0.7rem] text-muted-foreground">{unit}</span> : null}
          </p>
          {label ? <p className="mt-1.5 m-0 wt-meta text-muted-foreground">{label}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** Dual linear meter (disk used/free, backup freshness). */
export function DualLinearGauge({
  value,
  label,
  tone = 'warn',
  ink,
}: {
  value: number;
  label?: string;
  tone?: Tone;
  ink?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const color = ink ?? toneColor(tone);
  return (
    <div>
      {label ? (
        <div className="mb-2 flex justify-between text-sm">
          <span>{label}</span>
          <span className="font-mono tabular-nums" style={{ color }}>
            {Math.round(pct)}%
          </span>
        </div>
      ) : null}
      <div className="grid h-3 grid-cols-1 border border-border bg-background">
        <div className="relative h-full w-full">
          <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: color }} />
          <div
            className="absolute inset-y-0 right-0 bg-muted"
            style={{ width: `${100 - pct}%` }}
          />
        </div>
      </div>
      <div className="mt-1 flex justify-between wt-meta text-muted-foreground">
        <span>used</span>
        <span>free</span>
      </div>
    </div>
  );
}
