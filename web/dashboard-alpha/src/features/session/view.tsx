import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import BorderGlow from '@/components/border-glow/BorderGlow';
import { ChartFrame, WtAreaChart, dailyToBklitRows } from '@/ui/charts';
import { Clock3, Copy, Search, Users } from '@/ui/icons';
import { api } from '@/api/client';
import type { RouteState } from '@/app/router';
import { FadeIn, GlareIcon, PageEnter, Stagger } from '@/ui/motion';
import { Button, EmptyState, ErrorState, MetricReadout, StatusPill } from '@/ui/patterns';
import { asArray, asRecord, num, str, timeAgo } from '@/lib/utils';
import './session.css';

type IconCmp = ComponentType<{ size?: number; className?: string }>;
const UsersIcon = Users as IconCmp;
const ClockIcon = Clock3 as IconCmp;

type PlayerRow = {
  id: string;
  name: string;
  uuid: string;
  online: boolean;
  ping: number | null;
  dimension: string | null;
  playtime_seconds: number | null;
  last_seen: string | null;
};

type WindowStats = {
  peak_concurrent: number | null;
  unique_players: number | null;
  player_hours: number | null;
  sessions: { player: string; minutes: number; join: string | null; leave: string | null }[];
};

type SortKey = 'online' | 'name' | 'ping' | 'playtime';

const POLL_MS = 5_000;
const PLAYER_CAP = 25;
const SESSION_CAP = 10;

function playtimeSeconds(info: Record<string, unknown>) {
  if (info.playtime_seconds != null) return num(info.playtime_seconds);
  if (info.total_seconds != null) return num(info.total_seconds);
  if (info.playtime_ticks != null) return num(info.playtime_ticks) / 20;
  if (info.playtime_hours != null) return num(info.playtime_hours) * 3600;
  return null;
}

function toPlayerRow(name: string, info: Record<string, unknown>): PlayerRow {
  const rawUuid = str(info.uuid);
  const uuid = rawUuid.startsWith('online:') ? '' : rawUuid;
  const displayName = str(info.name, name || '—');
  return {
    id: uuid || displayName,
    name: displayName,
    uuid,
    online: info.online === true,
    ping: info.ping == null ? null : num(info.ping),
    dimension: info.dimension == null ? null : str(info.dimension),
    playtime_seconds: playtimeSeconds(info),
    last_seen: info.last_seen == null ? null : str(info.last_seen),
  };
}

/** Normalize player_directory (array envelope or name→info map). */
function normalizePlayers(directory: unknown): PlayerRow[] {
  const dir = asRecord(directory);
  if (Array.isArray(dir.players)) {
    return asArray<Record<string, unknown>>(dir.players).map((p) =>
      toPlayerRow(str(p.name, '—'), p),
    );
  }

  return Object.entries(dir)
    .filter(([, info]) => info && typeof info === 'object' && !Array.isArray(info))
    .map(([name, info]) => toPlayerRow(name, asRecord(info)))
    .filter(
      (p) =>
        p.name &&
        p.name !== 'players' &&
        p.name !== 'window_stats' &&
        p.name !== 'scanned_at' &&
        p.name !== 'world_name' &&
        p.name !== 'online_count' &&
        p.name !== 'known_count',
    );
}

function extractWindowStats(directory: unknown): WindowStats {
  const dir = asRecord(directory);
  const ws = asRecord(dir.window_stats);
  const sessions = asArray<Record<string, unknown>>(ws.sessions)
    .map((s) => ({
      player: str(s.player, '—'),
      minutes: num(s.minutes, 0),
      join: s.join == null ? null : str(s.join),
      leave: s.leave == null ? null : str(s.leave),
    }))
    .filter((s) => s.player && s.minutes > 0);
  return {
    peak_concurrent: ws.peak_concurrent == null ? null : num(ws.peak_concurrent),
    unique_players: ws.unique_players == null ? null : num(ws.unique_players),
    player_hours: ws.player_hours == null ? null : num(ws.player_hours),
    sessions,
  };
}

function shortDim(dim: string | null) {
  if (!dim) return '—';
  return dim.replace(/^minecraft:/, '');
}

