import { html, useMemo, useEffect, useRef, useState } from '../../lib/preact.js';
import { performance, ui, opsCache, live, reports, dataSources } from '../../state/stores.js';
import { loadPerformance, addToast, setPerformanceBaselineNow } from '../../state/actions.js';
import { Page, Section, MetricTile, DataTable, ListRow, EmptyState, Heatmap, Subnav, FreshnessBadge } from '../../ui/patterns/index.js';
import { Segmented, Button, Badge, Progress, Card, Tooltip, CopyButton } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import { HourBars } from '../../ui/patterns/bar-meter.js';
import { formatMspt, formatTps, formatPct, formatGb, formatMb } from '../../domain/formats.js';
import { navigate } from '../../app/router.js';

const SUBNAV = [
  { value: 'patterns', label: 'Patterns' },
  { value: 'configs', label: 'Configs' },
  { value: 'mod-changes', label: 'Mod changes' },
  { value: 'storage', label: 'Storage' },
];

/** Build config recommendation cards (JVM first; server.properties from 1.1.8 audit). */
function buildConfigRecommendations({ jvmHealth, latest, configAudit }) {
  const items = [];
  if (jvmHealth) {
    const gcPause = latest?.gc_pause_pct ?? latest?.jvm_gc?.pause_pct_of_wall ?? jvmHealth.gc_pause_pct_of_wall ?? null;
    const heapPressure = latest?.heap_mb?.pressure_pct ?? jvmHealth.heap_pressure_pct ?? null;
    const flags = jvmHealth.recommended_flags || null;
    const missing = Array.isArray(jvmHealth.missing_flags)
      ? jvmHealth.missing_flags.filter((f) => f && f !== 'aikars.marker')
      : [];
    const action = jvmHealth.recommend_action || null;
    const ctx = jvmHealth.context || {};
    items.push({
      id: 'jvm-flags',
      category: 'JVM',
      title: 'Java memory settings',
      summary: jvmHealth.advice || 'Watchtower checks your Java launch flags against the best baseline for this server.',
      profile: jvmHealth.flags_profile ?? null,
      profileLabel: profileLabel(jvmHealth.flags_profile),
      verdict: jvmHealth.verdict ?? null,
      recommendAction: action,
      actionLabel: recommendActionLabel(action),
      actionTone: recommendActionTone(action),
      baselineName: jvmHealth.baseline_name || 'Aikar / flags.sh G1',
      baselineVariant: jvmHealth.baseline_variant || null,
      context: ctx,
      javaMajor: ctx.java_major ?? jvmHealth.java_major ?? null,
      gcPausePct: gcPause,
      heapPressurePct: heapPressure,
      missingFlags: missing,
      coverage: jvmHealth.flags_coverage || null,
      copyText: flags,
      copyLabel: 'Copy flags',
      flagsDisplay: flags ? formatFlagsForDisplay(flags) : null,
      optionalZgc: jvmHealth.optional_zgc_flags || null,
      actionable: !!flags
        || missing.length > 0
        || action === 'fix_java_first'
        || action === 'optional_zgc'
        || action === 'adopt_baseline'
        || action === 'complete_baseline'
        || action === 'apply_large_overrides',
    });
  }
  if (configAudit && configAudit.status !== 'disabled' && Array.isArray(configAudit.properties) && configAudit.properties.length) {
    const consider = configAudit.summary?.consider ?? configAudit.properties.filter((p) =>
      p.verdict === 'consider_lowering' || p.verdict === 'consider_raising').length;
    items.push({
      id: 'server-properties',
      category: 'server.properties',
      title: 'Game settings audit',
      summary: consider > 0
        ? `${consider} setting${consider === 1 ? '' : 's'} worth considering — read-only advisory; Watchtower will not change files.`
        : 'server.properties looks within usual ranges for modded dedicated servers.',
      properties: configAudit.properties,
      summaryCounts: configAudit.summary || null,
      readOnly: true,
      actionable: false,
      actionLabel: 'Read-only advisory',
      actionTone: 'neutral',
    });
  }
  return items;
}

function recommendActionLabel(action) {
  switch (action) {
    case 'fix_java_first': return 'Install correct Java first';
    case 'adopt_baseline': return 'Worth adopting recommended flags';
    case 'complete_baseline': return 'Worth adding missing flags';
    case 'apply_large_overrides': return 'Apply large-heap overrides';
    case 'keep': return 'Already on recommended setup';
    case 'keep_advanced': return 'Keep advanced setup';
    case 'optional_zgc': return 'Optional: try ZGC';
    default: return action ? String(action).replace(/_/g, ' ') : null;
  }
}

