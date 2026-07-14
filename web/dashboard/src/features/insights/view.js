import { html, useMemo, useEffect, useRef } from '../../lib/preact.js';
import { performance, ui, opsCache, live, reports } from '../../state/stores.js';
import { loadPerformance, addToast } from '../../state/actions.js';
import { Page, Section, MetricTile, DataTable, ListRow, EmptyState, Heatmap, Subnav } from '../../ui/patterns/index.js';
import { Segmented, Button, Badge, Progress, Card, Tooltip } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import { HourBars } from '../../ui/patterns/bar-meter.js';
import { formatMspt, formatTps, formatPct, formatGb, formatMb } from '../../domain/formats.js';
import { navigate } from '../../app/router.js';

const SUBNAV = [
  { value: 'patterns', label: 'Patterns' },
  { value: 'mod-changes', label: 'Mod changes' },
  { value: 'storage', label: 'Storage' },
];

const PATTERNS_PANELS = [
  { value: 'overview', label: 'Overview' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'load', label: 'Load' },
  { value: 'incidents', label: 'Incidents' },
];

const WINDOW_OPTS = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}`.padStart(2, '0'));

function emptyHourGrid() {
  return Array.from({ length: 7 }, () => Array(24).fill(null));
}

function buildHourOfWeekMaps(hourOfWeek) {
  const mspt = emptyHourGrid();
  const tps = emptyHourGrid();
  const players = emptyHourGrid();
  let maxMspt = 1;
  let maxPlayers = 1;
  for (const cell of hourOfWeek) {
    if (cell.dow == null || cell.hour_utc == null) continue;
    const d = cell.dow;
    const h = cell.hour_utc;
    if (cell.avg_mspt != null) {
      mspt[d][h] = cell.avg_mspt;
      maxMspt = Math.max(maxMspt, cell.avg_mspt);
    }
    if (cell.avg_tps != null) tps[d][h] = cell.avg_tps;
    if (cell.avg_players != null) {
      players[d][h] = cell.avg_players;
      maxPlayers = Math.max(maxPlayers, cell.avg_players);
    }
  }
  return { mspt, tps, players, maxMspt, maxPlayers };
}

function msptColorScale(maxMspt) {
  return (v) => {
    if (v == null) return 'var(--ui-bg2)';
    const norm = Math.min(1, v / Math.max(maxMspt, 1));
    const r = Math.round(200 * norm);
    const g = Math.round(160 * (1 - norm));
    return `rgba(${r}, ${g}, 60, ${0.15 + norm * 0.7})`;
  };
}

/** Lower TPS = warmer (worse). Ideal ~20. */
function tpsColorScale() {
  return (v) => {
    if (v == null) return 'var(--ui-bg2)';
    const norm = Math.min(1, Math.max(0, (20 - v) / 20));
    const r = Math.round(200 * norm);
    const g = Math.round(160 * (1 - norm));
    return `rgba(${r}, ${g}, 60, ${0.15 + norm * 0.7})`;
  };
}

/** Higher player count = busier (cool blue), not a health signal. */
function playersColorScale(maxPlayers) {
  return (v) => {
    if (v == null) return 'var(--ui-bg2)';
    const norm = Math.min(1, v / Math.max(maxPlayers, 1));
    return `rgba(76, 158, 234, ${0.12 + norm * 0.72})`;
  };
}

function buildHourBars(hourOfWeek) {
  const mspt = Array(24).fill(null);
  const tps = Array(24).fill(null);
  const players = Array(24).fill(null);
  const samples = Array(24).fill(null);
  const msptWeights = Array(24).fill(0);
  const tpsWeights = Array(24).fill(0);
  const playerWeights = Array(24).fill(0);
  for (const cell of hourOfWeek) {
    const h = cell.hour_utc;
    if (h == null) continue;
    const w = cell.sample_minutes ?? 1;
    samples[h] = (samples[h] ?? 0) + w;
    if (cell.avg_mspt != null) {
      mspt[h] = (mspt[h] ?? 0) + cell.avg_mspt * w;
      msptWeights[h] += w;
    }
    if (cell.avg_tps != null) {
      tps[h] = (tps[h] ?? 0) + cell.avg_tps * w;
      tpsWeights[h] += w;
    }
    if (cell.avg_players != null) {
      players[h] = (players[h] ?? 0) + cell.avg_players * w;
      playerWeights[h] += w;
    }
  }
  for (let h = 0; h < 24; h += 1) {
    mspt[h] = msptWeights[h] > 0 ? mspt[h] / msptWeights[h] : null;
    tps[h] = tpsWeights[h] > 0 ? tps[h] / tpsWeights[h] : null;
    players[h] = playerWeights[h] > 0 ? players[h] / playerWeights[h] : null;
    if (msptWeights[h] === 0 && tpsWeights[h] === 0 && playerWeights[h] === 0) {
      samples[h] = null;
    }
  }
  return { mspt, tps, players, samples };
}

const PERF_KPI_HINTS = {
  samples: 'One-minute rollup samples in the selected window (7 or 30 days). More samples means fuller coverage of server history.',
  tps: 'Average ticks per second across all sampled minutes. 20 TPS is ideal; sustained drops suggest tick lag.',
  mspt: '95th percentile of per-minute MSPT — 95% of minutes were at or below this. A high p95 means frequent lag spikes even if the average looks fine.',
  lowTps: 'Minutes where TPS fell below your warn threshold. Counts how often the server struggled to keep up.',
  players: 'Highest concurrent player count recorded in any single minute during the window.',
  sticky: 'Episodes where MSPT stayed above the warn threshold for at least 15 minutes after the last player left — lag that did not clear when the server went idle.',
  outliers: 'Minutes with unusually high MSPT: either elevated lag with no players online, or a spike well above the typical lag for that hour of day.',
  related: 'Activity log events (lag alerts, spikes, pins) that overlap outlier or sticky-lag periods in this window.',
};

const COMPARE_METRICS = {
  mspt_avg: {
    label: 'Avg MSPT',
    unit: 'ms',
    decimals: 1,
    worseWhenUp: true,
    hint: 'Mean per-minute MSPT for this window compared to the previous equal-length period. Lower is better.',
  },
  low_tps_minutes: {
    label: 'Low-TPS minutes',
    unit: '',
    decimals: 0,
    worseWhenUp: true,
    hint: 'How many minutes had TPS below the warn threshold, now vs the prior period.',
  },
  players_peak: {
    label: 'Peak players',
    unit: '',
    decimals: 0,
    worseWhenUp: false,
    hint: 'Highest concurrent player count in the window vs the prior period. Higher usually means more load, not worse health.',
  },
  outlier_count: {
    label: 'Outlier minutes',
    unit: '',
    decimals: 0,
    worseWhenUp: true,
    hint: 'Count of unusual-lag minutes (idle high MSPT or spike vs hour median) compared to the prior period.',
  },
  sticky_episode_count: {
    label: 'Sticky episodes',
    unit: '',
    decimals: 0,
    worseWhenUp: true,
    hint: 'Times lag stayed high for 15+ minutes after players left, compared to the prior period.',
  },
};

function severityTone(s) {
  if (s === 'warning' || s === 'warn') return 'warn';
  if (s === 'critical' || s === 'danger') return 'danger';
  if (s === 'info') return 'info';
  return 'neutral';
}

function formatCompareWindow(w) {
  if (w === '30d') return '30 days';
  if (w === '7d') return '7 days';
  return w || '7 days';
}

function formatCompareValue(key, value) {
  const meta = COMPARE_METRICS[key];
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const text = meta.decimals > 0 ? n.toFixed(meta.decimals) : String(Math.round(n));
  return meta.unit ? `${text} ${meta.unit}` : text;
}

function compareTrendClass(key, delta) {
  if (delta === 0) return 'flat';
  const worseWhenUp = COMPARE_METRICS[key]?.worseWhenUp !== false;
  if (worseWhenUp) {
    if (delta > 0) return 'worse';
    if (delta < 0) return 'better';
  } else {
    if (delta > 0) return 'neutral-up';
    if (delta < 0) return 'neutral-down';
  }
  return 'flat';
}

function CompareBar({ pct, kind }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.style.width = `${pct}%`;
    });
    return () => cancelAnimationFrame(id);
  }, [pct]);

  if (pct <= 0) return null;
  return html`
    <div
      ref=${ref}
      class=${`feat-compare-card__bar feat-compare-card__bar--${kind}`}
      style=${{ width: '0%' }}
    ></div>
  `;
}

function PeriodCompare({ periodCompare, windowKey }) {
  const pc = periodCompare;
  if (!pc?.deltas) return null;

  const win = windowKey || pc.window || '7d';
  const windowLabel = formatCompareWindow(win);
  const title = win === '30d' ? 'Month over month' : 'Week over week';

  const cards = Object.keys(COMPARE_METRICS).map((key) => {
    const altKey = key === 'sticky_episode_count' ? 'sticky_episodes' : null;
    const d = pc.deltas[key] || (altKey ? pc.deltas[altKey] : null);
    if (!d) return null;
    const meta = COMPARE_METRICS[key];
    const current = Number(d.current ?? 0);
    const prior = Number(d.prior ?? 0);
    const delta = Number(d.delta ?? 0);
    const scale = Math.max(current, prior, 0.001);
    const priorPct = prior <= 0 ? 0 : Math.round((prior / scale) * 100);
    const currentPct = current <= 0 ? 0 : Math.round((current / scale) * 100);
    const trend = compareTrendClass(key, delta);
    const abs = meta.decimals > 0 ? Math.abs(delta).toFixed(meta.decimals) : String(Math.round(Math.abs(delta)));
    const unit = meta.unit ? ` ${meta.unit}` : '';
    const deltaLabel = delta === 0 ? 'No change' : `${delta > 0 ? '+' : '−'}${abs}${unit}`;
    const deltaIcon = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'minus';

    return html`
      <div key=${key} class=${`feat-compare-card feat-compare-card--${trend}`}>
        <div class="feat-compare-card__top">
          <span class="feat-compare-card__label">${meta.label}</span>
          <${Tooltip} content=${meta.hint} className="feat-compare-card__hint">
            <button type="button" class="ui-metric__hint-btn" aria-label=${`About ${meta.label}`}>
              <${Icon} name="help-circle" size=${14} />
            </button>
          </${Tooltip}>
        </div>
        <div class="feat-compare-card__headline">
          <span class="feat-compare-card__current">${formatCompareValue(key, current)}</span>
          <span class=${`feat-compare-card__delta feat-compare-card__delta--${trend}`}>
            <${Icon} name=${deltaIcon} size=${14} />
            ${deltaLabel}
          </span>
        </div>
        <div class="feat-compare-card__bars" role="img" aria-label=${`Prior ${priorPct}%, current ${currentPct}%`}>
          <div class="feat-compare-card__bar-row">
            <span class="feat-compare-card__bar-label">Prior</span>
            <div class="feat-compare-card__bar-track">
              <${CompareBar} pct=${priorPct} kind="prior" />
            </div>
            <span class="feat-compare-card__bar-value">${formatCompareValue(key, prior)}</span>
          </div>
          <div class="feat-compare-card__bar-row">
            <span class="feat-compare-card__bar-label">Now</span>
            <div class="feat-compare-card__bar-track">
              <${CompareBar} pct=${currentPct} kind="current" />
            </div>
            <span class="feat-compare-card__bar-value">${formatCompareValue(key, current)}</span>
          </div>
        </div>
        <p class="feat-compare-card__caption">vs prior ${windowLabel}</p>
      </div>
    `;
  }).filter(Boolean);

  if (!cards.length) return null;

  return html`
    <${Card} className="feat-compare" padding="20">
      <div class="feat-compare__head">
        <h3 class="feat-compare__title">
          <${Icon} name="git-compare" size=${16} />
          ${title}
        </h3>
        <p class="feat-compare__subtitle">Current ${windowLabel} compared to the previous ${windowLabel}</p>
      </div>
      <div class="feat-compare-grid">${cards}</div>
    </${Card}>
  `;
}

function PatternsOverview({ dash, windowKey, kpis, insights }) {
  return html`
    <div class="feat-insights-panel">
      <div class="feat-kpi-row feat-kpi-row--insights">
        ${kpis.map((k) => html`
          <${MetricTile}
            key=${k.label}
            label=${k.label}
            value=${k.value}
            format=${k.format}
            caption=${k.caption}
            hint=${k.hint}
          />
        `)}
      </div>

      <${PeriodCompare} periodCompare=${dash.period_compare} windowKey=${windowKey} />

      ${insights.length > 0 ? html`
        <${Section} title="Takeaways" defaultOpen=${true}>
          <div class="feat-list">
            ${insights.map((ins) => html`
              <${ListRow}
                key=${ins.id}
                tone=${severityTone(ins.severity)}
                title=${ins.title}
                meta=${ins.detail}
                badge=${html`<${Badge} tone=${severityTone(ins.severity)}>${ins.severity ?? 'info'}</${Badge}>`}
              />
            `)}
          </div>
        </${Section}>
      ` : html`
        <${EmptyState} title="No takeaways yet" body="Need more sampled minutes in this window before Insights can summarize patterns." />
      `}
    </div>
  `;
}

function PatternsSchedule({ hourOfWeek, heatmaps, hourBars }) {
  if (!hourOfWeek.length) {
    return html`<${EmptyState} title="No schedule data" body="Wait for enough live samples to build hour-of-week heatmaps." />`;
  }

  return html`
    <div class="feat-insights-panel feat-insights-panel--schedule">
      <div class="feat-heatmap-stack">
        <${Section} title="MSPT by hour of week" defaultOpen=${true}>
          <p class="ui-text-low feat-hint">Colour = average MSPT — warmer means higher tick lag. UTC hours.</p>
          <${Heatmap}
            idPrefix="hm-mspt"
            rows=${DOW_LABELS}
            cols=${HOUR_LABELS}
            values=${heatmaps.mspt}
            colorScale=${msptColorScale(heatmaps.maxMspt)}
            cellLabel=${(v) => v != null ? v.toFixed(0) : ''}
          />
        </${Section}>

        <${Section} title="TPS by hour of week" defaultOpen=${true}>
          <p class="ui-text-low feat-hint">Colour = average TPS — warmer means lower tick rate (worse). Ideal is near 20. UTC hours.</p>
          <${Heatmap}
            idPrefix="hm-tps"
            rows=${DOW_LABELS}
            cols=${HOUR_LABELS}
            values=${heatmaps.tps}
            colorScale=${tpsColorScale()}
            cellLabel=${(v) => v != null ? v.toFixed(1) : ''}
          />
        </${Section}>

        <${Section} title="Players by hour of week" defaultOpen=${true}>
          <p class="ui-text-low feat-hint">Colour = average concurrent players — darker blue means busier (not a health grade). UTC hours.</p>
          <${Heatmap}
            idPrefix="hm-players"
            rows=${DOW_LABELS}
            cols=${HOUR_LABELS}
            values=${heatmaps.players}
            colorScale=${playersColorScale(heatmaps.maxPlayers)}
            cellLabel=${(v) => v != null ? v.toFixed(0) : ''}
          />
        </${Section}>
      </div>

      <${Section} title="Hourly averages (UTC)" defaultOpen=${true}>
        <p class="ui-text-low feat-hint">Hover (or focus) a bar for that UTC hour’s average, players, and sample minutes.</p>
        <div class="feat-hour-bars">
          <${HourBars}
            title="MSPT by hour"
            metricLabel="MSPT"
            hours=${hourBars.mspt}
            players=${hourBars.players}
            samples=${hourBars.samples}
            format=${(v) => formatMspt(v)}
            tone="warn"
          />
          <${HourBars}
            title="TPS by hour"
            metricLabel="TPS"
            hours=${hourBars.tps}
            players=${hourBars.players}
            samples=${hourBars.samples}
            format=${(v) => formatTps(v)}
            tone="ok"
          />
          <${HourBars}
            title="Players by hour"
            metricLabel="Players"
            hours=${hourBars.players}
            samples=${hourBars.samples}
            format=${(v) => (v == null ? '—' : Number(v).toFixed(1))}
            tone="info"
          />
        </div>
      </${Section}>
    </div>
  `;
}

function PatternsLoad({ daily, playerBins, dailyCols, playerBinCols }) {
  if (!daily.length && !playerBins.length) {
    return html`<${EmptyState} title="No load tables yet" body="Daily breakdown and player-count bins appear once enough rollup history exists." />`;
  }

  return html`
    <div class="feat-insights-panel feat-insights-panel--load">
      ${daily.length > 0 ? html`
        <${Section} title="Daily breakdown" defaultOpen=${true}>
          <div class="feat-table-scroll">
            <${DataTable}
              columns=${dailyCols}
              rows=${daily}
              rowKey="date"
              density=${36}
              stickyHeader=${true}
            />
          </div>
          <div class="feat-export-row">
            <${Button} kind="neutral" size="sm" onClick=${() => addToast('CSV export — available in full build', 'info')}>
              Export CSV
            </${Button}>
          </div>
        </${Section}>
      ` : null}

      ${playerBins.length > 0 ? html`
        <${Section} title="Load by player count" defaultOpen=${true}>
          <${DataTable}
            columns=${playerBinCols}
            rows=${playerBins}
            rowKey="players_band"
            density=${36}
          />
        </${Section}>
      ` : null}
    </div>
  `;
}

function PatternsIncidents({ correlations, relatedEvents, stickyLag, outliers, outlierCols }) {
  const empty = !correlations.length && !relatedEvents.length && !stickyLag.length && !outliers.length;
  if (empty) {
    return html`<${EmptyState} title="No incidents in this window" body="Outliers, sticky lag, and related events show up when rollups catch unusual lag." />`;
  }

  return html`
    <div class="feat-insights-panel feat-insights-panel--incidents">
      ${correlations.length > 0 ? html`
        <${Section} title="Correlations" defaultOpen=${true}>
          <div class="feat-list">
            ${correlations.map((c) => html`
              <${ListRow}
                key=${c.id}
                tone=${severityTone(c.severity)}
                title=${c.title}
                meta=${c.detail}
                badge=${html`<${Badge} tone=${severityTone(c.severity)}>${c.severity ?? 'info'}</${Badge}>`}
              />
            `)}
          </div>
        </${Section}>
      ` : null}

      ${relatedEvents.length > 0 ? html`
        <${Section} title="Related events" defaultOpen=${true}>
          <div class="feat-list">
            ${relatedEvents.map((ev, i) => html`
              <${ListRow}
                key=${`${ev.ts}-${i}`}
                tone=${ev.type?.includes('lag') || ev.type?.includes('spike') ? 'warn' : 'neutral'}
                title=${ev.title}
                meta=${ev.detail ?? (ev.ts ? new Date(ev.ts).toLocaleString() : null)}
                actions=${ev.tab_link ? html`
                  <${Button} kind="neutral" size="sm" onClick=${() => navigate(ev.tab_link)}>
                    Open
                  </${Button}>
                ` : null}
              />
            `)}
          </div>
        </${Section}>
      ` : null}

      ${stickyLag.length > 0 ? html`
        <${Section} title="Sticky-lag episodes" defaultOpen=${true}>
          ${stickyLag.map((ep, i) => html`
            <div key=${i} class="feat-card feat-card--warn">
              <div class="feat-card__title">${ep.narrative}</div>
              <div class="feat-card__meta">
                ${new Date(ep.started_at).toLocaleString()} — ${new Date(ep.ended_at).toLocaleString()}
                · ${ep.duration_min}min · peak ${ep.peak_mspt}ms
              </div>
            </div>
          `)}
        </${Section}>
      ` : null}

      ${outliers.length > 0 ? html`
        <${Section} title="Outlier minutes" defaultOpen=${true}>
          <div class="feat-table-scroll">
            <${DataTable}
              columns=${outlierCols}
              rows=${outliers}
              rowKey="ts"
              density=${36}
            />
          </div>
        </${Section}>
      ` : null}
    </div>
  `;
}

function PatternsTab({ dash, windowKey, panel, onPanelChange }) {
  if (!dash) {
    return html`<${EmptyState} title="No data yet" body="Run a report or wait for enough live samples to build patterns." />`;
  }

  const summary = dash.summary_extended ?? {};
  const insights = dash.insights ?? [];
  const stickyLag = dash.sticky_lag ?? [];
  const outliers = dash.outlier_minutes ?? [];
  const daily = dash.daily_series ?? [];
  const hourOfWeek = dash.hour_of_week ?? [];
  const playerBins = dash.player_bins ?? [];
  const correlations = dash.correlations ?? [];
  const relatedEvents = dash.related_events ?? [];
  const relatedCount = dash.related_event_count ?? relatedEvents.length;
  const activePanel = PATTERNS_PANELS.some((p) => p.value === panel) ? panel : 'overview';

  const kpis = [
    {
      label: 'Sample minutes',
      value: summary.sample_minutes ?? 0,
      format: (v) => (v == null ? '—' : String(Math.round(v))),
      caption: 'In analysis window',
      hint: PERF_KPI_HINTS.samples,
    },
    {
      label: 'Avg TPS',
      value: summary.tps_avg ?? 0,
      format: (v) => formatTps(v),
      caption: 'Rollup average',
      hint: PERF_KPI_HINTS.tps,
    },
    {
      label: 'MSPT p95',
      value: summary.mspt_p95 ?? 0,
      format: (v) => formatMspt(v),
      caption: '95th percentile',
      hint: PERF_KPI_HINTS.mspt,
    },
    {
      label: 'Low-TPS min',
      value: summary.low_tps_minutes ?? 0,
      format: (v) => (v == null ? '—' : String(Math.round(v))),
      caption: 'Below warn threshold',
      hint: PERF_KPI_HINTS.lowTps,
    },
    {
      label: 'Peak players',
      value: summary.players_peak ?? 0,
      format: (v) => (v == null ? '—' : String(Math.round(v))),
      caption: 'Max in window',
      hint: PERF_KPI_HINTS.players,
    },
    {
      label: 'Sticky episodes',
      value: summary.sticky_episode_count ?? 0,
      format: (v) => String(Math.round(v ?? 0)),
      caption: 'Post-session lag',
      hint: PERF_KPI_HINTS.sticky,
    },
    {
      label: 'Outlier minutes',
      value: summary.outlier_count ?? 0,
      format: (v) => String(Math.round(v ?? 0)),
      caption: 'Flagged weird lag',
      hint: PERF_KPI_HINTS.outliers,
    },
    {
      label: 'Related events',
      value: relatedCount,
      format: (v) => String(Math.round(v ?? 0)),
      caption: 'Lag / spike / pins',
      hint: PERF_KPI_HINTS.related,
    },
  ];

  const heatmaps = useMemo(() => buildHourOfWeekMaps(hourOfWeek), [hourOfWeek]);
  const hourBars = useMemo(() => buildHourBars(hourOfWeek), [hourOfWeek]);

  const outlierCols = [
    { key: 'ts', label: 'Time', render: (v) => v ? new Date(v).toLocaleString() : '—' },
    { key: 'mspt_avg', label: 'MSPT', render: (v) => formatMspt(v) },
    { key: 'players_max', label: 'Players', render: (v) => v ?? '0' },
    { key: 'reason', label: 'Reason', render: (v) => v ?? '—' },
  ];

  const dailyCols = [
    { key: 'date', label: 'Date' },
    { key: 'mspt_avg', label: 'MSPT avg', render: (v) => formatMspt(v) },
    { key: 'mspt_p95', label: 'MSPT p95', render: (v) => formatMspt(v) },
    { key: 'tps_avg', label: 'TPS avg', render: (v) => formatTps(v) },
    { key: 'players_peak', label: 'Peak players', render: (v) => v ?? '—' },
    { key: 'low_tps_minutes', label: 'Low-TPS min', render: (v) => v ?? '—' },
  ];

  const playerBinCols = [
    { key: 'players_band', label: 'Players' },
    { key: 'minutes', label: 'Minutes' },
    { key: 'mspt_avg', label: 'MSPT avg', render: (v) => formatMspt(v) },
    { key: 'tps_avg', label: 'TPS avg', render: (v) => formatTps(v) },
  ];

  return html`
    <div class="feat-insights-patterns-wrap">
      <${Subnav}
        options=${PATTERNS_PANELS}
        value=${activePanel}
        onChange=${onPanelChange}
        density="nested"
      />

      ${activePanel === 'overview' && html`
        <${PatternsOverview}
          dash=${dash}
          windowKey=${windowKey}
          kpis=${kpis}
          insights=${insights}
        />
      `}
      ${activePanel === 'schedule' && html`
        <${PatternsSchedule}
          hourOfWeek=${hourOfWeek}
          heatmaps=${heatmaps}
          hourBars=${hourBars}
        />
      `}
      ${activePanel === 'load' && html`
        <${PatternsLoad}
          daily=${daily}
          playerBins=${playerBins}
          dailyCols=${dailyCols}
          playerBinCols=${playerBinCols}
        />
      `}
      ${activePanel === 'incidents' && html`
        <${PatternsIncidents}
          correlations=${correlations}
          relatedEvents=${relatedEvents}
          stickyLag=${stickyLag}
          outliers=${outliers}
          outlierCols=${outlierCols}
        />
      `}
    </div>
  `;
}

function ModChangesTab({ modsInventory }) {
  if (!modsInventory) {
    return html`<${EmptyState} title="No mod inventory" body="Run a report to populate the mod-changes diff." />`;
  }

  const diff = modsInventory.diff ?? {};
  const allChanges = [
    ...(diff.added ?? []),
    ...(diff.removed ?? []),
    ...(diff.changed ?? []),
  ];

  const cols = [
    { key: 'display_name', label: 'Mod', sortable: true },
    { key: 'mod_id', label: 'ID' },
    { key: 'version', label: 'Version', render: (v) => v ?? '—' },
    { key: 'change', label: 'Change', render: (v) => {
      const tone = v === 'added' ? 'success' : v === 'removed' ? 'danger' : 'info';
      return html`<${Badge} tone=${tone}>${v}</${Badge}>`;
    }},
  ];

  if (!diff.has_changes) {
    return html`<${EmptyState} title="No changes" body="Mod folder matches the last report snapshot." />`;
  }

  return html`
    <div class="feat-insights-modchanges">
      <p class="feat-hint ui-text-low">${modsInventory.tldr}</p>
      <${Section} title="Mod diff — ${allChanges.length} change(s)" defaultOpen=${true}>
        <${DataTable}
          columns=${cols}
          rows=${allChanges}
          rowKey="jar"
          density=${36}
          stickyHeader=${true}
          empty="No changes"
        />
      </${Section}>
    </div>
  `;
}

function StorageTab({ diskJump }) {
  const liveVal = live.value;
  const latest = liveVal?.latest ?? null;
  const envelope = liveVal?.envelope ?? null;
  const factsStorage = reports.value?.facts?.optional?.storage ?? null;

  const byDimension = latest?.by_dimension
    ?? envelope?.storage?.by_dimension
    ?? [];

  const worldGb = factsStorage?.world_gb ?? envelope?.storage?.world_gb ?? latest?.world_gb ?? null;
  const modsGb = factsStorage?.mods_gb ?? null;
  const logsGb = factsStorage?.logs_gb
    ?? (envelope?.storage?.logs_mb != null ? envelope.storage.logs_mb / 1024 : null)
    ?? (envelope?.storage?.logs_bytes != null ? envelope.storage.logs_bytes / (1024 ** 3) : null);
  const totalGb = factsStorage?.total_gb
    ?? envelope?.storage?.server_dir_gb
    ?? null;
  const deltaMb24h = factsStorage?.delta_mb_24h ?? envelope?.storage?.delta_mb_24h ?? null;
  const diskPct = diskJump?.disk_use_pct ?? latest?.disk_use_pct ?? null;

  const categories = [];
  if (worldGb != null) categories.push({ id: 'world', label: 'World', gb: worldGb, tone: 'accent' });
  if (modsGb != null) categories.push({ id: 'mods', label: 'Mods', gb: modsGb, tone: 'info' });
  if (logsGb != null) categories.push({ id: 'logs', label: 'Logs', gb: logsGb, tone: 'warn' });
  if (totalGb != null) {
    const accounted = categories.reduce((s, c) => s + (c.gb ?? 0), 0);
    const other = Math.max(0, totalGb - accounted);
    if (other >= 0.05) categories.push({ id: 'other', label: 'Other (server dir)', gb: other, tone: 'neutral' });
  }

  const catMax = Math.max(...categories.map((c) => c.gb ?? 0), 0.01);
  const catSum = categories.reduce((s, c) => s + (c.gb ?? 0), 0) || catMax;
  const dimsSorted = [...byDimension].sort((a, b) => (b.gb ?? 0) - (a.gb ?? 0));
  const dimMax = Math.max(...dimsSorted.map((d) => d.gb ?? 0), 0.01);
  const dimSum = dimsSorted.reduce((s, d) => s + (d.gb ?? 0), 0) || dimMax;

  const hasAny = diskJump || categories.length || dimsSorted.length || worldGb != null || diskPct != null;
  if (!hasAny) {
    return html`
      <${EmptyState}
        title="No disk data"
        body="Storage metrics come from live samples and the latest report. Run a report or wait for the next scan."
      />
    `;
  }

  const kpis = [
    { label: 'Disk use', value: diskPct, format: (v) => formatPct(v, 1) },
    { label: 'World', value: worldGb, format: (v) => formatGb(v) },
    { label: 'Mods', value: modsGb, format: (v) => formatGb(v) },
    { label: 'Logs', value: logsGb, format: (v) => formatGb(v) },
    { label: '24h change', value: deltaMb24h, format: (v) => (v == null ? '—' : (v >= 0 ? `+${formatMb(v)}` : formatMb(v))) },
  ].filter((k) => k.value != null);

  return html`
    <div class="feat-insights-storage">
      ${diskJump?.active ? html`
        <div class="feat-card feat-card--warn">
          <div class="feat-card__title">${diskJump.message ?? diskJump.label ?? 'Disk use jumped since last report'}</div>
        </div>
      ` : null}

      ${kpis.length ? html`
        <${Section} title="At a glance">
          <div class="feat-kpi-row">
            ${kpis.map((k) => html`
              <${MetricTile}
                key=${k.label}
                label=${k.label}
                value=${k.value}
                format=${k.format}
              />
            `)}
          </div>
        </${Section}>
      ` : null}

      ${categories.length || dimsSorted.length ? html`
        <div class="feat-insights-storage__breakdown">
          ${categories.length ? html`
            <${Section} title="What’s using space">
              <div class="feat-storage-stack">
                <div class="feat-storage-stack__bar" role="img" aria-label="Space by category">
                  ${categories.map((c) => html`
                    <span
                      key=${c.id}
                      class=${`feat-storage-stack__seg feat-storage-stack__seg--${c.tone}`}
                      style=${{ width: `${Math.max(2, ((c.gb ?? 0) / catSum) * 100)}%` }}
                      title=${`${c.label}: ${formatGb(c.gb)}`}
                    ></span>
                  `)}
                </div>
                <div class="feat-storage-legend">
                  ${categories.map((c) => html`
                    <div class="feat-storage-legend__item" key=${c.id}>
                      <span class=${`feat-storage-legend__swatch feat-storage-stack__seg--${c.tone}`}></span>
                      <span class="feat-storage-legend__label">${c.label}</span>
                      <span class="feat-storage-legend__value">${formatGb(c.gb)}</span>
                      <span class="feat-storage-legend__pct">${formatPct(((c.gb ?? 0) / catSum) * 100, 0)}</span>
                    </div>
                  `)}
                </div>
                <div class="feat-storage-rows">
                  ${categories.map((c) => html`
                    <div class="feat-storage-row" key=${`${c.id}-row`}>
                      <div class="feat-storage-row__meta">
                        <span>${c.label}</span>
                        <span>${formatGb(c.gb)}</span>
                      </div>
                      <${Progress} value=${((c.gb ?? 0) / catMax) * 100} max=${100} tone=${c.tone === 'warn' ? 'warn' : c.tone === 'info' ? 'info' : null} />
                    </div>
                  `)}
                </div>
              </div>
            </${Section}>
          ` : null}

          ${dimsSorted.length ? html`
            <${Section}
              title="By dimension"
              badge=${html`<${Badge} tone="neutral">${dimsSorted.length}</${Badge}>`}
            >
              <div class="feat-storage-rows">
                ${dimsSorted.map((dim) => {
                  const label = dim.label ?? String(dim.id ?? dim.path ?? '—').replace(/^minecraft:/, '');
                  const gb = dim.gb ?? 0;
                  return html`
                    <div class="feat-storage-row" key=${dim.id ?? dim.path ?? label}>
                      <div class="feat-storage-row__meta">
                        <span class="feat-storage-row__label">
                          ${label}
                          ${dim.path ? html`<span class="feat-storage-row__path">${dim.path}</span>` : null}
                        </span>
                        <span class="feat-storage-row__value">
                          ${formatGb(gb)}
                          <span class="feat-storage-row__share">${formatPct((gb / dimSum) * 100, 0)} of world scan</span>
                        </span>
                      </div>
                      <${Progress} value=${(gb / dimMax) * 100} max=${100} />
                    </div>
                  `;
                })}
              </div>
            </${Section}>
          ` : null}
        </div>
      ` : null}

      ${diskJump && (diskJump.baseline_disk_use_pct != null || diskJump.delta_pct != null) ? html`
        <${Section} title="Since last report">
          <div class="feat-kpi-row">
            <${MetricTile}
              label="Baseline"
              value=${diskJump.baseline_disk_use_pct ?? 0}
              format=${(v) => formatPct(v, 1)}
            />
            <${MetricTile}
              label="Now"
              value=${diskJump.disk_use_pct ?? diskPct ?? 0}
              format=${(v) => formatPct(v, 1)}
            />
            <${MetricTile}
              label="Delta"
              value=${diskJump.delta_pct ?? 0}
              format=${(v) => `${v >= 0 ? '+' : ''}${formatPct(v, 1)}`}
            />
            ${diskJump.delta_free_gb != null ? html`
              <${MetricTile}
                label="Less free"
                value=${diskJump.delta_free_gb}
                format=${(v) => formatGb(v)}
              />
            ` : null}
          </div>
        </${Section}>
      ` : null}
    </div>
  `;
}

export function PageView() {
  const { window: win, dashboard, insights: insightsData } = performance.value;
  const { params } = ui.value.route;
  const activeView = params?.view ?? 'patterns';
  const patternsPanel = params?.panel ?? 'overview';

  const opsCacheData = opsCache.value.data;

  const dash = dashboard;
  const modsInventory = opsCacheData?.mods_inventory ?? null;
  const diskJump = opsCacheData?.disk_jump ?? null;

  function handleViewChange(v) {
    if (v === 'patterns') {
      navigate('insights', { view: 'patterns', panel: 'overview' });
    } else {
      navigate('insights', { view: v });
    }
  }

  function handlePatternsPanel(panel) {
    navigate('insights', { view: 'patterns', panel });
  }

  function handleWindowChange(w) {
    loadPerformance(w);
  }

  useEffect(() => {
    loadPerformance(performance.value.window || '7d');
  }, []);

  return html`
    <${Page}
      tour="insights"
      title="Performance Insights"
      subtitle="Trend analysis and regression detection (${win})"
      actions=${html`
        <${Segmented}
          options=${WINDOW_OPTS}
          value=${win}
          onChange=${handleWindowChange}
          size="sm"
        />
      `}
    >
      <${Subnav}
        options=${SUBNAV}
        value=${activeView}
        onChange=${handleViewChange}
      />

      ${activeView === 'patterns' && html`
        <${PatternsTab}
          dash=${dash}
          windowKey=${win}
          panel=${patternsPanel}
          onPanelChange=${handlePatternsPanel}
        />
      `}
      ${activeView === 'mod-changes' && html`<${ModChangesTab} modsInventory=${modsInventory} />`}
      ${activeView === 'storage' && html`<${StorageTab} diskJump=${diskJump} />`}
    </${Page}>
  `;
}
