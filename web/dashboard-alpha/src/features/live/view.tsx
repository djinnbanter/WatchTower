import { startTransition, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  Gauge as GaugeIcon,
  HardDrive,
  Network,
  Thermometer,
} from '@/ui/icons';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import BorderGlow from '@/components/border-glow/BorderGlow';
import { decimateTimeSeries } from '@/components/charts/decimate-time-series';
import {
  FadeIn,
  PageEnter,
  Stagger,
  useDeferredIntro,
} from '@/ui/motion';
import {
  Button,
  EmptyState,
  ErrorState,
  LIST_CAP,
  MetricReadout,
  Section,
  StatusPill,
} from '@/ui/patterns';
import {
  ChartFrame,
  toBklitRows,
  windowToMinutes,
  WtAreaChart,
  WtDiskGauge,
  WtGauge,
  WtHeapGauge,
  WtLinearDualGauge,
  WtMsptGauge,
  WtThermalGauge,
  WtTpsGauge,
  WtCpuGauge,
} from '@/ui/charts';
import type { SeriesSpec } from '@/ui/charts/wt-series';
import { asArray, asRecord, bool, get, num, str } from '@/lib/utils';
import './live.css';

/** How often the Live page refetches `/api/live` + samples (mod still samples ~1s). */
const LIVE_REFETCH_MS = 5_000;

type FeedTone = 'ok' | 'warn' | 'danger';

type WindowRange = { start: Date; end: Date };
const severityTone: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  critical: 'danger',
  warning: 'warn',
  info: 'info',
  ok: 'ok',
  pass: 'ok',
  wait: 'danger',
  caution: 'warn',
  safe: 'ok',
};

function statusBorderGlowProps(tone: FeedTone) {
  if (tone === 'danger') {
    return {
      glowColor: '0 84 60',
      glowIntensity: 1.15,
      colors: ['#f87171', '#fb7185', '#fbbf24'] as string[],
      fillOpacity: 0.45,
    };
  }
  if (tone === 'warn') {
    return {
      glowColor: '38 92 55',
      glowIntensity: 1.05,
      colors: ['#fbbf24', '#fb923c', '#f472b6'] as string[],
      fillOpacity: 0.4,
    };
  }
  return {
    glowColor: '160 72 42',
    glowIntensity: 0.95,
    colors: ['#34d399', '#22d3ee', '#60a5fa'] as string[],
    fillOpacity: 0.35,
  };
}

function hasLiveSample(latest: Record<string, unknown> | null | undefined): boolean {
  if (!latest || Object.keys(latest).length === 0) return false;
  return latest.tps != null || latest.mspt != null || latest.polled_at != null;
}

function sampleAgeSec(latest: Record<string, unknown>, live: Record<string, unknown>): number | null {
  const relativeAges = [
    latest.sample_age_sec,
    live.sample_age_sec,
    get(live, 'bandwidth', 'sample_age_sec'),
    get(live, 'disk_io', 'sample_age_sec'),
  ];
  for (const rawAge of relativeAges) {
    const age = num(rawAge, NaN);
    if (Number.isFinite(age)) return age;
  }
  const polled = str(latest.polled_at, str(live.polled_at));
  if (!polled) return null;
  const ms = Date.now() - Date.parse(polled);
  return Number.isFinite(ms) ? Math.max(0, ms / 1000) : null;
}

const HERO_DIAL = 148;

/** Full history kept in-chart; presets + custom range zoom client-side. */
const HISTORY_WINDOW = '30d' as const;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1h
const MIN_WINDOW_MS = 60_000;
/** Shared cap so every Live chart reuses one lean series (no per-chart LTTB on 7k pts). */
const LIVE_CHART_MAX_POINTS = 420;
const LIVE_DECIMATE_KEYS = [
  'tps',
  'mspt',
  'host_cpu',
  'heap_mb',
  'mem_used_gb',
  'disk_use_pct',
  'players',
  'thermal_package',
  'thermal_ambient',
  'net_rx_mbps',
  'net_tx_mbps',
  'disk_read_mb_s',
  'disk_write_mb_s',
];