function recommendActionTone(action) {
  switch (action) {
    case 'keep': return 'ok';
    case 'keep_advanced': return 'info';
    case 'fix_java_first': return 'danger';
    case 'adopt_baseline':
    case 'complete_baseline':
    case 'apply_large_overrides':
    case 'optional_zgc':
      return 'warn';
    default: return 'neutral';
  }
}

function prettyLoader(loader) {
  if (!loader) return null;
  const l = String(loader).toLowerCase();
  if (l === 'neoforge') return 'NeoForge';
  if (l === 'forge') return 'Forge';
  if (l === 'fabric') return 'Fabric';
  if (l === 'paper' || l === 'purpur') return 'Paper';
  return String(loader);
}

function metaLine(it) {
  const parts = [];
  if (it.profileLabel) parts.push(it.profileLabel);
  if (it.verdict) parts.push(verdictLabel(it.verdict));
  const ctx = it.context || {};
  const java = ctx.java_major ?? it.javaMajor;
  if (java != null) parts.push(`Java ${java}`);
  if (ctx.mc_version) parts.push(`Minecraft ${ctx.mc_version}`);
  const loader = prettyLoader(ctx.loader);
  if (loader) parts.push(loader);
  if (ctx.xmx_gb != null) parts.push(`${Math.round(Number(ctx.xmx_gb))}G memory`);
  const baseline = it.baselineName || 'Aikar / flags.sh G1';
  const variant = it.baselineVariant === 'large_heap' ? ' (12G+)' : '';
  if (it.recommendAction === 'keep_advanced') {
    parts.push(`Default baseline: ${baseline}${variant}`);
  } else {
    parts.push(`Best setup: ${baseline}${variant}`);
  }
  return parts.join(' · ');
}

function profileLabel(profile) {
  switch (profile) {
    case 'aikars': return 'Aikar / flags.sh';
    case 'g1_basic': return 'G1 (basic)';
    case 'default': return 'Default JVM';
    case 'g1_bruce': return 'G1 (Bruce)';
    case 'g1_meowice': return 'G1 (MeowIce)';
    case 'zgc': return 'ZGC';
    case 'zgc_meowice': return 'ZGC (MeowIce)';
    case 'shenandoah': return 'Shenandoah';
    case 'graal_g1': return 'Graal + G1';
    case 'openj9': return 'OpenJ9';
    default: return profile ? String(profile).replace(/_/g, ' ') : 'Unknown';
  }
}

function formatFlagsForDisplay(flags) {
  return String(flags).trim().replace(/\s+/g, ' ');
}

function verdictLabel(verdict) {
  switch (verdict) {
    case 'healthy': return 'Looking good';
    case 'gc_bound': return 'Cleanup too busy';
    case 'heap_bound': return 'Memory nearly full';
    case 'single_thread':
    case 'single_thread_bound': return 'Not a memory issue';
    default: return verdict ? String(verdict).replace(/_/g, ' ') : 'Unknown';
  }
}

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
    if (v == null) return 'var(--ui-bg3)';
    const norm = Math.min(1, v / Math.max(maxMspt, 1));
    const tone = norm < 0.4 ? 'var(--ui-ok)' : norm < 0.72 ? 'var(--ui-warn)' : 'var(--ui-danger)';
    const pct = Math.round(16 + norm * 68);
    return `color-mix(in srgb, ${tone} ${pct}%, var(--ui-bg2))`;
  };
}

/** Lower TPS = warmer (worse). Ideal ~20. */
function tpsColorScale() {
  return (v) => {
    if (v == null) return 'var(--ui-bg3)';
    const norm = Math.min(1, Math.max(0, (20 - v) / 20));
    const tone = norm < 0.35 ? 'var(--ui-ok)' : norm < 0.7 ? 'var(--ui-warn)' : 'var(--ui-danger)';
    const pct = Math.round(14 + norm * 70);
    return `color-mix(in srgb, ${tone} ${pct}%, var(--ui-bg2))`;
  };
}