/** Prefer compact playtime labels (skip “0m”). */
function formatPlaytime(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function VitalTile({
  label,
  value,
  format,
  tone,
}: {
  label: string;
  value: number | null;
  format?: (n: number) => string;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
}) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <div className="ss-vital">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">{label}</div>
        <div className="mt-1 font-mono text-lg font-semibold text-wt-text-low">—</div>
      </div>
    );
  }
  return (
    <div className="ss-vital">
      <MetricReadout label={label} value={value} format={format} size="sm" tone={tone} />
    </div>
  );
}

function PingBars({ ms }: { ms: number | null }) {
  if (ms == null) return <span className="text-wt-text-low">—</span>;
  const lit = ms < 40 ? 4 : ms < 80 ? 3 : ms < 150 ? 2 : 1;
  const tone = ms < 80 ? 'bg-wt-ok' : ms < 150 ? 'bg-wt-warn' : 'bg-wt-danger';
  return (
    <span className="inline-flex items-end gap-0.5" title={`${ms} ms`} aria-label={`${ms} milliseconds`}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${i <= lit ? tone : 'bg-wt-bg3'}`}
          style={{ height: 4 + i * 3 }}
        />
      ))}
    </span>
  );
}

function PlayerAvatar({ uuid, name }: { uuid: string; name: string }) {
  if (!uuid) return <span className="ss-avatar ss-avatar--empty" aria-hidden />;
  return (
    <img
      className="ss-avatar"
      src={`https://crafthead.net/avatar/${uuid}/32`}
      width={24}
      height={24}
      alt=""
      loading="lazy"
      decoding="async"
      title={name}
    />
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`ss-status-dot${online ? ' ss-status-dot--online' : ''}`}
      title={online ? 'Online' : 'Offline'}
      aria-label={online ? 'Online' : 'Offline'}
    />
  );
}

function samplePoints(samples: Record<string, unknown>, key: string): { t: number; v: number }[] {
  return asArray<Record<string, unknown>>(samples[key])
    .map((p) => {
      const t = Date.parse(str(p.t));
      const v = num(p.v, NaN);
      if (!Number.isFinite(t) || !Number.isFinite(v)) return null;
      return { t, v };
    })
    .filter((p): p is { t: number; v: number } => p != null);
}

/** Bucket concurrent-player samples into calendar-day averages (+ peak). */
function dailyPlayerAverages(
  points: { t: number; v: number }[],
  days = 14,
): Record<string, unknown>[] {
  if (!points.length) return [];
  const lastT = points[points.length - 1]!.t;
  const cutoff = lastT - days * 86_400_000;
  const buckets = new Map<string, { sum: number; n: number; peak: number; dayStart: number }>();
  for (const p of points) {
    if (p.t < cutoff) continue;
    const d = new Date(p.t);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const cur = buckets.get(key) ?? { sum: 0, n: 0, peak: 0, dayStart };
    cur.sum += p.v;
    cur.n += 1;
    cur.peak = Math.max(cur.peak, p.v);
    buckets.set(key, cur);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[1].dayStart - b[1].dayStart)
    .map(([date, b]) => ({
      date,
      players_avg: b.n > 0 ? Math.round((b.sum / b.n) * 10) / 10 : 0,
      players_peak: Math.round(b.peak),
    }));
}

function heroGlowProps(online: number) {
  if (online > 0) {
    return {
      glowColor: '160 72 48',
      glowIntensity: 0.5,
      colors: ['#34d399', '#22d3ee', '#60a5fa'],
      fillOpacity: 0.16,
      backgroundColor: 'var(--wt-bg1)',
    };
  }
  return {
    glowColor: '210 40 55',
    glowIntensity: 0.4,
    colors: ['#94a3b8', '#64748b', '#38bdf8'],
    fillOpacity: 0.12,
    backgroundColor: 'var(--wt-bg1)',
  };
}

