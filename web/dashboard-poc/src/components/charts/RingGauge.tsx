'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  Label,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

function useHalfSize(fallback = 80) {
  const ref = useRef<HTMLDivElement>(null);
  const [half, setHalf] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const s = Math.min(el.clientWidth, el.clientHeight);
      setHalf(Math.max(20, s / 2));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, half };
}

/** Disk / percent ring — radii scale to the container (no clipped PolarGrid). */
export function RingGauge({
  pct,
  ink,
  label,
  className,
  sizeClassName = 'mx-auto aspect-square max-h-[8.5rem] w-full',
}: {
  /** 0–100 */
  pct: number;
  ink: string;
  label?: string;
  className?: string;
  sizeClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const { ref, half } = useHalfSize(80);
  const outer = half * 0.96;
  const inner = half * 0.66;
  const polarOuter = half * 0.86;
  const polarInner = half * 0.74;
  const valueSize = half < 48 ? 18 : half < 64 ? 22 : 28;
  const chartData = [{ name: 'value', value: clamped, fill: ink }];
  const chartConfig = {
    value: { label: label ?? 'value' },
    ring: { label: label ?? 'value', color: ink },
  } satisfies ChartConfig;

  return (
    <div ref={ref} className={cn('w-full', sizeClassName, className)}>
      <ChartContainer
        config={chartConfig}
        className="aspect-square h-full w-full"
        role="img"
        aria-label={label ? `${label} ${Math.round(clamped)}%` : `${Math.round(clamped)}%`}
      >
        <RadialBarChart
          data={chartData}
          startAngle={90}
          endAngle={-270}
          innerRadius={inner}
          outerRadius={outer}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <PolarGrid
            gridType="circle"
            radialLines={false}
            stroke="none"
            className="first:fill-muted last:fill-background"
            polarRadius={[polarOuter, polarInner]}
          />
          <RadialBar
            dataKey="value"
            background
            cornerRadius={0}
            isAnimationActive={false}
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                const cx = viewBox.cx ?? 0;
                const cy = viewBox.cy ?? 0;
                return (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x={cx}
                      y={label ? cy - 4 : cy}
                      className="font-mono tabular-nums"
                      style={{ fill: ink, fontSize: valueSize }}
                    >
                      {Math.round(clamped)}
                    </tspan>
                    <tspan
                      className="fill-muted-foreground font-mono"
                      style={{ fontSize: Math.max(10, valueSize * 0.45) }}
                      dx={2}
                    >
                      %
                    </tspan>
                    {label ? (
                      <tspan
                        x={cx}
                        y={cy + Math.max(14, valueSize * 0.7)}
                        className="fill-muted-foreground uppercase tracking-wide"
                        style={{ fontSize: 9 }}
                      >
                        {label}
                      </tspan>
                    ) : null}
                  </text>
                );
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
    </div>
  );
}
