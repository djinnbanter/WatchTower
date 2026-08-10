import { useMemo, useState } from 'react';
import {
  LIVE,
  type LiveMetric,
  type LiveSeries,
  type LiveWindowId,
} from '../fixtures';
import { useNav } from '../nav';
import { SeriesChart, RingGauge, SparkBars, HashMeter, toneColor, LIVE_WINDOW_MS, valueAtFullFromMetric } from './charts';
import { MetaButton } from '@/components/ui/desk';
import { cn } from '@/lib/utils';
import { Plate } from './Plate';
import { DeskHero, DeskSignal, PageHeader } from './PageHero';
import { DeskPage } from './layout/DeskPage';

type ChartMode = 'bar' | 'line';

function windowPoints(id: LiveWindowId): number {
  return LIVE.windows.find((w) => w.id === id)?.points ?? 36;
}

function slice(series: number[], points: number): number[] {
  return series.slice(-points);
}

function seriesInk(t: LiveSeries): string {
  if (t.ink) return t.ink;
  if (t.tone === 'default') return 'var(--wt-text-mid)';
  return toneColor(t.tone);
}

function toTracks(tracks: LiveSeries[]) {
  return tracks.map((t) => ({
    id: t.id,
    label: t.label,
    series: t.series,
    color: seriesInk(t),
  }));
}

function chartValueAtFull(metric: LiveMetric): number {
  const primary = metric.series[0]?.series ?? [];
  return valueAtFullFromMetric(metric.value, primary);
}

function chartValueAtFullByTrack(metric: LiveMetric): Record<string, number> | undefined {
  if (metric.series.length <= 1) return undefined;
  const out: Record<string, number> = {};
  for (const s of metric.series) {
    // Multi-track cards share the headline unit; scale each series to its own last sample
    // so relative shapes stay honest when only one headline value exists.
    out[s.id] = valueAtFullFromMetric(metric.value, s.series);
  }
  return out;
}

function ModeToggle({
  mode,
  onChange,
  ink,
}: {
  mode: ChartMode;
  onChange: (m: ChartMode) => void;
  ink?: string;
}) {
  return (
    <div className="flex border border-border" role="group" aria-label="Chart type">
      {(['bar', 'line'] as const).map((m) => (
        <MetaButton
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'rounded-none border-0',
            mode === m ? 'bg-[color:var(--wt-accent-soft)] text-primary' : 'text-muted-foreground',
          )}
          style={
            mode === m && ink
              ? { background: `color-mix(in srgb, ${ink} 18%, transparent)`, color: ink }
              : undefined
          }
        >
          {m === 'bar' ? 'Bar' : 'Line'}
        </MetaButton>
      ))}
    </div>
  );
}