const WINDOW_PRESETS = [
  { value: '5m', label: '5m', ms: 5 * 60_000 },
  { value: '15m', label: '15m', ms: 15 * 60_000 },
  { value: '1h', label: '1h', ms: 60 * 60_000 },
  { value: '6h', label: '6h', ms: 6 * 60 * 60_000 },
  { value: '24h', label: '24h', ms: 24 * 60 * 60_000 },
  { value: '7d', label: '7d', ms: 7 * 24 * 60 * 60_000 },
  { value: '30d', label: '30d', ms: 30 * 24 * 60 * 60_000 },
] as const;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** `datetime-local` value in the user's local timezone. */
function toDatetimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatWindowSpan(selection: WindowRange | null | undefined): string {
  if (!selection) return 'full';
  const ms = Math.max(0, selection.end.getTime() - selection.start.getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < hour) return `${Math.max(1, Math.round(ms / minute))}m`;
  if (ms < day) {
    const hours = ms / hour;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  const days = ms / day;
  return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

function selectionFromEnd(rows: { date: Date }[], windowMs: number): WindowRange | undefined {
  if (rows.length < 2) return undefined;
  const end = rows[rows.length - 1]!.date;
  const dataStart = rows[0]!.date.getTime();
  const start = new Date(Math.max(dataStart, end.getTime() - windowMs));
  return { start, end };
}

/** Rows are time-sorted — bisect instead of scanning the full 30d series. */
function lowerBoundByTime(rows: { date: Date }[], timeMs: number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid]!.date.getTime() < timeMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBoundByTime(rows: { date: Date }[], timeMs: number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid]!.date.getTime() <= timeMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sliceRowsByWindow(
  rows: ReturnType<typeof toBklitRows>,
  selection: WindowRange | null,
): ReturnType<typeof toBklitRows> {
  if (!selection || rows.length < 2) return rows;
  const from = lowerBoundByTime(rows, selection.start.getTime());
  const to = upperBoundByTime(rows, selection.end.getTime());
  return rows.slice(from, to);
}

function setLiveWindow(
  next: WindowRange | undefined | null,
  setChartWindow: (value: WindowRange) => void,
) {
  if (!next) return;
  startTransition(() => setChartWindow(next));
}

function clampWindowRange(
  start: Date,
  end: Date,
  rows: { date: Date }[],
): WindowRange | null {
  if (rows.length < 2) return null;
  const dataStart = rows[0]!.date.getTime();
  const dataEnd = rows[rows.length - 1]!.date.getTime();
  let a = start.getTime();
  let b = end.getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a > b) [a, b] = [b, a];
  a = Math.max(dataStart, Math.min(a, dataEnd));
  b = Math.max(dataStart, Math.min(b, dataEnd));
  if (b - a < MIN_WINDOW_MS) {
    if (b - dataStart >= MIN_WINDOW_MS) a = b - MIN_WINDOW_MS;
    else b = Math.min(dataEnd, a + MIN_WINDOW_MS);
  }
  return { start: new Date(a), end: new Date(b) };
}

function activePresetValue(selection: WindowRange | null | undefined): string | null {
  if (!selection) return null;
  const ms = selection.end.getTime() - selection.start.getTime();
  let best: (typeof WINDOW_PRESETS)[number] | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const preset of WINDOW_PRESETS) {
    const delta = Math.abs(preset.ms - ms);
    if (delta < bestDelta) {
      best = preset;
      bestDelta = delta;
    }
  }
  return best && bestDelta <= best.ms * 0.08 ? best.value : null;
}

