import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  FileText,
  Gauge as GaugeIcon,
  LogIn,
  LogOut,
  Package,
  Power,
  RefreshCw,
  Search,
  Terminal,
  TrendingDown,
} from '@/ui/icons';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { FadeIn, HeroWatermark, PageEnter, Stagger, useCountUp } from '@/ui/motion';
import { Button, EmptyState, ErrorState, StatusPill } from '@/ui/patterns';
import { asArray, asRecord, num, str, timeAgo } from '@/lib/utils';
import './activity.css';

const TIMELINE_PAGE = 30;

const CHANGE_TYPES = new Set([
  'mod_jar_added',
  'mod_jar_removed',
  'mod_jar_updated',
  'mod_disabled',
  'mod_enabled',
  'config_changed',
]);

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
type KpiTone = 'default' | 'ok' | 'warn' | 'danger' | 'info';

type ActivityEvent = {
  id: string;
  type: string;
  detail: string;
  player: string | null;
  time: string | null;
  source: string | null;
  incidentId: string | null;
  raw: Record<string, unknown>;
};

const typeIcon: Record<string, typeof Activity> = {
  lag_incident: AlertTriangle,
  tick_lag: GaugeIcon,
  command: Terminal,
  player_join: LogIn,
  player_leave: LogOut,
  backup_job: Archive,
  restart_scheduled: RefreshCw,
  performance_spike: TrendingDown,
  mod_jar_added: Package,
  mod_jar_removed: Package,
  mod_jar_updated: Package,
  mod_disabled: Power,
  mod_enabled: Power,
  config_changed: FileText,
};

const typeTone: Record<string, Tone> = {
  lag_incident: 'danger',
  tick_lag: 'warn',
  command: 'neutral',
  player_join: 'ok',
  player_leave: 'neutral',
  backup_job: 'info',
  restart_scheduled: 'warn',
  performance_spike: 'warn',
  mod_jar_added: 'info',
  mod_jar_removed: 'warn',
  mod_jar_updated: 'info',
  mod_disabled: 'warn',
  mod_enabled: 'ok',
  config_changed: 'info',
};

const typeLabel: Record<string, string> = {
  lag_incident: 'Lag incident',
  tick_lag: 'Tick lag',
  command: 'Command',
  player_join: 'Player join',
  player_leave: 'Player leave',
  backup_job: 'Backup job',
  restart_scheduled: 'Restart scheduled',
  performance_spike: 'Performance spike',
  mod_jar_added: 'Mod jar added',
  mod_jar_removed: 'Mod jar removed',
  mod_jar_updated: 'Mod jar updated',
  mod_disabled: 'Mod disabled',
  mod_enabled: 'Mod enabled',
  config_changed: 'Config changed',
};

function labelFor(type: string) {
  return typeLabel[type] ?? type.replace(/_/g, ' ');
}

function titleFor(ev: ActivityEvent): string {
  if (ev.type === 'player_join') return `${ev.detail || 'Player'} joined`;
  if (ev.type === 'player_leave') return `${ev.detail || 'Player'} left`;
  if (ev.type === 'command') return ev.detail || 'Command run';
  if (ev.type === 'lag_incident') return ev.detail || 'Lag incident captured';
  if (ev.type === 'restart_scheduled') return ev.detail || 'Restart scheduled';
  if (ev.type === 'backup_job') return ev.detail || 'Backup job';
  if (ev.type === 'mod_jar_added') return `Added ${ev.detail || 'mod jar'}`;
  if (ev.type === 'mod_jar_removed') return `Removed ${ev.detail || 'mod jar'}`;
  if (ev.type === 'mod_jar_updated') return `Updated ${ev.detail || 'mod jar'}`;
  if (ev.type === 'mod_disabled') return ev.detail || 'Mod disabled';
  if (ev.type === 'mod_enabled') return ev.detail || 'Mod enabled';
  if (ev.type === 'config_changed') return `Config touched · ${ev.detail || 'config/…'}`;
  return ev.detail || labelFor(ev.type);
}

