/**
 * Watchtower UI v3 — activity tab renderers
 */
const TowerRenderActivity = (function () {
  const esc = TowerRenderShared.esc;
  const fmtTimeShort = TowerRenderShared.fmtTimeShort;
  const fmtRelative = TowerRenderShared.fmtRelative;
  const timelineItemMod = TowerRenderShared.timelineItemMod;
  const sortEventsNewestFirst = TowerRenderShared.sortEventsNewestFirst;

  const TYPE_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'crash', label: 'Crash' },
    { id: 'session', label: 'Session' },
    { id: 'task', label: 'Task' },
    { id: 'system', label: 'System' },
    { id: 'lifecycle', label: 'Lifecycle' },
  ];

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function normalizeEventType(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'crash') return 'crash_report';
    if (t === 'reboot') return 'manual_reboot';
    return type || 'event';
  }

  function normalizeEvent(ev) {
    const type = normalizeEventType(ev?.type);
    return { ...ev, type };
  }

  function eventCategory(type) {
    const t = normalizeEventType(type);
    if (t === 'crash_report') return 'crash';
    if (t === 'player_join' || t === 'player_leave') return 'session';
    if (t === 'panel_command' || t === 'command') return 'task';
    if (t === 'manual_reboot' || t === 'kernel_oom' || t === 'tick_lag' || t === 'lag_incident') return 'system';
    if (t === 'server_start' || t === 'clean_stop') return 'lifecycle';
    return 'task';
  }

  function isAlertType(type) {
    const cat = eventCategory(type);
    const t = normalizeEventType(type);
    return cat === 'crash' || cat === 'system' || t === 'tick_lag' || t === 'lag_incident';
  }

  function eventIcon(type) {
    const t = normalizeEventType(type);
    if (t === 'crash_report') return 'skull';
    if (t === 'manual_reboot') return 'refresh-cw';
    if (t === 'kernel_oom') return 'alert-triangle';
    if (t === 'tick_lag' || t === 'lag_incident') return 'gauge';
    if (t === 'player_join' || t === 'player_leave') return 'user-plus';
    if (t === 'panel_command' || t === 'command') return 'terminal';
    if (t === 'server_start' || t === 'clean_stop') return 'power';
    return 'activity';
  }

  function matchesSearch(ev, q) {
    if (!q) return true;
    const hay = [
      ev.type,
      Labels.eventType(ev.type),
      Labels.eventTitle(ev),
      ev.detail,
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }

  function computeActivityContext(f) {
    const raw = state.activityEvents.length
      ? state.activityEvents
      : (f?.events ?? []);
    const stored = sortEventsNewestFirst(raw.map(normalizeEvent));
    const q = (state.activitySearch || '').trim().toLowerCase();
    const typeFilter = state.activityTypeFilter || 'all';

    const filtered = stored.filter((ev) => {
      if (typeFilter !== 'all' && eventCategory(ev.type) !== typeFilter) return false;
      return matchesSearch(ev, q);
    });

    const alertCount = stored.filter((ev) => isAlertType(ev.type)).length;
    const newest = stored[0] || null;
    const latestAlert = stored.find((ev) => isAlertType(ev.type)) || null;

    const dayGroups = [];
    const dayMap = new Map();
    filtered.forEach((ev) => {
      const d = dayLabel(ev.time);
      if (!dayMap.has(d)) {
        const group = { label: d, events: [] };
        dayMap.set(d, group);
        dayGroups.push(group);
      }
      dayMap.get(d).events.push(ev);
    });

    return {
      stored,
      filtered,
      dayGroups,
      q,
      typeFilter,
      eventCount: filtered.length,
      totalStored: stored.length,
      alertCount,
      newest,
      latestAlert,
      loading: state.activityLoading,
    };
  }

  function dayLabel(time) {
    if (!time) return 'Unknown date';
    try {
      const d = new Date(String(time).replace(',', '.').replace(' ', 'T'));
      if (Number.isNaN(d.getTime())) return 'Unknown date';
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return 'Today';
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unknown date';
    }
  }

  function renderKpiCard(label, valueHtml, tone, index) {
    if (typeof TowerTabChrome !== 'undefined') {
      const iconMap = { warn: 'bell', danger: 'alert-triangle', '': 'activity' };
      return TowerTabChrome.statCard({
        label,
        value: valueHtml,
        tone: tone || 'neutral',
        icon: iconMap[tone] || 'activity',
        hint: '',
      });
    }
    const toneCls = tone ? `wt-activity-kpi-card--${tone}` : '';
    const severityCls = tone === 'danger' ? 'wt-card--severity-critical'
      : tone === 'warn' ? 'wt-card--severity-warn'
        : '';
    return `
      <div class="wt-card wt-card--surface wt-activity-kpi-card ${toneCls} ${severityCls}" style="--wt-stagger-index: ${index}">
        <div class="wt-activity-kpi-card__inner">
          <span class="wt-activity-kpi-card__label">${esc(label)}</span>
          <div class="wt-activity-kpi-card__value">${valueHtml}</div>
        </div>
      </div>`;
  }

  function renderActivityKpiCards(ctx) {
    const lastHtml = ctx.newest
      ? esc(fmtRelative(ctx.newest.time) || '—')
      : '—';
    const alertTone = ctx.alertCount > 0 ? 'warn' : '';
    if (typeof TowerTabChrome !== 'undefined') {
      return [
        TowerTabChrome.statCard({ id: 'activity-events', tone: 'scanned', icon: 'list', label: 'Events', value: esc(String(ctx.totalStored)), hint: '' }),
        TowerTabChrome.statCard({ id: 'activity-last', tone: 'neutral', icon: 'clock', label: 'Last event', value: lastHtml, hint: '' }),
        TowerTabChrome.statCard({ id: 'activity-alerts', tone: alertTone || 'neutral', icon: 'bell', label: 'Alerts', value: esc(String(ctx.alertCount)), hint: '' }),
      ].join('');
    }
    return [
      renderKpiCard('Events', esc(String(ctx.totalStored)), '', 0),
      renderKpiCard('Last event', lastHtml, '', 1),
      renderKpiCard('Alerts', esc(String(ctx.alertCount)), alertTone, 2),
    ].join('');
  }

  function renderFilterChips(ctx) {
    return TYPE_FILTERS.map(({ id, label }) => {
      const active = ctx.typeFilter === id ? ' active' : '';
      return `<button type="button" class="wt-activity-filter${active}" data-activity-filter="${id}">${esc(label)}</button>`;
    }).join('');
  }

  function renderActivityChrome(ctx) {
    const scanBtn = `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="activity-scan-btn"${state.activityScanInFlight ? ' disabled' : ''}>
            <i data-lucide="refresh-cw" width="14" height="14"></i> Scan now
          </button>`;
    return `
      <div class="wt-card wt-card--surface wt-activity-chrome" id="activity-chrome">
        <div class="wt-activity-chrome__top">
          ${scanBtn}
        </div>
        <div class="wt-activity-chrome__toolbar">
          <input type="search" id="activity-search" class="wt-activity-search" value="${esc(state.activitySearch)}" placeholder="Search events…" aria-label="Search activity events">
          <div class="wt-activity-filters" role="group" aria-label="Filter by event type">${renderFilterChips(ctx)}</div>
        </div>
      </div>`;
  }

  function highlightTitle(ev) {
    const cat = eventCategory(ev.type);
    if (cat === 'crash') return 'Latest crash';
    if (cat === 'system') return 'Latest system alert';
    return 'Latest alert';
  }

  function renderActivityHighlight(ctx) {
    const ev = ctx.latestAlert;
    if (!ev) return '';
    const cat = eventCategory(ev.type);
    const isCrash = cat === 'crash';
    const severityCls = isCrash ? 'wt-card--severity-critical' : 'wt-card--severity-warn';
    const chipCls = isCrash ? 'wt-mod-chip--error' : 'wt-mod-chip--warning';
    const copyText = [Labels.eventTitle(ev), ev.detail].filter(Boolean).join('\n');
    const crashLink = isCrash
      ? `<a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="crashes">Open Crashes tab</a>`
      : '';

    return `
      <article class="wt-card wt-card--surface wt-activity-highlight wt-scroll-reveal ${severityCls} wt-enter">
        <span class="wt-activity-highlight__accent ${isCrash ? 'wt-activity-highlight__accent--critical' : 'wt-activity-highlight__accent--warn'}" aria-hidden="true"></span>
        <header class="wt-activity-highlight__banner">
          <h3 class="wt-activity-highlight__title">${esc(highlightTitle(ev))}</h3>
          <span class="wt-mod-chip ${chipCls}">${esc(Labels.eventType(ev.type))}</span>
        </header>
        <div class="wt-activity-highlight__sections">
          <section class="issue-section">
            <span class="issue-section-label">What happened</span>
            <p><strong>${esc(Labels.eventTitle(ev))}</strong>${ev.detail ? ` — ${esc(ev.detail)}` : ''}</p>
          </section>
          <section class="issue-section">
            <span class="issue-section-label">When</span>
            <p>${fmtTimeShort(ev.time)} · ${esc(fmtRelative(ev.time))}</p>
          </section>
        </div>
        <div class="wt-activity-highlight__actions">
          ${crashLink}
          ${copyText ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm copy-hint" data-copy="${escAttr(copyText)}">Copy details</button>` : ''}
        </div>
      </article>`;
  }

  function isCrashDetail(detail) {
    return /\.txt$/i.test(String(detail || '')) || String(detail || '').toLowerCase().includes('crash');
  }

  function renderEventRow(ev) {
    const itemCls = timelineItemMod(ev.type);
    const icon = eventIcon(ev.type);
    const cat = eventCategory(ev.type);
    const crashRow = cat === 'crash' && isCrashDetail(ev.detail);
    const title = Labels.eventTitle(ev);
    const detailBlock = ev.detail && ev.detail !== title
      ? `<p class="wt-activity-event__desc">${esc(ev.detail)}</p>`
      : '';
    const crashAction = crashRow
      ? `<a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="crashes">Review crash</a>`
      : '';
    const lagAction = ev.type === 'lag_incident' && ev.incident_id
      ? `<a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="issues">View lag issue</a>`
      : '';

    return `
      <div class="wt-timeline-item wt-activity-event ${itemCls}">
        <div class="wt-timeline-item__dot wt-activity-event__dot" aria-hidden="true">
          <i data-lucide="${icon}" width="12" height="12"></i>
        </div>
        <time class="wt-timeline-item__time" datetime="${escAttr(ev.time)}">${fmtTimeShort(ev.time)}</time>
        <div class="wt-activity-event__card">
          <div class="wt-activity-event__head">
            <h4 class="wt-activity-event__title">${esc(title)}</h4>
            <span class="wt-mod-chip wt-mod-chip--muted">${esc(Labels.eventType(ev.type))}</span>
          </div>
          ${detailBlock}
          <div class="wt-activity-event__meta">
            <span class="wt-timeline-badge">${esc(fmtRelative(ev.time))}</span>
            ${crashAction}
            ${lagAction}
          </div>
        </div>
      </div>`;
  }

  function renderTimelineBody(ctx) {
    if (ctx.loading) {
      return `<div class="wt-activity-stream__loading">${renderActivitySkeleton()}</div>`;
    }
    if (!ctx.filtered.length) {
      const emptyMsg = ctx.stored.length && (ctx.q || ctx.typeFilter !== 'all')
        ? 'No events match your search or filter.'
        : 'No events logged yet. Run a health report or wait for scheduled reports to populate this feed.';
      return `<p class="wt-activity-stream__empty">${emptyMsg}</p>`;
    }

    return ctx.dayGroups.map((group) => `
      <div class="wt-timeline-day">
        <div class="wt-timeline-day__label">${esc(group.label)}</div>
        ${group.events.map((ev) => renderEventRow(ev)).join('')}
      </div>`).join('');
  }

  function renderActivityStreamCard(ctx) {
    const metaLine = ctx.q || ctx.typeFilter !== 'all'
      ? `${ctx.eventCount} of ${ctx.totalStored} events match`
      : `${ctx.totalStored} event${ctx.totalStored === 1 ? '' : 's'} in feed`;

    return `
      <section class="wt-card wt-card--surface wt-activity-stream wt-scroll-reveal wt-enter">
        <header class="wt-activity-stream__head">
          <div class="wt-activity-stream__head-main">
            <h3 class="wt-card__title"><i data-lucide="list" width="16" height="16"></i> Timeline</h3>
            <p class="wt-activity-stream__meta">${esc(metaLine)}</p>
          </div>
        </header>
        <div class="wt-timeline wt-activity-stream__timeline">${renderTimelineBody(ctx)}</div>
      </section>`;
  }

  function renderActivityPageBody(ctx) {
    return `
      ${renderActivityHighlight(ctx)}
      ${renderActivityStreamCard(ctx)}`;
  }

  function renderActivity() {
    const f = state.activeFacts;
    const ctx = computeActivityContext(f);
    return `
      <div class="wt-tab-activity">
        <div class="wt-bento wt-stagger">
          ${typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('activity') : ''}
          <div class="wt-bento__span-12 wt-stat-grid wt-stat-grid--3" id="activity-kpi-row">${renderActivityKpiCards(ctx)}</div>
          <div class="wt-bento__span-12">${renderActivityChrome(ctx)}</div>
          <div class="wt-bento__span-12" id="activity-page-body">${renderActivityPageBody(ctx)}</div>
        </div>
      </div>`;
  }

  function renderActivitySkeleton() {
    return `
      <div class="wt-activity-skeleton">
        <div class="skeleton-line w-40"></div>
        <div class="skeleton-line w-80"></div>
        <div class="skeleton-line w-60"></div>
        <div class="skeleton-line w-80"></div>
      </div>`;
  }

  function updateActivityKpiRow(ctx) {
    const row = document.getElementById('activity-kpi-row');
    if (!row) return;
    row.innerHTML = renderActivityKpiCards(ctx);
  }

  function updateActivityChromeMeta(ctx) {
    document.querySelectorAll('#activity-chrome .wt-activity-filter').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.activityFilter === ctx.typeFilter);
    });
    const meta = document.querySelector('.wt-activity-stream__meta');
    if (meta) {
      meta.textContent = ctx.q || ctx.typeFilter !== 'all'
        ? `${ctx.eventCount} of ${ctx.totalStored} events match`
        : `${ctx.totalStored} event${ctx.totalStored === 1 ? '' : 's'} in feed`;
    }
    const title = document.querySelector('.wt-activity-stream__head .wt-card__title');
    if (title) {
      title.innerHTML = `<i data-lucide="list" width="16" height="16"></i> Timeline (${ctx.totalStored})`;
    }
  }

  /** @deprecated use renderTimelineBody(ctx) via refresh */
  function renderActivityTimeline(events) {
    const ctx = computeActivityContext(state.activeFacts);
    const filtered = sortEventsNewestFirst((events || []).map(normalizeEvent));
    return renderTimelineBody({ ...ctx, filtered, dayGroups: groupEventsByDay(filtered) });
  }

  function groupEventsByDay(events) {
    const dayGroups = [];
    const dayMap = new Map();
    events.forEach((ev) => {
      const d = dayLabel(ev.time);
      if (!dayMap.has(d)) {
        const group = { label: d, events: [] };
        dayMap.set(d, group);
        dayGroups.push(group);
      }
      dayMap.get(d).events.push(ev);
    });
    return dayGroups;
  }

  function wireTimelineReveal() {
    const timeline = document.querySelector('.wt-activity-stream__timeline');
    if (!timeline) return;
    if (typeof TowerMotion !== 'undefined' && TowerMotion.intersectionReveal) {
      TowerMotion.intersectionReveal(timeline);
    } else if (typeof WatchtowerMotion !== 'undefined') {
      WatchtowerMotion.intersectionReveal(timeline);
    } else {
      timeline.querySelectorAll('.wt-timeline-item').forEach((el) => el.classList.add('is-visible'));
    }
  }

  return {
    renderActivity,
    renderActivityStream: renderActivity,
    renderActivityPageBody,
    renderActivityChrome,
    renderActivityKpiCards,
    renderActivityTimeline,
    renderActivitySkeleton,
    computeActivityContext,
    updateActivityKpiRow,
    updateActivityChromeMeta,
    wireTimelineReveal,
    normalizeEventType,
    eventCategory,
  };
})();
