import { html, useState, useMemo, useEffect } from '../../lib/preact.js';
import { activity } from '../../state/stores.js';
import { scanActivity, loadActivity, addToast } from '../../state/actions.js';
import { Page, Section, Timeline, FilterBar, EmptyState, MetricTile, BeaconCard } from '../../ui/patterns/index.js';
import { Button, Badge } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import { eventTitle, eventType } from '../../domain/labels.js';

const TYPE_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'session', label: 'Session' },
  { value: 'system', label: 'System' },
  { value: 'task', label: 'Task' },
  { value: 'performance', label: 'Performance' },
  { value: 'crash', label: 'Crash' },
];

function eventTone(ev) {
  const t = ev.type;
  if (t === 'crash' || t === 'crash_report' || t === 'kernel_oom') return 'danger';
  if (t === 'tick_lag' || t === 'lag_incident' || t === 'performance_spike' || t === 'manual_reboot') return 'warn';
  if (t === 'server_start' || t === 'clean_stop') return 'info';
  if (t === 'player_join') return 'ok';
  return 'neutral';
}

function eventIcon(type) {
  const t = type === 'crash' ? 'crash_report' : type === 'reboot' ? 'manual_reboot' : type;
  if (t === 'server_start' || t === 'clean_stop' || t === 'restart_scheduled') return 'server';
  if (t === 'player_join' || t === 'player_leave') return 'users';
  if (t === 'crash_report' || t === 'kernel_oom') return 'bug';
  if (t === 'tick_lag' || t === 'lag_incident' || t === 'performance_spike') return 'zap';
  if (t === 'backup_job') return 'archive';
  if (t === 'command' || t === 'panel_command') return 'terminal';
  if (t === 'manual_reboot') return 'cpu';
  return 'activity';
}

