/**
 * Watchtower UI v3 — Performance tab (L1 rollup analysis)
 */
const TowerRenderPerformance = (function () {
  const esc = TowerRenderShared.esc;
  const kpiCard = TowerRenderShared.kpiCard;
  const metricHint = TowerRenderShared.metricHint;
  const fmtRelative = TowerRenderShared.fmtRelative;
  const truncateDetail = TowerRenderShared.truncateDetail;

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const INSIGHTS_VIEWS = [
    { id: 'patterns', label: 'Patterns', icon: 'bar-chart-3' },
    { id: 'mod-changes', label: 'Mod changes', icon: 'package-plus' },
    { id: 'storage', label: 'Storage', icon: 'hard-drive' },
  ];

  function insightsView() {
    return state.insightsView || 'patterns';
  }

  function insightsOpsCounts() {
    return typeof TowerRenderInsightsOps !== 'undefined'
      ? TowerRenderInsightsOps.insightsOpsCounts()
      : { modChanges: 0, storageAlert: 0 };
  }

  function renderInsightsSubnav() {
    const view = insightsView();
    const counts = insightsOpsCounts();
    const buttons = INSIGHTS_VIEWS.map(({ id, label, icon }) => {
      const n = id === 'mod-changes' ? counts.modChanges
        : id === 'storage' ? counts.storageAlert
          : 0;
      const badge = n ? `<span class="wt-mods-subnav__badge">${n}</span>` : '';
      const active = view === id ? ' active' : '';
      return `<button type="button" class="wt-mods-subnav__btn${active}" data-insights-view="${id}">
        <i data-lucide="${icon}" width="14" height="14" aria-hidden="true"></i>
        <span>${esc(label)}</span>${badge}
      </button>`;
    }).join('');

    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-insights-subnav-wrap">
        <nav class="wt-mods-subnav" id="insights-subnav" aria-label="Insights sections">${buttons}</nav>
      </div>`;
  }

  function renderInsightsHero(leadHtml, actionsHtml = '') {
    if (typeof TowerTabChrome !== 'undefined') {
      return TowerTabChrome.tabHero('performance', {
        leadHtml,
        actions: actionsHtml,
      });
    }
    return `
      <header class="wt-bento__span-12 wt-perf-hero wt-card wt-card--surface" id="insights-hero">
        <div class="wt-perf-hero__main">
          <h1 class="wt-perf-hero__title">
            <span class="wt-perf-hero__icon" aria-hidden="true"><i data-lucide="lightbulb" width="18" height="18"></i></span>
            Insights
          </h1>
          <p class="wt-perf-hero__lead">${leadHtml}</p>
        </div>
        ${actionsHtml ? `<div class="wt-perf-hero__actions">${actionsHtml}</div>` : ''}
      </header>`;
  }

  function renderInsightsChrome(leadHtml, actionsHtml = '') {
    return `${renderInsightsSubnav()}<div id="insights-hero-wrap">${renderInsightsHero(leadHtml, actionsHtml)}</div>`;
  }

  function syncInsightsSubnav() {
    const subnav = document.getElementById('insights-subnav');
    if (!subnav) return;
    const counts = insightsOpsCounts();
    const view = insightsView();
    subnav.querySelectorAll('[data-insights-view]').forEach((btn) => {
      const id = btn.dataset.insightsView;
      btn.classList.toggle('active', id === view);
      const n = id === 'mod-changes' ? counts.modChanges
        : id === 'storage' ? counts.storageAlert
          : 0;
      let badge = btn.querySelector('.wt-mods-subnav__badge');
      if (n) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'wt-mods-subnav__badge';
          btn.appendChild(badge);
        }
        badge.textContent = String(n);
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function insightsLeadAndActions() {
    const view = insightsView();
    if (view === 'mod-changes') {
      return {
        lead: 'JAR files added, removed, or updated on disk since your last full health report.',
        actions: '',
      };
    }
    if (view === 'storage') {
      return {
        lead: 'Host disk usage vs report baseline, plus where world storage is allocated.',
        actions: '',
      };
    }
    const d = dashboard();
    if (d && d.enabled === false) {
      return {
        lead: 'Minute rollups are disabled. Enable <code>L1_ROLLUP_ENABLED</code> in watchtower.conf. Switch to <strong>Mod changes</strong> or <strong>Storage</strong> for live ops scans.',
        actions: '',
      };
    }
    if (d && d.sufficient_data === false && !(d.insights?.length)) {
      return {
        lead: 'Need more uptime history — check back after 24 hours of minute rollups. Switch to <strong>Mod changes</strong> or <strong>Storage</strong> for live ops scans.',
        actions: '',
      };
    }
    const exportBtn = '<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="performance-export-btn"><i data-lucide="download" width="14" height="14"></i> Download CSV</button>';
    const genAt = d?.generated_at ? `Updated ${esc(fmtRelative(d.generated_at))}` : '';
    return {
      lead: `Patterns from saved minute rollups — busy hours, lag vs players, sticky episodes.${genAt ? ` <span class="wt-perf-hero__meta">Updated ${esc(fmtRelative(d.generated_at))}</span>` : ''}`,
      actions: `${renderWindowToggle()}${exportBtn}`,
    };
  }

  function renderInsightsBodyContent() {
    const view = insightsView();
    if (view === 'mod-changes' && typeof TowerRenderInsightsOps !== 'undefined') {
      return TowerRenderInsightsOps.renderModChangesBody();
    }
    if (view === 'storage' && typeof TowerRenderInsightsOps !== 'undefined') {
      return TowerRenderInsightsOps.renderStorageBody();
    }
    const d = dashboard();
    if (view === 'patterns') {
      if (d && d.enabled === false) return '';
      if (d && d.sufficient_data === false && !(d.insights?.length)) return '';
      return renderPatternsBody(d);
    }
    return '';
  }

  function renderInsightsShell() {
    const { lead, actions } = insightsLeadAndActions();
    const opsCls = insightsView() !== 'patterns' ? ' wt-insights-ops' : '';
    return `
      <div class="wt-tab-performance${opsCls}">
        <div class="wt-bento wt-stagger" id="insights-bento">
          ${renderInsightsChrome(lead, actions)}
          <div id="insights-page-body">${renderInsightsBodyContent()}</div>
        </div>
      </div>`;
  }

  function refreshInsightsPage() {
    if (state.activeTab !== 'performance') {
      if (typeof render === 'function') render();
      return;
    }
    const bento = document.getElementById('insights-bento');
    const heroWrap = document.getElementById('insights-hero-wrap');
    const body = document.getElementById('insights-page-body');
    if (!bento || !heroWrap || !body) {
      if (typeof render === 'function') render();
      return;
    }

    const { lead, actions } = insightsLeadAndActions();
    syncInsightsSubnav();
    heroWrap.innerHTML = renderInsightsHero(lead, actions);
    body.innerHTML = renderInsightsBodyContent();

    const tabRoot = bento.closest('.wt-tab-performance');
    if (tabRoot) {
      tabRoot.classList.toggle('wt-insights-ops', insightsView() !== 'patterns');
    }

    bindPerformanceChromeEvents();
    if (typeof refreshChromeIcons === 'function') refreshChromeIcons();
    if (typeof bindTabLinks === 'function') bindTabLinks();
    if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.rebindPerformanceScroll();
  }

  function renderPatternsBody(d) {
    return `
          ${renderKpiRow(d)}
          ${renderPeriodCompare(d?.period_compare)}
          <div class="wt-card wt-card--surface wt-bento__span-12 wt-scroll-reveal">
            <div class="wt-card__head">
              <h3 class="wt-card__title"><i data-lucide="sparkles" width="16" height="16"></i> Takeaways</h3>
            </div>
            ${renderInsightsList(d)}
          </div>
          ${renderCorrelations(d)}
          <div class="wt-card wt-card--surface wt-bento__span-12 wt-scroll-reveal">
            <h3 class="wt-card__title"><i data-lucide="grid-3x3" width="16" height="16"></i> Busy hours heatmap (UTC)</h3>
            <p class="text-caption">Green = quieter hours · red = busier; number = avg players in that hour</p>
            ${renderHeatmap(d?.hour_of_week)}
          </div>
          <div class="wt-card wt-card--surface wt-bento__span-12 wt-scroll-reveal">
            <h3 class="wt-card__title"><i data-lucide="bar-chart" width="16" height="16"></i> MSPT by hour (UTC)</h3>
            <p class="text-caption">Average MSPT for each hour of day across the analysis window</p>
            ${renderMsptHourBars(d?.hour_of_week)}
          </div>
          <div class="wt-card wt-card--surface wt-bento__span-12 wt-scroll-reveal">
            <h3 class="wt-card__title"><i data-lucide="activity" width="16" height="16"></i> TPS by hour (UTC)</h3>
            <p class="text-caption">Average TPS for each hour of day across the analysis window (20 TPS is ideal)</p>
            ${renderTpsHourBars(d?.hour_of_week)}
          </div>
          <div class="wt-card wt-card--surface wt-bento__span-6 wt-scroll-reveal">
            <h3 class="wt-card__title"><i data-lucide="users" width="16" height="16"></i> Load vs lag</h3>
            ${renderPlayerBins(d?.player_bins)}
          </div>
          <div class="wt-card wt-card--surface wt-bento__span-6 wt-scroll-reveal">
            <h3 class="wt-card__title"><i data-lucide="alert-triangle" width="16" height="16"></i> Outlier minutes</h3>
            ${renderOutliers(d?.outlier_minutes)}
          </div>
          <div class="wt-card wt-card--surface wt-bento__span-6 wt-scroll-reveal">
            <h3 class="wt-card__title"><i data-lucide="timer" width="16" height="16"></i> Sticky lag episodes</h3>
            ${renderStickyEpisodes(d?.sticky_lag)}
          </div>
          <div class="wt-card wt-card--surface wt-bento__span-6 wt-scroll-reveal">
            <h3 class="wt-card__title"><i data-lucide="history" width="16" height="16"></i> Related events</h3>
            ${renderRelatedEvents(d?.related_events)}
          </div>`;
  }

  function dashboard() {
    return state.performanceDashboard || state.performanceInsights;
  }

  function windowHours() {
    const w = state.performanceWindow || '7d';
    return w === '30d' ? 720 : 168;
  }

  function renderWindowToggle() {
    const w = state.performanceWindow || '7d';
    return `
      <div class="wt-segment wt-perf-window-toggle" role="group" aria-label="Analysis window">
        <button type="button" class="wt-segment__btn${w === '7d' ? ' is-active' : ''}" data-perf-window="7d">7 days</button>
        <button type="button" class="wt-segment__btn${w === '30d' ? ' is-active' : ''}" data-perf-window="30d">30 days</button>
      </div>`;
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

  function renderKpiRow(d) {
    const s = d?.summary_extended || {};
    const related = d?.related_event_count ?? (d?.related_events?.length ?? 0);
    return `
      ${kpiCard('perf-samples', 'Sample minutes', String(s.sample_minutes ?? '—'), 'In analysis window', '', 'wt-bento__span-3', PERF_KPI_HINTS.samples)}
      ${kpiCard('perf-tps', 'Avg TPS', s.tps_avg != null ? String(s.tps_avg) : '—', 'Rollup average', '', 'wt-bento__span-3', PERF_KPI_HINTS.tps)}
      ${kpiCard('perf-mspt', 'MSPT p95', s.mspt_p95 != null ? `${s.mspt_p95}<span class="wt-kpi__unit">ms</span>` : '—', '95th percentile', '', 'wt-bento__span-3', PERF_KPI_HINTS.mspt)}
      ${kpiCard('perf-low-tps', 'Low-TPS min', String(s.low_tps_minutes ?? '—'), 'Below warn threshold', '', 'wt-bento__span-3', PERF_KPI_HINTS.lowTps)}
      ${kpiCard('perf-players', 'Peak players', String(s.players_peak ?? '—'), 'Max in window', '', 'wt-bento__span-3', PERF_KPI_HINTS.players)}
      ${kpiCard('perf-sticky', 'Sticky episodes', String(s.sticky_episode_count ?? 0), 'Post-session lag', '', 'wt-bento__span-3', PERF_KPI_HINTS.sticky)}
      ${kpiCard('perf-outliers', 'Outlier minutes', String(s.outlier_count ?? 0), 'Flagged weird lag', '', 'wt-bento__span-3', PERF_KPI_HINTS.outliers)}
      ${kpiCard('perf-related', 'Related events', String(related), 'Lag / spike / pins', '', 'wt-bento__span-3', PERF_KPI_HINTS.related)}`;
  }

  function formatCompareWindow(w) {
    if (w === '30d') return '30 days';
    if (w === '7d') return '7 days';
    return w || '7 days';
  }

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
    const isWorse = worseWhenUp ? delta > 0 : false;
    const isBetter = worseWhenUp ? delta < 0 : false;
    if (isWorse) return 'worse';
    if (isBetter) return 'better';
    if (!worseWhenUp && delta > 0) return 'neutral-up';
    if (!worseWhenUp && delta < 0) return 'neutral-down';
    return 'flat';
  }

  function renderCompareDelta(key, delta) {
    const meta = COMPARE_METRICS[key];
    const trend = compareTrendClass(key, delta);
    const sign = delta > 0 ? '+' : '';
    const abs = meta.decimals > 0 ? Math.abs(delta).toFixed(meta.decimals) : String(Math.round(Math.abs(delta)));
    const unit = meta.unit ? ` ${meta.unit}` : '';
    const icon = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'minus';
    const label = delta === 0 ? 'No change' : `${sign}${abs}${unit}`;
    return `
      <span class="wt-perf-compare-card__delta wt-perf-compare-card__delta--${trend}">
        <i data-lucide="${icon}" width="14" height="14" aria-hidden="true"></i>
        ${esc(label)}
      </span>`;
  }

  function renderPeriodCompare(pc) {
    if (!pc?.deltas) return '';
    const windowKey = state.performanceWindow || pc.window || '7d';
    const windowLabel = formatCompareWindow(windowKey);
    const cards = Object.keys(COMPARE_METRICS).map((key) => {
      const altKey = key === 'sticky_episode_count' ? 'sticky_episodes' : null;
      const d = pc.deltas[key] || (altKey ? pc.deltas[altKey] : null);
      if (!d) return '';
      const meta = COMPARE_METRICS[key];
      const current = Number(d.current ?? 0);
      const prior = Number(d.prior ?? 0);
      const delta = Number(d.delta ?? 0);
      const scale = Math.max(current, prior, 0.001);
      const priorPct = prior <= 0 ? 0 : Math.round((prior / scale) * 100);
      const currentPct = current <= 0 ? 0 : Math.round((current / scale) * 100);
      const trend = compareTrendClass(key, delta);
      const priorBar = priorPct > 0
        ? `<div class="wt-perf-compare-card__bar wt-perf-compare-card__bar--prior wt-bar-grow-pending" data-bar-width="${priorPct}" style="width:0%"></div>`
        : '';
      const currentBar = currentPct > 0
        ? `<div class="wt-perf-compare-card__bar wt-perf-compare-card__bar--current wt-bar-grow-pending" data-bar-width="${currentPct}" style="width:0%"></div>`
        : '';
      return `
        <div class="wt-perf-compare-card wt-perf-compare-card--${trend} wt-perf-compare-card--has-hint">
          ${metricHint(`perf-cmp-${key}`, meta.hint)}
          <span class="wt-perf-compare-card__label">${esc(meta.label)}</span>
          <div class="wt-perf-compare-card__headline">
            <span class="wt-perf-compare-card__current">${esc(formatCompareValue(key, current))}</span>
            ${renderCompareDelta(key, delta)}
          </div>
          <div class="wt-perf-compare-card__bars" role="img" aria-label="Prior ${priorPct}%, current ${currentPct}%">
            <div class="wt-perf-compare-card__bar-row">
              <span class="wt-perf-compare-card__bar-label">Prior</span>
              <div class="wt-perf-compare-card__bar-track">${priorBar}</div>
              <span class="wt-perf-compare-card__bar-value">${esc(formatCompareValue(key, prior))}</span>
            </div>
            <div class="wt-perf-compare-card__bar-row">
              <span class="wt-perf-compare-card__bar-label">Now</span>
              <div class="wt-perf-compare-card__bar-track">${currentBar}</div>
              <span class="wt-perf-compare-card__bar-value">${esc(formatCompareValue(key, current))}</span>
            </div>
          </div>
          <p class="wt-perf-compare-card__caption text-caption">vs prior ${esc(windowLabel)}</p>
        </div>`;
    }).filter(Boolean).join('');
    if (!cards) return '';
    const title = windowKey === '30d' ? 'Month over month' : 'Week over week';
    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-perf-compare wt-scroll-reveal">
        <div class="wt-card__head">
          <h3 class="wt-card__title"><i data-lucide="git-compare" width="16" height="16"></i> ${esc(title)}</h3>
          <span class="text-caption">Current ${esc(windowLabel)} compared to the previous ${esc(windowLabel)}</span>
        </div>
        <div class="wt-perf-compare-grid">${cards}</div>
      </div>`;
  }

  function renderInsightsList(d) {
    const list = d?.insights || [];
    if (!list.length) return '<p class="wt-empty">No ranked insights for this window yet.</p>';
    return `<ul class="wt-perf-insight-list">${list.map((ins) => {
      const sev = ins.severity === 'critical' ? 'critical' : ins.severity === 'warning' ? 'warn' : 'info';
      return `
        <li class="wt-perf-insight wt-perf-insight--${sev}">
          <strong>${esc(ins.title)}</strong>
          ${ins.detail ? `<span class="text-caption">${esc(truncateDetail(ins.detail, 220))}</span>` : ''}
        </li>`;
    }).join('')}</ul>`;
  }

  function renderCorrelations(d) {
    const items = d?.correlations || [];
    if (!items.length) return '';
    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-scroll-reveal">
        <div class="wt-card__head">
          <h3 class="wt-card__title"><i data-lucide="link-2" width="16" height="16"></i> Correlations</h3>
        </div>
        <ul class="wt-perf-correlation-list">${items.map((c) => `
          <li class="wt-perf-correlation wt-perf-correlation--${esc(c.severity || 'info')}">
            <strong>${esc(c.title)}</strong>
            <span class="text-caption">${esc(c.detail)}</span>
          </li>`).join('')}</ul>
      </div>`;
  }

  function heatIntensity(players, max) {
    if (!max || max <= 0) return 0;
    return Math.min(1, Math.max(0, players / max));
  }

  function formatHeatPlayers(players, hasData) {
    if (!hasData) return '—';
    const p = Number(players) || 0;
    if (p < 0.05) return '0';
    if (p < 10) return p.toFixed(1);
    return String(Math.round(p));
  }

  function renderHeatmap(cells) {
    if (!cells?.length) return '<p class="wt-empty">Not enough rollup history for a heatmap.</p>';
    let maxPlayers = 0;
    cells.forEach((c) => { maxPlayers = Math.max(maxPlayers, c.avg_players ?? 0); });
    const byKey = new Map();
    cells.forEach((c) => byKey.set(`${c.dow}-${c.hour_utc}`, c));
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const header = `<div class="wt-perf-heat__row wt-perf-heat__row--head"><span class="wt-perf-heat__dow"></span>${hours.map((h) => `<span class="wt-perf-heat__hour">${h}</span>`).join('')}</div>`;
    const rows = DOW_LABELS.map((label, dow) => {
      const cellsHtml = hours.map((h) => {
        const c = byKey.get(`${dow}-${h}`);
        const p = c?.avg_players ?? 0;
        const m = c?.avg_mspt ?? 0;
        const hasData = Boolean(c);
        const level = hasData ? Math.round(heatIntensity(p, maxPlayers) * 4) : 0;
        const title = hasData
          ? `${label} ${h}:00 UTC · avg ${p.toFixed(1)} players · ${m.toFixed(0)} ms MSPT`
          : `${label} ${h}:00 UTC · no data`;
        const value = formatHeatPlayers(p, hasData);
        return `<span class="wt-perf-heat__cell wt-perf-heat__cell--${level}${hasData ? '' : ' wt-perf-heat__cell--empty'}" title="${esc(title)}"><span class="wt-perf-heat__value">${esc(value)}</span></span>`;
      }).join('');
      return `<div class="wt-perf-heat__row" style="--heat-row-index:${dow}"><span class="wt-perf-heat__dow">${label}</span>${cellsHtml}</div>`;
    }).join('');
    return `<div class="wt-perf-heat">${header}${rows}</div>`;
  }

  function aggregateHourMetrics(cells) {
    const buckets = Array.from({ length: 24 }, (_, hourUtc) => ({
      hour_utc: hourUtc,
      sample_minutes: 0,
      mspt_weighted: 0,
      mspt_minutes: 0,
      tps_weighted: 0,
      tps_minutes: 0,
      players_weighted: 0,
    }));
    (cells || []).forEach((c) => {
      const h = c.hour_utc;
      if (h == null || h < 0 || h > 23) return;
      const mins = c.sample_minutes ?? 0;
      if (mins <= 0) return;
      const b = buckets[h];
      b.sample_minutes += mins;
      if (c.avg_mspt != null) {
        b.mspt_weighted += c.avg_mspt * mins;
        b.mspt_minutes += mins;
      }
      if (c.avg_tps != null) {
        b.tps_weighted += c.avg_tps * mins;
        b.tps_minutes += mins;
      }
      b.players_weighted += (c.avg_players ?? 0) * mins;
    });
    const pad = (n) => String(n).padStart(2, '0');
    return buckets.map((b) => {
      const nextHour = (b.hour_utc + 1) % 24;
      return {
        hour_utc: b.hour_utc,
        label: `${pad(b.hour_utc)}:00–${pad(nextHour)}:00 UTC`,
        avg_mspt: b.mspt_minutes > 0 ? b.mspt_weighted / b.mspt_minutes : null,
        avg_tps: b.tps_minutes > 0 ? b.tps_weighted / b.tps_minutes : null,
        avg_players: b.sample_minutes > 0 ? b.players_weighted / b.sample_minutes : null,
        sample_minutes: b.sample_minutes,
      };
    });
  }

  function renderHourMetricBars(hours, config) {
    const {
      metricKey,
      emptyMessage,
      formatValue,
      maxFloor = 1,
      fillClass = '',
    } = config;
    const withData = hours.filter((h) => h[metricKey] != null);
    if (!withData.length) return `<p class="wt-empty">${esc(emptyMessage)}</p>`;
    const maxVal = Math.max(...withData.map((h) => h[metricKey]), maxFloor);
    return `
      <div class="wt-perf-hour-bars wt-perf-hour-bars--full">${hours.map((h) => {
        const hasData = h[metricKey] != null;
        const pct = hasData ? Math.round((h[metricKey] / maxVal) * 100) : 0;
        const players = hasData && h.avg_players != null ? ` · ${h.avg_players.toFixed(1)} players avg` : '';
        const title = hasData
          ? `${h.label} · ${formatValue(h[metricKey])}${players}`
          : `${h.label} · no data`;
        const fillCls = `wt-perf-hour-bar__fill wt-bar-height-pending${fillClass ? ` ${fillClass}` : ''}`;
        return `
          <div class="wt-perf-hour-bar${hasData ? '' : ' wt-perf-hour-bar--empty'}" title="${esc(title)}">
            ${hasData ? `<div class="${fillCls}" data-bar-height="${pct}" style="height:${pct}%;transform:scaleY(0)"></div>` : '<div class="wt-perf-hour-bar__track" aria-hidden="true"></div>'}
            <span class="wt-perf-hour-bar__label">${String(h.hour_utc).padStart(2, '0')}</span>
          </div>`;
      }).join('')}</div>`;
  }

  function renderMsptHourBars(hourOfWeek) {
    const hours = aggregateHourMetrics(hourOfWeek);
    return renderHourMetricBars(hours, {
      metricKey: 'avg_mspt',
      emptyMessage: 'Not enough rollup history for hourly MSPT.',
      formatValue: (v) => `${v.toFixed(1)} ms`,
    });
  }

  function renderTpsHourBars(hourOfWeek) {
    const hours = aggregateHourMetrics(hourOfWeek);
    return renderHourMetricBars(hours, {
      metricKey: 'avg_tps',
      emptyMessage: 'Not enough rollup history for hourly TPS.',
      formatValue: (v) => `${v.toFixed(2)} TPS`,
      maxFloor: 20,
      fillClass: 'wt-perf-hour-bar__fill--tps',
    });
  }

  function renderPlayerBins(bins) {
    if (!bins?.length) return '<p class="wt-empty">No player load bins.</p>';
    const maxMspt = Math.max(...bins.map((b) => b.mspt_avg ?? 0), 1);
    return `
      <table class="wt-table wt-perf-bins-table">
        <thead><tr><th>Players</th><th>Minutes</th><th>Avg MSPT</th><th>Avg TPS</th></tr></thead>
        <tbody>${bins.map((b) => {
          const pct = Math.round(((b.mspt_avg ?? 0) / maxMspt) * 100);
          return `<tr>
            <td>${esc(b.players_band)}</td>
            <td>${b.minutes ?? '—'}</td>
            <td><span class="wt-perf-bin-bar" style="width:${pct}%"></span> ${b.mspt_avg ?? '—'} ms</td>
            <td>${b.tps_avg ?? '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  const OUTLIER_REASON_LABELS = {
    high_mspt_idle: 'High MSPT while idle',
    high_mspt_vs_hour_median: 'Spike vs hour median',
  };

  function outlierReasonLabel(reason) {
    if (!reason) return '—';
    return OUTLIER_REASON_LABELS[reason] || reason;
  }

  function renderOutliers(rows) {
    if (!rows?.length) return '<p class="wt-empty">No outlier minutes in this window.</p>';
    return `
      <div class="wt-table-wrap">
        <table class="wt-table wt-perf-outliers wt-perf-outliers--sortable" id="perf-outliers-table">
          <thead><tr>
            <th class="wt-perf-sort" data-sort="ts" aria-sort="descending">Time</th>
            <th class="wt-perf-sort" data-sort="players_max">Players</th>
            <th class="wt-perf-sort" data-sort="mspt_avg">MSPT</th>
            <th class="wt-perf-sort" data-sort="mem_used_gb_avg">Mem</th>
            <th>Reason</th>
          </tr></thead>
          <tbody>${rows.map((r) => `
            <tr data-ts="${esc(r.ts || '')}" data-players="${r.players_max ?? 0}" data-mspt="${r.mspt_avg ?? 0}" data-mem="${r.mem_used_gb_avg ?? ''}">
              <td>${esc(fmtRelative(r.ts))}</td>
              <td>${r.players_max ?? 0}</td>
              <td>${r.mspt_avg ?? '—'} ms</td>
              <td>${r.mem_used_gb_avg != null ? `${r.mem_used_gb_avg} GB` : '—'}</td>
              <td>${esc(outlierReasonLabel(r.reason))}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function bindOutlierTableSort() {
    const table = document.getElementById('perf-outliers-table');
    if (!table || table.dataset.bound === '1') return;
    table.dataset.bound = '1';
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const sortTable = (key, dir) => {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const mult = dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        if (key === 'ts') {
          const ta = Date.parse(a.dataset.ts || '') || 0;
          const tb = Date.parse(b.dataset.ts || '') || 0;
          return (ta - tb) * mult;
        }
        const va = parseFloat(a.dataset[key === 'players_max' ? 'players' : key === 'mspt_avg' ? 'mspt' : key === 'mem_used_gb_avg' ? 'mem' : key] || '0') || 0;
        const vb = parseFloat(b.dataset[key === 'players_max' ? 'players' : key === 'mspt_avg' ? 'mspt' : key === 'mem_used_gb_avg' ? 'mem' : key] || '0') || 0;
        return (va - vb) * mult;
      });
      rows.forEach((r) => tbody.appendChild(r));
      table.querySelectorAll('.wt-perf-sort').forEach((th) => {
        const active = th.dataset.sort === key;
        th.setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
      });
    };

    let currentKey = 'ts';
    let currentDir = 'desc';
    table.querySelectorAll('.wt-perf-sort').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (!key) return;
        if (currentKey === key) {
          currentDir = currentDir === 'asc' ? 'desc' : 'asc';
        } else {
          currentKey = key;
          currentDir = key === 'ts' ? 'desc' : 'desc';
        }
        sortTable(currentKey, currentDir);
      });
    });
    sortTable('ts', 'desc');
  }

  function renderStickyEpisodes(eps) {
    if (!eps?.length) return '<p class="wt-empty">No sticky-lag episodes detected.</p>';
    return `<div class="wt-perf-sticky-list">${eps.map((ep) => `
      <div class="wt-perf-sticky wt-perf-insight--warn">
        <strong>${ep.duration_min ?? '—'} min · peak ${ep.peak_mspt ?? '—'} ms</strong>
        <span class="text-caption">${esc(ep.narrative || '')}</span>
        <span class="text-caption">${esc(fmtRelative(ep.started_at))} → ${esc(fmtRelative(ep.ended_at))}</span>
      </div>`).join('')}</div>`;
  }

  function renderRelatedEvents(events) {
    if (!events?.length) return '<p class="wt-empty">No lag-related events in this window.</p>';
    return `<ul class="wt-perf-event-list">${events.map((ev) => `
      <li class="wt-perf-event">
        <span class="wt-perf-event__time">${esc(fmtRelative(ev.ts))}</span>
        <span class="wt-perf-event__type">${esc(Labels.eventType(ev.type) || ev.type)}</span>
        <span class="wt-perf-event__detail">${esc(truncateDetail(ev.detail || ev.title, 120))}</span>
        ${ev.tab_link ? `<a href="#" class="tab-link wt-perf-event__link" data-tab="${esc(ev.tab_link)}">Open →</a>` : ''}
      </li>`).join('')}</ul>`;
  }

  function renderPageHeader(leadHtml, actionsHtml = '') {
    const reportBadge = '<span class="wt-source-badge wt-source-badge--report">Rollups</span>';
    return `
      <header class="wt-bento__span-12 wt-perf-hero wt-card wt-card--surface">
        <div class="wt-perf-hero__main">
          <h1 class="wt-perf-hero__title">
            <span class="wt-perf-hero__icon" aria-hidden="true"><i data-lucide="lightbulb" width="18" height="18"></i></span>
            Insights ${reportBadge}
          </h1>
          <p class="wt-perf-hero__lead">${leadHtml}</p>
        </div>
        ${actionsHtml ? `<div class="wt-perf-hero__actions">${actionsHtml}</div>` : ''}
      </header>`;
  }

  function renderPerformance() {
    return renderInsightsShell();
  }

  function bindPerformanceChromeEvents() {
    document.querySelectorAll('[data-perf-window]').forEach((btn) => {
      if (btn.dataset.perfBound === '1') return;
      btn.dataset.perfBound = '1';
      btn.addEventListener('click', async () => {
        const w = btn.dataset.perfWindow;
        if (!w || w === state.performanceWindow) return;
        state.performanceWindow = w;
        const hours = w === '30d' ? 720 : 168;
        if (typeof fetchPerformanceRollups === 'function') {
          await fetchPerformanceRollups(hours);
        }
        if (typeof fetchPerformanceInsights === 'function') {
          await fetchPerformanceInsights(w);
        }
        if (typeof fetchPerformanceDashboard === 'function') {
          await fetchPerformanceDashboard(w);
        }
        refreshInsightsPage();
      });
    });
    bindOutlierTableSort();
  }

  function ensureInsightsBentoEvents() {
    const bento = document.getElementById('insights-bento');
    if (!bento || bento.dataset.insightsBound === '1') return;
    bento.dataset.insightsBound = '1';
    bento.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-insights-view]');
      if (!btn || !bento.contains(btn)) return;
      const view = btn.dataset.insightsView;
      if (!view || view === state.insightsView) return;
      state.insightsView = view;
      if ((view === 'mod-changes' || view === 'storage') && typeof fetchOpsCache === 'function') {
        await fetchOpsCache();
      }
      refreshInsightsPage();
    });
  }

  function bindPerformanceEvents() {
    ensureInsightsBentoEvents();
    bindPerformanceChromeEvents();
  }

  return { renderPerformance, bindPerformanceEvents, refreshInsightsPage };
})();