function ChartCard({
  metric,
  points,
  windowId,
}: {
  metric: LiveMetric;
  points: number;
  windowId: LiveWindowId;
}) {
  const [mode, setMode] = useState<ChartMode>('bar');
  const ink = seriesInk(metric.series[0] ?? { id: '', label: '', series: [], tone: metric.tone });

  return (
    <Plate className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="m-0 text-[0.9375rem] font-semibold text-foreground">{metric.label}</h3>
          <p className="mt-1 m-0 wt-meta text-muted-foreground">{metric.hint}</p>
          {metric.series.length > 1 ? (
            <p className="mt-2 m-0 flex flex-wrap gap-3 wt-meta text-muted-foreground">
              {metric.series.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2"
                    style={{ backgroundColor: seriesInk(s) }}
                  />
                  {s.label}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="m-0 font-mono text-[1.25rem] tabular-nums" style={{ color: ink }}>
            {metric.value}
            {metric.unit ? (
              <span className="ml-1 text-[0.65rem] text-muted-foreground">{metric.unit}</span>
            ) : null}
          </p>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>
      <div className="px-5 py-4">
        <SeriesChart
          tracks={toTracks(metric.series)}
          points={points}
          mode={mode}
          windowMs={LIVE_WINDOW_MS[windowId]}
          unit={metric.unit || undefined}
          valueAtFull={chartValueAtFull(metric)}
          valueAtFullByTrack={chartValueAtFullByTrack(metric)}
        />
      </div>
    </Plate>
  );
}

const THERMAL_HOT = '#E05A3C';
const THERMAL_COOL = '#6A9A8B';

function ThermalSensorPane({
  metric,
  points,
  windowId,
  celsius,
  minC,
  maxC,
  ink,
  vibe,
}: {
  metric: LiveMetric;
  points: number;
  windowId: LiveWindowId;
  celsius: number;
  minC: number;
  maxC: number;
  ink: string;
  vibe: string;
}) {
  const [mode, setMode] = useState<ChartMode>('line');
  const tracks: LiveSeries[] = metric.series.map((s) => ({ ...s, ink }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="wt-meta m-0" style={{ color: ink }}>
            {metric.label}
          </p>
          <h3 className="mt-2 m-0 text-[1.05rem] font-semibold text-foreground">{vibe}</h3>
          <p className="mt-1 m-0 text-[0.75rem] text-muted-foreground">
            {metric.hint} · {minC}–{maxC}°C
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="m-0 font-mono text-[2rem] tabular-nums leading-none" style={{ color: ink }}>
            {celsius}
            <span className="ml-1 text-[0.7rem] text-muted-foreground">°C</span>
          </p>
          <ModeToggle mode={mode} onChange={setMode} ink={ink} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
        <SeriesChart
          tracks={toTracks(tracks)}
          points={points}
          mode={mode}
          className="min-h-[14rem] flex-1"
          windowMs={LIVE_WINDOW_MS[windowId]}
          unit="°C"
          valueAtFull={valueAtFullFromMetric(String(celsius), metric.series[0]?.series ?? [])}
        />
      </div>
    </div>
  );
}

function ThermalDeltaPane({ packageC, ambientC }: { packageC: number; ambientC: number }) {
  const delta = packageC - ambientC;
  const scaleMin = Math.floor((ambientC - 8) / 10) * 10;
  const scaleMax = Math.ceil((packageC + 10) / 10) * 10;
  const span = Math.max(1, scaleMax - scaleMin);
  const pct = (c: number) => Math.min(100, Math.max(0, ((c - scaleMin) / span) * 100));
  const ambPct = pct(ambientC);
  const pkgPct = pct(packageC);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--wt-bg1)]">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[color:var(--wt-line)] px-5 py-4">
        <div className="min-w-0">
          <p className="wt-meta m-0" style={{ color: THERMAL_HOT }}>
            Delta
          </p>
          <h3 className="mt-2 m-0 text-[1.05rem] font-semibold text-[color:var(--wt-text)]">
            Package rise
          </h3>
          <p className="mt-1 m-0 text-[0.75rem] text-[color:var(--wt-text-mid)]">
            Die heat above room air
          </p>
        </div>
        <p className="m-0 font-mono text-[2rem] tabular-nums leading-none" style={{ color: THERMAL_HOT }}>
          +{delta}
          <span className="ml-1 text-[0.7rem] text-[color:var(--wt-text-low)]">°C</span>
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-5 px-5 py-5">
        {/* Shared-scale rails */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="m-0 wt-meta" style={{ color: THERMAL_HOT }}>
              Package
            </p>
            <p className="m-0 font-mono text-[0.8rem] tabular-nums" style={{ color: THERMAL_HOT }}>
              {packageC}°C
            </p>
          </div>
          <HashMeter
            value={pkgPct}
            ink={THERMAL_HOT}
            trackClassName="h-3"
            aria-label={`Package ${packageC} degrees`}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="m-0 wt-meta" style={{ color: THERMAL_COOL }}>
              Ambient
            </p>
            <p className="m-0 font-mono text-[0.8rem] tabular-nums" style={{ color: THERMAL_COOL }}>
              {ambientC}°C
            </p>
          </div>
          <HashMeter
            value={ambPct}
            ink={THERMAL_COOL}
            trackClassName="h-3"
            aria-label={`Ambient ${ambientC} degrees`}
          />
        </div>

        {/* Rise span on shared scale */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="m-0 wt-meta text-[color:var(--wt-text-low)]">Rise on scale</p>
            <p className="m-0 font-mono text-[0.7rem] tabular-nums text-[color:var(--wt-text-mid)]">
              {scaleMin}–{scaleMax}°C
            </p>
          </div>
          <div className="relative h-2 bg-[color:var(--wt-bg0)]" role="img" aria-label={`Rise ${delta} degrees`}>
            <div
              className="absolute inset-y-0"
              style={{
                left: `${ambPct}%`,
                width: `${Math.max(2, pkgPct - ambPct)}%`,
                background: `linear-gradient(90deg, ${THERMAL_COOL} 0%, ${THERMAL_HOT} 100%)`,
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 border border-[color:var(--wt-line)]"
            />
            {/* End ticks */}
            <div
              aria-hidden
              className="absolute inset-y-0 w-px"
              style={{ left: `${ambPct}%`, background: THERMAL_COOL }}
            />
            <div
              aria-hidden
              className="absolute inset-y-0 w-px"
              style={{ left: `${pkgPct}%`, background: THERMAL_HOT }}
            />
          </div>
          <div className="mt-2 flex justify-between wt-meta text-[color:var(--wt-text-low)]">
            <span>amb</span>
            <span>pkg</span>
          </div>
        </div>

        <p className="m-0 border-t border-[color:var(--wt-line)] pt-3 wt-meta text-[color:var(--wt-text-low)]">
          Above ambient
        </p>
      </div>
    </div>
  );
}

function ThermalSection({
  metrics,
  points,
  windowId,
}: {
  metrics: LiveMetric[];
  points: number;
  windowId: LiveWindowId;
}) {
  const pkg = metrics.find((m) => m.id === 'thermal_package');
  const amb = metrics.find((m) => m.id === 'thermal_ambient');
  if (!pkg || !amb) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {metrics.map((m) => (
          <ChartCard key={m.id} metric={m} points={points} windowId={windowId} />
        ))}
      </div>
    );
  }

  return (
    <Plate className="grid gap-px overflow-hidden bg-[color:var(--wt-line)] lg:grid-cols-3">
      <ThermalSensorPane
        metric={pkg}
        points={points}
        windowId={windowId}
        celsius={68}
        minC={30}
        maxC={100}
        ink={THERMAL_HOT}
        vibe="Chip die heat"
      />
      <ThermalSensorPane
        metric={amb}
        points={points}
        windowId={windowId}
        celsius={32}
        minC={10}
        maxC={50}
        ink={THERMAL_COOL}
        vibe="Room intake"
      />
      <ThermalDeltaPane packageC={68} ambientC={32} />
    </Plate>
  );
}

const NET_RX = '#4C8EC7';
const NET_TX = '#C47A2C';

function NetworkFlowMark({ direction, ink }: { direction: 'rx' | 'tx'; ink: string }) {
  // Print chevrons — RX arrives (>>), TX leaves (<<)
  const points =
    direction === 'rx'
      ? [
          'M2 2 L8 8 L2 14',
          'M10 2 L16 8 L10 14',
          'M18 2 L24 8 L18 14',
        ]
      : [
          'M10 2 L4 8 L10 14',
          'M18 2 L12 8 L18 14',
          'M26 2 L20 8 L26 14',
        ];
  return (
    <svg viewBox="0 0 28 16" className="h-3.5 w-7 shrink-0" aria-hidden>
      {points.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={ink}
          strokeWidth={1.5}
          strokeLinecap="square"
          strokeLinejoin="miter"
          opacity={0.4 + i * 0.25}
        />
      ))}
    </svg>
  );
}

function NetworkLinkPane({
  metric,
  points,
  windowId,
  direction,
}: {
  metric: LiveMetric;
  points: number;
  windowId: LiveWindowId;
  direction: 'rx' | 'tx';
}) {
  const [mode, setMode] = useState<ChartMode>('bar');
  const ink = direction === 'rx' ? NET_RX : NET_TX;
  const track = metric.series[0];
  const samples = track ? slice(track.series, points) : [];
  const nowNorm = samples[samples.length - 1] ?? 0;
  const peakNorm = Math.max(...samples, 0.01);
  const fill = Math.min(1, nowNorm / peakNorm);
  const mbps = Number.parseFloat(metric.value) || 0;
  const peakMbps = nowNorm > 0.001 ? mbps * (peakNorm / nowNorm) : mbps;
  const tracks: LiveSeries[] = track ? [{ ...track, ink }] : [];

  return (
    <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--wt-line)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <NetworkFlowMark direction={direction} ink={ink} />
            <p className="wt-meta m-0" style={{ color: ink }}>
              {direction === 'rx' ? 'Inbound' : 'Outbound'}
            </p>
          </div>
          <h3 className="mt-2 m-0 text-[1.05rem] font-semibold text-[color:var(--wt-text)]">
            {metric.label}
          </h3>
          <p className="mt-1 m-0 text-[0.75rem] text-[color:var(--wt-text-mid)]">
            {direction === 'rx' ? 'Receive · host interface' : 'Transmit · host interface'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="m-0 font-mono text-[2rem] tabular-nums leading-none" style={{ color: ink }}>
            {metric.value}
            <span className="ml-1 text-[0.7rem] text-[color:var(--wt-text-low)]">{metric.unit}</span>
          </p>
          <ModeToggle mode={mode} onChange={setMode} ink={ink} />
        </div>
      </div>

      <div className="border-b border-border px-5 py-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="m-0 wt-meta text-muted-foreground">Load vs window peak</p>
          <p className="m-0 font-mono text-[0.75rem] tabular-nums" style={{ color: ink }}>
            {Math.round(fill * 100)}%
            <span className="text-muted-foreground">
              {' '}
              · peak {peakMbps.toFixed(1)} {metric.unit}
            </span>
          </p>
        </div>
        <HashMeter value={fill * 100} ink={ink} trackClassName="h-4" />
      </div>

      <div className="flex flex-1 flex-col px-5 py-4">
        <SeriesChart
          tracks={toTracks(tracks.length ? tracks : metric.series)}
          points={points}
          mode={mode}
          windowMs={LIVE_WINDOW_MS[windowId]}
          unit={metric.unit}
          valueAtFull={chartValueAtFull(metric)}
        />
      </div>
    </div>
  );
}

function NetworkSection({
  metrics,
  points,
  windowId,
}: {
  metrics: LiveMetric[];
  points: number;
  windowId: LiveWindowId;
}) {
  const rx = metrics.find((m) => m.id === 'net_rx_mbps');
  const tx = metrics.find((m) => m.id === 'net_tx_mbps');
  if (!rx || !tx) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {metrics.map((m) => (
          <ChartCard key={m.id} metric={m} points={points} windowId={windowId} />
        ))}
      </div>
    );
  }

  return (
    <Plate className="grid gap-px overflow-hidden bg-[color:var(--wt-line)] md:grid-cols-2">
      <NetworkLinkPane metric={rx} points={points} windowId={windowId} direction="rx" />
      <NetworkLinkPane metric={tx} points={points} windowId={windowId} direction="tx" />
    </Plate>
  );
}