/** ChartFrame + WtAreaChart — window zooms snap (no per-chart load/morph tax). */
function SeriesChart({
  title,
  rows,
  series,
  loading,
  loadingStyle = 'pulse',
  loadingLabel,
  error,
  empty,
  actions,
}: {
  title: string;
  rows: ReturnType<typeof toBklitRows>;
  series: SeriesSpec[];
  loading?: boolean;
  loadingStyle?: 'pulse' | 'sweep';
  loadingLabel?: string;
  error?: string | null;
  empty?: boolean;
  actions?: ReactNode;
}) {
  const status = loading ? 'loading' : 'ready';
  const showEmpty = !loading && !!empty;

  return (
    <ChartFrame
      title={title}
      layer="watching"
      className="lv-chart-card"
      error={error}
      empty={showEmpty}
      actions={actions}
    >
      <WtAreaChart
        animationDuration={0}
        data={rows}
        series={series}
        status={status}
        loadingLabel={loadingLabel ?? (status === 'loading' ? `Loading ${title}…` : undefined)}
        loadingStyle={loadingStyle}
        yDomainTweenDuration={0}
      />
    </ChartFrame>
  );
}

function PregenCard({ title, pregen }: { title: string; pregen: Record<string, unknown> }) {
  const last = asRecord(pregen.last);
  const pct = last.pct != null ? num(last.pct) : num(pregen.percent, num(pregen.progress_pct));
  const active = !!pregen.pregen_active || !!pregen.active;
  const paused = !!pregen.pregen_paused;
  if (pct <= 0 && !active && !last.chunks) return null;

  const dim = str(last.dimension, '—').replace(/^minecraft:/, '');
  const tone = paused ? 'accent' : active ? 'warn' : 'ok';

  return (
    <div className="lv-pregen relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)]">
      <div className="lv-pregen__head">
        <div className="min-w-0">
          <strong className="lv-pregen__title">{title}</strong>
          <div className="lv-pregen__dim">
            {dim}
            {pct > 0 ? <span className="text-wt-text-low"> · {pct.toFixed(1)}%</span> : null}
          </div>
        </div>
        <StatusPill tone={paused ? 'neutral' : active ? 'warn' : 'ok'}>
          {paused ? 'Paused' : active ? 'Active' : 'Recent'}
        </StatusPill>
      </div>
      <div className="lv-pregen__gauge">
        <WtLinearDualGauge value={pct} label={title} tone={tone} showLabel={false} />
      </div>
      <div className="lv-pregen__stats">
        {last.chunks != null ? (
          <div className="lv-pregen__stat">
            <span className="lv-pregen__stat-label">Chunks</span>
            <span className="lv-pregen__stat-value">
              {num(last.chunks).toLocaleString()}
              {last.total != null ? (
                <span className="text-wt-text-low"> / {num(last.total).toLocaleString()}</span>
              ) : null}
            </span>
          </div>
        ) : null}
        {(last.cps ?? last.rate ?? pregen.cps_avg) != null ? (
          <div className="lv-pregen__stat">
            <span className="lv-pregen__stat-label">Rate</span>
            <span className="lv-pregen__stat-value">
              {num(last.cps ?? last.rate ?? pregen.cps_avg).toFixed(1)} cps
            </span>
          </div>
        ) : null}
        {str(last.eta) ? (
          <div className="lv-pregen__stat">
            <span className="lv-pregen__stat-label">ETA</span>
            <span className="lv-pregen__stat-value">{str(last.eta)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PageView({ route: _route }: { route: RouteState }) {
  const liveQ = useQuery({
    queryKey: ['live'],
    queryFn: api.live,
    refetchInterval: LIVE_REFETCH_MS,
  });
  // Load the full history once; brush strip zooms client-side via xDomain.
  const samplesQ = useQuery({
    queryKey: ['samples', 'live-history', HISTORY_WINDOW],
    queryFn: () => api.samples(windowToMinutes(HISTORY_WINDOW), 10_000),
    refetchInterval: LIVE_REFETCH_MS,
    placeholderData: keepPreviousData,
  });
  const opsQ = useQuery({ queryKey: ['ops-cache'], queryFn: api.opsCache });
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });

  const [rows, setRows] = useState<ReturnType<typeof toBklitRows>>([]);
  const [hostOpen, setHostOpen] = useState(false);

  useEffect(() => {
    if (!samplesQ.data) {
      setRows([]);
      return;
    }
    const samples = asRecord(samplesQ.data);
    // Keep history parse off the urgent path so dial intro springs stay smooth on cold load.
    startTransition(() => {
      setRows(toBklitRows(samples, undefined, { take: 20_000 }));
    });
  }, [samplesQ.data]);

  const [chartWindow, setChartWindow] = useState<WindowRange | null>(null);

  useEffect(() => {
    if (chartWindow || rows.length < 2) return;
    const initial = selectionFromEnd(rows, DEFAULT_WINDOW_MS);
    if (initial) setChartWindow(initial);
  }, [chartWindow, rows]);

  const windowRows = useMemo(() => {
    const sliced = sliceRowsByWindow(rows, chartWindow);
    if (sliced.length <= LIVE_CHART_MAX_POINTS) return sliced;
    return decimateTimeSeries(
      sliced as Record<string, unknown>[],
      LIVE_CHART_MAX_POINTS,
      LIVE_DECIMATE_KEYS,
    ) as ReturnType<typeof toBklitRows>;
  }, [chartWindow, rows]);

  const preset = activePresetValue(chartWindow);
  const dataMin = rows[0]?.date;
  const dataMax = rows[rows.length - 1]?.date;

  const applyCustomRange = (startValue: string, endValue: string) => {
    const start = new Date(startValue);
    const end = new Date(endValue);
    const next = clampWindowRange(start, end, rows);
    setLiveWindow(next, setChartWindow);
  };

  const chartLoading = samplesQ.isLoading && !samplesQ.data;
  const chartError = samplesQ.isError ? (samplesQ.error as Error)?.message ?? 'Samples unavailable' : null;
  const chartEmpty = !chartLoading && !chartError && windowRows.length === 0;

  // Defer dial springs until after paint/idle so cold fetch+parse doesn't hitch the intro.
  const livePreview = asRecord(liveQ.data);
  const introArmed = Boolean(liveQ.data) && hasLiveSample(asRecord(livePreview.latest));
  const introReady = useDeferredIntro(introArmed, 320);
  // Charts mount a beat later so gauge springs get a clean frame budget on first visit.
  const chartsReady = useDeferredIntro(introReady, 420);

  if (liveQ.isLoading && !liveQ.data) {
    return (
      <PageEnter className="lv-stack">
        <div className="h-40 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
          ))}
        </div>
      </PageEnter>
    );
  }

  if (liveQ.isError && !liveQ.data) {
    return <ErrorState title="Live feed unavailable">{(liveQ.error as Error)?.message}</ErrorState>;
  }

  const live = asRecord(liveQ.data);
  const latestRaw = asRecord(live.latest);
  const hasSample = hasLiveSample(latestRaw);
  const latest = hasSample ? latestRaw : null;
  const heap = asRecord(latest?.heap_mb);
  const thermal = asRecord(live.thermal);
  const storage = asRecord(live.storage);
  const bandwidth = asRecord(live.bandwidth);
  const diskIo = asRecord(live.disk_io ?? latest?.disk_io);
  const chunky = asRecord(live.chunky_pregen);
  const dh = asRecord(live.dh_pregen);
  const jvmGc = asRecord(latest?.jvm_gc);
  const settings = asRecord(settingsQ.data);
  const ops = asRecord(opsQ.data);
  const signals = asArray<Record<string, unknown>>(get(ops, 'right_now', 'signals'));
  const signalsShown = signals.slice(0, LIST_CAP);
  const signalsMore = Math.max(0, signals.length - LIST_CAP);

  const tpsWarn = num(settings.tps_warn, 19.5);
  const msptWarn = num(settings.mspt_warn, 50);
  const latencyWarnMs = num(settings.disk_io_latency_warn_ms, 50);

  const tps = latest ? num(latest.tps) : 0;
  const mspt = latest ? num(latest.mspt) : 0;
  const cpu = latest ? num(latest.host_cpu_pct) : 0;
  const diskPct = latest ? num(latest.disk_use_pct, num(storage.use_pct)) : 0;
  const packageC = num(thermal.package_c);
  const ambientC = num(thermal.ambient_c);
  const thermalOk = bool(thermal.available) && (packageC > 0 || ambientC > 0);
  const writeLatency = num(
    diskIo.write_latency_ms ?? diskIo.write_await_ms ?? diskIo.await_ms ?? diskIo.latency_ms,
    NaN,
  );
  const hasWriteLatency = Number.isFinite(writeLatency);
  const gcPausePct = num(jvmGc.pause_pct_of_wall, num(latest?.gc_pause_pct, NaN));
  const heapPressure = num(jvmGc.heap_pressure_pct, num(latest?.heap_pressure_pct, NaN));
  const showGc =
    Number.isFinite(gcPausePct) ||
    Number.isFinite(heapPressure) ||
    str(jvmGc.flags_profile) !== '' ||
    rows.some((r) => num(r.gc_pause_pct) > 0);

  const age = sampleAgeSec(latestRaw, live);
  const feedLost = liveQ.isError || (age != null && age > 90);
  const feedStale = !feedLost && age != null && age > 30;
  let feedTone: FeedTone = 'ok';
  if (feedLost) {
    feedTone = 'danger';
  } else if (!hasSample || feedStale) {
    feedTone = 'warn';
  } else if (tps > 0 && tps < tpsWarn) {
    feedTone = 'warn';
  } else if (mspt >= msptWarn) {
    feedTone = 'warn';
  }

  const chunkyShow =
    Object.keys(chunky).length > 0 &&
    (!!chunky.pregen_active || !!chunky.active || !!asRecord(chunky.last).chunks || num(asRecord(chunky.last).pct) > 0);
  const dhShow =
    Object.keys(dh).length > 0 &&
    (!!dh.pregen_active || !!dh.active || !!asRecord(dh.last).chunks || num(asRecord(dh.last).pct) > 0);

  return (
    <PageEnter className="lv-stack">
      <BorderGlow
        className="lv-status-glow"
        backgroundColor="var(--wt-bg1)"
        borderRadius={14}
        edgeSensitivity={25}
        glowRadius={36}
        animated
        {...statusBorderGlowProps(feedTone)}
      >
        <div className={`lv-status lv-status--${feedTone}${feedStale || feedLost ? ' is-stale' : ''}`}>
          {hasSample ? (
            <div className="lv-vitals" aria-label="Live vitals">
              {introReady ? (
                <>
                  <div className="lv-vitals__dial">
                    <WtTpsGauge value={tps} size={HERO_DIAL} />
                  </div>
                  <div className="lv-vitals__dial">
                    <WtMsptGauge value={mspt} size={HERO_DIAL} />
                  </div>
                  <div className="lv-vitals__dial">
                    <WtGauge
                      value={num(latest!.players_online)}
                      max={Math.max(20, num(latest!.players_online))}
                      label="Players"
                      suffix=""
                      tone="accent"
                      centerValue={num(latest!.players_online)}
                      size={HERO_DIAL}
                    />
                  </div>
                  <div className="lv-vitals__dial">
                    <WtHeapGauge usedMb={num(heap.used)} maxMb={num(heap.max)} size={HERO_DIAL} />
                  </div>
                  <div className="lv-vitals__dial">
                    <WtDiskGauge value={diskPct} size={HERO_DIAL} />
                  </div>
                  <div className="lv-vitals__dial">
                    <WtCpuGauge value={cpu} size={HERO_DIAL} />
                  </div>
                </>
              ) : (
                Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="lv-vitals__dial lv-vitals__dial--pending"
                    style={{ width: HERO_DIAL, height: HERO_DIAL }}
                    aria-hidden
                  />
                ))
              )}
            </div>
          ) : (
            <div className="lv-waiting">
              <div className="lv-waiting__title">Waiting for a live sample</div>
              <div className="lv-waiting__detail">
                Charts stay empty until the server posts its first metric tick — no fake TPS.
              </div>
            </div>
          )}
        </div>
      </BorderGlow>

      {hasSample ? (
        <>
          <div className="lv-window-bar">
            <div className="lv-window-bar__meta">
              <span className="lv-window-bar__label">Window</span>
              <strong className="lv-window-bar__value">{formatWindowSpan(chartWindow)}</strong>
            </div>

            <div className="lv-window-bar__presets" role="group" aria-label="Window presets">
              {WINDOW_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`lv-window-bar__preset${preset === p.value ? ' is-active' : ''}`}
                  onClick={() => {
                    setLiveWindow(selectionFromEnd(rows, p.ms), setChartWindow);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="lv-window-bar__custom">
              <label className="lv-window-bar__field">
                <span>From</span>
                <input
                  type="datetime-local"
                  className="lv-window-bar__input"
                  value={chartWindow ? toDatetimeLocalValue(chartWindow.start) : ''}
                  min={dataMin ? toDatetimeLocalValue(dataMin) : undefined}
                  max={dataMax ? toDatetimeLocalValue(dataMax) : undefined}
                  onChange={(e) => {
                    if (!chartWindow) return;
                    applyCustomRange(e.target.value, toDatetimeLocalValue(chartWindow.end));
                  }}
                />
              </label>
              <label className="lv-window-bar__field">
                <span>To</span>
                <input
                  type="datetime-local"
                  className="lv-window-bar__input"
                  value={chartWindow ? toDatetimeLocalValue(chartWindow.end) : ''}
                  min={dataMin ? toDatetimeLocalValue(dataMin) : undefined}
                  max={dataMax ? toDatetimeLocalValue(dataMax) : undefined}
                  onChange={(e) => {
                    if (!chartWindow) return;
                    applyCustomRange(toDatetimeLocalValue(chartWindow.start), e.target.value);
                  }}
                />
              </label>
            </div>
          </div>

          <FadeIn>
            <Section title="Game vitals" icon={GaugeIcon} hint="Primary tick health — same chart stack and intro as Insights.">
              {showGc ? (
                <div className="lv-gc-strip mb-3">
                  {Number.isFinite(gcPausePct) ? (
                    <MetricReadout
                      label="GC pause"
                      value={gcPausePct}
                      unit="% wall"
                      size="sm"
                      tone={gcPausePct > 10 ? 'warn' : 'default'}
                    />
                  ) : null}
                  {Number.isFinite(heapPressure) ? (
                    <MetricReadout
                      label="Heap pressure"
                      value={heapPressure}
                      unit="%"
                      size="sm"
                      tone={heapPressure > 85 ? 'warn' : 'default'}
                    />
                  ) : null}
                  {str(jvmGc.flags_profile) ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">
                        Flags
                      </div>
                      <div className="mt-1 text-sm font-semibold">{str(jvmGc.flags_profile)}</div>
                    </div>
                  ) : null}
                  {str(jvmGc.java_major, str(latest?.java_major)) ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">
                        Java
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {str(jvmGc.java_major, str(latest?.java_major))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {chartsReady ? (
              <div className="lv-chart-grid">
                <SeriesChart
                  title="TPS"
                  rows={windowRows}
                  loading={chartLoading}
                  error={chartError}
                  empty={chartEmpty}
                  series={[{ dataKey: 'tps', color: 'var(--wt-ch-tps)' }]}
                  actions={
                    tps < tpsWarn ? (
                      <span className="lv-chart-meta text-wt-warn">warn &lt; {tpsWarn}</span>
                    ) : undefined
                  }
                />
                <SeriesChart
                  title="MSPT"
                  rows={windowRows}
                  loading={chartLoading}
                  error={chartError}
                  empty={chartEmpty}
                  series={[{ dataKey: 'mspt', color: 'var(--wt-ch-mspt)' }]}
                />
                <SeriesChart
                  title="Heap (MB)"
                  rows={windowRows}
                  loading={chartLoading}
                  error={chartError}
                  empty={chartEmpty}
                  series={[{ dataKey: 'heap_mb', color: 'var(--wt-ch-heap)' }]}
                />
                <SeriesChart
                  title="Players"
                  rows={windowRows}
                  loading={chartLoading}
                  error={chartError}
                  empty={chartEmpty}
                  series={[{ dataKey: 'players', color: 'var(--wt-info)' }]}
                />
              </div>
              ) : (
                <div className="lv-chart-grid lv-chart-grid--pending" aria-hidden>
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="lv-chart-pending" />
                  ))}
                </div>
              )}
            </Section>
          </FadeIn>

          <FadeIn>
            <Section
              title="Host & storage"
              icon={HardDrive}
              hint="CPU, memory, disk utilisation and I/O."
              actions={
                <button type="button" className="text-sm text-wt-text-mid hover:text-wt-text" onClick={() => setHostOpen((v) => !v)}>
                  {hostOpen ? 'Hide charts' : 'Show charts'}
                </button>
              }
            >
              {hostOpen ? (
                <div className="lv-chart-grid">
                  <SeriesChart
                    title="Host CPU %"
                    rows={windowRows}
                    loading={chartLoading}
                    error={chartError}
                    empty={chartEmpty}
                    series={[{ dataKey: 'host_cpu', color: 'var(--wt-ch-cpu)' }]}
                  />
                  <SeriesChart
                    title="RAM used (GB)"
                    rows={windowRows}
                    loading={chartLoading}
                    error={chartError}
                    empty={chartEmpty}
                    series={[{ dataKey: 'mem_used_gb', color: 'var(--wt-accent)' }]}
                  />
                  <SeriesChart
                    title="Disk use %"
                    rows={windowRows}
                    loading={chartLoading}
                    error={chartError}
                    empty={chartEmpty}
                    series={[{ dataKey: 'disk_use_pct', color: 'var(--wt-ch-disk, #38bdf8)' }]}
                  />
                  <SeriesChart
                    title="Disk R/W MB/s"
                    rows={windowRows}
                    loading={chartLoading}
                    error={chartError}
                    empty={chartEmpty}
                    series={[
                      { dataKey: 'disk_read_mb_s', color: 'var(--wt-ok)' },
                      { dataKey: 'disk_write_mb_s', color: 'var(--wt-warn)' },
                    ]}
                    actions={
                      hasWriteLatency ? (
                        <span
                          className={`lv-chart-meta${writeLatency >= latencyWarnMs ? ' text-wt-warn' : ''}`}
                        >
                          Write latency {writeLatency.toFixed(1)} ms
                          {Object.keys(diskIo).length && diskIo.device
                            ? ` · ${str(diskIo.device)}`
                            : ''}
                        </span>
                      ) : diskIo.read_mb_s != null || diskIo.write_mb_s != null ? (
                        <span className="lv-chart-meta">
                          Now {num(diskIo.read_mb_s).toFixed(1)} / {num(diskIo.write_mb_s).toFixed(1)} MB/s
                        </span>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-wt-text-low">
                  Host charts are collapsed — open when you need CPU, RAM, or disk detail.
                </p>
              )}
            </Section>
          </FadeIn>

          <FadeIn>
            <Section title="Network" icon={Network} hint="Interface bandwidth history.">
              <div className="lv-chart-grid">
                <SeriesChart
                  title="Net RX Mbps"
                  rows={windowRows}
                  loading={chartLoading}
                  error={chartError}
                  empty={chartEmpty}
                  series={[{ dataKey: 'net_rx_mbps', color: 'var(--wt-accent)' }]}
                  actions={
                    bandwidth.rx_mbps != null ? (
                      <span className="lv-chart-meta">Now {num(bandwidth.rx_mbps).toFixed(1)} Mbps</span>
                    ) : undefined
                  }
                />
                <SeriesChart
                  title="Net TX Mbps"
                  rows={windowRows}
                  loading={chartLoading}
                  error={chartError}
                  empty={chartEmpty}
                  series={[{ dataKey: 'net_tx_mbps', color: 'var(--wt-info)' }]}
                  actions={
                    bandwidth.tx_mbps != null ? (
                      <span className="lv-chart-meta">Now {num(bandwidth.tx_mbps).toFixed(1)} Mbps</span>
                    ) : undefined
                  }
                />
              </div>
            </Section>
          </FadeIn>

          {thermalOk ? (
            <FadeIn>
              <Section title="Thermal" icon={Thermometer} hint="Package and ambient when sensors are present.">
                <div className="lv-thermal-grid">
                  <SeriesChart
                    title="Thermal °C"
                    rows={windowRows}
                    loading={chartLoading}
                    error={chartError}
                    empty={chartEmpty}
                    series={[
                      { dataKey: 'thermal_package', color: 'var(--wt-danger)' },
                      { dataKey: 'thermal_ambient', color: 'var(--wt-info)' },
                    ]}
                  />
                  <div className="lv-thermal-dials">
                    <div className="lv-dial rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)]">
                      <WtThermalGauge celsius={packageC} label="Package" size={216} />
                    </div>
                    <div className="lv-dial rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)]">
                      <WtThermalGauge celsius={ambientC} label="Ambient" minC={15} maxC={55} size={216} />
                    </div>
                  </div>
                </div>
              </Section>
            </FadeIn>
          ) : null}

          {chunkyShow || dhShow ? (
            <FadeIn>
              <Section title="World background jobs" icon={Boxes} hint="Active pregen only.">
                <div className="lv-pregen-list">
                  {chunkyShow ? <PregenCard title="Chunky" pregen={chunky} /> : null}
                  {dhShow ? <PregenCard title="Distant Horizons" pregen={dh} /> : null}
                </div>
              </Section>
            </FadeIn>
          ) : null}

          <FadeIn>
            <Section
              title="Active alerts"
              icon={AlertTriangle}
              hint="From ops right-now signals — same source as Overview."
            >
              {signals.length ? (
                <Stagger className="lv-alerts">
                  {signalsShown.map((s, i) => {
                    const sev = str(s.severity, 'info').toLowerCase();
                    return (
                      <div
                        key={`${str(s.type, 'sig')}-${i}`}
                        className="lv-alert relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)]"
                      >
                        <div className="lv-alert__body">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone={severityTone[sev] ?? 'info'}>{sev}</StatusPill>
                            <span className="lv-alert__label">{str(s.label, str(s.message, 'Alert'))}</span>
                          </div>
                          {str(s.detail) ? <div className="lv-alert__detail">{str(s.detail)}</div> : null}
                        </div>
                        {str(s.tab) ? (
                          <Button kind="ghost" onClick={() => navigate({ tab: str(s.tab) })}>
                            Open
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </Stagger>
              ) : (
                <EmptyState title="No active alerts">Ops right-now is quiet.</EmptyState>
              )}
              {signalsMore > 0 ? (
                <Button className="mt-2" kind="ghost" onClick={() => navigate({ tab: 'issues', view: 'active' })}>
                  +{signalsMore} more on Issues
                </Button>
              ) : null}
            </Section>
          </FadeIn>
        </>
      ) : (
        <FadeIn>
          <EmptyState title="Live telemetry pending">
            Keep the mod running and polling on — vitals and charts appear after the first sample.
          </EmptyState>
        </FadeIn>
      )}
    </PageEnter>
  );
}
