/**
 * Watchtower UI v3 — session tab renderers
 */
const TowerRenderSession = (function () {
  const esc = TowerRenderShared.esc;
  const fmtRelative = TowerRenderShared.fmtRelative;
  const kpiCard = TowerRenderShared.kpiCard;

  function windowMinutesByPlayer(stats) {
    const map = new Map();
    (stats?.sessions ?? []).forEach((s) => {
      if (!s?.player) return;
      map.set(s.player, (map.get(s.player) || 0) + (Number(s.minutes) || 0));
    });
    return map;
  }

  function windowStats() {
    const dir = state.playerRoster || state.activeFacts?.optional?.player_directory;
    return dir?.window_stats || state.activeFacts?.minecraft?.player_stats || {};
  }

  function sessionPlayersEnriched() {
    const dir = state.playerRoster || state.activeFacts?.optional?.player_directory;
    const windowMap = windowMinutesByPlayer(windowStats());
    const players = [...(dir?.players ?? [])];
    if (!players.length && (state.activeFacts?.optional?.players_now ?? []).length) {
      (state.activeFacts.optional.players_now).forEach((p) => {
        players.push({ ...p, online: true });
      });
    }
    return players.map((p) => ({
      ...p,
      window_minutes: windowMap.get(p.name) ?? 0,
    }));
  }

  function sortPlayers(players) {
    const sort = state.sessionSort || 'name';
    const list = [...players];
    list.sort((a, b) => {
      if (sort === 'playtime') return (b.playtime_hours ?? 0) - (a.playtime_hours ?? 0);
      if (sort === 'window') return (b.window_minutes ?? 0) - (a.window_minutes ?? 0);
      if (sort === 'ping') {
        const ap = a.online ? (a.ping ?? 9999) : 9999;
        const bp = b.online ? (b.ping ?? 9999) : 9999;
        return ap - bp;
      }
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
    return list;
  }

  function filterSessionPlayers(players, filter) {
    const f = filter || 'all';
    const q = (state.sessionSearch || '').toLowerCase();
    return players.filter((p) => {
      if (f === 'online' && !p.online) return false;
      if (f === 'offline' && p.online) return false;
      if (q) {
        const name = String(p.name || '').toLowerCase();
        const uuid = String(p.uuid || '').toLowerCase();
        if (!name.includes(q) && !uuid.includes(q)) return false;
      }
      return true;
    });
  }

  function playerAvatarUrl(p) {
    if (p.uuid) return `https://crafthead.net/avatar/${p.uuid}/32`;
    if (p.name) return `https://crafthead.net/avatar/${encodeURIComponent(p.name)}/32`;
    return '';
  }

  function playerInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  function renderPlayerAvatar(p) {
    const url = playerAvatarUrl(p);
    const initials = esc(playerInitials(p.name));
    if (!url) {
      return `<div class="wt-roster-avatar wt-roster-avatar--placeholder" aria-hidden="true">${initials}</div>`;
    }
    return `
      <div class="wt-roster-avatar">
        <img src="${esc(url)}" alt="" width="32" height="32" loading="lazy" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add('wt-roster-avatar--placeholder')">
        <span class="wt-roster-avatar__initials" aria-hidden="true">${initials}</span>
      </div>`;
  }

  function pingClass(ms) {
    if (ms < 50) return 'excellent';
    if (ms < 100) return 'good';
    if (ms < 200) return 'fair';
    return 'poor';
  }

  function renderPingBars(cls) {
    return `<span class="wt-ping wt-ping--${cls}" aria-hidden="true">${'<span class="wt-ping__bar"></span>'.repeat(4)}</span>`;
  }

  function renderPingCell(p) {
    if (!p.online || p.ping == null) {
      return '<td class="mono-cell wt-roster-muted">—</td>';
    }
    const ms = Number(p.ping);
    return `
      <td class="mono-cell">
        <div class="wt-roster-ping">
          ${renderPingBars(pingClass(ms))}
          <span class="wt-roster-ping-ms">${esc(`${ms} ms`)}</span>
        </div>
      </td>`;
  }

  function renderPlayerCell(p) {
    const lastSeen = !p.online && p.last_seen
      ? `<span class="wt-roster-last-seen">Last seen ${esc(p.last_seen)}</span>`
      : '';
    return `
      <td>
        <div class="wt-roster-player__cell">
          ${renderPlayerAvatar(p)}
          <div class="wt-roster-player__meta">
            <span class="wt-roster-name">${esc(p.name || '—')}</span>
            ${lastSeen}
          </div>
        </div>
      </td>`;
  }

  function renderRosterRow(p) {
    const statusCls = p.online ? 'online' : 'offline';
    const statusLabel = p.online ? 'Online' : 'Offline';
    const total = Labels.formatPlaytimeHours(p.playtime_hours);
    const window = p.window_minutes > 0
      ? Labels.formatPlaytimeMinutes(p.window_minutes)
      : '—';
    const dim = p.online ? Labels.dimensionLabel(p.dimension) : '—';
    const dimCls = p.online ? '' : ' wt-roster-muted';
    const uuidBtn = p.uuid
      ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm session-copy-uuid" data-uuid="${escAttr(p.uuid)}" title="Copy UUID">Copy UUID</button>`
      : '<span class="wt-roster-muted">—</span>';

    return `
      <tr class="wt-roster-player">
        <td><span class="wt-status-pill wt-status-pill--${statusCls}">${statusLabel}</span></td>
        ${renderPlayerCell(p)}
        <td class="mono-cell">${esc(total)}</td>
        <td class="mono-cell">${esc(window)}</td>
        ${renderPingCell(p)}
        <td class="${dimCls.trim()}">${esc(dim)}</td>
        <td class="mono-cell wt-session-actions">
          ${uuidBtn}
          <a href="#" class="wt-btn wt-btn--ghost wt-btn--sm session-activity-link" data-player="${escAttr(p.name || '')}">Activity</a>
        </td>
      </tr>`;
  }

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function renderSessionRosterRows(filter) {
    const players = sortPlayers(sessionPlayersEnriched());
    const filtered = filterSessionPlayers(players, filter);
    return filtered.length
      ? filtered.map(renderRosterRow).join('')
      : '<tr><td colspan="7" class="wt-empty">No players match this filter.</td></tr>';
  }

  function refreshRosterDom() {
    const filter = state.sessionFilter || 'all';
    const tbody = document.getElementById('session-roster-tbody');
    if (tbody) tbody.innerHTML = renderSessionRosterRows(filter);
    if (typeof rebindSessionRowActions === 'function') rebindSessionRowActions();
  }

  function sessionSummary() {
    const dir = state.playerRoster || state.activeFacts?.optional?.player_directory;
    const players = sessionPlayersEnriched();
    const ws = windowStats();
    const onlineCount = dir?.online_count ?? players.filter((p) => p.online).length;
    const knownCount = dir?.known_count ?? players.length;
    const windowHours = ws?.player_hours;
    const peak = ws?.peak_concurrent;
    const unique = ws?.unique_players;
    const lookback = formatLookbackLabel(state.activeFacts?.meta?.lookback_hours);
    const worldName = dir?.world_name;
    const liveAt = state.liveLatest?.time;
    const onlineFoot = state.apiMode
      ? (liveAt ? `Live · ${fmtRelative(liveAt)}` : 'Live polling')
      : `${onlineCount} of ${knownCount} known`;
    const knownFoot = worldName ? `World: ${worldName}` : 'From usercache + world stats';
    const windowFoot = lookback ? `Last ${lookback}` : 'From session logs';
    return {
      onlineCount,
      knownCount,
      windowHours,
      peak,
      unique,
      onlineFoot,
      knownFoot,
      windowFoot,
      players,
      sessions: ws?.sessions ?? [],
    };
  }

  function renderRecentSessionsCard(sessions) {
    const recent = [...(sessions || [])].slice(-8).reverse();
    if (!recent.length) {
      return `<div class="wt-card wt-card--surface wt-bento__span-6">
        <div class="wt-card__head"><h3 class="wt-card__title">${TowerSourceBadge.badge('report')} Recent sessions</h3></div>
        <p class="wt-empty">No parsed sessions in the report window yet.</p>
      </div>`;
    }
    const rows = recent.map((s) => `
      <li class="wt-session-recent__item">
        <strong>${esc(s.player)}</strong>
        <span class="text-caption">${esc(Labels.formatPlaytimeMinutes(s.minutes))}${s.leave ? '' : ' · still online'}</span>
      </li>`).join('');
    return `
      <div class="wt-card wt-card--surface wt-bento__span-6 wt-session-recent">
        <div class="wt-card__head"><h3 class="wt-card__title">${TowerSourceBadge.badge('report')} Recent sessions</h3></div>
        <ul class="wt-session-recent__list">${rows}</ul>
      </div>`;
  }

  function renderTopActiveSidebar(players) {
    const top = [...players]
      .filter((p) => (p.window_minutes ?? 0) > 0)
      .sort((a, b) => (b.window_minutes ?? 0) - (a.window_minutes ?? 0))
      .slice(0, 5);
    if (!top.length) return '';
    const rows = top.map((p) => `
      <li><span>${esc(p.name)}</span><span class="mono-cell">${esc(Labels.formatPlaytimeMinutes(p.window_minutes))}</span></li>`).join('');
    return `
      <div class="wt-card wt-card--surface wt-bento__span-6 wt-session-top-active">
        <div class="wt-card__head"><h3 class="wt-card__title">${TowerSourceBadge.badge('report')} Top active (report window)</h3></div>
        <ul class="wt-session-top-active__list">${rows}</ul>
      </div>`;
  }

  function applySessionRosterUpdate() {
    if (!document.querySelector('.wt-tab-session')) return;
    const summary = sessionSummary();
    const filter = state.sessionFilter || 'all';
    const onlineVal = document.getElementById('session-online-val');
    if (onlineVal) onlineVal.textContent = String(summary.onlineCount);
    const onlineSub = document.getElementById('session-online-sub');
    if (onlineSub) onlineSub.textContent = summary.onlineFoot;
    const knownVal = document.getElementById('session-known-val');
    if (knownVal) knownVal.textContent = String(summary.knownCount);
    const knownSub = document.getElementById('session-known-sub');
    if (knownSub) knownSub.textContent = summary.knownFoot;
    const peakVal = document.getElementById('session-peak-val');
    if (peakVal) peakVal.textContent = summary.peak != null ? String(summary.peak) : '—';
    const uniqueVal = document.getElementById('session-unique-val');
    if (uniqueVal) uniqueVal.textContent = summary.unique != null ? String(summary.unique) : '—';
    const windowVal = document.getElementById('session-window-val');
    if (windowVal) {
      windowVal.innerHTML = summary.windowHours != null
        ? `${summary.windowHours}<span class="wt-kpi__unit">h</span>`
        : '—';
    }
    const windowSub = document.getElementById('session-window-sub');
    if (windowSub) windowSub.textContent = summary.windowFoot;
    refreshRosterDom();
  }

  function renderSessionFilter(filter) {
    return ['all', 'online', 'offline'].map((f) => `
      <button type="button" class="wt-segment__btn${filter === f ? ' active' : ''}" data-session-filter="${f}">${f === 'all' ? 'All' : f === 'online' ? 'Online' : 'Offline'}</button>`).join('');
  }

  function renderSession() {
    const summary = sessionSummary();
    const filter = state.sessionFilter || 'all';
    const lookback = formatLookbackLabel(state.activeFacts?.meta?.lookback_hours);
    const maxRetention = typeof maxRetentionHours === 'function' ? maxRetentionHours() : 2160;

    const kpiOnline = kpiCard('session-online', 'Online', String(summary.onlineCount), summary.onlineFoot, '', 'wt-bento__span-3');
    const kpiPeak = kpiCard('session-peak', 'Peak concurrent', summary.peak != null ? String(summary.peak) : '—', 'Report window high', '', 'wt-bento__span-3');
    const kpiUnique = kpiCard('session-unique', 'Unique players', summary.unique != null ? String(summary.unique) : '—', summary.windowFoot, '', 'wt-bento__span-3');
    const kpiKnown = kpiCard('session-known', 'Known players', String(summary.knownCount), summary.knownFoot, '', 'wt-bento__span-3');

    const caption = `Report window = log minutes in the lookback period.${state.apiMode ? ' Online status updates with live polling.' : ''}`;

    const rows = renderSessionRosterRows(filter);

    const emptyHint = !summary.players.length
      ? `<p class="wt-empty session-empty">No player roster yet. Live polling lists online players; run a health report for playtime, peaks, and window stats.</p>`
      : '';

    const vitalsRange = typeof ChartWindow !== 'undefined'
      ? `<div class="wt-bento__span-12 wt-live-toolbar"><div class="wt-live-toolbar__controls">${ChartWindow.vitalsSelectHtml('Players chart', maxRetention)}</div></div>`
      : '';

    const kpiGrid = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.statGrid([
        TowerTabChrome.statCard({ id: 'session-online', tone: 'live', icon: 'users', label: 'Online', value: String(summary.onlineCount), hint: summary.onlineFoot }),
        TowerTabChrome.statCard({ id: 'session-peak', tone: 'report', icon: 'trending-up', label: 'Peak concurrent', value: summary.peak != null ? String(summary.peak) : '—', hint: 'Report window high' }),
        TowerTabChrome.statCard({ id: 'session-unique', tone: 'report', icon: 'user-check', label: 'Unique players', value: summary.unique != null ? String(summary.unique) : '—', hint: summary.windowFoot }),
        TowerTabChrome.statCard({ id: 'session-known', tone: 'neutral', icon: 'contact', label: 'Known players', value: String(summary.knownCount), hint: summary.knownFoot }),
      ].join(''))
      : `${kpiOnline}${kpiPeak}${kpiUnique}${kpiKnown}`;

    return `
      <div class="wt-tab-session">
        <div class="wt-bento wt-stagger">
          ${typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('session') : ''}
          ${kpiGrid}
          <div class="wt-card wt-card--surface wt-bento__span-6 wt-session-spark-card">
            <div class="wt-card__head"><h3 class="wt-card__title"><i data-lucide="users" width="16" height="16"></i> Players online (24h)</h3></div>
            <div class="wt-chart-wrap wt-session-spark-wrap"><canvas id="session-players-spark"></canvas></div>
          </div>
          ${renderRecentSessionsCard(summary.sessions)}
          ${renderTopActiveSidebar(summary.players)}
          ${vitalsRange}
          <div class="wt-bento__span-12 wt-live-toolbar session-filter-row">
            <div class="wt-live-toolbar__controls">
              <div class="wt-segment">${renderSessionFilter(filter)}</div>
              <input type="search" class="wt-input wt-session-search" id="session-search" placeholder="Search player or UUID" value="${escAttr(state.sessionSearch || '')}" aria-label="Search players">
              <label class="wt-session-sort-label">Sort
                <select id="session-sort" aria-label="Sort roster">
                  <option value="name"${state.sessionSort === 'name' ? ' selected' : ''}>Name</option>
                  <option value="playtime"${state.sessionSort === 'playtime' ? ' selected' : ''}>Playtime</option>
                  <option value="window"${state.sessionSort === 'window' ? ' selected' : ''}>Report window</option>
                  <option value="ping"${state.sessionSort === 'ping' ? ' selected' : ''}>Ping</option>
                </select>
              </label>
            </div>
          </div>
          <div class="wt-card wt-card--surface wt-bento__span-12 wt-session-roster wt-scroll-reveal">
            <div class="wt-card__head">
              <h3 class="wt-card__title"><i data-lucide="users" width="16" height="16"></i> Player roster</h3>
            </div>
            <p class="wt-card__lead text-caption">${caption}</p>
            ${emptyHint}
            <div class="wt-table-wrap">
              <table class="wt-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Player</th>
                    <th>Total playtime</th>
                    <th>Report window</th>
                    <th>Ping</th>
                    <th>Dimension</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="session-roster-tbody">${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }

  return {
    renderSession,
    renderSessionRosterRows,
    applySessionRosterUpdate,
    refreshRosterDom,
    sessionPlayersEnriched,
    sessionSummary,
    windowMinutesByPlayer,
  };
})();