const DISK_USED = '#E6B422';
const DISK_READ = '#3D9B8F';
const DISK_WRITE = '#B85C38';

/** Shared rail heights so column rules line up across the 3-split plate. */
const DISK_HEAD = 'flex h-11 shrink-0 items-center border-b border-[color:var(--wt-line)] px-4';
const DISK_FOOT = 'h-14 shrink-0 border-t border-[color:var(--wt-line)]';

function DiskRing({ pct }: { pct: number }) {
  return <RingGauge pct={pct} ink={DISK_USED} label="used" />;
}

function DiskIoPane({
  label,
  ink,
  value,
  unit,
  series,
  points,
  windowId,
}: {
  label: string;
  ink: string;
  value: string;
  unit: string;
  series: number[];
  points: number;
  windowId: LiveWindowId;
}) {
  return (
    <div className="flex min-h-0 flex-col bg-card">
      <div className={`${DISK_HEAD} justify-between gap-3`}>
        <p className="wt-meta m-0" style={{ color: ink }}>
          {label}
        </p>
        <p className="m-0 font-mono text-[1.1rem] tabular-nums leading-none" style={{ color: ink }}>
          {value}
          <span className="ml-1 text-[0.65rem] text-muted-foreground">{unit}</span>
        </p>
      </div>
      <div className="flex min-h-[10rem] flex-1 flex-col px-4 py-4">
        <SeriesChart
          tracks={[{ id: label.toLowerCase(), label, series, color: ink }]}
          points={points}
          mode="bar"
          className="min-h-[10rem] flex-1"
          windowMs={LIVE_WINDOW_MS[windowId]}
          unit={unit}
          valueAtFull={valueAtFullFromMetric(value, series)}
        />
      </div>
    </div>
  );
}

