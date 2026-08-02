import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { Gauge } from '@/components/charts/gauge';
import { useChartMotion } from './motion-defaults';

export type GaugeTone = 'ok' | 'warn' | 'danger' | 'accent' | 'thermal' | 'tps' | 'mspt' | 'cpu' | 'disk' | 'heap';

function useIsDarkTheme() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof document === 'undefined') return () => {};
      const obs = new MutationObserver(onStoreChange);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
      return () => obs.disconnect();
    },
    () =>
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.documentElement.getAttribute('data-theme') === 'black',
    () => true,
  );
}

const GRADIENTS: Record<GaugeTone, readonly [string, string]> = {
  ok: ['#34d399', '#10b981'],
  warn: ['#fbbf24', '#f59e0b'],
  danger: ['#f87171', '#ef4444'],
  accent: ['#38bdf8', '#0ea5e9'],
  thermal: ['#22d3ee', '#ef4444'],
  tps: ['#34d399', '#22c55e'],
  mspt: ['#fbbf24', '#f97316'],
  cpu: ['#a78bfa', '#7c3aed'],
  disk: ['#38bdf8', '#0284c7'],
  heap: ['#fb7185', '#e11d48'],
};

const INACTIVE: Record<GaugeTone, string> = {
  ok: 'color-mix(in srgb, #10b981 18%, transparent)',
  warn: 'color-mix(in srgb, #f59e0b 18%, transparent)',
  danger: 'color-mix(in srgb, #ef4444 18%, transparent)',
  accent: 'color-mix(in srgb, #0ea5e9 18%, transparent)',
  thermal: 'color-mix(in srgb, #22d3ee 16%, transparent)',
  tps: 'color-mix(in srgb, #22c55e 18%, transparent)',
  mspt: 'color-mix(in srgb, #f97316 18%, transparent)',
  cpu: 'color-mix(in srgb, #7c3aed 18%, transparent)',
  disk: 'color-mix(in srgb, #0284c7 18%, transparent)',
  heap: 'color-mix(in srgb, #e11d48 18%, transparent)',
};

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n));
}

function toneForPct(pct: number, invert = false): GaugeTone {
  const p = invert ? 100 - pct : pct;
  if (p >= 85) return 'danger';
  if (p >= 65) return 'warn';
  return 'ok';
}

export function WtGauge({
  value,
  max = 100,
  label,
  suffix = '%',
  prefix,
  tone,
  className,
  centerValue,
  compact = false,
  size,
}: {
  value: number;
  max?: number;
  label: string;
  suffix?: string;
  prefix?: string;
  tone?: GaugeTone;
  className?: string;
  /** Override animated center number (defaults to raw value). */
  centerValue?: number;
  /** Tighter fixed size for small panels (e.g. Overview Storage). */
  compact?: boolean;
  /** Explicit square size in px (overrides compact default). */
  size?: number;
}) {
  const { gaugeEnter } = useChartMotion();
  const pct = clampPct((value / Math.max(1e-6, max)) * 100);
  const resolvedTone = tone ?? toneForPct(pct);
  const display = centerValue ?? value;
  const sizePx = size ?? (compact ? 188 : 160);
  const tight = sizePx <= 128;

  return (
    <div className={cn('mx-auto shrink-0', className)} style={{ width: sizePx, height: sizePx }}>
      <Gauge
        width={sizePx}
        height={sizePx}
        value={pct}
        centerValue={display}
        defaultLabel={label}
        suffix={suffix}
        prefix={prefix}
        useGradient
        activeGradient={GRADIENTS[resolvedTone]}
        inactiveFill={INACTIVE[resolvedTone]}
        enterTransition={gaugeEnter}
        totalNotches={tight || compact ? 32 : 48}
        spacing={tight || compact ? 24 : 18}
        uniformWidth
      />
    </div>
  );
}

/** TPS dial: full = healthy 20 TPS; empty = stalled. Color worsens as TPS drops. */
export function WtTpsGauge({
  value,
  className,
  size,
}: {
  value: number;
  className?: string;
  size?: number;
}) {
  const tps = Math.min(20, Math.max(0, value));
  const pressure = ((20 - tps) / 20) * 100;
  const tone: GaugeTone = pressure >= 25 ? (pressure >= 50 ? 'danger' : 'warn') : 'tps';
  return (
    <WtGauge
      value={tps}
      max={20}
      label="TPS"
      suffix=""
      tone={tone}
      centerValue={Number(tps.toFixed(1))}
      className={className}
      size={size}
    />
  );
}

/** MSPT dial: 0–50ms scale; warn/crit as tick time rises. */
export function WtMsptGauge({
  value,
  className,
  size,
}: {
  value: number;
  className?: string;
  size?: number;
}) {
  const ms = Math.max(0, value);
  const tone: GaugeTone = ms >= 50 ? 'danger' : ms >= 35 ? 'warn' : 'mspt';
  return (
    <WtGauge
      value={Math.min(50, ms)}
      max={50}
      label="MSPT"
      suffix="ms"
      tone={tone}
      centerValue={Number(ms.toFixed(1))}
      className={className}
      size={size}
    />
  );
}

export function WtCpuGauge({
  value,
  className,
  size,
}: {
  value: number;
  className?: string;
  size?: number;
}) {
  return (
    <WtGauge value={value} max={100} label="CPU" suffix="%" tone="cpu" className={className} size={size} />
  );
}

