import type { ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { cn } from '@/lib/utils';
import { toneColor } from '../charts/tone';
import type { Tone } from '../../fixtures';

/** Product StatusPill — severity / state chip. */
export function StatusPill({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 wt-meta',
        className,
      )}
      style={{
        color: toneColor(tone),
        borderColor: `color-mix(in srgb, ${toneColor(tone)} 45%, transparent)`,
        background: `color-mix(in srgb, ${toneColor(tone)} 12%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

/** Product VitalTile — KPI readout strip cell. */
export function VitalTile({
  label,
  value,
  unit,
  hint,
  tone = 'default',
  spark,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: Tone;
  spark?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-card px-4 py-4', className)}>
      <p className="wt-meta m-0 text-muted-foreground">{label}</p>
      <p className="mt-2 m-0 font-mono text-[1.2rem] tabular-nums">
        <span style={{ color: toneColor(tone) }}>{value}</span>
        {unit ? <span className="ml-1 text-[0.7rem] text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 m-0 text-[0.65rem] text-muted-foreground">{hint}</p> : null}
      {spark ? <div className="mt-2 opacity-80">{spark}</div> : null}
    </div>
  );
}

/** Product ChartStatFlow — animated KPI number. */
export function ChartStatFlow({
  value,
  suffix,
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-1 font-mono tabular-nums', className)}>
      <NumberFlow value={value} />
      {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}