function PlayerTable({ rows }: { rows: PlayerRow[] }) {
  return (
    <div className="ss-table-scroll">
      <table className="ss-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Status</th>
            <th>Ping</th>
            <th>World</th>
            <th>Playtime</th>
            <th>Last seen</th>
            <th>UUID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="ss-table__row">
              <td>
                <span className="ss-player">
                  <PlayerAvatar uuid={p.uuid} name={p.name} />
                  <StatusDot online={p.online} />
                  <span className="ss-player__name">{p.name}</span>
                </span>
              </td>
              <td>
                <StatusPill tone={p.online ? 'ok' : 'neutral'}>
                  {p.online ? 'Online' : 'Offline'}
                </StatusPill>
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <PingBars ms={p.ping} />
                  <span className="font-mono text-xs text-wt-text-low">
                    {p.ping != null ? `${p.ping}ms` : '—'}
                  </span>
                </div>
              </td>
              <td className="font-mono text-xs">{shortDim(p.dimension)}</td>
              <td className="font-mono text-xs">
                {p.playtime_seconds != null ? formatPlaytime(p.playtime_seconds) : '—'}
              </td>
              <td className="text-xs text-wt-text-low">
                {p.online ? 'now' : p.last_seen ? timeAgo(p.last_seen) : '—'}
              </td>
              <td>
                {p.uuid ? (
                  <Button
                    kind="ghost"
                    onClick={() => navigator.clipboard?.writeText(p.uuid)}
                    title={p.uuid}
                  >
                    <Copy size={12} className="mr-1" />
                    <span className="font-mono text-[10px]">{p.uuid.slice(0, 8)}…</span>
                  </Button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Plate({
  title,
  hint,
  icon,
  trailing,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ss-plate">
      <div className="ss-plate__head">
        <div>
          <div className="ss-plate__title">
            {icon}
            <h3>{title}</h3>
          </div>
          {hint ? <p className="ss-plate__hint">{hint}</p> : null}
        </div>
        {trailing}
      </div>
      <div className="ss-plate__body">{children}</div>
    </div>
  );
}

export function PageView({ route: _route }: { route: RouteState }) {
  const playersQ = useQuery({
    queryKey: ['players'],
    queryFn: api.players,
    refetchInterval: POLL_MS,
  });
  const liveQ = useQuery({
    queryKey: ['live'],
    queryFn: api.live,
    refetchInterval: POLL_MS,
  });
  const samplesQ = useQuery({
    queryKey: ['samples', 'session-players', 14],
    queryFn: () => api.samples(14 * 24 * 60, 8_000),
    staleTime: 60_000,
  });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [sort, setSort] = useState<SortKey>('online');
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const directory = useMemo(() => {
    const fromApi = asRecord(playersQ.data).player_directory;
    if (fromApi && typeof fromApi === 'object') return fromApi;
    const facts = asRecord(factsQ.data);
    return asRecord(facts.optional).player_directory;
  }, [playersQ.data, factsQ.data]);

  const windowStats = useMemo(() => extractWindowStats(directory), [directory]);
  const allPlayers = useMemo(() => normalizePlayers(directory), [directory]);

  const liveLatest = asRecord(asRecord(liveQ.data).latest);
  const playersOnline = Math.max(
    0,
    Math.round(
      num(
        liveLatest.players_online,
        num(asRecord(directory).online_count, allPlayers.filter((p) => p.online).length),
      ),
    ),
  );

  const playerPoints = useMemo(
    () => samplePoints(asRecord(samplesQ.data), 'players'),
    [samplesQ.data],
  );

  const peakFromSamples = useMemo(() => {
    if (!playerPoints.length) return null;
    const cutoff = playerPoints[playerPoints.length - 1]!.t - 24 * 3600_000;
    let peak = 0;
    let any = false;
    for (const p of playerPoints) {
      if (p.t < cutoff) continue;
      peak = Math.max(peak, p.v);
      any = true;
    }
    return any ? peak : null;
  }, [playerPoints]);

  const dailyPlayers = useMemo(() => dailyPlayerAverages(playerPoints, 14), [playerPoints]);
  const dailyRows = useMemo(
    () => dailyToBklitRows(dailyPlayers, ['players_avg', 'players_peak']),
    [dailyPlayers],
  );
  const avgAcrossDays = useMemo(() => {
    if (!dailyPlayers.length) return null;
    const sum = dailyPlayers.reduce((s, d) => s + num(d.players_avg), 0);
    return Math.round((sum / dailyPlayers.length) * 10) / 10;
  }, [dailyPlayers]);

  const peakPlayers =
    peakFromSamples ??
    windowStats.peak_concurrent ??
    (Number.isFinite(num(asRecord(directory).online_count))
      ? num(asRecord(directory).online_count)
      : null);

  const knownPlayers = Math.max(
    0,
    Math.round(
      num(
        asRecord(directory).known_count,
        windowStats.unique_players ?? allPlayers.length,
      ),
    ),
  );

  const playerHours = windowStats.player_hours;
  const scannedAt = str(asRecord(directory).scanned_at);

  const topActive = useMemo(
    () =>
      [...allPlayers]
        .filter((p) => (p.playtime_seconds ?? 0) > 0)
        .sort((a, b) => (b.playtime_seconds ?? 0) - (a.playtime_seconds ?? 0))
        .slice(0, 5),
    [allPlayers],
  );

  const filteredPlayers = useMemo(() => {
    let list = allPlayers;
    if (statusFilter === 'online') list = list.filter((p) => p.online);
    else if (statusFilter === 'offline') list = list.filter((p) => !p.online);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [allPlayers, statusFilter, search]);

  const sortedPlayers = useMemo(() => {
    const list = [...filteredPlayers];
    list.sort((a, b) => {
      if (sort === 'online' || sort === 'name') {
        if (a.online !== b.online) return a.online ? -1 : 1;
      }
      if (sort === 'online') return a.name.localeCompare(b.name);
      if (sort === 'ping') return (a.ping ?? 9999) - (b.ping ?? 9999);
      if (sort === 'playtime') return (b.playtime_seconds ?? 0) - (a.playtime_seconds ?? 0);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [filteredPlayers, sort]);

  const hasOnline = sortedPlayers.some((p) => p.online);
  const hasOffline = sortedPlayers.some((p) => !p.online);
  const showGrouped = statusFilter === 'all' && hasOnline && hasOffline;

  const playersTruncated = !showAllPlayers && sortedPlayers.length > PLAYER_CAP;
  const visiblePlayers = playersTruncated
    ? sortedPlayers.slice(0, PLAYER_CAP)
    : sortedPlayers;
  const onlineRows = visiblePlayers.filter((p) => p.online);
  const offlineRows = visiblePlayers.filter((p) => !p.online);

  const sessionsTruncated =
    !showAllSessions && windowStats.sessions.length > SESSION_CAP;
  const visibleSessions = sessionsTruncated
    ? windowStats.sessions.slice(0, SESSION_CAP)
    : windowStats.sessions;

  const hasData = allPlayers.length > 0 || playersOnline > 0;
  const hasPlaytime = allPlayers.some((p) => (p.playtime_seconds ?? 0) > 0);
  const loading = playersQ.isLoading && factsQ.isLoading && !directory;
  const error = playersQ.isError && factsQ.isError;

  if (loading) {
    return (
      <PageEnter className="ss-stack">
        <div className="h-14 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-36 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-52 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="grid gap-4 lg:grid-cols-[1.55fr_0.85fr]">
          <div className="h-72 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
          <div className="h-72 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        </div>
      </PageEnter>
    );
  }

  if (error) {
    return (
      <ErrorState title="Couldn't load session data">
        {(playersQ.error as Error)?.message || (factsQ.error as Error)?.message}
      </ErrorState>
    );
  }

  return (
    <PageEnter className="ss-stack">
      {topActive.length > 0 ? (
        <FadeIn>
          <div className="ss-plate ss-plate--strip">
            <div className="ss-topstrip" aria-label="Top by playtime">
              <span className="ss-topstrip__label">Top playtime</span>
              <div className="ss-topstrip__chips">
                {topActive.map((p, i) => (
                  <div
                    key={p.id}
                    className={`ss-chip${p.online ? ' ss-chip--online' : ''}`}
                    title={p.online ? `${p.name} · online` : p.name}
                  >
                    <span className="ss-chip__rank">{i + 1}</span>
                    <PlayerAvatar uuid={p.uuid} name={p.name} />
                    <span className="ss-chip__name">{p.name}</span>
                    <span className="ss-chip__meta">
                      {formatPlaytime(p.playtime_seconds)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      ) : null}

      <FadeIn>
        <BorderGlow
          className="ss-hero"
          borderRadius={14}
          edgeSensitivity={28}
          glowRadius={16}
          coneSpread={18}
          animated
          {...heroGlowProps(playersOnline)}
        >
          <div className="ss-hero__body">
            <div className="ss-hero__head">
              <div>
                <div className="ss-hero__title">
                  <GlareIcon icon={UsersIcon} tone={playersOnline > 0 ? 'ok' : 'info'} />
                  <h2>Who&apos;s here</h2>
                  <StatusPill tone={playersOnline > 0 ? 'ok' : 'neutral'}>
                    {playersOnline > 0 ? 'Players online' : 'Idle'}
                  </StatusPill>
                </div>
                <p className="ss-hero__hint">
                  Live count from Watching
                  {scannedAt ? ` · roster scanned ${timeAgo(scannedAt)}` : ''}
                </p>
              </div>
            </div>

            <div className="ss-vitals">
              <VitalTile
                label="Online now"
                value={playersOnline}
                format={(n) => String(Math.round(n))}
                tone={playersOnline > 0 ? 'ok' : 'default'}
              />
              <VitalTile
                label="Peak (24h)"
                value={peakPlayers}
                format={(n) => String(Math.round(n))}
              />
              <VitalTile
                label="Known"
                value={knownPlayers}
                format={(n) => String(Math.round(n))}
              />
              <VitalTile
                label="Player-hours"
                value={playerHours}
                format={(n) => n.toFixed(1)}
              />
            </div>
          </div>
        </BorderGlow>
      </FadeIn>

      <FadeIn>
        {dailyRows.length ? (
          <ChartFrame
            title="Average daily players"
            layer="watching"
            className="ss-daily-chart"
            actions={
              avgAcrossDays != null ? (
                <StatusPill tone="info">{avgAcrossDays} avg · 14d</StatusPill>
              ) : null
            }
          >
            <div className="ss-chart-legend" aria-hidden>
              <span className="ss-chart-legend__item">
                <span className="ss-chart-legend__swatch" data-tone="avg" />
                Daily average
              </span>
              <span className="ss-chart-legend__item">
                <span className="ss-chart-legend__swatch" data-tone="peak" />
                Daily peak
              </span>
            </div>
            <WtAreaChart
              animationDuration={0}
              yDomainTweenDuration={0}
              aspectRatio="21 / 9"
              data={dailyRows}
              series={[
                { dataKey: 'players_avg', color: 'var(--wt-info, var(--wt-accent))' },
                { dataKey: 'players_peak', color: 'color-mix(in srgb, var(--wt-warn) 70%, var(--wt-accent))' },
              ]}
            />
            <p className="ss-daily-chart__caption">
              Concurrent players per day from live samples (last 14 days).
            </p>
          </ChartFrame>
        ) : (
          <div className="ss-plate">
            <div className="ss-plate__head">
              <div>
                <div className="ss-plate__title">
                  <h3>Average daily players</h3>
                </div>
                <p className="ss-plate__hint">Needs a few days of Watching samples.</p>
              </div>
            </div>
            {samplesQ.isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-wt-bg2" />
            ) : (
              <EmptyState title="No daily history yet">
                Player averages appear once concurrent-player samples have been collected.
              </EmptyState>
            )}
          </div>
        )}
      </FadeIn>

      {hasData && !hasPlaytime ? (
        <FadeIn>
          <div className="ss-cta">
            <Clock3 size={18} className="mt-0.5 shrink-0 text-wt-info" />
            <div className="ss-cta__copy">
              <strong>Playtime still warming up</strong>
              <p>
                Online players show up from Watching. UUIDs and playtime fill from world stats on
                the next Scanning poll (usually within ~15 minutes).
              </p>
            </div>
          </div>
        </FadeIn>
      ) : null}

      <div className="ss-split">
        <FadeIn className="ss-split__col">
          <Plate
            title="Player directory"
            hint={
              playersOnline === 0 && knownPlayers > 0
                ? 'Server looks idle — known players are offline.'
                : 'Search and filter the roster. Online players sort first.'
            }
            icon={<GlareIcon icon={UsersIcon} tone="accent" size={15} className="h-8 w-8 rounded-xl" />}
          >
            <div className="ss-toolbar">
              <label className="ss-search-wrap">
                <Search size={14} className="ss-search-wrap__icon" aria-hidden />
                <input
                  className="ss-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players…"
                  aria-label="Search players"
                />
              </label>
              <div className="ss-pills" role="group" aria-label="Status filter">
                {(
                  [
                    ['all', 'All'],
                    ['online', 'Online'],
                    ['offline', 'Offline'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`ss-pill${statusFilter === id ? ' is-active' : ''}`}
                    onClick={() => setStatusFilter(id)}
                    aria-pressed={statusFilter === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="ss-pills" role="group" aria-label="Sort">
                {(
                  [
                    ['online', 'Online'],
                    ['name', 'Name'],
                    ['ping', 'Ping'],
                    ['playtime', 'Playtime'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`ss-pill${sort === id ? ' is-active' : ''}`}
                    onClick={() => setSort(id)}
                    aria-pressed={sort === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="ss-result-count">{sortedPlayers.length} shown</span>
            </div>

            {!hasData ? (
              <EmptyState title="No player data yet">
                Online players appear from Watching. Playtime and the roster fill from Scanning as
                world stats are read.
              </EmptyState>
            ) : sortedPlayers.length === 0 ? (
              <EmptyState title="No players match">Try a different search or filter.</EmptyState>
            ) : showGrouped ? (
              <div className="ss-groups">
                {onlineRows.length ? (
                  <div>
                    <div className="ss-group__head">
                      <StatusDot online />
                      <span>Online</span>
                      <span className="ss-group__count">{onlineRows.length}</span>
                    </div>
                    <PlayerTable rows={onlineRows} />
                  </div>
                ) : null}
                {offlineRows.length ? (
                  <div>
                    <div className="ss-group__head">
                      <StatusDot online={false} />
                      <span>Offline</span>
                      <span className="ss-group__count">{offlineRows.length}</span>
                    </div>
                    <PlayerTable rows={offlineRows} />
                  </div>
                ) : null}
              </div>
            ) : (
              <PlayerTable rows={visiblePlayers} />
            )}
            {playersTruncated ? (
              <Button
                kind="ghost"
                className="ss-show-more"
                onClick={() => setShowAllPlayers(true)}
              >
                Show more ({sortedPlayers.length - PLAYER_CAP} more)
              </Button>
            ) : null}
          </Plate>
        </FadeIn>

        <FadeIn className="ss-split__col">
          <Plate
            title="Recent sessions"
            hint={
              windowStats.sessions.length
                ? `${windowStats.sessions.length} from the reporting window`
                : 'Join/leave sessions appear after Scanning reads the logs.'
            }
            icon={<GlareIcon icon={ClockIcon} tone="info" size={15} className="h-8 w-8 rounded-xl" />}
          >
            {windowStats.sessions.length ? (
              <>
                <Stagger className="ss-sessions">
                  {visibleSessions.map((s, i) => (
                    <div key={`${s.player}-${i}`} className="ss-session-row">
                      <span className="ss-session-row__name">{s.player}</span>
                      <span className="ss-session-row__mins">
                        {s.minutes >= 60
                          ? `${(s.minutes / 60).toFixed(1)}h`
                          : `${Math.round(s.minutes)}m`}
                      </span>
                      {s.join || s.leave ? (
                        <span className="ss-session-row__meta">
                          {s.join ? timeAgo(s.join) : '—'}
                          {s.leave ? ` → ${timeAgo(s.leave)}` : ' · still open'}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </Stagger>
                {sessionsTruncated ? (
                  <Button
                    kind="ghost"
                    className="ss-show-more"
                    onClick={() => setShowAllSessions(true)}
                  >
                    Show more ({windowStats.sessions.length - SESSION_CAP} more)
                  </Button>
                ) : null}
              </>
            ) : (
              <EmptyState title="No sessions yet">
                Window session stats fill from the player tracker on the next report scan.
              </EmptyState>
            )}
          </Plate>
        </FadeIn>
      </div>
    </PageEnter>
  );
}