function DiskSection({
  metrics,
  points,
  windowId,
}: {
  metrics: LiveMetric[];
  points: number;
  windowId: LiveWindowId;
}) {
  const use = metrics.find((m) => m.id === 'disk_use_pct');
  const io = metrics.find((m) => m.id === 'disk_io');
  const rest = metrics.filter((m) => m.id !== 'disk_use_pct' && m.id !== 'disk_io');
  const pct = use ? Number.parseFloat(use.value) || 0 : 0;
  const free = Math.max(0, 100 - pct);
  const runway =
    use?.hint?.match(/~\d+\s*d/i)?.[0]?.replace(/\s+/g, '') ??
    use?.hint ??
    '-';
  const readTrack = io?.series.find((s) => s.id.includes('read'));
  const writeTrack = io?.series.find((s) => s.id.includes('write'));
  const [readStr, writeStr] = (io?.value ?? '0 / 0').split(/\s*\/\s*/);

  return (
    <div className="flex flex-col gap-3">
      {rest.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
          {rest.map((m) => (
            <ChartCard key={m.id} metric={m} points={points} windowId={windowId} />
          ))}
        </div>
      ) : null}

      {use && io && readTrack && writeTrack ? (
        <Plate className="grid gap-px overflow-hidden bg-[color:var(--wt-line)] md:grid-cols-3">
          {/* 1 — Disk use */}
          <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
            <div className={DISK_HEAD}>
              <p className="wt-meta m-0" style={{ color: DISK_USED }}>
                Disk use
              </p>
            </div>
            <div className="flex min-h-[10rem] flex-1 items-center justify-center px-4 py-4">
              <DiskRing pct={pct} />
            </div>
            <div
              className={`${DISK_FOOT} grid grid-cols-2 gap-px bg-[color:var(--wt-line)]`}
            >
              <div className="flex h-full flex-col items-center justify-center bg-[color:var(--wt-bg1)] px-3">
                <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Free</p>
                <p className="mt-0.5 m-0 font-mono text-[0.95rem] tabular-nums leading-none text-[color:var(--wt-text)]">
                  {free}%
                </p>
              </div>
              <div className="flex h-full flex-col items-center justify-center bg-[color:var(--wt-bg1)] px-3">
                <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Runway</p>
                <p className="mt-0.5 m-0 font-mono text-[0.95rem] tabular-nums leading-none text-[color:var(--wt-text)]">
                  {runway}
                </p>
              </div>
            </div>
          </div>

          {/* 2 — Read */}
          <DiskIoPane
            label="Read"
            ink={DISK_READ}
            value={readStr ?? '0'}
            unit={io.unit}
            series={readTrack.series}
            points={points}
            windowId={windowId}
          />

          {/* 3 — Write */}
          <DiskIoPane
            label="Write"
            ink={DISK_WRITE}
            value={writeStr ?? '0'}
            unit={io.unit}
            series={writeTrack.series}
            points={points}
            windowId={windowId}
          />
        </Plate>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {[use, io].filter(Boolean).map((m) => (
            <ChartCard key={m!.id} metric={m!} points={points} windowId={windowId} />
          ))}
        </div>
      )}
    </div>
  );
}

