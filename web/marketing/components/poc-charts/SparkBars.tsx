'use client';

import { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { toneColor, type Tone } from './tone';

/** Compact spark for vitals / KPI strips — Recharts bar, industrial. */
export function SparkBars({
  samples,
  tone = 'default',
  ink,
  className,
}: {
  samples: number[];
  tone?: Tone;
  ink?: string;
  className?: string;
}) {
  const color = ink ?? toneColor(tone);
  const data = useMemo(
    () => samples.map((v, i) => ({ i, v: Math.max(0.05, v) })),
    [samples],
  );
  const config: ChartConfig = {
    v: { label: 'Sample', color },
  };

  return (
    <ChartContainer
      config={config}
      className={cn('mt-2 aspect-auto h-5 w-full', className)}
      initialDimension={{ width: 160, height: 20 }}
      aria-hidden
    >
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="i" hide />
        <YAxis domain={[0, 1]} hide />
        <Bar dataKey="v" fill="var(--color-v)" radius={0} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