function detailFor(ev: ActivityEvent, title: string): string | null {
  if (!ev.detail) return null;
  if (ev.type === 'player_join' || ev.type === 'player_leave' || ev.type === 'command') return null;
  if (ev.type.startsWith('mod_jar_') || ev.type === 'config_changed') return null;
  if (ev.detail === title) return null;
  return ev.detail;
}

function deepLink(ev: ActivityEvent): { tab: string; label: string } | null {
  if (ev.type === 'lag_incident' || ev.type === 'tick_lag' || ev.type === 'performance_spike') {
    return { tab: 'issues', label: 'Open Issues' };
  }
  if (ev.type === 'backup_job') return { tab: 'backups', label: 'Open Backups' };
  if (ev.type === 'command') return { tab: 'logs', label: 'Open Logs' };
  if (ev.type === 'restart_scheduled') return { tab: 'overview', label: 'Open Overview' };
  if (CHANGE_TYPES.has(ev.type)) return { tab: 'mods', label: 'Open Mods' };
  return null;
}

function dayKey(iso: string | null): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key: string): string {
  if (key === 'unknown') return 'Unknown day';
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function absWhen(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Kpi({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string | null;
  tone?: KpiTone;
}) {
  const numeric = typeof value === 'number' ? value : Number.NaN;
  const counted = useCountUp(Number.isFinite(numeric) ? numeric : 0);
  const display = typeof value === 'number' && Number.isFinite(value) ? Math.round(counted) : value;
  return (
    <div className={`ac-kpi ac-kpi--${tone}`}>
      <span className="ac-kpi__label">{label}</span>
      <span className="ac-kpi__value">{display}</span>
      {hint ? <span className="ac-kpi__hint">{hint}</span> : null}
    </div>
  );
}

export function PageView({ route: _route }: { route: RouteState }) {
  const opsQ = useQuery({
    queryKey: ['ops-cache'],
    queryFn: api.opsCache,
    refetchInterval: 15_000,
  });
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE);

  const activity = asRecord(asRecord(opsQ.data).activity);
  const events = useMemo(() => {
    return asArray<Record<string, unknown>>(activity.events).map((raw, i) => {
      const type = str(raw.type, 'event');
      const time = str(raw.time) || null;
      return {
        id: `${time ?? 't'}-${type}-${i}`,
        type,
        detail: str(raw.detail),
        player: str(raw.player) || null,
        time,
        source: str(raw.source) || null,
        incidentId: str(raw.incident_id) || null,
        raw,
      } satisfies ActivityEvent;
    });
  }, [activity.events]);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) map.set(e.type, (map.get(e.type) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter === 'changes') {
        if (!CHANGE_TYPES.has(e.type)) return false;
      } else if (filter && e.type !== filter) {
        return false;
      }
      if (!q) return true;
      const hay = [e.type, labelFor(e.type), e.detail, e.player ?? '', titleFor(e)]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, filter, search]);

  useEffect(() => {
    setVisibleCount(TIMELINE_PAGE);
  }, [filter, search]);

  const visibleEvents = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const timelineTruncated = visibleCount < filtered.length;

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const e of visibleEvents) {
      const key = dayKey(e.time);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [visibleEvents]);

  const alertCount = events.filter((e) => {
    const tone = typeTone[e.type] ?? 'neutral';
    return tone === 'danger' || tone === 'warn';
  }).length;
  const changeCount = events.filter((e) => CHANGE_TYPES.has(e.type)).length;
  const latest = events[0] ?? null;
  const latestAlert =
    events.find((e) => {
      const tone = typeTone[e.type] ?? 'neutral';
      return tone === 'danger' || tone === 'warn';
    }) ?? null;

  const heroTone: Tone =
    alertCount === 0 ? 'ok' : events.some((e) => typeTone[e.type] === 'danger') ? 'danger' : 'warn';

  if (opsQ.isLoading) {
    return (
      <PageEnter className="ac-stack">
        <div className="h-36 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-20 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-80 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </PageEnter>
    );
  }
  if (opsQ.isError) {
    return (
      <ErrorState title="Couldn't load activity feed">{(opsQ.error as Error)?.message}</ErrorState>
    );
  }

  const scannedAt = activity.scanned_at ? timeAgo(str(activity.scanned_at)) : null;
  const newCount = activity.new_count != null ? num(activity.new_count) : null;
  const latestAlertLink = latestAlert ? deepLink(latestAlert) : null;

  return (
    <PageEnter className="ac-stack">
      <FadeIn>
        <div className={`ac-hero ac-hero--${heroTone}`}>
          <div className="ac-hero__body wt-hero-shell">
            <HeroWatermark icon={Activity} tone={heroTone} />
            <div className="ac-hero__main">
              <div className="ac-hero__title">
                <h2>Live feed</h2>
                <StatusPill tone={heroTone}>
                  {alertCount ? `${alertCount} alert${alertCount === 1 ? '' : 's'}` : 'Quiet'}
                </StatusPill>
              </div>
              <p className="ac-hero__hint">
                Server diary: jar and config changes, plus commands, joins, lag, and jobs from the
                latest ops scan. Use Changes to hide player noise.
              </p>
            </div>

            <div className="ac-kpis" aria-label="Activity vitals">
              <Kpi
                label="Events"
                value={events.length}
                hint={
                  newCount != null
                    ? `${newCount} in latest scan`
                    : scannedAt
                      ? `Scanned ${scannedAt}`
                      : null
                }
                tone="info"
              />
              <Kpi
                label="Alerts"
                value={alertCount}
                hint={alertCount ? 'Lag / restart / spike' : 'No warn or danger'}
                tone={alertCount ? (heroTone === 'danger' ? 'danger' : 'warn') : 'ok'}
              />
              <Kpi
                label="Pack changes"
                value={changeCount}
                hint="Jars, soft-disable, configs"
                tone={changeCount ? 'info' : 'default'}
              />
              <Kpi
                label="Latest"
                value={latest?.time ? timeAgo(latest.time) : '-'}
                hint={latest ? labelFor(latest.type) : 'No events yet'}
                tone="default"
              />
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <div className="ac-toolbar">
          <div className="ac-toolbar__row">
            <label className="ac-search">
              <Search size={14} aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events, players, commands…"
                aria-label="Search activity"
              />
            </label>
            <span className="ac-toolbar__meta">
              Showing {filtered.length} of {events.length}
              {scannedAt ? ` · scanned ${scannedAt}` : ''}
            </span>
          </div>
          <div className="ac-chips" role="tablist" aria-label="Filter by type">
            <button
              type="button"
              role="tab"
              aria-selected={filter === null}
              className={`ac-chip${filter === null ? ' is-active' : ''}`}
              onClick={() => setFilter(null)}
            >
              All <span className="ac-chip__count">{events.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'changes'}
              className={`ac-chip${filter === 'changes' ? ' is-active' : ''}`}
              onClick={() => setFilter(filter === 'changes' ? null : 'changes')}
            >
              Changes <span className="ac-chip__count">{changeCount}</span>
            </button>
            {typeCounts.map(([type, count]) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={filter === type}
                className={`ac-chip${filter === type ? ' is-active' : ''}`}
                onClick={() => setFilter(type === filter ? null : type)}
              >
                {labelFor(type)} <span className="ac-chip__count">{count}</span>
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {latestAlert ? (
        <FadeIn>
          <div
            className={`ac-alert${typeTone[latestAlert.type] === 'danger' ? ' ac-alert--danger' : ''}`}
          >
            <span className="ac-alert__icon" aria-hidden>
              <AlertTriangle size={16} />
            </span>
            <div className="ac-alert__copy">
              <div className="ac-alert__top">Latest attention</div>
              <p className="ac-alert__title">{titleFor(latestAlert)}</p>
              <div className="ac-alert__meta">
                {labelFor(latestAlert.type)}
                {latestAlert.time ? ` · ${timeAgo(latestAlert.time)}` : ''}
              </div>
            </div>
            {latestAlertLink ? (
              <Button
                kind="default"
                onClick={() => navigate({ tab: latestAlertLink.tab, view: null, panel: null })}
              >
                {latestAlertLink.label}
                <ArrowRight size={14} />
              </Button>
            ) : null}
          </div>
        </FadeIn>
      ) : null}

      <FadeIn>
        <div className="ac-panel">
          <div className="ac-panel__head">
            <div>
              <h3>Timeline</h3>
              <p>Most recent first · grouped by day</p>
            </div>
            <StatusPill tone={filtered.length ? 'info' : 'neutral'}>
              {filtered.length} event{filtered.length === 1 ? '' : 's'}
            </StatusPill>
          </div>

          {filtered.length ? (
            <>
              <Stagger>
                {grouped.map(([day, dayEvents]) => (
                  <section key={day} className="ac-day">
                    <h4 className="ac-day__label">{dayLabel(day)}</h4>
                    <ol className="ac-feed">
                      {dayEvents.map((e) => {
                        const tone = typeTone[e.type] ?? 'neutral';
                        const Icon = typeIcon[e.type] ?? Activity;
                        const title = titleFor(e);
                        const detail = detailFor(e, title);
                        const link = deepLink(e);
                        const mono = e.type === 'command';
                        return (
                          <li key={e.id} className="ac-item">
                            <span className={`ac-item__dot ac-item__dot--${tone}`} aria-hidden>
                              <Icon size={12} />
                            </span>
                            <article className={`ac-card ac-card--${tone}`}>
                              <div className="ac-card__top">
                                <div className="ac-card__badges">
                                  <StatusPill tone={tone}>{labelFor(e.type)}</StatusPill>
                                  {e.player ? (
                                    <span className="ac-card__player">{e.player}</span>
                                  ) : null}
                                </div>
                                <div className="ac-card__when">
                                  <span className="ac-card__ago">
                                    {e.time ? timeAgo(e.time) : '-'}
                                  </span>
                                  <span className="ac-card__abs">{absWhen(e.time)}</span>
                                </div>
                              </div>
                              <p className={`ac-card__title${mono ? ' ac-card__title--mono' : ''}`}>
                                {title}
                              </p>
                              {detail ? <p className="ac-card__detail">{detail}</p> : null}
                              {link ? (
                                <div className="ac-card__actions">
                                  <Button
                                    kind="ghost"
                                    onClick={() =>
                                      navigate({ tab: link.tab, view: null, panel: null })
                                    }
                                  >
                                    {link.label}
                                    <ArrowRight size={14} />
                                  </Button>
                                </div>
                              ) : null}
                            </article>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </Stagger>
              {timelineTruncated ? (
                <Button
                  kind="ghost"
                  className="ac-load-more"
                  onClick={() => setVisibleCount((n) => n + TIMELINE_PAGE)}
                >
                  Load more (+{Math.min(TIMELINE_PAGE, filtered.length - visibleCount)})
                </Button>
              ) : null}
            </>
          ) : (
            <div className="ac-empty">
              <EmptyState title={events.length ? 'No matching events' : 'No activity yet'}>
                {events.length
                  ? 'Try another filter or clear the search.'
                  : 'Activity appears after the next ops log scan picks up commands, joins, lag, or jobs.'}
              </EmptyState>
              {events.length && (filter || search) ? (
                <Button
                  kind="default"
                  onClick={() => {
                    setFilter(null);
                    setSearch('');
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </FadeIn>
    </PageEnter>
  );
}
