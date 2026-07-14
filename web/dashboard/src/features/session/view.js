import { html, useState, useMemo } from '../../lib/preact.js';
import { players, live, reports, samples } from '../../state/stores.js';
import { Page, Section, MetricTile, DataTable, FilterBar, EmptyState } from '../../ui/patterns/index.js';
import { Button, CopyButton } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import { formatDuration } from '../../domain/formats.js';
import { openModal } from '../../state/actions.js';

const STATUS_OPTS = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
];

function formatPlaytime(seconds) {
  if (!seconds) return '—';
  return formatDuration(seconds);
}

function relTime(iso) {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  if (isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function playtimeSeconds(info) {
  if (info?.playtime_seconds != null) return Number(info.playtime_seconds);
  if (info?.total_seconds != null) return Number(info.total_seconds);
  if (info?.playtime_ticks != null) return Number(info.playtime_ticks) / 20;
  if (info?.playtime_hours != null) return Number(info.playtime_hours) * 3600;
  return null;
}

/** Normalize player_directory (array envelope or name→info map). */
function normalizePlayers(directory) {
  if (!directory) return [];

  if (Array.isArray(directory.players)) {
    return directory.players.map((p) => {
      const uuid = p?.uuid && !String(p.uuid).startsWith('online:') ? String(p.uuid) : '';
      const name = p?.name ?? '—';
      return {
        id: uuid || name,
        name,
        uuid,
        online: !!p?.online,
        ping: p?.ping ?? null,
        dimension: p?.dimension ?? null,
        playtime_seconds: playtimeSeconds(p),
        last_seen: p?.last_seen ?? null,
      };
    });
  }

  return Object.entries(directory)
    .filter(([, info]) => info && typeof info === 'object' && !Array.isArray(info))
    .map(([name, info]) => {
      const uuid = info?.uuid && !String(info.uuid).startsWith('online:') ? String(info.uuid) : '';
      const displayName = info?.name ?? name;
      return {
        id: uuid || displayName,
        name: displayName,
        uuid,
        online: info?.online ?? false,
        ping: info?.ping ?? null,
        dimension: info?.dimension ?? null,
        playtime_seconds: playtimeSeconds(info),
        last_seen: info?.last_seen ?? null,
      };
    })
    .filter((p) => p.name && p.name !== 'players' && p.name !== 'window_stats');
}

function pingTone(ms) {
  if (ms == null || isNaN(ms)) return 'neutral';
  if (ms < 80) return 'ok';
  if (ms < 150) return 'warn';
  return 'danger';
}

function pingLit(ms) {
  if (ms == null || isNaN(ms)) return 0;
  if (ms < 40) return 4;
  if (ms < 80) return 3;
  if (ms < 150) return 2;
  return 1;
}

function PingBars({ ms }) {
  if (ms == null) return html`<span class="ui-text-low">—</span>`;
  const tone = pingTone(ms);
  const lit = pingLit(ms);
  return html`
    <span class=${`feat-ping feat-ping--${tone}`} title=${`${ms} ms`} aria-label=${`${ms} milliseconds`}>
      <span class="feat-ping__bars" aria-hidden="true">
        ${[1, 2, 3, 4].map((i) => html`
          <span class=${['feat-ping__bar', i <= lit ? 'feat-ping__bar--on' : ''].filter(Boolean).join(' ')} />
        `)}
      </span>
      <span class="feat-ping__ms">${ms}</span>
    </span>
  `;
}

function PlayerAvatar({ uuid, name }) {
  if (!uuid) {
    return html`<span class="feat-avatar feat-avatar--empty" aria-hidden="true" />`;
  }
  return html`
    <img
      class="feat-avatar"
      src=${`https://crafthead.net/avatar/${uuid}/32`}
      width="24"
      height="24"
      alt=""
      loading="lazy"
      decoding="async"
      title=${name}
    />
  `;
}

function StatusDot({ online }) {
  return html`
    <span
      class=${`feat-status-dot ${online ? 'feat-status-dot--online' : 'feat-status-dot--offline'}`}
      title=${online ? 'Online' : 'Offline'}
      aria-label=${online ? 'Online' : 'Offline'}
    />
  `;
}

function shortDim(dim) {
  if (!dim) return '—';
  return String(dim).replace(/^minecraft:/, '');
}

function PlayerTable({ rows, cols, sort, onSort }) {
  return html`
    <div class="feat-table-scroll feat-table-scroll--session">
      <${DataTable}
        columns=${cols}
        rows=${rows}
        rowKey="id"
        sort=${sort}
        onSort=${onSort}
        density=${40}
        stickyHeader=${true}
        empty="No players match the current filter"
      />
    </div>
  `;
}

function GroupedPlayerTables({ onlineRows, offlineRows, cols, sort, onSort }) {
  return html`
    <div class="feat-session-groups">
      ${onlineRows.length > 0 && html`
        <div class="feat-session-group">
          <div class="feat-session-group__head">
            <${StatusDot} online=${true} />
            <span class="feat-session-group__label">Online</span>
            <span class="feat-session-group__count">${onlineRows.length}</span>
          </div>
          <${PlayerTable} rows=${onlineRows} cols=${cols} sort=${sort} onSort=${onSort} />
        </div>
      `}
      ${offlineRows.length > 0 && html`
        <div class="feat-session-group">
          <div class="feat-session-group__head">
            <${StatusDot} online=${false} />
            <span class="feat-session-group__label">Offline</span>
            <span class="feat-session-group__count">${offlineRows.length}</span>
          </div>
          <${PlayerTable} rows=${offlineRows} cols=${cols} sort=${sort} onSort=${onSort} />
        </div>
      `}
    </div>
  `;
}

export function PageView() {
  const { directory, at: playersAt } = players.value;
  const { latest } = live.value;
  const { facts } = reports.value;
  const samplesSeries = samples.value.series;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'online', dir: 'desc' });

  const playersOnline = latest?.players_online ?? directory?.online_count ?? 0;

  const allPlayers = useMemo(() => normalizePlayers(directory), [directory]);

  const filteredPlayers = useMemo(() => {
    let list = allPlayers;
    if (statusFilter === 'online') list = list.filter((p) => p.online);
    else if (statusFilter === 'offline') list = list.filter((p) => !p.online);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [allPlayers, statusFilter, search]);

  const peakPlayers = facts?.summary?.players_peak
    ?? facts?.stats?.players_peak
    ?? directory?.window_stats?.peak_concurrent
    ?? null;
  const uniquePlayers = facts?.summary?.unique_players
    ?? directory?.window_stats?.unique_players
    ?? directory?.known_count
    ?? allPlayers.length;

  const playerSpark = useMemo(() => {
    const raw = samplesSeries?.players ?? [];
    return raw.slice(-288).map((p) => p?.v ?? 0);
  }, [samplesSeries]);

  const topActive = useMemo(() => {
    return [...allPlayers]
      .filter((p) => p.playtime_seconds != null && p.playtime_seconds > 0)
      .sort((a, b) => (b.playtime_seconds ?? 0) - (a.playtime_seconds ?? 0))
      .slice(0, 5);
  }, [allPlayers]);

  const cols = [
    {
      key: 'name',
      label: 'Player',
      sortable: true,
      render: (v, row) => html`
        <span class="feat-player-name">
          <${PlayerAvatar} uuid=${row.uuid} name=${row.name} />
          <${StatusDot} online=${row.online} />
          <span class="feat-player-name__text">${v}</span>
        </span>
      `,
    },
    {
      key: 'online',
      label: 'Status',
      sortable: true,
      render: (_v, row) => html`
        <span class=${row.online ? 'feat-session-status feat-session-status--online' : 'feat-session-status'}>
          ${row.online ? 'Online' : 'Offline'}
        </span>
      `,
    },
    {
      key: 'ping',
      label: 'Ping',
      align: 'right',
      render: (v) => html`<${PingBars} ms=${v} />`,
    },
    {
      key: 'dimension',
      label: 'World',
      render: (v) => shortDim(v),
    },
    {
      key: 'playtime_seconds',
      label: 'Playtime',
      sortable: true,
      render: (v) => formatPlaytime(v),
    },
    {
      key: 'last_seen',
      label: 'Last seen',
      render: (v) => relTime(v),
    },
    {
      key: 'uuid',
      label: '',
      render: (v) => html`
        <div class="feat-row-actions">
          ${v && html`<${CopyButton} text=${v} label="Copy UUID" />`}
        </div>
      `,
    },
  ];

  const sortedPlayers = useMemo(() => {
    const list = [...filteredPlayers];
    if (!sort) {
      return list.sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return String(a.name).localeCompare(String(b.name));
      });
    }
    return list.sort((a, b) => {
      if (sort.key === 'name' && a.online !== b.online) {
        return a.online ? -1 : 1;
      }
      let av = a[sort.key];
      let bv = b[sort.key];
      if (sort.key === 'online') {
        av = a.online ? 1 : 0;
        bv = b.online ? 1 : 0;
      }
      if (av == null) av = '';
      if (bv == null) bv = '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filteredPlayers, sort]);

  const onlinePlayers = useMemo(
    () => sortedPlayers.filter((p) => p.online),
    [sortedPlayers],
  );
  const offlinePlayers = useMemo(
    () => sortedPlayers.filter((p) => !p.online),
    [sortedPlayers],
  );

  const hasData = allPlayers.length > 0 || playersOnline > 0;
  const hasPlaytime = allPlayers.some((p) => (p.playtime_seconds ?? 0) > 0);
  const hasReport = !!facts;
  const spark = playerSpark.length > 1 ? playerSpark : undefined;
  const showGrouped = statusFilter === 'all' && onlinePlayers.length > 0 && offlinePlayers.length > 0;

  return html`
    <${Page}
      title="Session"
      subtitle="Who's online and who's been here"
    >
      <div data-tour="session" class="ui-page__stack">
        <div class="feat-session-hero">
          <${MetricTile}
            className="feat-session-hero__tile"
            label="Online now"
            value=${playersOnline}
            format=${(v) => String(Math.round(v))}
            source=${{ layer: 'live', at: live.value.at }}
            spark=${spark}
          />
          ${peakPlayers != null && html`
            <${MetricTile}
              className="feat-session-hero__tile"
              label="Peak (window)"
              value=${peakPlayers}
              format=${(v) => String(Math.round(v))}
              source=${{ layer: 'report', at: playersAt }}
            />
          `}
          <${MetricTile}
            className="feat-session-hero__tile"
            label="Unique (report)"
            value=${uniquePlayers}
            format=${(v) => String(Math.round(v))}
            source=${{ layer: 'report', at: playersAt }}
          />
        </div>

        ${topActive.length > 0 && html`
          <div class="feat-session-topstrip" aria-label="Top by playtime">
            <span class="feat-session-topstrip__label">Top playtime</span>
            <div class="feat-session-topstrip__chips">
              ${topActive.map((p, i) => html`
                <div key=${p.uuid || p.name} class=${`feat-session-chip ${p.online ? 'feat-session-chip--online' : ''}`}>
                  <span class="feat-session-chip__rank">${i + 1}</span>
                  <${PlayerAvatar} uuid=${p.uuid} name=${p.name} />
                  <span class="feat-session-chip__name">${p.name}</span>
                  <span class="feat-session-chip__meta">${formatPlaytime(p.playtime_seconds)}</span>
                </div>
              `)}
            </div>
          </div>
        `}

        ${hasData && !hasPlaytime && html`
          <div class="feat-session-playtime-cta">
            <${Icon} name="clock" size=${18} />
            <div class="feat-session-playtime-cta__copy">
              <strong>${hasReport ? 'Playtime not in this report yet' : 'Playtime needs a report'}</strong>
              <p>
                ${hasReport
                  ? 'Live roster is here, but per-player hours come from log analysis in a full report. Run one to fill playtime and last-seen history.'
                  : 'Online players show up live. UUIDs, playtime, and session history need at least one full report.'}
              </p>
            </div>
            <${Button} kind=${hasReport ? 'neutral' : 'accent'} size="sm" onClick=${() => openModal('run-report')}>
              ${hasReport ? 'Run another report' : 'Run Report'}
            </${Button}>
          </div>
        `}

        <${Section} title="Player directory" defaultOpen=${true}>
          <${FilterBar}
            search=${search}
            onSearch=${setSearch}
            placeholder="Search players…"
            filters=${STATUS_OPTS}
            filterValue=${statusFilter}
            onFilterChange=${setStatusFilter}
            resultCount=${filteredPlayers.length}
          />

          ${!hasData
            ? html`
                <${EmptyState}
                  icon=${html`<${Icon} name="users" size=${20} />`}
                  title="No player data yet"
                  body="Run a report to fill playtime, UUIDs, and session history. Online players appear here live."
                  action=${html`<${Button} kind="accent" onClick=${() => openModal('run-report')}>Run Report</${Button}>`}
                />
              `
            : showGrouped
              ? html`
                  <${GroupedPlayerTables}
                    onlineRows=${onlinePlayers}
                    offlineRows=${offlinePlayers}
                    cols=${cols}
                    sort=${sort}
                    onSort=${setSort}
                  />
                `
              : html`
                  <${PlayerTable}
                    rows=${sortedPlayers}
                    cols=${cols}
                    sort=${sort}
                    onSort=${setSort}
                  />
                `
          }
        </${Section}>
      </div>
    </${Page}>
  `;
}