export function WtDiskGauge({
  value,
  className,
  compact,
  size,
}: {
  value: number;
  className?: string;
  compact?: boolean;
  size?: number;
}) {
  return (
    <WtGauge
      value={value}
      max={100}
      label="Disk"
      suffix="%"
      tone="disk"
      className={className}
      compact={compact}
      size={size}
    />
  );
}

/**
 * Disk dial with Bklit dual-arc gradients (active + inactive notch gradients).
 * Prefer this for Storage panels — fixed square size avoids the 21:16 responsive clip.
 */
export function WtDiskDualGauge({
  value,
  className,
  size = 200,
}: {
  value: number;
  className?: string;
  size?: number;
}) {
  const { gaugeEnter } = useChartMotion();
  const pct = clampPct(value);
  const dark = useIsDarkTheme();

  return (
    <div className={cn('mx-auto', className)} style={{ width: size, height: size }}>
      <Gauge
        width={size}
        height={size}
        value={pct}
        centerValue={Number(pct.toFixed(0))}
        defaultLabel="Disk"
        suffix="%"
        useGradient
        activeGradient={dark ? (['#7dd3fc', '#0284c7'] as const) : (['#38bdf8', '#0284c7'] as const)}
        inactiveGradient={dark ? (['#1e293b', '#475569'] as const) : (['#e2e8f0', '#94a3b8'] as const)}
        enterTransition={gaugeEnter}
        totalNotches={48}
        spacing={18}
        uniformWidth
      />
    </div>
  );
}

/** Linear notch gauge with dual gradients — for progress strips (e.g. pregen). */
export function WtLinearDualGauge({
  value,
  label = 'Progress',
  tone = 'ok',
  className,
  showLabel = true,
}: {
  value: number;
  label?: string;
  tone?: 'ok' | 'warn' | 'danger' | 'accent';
  className?: string;
  showLabel?: boolean;
}) {
  const { gaugeEnter } = useChartMotion();
  const pct = clampPct(value);
  const dark = useIsDarkTheme();
  const activeGradient =
    tone === 'warn'
      ? (['#fbbf24', '#d97706'] as const)
      : tone === 'danger'
        ? (['#fca5a5', '#ef4444'] as const)
        : tone === 'accent'
          ? (['#38bdf8', '#0284c7'] as const)
          : (['#34d399', '#059669'] as const);
  const inactiveGradient =
    tone === 'danger'
      ? dark
        ? (['#3f1d1d', '#7f1d1d'] as const)
        : (['#fee2e2', '#fca5a5'] as const)
      : tone === 'warn'
        ? dark
          ? (['#3f2e14', '#92400e'] as const)
          : (['#fef3c7', '#fcd34d'] as const)
        : dark
          ? (['#1e293b', '#475569'] as const)
          : (['#e2e8f0', '#94a3b8'] as const);

  return (
    <div className={cn('w-full min-w-0', className)}>
      <Gauge
        orientation="linear"
        value={pct}
        centerValue={showLabel ? Number(pct.toFixed(1)) : undefined}
        defaultLabel={label}
        suffix="%"
        labelPlacement="top"
        labelAlign="end"
        useGradient
        activeGradient={activeGradient}
        inactiveGradient={inactiveGradient}
        enterTransition={gaugeEnter}
        linearHeight={32}
        totalNotches={40}
        spacing={20}
        uniformWidth
        minWidth={140}
      />
    </div>
  );
}

export function WtHeapGauge({
  usedMb,
  maxMb,
  className,
  size,
}: {
  usedMb: number;
  maxMb: number;
  className?: string;
  size?: number;
}) {
  const pct = maxMb > 0 ? (usedMb / maxMb) * 100 : 0;
  return (
    <WtGauge
      value={pct}
      max={100}
      label="Heap"
      suffix="%"
      tone="heap"
      centerValue={Number(pct.toFixed(0))}
      className={className}
      size={size}
    />
  );
}

/**
 * Thermal dial — cool→hot gradient. Maps °C onto a 40–100°C package scale by default.
 */
export function WtThermalGauge({
  celsius,
  label = 'Package',
  minC = 35,
  maxC = 100,
  className,
  size,
}: {
  celsius: number;
  label?: string;
  minC?: number;
  maxC?: number;
  className?: string;
  size?: number;
}) {
  const { gaugeEnter } = useChartMotion();
  const c = Number.isFinite(celsius) ? celsius : 0;
  const pct = clampPct(((c - minC) / Math.max(1e-6, maxC - minC)) * 100);
  const sizePx = size ?? 160;
  const tight = sizePx <= 128;

  return (
    <div className={cn('mx-auto shrink-0', className)} style={{ width: sizePx, height: sizePx }}>
      <Gauge
        width={sizePx}
        height={sizePx}
        value={pct}
        centerValue={Number(c.toFixed(1))}
        defaultLabel={label}
        suffix="°C"
        useGradient
        activeGradient={GRADIENTS.thermal}
        inactiveFill={INACTIVE.thermal}
        enterTransition={gaugeEnter}
        totalNotches={tight ? 32 : 56}
        spacing={tight ? 24 : 16}
        uniformWidth
        valueClassName="font-bold tabular-nums leading-none text-[clamp(1.05rem,28cqw,2.15rem)]"
        labelClassName="max-w-full truncate leading-tight text-[clamp(0.65rem,10cqw,0.8rem)]"
      />
    </div>
  );
}
