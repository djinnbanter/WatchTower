import { Area, AreaChart } from '@/components/charts/area-chart';
import { Line, LineChart } from '@/components/charts/line-chart';
import { Bar } from '@/components/charts/bar';
import { BarChart } from '@/components/charts/bar-chart';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { LiveLine } from '@/components/charts/live-line';
import { LiveLineChart } from '@/components/charts/live-line-chart';
import { LiveXAxis } from '@/components/charts/live-x-axis';
import { LiveYAxis } from '@/components/charts/live-y-axis';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import type { ChartStatus, LoadingStyle } from '@/components/charts/chart-phase';
import { cn } from '@/lib/utils';
import type { BklitRow } from './adapters';
import { useChartMotion } from './motion-defaults';

export type SeriesSpec = {
  dataKey: string;
  color: string;
  type?: 'area' | 'line';
};

export function WtAreaChart({
  data,
  series,
  className,
  aspectRatio = '16 / 9',
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  /** Enter clip-reveal duration. Defaults to motion preset. */
  animationDuration: animationDurationProp,
  /** Path + Y-domain morph when `xDomain` changes (brush-style zoom). */
  yDomainTweenDuration,
  status: statusProp,
  loadingLabel,
  loadingStyle = 'pulse',
}: {
  data: BklitRow[] | Record<string, unknown>[];
  series: SeriesSpec[];
  className?: string;
  aspectRatio?: string;
  /** Brush-style viewport — changing this zooms/pans the series (Live window). */
  xDomain?: [Date, Date];
  xDomainSlotCount?: number;
  tweenYDomainOnXDomainChange?: boolean;
  animationDuration?: number;
  yDomainTweenDuration?: number;
  /** Explicit chart phase. Defaults to ready when data exists. */
  status?: ChartStatus;
  loadingLabel?: string;
  loadingStyle?: LoadingStyle;
}) {
  const { animationDuration: motionDuration, enterTransition } = useChartMotion();
  // Keep enter reveal on the motion preset; window zoom morph uses yDomainTweenDuration.
  const animationDuration = animationDurationProp ?? motionDuration;
  const morphMs = yDomainTweenDuration ?? animationDuration;
  const liveSlide = xDomain != null && morphMs <= 0;
  const status: ChartStatus =
    statusProp ?? (data.length > 0 ? 'ready' : 'loading');
  const isLoading = status === 'loading';

  return (
    <div className={cn('h-56 w-full min-h-[12rem]', className)}>
      <AreaChart
        data={data as Record<string, unknown>[]}
        status={status}
        loadingLabel={loadingLabel}
        aspectRatio={aspectRatio}
        animationDuration={animationDuration}
        enterTransition={enterTransition}
        xDomain={xDomain}
        xDomainSlotCount={xDomainSlotCount}
        tweenYDomainOnXDomainChange={tweenYDomainOnXDomainChange}
        yDomainTweenDuration={morphMs}
        yDomainTween={!liveSlide}
        className="h-full w-full"
      >
        <Grid
          horizontal
          loadingStroke="color-mix(in oklch, var(--chart-grid) 50%, transparent)"
          shimmer={!liveSlide}
          shimmerSync={!liveSlide}
          stroke="var(--chart-grid)"
        />
        <XAxis />
        <YAxis />
        {!isLoading ? <ChartTooltip /> : null}
        {series.map((s) =>
          s.type === 'line' ? (
            <Line
              key={s.dataKey}
              animate={!liveSlide}
              dataKey={s.dataKey}
              loadingStyle={loadingStyle}
              loadingStroke="var(--foreground)"
              loadingStrokeOpacity={0.5}
              stroke={s.color}
            />
          ) : (
            <Area
              key={s.dataKey}
              animate={!liveSlide}
              dataKey={s.dataKey}
              fadeEdges
              fill={s.color}
              fillOpacity={0.35}
              loadingStroke="var(--foreground)"
              loadingStrokeOpacity={0.5}
              loadingStyle={loadingStyle}
              stroke={s.color}
              strokeWidth={2}
            />
          ),
        )}
      </AreaChart>
    </div>
  );
}

export function WtLineChart({
  data,
  series,
  className,
  aspectRatio = '16 / 9',
}: {
  data: BklitRow[] | Record<string, unknown>[];
  series: SeriesSpec[];
  className?: string;
  aspectRatio?: string;
}) {
  const { animationDuration, enterTransition } = useChartMotion();
  const ready = data.length > 0;

  return (
    <div className={cn('h-56 w-full min-h-[12rem]', className)}>
      <LineChart
        data={data as Record<string, unknown>[]}
        status={ready ? 'ready' : 'loading'}
        aspectRatio={aspectRatio}
        animationDuration={animationDuration}
        enterTransition={enterTransition}
        className="h-full w-full"
      >
        <Grid />
        <XAxis />
        <YAxis />
        <ChartTooltip />
        {series.map((s) => (
          <Line key={s.dataKey} dataKey={s.dataKey} stroke={s.color} />
        ))}
      </LineChart>
    </div>
  );
}

export function WtLiveChart({
  points,
  color = 'var(--wt-ch-tps)',
  windowSec = 120,
  className,
}: {
  points: { time: number; value: number }[];
  color?: string;
  windowSec?: number;
  className?: string;
}) {
  const latest = points.length ? points[points.length - 1]!.value : 0;

  return (
    <div className={cn('relative h-48 w-full min-w-0 overflow-hidden', className)}>
      <LiveLineChart
        data={points}
        value={latest}
        window={windowSec}
        className="h-full w-full overflow-hidden"
        style={{ height: '100%' }}
      >
        <Grid />
        <LiveXAxis />
        <LiveYAxis />
        <ChartTooltip showDatePill={false} />
        <LiveLine dataKey="value" stroke={color} />
      </LiveLineChart>
    </div>
  );
}

export function WtBarChart({
  data,
  dataKey = 'value',
  xDataKey = 'name',
  color = 'var(--wt-accent)',
  series,
  stacked = false,
  stackGap = 0,
  className,
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  xDataKey?: string;
  color?: string;
  /** When set, renders multiple bars (optionally stacked). */
  series?: { dataKey: string; color: string; label?: string }[];
  stacked?: boolean;
  /** Pixel gap between stacked segments. Default: 0 (flush). */
  stackGap?: number;
  className?: string;
}) {
  const { animationDuration, enterTransition } = useChartMotion();
  const ready = data.length > 0;
  const bars =
    series && series.length > 0
      ? series
      : [{ dataKey, color, label: undefined as string | undefined }];
  const isStacked = stacked && bars.length > 1;
  const stackGapPx = isStacked ? stackGap : 0;

  return (
    <div className={cn('h-56 w-full', className)}>
      <BarChart
        data={data}
        xDataKey={xDataKey}
        stacked={isStacked}
        stackGap={stackGapPx}
        margin={{ top: 8, right: 8, bottom: 40, left: 36 }}
        status={ready ? 'ready' : 'loading'}
        animationDuration={animationDuration}
        enterTransition={enterTransition}
        className="h-full w-full"
      >
        <Grid horizontal />
        {isStacked ? <BarXAxis /> : <XAxis />}
        <YAxis />
        <ChartTooltip />
        {bars.map((s) => (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            fill={s.color}
            lineCap={isStacked ? 'butt' : 'round'}
            stackGap={stackGapPx}
          />
        ))}
      </BarChart>
    </div>
  );
}
