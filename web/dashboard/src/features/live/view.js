/**
 * Live — real-time metrics with fixed chart path (stable series, timestamp join).
 */

import { html, useMemo, useState } from '../../lib/preact.js';
import {
  Page, Section, ChartFrame, TimeSeries, ListRow, EmptyState,
  Gauge, RadarDial,
} from '../../ui/patterns/index.js';
import { Button, Segmented, Card, Badge, Progress } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import { live, samples, opsCache, settings, ui, setUi } from '../../state/stores.js';
import { pinIncident } from '../../state/actions.js';
import { kickTask } from '../../state/scheduler.js';
import { get as persistGet, set as persistSet } from '../../state/persist.js';
import { navigate } from '../../app/router.js';
import { formatTps, formatMspt } from '../../domain/formats.js';
import { downsampleSeries } from '../../domain/downsample.js';

// ── Constants (stable identities — never recreate in render) ─────────────────

const POLL_OPTIONS = [
  { value: 1000,  label: '1s' },
  { value: 5000,  label: '5s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '60s' },
  { value: 0,     label: 'Off' },
];

const WINDOW_OPTS = [
  { value: '15m', label: '15m' },
  { value: '1h',  label: '1h' },
  { value: '3h',  label: '3h' },
  { value: '6h',  label: '6h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
  { value: '7d',  label: '7d' },
  { value: '30d', label: '30d' },
];

function parseWindowOpt(v) {
  const raw = String(v || '1h');
  const n = Number(raw.slice(0, -1));
  if (!Number.isFinite(n) || n <= 0) return { kind: 'hours', value: 1 };
  if (raw.endsWith('m')) return { kind: 'minutes', value: n };
  if (raw.endsWith('d')) return { kind: 'days', value: n };
  return { kind: 'hours', value: n };
}

function windowToStr(w) {
  const { kind = 'hours', value = 1 } = w ?? {};
  if (kind === 'minutes') return `${value}m`;
  if (kind === 'days') return `${value}d`;
  return `${value}h`;
}

function windowToMs(w) {
  const { kind = 'hours', value = 1 } = w ?? {};
  if (kind === 'minutes') return value * 60_000;
  if (kind === 'days') return value * 86_400_000;
  return value * 3_600_000;
}

/* One series per chart — fixed Y from 0 */
const SERIES_TPS = [{ key: 'tps', label: 'TPS', unit: '', color: 'ch-tps', ymin: 0, ymax: 20 }];
const SERIES_MSPT = [{ key: 'mspt', label: 'MSPT', unit: ' ms', color: 'ch-mspt', ymin: 0 }];
const SERIES_HEAP = [{ key: 'heap_mb', label: 'Heap used', unit: ' MB', color: 'ch-heap', ymin: 0, ymax: 8192 }];
const SERIES_CPU = [{ key: 'host_cpu', label: 'CPU', unit: '%', color: 'ch-cpu', ymin: 0, ymax: 100 }];
const SERIES_RAM = [{ key: 'mem_available_gb', label: 'RAM free', unit: ' GB', color: 'ok', ymin: 0 }];
const SERIES_PLAYERS = [{ key: 'players', label: 'Players', unit: '', color: 'ch-players', ymin: 0, ymax: 12 }];
const SERIES_DISK = [{ key: 'disk_use_pct', label: 'Disk used', unit: '%', color: 'ch-disk', ymin: 0, ymax: 100 }];
const SERIES_RX = [{ key: 'net_rx_mbps', label: 'Receive', unit: ' Mbps', color: 'ch-rx', ymin: 0 }];
const SERIES_TX = [{ key: 'net_tx_mbps', label: 'Send', unit: ' Mbps', color: 'ch-tx', ymin: 0 }];
const SERIES_DISK_READ = [{ key: 'disk_read_mb_s', label: 'Read', unit: ' MB/s', color: 'ok', ymin: 0 }];
const SERIES_DISK_WRITE = [{ key: 'disk_write_mb_s', label: 'Write', unit: ' MB/s', color: 'warn', ymin: 0 }];
const SERIES_THERMAL_PKG = [{ key: 'thermal_package', label: 'CPU °C', unit: '°', color: 'warn', ymin: 20, ymax: 100 }];
const SERIES_THERMAL_AMB = [{ key: 'thermal_ambient', label: 'Ambient °C', unit: '°', color: 'ch-cpu', ymin: 15, ymax: 70 }];

const MAX_CHART_POINTS = 600;
const THERMAL_CHART_H = 168;

const LIVE_SECTIONS_DEFAULT = {
  game: true,
  host: true,
  network: true,
  system: true,
  pregen: true,
  alerts: true,
};

function loadLiveSections() {
  const saved = persistGet('liveSections', null);
  if (!saved || typeof saved !== 'object') return { ...LIVE_SECTIONS_DEFAULT };
  return { ...LIVE_SECTIONS_DEFAULT, ...saved };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMs(t) {
  if (typeof t === 'number') return t > 1e12 ? t : t * 1000;
  return Date.parse(t) || 0;
}

/**
 * Join series by timestamp, apply window, downsample.
 * Returns { data: {t: sec[], ...keys}, caption?, fallback: bool } or null.
 */
function buildChartData(seriesMap, keys, windowMs) {
  const primary = seriesMap[keys[0]] ?? [];
  if (!primary.length) return null;

  // Build per-key maps: ms → value
  const maps = {};
  let minT = Infinity;
  let maxT = -Infinity;
  for (const k of keys) {
    const m = new Map();
    for (const p of seriesMap[k] ?? []) {
      const ms = toMs(p.t);
      if (!ms) continue;
      m.set(ms, p.v);
      if (ms < minT) minT = ms;
      if (ms > maxT) maxT = ms;
    }
    maps[k] = m;
  }
  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return null;

  const nowMs = Date.now();
  const spanMs = Math.max(60_000, windowMs || 3_600_000);
  const windowCutoff = nowMs - spanMs;
  let cutoff = windowCutoff;
  let fallback = false;

  // Collect timestamps in window from union of keys
  let times = [];
  const seen = new Set();
  for (const k of keys) {
    for (const ms of maps[k].keys()) {
      if (ms >= cutoff && !seen.has(ms)) {
        seen.add(ms);
        times.push(ms);
      }
    }
  }

  // If window empty but we have history, fall back to full available span
  if (times.length < 2) {
    fallback = true;
    cutoff = minT;
    times = [];
    seen.clear();
    for (const k of keys) {
      for (const ms of maps[k].keys()) {
        if (!seen.has(ms)) {
          seen.add(ms);
          times.push(ms);
        }
      }
    }
  }

  times.sort((a, b) => a - b);
  if (times.length < 2) return null;

  // Build {t,v} for primary then downsample indices
  let points = times.map((ms) => ({ t: ms, v: maps[keys[0]].get(ms) ?? null }));
  if (points.length > MAX_CHART_POINTS) {
    points = downsampleSeries(
      points.filter((p) => p.v != null).length
        ? points.map((p) => ({ t: p.t, v: p.v ?? 0 }))
        : points,
      MAX_CHART_POINTS
    );
  }
  const keptTimes = points.map((p) => p.t);

  const result = { t: keptTimes.map((ms) => ms / 1000) };
  for (const k of keys) {
    result[k] = keptTimes.map((ms) => {
      const v = maps[k].get(ms);
      return v == null || Number.isNaN(v) ? null : v;
    });
  }

  let caption = null;
  if (fallback) {
    const ageMin = Math.max(0, Math.round((nowMs - maxT) / 60_000));
    caption = ageMin > 2
      ? `Showing all available history · latest sample ${ageMin}m ago`
      : 'Showing all available history';
  }

  // Pin X to the selected window so changing the window always updates the domain
  // (even before samples refetch — short series sits on the right).
  const xMin = fallback ? (minT / 1000) : (windowCutoff / 1000);
  const xMax = fallback ? Math.max(maxT / 1000, nowMs / 1000) : (nowMs / 1000);

  return { data: result, caption, fallback, xMin, xMax };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageView() {
  const liveVal      = live.value;
  const latest       = liveVal?.latest ?? null;
  const envelope     = liveVal?.envelope ?? null;
  const samplesVal   = samples.value;
  const series       = samplesVal?.series ?? {};
  const opsCacheData = opsCache.value?.data ?? null;
  const uiVal        = ui.value;
  const settingsData = settings.value?.data ?? null;

  const liveRefreshMs = uiVal.liveRefreshMs;
  const isDown        = uiVal.connectionDown;
  const isPaused      = liveRefreshMs === 0;
  const chartWindow   = uiVal.chartWindow ?? { kind: 'hours', value: 1 };
  const windowMs      = windowToMs(chartWindow);
  const windowStr     = windowToStr(chartWindow);

  const setWindow = (v) => {
    setUi({ chartWindow: parseWindowOpt(v) });
    kickTask('samples');
  };

  const setPollRate = (v) => {
    const ms = Number(v);
    setUi({ liveRefreshMs: ms });
    try { localStorage.setItem('wt.liveRefreshMs', JSON.stringify(ms)); } catch { /* ignore */ }
  };

  const [liveSections, setLiveSections] = useState(loadLiveSections);
  const setSectionOpen = (id, open) => {
    setLiveSections((prev) => {
      const next = { ...prev, [id]: open };
      persistSet('liveSections', next);
      return next;
    });
  };

  const handlePinIncident = async () => {
    const note = window.prompt('Pin note (optional, e.g. "server frozen after /fill command"):') ?? '';
    await pinIncident(note.trim());
  };

  const tpsPack     = useMemo(() => buildChartData(series, ['tps'], windowMs), [series, windowMs]);
  const msptPack    = useMemo(() => buildChartData(series, ['mspt'], windowMs), [series, windowMs]);
  const heapPack    = useMemo(() => buildChartData(series, ['heap_mb'], windowMs), [series, windowMs]);
  const cpuPack     = useMemo(() => buildChartData(series, ['host_cpu'], windowMs), [series, windowMs]);
  const ramPack     = useMemo(() => buildChartData(series, ['mem_available_gb'], windowMs), [series, windowMs]);
  const playersPack = useMemo(() => buildChartData(series, ['players'], windowMs), [series, windowMs]);
  const diskPack    = useMemo(() => buildChartData(series, ['disk_use_pct'], windowMs), [series, windowMs]);
  const rxPack = useMemo(
    () => buildChartData(series, ['net_rx_mbps'], windowMs),
    [series, windowMs]
  );
  const txPack = useMemo(
    () => buildChartData(series, ['net_tx_mbps'], windowMs),
    [series, windowMs]
  );
  const diskReadPack = useMemo(
    () => buildChartData(series, ['disk_read_mb_s'], windowMs),
    [series, windowMs]
  );
  const diskWritePack = useMemo(
    () => buildChartData(series, ['disk_write_mb_s'], windowMs),
    [series, windowMs]
  );
  const thermalPkgPack = useMemo(
    () => buildChartData(series, ['thermal_package'], windowMs),
    [series, windowMs]
  );
  const thermalAmbPack = useMemo(
    () => buildChartData(series, ['thermal_ambient'], windowMs),
    [series, windowMs]
  );

  const tpsWarn  = settingsData?.tps_warn ?? 19.5;
  const msptWarn = settingsData?.mspt_warn ?? 50;

  const heapMax   = latest?.heap_mb?.max ?? 8192;
  const thermal   = envelope?.thermal ?? null;
  const rightNow  = opsCacheData?.right_now ?? null;
  const alerts    = rightNow?.signals?.filter((s) => s.severity !== 'info') ?? [];
  const chunkyPregen = envelope?.chunky_pregen ?? null;
  const dhPregen     = envelope?.dh_pregen ?? null;
  const pregenActive = !!(chunkyPregen?.pregen_active || dhPregen?.pregen_active);

  const ambientMax = useMemo(() => {
    const vals = series?.thermal_ambient?.map((p) => p.v).filter((v) => v != null) ?? [];
    const peak = vals.length ? Math.max(...vals) : 0;
    const liveAmb = thermal?.ambient_c;
    const livePeak = liveAmb != null && Number.isFinite(liveAmb) ? liveAmb : 0;
    return Math.max(70, Math.ceil(Math.max(peak, livePeak) + 5));
  }, [series?.thermal_ambient, thermal?.ambient_c]);
  const ambientSeries = useMemo(
    () => [{ ...SERIES_THERMAL_AMB[0], ymax: ambientMax }],
    [ambientMax]
  );

  const bw = envelope?.bandwidth ?? latest?.bandwidth ?? null;
  const rxMbps = bw?.rx_mbps ?? bw?.rx ?? null;
  const txMbps = bw?.tx_mbps ?? bw?.tx ?? null;
  const fmtMbps = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(2));

  const heapSeries = useMemo(
    () => [{ ...SERIES_HEAP[0], ymax: heapMax || 8192 }],
    [heapMax]
  );
  const msptMax = useMemo(() => {
    const vals = series?.mspt?.map((p) => p.v).filter((v) => v != null) ?? [];
    const peak = vals.length ? Math.max(...vals) : 0;
    return Math.max(50, Math.ceil(Math.max(peak, msptWarn) * 1.15));
  }, [series?.mspt, msptWarn]);
  const msptSeries = useMemo(
    () => [{ ...SERIES_MSPT[0], ymax: msptMax }],
    [msptMax]
  );
  const playersMax = useMemo(() => {
    const vals = series?.players?.map((p) => p.v).filter((v) => v != null) ?? [];
    const peak = vals.length ? Math.max(...vals) : 0;
    return Math.max(12, Math.ceil(peak));
  }, [series?.players]);
  const playersSeries = useMemo(
    () => [{ ...SERIES_PLAYERS[0], ymax: playersMax }],
    [playersMax]
  );

  const statusDotClass = [
    'lv-dot',
    isDown ? 'lv-dot--down' : '',
    isPaused ? 'lv-dot--paused' : '',
    !isDown && !isPaused ? 'lv-dot--live' : '',
  ].filter(Boolean).join(' ');

  const statusLabel = isDown ? 'Connection lost' : isPaused ? 'Paused' : 'Live';
  const statusTone = isDown ? 'danger' : isPaused ? 'neutral' : 'ok';

  return html`
    <${Page} title="Live" subtitle="Real-time server metrics" tour="live">
      <div class="ui-page__stack" data-tour="live">

      <div class=${`lv-toolbar lv-toolbar--${statusTone}`}>
        <div class="lv-toolbar__status">
          <span class=${statusDotClass} aria-hidden="true"></span>
          <div class="lv-toolbar__status-text">
            <span class="lv-toolbar__status-label">${statusLabel}</span>
            <span class="lv-toolbar__status-hint">
              ${isPaused ? 'Polling paused' : isDown ? 'Retrying…' : `Every ${POLL_OPTIONS.find((o) => o.value === liveRefreshMs)?.label ?? '—'}`}
            </span>
          </div>
        </div>

        ${latest ? html`
          <div class="lv-toolbar__vitals" aria-label="Current vitals">
            <div class="lv-vital">
              <span class="lv-vital__label">TPS</span>
              <span class="lv-vital__value">${formatTps(latest.tps)}</span>
            </div>
            <div class="lv-vital">
              <span class="lv-vital__label">MSPT</span>
              <span class="lv-vital__value">${formatMspt(latest.mspt)}</span>
            </div>
            <div class="lv-vital">
              <span class="lv-vital__label">Players</span>
              <span class="lv-vital__value">${latest.players_online ?? 0}</span>
            </div>
          </div>
        ` : html`
          <div class="lv-toolbar__vitals lv-toolbar__vitals--empty">
            <span class="ui-text-low">Waiting for samples…</span>
          </div>
        `}

        <div class="lv-toolbar__controls">
          <div class="lv-toolbar__group">
            <span class="lv-toolbar__group-label">Window</span>
            <${Segmented}
              size="sm"
              options=${WINDOW_OPTS}
              value=${windowStr}
              onChange=${setWindow}
            />
          </div>
          <div class="lv-toolbar__group">
            <label class="lv-toolbar__group-label" for="lv-poll-cadence">Poll</label>
            <select
              id="lv-poll-cadence"
              class="lv-toolbar__select"
              value=${liveRefreshMs}
              onChange=${(e) => setPollRate(e.target.value)}
            >
              ${POLL_OPTIONS.map((o) => html`
                <option key=${o.value} value=${o.value}>${o.label}</option>
              `)}
            </select>
          </div>
          <${Button} kind="neutral" size="sm" className="lv-toolbar__pin" onClick=${handlePinIncident}>
            <${Icon} name="radio" size=${14} />
            Pin lag
          </${Button}>
        </div>
      </div>

      <${Section}
        title="Game server"
        collapsible=${true}
        open=${liveSections.game !== false}
        onOpenChange=${(v) => setSectionOpen('game', v)}
      >
        <div class="lv-charts">
          <${ChartFrame} title="TPS" layer="live" caption=${tpsPack?.caption}>
            <${TimeSeries}
              reveal=${false}
              height=${156}
              data=${tpsPack?.data}
              series=${SERIES_TPS}
              xMin=${tpsPack?.xMin}
              xMax=${tpsPack?.xMax}
              thresholds=${[{ scale: 'tps', value: tpsWarn, color: 'warn' }]}
            />
          </${ChartFrame}>

          <${ChartFrame} title="MSPT" layer="live" caption=${msptPack?.caption}>
            <${TimeSeries}
              reveal=${false}
              height=${156}
              data=${msptPack?.data}
              series=${msptSeries}
              xMin=${msptPack?.xMin}
              xMax=${msptPack?.xMax}
              thresholds=${[{ scale: 'mspt', value: msptWarn, color: 'warn' }]}
            />
          </${ChartFrame}>

          <${ChartFrame} title="Java Heap" layer="live" caption=${heapPack?.caption}>
            <${TimeSeries}
              reveal=${false}
              height=${156}
              data=${heapPack?.data}
              series=${heapSeries}
              xMin=${heapPack?.xMin}
              xMax=${heapPack?.xMax}
            />
          </${ChartFrame}>

          <${ChartFrame} title="Players online" layer="live" caption=${playersPack?.caption}>
            <${TimeSeries}
              reveal=${false}
              height=${156}
              data=${playersPack?.data}
              series=${playersSeries}
              xMin=${playersPack?.xMin}
              xMax=${playersPack?.xMax}
            />
          </${ChartFrame}>
        </div>
      </${Section}>

      <${Section}
        title="Host machine"
        collapsible=${true}
        open=${liveSections.host !== false}
        onOpenChange=${(v) => setSectionOpen('host', v)}
      >
        <div class="lv-charts">
          <${ChartFrame} title="Host CPU" layer="live" caption=${cpuPack?.caption}>
            <${TimeSeries}
              reveal=${false}
              height=${156}
              data=${cpuPack?.data}
              series=${SERIES_CPU}
              xMin=${cpuPack?.xMin}
              xMax=${cpuPack?.xMax}
            />
          </${ChartFrame}>

          <${ChartFrame} title="RAM free" layer="live" caption=${ramPack?.caption}>
            <${TimeSeries}
              reveal=${false}
              height=${156}
              data=${ramPack?.data}
              series=${SERIES_RAM}
              xMin=${ramPack?.xMin}
              xMax=${ramPack?.xMax}
            />
          </${ChartFrame}>

          ${diskPack?.data ? html`
            <${ChartFrame} title="Disk used" layer="live" caption=${diskPack.caption}>
              <${TimeSeries}
              reveal=${false}
                height=${156}
                data=${diskPack.data}
                series=${SERIES_DISK}
                xMin=${diskPack.xMin}
                xMax=${diskPack.xMax}
              />
            </${ChartFrame}>
          ` : null}

          ${diskReadPack?.data ? html`
            <${ChartFrame} title="Disk read" layer="live" caption=${diskReadPack.caption}>
              <${TimeSeries}
              reveal=${false}
                height=${156}
                data=${diskReadPack.data}
                series=${SERIES_DISK_READ}
                xMin=${diskReadPack.xMin}
                xMax=${diskReadPack.xMax}
              />
            </${ChartFrame}>
          ` : null}

          ${diskWritePack?.data ? html`
            <${ChartFrame} title="Disk write" layer="live" caption=${diskWritePack.caption}>
              <${TimeSeries}
              reveal=${false}
                height=${156}
                data=${diskWritePack.data}
                series=${SERIES_DISK_WRITE}
                xMin=${diskWritePack.xMin}
                xMax=${diskWritePack.xMax}
              />
            </${ChartFrame}>
          ` : null}
        </div>
      </${Section}>

      <${Section}
        title="Network"
        collapsible=${true}
        open=${liveSections.network !== false}
        onOpenChange=${(v) => setSectionOpen('network', v)}
      >
        <div class="lv-net">
          <div class="lv-net__heroes" aria-label="Current network rates">
            <div class=${`lv-net__hero lv-net__hero--rx${rxMbps > 0 ? ' lv-net__hero--active' : ''}`}>
              <span class="lv-net__hero-label">Receive</span>
              <span class="lv-net__hero-value">${fmtMbps(rxMbps)}</span>
              <span class="lv-net__hero-unit">Mbps</span>
            </div>
            <div class="lv-net__flow" aria-hidden="true">
              <span class="lv-net__flow-bar lv-net__flow-bar--rx"></span>
              <span class="lv-net__flow-dot"></span>
              <span class="lv-net__flow-bar lv-net__flow-bar--tx"></span>
            </div>
            <div class=${`lv-net__hero lv-net__hero--tx${txMbps > 0 ? ' lv-net__hero--active' : ''}`}>
              <span class="lv-net__hero-label">Send</span>
              <span class="lv-net__hero-value">${fmtMbps(txMbps)}</span>
              <span class="lv-net__hero-unit">Mbps</span>
            </div>
          </div>
          <div class="lv-charts lv-charts--net">
            ${rxPack?.data ? html`
              <${ChartFrame} title="Receive" layer="live" caption=${rxPack.caption}>
                <${TimeSeries}
              reveal=${false}
                  height=${156}
                  data=${rxPack.data}
                  series=${SERIES_RX}
                  xMin=${rxPack.xMin}
                  xMax=${rxPack.xMax}
                />
              </${ChartFrame}>
            ` : null}
            ${txPack?.data ? html`
              <${ChartFrame} title="Send" layer="live" caption=${txPack.caption}>
                <${TimeSeries}
              reveal=${false}
                  height=${156}
                  data=${txPack.data}
                  series=${SERIES_TX}
                  xMin=${txPack.xMin}
                  xMax=${txPack.xMax}
                />
              </${ChartFrame}>
            ` : null}
          </div>
        </div>
      </${Section}>

      ${(thermal?.package_c != null || thermal?.ambient_c != null) ? html`
        <${Section}
          title="Host temperatures"
          collapsible=${true}
          open=${liveSections.system !== false}
          onOpenChange=${(v) => setSectionOpen('system', v)}
        >
          <div class="lv-thermal-grid">
            ${thermal?.package_c != null ? html`
              <div class="lv-thermal-card">
                <div class="lv-thermal-card__dial">
                  <${Gauge}
                    value=${thermal.package_c}
                    max=${100}
                    label="CPU package"
                    warnAt=${70}
                    critAt=${85}
                    size=${176}
                    hero=${true}
                  />
                </div>
                <div class="lv-thermal-card__chart">
                  ${thermalPkgPack?.data ? html`
                    <${TimeSeries}
              reveal=${false}
                      height=${THERMAL_CHART_H}
                      data=${thermalPkgPack.data}
                      series=${SERIES_THERMAL_PKG}
                      xMin=${thermalPkgPack.xMin}
                      xMax=${thermalPkgPack.xMax}
                    />
                  ` : html`
                    <div class="lv-thermal-card__empty">Temp history builds as samples arrive</div>
                  `}
                </div>
              </div>
            ` : null}
            ${thermal?.ambient_c != null ? html`
              <div class="lv-thermal-card">
                <div class="lv-thermal-card__dial">
                  <${Gauge}
                    value=${thermal.ambient_c}
                    max=${ambientMax}
                    label="Ambient"
                    warnAt=${32}
                    critAt=${40}
                    size=${176}
                    hero=${true}
                  />
                </div>
                <div class="lv-thermal-card__chart">
                  ${thermalAmbPack?.data ? html`
                    <${TimeSeries}
              reveal=${false}
                      height=${THERMAL_CHART_H}
                      data=${thermalAmbPack.data}
                      series=${ambientSeries}
                      xMin=${thermalAmbPack.xMin}
                      xMax=${thermalAmbPack.xMax}
                    />
                  ` : html`
                    <div class="lv-thermal-card__empty">Temp history builds as samples arrive</div>
                  `}
                </div>
              </div>
            ` : null}
          </div>
        </${Section}>
      ` : null}

      ${pregenActive ? html`
        <${Section}
          title="World pregen"
          collapsible=${true}
          open=${liveSections.pregen !== false}
          onOpenChange=${(v) => setSectionOpen('pregen', v)}
        >
          <div class="lv-pregen-list">
            ${[chunkyPregen, dhPregen].filter((p) => p?.pregen_active).map((pregen, idx) => html`
              <${Card} key=${idx} className="lv-pregen-card">
                <div class="lv-pregen-row">
                  <${RadarDial}
                    pct=${pregen.last?.pct ?? 0}
                    kind=${idx === 0 ? 'circle' : 'square'}
                    size=${64}
                  />
                  <div class="lv-pregen-meta">
                    <div>
                      <span class="lv-pregen-dim">${pregen.last?.dimension ?? 'Overworld'}</span>
                      <span class="lv-pregen-pct">${pregen.last?.pct != null ? ` — ${pregen.last.pct.toFixed(1)}%` : ''}</span>
                    </div>
                    ${pregen.last?.pct != null ? html`
                      <${Progress} value=${pregen.last.pct} max=${100} tone="warn" />
                    ` : null}
                    <div class="lv-pregen-stats">
                      ${pregen.last?.eta ? html`<span class="ui-text-low">ETA ${pregen.last.eta}</span>` : null}
                      ${pregen.last?.cps ? html`<span class="ui-text-low">${pregen.last.cps} chunks/s</span>` : null}
                    </div>
                  </div>
                  <${Badge} tone=${pregen.pregen_paused ? 'neutral' : 'warn'}>
                    ${pregen.pregen_paused ? 'Paused' : 'Active'}
                  </${Badge}>
                </div>
              </${Card}>
            `)}
          </div>
        </${Section}>
      ` : null}

      ${alerts.length ? html`
        <${Section}
          title="Active alerts"
          badge=${html`<${Badge} tone="warn">${alerts.length}</${Badge}>`}
          collapsible=${true}
          open=${liveSections.alerts !== false}
          onOpenChange=${(v) => setSectionOpen('alerts', v)}
        >
          <div class="feat-list">
          ${alerts.map((sig, i) => html`
            <${ListRow}
              key=${sig.type + String(i)}
              tone=${sig.severity === 'critical' ? 'danger' : sig.severity === 'warning' ? 'warn' : 'neutral'}
              icon=${html`<${Icon} name=${sig.severity === 'critical' ? 'zap' : 'alert-triangle'} size=${14} />`}
              title=${sig.label}
              meta=${sig.detail ?? null}
              actions=${sig.tab ? html`
                <${Button} kind="neutral" size="sm" onClick=${() => navigate(sig.tab)}>View</${Button}>
              ` : null}
            />
          `)}
          </div>
        </${Section}>
      ` : null}

      ${!latest ? html`
        <${EmptyState}
          icon=${html`<${Icon} name="activity" size=${36} />`}
          title="Waiting for live data"
          body="The dashboard polls the server on the configured interval. Check that the WatchTower agent is running."
        />
      ` : null}

      </div>
    </${Page}>
  `;
}
