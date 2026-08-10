import {
  Cell,
  Label,
  Pie,
  PieChart as RechartsPie,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  Treemap,
} from 'recharts';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
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

/** shadcn Chart + Recharts pie (product PieChart job). */
export function DeskPieChart({
  segments,
  className,
}: {
  segments: Array<{ name: string; value: number; fill: string }>;
  className?: string;
}) {
  const config = Object.fromEntries(
    segments.map((s) => [s.name, { label: s.name, color: s.fill }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={cn('mx-auto aspect-square h-44 w-full max-w-[14rem]', className)}>
      <RechartsPie>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
        <Pie data={segments} dataKey="value" nameKey="name" stroke="var(--background)" strokeWidth={2}>
          {segments.map((s) => (
            <Cell key={s.name} fill={s.fill} />
          ))}
        </Pie>
      </RechartsPie>
    </ChartContainer>
  );
}

/** Horseshoe dial — open arc (not a full ring). Radii scale to the container. */
export function DeskRadialGauge({
  value,
  max = 100,
  label,
  unit = '',
  color = 'var(--primary)',
  className,
}: {
  value: number;
  max?: number;
  label: string;
  /** Optional suffix on the value (e.g. `%`). */
  unit?: string;
  color?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100));
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const data = [{ name: label, value: pct, fill: color }];
  const config = { [label]: { label, color } } satisfies ChartConfig;
  const { ref, half } = useHalfSize(72);
  const outer = half * 0.96;
  const inner = half * 0.66;
  const valueSize = half < 48 ? 16 : half < 64 ? 18 : 20;
  const unitSize = Math.max(9, valueSize * 0.45);

  return (
    <div ref={ref} className={cn('mx-auto aspect-square max-h-36 w-full', className)}>
      <ChartContainer config={config} className="aspect-square h-full w-full">
        <RadialBarChart
          data={data}
          startAngle={225}
          endAngle={-45}
          innerRadius={inner}
          outerRadius={outer}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          {/* Track comes from RadialBar `background` — same horseshoe span, not PolarGrid (full circle). */}
          <RadialBar
            dataKey="value"
            background={{ fill: 'var(--muted)' }}
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
                      y={cy - 4}
                      className="font-mono tabular-nums"
                      style={{ fill: color, fontSize: valueSize }}
                    >
                      {display}
                      {unit ? (
                        <tspan
                          className="fill-muted-foreground font-mono"
                          style={{ fontSize: unitSize }}
                          dx={1}
                        >
                          {unit}
                        </tspan>
                      ) : null}
                    </tspan>
                    <tspan
                      x={cx}
                      y={cy + Math.max(14, valueSize * 0.85)}
                      className="fill-muted-foreground uppercase tracking-wide"
                      style={{ fontSize: 9 }}
                    >
                      {label}
                    </tspan>
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

/** shadcn Chart + Recharts treemap (product StorageTreemap job). */
export function DeskTreemap({
  nodes,
  className,
}: {
  nodes: Array<{ name: string; size: number; fill: string }>;
  className?: string;
}) {
  const config = {
    size: { label: 'Size' },
    ...Object.fromEntries(nodes.map((n) => [n.name, { label: n.name, color: n.fill }])),
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={cn('aspect-auto h-48 w-full', className)}>
      <Treemap
        data={nodes}
        dataKey="size"
        nameKey="name"
        stroke="var(--border)"
        fill="var(--primary)"
        isAnimationActive={false}
        content={({ x, y, width, height, name, fill }) => {
          if (width < 4 || height < 4) return <g />;
          return (
            <g>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fill as string}
                stroke="var(--border)"
              />
              {width > 48 && height > 28 ? (
                <text
                  x={(x ?? 0) + 6}
                  y={(y ?? 0) + 16}
                  fill="var(--foreground)"
                  fontSize={10}
                  fontFamily="var(--font-mono, monospace)"
                >
                  {String(name)}
                </text>
              ) : null}
            </g>
          );
        }}
      />
    </ChartContainer>
  );
}
