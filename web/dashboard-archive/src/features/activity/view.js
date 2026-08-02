import { html, useState, useMemo, useEffect } from '../../lib/preact.js';
import { activity } from '../../state/stores.js';
import { scanActivity, loadActivity, addToast } from '../../state/actions.js';
import { Page, Section, Timeline, FilterBar, EmptyState, MetricTile, ListRow } from '../../ui/patterns/index.js';
import { Button, Badge } from '../../ui/primitives/index.js';
import { Card } from '../../ui/primitives/card.js';
import { Icon } from '../../ui/icons.js';
import { eventTitle, eventType } from '../../domain/labels.js';
import { navigate } from '../../app/router.js';

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

function storyEventIcon(type) {
  if (type === 'crash') return 'bug';
  if (type === 'lag_spike') return 'zap';
  if (type === 'mod_change') return 'package';
  if (type === 'backup_failed') return 'archive';
  if (type === 'server_down') return 'server';
  return 'activity';
}

function storyEventTone(type) {
  if (type === 'crash') return 'danger';
  if (type === 'lag_spike' || type === 'backup_failed') return 'warn';
  if (type === 'mod_change') return 'info';
  return 'neutral';
}

function storyEventLabel(type) {
  switch (type) {
    case 'lag_spike': return 'Lag spike';
    case 'backup_failed': return 'Backup failed';
    case 'mod_change': return 'Mod change';
    case 'server_down': return 'Server stopped';
    case 'crash': return 'Crash';
    default: return String(type || 'Event').replace(/_/g, ' ');
  }
}

function formatStoryWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatStoryClock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function openStoryLink(ev) {
  const tab = ev?.tab_link || 'activity';
  if (tab === 'crashes' && ev.file) {
    navigate('crashes', { file: ev.file });
    return;
  }
  if (tab === 'issues' && ev.incident_id) {
    navigate('issues', { view: 'active' });
    return;
  }
  navigate(tab);
}

function ActivityKpis({ events }) {
  const starts = events.filter((e) => e.type === 'server_start').length;
  const stops = events.filter((e) => e.type === 'clean_stop').length;
  const crashes = events.filter((e) => e.type === 'crash_report' || e.type === 'crash').length;
  const lags = events.filter((e) => e.type === 'tick_lag' || e.type === 'lag_incident' || e.type === 'performance_spike').length;
  const joins = events.filter((e) => e.type === 'player_join').length;

  return html`
    <div class="feat-kpi-row feat-kpi-row--activity" aria-label="Activity summary">
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

function CompactAlert({ event }) {
  if (!event) return null;
  const tone = eventTone(event);
  return html`
    <${ListRow}
      className="feat-activity-alert"
      tone=${tone}
      icon=${html`<${Icon} name=${eventIcon(event.type)} size=${14} />`}
      title=${eventTitle(event)}
      meta=${html`
        <span>${formatStoryWhen(normalizeEventTime(event) || event.time)}</span>
        ${event.detail && event.detail !== eventTitle(event)
          ? html`<span> · ${event.detail}</span>`
          : null}
      `}
      badge=${html`<${Badge} tone=${tone === 'ok' ? 'ok' : tone}>${eventType(event.type ?? '')}</${Badge}>`}
    />
  `;
}

function IncidentStoryCard({ story }) {
  const steps = story.events || [];
  return html`
    <${Card} className="feat-activity-story" tone="warn" padding="20">
      <div class="feat-activity-story__head">
        <div>
          <div class="feat-activity-story__eyebrow">Incident story</div>
          <p class="feat-activity-story__title">${story.narrative || 'Correlated events in this window.'}</p>
        </div>
        <div class="feat-activity-story__when">${formatStoryWhen(story.started_at)}</div>
      </div>

      ${steps.length > 0 && html`
        <div class="feat-activity-story__events">
          ${steps.map((ev, j) => html`
            <${ListRow}
              key=${`${story.id || 's'}-${j}`}
              tone=${storyEventTone(ev.type)}
              icon=${html`<${Icon} name=${storyEventIcon(ev.type)} size=${14} />`}
              title=${`${formatStoryClock(ev.at)} · ${storyEventLabel(ev.type)}`}
              meta=${ev.detail || null}
              actions=${ev.tab_link ? html`
                <${Button} kind="neutral" size="sm" onClick=${() => openStoryLink(ev)}>
                  Open
                </${Button}>
              ` : null}
            />
          `)}
        </div>
      `}
    </${Card}>
  `;
}

function IncidentStories({ stories }) {
  if (!stories?.length) return null;
  return html`
    <${Section}
      title="Incident stories"
      badge=${html`<${Badge} tone="warn">${stories.length}</${Badge}>`}
      collapsible=${true}
      defaultOpen=${true}
    >
      <div class="feat-activity-stories">
        ${stories.map((story, i) => html`
          <${IncidentStoryCard} key=${story.id || i} story=${story} />
        `)}
      </div>
    </${Section}>
  `;
}

export function PageView() {
  const { events, incidentStories, loading } = activity.value;

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
    if (incidentStories?.length) return null;
    for (const ev of events) {
      if (isAlertLike(ev)) return ev;
    }
    return null;
  }, [events, incidentStories]);

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
      subtitle="What happened on this server — stories first, then the full event feed"
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
      <div class="ui-page__stack feat-activity">
        ${events.length > 0 && html`<${ActivityKpis} events=${events} />`}

        <${IncidentStories} stories=${incidentStories} />

        <${Section} title="Event feed" defaultOpen=${true}>
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
            <div class="feat-activity-alert-wrap">
              <${CompactAlert} event=${latestAlert} />
            </div>
          `}

          ${timelineItems.length > 0 && html`
            <div class="feat-activity-feed">
              <${Timeline} items=${timelineItems} groupByDay=${true} />
            </div>
          `}
        </${Section}>
      </div>
    </${Page}>
  `;
}