function normalizeEventTime(ev) {
  if (!ev?.time) return null;
  const s = String(ev.time).replace(',', '.').replace(' ', 'T');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function isAlertLike(ev) {
  const tone = eventTone(ev);
  return tone === 'danger' || tone === 'warn';
}

function metricTone(count, warnTone) {
  if (!count) return undefined;
  return warnTone;
}

function ActivityKpis({ events }) {
  const starts = events.filter((e) => e.type === 'server_start').length;
  const stops = events.filter((e) => e.type === 'clean_stop').length;
  const crashes = events.filter((e) => e.type === 'crash_report' || e.type === 'crash').length;
  const lags = events.filter((e) => e.type === 'tick_lag' || e.type === 'lag_incident' || e.type === 'performance_spike').length;
  const joins = events.filter((e) => e.type === 'player_join').length;

  return html`
    <div class="feat-kpi-row feat-kpi-row--activity">
      <${MetricTile} label="Starts" value=${starts} format=${(v) => String(Math.round(v))} size="sm" padding="12" />
      <${MetricTile} label="Stops" value=${stops} format=${(v) => String(Math.round(v))} size="sm" padding="12" />
      <${MetricTile}
        label="Crashes"
        value=${crashes}
        format=${(v) => String(Math.round(v))}
        tone=${metricTone(crashes, 'danger')}
        size="sm"
        padding="12"
      />
      <${MetricTile}
        label="Lag events"
        value=${lags}
        format=${(v) => String(Math.round(v))}
        tone=${metricTone(lags, 'warn')}
        size="sm"
        padding="12"
      />
      <${MetricTile} label="Player joins" value=${joins} format=${(v) => String(Math.round(v))} tone=${joins ? 'ok' : undefined} size="sm" padding="12" />
    </div>
  `;
}

function AlertHighlight({ event }) {
  if (!event) return null;
  const tone = eventTone(event);
  const word = tone === 'danger' ? 'Alert' : 'Watch';
  const category = eventType(event.type ?? '');
  const when = normalizeEventTime(event);
  const whenLabel = when
    ? new Date(when).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : (event.time ?? '');

  return html`
    <${BeaconCard}
      className="feat-activity-highlight"
      label="Latest alert"
      hint=${whenLabel}
      word=${word}
      tone=${tone}
    >
      <div class="feat-activity-highlight__body">
        <div class="feat-activity-highlight__title">${eventTitle(event)}</div>
        ${event.detail && event.detail !== eventTitle(event) && html`
          <div class="feat-activity-highlight__detail">${event.detail}</div>
        `}
        <div class="feat-activity-highlight__meta">
          <${Badge} tone=${tone === 'ok' ? 'ok' : tone}>${category}</${Badge}>
          <span class="feat-activity-meta">
            <${Icon} name=${eventIcon(event.type)} size=${12} />
            <span>${String(event.type ?? 'event').replace(/_/g, ' ')}</span>
          </span>
        </div>
      </div>
    </${BeaconCard}>
  `;
}

export function PageView() {
  const { events, loading } = activity.value;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadActivity(48);
  }, []);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (typeFilter !== 'all') {
      list = list.filter((ev) => {
        const cat = eventType(ev.type ?? '').toLowerCase();
        return cat === typeFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((ev) =>
        (eventTitle(ev) ?? '').toLowerCase().includes(q) ||
        (ev.detail ?? '').toLowerCase().includes(q) ||
        (ev.type ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, typeFilter, search]);

  const latestAlert = useMemo(() => {
    for (const ev of events) {
      if (isAlertLike(ev)) return ev;
    }
    return null;
  }, [events]);

  const timelineItems = useMemo(() => {
    return filteredEvents.map((ev, i) => {
      const tone = eventTone(ev);
      const category = eventType(ev.type ?? '');
      const badgeTone = tone === 'neutral' ? 'neutral' : tone === 'ok' ? 'ok' : tone;
      return {
        id: `ev-${i}-${ev.time}`,
        time: normalizeEventTime(ev),
        tone,
        title: eventTitle(ev),
        detail: ev.detail && ev.detail !== eventTitle(ev) ? ev.detail : null,
        badge: html`<${Badge} tone=${badgeTone}>${category}</${Badge}>`,
        meta: html`
          <span class="feat-activity-meta">
            <${Icon} name=${eventIcon(ev.type)} size=${12} />
            <span>${String(ev.type ?? 'event').replace(/_/g, ' ')}</span>
          </span>
        `,
      };
    });
  }, [filteredEvents]);

  async function handleScan() {
    setScanning(true);
    await scanActivity(true);
    setScanning(false);
    addToast('Activity scan complete', 'success');
  }

  return html`
    <${Page}
      tour="activity"
      title="Activity"
      subtitle="Event timeline — joins, stops, and lifecycle markers"
      actions=${html`
        <${Button}
          kind="neutral"
          size="sm"
          loading=${scanning || loading}
          onClick=${handleScan}
        >
          Scan
        </${Button}>
      `}
    >
      <div class="ui-page__stack">
        <div class="feat-activity-layout">
          ${events.length > 0 && html`
            <aside class="feat-activity-layout__summary">
              <${Section} title="Summary" defaultOpen=${true}>
                <${ActivityKpis} events=${events} />
              </${Section}>
            </aside>
          `}

          <div class="feat-activity-layout__events">
            <${Section} title="Events" defaultOpen=${true}>
              <div class="feat-toolbar feat-toolbar--wrap feat-toolbar--activity">
                <${FilterBar}
                  search=${search}
                  onSearch=${setSearch}
                  placeholder="Search events…"
                  resultCount=${filteredEvents.length}
                />
                <div class="feat-chip-row">
                  ${TYPE_CHIPS.map((chip) => html`
                    <button
                      key=${chip.value}
                      class=${['feat-chip', typeFilter === chip.value ? 'feat-chip--active' : ''].filter(Boolean).join(' ')}
                      onClick=${() => setTypeFilter(chip.value)}
                    >
                      ${chip.label}
                    </button>
                  `)}
                </div>
              </div>

              ${loading && events.length === 0 && html`<p class="feat-hint ui-text-low">Loading activity…</p>`}

              ${!loading && events.length === 0 && html`
                <${EmptyState}
                  icon="📋"
                  title="No activity events"
                  body="Activity events are captured from server log scans. Trigger a scan or wait for the next background poll."
                  action=${html`<${Button} kind="accent" onClick=${handleScan} loading=${scanning}>Scan now</${Button}>`}
                />
              `}

              ${!loading && events.length > 0 && timelineItems.length === 0 && html`
                <${EmptyState} title="No matching events" body="Try adjusting the search or type filter." />
              `}

              ${latestAlert && html`
                <div class="feat-activity-highlight-wrap">
                  <${AlertHighlight} event=${latestAlert} />
                </div>
              `}

              ${timelineItems.length > 0 && html`
                <div class="feat-activity-feed">
                  <${Timeline} items=${timelineItems} groupByDay=${true} />
                </div>
              `}
            </${Section}>
          </div>
        </div>
      </div>
    </${Page}>
  `;
}