/** Higher player count = busier (accent intensity), not a health signal. */
function playersColorScale(maxPlayers) {
  return (v) => {
    if (v == null) return 'var(--ui-bg3)';
    const norm = Math.min(1, v / Math.max(maxPlayers, 1));
    const pct = Math.round(12 + norm * 72);
    return `color-mix(in srgb, var(--ui-accent) ${pct}%, var(--ui-bg2))`;
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

function ramSizingBadge(verdict) {
  switch (verdict) {
    case 'over_provisioned': return { label: 'Over-provisioned', tone: 'info' };
    case 'under_provisioned': return { label: 'Under-provisioned', tone: 'warn' };
    case 'insufficient_data': return { label: 'Not enough data', tone: 'neutral' };
    case 'right_sized': return { label: 'Right-sized', tone: 'ok' };
    default: return { label: 'Unknown', tone: 'neutral' };
  }
}

function RamSizingCard({ ram }) {
  if (!ram) return null;
  const badge = ramSizingBadge(ram.verdict);
  const blocked = !!ram.ram_upgrade_blocked;
  const tone = blocked ? 'warn' : (ram.verdict === 'under_provisioned' ? 'warn'
    : ram.verdict === 'over_provisioned' ? 'info'
      : ram.verdict === 'insufficient_data' ? 'neutral' : 'ok');
  const peak = ram.heap_used_gb_peak;
  const xmx = ram.xmx_gb;
  const suggestMin = ram.suggested_xmx_gb_min;
  const suggestMax = ram.suggested_xmx_gb_max;
  const suggestLabel = suggestMin != null
    ? (suggestMax != null && suggestMax !== suggestMin
      ? `toward ${suggestMin}–${suggestMax}G`
      : `toward ~${suggestMin}G`)
    : null;

  return html`
    <div class=${`feat-ram-sizing ui-instrument ui-instrument--${tone}`} data-verdict=${ram.verdict || 'unknown'}>
      <div class="feat-ram-sizing__head">
        <div class="feat-ram-sizing__title-row">
          <span class="feat-ram-sizing__title">RAM sizing</span>
          <${Badge} tone=${badge.tone}>${badge.label}</${Badge}>
        </div>
        <p class="feat-ram-sizing__advice ui-text-low">${ram.advice || '—'}</p>
      </div>
      <div class="feat-ram-sizing__meta">
        ${xmx != null ? html`<span>Allocated <strong>${formatGb(xmx)}</strong></span>` : null}
        ${peak != null ? html`<span>Peak <strong>${formatGb(peak)}</strong></span>` : null}
        ${ram.heap_pressure_pct_p95 != null
          ? html`<span>Pressure p95 <strong>${Number(ram.heap_pressure_pct_p95).toFixed(0)}%</strong></span>`
          : null}
        ${suggestLabel ? html`<span>Suggest <strong>${suggestLabel}</strong></span>` : null}
      </div>
      ${blocked && ram.gc_verdict === 'single_thread_bound' ? html`
        <div class="feat-ram-sizing__actions">
          <${Button} kind="neutral" size="sm" onClick=${() => navigate('live')}>
            Open Live
          </${Button}>
        </div>
      ` : null}
    </div>
  `;
}

function PatternsOverview({ dash, windowKey, kpis, insights }) {
  const [settingBaseline, setSettingBaseline] = useState(false);
  const regression = dash?.baseline_regression ?? null;
  const showBanner = !!(regression && (regression.active || !regression.has_baseline));

  async function handleSetBaseline() {
    if (settingBaseline) return;
    const ok = typeof window !== 'undefined'
      ? window.confirm('Replace the saved performance baseline with the last ~24h of samples?')
      : true;
    if (!ok) return;
    setSettingBaseline(true);
    try {
      await setPerformanceBaselineNow();
    } finally {
      setSettingBaseline(false);
    }
  }

  return html`
    <div class="feat-insights-panel">
      ${showBanner ? html`
        <div class=${`feat-baseline-banner ui-instrument ui-instrument--${regression.active ? 'warn' : 'info'}`}>
          <div class="feat-baseline-banner__text">
            <div class="feat-baseline-banner__title">${regression.label || 'Performance baseline'}</div>
            ${regression.detail ? html`<p class="ui-text-low">${regression.detail}</p>` : null}
            ${regression.since ? html`<p class="ui-text-low">Since about ${regression.since}</p>` : null}
          </div>
          <${Button}
            kind=${regression.active ? 'accent' : 'neutral'}
            size="sm"
            disabled=${settingBaseline || regression.can_set_baseline === false}
            loading=${settingBaseline}
            onClick=${handleSetBaseline}
          >
            Set new baseline
          </${Button}>
        </div>
      ` : regression?.has_baseline ? html`
        <div class="feat-baseline-banner feat-baseline-banner--quiet">
          <span class="ui-text-low">${regression.label || 'On pace with baseline'}</span>
          <${Button}
            kind="neutral"
            size="sm"
            disabled=${settingBaseline}
            loading=${settingBaseline}
            onClick=${handleSetBaseline}
          >
            Set new baseline
          </${Button}>
        </div>
      ` : null}

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
          <p class="ui-text-low feat-hint">Colour = average concurrent players — stronger accent means busier (not a health grade). UTC hours.</p>
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

function PatternsLoad({ daily, playerBins, dailyCols, playerBinCols, loadTakeaway }) {
  if (!daily.length && !playerBins.length) {
    return html`<${EmptyState} title="No load tables yet" body="Daily breakdown and player-count bins appear once enough rollup history exists." />`;
  }

  return html`
    <div class="feat-insights-panel feat-insights-panel--load">
      ${loadTakeaway ? html`
        <${ListRow}
          tone=${loadTakeaway.tone || 'warn'}
          title=${loadTakeaway.title}
          meta=${loadTakeaway.meta}
        />
      ` : null}
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
    return html`<${EmptyState} title="No data yet" body="Wait for enough live samples to build patterns — Watching fills this automatically." />`;
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
    { key: 'heap_pressure_pct_avg', label: 'Heap pressure', render: (v) => v != null ? `${Number(v).toFixed(0)}%` : '—' },
    { key: 'gc_pause_pct_avg', label: 'GC pause %', render: (v) => v != null ? `${Number(v).toFixed(1)}%` : '—' },
    { key: 'low_tps_minutes', label: 'Low-TPS min', render: (v) => v ?? '—' },
  ];

  const loadTakeaway = (() => {
    const withPressure = daily.filter((d) => d.heap_pressure_pct_avg != null || d.gc_pause_pct_avg != null);
    if (!withPressure.length) return null;
    const avgHeap = withPressure.reduce((s, d) => s + (Number(d.heap_pressure_pct_avg) || 0), 0) / withPressure.length;
    const avgGc = withPressure.reduce((s, d) => s + (Number(d.gc_pause_pct_avg) || 0), 0) / withPressure.length;
    if (avgHeap >= 90) {
      return {
        tone: 'danger',
        title: 'Memory nearly full',
        meta: `Average memory ~${avgHeap.toFixed(0)}% full — raising -Xmx may help; see Insights → Configs.`,
      };
    }
    if (avgGc >= 10 && avgHeap < 85) {
      return {
        tone: 'warn',
        title: 'Memory cleanup too busy',
        meta: `Cleanup was busy ~${avgGc.toFixed(0)}% of the time while memory was not full — check Insights → Configs before buying more RAM.`,
      };
    }
    return null;
  })();

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
          loadTakeaway=${loadTakeaway}
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

function ConfigsTab() {
  const liveVal = live.value;
  const latest = liveVal?.latest ?? null;
  const jvmHealth = reports.value?.facts?.optional?.jvm_health
    ?? latest?.jvm_health_live
    ?? null;
  const configAudit = reports.value?.facts?.optional?.config_launch_audit ?? null;
  const ram = performance.value?.dashboard?.ram_sizing ?? null;

  const items = buildConfigRecommendations({ jvmHealth, latest, configAudit });
  const [expandedMissing, setExpandedMissing] = useState({});

  if (!items.length && !ram) {
    return html`
      <${EmptyState}
        title="No recommendations yet"
        body="Once Watchtower has JVM health from live samples or a report, flag and config suggestions show up here."
      />
    `;
  }

  return html`
    <div class="feat-insights-configs">
      <${RamSizingCard} ram=${ram} />
      ${items.length ? html`
      <p class="feat-hint ui-text-low">
        Best Java launch flags for this server — and game settings from server.properties.
      </p>
      <div class="feat-configs-list">
        ${items.map((it) => {
          if (it.id === 'server-properties') {
            return html`
              <article class="feat-configs-card feat-configs-card--audit" data-verdict="audit" key=${it.id}>
                <header class="feat-configs-card__head">
                  <div class="feat-configs-card__titles">
                    <span class="feat-configs-card__category">${it.category}</span>
                    <h3 class="feat-configs-card__title">${it.title}</h3>
                  </div>
                  ${it.actionLabel ? html`
                    <${Badge} tone=${it.actionTone || 'neutral'}>${it.actionLabel}</${Badge}>
                  ` : null}
                </header>
                <p class="feat-configs-card__summary">${it.summary}</p>
                <div class="feat-configs-props">
                  ${(it.properties || []).map((row, i) => {
                    const tone = row.verdict === 'fine' ? 'ok'
                      : (row.verdict === 'consider_lowering' || row.verdict === 'consider_raising') ? 'warn'
                        : 'neutral';
                    const label = row.verdict === 'fine' ? 'Fine'
                      : row.verdict === 'consider_lowering' ? 'Consider lowering'
                        : row.verdict === 'consider_raising' ? 'Consider raising'
                          : row.verdict === 'missing' ? 'Missing'
                            : String(row.verdict || 'unknown').replace(/_/g, ' ');
                    return html`
                      <${ListRow}
                        key=${row.key}
                        className="feat-configs-props__row"
                        staggerIndex=${i}
                        icon=${html`<${Icon} name="settings" size=${14} />`}
                        tone=${tone}
                        title=${`${row.title || row.key}${row.value != null ? ` · ${row.value}` : ''}`}
                        meta=${row.detail}
                        badge=${html`<${Badge} tone=${tone}>${label}</${Badge}>`}
                      />
                    `;
                  })}
                </div>
                <div class="feat-configs-card__actions">
                  <${Button} kind="neutral" size="sm" onClick=${() => navigate('startup')}>Open Startup audit</${Button}>
                </div>
              </article>
            `;
          }

          const missingAll = (it.missingFlags || []).filter((f) => f !== 'aikars.marker');
          const missingOpen = !!expandedMissing[it.id];
          const missingShown = missingOpen || missingAll.length <= 5
            ? missingAll
            : missingAll.slice(0, 5);
          const missingHidden = Math.max(0, missingAll.length - missingShown.length);
          const coveragePct = it.coverage?.matched != null && it.coverage?.expected
            ? Math.round((it.coverage.matched / Math.max(1, it.coverage.expected)) * 100)
            : null;

          return html`
            <article class="feat-configs-card" data-verdict=${it.verdict || 'unknown'} data-action=${it.recommendAction || ''} key=${it.id}>
              <header class="feat-configs-card__head">
                <div class="feat-configs-card__titles">
                  <span class="feat-configs-card__category">${it.category}</span>
                  <h3 class="feat-configs-card__title">${it.title}</h3>
                </div>
                ${it.actionLabel ? html`
                  <${Badge} tone=${it.actionTone || 'neutral'}>${it.actionLabel}</${Badge}>
                ` : null}
              </header>

              <p class="feat-configs-card__meta">${metaLine(it)}</p>

              <div class="feat-configs-vitals" role="list">
                ${it.gcPausePct != null ? html`
                  <div class="feat-configs-vital" role="listitem">
                    <span class="feat-configs-vital__label">Cleanup busy</span>
                    <span class="feat-configs-vital__value">${Number(it.gcPausePct).toFixed(0)}%</span>
                  </div>
                ` : null}
                ${it.heapPressurePct != null ? html`
                  <div class="feat-configs-vital" role="listitem">
                    <span class="feat-configs-vital__label">Memory full</span>
                    <span class="feat-configs-vital__value">${Number(it.heapPressurePct).toFixed(0)}%</span>
                  </div>
                ` : null}
                ${coveragePct != null ? html`
                  <div class="feat-configs-vital" role="listitem">
                    <span class="feat-configs-vital__label">Baseline coverage</span>
                    <span class="feat-configs-vital__value">${coveragePct}%</span>
                    <span class="feat-configs-vital__sub">${it.coverage.matched}/${it.coverage.expected} flags</span>
                  </div>
                ` : null}
              </div>

              <p class="feat-configs-card__summary">${it.summary}</p>

              ${missingAll.length ? html`
                <section class="feat-configs-missing">
                  <div class="feat-configs-section__head">
                    <h4 class="feat-configs-section__title">Worth adding</h4>
                    <span class="feat-configs-section__count">${missingAll.length}</span>
                  </div>
                  <div class="feat-configs-missing__chips">
                    ${missingShown.map((f) => html`
                      <code class="feat-configs-missing__chip" key=${f}>${f}</code>
                    `)}
                    ${missingHidden > 0 && !missingOpen ? html`
                      <button
                        type="button"
                        class="feat-configs-missing__more"
                        onClick=${() => setExpandedMissing((m) => ({ ...m, [it.id]: true }))}
                      >+${missingHidden} more</button>
                    ` : null}
                    ${missingOpen && missingAll.length > 5 ? html`
                      <button
                        type="button"
                        class="feat-configs-missing__more"
                        onClick=${() => setExpandedMissing((m) => ({ ...m, [it.id]: false }))}
                      >Show less</button>
                    ` : null}
                  </div>
                </section>
              ` : null}

              ${it.flagsDisplay ? html`
                <section class="feat-configs-flags">
                  <div class="feat-configs-section__head">
                    <h4 class="feat-configs-section__title">Recommended flags</h4>
                  </div>
                  <pre class="feat-configs-flags__box" tabindex="0">${it.flagsDisplay}</pre>
                  <p class="feat-configs-flags__hint">Paste into your start script or hosting panel Java args, then restart. Keep start and max memory the same.</p>
                </section>
              ` : null}

              ${it.optionalZgc ? html`
                <section class="feat-configs-flags feat-configs-flags--optional">
                  <div class="feat-configs-section__head">
                    <h4 class="feat-configs-section__title">Optional ZGC trial</h4>
                  </div>
                  <pre class="feat-configs-flags__box" tabindex="0">${formatFlagsForDisplay(it.optionalZgc)}</pre>
                  <p class="feat-configs-flags__hint">Only try after measuring with Spark. Not the default for typical Temurin servers.</p>
                </section>
              ` : null}

              <div class="feat-configs-card__actions">
                <${Button} kind="neutral" size="sm" onClick=${() => navigate('live')}>View memory charts</${Button}>
              </div>
            </article>
          `;
        })}
      </div>
      ` : html`
        <${EmptyState}
          title="No flag recommendations yet"
          body="Once Watchtower has JVM health from live samples or a report, flag suggestions show up here."
        />
      `}
    </div>
  `;
}
function ModChangesTab({ modsInventory }) {
  if (!modsInventory) {
    return html`<${EmptyState} title="No mod inventory" body="Waiting for Scanning to populate mods inventory — check Mods after the next scan." />`;
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
  const diskProjection = reports.value?.facts?.optional?.disk_projection
    ?? performance.value?.data?.disk_projection
    ?? opsCache.value?.data?.disk_projection
    ?? null;

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
        body="Storage metrics come from live samples and Scanning. Wait for the next scan if this is empty."
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

      ${diskProjection ? html`
        <div class=${`feat-card ${diskProjection.verdict === 'filling' ? 'feat-card--warn' : ''}`}
          style=${{ padding: 'var(--ui-sp-16) var(--ui-sp-20)' }}>
          <div class="feat-card__title">Disk fill projection</div>
          <div class="feat-card__body">${diskProjection.message
            ?? (diskProjection.verdict === 'stable'
              ? 'Disk free space is stable / not filling at current growth.'
              : 'Not enough disk history to project fill rate.')}</div>
          ${diskProjection.driver_hint ? html`
            <div class="ui-text-low" style=${{ marginTop: 'var(--ui-sp-8)' }}>${diskProjection.driver_hint}</div>
          ` : null}
          ${diskProjection.fill_rate_gb_per_day != null && diskProjection.verdict === 'filling' ? html`
            <div class="ui-text-low" style=${{ marginTop: 'var(--ui-sp-8)' }}>
              ≈${Number(diskProjection.fill_rate_gb_per_day).toFixed(2)} GB/day · confidence ${diskProjection.confidence ?? '—'}
            </div>
          ` : null}
        </div>
      ` : null}

      ${(performance.value?.data?.insights || []).some((i) => i?.id === 'disk_io_lag_align') ? html`
        <div class="feat-card feat-card--warn" style=${{ padding: 'var(--ui-sp-16) var(--ui-sp-20)' }}>
          <div class="feat-card__title">Lag aligned with slow disk writes</div>
          <div class="feat-card__body">${
            (performance.value.data.insights.find((i) => i.id === 'disk_io_lag_align') || {}).summary
            || 'High MSPT minutes often coincide with elevated disk write activity.'
          }</div>
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
        <${FreshnessBadge} layer="report" at=${dataSources.value?.reportAt} />
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
      ${activeView === 'configs' && html`<${ConfigsTab} />`}
      ${activeView === 'mod-changes' && html`<${ModChangesTab} modsInventory=${modsInventory} />`}
      ${activeView === 'storage' && html`<${StorageTab} diskJump=${diskJump} />`}
    </${Page}>
  `;
}