function groupTitle(group: LiveMetric['group']): string {
  if (group === 'game') return 'Game vitals';
  if (group === 'host') return 'Host & storage';
  if (group === 'network') return 'Network';
  return 'Heat · sensors';
}

function groupHint(group: LiveMetric['group']): string {
  if (group === 'game') return 'Tick health, heap, entities — from live samples';
  if (group === 'host') return 'CPU, RAM, disk utilisation and I/O';
  if (group === 'network') return 'Interface bandwidth';
  return 'Package vs ambient · host sensors';
}

/**
 * Live POC — full metric set from dashboard LIVE_SERIES_KEYS (+ sample entities/chunks),
 * ops-board layout, per-card bar/line toggle.
 */
export function Live() {
  const { setPage } = useNav();
  const [windowId, setWindowId] = useState<LiveWindowId>('1h');
  const points = windowPoints(windowId);

  const kpis = useMemo(() => LIVE.metrics.filter((m) => m.kpi), []);
  const groups = useMemo(() => {
    const order: LiveMetric['group'][] = ['game', 'host', 'network', 'thermal'];
    return order
      .map((g) => ({
        id: g,
        title: groupTitle(g),
        hint: groupHint(g),
        metrics: LIVE.metrics.filter((m) => m.group === g),
      }))
      .filter((g) => g.metrics.length > 0);
  }, []);

  return (
    <DeskPage>
        <PageHeader
          group="Monitor"
          title="Live"
          sub="Is the server okay right now? Same range on every panel - toggle bar or line per card."
          aside={
            <>
              <p className="wt-meta inline-flex items-center gap-2 text-[color:var(--wt-text-low)]">
                <span aria-hidden className="inline-block h-2 w-2 bg-[color:var(--wt-ok)]" />
                {LIVE.sampleAge} · poll {LIVE.pollEvery}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="self-center wt-meta text-[color:var(--wt-text-low)]">Range</span>
                {LIVE.windows.map((w) => {
                  const on = windowId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWindowId(w.id)}
                      className={`border px-3 py-2 wt-meta ${
                        on
                          ? 'border-[color:var(--wt-accent)] bg-[color:var(--wt-accent-soft)] text-[color:var(--wt-accent)]'
                          : 'border-[color:var(--wt-line)] text-[color:var(--wt-text-low)] hover:border-[color:var(--wt-text-mid)]'
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </>
          }
        />

        <DeskHero
          label="Health"
          title={LIVE.verdict}
          titleColor={toneColor(LIVE.verdictTone)}
          detail={LIVE.verdictDetail}
          sideLabel="Signals"
          side={
            <>
              <ul className="mt-4 m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                {LIVE.signals.map((s) => (
                  <DeskSignal
                    key={s.id}
                    title={s.title}
                    detail={s.detail}
                    toneColor={toneColor(s.tone)}
                  />
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setPage('issues')}
                className="mt-5 cursor-pointer wt-meta text-[color:var(--wt-accent)] hover:text-[color:var(--wt-text)]"
              >
                Open Fix queue →
              </button>
            </>
          }
        />

        <section aria-label="Key vitals">
          <div className="mb-3 px-0.5 wt-meta text-[color:var(--wt-text-low)]">
            Key vitals · {LIVE.windows.find((w) => w.id === windowId)?.label}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((m) => {
              const ink = seriesInk(m.series[0]!);
              return (
              <Plate key={m.id} className="px-4 py-4">
                <p className="wt-meta text-[color:var(--wt-text-low)]">{m.label}</p>
                <p
                  className="mt-2 font-mono text-[1.35rem] tabular-nums"
                  style={{ color: ink }}
                >
                  {m.value}
                  {m.unit ? (
                    <span className="ml-1 text-[0.65rem] text-[color:var(--wt-text-low)]">
                      {m.unit}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-[0.65rem] text-[color:var(--wt-text-low)]">{m.hint}</p>
                <SparkBars samples={slice(m.series[0]!.series, 12)} tone={m.tone} ink={ink} />
              </Plate>
              );
            })}
          </div>
        </section>

        {groups.map((g) => (
          <section key={g.id} aria-labelledby={`live-${g.id}`} className="flex flex-col gap-3">
            <div className="px-0.5">
              <h2 id={`live-${g.id}`} className="wt-meta text-[color:var(--wt-text-low)]">
                {g.title}
              </h2>
              <p className="mt-1 text-[0.75rem] text-[color:var(--wt-text-mid)]">{g.hint}</p>
            </div>
            {g.id === 'thermal' ? (
              <ThermalSection metrics={g.metrics} points={points} windowId={windowId} />
            ) : g.id === 'network' ? (
              <NetworkSection metrics={g.metrics} points={points} windowId={windowId} />
            ) : g.id === 'host' ? (
              <DiskSection metrics={g.metrics} points={points} windowId={windowId} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                {g.metrics.map((m) => (
                  <ChartCard key={m.id} metric={m} points={points} windowId={windowId} />
                ))}
              </div>
            )}
          </section>
        ))}

        <section aria-labelledby="jobs-title" className="flex flex-col gap-3">
          <h2 id="jobs-title" className="px-0.5 wt-meta text-[color:var(--wt-text-low)]">
            World background jobs
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {LIVE.jobs.map((j) => (
              <Plate key={j.name} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="m-0 text-[0.875rem] font-semibold text-[color:var(--wt-text)]">
                    {j.name}
                  </p>
                  <span className="wt-meta text-[color:var(--wt-text-low)]">{j.status}</span>
                </div>
                <p className="mt-2 m-0 text-[0.75rem] text-[color:var(--wt-text-mid)]">{j.detail}</p>
              </Plate>
            ))}
          </div>
        </section>

        <footer className="px-0.5 pb-2">
          <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">
            POC · metrics from Live series keys + sample entities/chunks · bar/line per card
          </p>
        </footer>
    </DeskPage>
  );
}
