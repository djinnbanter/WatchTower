import { RingChart } from '@/components/charts/ring-chart';
import { Ring } from '@/components/charts/ring';
import { RingCenter } from '@/components/charts/ring-center';
import type { RingData } from '@/components/charts/ring-context';
import { cn } from '@/lib/utils';
import { useChartMotion } from './motion-defaults';

export function WtRing({
  value,
  max = 100,
  label,
  color = 'var(--wt-accent)',
  suffix = '%',
  className,
}: {
  value: number;
  max?: number;
  label: string;
  color?: string;
  suffix?: string;
  className?: string;
}) {
  const { enterTransition, reduced } = useChartMotion();
  const clamped = Math.min(max, Math.max(0, value));
  const data: RingData[] = [
    {
      label,
      value: clamped,
      maxValue: max,
      color,
    },
  ];

  return (
    <div className={cn('mx-auto h-40 w-40', className)}>
      <RingChart
        data={data}
        strokeWidth={14}
        ringGap={6}
        baseInnerRadius={48}
        enterTransition={enterTransition}
        enterStaggerScale={reduced ? 0 : 1}
        className="h-full w-full"
      >
        <Ring index={0} showGlow lineCap="round" />
        <RingCenter defaultLabel={label} suffix={suffix} />
      </RingChart>
    </div>
  );
}

export function WtMultiRing({
  rings,
  className,
  centerLabel = 'Load',
  centerSuffix = '%',
}: {
  rings: { label: string; value: number; max?: number; color?: string }[];
  className?: string;
  centerLabel?: string;
  centerSuffix?: string;
}) {
  const { enterTransition, reduced } = useChartMotion();
  const data: RingData[] = rings.map((r) => ({
    label: r.label,
    value: Math.min(r.max ?? 100, Math.max(0, r.value)),
    maxValue: r.max ?? 100,
    color: r.color,
  }));

  return (
    <div className={cn('mx-auto h-44 w-44', className)}>
      <RingChart
        data={data}
        strokeWidth={11}
        ringGap={5}
        baseInnerRadius={36}
        enterTransition={enterTransition}
        enterStaggerScale={reduced ? 0 : 1}
        className="h-full w-full"
      >
        {data.map((_, i) => (
          <Ring key={i} index={i} showGlow lineCap="round" />
        ))}
        <RingCenter defaultLabel={centerLabel} suffix={centerSuffix} />
      </RingChart>
    </div>
  );
}
