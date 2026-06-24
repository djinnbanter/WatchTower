/**
 * Watchtower UI v3 — Spark profiler report tab
 */
const TowerRenderSpark = (function () {
  const esc = TowerRenderShared.esc;
  const fmtRelative = TowerRenderShared.fmtRelative;
  const fmtTime = TowerRenderShared.fmtTime;
  const fmtTimeShort = TowerRenderShared.fmtTimeShort;
  const kpiCard = TowerRenderShared.kpiCard;

  const SPARK_WORKFLOW_SEEN_KEY = 'wt-spark-workflow-seen';

  function workflowPanelOpen() {
    try {
      return !localStorage.getItem(SPARK_WORKFLOW_SEEN_KEY);
    } catch (_) {
      return true;
    }
  }

  function markWorkflowSeen() {
    try {
      localStorage.setItem(SPARK_WORKFLOW_SEEN_KEY, '1');
    } catch (_) { /* ignore */ }
  }

  function getProfile() {
    return state.sparkActiveProfile
      ?? state.activeFacts?.optional?.spark_profile
      ?? null;
  }

  function sparkViewKey() {
    return `${SPARK_VIEW_KEY}:${state.liveConfig?.hostname || state.activeFacts?.meta?.hostname || 'default'}`;
  }

  function sparkView() {
    return state.sparkView || 'summary';
  }

  function loadPersistedSparkView() {
    try {
      const saved = localStorage.getItem(sparkViewKey());
      if (saved && SPARK_VIEWS.some((v) => v.id === saved)) return saved;
    } catch (_) { /* ignore */ }
    return 'summary';
  }

  function persistSparkView(view) {
    try {
      localStorage.setItem(sparkViewKey(), view);
    } catch (_) { /* ignore */ }
  }

  const SPARK_VIEWS = [
    { id: 'summary', label: 'Summary', icon: 'clipboard-list' },
    { id: 'mods', label: 'Mods & code', icon: 'package' },
    { id: 'world', label: 'World', icon: 'layers' },
    { id: 'capture', label: 'Capture window', icon: 'activity' },
    { id: 'advanced', label: 'Advanced', icon: 'microscope' },
  ];

  function sparkViewBadgeCounts(profile) {
    const ctx = profile?.context || {};
    const findings = profile?.key_findings?.length || 0;
    const recs = profile?.recommendations?.length || 0;
    const worldSignals = (ctx.top_entities?.length || 0) + (ctx.entity_hotspots?.length || 0);
    return {
      summary: findings + recs,
      mods: profile?.mod_hints?.length || 0,
      world: worldSignals,
      capture: profile?.timeline?.length || 0,
      advanced: 0,
    };
  }

  function renderSparkSubnav(profile) {
    if (!profile) return '';
    const view = sparkView();
    const counts = sparkViewBadgeCounts(profile);
    const buttons = SPARK_VIEWS.map(({ id, label, icon }) => {
      const n = counts[id] || 0;
      const badge = n ? `<span class="wt-mods-subnav__badge">${n}</span>` : '';
      const active = view === id ? ' active' : '';
      return `<button type="button" class="wt-mods-subnav__btn${active}" data-spark-view="${id}">
        <i data-lucide="${icon}" width="14" height="14" aria-hidden="true"></i>
        <span>${esc(label)}</span>${badge}
      </button>`;
    }).join('');
    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-spark-subnav-wrap" id="spark-subnav-wrap">
        <nav class="wt-mods-subnav" id="spark-subnav" aria-label="Spark report sections">${buttons}</nav>
      </div>`;
  }

  function syncSparkSubnav() {
    const subnav = document.getElementById('spark-subnav');
    const profile = getProfile();
    if (!subnav || !profile) return;
    const counts = sparkViewBadgeCounts(profile);
    const view = sparkView();
    subnav.querySelectorAll('[data-spark-view]').forEach((btn) => {
      const id = btn.dataset.sparkView;
      btn.classList.toggle('active', id === view);
      const n = counts[id] || 0;
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

  function sparkHostnameKey() {
    const host = state.liveConfig?.hostname || state.activeFacts?.meta?.hostname || 'default';
    return `${SPARK_SELECTED_KEY}:${host}`;
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${n} B`;
  }

  function formatProfileOptionLabel(entry) {
    const when = entry.captured_at ? fmtTime(entry.captured_at) : 'Unknown time';
    const fresh = entry.fresh ? ' · fresh' : '';
    const size = entry.size_bytes != null ? ` · ${formatBytes(entry.size_bytes)}` : '';
    return `${when} · ${entry.source_file || entry.source_path}${size}${fresh}`;
  }

  function copySparkCommand(text) {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text)
      .then(() => { if (typeof showToast === 'function') showToast('Copied to clipboard', 'success'); })
      .catch(() => {});
  }

  function renderWorkflowPanel() {
    const count = state.sparkProfilesList?.length || 0;
    const hasProfile = !!getProfile();
    const step1Done = count > 0;
    const step2Done = !!state.sparkSelectedPath;
    const step3Done = hasProfile;
    const searchDirs = (state.sparkSearchDirs || []).map((d) => `<code>${esc(d)}</code>`).join(', ') || '<code>watchtower/spark-upload/</code>, <code>config/spark/</code>';
    const pickStatus = count
      ? `${count} profile${count === 1 ? '' : 's'} found on server`
      : 'No profiles yet — complete step 1';
    const viewStatus = hasProfile
      ? `Showing ${esc(getProfile()?.source_file || 'profile')}`
      : 'Select a profile from the dropdown below';
    const pill = (done) => `<span class="wt-spark-step-pill wt-spark-step-pill--${done ? 'done' : 'pending'}">${done ? 'Done' : 'Pending'}</span>`;

    return `
      <details class="wt-card wt-card--surface wt-bento__span-12 wt-spark-workflow-card"${workflowPanelOpen() ? ' open' : ''}>
        <summary class="wt-spark-workflow-card__summary">
          <h2 class="wt-card__title"><i data-lucide="route" width="16" height="16"></i> How to use Spark</h2>
          <span class="text-caption">Capture → pick profile → read advice (no full report required)</span>
        </summary>
        <div class="wt-spark-workflow-steps">
          <article class="wt-spark-workflow-step">
            <div class="wt-spark-workflow-step__head">${pill(step1Done)}<strong>1. Capture while lagging</strong></div>
            <p class="text-caption">Spark saves to <code>config/spark/</code> automatically.</p>
            <div class="wt-spark-cmd-row">
              <code>/spark profiler start</code>
              <button type="button" class="wt-btn wt-btn--ghost wt-btn--xs wt-spark-copy-cmd" data-cmd="/spark profiler start">Copy</button>
            </div>
            <p class="text-caption">Wait 30–60 seconds while the server is under load.</p>
            <div class="wt-spark-cmd-row">
              <code>/spark profiler stop --save-to-file</code>
              <button type="button" class="wt-btn wt-btn--ghost wt-btn--xs wt-spark-copy-cmd" data-cmd="/spark profiler stop --save-to-file">Copy</button>
            </div>
          </article>
          <article class="wt-spark-workflow-step">
            <div class="wt-spark-workflow-step__head">${pill(step2Done)}<strong>2. Pick a profile</strong></div>
            <p class="text-caption">${esc(pickStatus)}. Watchtower scans ${searchDirs}.</p>
          </article>
          <article class="wt-spark-workflow-step">
            <div class="wt-spark-workflow-step__head">${pill(step3Done)}<strong>3. View results</strong></div>
            <p class="text-caption">${viewStatus} — breakdown loads here without running a full report.</p>
          </article>
          <article class="wt-spark-workflow-step wt-spark-workflow-step--optional">
            <div class="wt-spark-workflow-step__head"><span class="wt-spark-step-pill wt-spark-step-pill--optional">Optional</span><strong>Run full report</strong></div>
            <p class="text-caption">Adds Spark summary to Overview and <code>brief.txt</code>.</p>
            <button type="button" class="wt-btn wt-btn--outline wt-btn--sm" id="spark-run-report-btn">Run report</button>
          </article>
        </div>
      </details>`;
  }

  function renderProfileToolbar() {
    const profiles = state.sparkProfilesList || [];
    const selected = state.sparkSelectedPath || '';
    const options = profiles.map((p) => {
      const path = p.source_path || '';
      const sel = path === selected ? ' selected' : '';
      return `<option value="${esc(path)}"${sel}>${esc(formatProfileOptionLabel(p))}</option>`;
    }).join('');
    const disabled = state.sparkProfilesLoading ? ' disabled' : '';
    const loadingCls = state.sparkProfileLoading ? ' wt-spark-profile-toolbar--loading' : '';
    return `
      <div class="wt-spark-profile-toolbar${loadingCls}">
        <label class="wt-spark-profile-toolbar__label" for="spark-profile-select">Profile</label>
        <select id="spark-profile-select" class="wt-rail__select wt-spark-profile-select" aria-label="Spark profile"${disabled}>
          <option value="">— Select a profile —</option>
          ${options}
        </select>
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="spark-refresh-profiles-btn"${disabled}>Refresh</button>
      </div>`;
  }

  function renderSparkEmptyBody() {
    const dirs = (state.sparkSearchDirs || []).map((d) => `<code>${esc(d)}</code>`).join(', ') || '<code>watchtower/spark-upload/</code>, <code>config/spark/</code>';
    const err = state.sparkProfileError
      ? `<div class="wt-banner wt-banner--warn wt-bento__span-12">${esc(state.sparkProfileError)}</div>`
      : '';
    const disabledBanner = state.sparkEnabled === false
      ? '<div class="wt-banner wt-banner--info wt-bento__span-12">Spark ingest is disabled in <code>watchtower.conf</code> (<code>SPARK_ENABLED=false</code>).</div>'
      : '';
    return `
      ${disabledBanner}
      ${err}
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-empty">
        <h2 class="wt-card__title">${state.sparkProfilesList?.length ? 'Select a profile above' : 'No .sparkprofile files found yet'}</h2>
        <p class="text-caption">Watchtower looks in ${dirs}. Capture a profile with Spark while the server is lagging, then click <strong>Refresh</strong>.</p>
        <div class="wt-spark-empty__actions">
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="spark-help-btn">Open Help</button>
        </div>
      </section>`;
  }

  function renderSparkLoadingBody() {
    return `
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-loading">
        <p class="wt-empty">Loading Spark profile…</p>
      </section>`;
  }

  function gradeMod(grade) {
    if (grade === 'critical') return 'critical';
    if (grade === 'degraded') return 'warn';
    return 'ok';
  }

  function severityBorderClass(grade) {
    const mod = gradeMod(grade);
    if (mod === 'critical') return 'wt-card--severity-critical';
    if (mod === 'warn') return 'wt-card--severity-warn';
    return 'wt-card--severity-ok';
  }

  function severityPill(sev) {
    if (sev === 'critical') return 'wt-status-pill--critical';
    if (sev === 'warn') return 'wt-status-pill--warn';
    return 'wt-status-pill--healthy';
  }

  function parseIso(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function minutesApart(a, b) {
    if (!a || !b) return null;
    return Math.abs(a.getTime() - b.getTime()) / 60000;
  }

  function tableWrap(tableHtml) {
    return `<div class="wt-table-wrap wt-spark-table-wrap">${tableHtml}</div>`;
  }

  function renderSparkHero(profile) {
    const captured = profile?.captured_at ? fmtRelative(profile.captured_at) : 'Pick a profile';
    const lead = profile
      ? `Captured ${captured} · ${profile.source_file || 'spark profile'}`
      : 'Pick a saved Spark profile to view lag advice';
    const viewerLink = profile?.spark_viewer_url
      ? `<a href="${esc(profile.spark_viewer_url)}" target="_blank" rel="noopener noreferrer" class="wt-btn wt-btn--ghost wt-btn--sm">Open in Spark viewer</a>`
      : '';
    const rawLink = profile?.spark_raw_url
      ? `<a href="${esc(profile.spark_raw_url)}" target="_blank" rel="noopener noreferrer" class="wt-btn wt-btn--ghost wt-btn--sm">Raw JSON</a>`
      : '';
    const toolbar = renderProfileToolbar();
    const actions = `${toolbar}${viewerLink}${rawLink}`;
    if (typeof TowerTabChrome !== 'undefined') {
      return TowerTabChrome.tabHero('spark', {
        title: 'Spark profiler report',
        lead,
        actions,
      });
    }
    return `
      <header class="wt-bento__span-12 wt-spark-header">
        <div class="wt-spark-header__row">
          <div>
            <h1 class="wt-panel__title"><i data-lucide="flame" width="20" height="20"></i> Spark profiler report</h1>
            <p class="wt-card__lead">${esc(lead)}</p>
          </div>
          <div class="wt-spark-header__actions">${actions}</div>
        </div>
      </header>`;
  }

  function sparkModLabel(modId, profile) {
    if (!modId) return '?';
    const catalog = profile?.mod_catalog?.[modId];
    if (catalog?.name) {
      return catalog.version ? `${catalog.name} ${catalog.version}` : catalog.name;
    }
    const rollup = profile?.mod_rollups?.find((r) => r.mod_id === modId);
    if (rollup?.display_name) return rollup.display_name;
    const hint = profile?.mod_hints?.find((h) => h.mod_id === modId);
    if (hint?.display_name) return hint.display_name;
    return Labels.modFriendlyName(modId);
  }

  function renderModBars(rollups, profile) {
    if (!rollups?.length) {
      return '<p class="wt-empty">No mod attribution from stack tree</p>';
    }
    const max = Math.max(...rollups.map((r) => r.pct || 0), 1);
    return rollups.map((r) => {
      const pct = Number(r.pct || 0);
      const width = Math.min(100, Math.round((pct / max) * 100));
      const modLink = r.mod_id
        ? `<a href="#" class="tab-link" data-tab="mods">${esc(sparkModLabel(r.mod_id, profile))}</a>`
        : esc(r.mod_id || '?');
      return `
        <div class="wt-spark-mod-row">
          <div class="wt-spark-mod-row__label">${modLink} <span class="text-caption">${esc(r.top_label || '')}</span></div>
          <div class="wt-spark-mod-row__bar-wrap">
            <div class="wt-spark-mod-row__bar" style="width:${width}%"></div>
          </div>
          <div class="wt-spark-mod-row__pct">${pct.toFixed(1)}%</div>
        </div>`;
    }).join('');
  }

  function renderMethodsTable(methods, { expandable = false, tableId = '' } = {}, profile = null) {
    if (!methods?.length) {
      return '<p class="wt-empty">No hot methods parsed</p>';
    }
    const rows = methods.map((m, i) => {
      const chain = m.parent_chain?.length
        ? `<div class="wt-spark-method-chain text-caption">${esc(m.parent_chain.join(' → '))}</div>`
        : '';
      const sourceLine = (m.source || m.line != null)
        ? `<div class="mono-cell text-caption wt-spark-method-source">${esc(m.source || '')}${m.line != null ? `:${m.line}` : ''}</div>`
        : '';
      const detail = expandable
        ? `<tr class="wt-spark-method-detail" data-method-detail="${i}" hidden>
            <td colspan="3">
              <div class="mono-cell wt-spark-method-detail__sig">${esc(`${m.class}.${m.method}`)}</div>
              ${sourceLine}
              ${chain}
            </td>
          </tr>`
        : '';
      const expandBtn = expandable
        ? `<button type="button" class="wt-spark-method-expand" data-method-expand="${i}" aria-expanded="false" title="Show full signature"><i data-lucide="chevron-right" width="14" height="14"></i></button>`
        : '';
      return `
        <tr class="wt-spark-method-row" data-method-row="${i}">
          <td class="wt-spark-pct">${Number(m.pct).toFixed(1)}%</td>
          <td><a href="#" class="tab-link" data-tab="mods">${esc(sparkModLabel(m.mod_id, profile))}</a></td>
          <td class="mono-cell wt-spark-method-label">${expandBtn}${esc(m.label || `${m.class}.${m.method}`)}</td>
        </tr>${detail}`;
    }).join('');
    const sortable = expandable ? ' wt-spark-methods--sortable' : '';
    const idAttr = tableId ? ` id="${tableId}"` : '';
    const table = `
      <table class="wt-table wt-spark-methods${sortable}"${idAttr}>
        <thead><tr>
          <th class="wt-spark-sort" data-sort="pct" aria-sort="descending">%</th>
          <th class="wt-spark-sort" data-sort="mod">Mod</th>
          <th class="wt-spark-sort" data-sort="method">Method</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    return tableWrap(table);
  }

  function renderEntities(entities, tileEntities, hotspots) {
    const parts = [];
    if (tileEntities != null) {
      parts.push(`<p class="text-caption wt-spark-tile-entities">Tile entities at capture: <strong>${esc(String(tileEntities))}</strong></p>`);
    }
    if (hotspots?.length) {
      const rows = hotspots.map((h) => `
        <tr>
          <td class="mono-cell">${esc(h.dimension || '—')}</td>
          <td class="mono-cell">${esc(String(h.chunk_x))}, ${esc(String(h.chunk_z))}</td>
          <td><strong>${esc(String(h.total_entities))}</strong></td>
          <td class="mono-cell">${h.top_type ? `${esc(h.top_type)} (${esc(String(h.top_count))})` : '—'}</td>
        </tr>`).join('');
      parts.push(`
        <h3 class="wt-card__subtitle">Hot chunks at capture</h3>
        ${tableWrap(`<table class="wt-table wt-spark-hotspots">
          <thead><tr><th>Dimension</th><th>Chunk</th><th>Entities</th><th>Dominant type</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`)}`);
    }
    if (!entities?.length && !hotspots?.length) {
      parts.push('<p class="wt-empty">No entity breakdown in profile metadata</p>');
      return parts.join('');
    }
    if (entities?.length) {
      parts.push(`<h3 class="wt-card__subtitle">Top entity types</h3>`);
      parts.push(`<ul class="wt-spark-entity-list">${entities.map((e) =>
        `<li><span class="mono-cell">${esc(e.id)}</span> <strong>${esc(String(e.count))}</strong></li>`).join('')}</ul>`);
    }
    return parts.join('');
  }

  function renderFindings(findings) {
    if (!findings?.length) return '';
    return findings.map((f) => `
      <div class="wt-spark-finding wt-spark-finding--${esc(f.severity || 'info')}">
        <span class="wt-spark-finding__accent wt-spark-finding__accent--${esc(f.severity || 'info')}" aria-hidden="true"></span>
        <div class="wt-spark-finding__body">
          <span class="wt-status-pill ${severityPill(f.severity)}">${esc(f.severity || 'info')}</span>
          <strong>${esc(f.title)}</strong>
          <p>${esc(f.detail)}</p>
        </div>
      </div>`).join('');
  }

  function isAllocationProfile(profile) {
    return profile?.mode === 'allocation';
  }

  function renderRecommendations(recs, profile) {
    if (!recs?.length) return '<p class="wt-empty">No recommendations</p>';
    return recs.map((r) => {
      const actions = (r.actions || []).map((a) => `<li>${esc(a)}</li>`).join('');
      const modLink = r.mod_id
        ? `<p class="text-caption"><a href="#" class="tab-link" data-tab="mods">${esc(sparkModLabel(r.mod_id, profile))} mod →</a></p>`
        : '';
      const logLink = r.linked_mod_rec
        ? '<p class="text-caption">Also flagged in server logs</p>'
        : '';
      return `
        <article class="wt-spark-rec wt-spark-rec--${esc(r.severity || 'info')}">
          <span class="wt-spark-rec__accent wt-spark-rec__accent--${esc(r.severity || 'info')}" aria-hidden="true"></span>
          <h3 class="wt-spark-rec__title">${esc(r.title)}</h3>
          <p>${esc(r.detail)}</p>
          ${actions ? `<ol class="wt-spark-rec__actions">${actions}</ol>` : ''}
          ${logLink}
          ${modLink}
        </article>`;
    }).join('');
  }

  function collectCorrelatedIncidents(profile) {
    const captured = parseIso(profile.captured_at);
    const optional = state.activeFacts?.optional || {};
    const entries = [];
    const lag = optional.lag_incidents?.entries;
    if (Array.isArray(lag)) {
      lag.forEach((e) => entries.push({ source: 'lag', entry: e, time: parseIso(e.time) }));
    }
    const recent = optional.recent_incidents;
    if (Array.isArray(recent)) {
      recent.forEach((e) => entries.push({ source: 'recent', entry: e, time: parseIso(e.pinned_at || e.time) }));
    }
    return entries
      .filter((row) => {
        const diff = minutesApart(captured, row.time);
        return diff == null || diff <= 5;
      })
      .sort((a, b) => {
        const da = minutesApart(captured, a.time) ?? 999;
        const db = minutesApart(captured, b.time) ?? 999;
        return da - db;
      })
      .slice(0, 3);
  }

  function renderModHints(hints, profile) {
    if (!hints?.length) return '';
    const allocation = isAllocationProfile(profile);
    const shareLabel = allocation ? 'allocation share' : 'Server thread';
    const items = hints.map((h) => `
      <li class="wt-spark-mod-hint">
        <div class="wt-spark-mod-hint__head">
          <a href="#" class="tab-link" data-tab="mods">${esc(sparkModLabel(h.mod_id, profile))}</a>
          ${h.pct != null ? `<span class="wt-spark-mod-hint__pct">~${Number(h.pct).toFixed(0)}% ${shareLabel}</span>` : ''}
        </div>
        ${h.summary ? `<p class="text-caption">${esc(h.summary)}</p>` : ''}
      </li>`).join('');
    return `
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-section">
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="radar" width="16" height="16"></i> Mod signals</h2>
        </div>
        <p class="text-caption">Stack and entity attribution from the capture</p>
        <ul class="wt-spark-mod-hints">${items}</ul>
      </section>`;
  }

  function renderCorrelationCards(profile) {
    const correlated = collectCorrelatedIncidents(profile);
    const cards = [];

    correlated.forEach((row) => {
      const e = row.entry;
      const diff = minutesApart(parseIso(profile.captured_at), row.time);
      const when = diff != null ? `${Math.round(diff)} min ${row.time && parseIso(profile.captured_at) > row.time ? 'after' : 'before'} capture` : 'near capture';
      const mspt = e.metrics?.mspt ?? e.mspt;
      const tps = e.metrics?.tps ?? e.tps;
      const title = e.title || `Lag incident ${when}`;
      const detail = e.narrative || e.summary || '';
      cards.push(`
        <article class="wt-spark-correlation">
          <h3 class="wt-spark-correlation__title"><i data-lucide="link" width="14" height="14"></i> ${esc(title)}</h3>
          <p class="text-caption">${esc(when)}${mspt != null ? ` · MSPT ${Number(mspt).toFixed(0)}ms` : ''}${tps != null ? ` · TPS ${Number(tps).toFixed(1)}` : ''}</p>
          ${detail ? `<p>${esc(detail)}</p>` : ''}
          <p class="text-caption"><a href="#" class="tab-link" data-tab="issues">Open Issues investigation →</a></p>
        </article>`);
    });

    if (!cards.length) return '';
    return `
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-section">
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="git-branch" width="16" height="16"></i> Related context</h2>
        </div>
        <div class="wt-spark-correlations-grid">${cards.join('')}</div>
      </section>`;
  }

  function findPriorSparkProfile(profile) {
    const captured = parseIso(profile.captured_at);
    const currentId = state.activeReportId;
    let best = null;
    Object.entries(state.reportCache || {}).forEach(([id, entry]) => {
      if (id === currentId || id === 'latest') return;
      const prior = entry?.facts?.optional?.spark_profile;
      if (!prior?.captured_at) return;
      const priorAt = parseIso(prior.captured_at);
      if (!priorAt || (captured && priorAt >= captured)) return;
      if (!best || priorAt > parseIso(best.profile.captured_at)) {
        best = { id, profile: prior, capturedAt: priorAt };
      }
    });
    return best;
  }

  function renderCompareCard(profile) {
    const prior = findPriorSparkProfile(profile);
    if (!prior) return '';
    const currentMods = new Map((profile.mod_rollups || []).map((r) => [r.mod_id, Number(r.pct || 0)]));
    const deltas = (prior.profile.mod_rollups || [])
      .map((r) => {
        const before = Number(r.pct || 0);
        const after = currentMods.get(r.mod_id) ?? 0;
        return { mod_id: r.mod_id, before, after, delta: after - before };
      })
      .filter((d) => Math.abs(d.delta) >= 1)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
    const body = !deltas.length
      ? `<p class="text-caption">Previous capture ${esc(fmtRelative(prior.profile.captured_at))} — mod mix similar.</p>`
      : `<p class="text-caption">Previous capture ${esc(fmtRelative(prior.profile.captured_at))}</p>
         <ul class="wt-spark-compare-list">${deltas.map((d) => {
    const sign = d.delta > 0 ? '+' : '';
    const cls = d.delta > 0 ? 'wt-spark-delta--up' : 'wt-spark-delta--down';
    return `<li><a href="#" class="tab-link" data-tab="mods">${esc(sparkModLabel(d.mod_id, profile))}</a> ${d.before.toFixed(1)}% → ${d.after.toFixed(1)}% <span class="${cls}">(${sign}${d.delta.toFixed(1)}%)</span></li>`;
  }).join('')}</ul>`;
    return `
      <section class="wt-card wt-card--surface wt-spark-tech-card wt-bento__span-12">
        <h3 class="wt-card__title"><i data-lucide="git-compare" width="14" height="14"></i> Compared to prior report</h3>
        ${body}
      </section>`;
  }

  function renderTimelineTable(timeline) {
    if (!timeline?.length) return '<p class="wt-empty">No per-window timeline in this profile</p>';
    const hasCpu = timeline.some((w) => w.cpu_process != null);
    const hasTimes = timeline.some((w) => w.start_at || w.end_at);
    const rows = timeline.map((w) => `
      <tr>
        <td>${esc(String(w.window ?? '—'))}</td>
        <td>${w.tps != null ? Number(w.tps).toFixed(1) : '—'}</td>
        <td>${w.mspt_median != null ? Number(w.mspt_median).toFixed(0) : '—'}</td>
        <td>${w.mspt_max != null ? Number(w.mspt_max).toFixed(0) : '—'}</td>
        ${hasCpu ? `<td>${w.cpu_process != null ? Number(w.cpu_process).toFixed(0) : '—'}</td>` : ''}
        <td>${esc(String(w.players ?? '—'))}</td>
        <td>${esc(String(w.entities ?? '—'))}</td>
        <td>${esc(String(w.tile_entities ?? '—'))}</td>
        <td>${esc(String(w.chunks ?? '—'))}</td>
        ${hasTimes ? `<td class="mono-cell text-caption">${w.start_at ? esc(fmtTimeShort(w.start_at)) : '—'}${w.end_at ? ` → ${esc(fmtTimeShort(w.end_at))}` : ''}</td>` : ''}
      </tr>`).join('');
    const table = `
      <table class="wt-table wt-spark-timeline">
        <thead><tr>
          <th>Window</th><th>TPS</th><th>MSPT med</th><th>MSPT max</th>
          ${hasCpu ? '<th>CPU %</th>' : ''}
          <th>Players</th><th>Entities</th><th>Tile ent.</th><th>Chunks</th>
          ${hasTimes ? '<th>Time range</th>' : ''}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    return tableWrap(table);
  }

  function renderHostStats(system) {
    if (!system || (!system.cpu && !system.memory && !system.gc && !system.disk)) {
      return '<p class="wt-empty">No host statistics in profile metadata</p>';
    }
    const cpu = system.cpu || {};
    const mem = system.memory || {};
    const stats = [];
    if (cpu.process_1m != null) {
      stats.push({ label: 'Process CPU', value: Number(cpu.process_1m).toFixed(0), unit: '%', foot: '1m avg' });
    }
    if (cpu.system_1m != null) {
      stats.push({ label: 'System CPU', value: Number(cpu.system_1m).toFixed(0), unit: '%', foot: '1m avg' });
    }
    if (cpu.threads != null) {
      stats.push({ label: 'Host threads', value: String(cpu.threads), unit: '', foot: 'at capture' });
    }
    if (mem.physical_used_gb != null) {
      stats.push({
        label: 'Host RAM',
        value: Number(mem.physical_used_gb).toFixed(1),
        unit: 'GB',
        foot: mem.physical_total_gb != null ? `of ${Number(mem.physical_total_gb).toFixed(1)} GB` : 'used',
      });
    }
    if (system.disk?.used_pct != null) {
      stats.push({
        label: 'Disk use',
        value: Number(system.disk.used_pct).toFixed(0),
        unit: '%',
        foot: 'host volume',
      });
    }
    if (system.gc?.total_ms != null) {
      stats.push({ label: 'GC time', value: String(system.gc.total_ms), unit: 'ms', foot: 'total' });
    }
    let insight = '';
    if (system.disk?.used_pct != null && system.disk.used_pct >= 85) {
      insight = '<p class="wt-spark-host-insight wt-banner wt-banner--warn">Host disk was nearly full during capture — backups and world growth may be competing for space.</p>';
    } else if (cpu.system_1m != null && cpu.system_1m >= 90) {
      insight = '<p class="wt-spark-host-insight wt-banner wt-banner--warn">Host CPU was very high during capture — tick mods may not be the only bottleneck.</p>';
    } else if (cpu.process_1m != null && cpu.process_1m >= 85) {
      insight = '<p class="wt-spark-host-insight wt-banner wt-banner--info">JVM process CPU was elevated — check both mods and heap/GC pressure.</p>';
    }
    const grid = stats.length
      ? `<div class="wt-spark-stat-grid">${stats.map((s) => `
          <div class="wt-spark-stat">
            <span class="wt-spark-stat__label">${esc(s.label)}</span>
            <span class="wt-spark-stat__value">${esc(s.value)}<span class="wt-spark-stat__unit">${esc(s.unit)}</span></span>
            <span class="wt-spark-stat__foot">${esc(s.foot)}</span>
          </div>`).join('')}</div>`
      : '';
    return insight + grid;
  }

  function renderProfilerSettings(settings) {
    if (!settings) return '';
    const rows = [];
    if (settings.aggregator) rows.push(['Sampler', settings.aggregator]);
    if (settings.thread_filter && settings.thread_filter !== 'all') {
      let label = settings.thread_filter;
      if (settings.thread_pattern_count) label += ` (${settings.thread_pattern_count} patterns)`;
      if (settings.thread_id_count) label += ` (${settings.thread_id_count} threads)`;
      rows.push(['Thread filter', label]);
    }
    if (settings.async_engine) rows.push(['Async engine', 'yes']);
    if (!rows.length) return '';
    return `<dl class="wt-spark-dl wt-spark-dl--profiler">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join('')}</dl>`;
  }

  function renderExtendedTickHealth(ctx, capture) {
    const rows = [
      ['TPS 1m', ctx.tps_1m],
      ['TPS 5m', ctx.tps_5m],
      ['TPS 15m', ctx.tps_15m],
      ['MSPT p95 1m', ctx.mspt_p95_1m],
      ['MSPT p95 5m', ctx.mspt_p95_5m],
      ['MSPT median 1m', ctx.mspt_median_1m],
    ].filter(([, v]) => v != null);
    if (!rows.length && !capture?.creator && !capture?.comment && !capture?.profiler_settings) {
      return '<p class="wt-empty">No extended tick metrics</p>';
    }
    const metricDl = rows.length
      ? `<dl class="wt-spark-dl wt-spark-dl--metrics">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${typeof v === 'number' ? Number(v).toFixed(v < 20 ? 1 : 0) : esc(String(v))}</dd>`).join('')}</dl>`
      : '';
    const meta = [];
    if (capture?.creator) meta.push(`<dt>Captured by</dt><dd>${esc(capture.creator)}</dd>`);
    if (capture?.comment) meta.push(`<dt>Operator note</dt><dd>${esc(capture.comment)}</dd>`);
    const metaDl = meta.length ? `<dl class="wt-spark-dl">${meta.join('')}</dl>` : '';
    const profilerDl = renderProfilerSettings(capture?.profiler_settings);
    return metricDl + metaDl + profilerDl;
  }

  function renderOtherThreads(threads) {
    if (!threads?.length) return '';
    const rows = threads.map((t) => `
      <tr><td class="mono-cell">${esc(t.name)}</td><td>${Number(t.pct || 0).toFixed(1)}%</td><td>${esc(String(t.weight ?? '—'))}</td></tr>`).join('');
    const table = `
      <table class="wt-table wt-spark-threads">
        <thead><tr><th>Thread</th><th>%</th><th>Weight</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    return `
      <section class="wt-card wt-card--surface wt-spark-tech-card wt-bento__span-12">
        <h3 class="wt-card__title">Other threads (&gt;2% sample time)</h3>
        ${tableWrap(table)}
      </section>`;
  }

  function renderHeapSection(heap) {
    if (!heap) return '';
    const entries = (heap.top_entries || []).map((e) => `
      <tr>
        <td class="mono-cell">${esc(e.type)}</td>
        <td><a href="#" class="tab-link" data-tab="mods">${esc(Labels.modFriendlyName(e.mod_id || 'unknown'))}</a></td>
        <td>${esc(String(e.instances ?? '—'))}</td>
        <td>${e.size_mb != null ? Number(e.size_mb).toFixed(1) : '—'} MB</td>
      </tr>`).join('');
    const table = entries
      ? `<table class="wt-table wt-spark-heap">
          <thead><tr><th>Type</th><th>Mod</th><th>Instances</th><th>Size</th></tr></thead>
          <tbody>${entries}</tbody>
        </table>`
      : '';
    const heapViewer = heap.spark_viewer_url
      ? ` <a href="${esc(heap.spark_viewer_url)}" target="_blank" rel="noopener noreferrer" class="wt-btn wt-btn--ghost wt-btn--sm">Open in Spark viewer</a>`
      : '';
    return `
      <section class="wt-card wt-card--surface wt-spark-tech-card wt-bento__span-12">
        <h3 class="wt-card__title"><i data-lucide="memory-stick" width="14" height="14"></i> RAM during capture</h3>
        <p class="text-caption">From ${esc(heap.source_file || '.sparkheap')}${heap.total_mb != null ? ` · ${Number(heap.total_mb).toFixed(0)} MB attributed` : ''}${heapViewer}</p>
        ${table ? tableWrap(table) : '<p class="wt-empty">No heap entries parsed</p>'}
      </section>`;
  }

  function renderPerformanceOverlay() {
    const rollups = state.performanceRollups;
    if (!rollups?.enabled || !rollups.rows?.length) return '';
    return `
      <section class="wt-card wt-card--surface wt-spark-tech-card wt-bento__span-12 wt-spark-perf-overlay">
        <h3 class="wt-card__title"><i data-lucide="activity" width="14" height="14"></i> MSPT context (24h)</h3>
        <p class="text-caption">Capture time marked on server performance history</p>
        <div class="wt-chart-wrap wt-chart-wrap--sm"><canvas id="spark-perf-mspt"></canvas></div>
      </section>`;
  }

  function renderServerConfigurations(configs) {
    if (!configs || typeof configs !== 'object' || !Object.keys(configs).length) return '';
    const rows = Object.entries(configs).slice(0, 6).map(([k, v]) => {
      const val = String(v);
      const short = val.length > 120 ? `${val.slice(0, 117)}…` : val;
      return `<dt>${esc(k)}</dt><dd class="mono-cell wt-spark-config-val">${esc(short)}</dd>`;
    }).join('');
    return `
      <div class="wt-spark-server-configs">
        <h3 class="wt-card__subtitle">Server configuration snapshot</h3>
        <dl class="wt-spark-dl wt-spark-dl--configs">${rows}</dl>
      </div>`;
  }

  function renderSparkBanners(profile) {
    const fresh = profile.fresh !== false;
    const staleBanner = !fresh
      ? `<div class="wt-banner wt-banner--warn wt-bento__span-12">This profile is older than 24 hours — capture a new one while lagging for current advice.</div>`
      : '';
    const allocationBanner = isAllocationProfile(profile)
      ? `<div class="wt-banner wt-banner--info wt-bento__span-12 wt-spark-mode-banner">Allocation profile — percentages show memory allocation during the sample, not tick time. Capture an execution profile for tick diagnosis.</div>`
      : '';
    return `${staleBanner}${allocationBanner}`;
  }

  function renderCaptureMeta(profile) {
    const platform = profile.platform || {};
    return `
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-section wt-spark-meta">
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="info" width="16" height="16"></i> Capture details</h2>
        </div>
        <dl class="wt-spark-dl">
          <dt>Loader</dt><dd>${esc(platform.loader || '?')} ${esc(platform.loader_version || '')}</dd>
          <dt>Minecraft</dt><dd>${esc(platform.minecraft || '?')}</dd>
          <dt>Spark</dt><dd>${platform.spark_version != null ? `v${esc(String(platform.spark_version))}` : '—'}</dt>
          <dt>Engine</dt><dd>${esc(profile.engine || platform.engine || '?')} · ${esc(profile.mode || platform.mode || 'execution')}</dt>
          <dt>Threads analyzed</dt><dd>${profile.threads_analyzed?.length ? esc(profile.threads_analyzed.join(', ')) : '—'}</dt>
          <dt>Ticks sampled</dt><dd>${esc(String(profile.window?.ticks ?? '—'))}</dt>
          <dt>Source</dt><dd class="mono-cell">${esc(profile.source_path || profile.source_file || '—')}</dd>
          <dt>Captured</dt><dd>${profile.captured_at ? esc(fmtTime(profile.captured_at)) : '—'}</dd>
        </dl>
        ${renderProfilerSettings(profile.capture?.profiler_settings)}
        ${renderServerConfigurations(profile.capture?.server_configurations)}
      </section>`;
  }

  function renderSparkSummary(profile) {
    const verdict = profile.verdict || {};
    const ctx = profile.context || {};
    const grade = verdict.grade || 'healthy';
    const gradeCls = gradeMod(grade);
    const allocation = isAllocationProfile(profile);
    const kpiFoot = allocation ? 'Tick metrics at capture' : 'During capture';
    const heap = ctx.jvm_heap;
    const msptFoot = heap?.used_mb != null
      ? `${kpiFoot} · JVM ${Math.round(heap.used_mb)}${heap.max_mb ? `/${Math.round(heap.max_mb)}` : ''} MB`
      : kpiFoot;
    const tps = ctx.tps_1m != null ? Number(ctx.tps_1m).toFixed(1) : '—';
    const mspt = ctx.mspt_p95_1m != null ? Number(ctx.mspt_p95_1m).toFixed(0) : '—';
    const players = ctx.players != null ? String(ctx.players) : '—';
    const entities = ctx.world_entities != null ? String(ctx.world_entities) : '—';

    return `
      ${renderSparkBanners(profile)}
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-verdict wt-spark-verdict--${gradeCls} ${severityBorderClass(grade)}">
        <span class="wt-spark-verdict__accent" aria-hidden="true"></span>
        <div class="wt-spark-verdict__body">
          <span class="wt-status-pill wt-status-pill--${gradeCls === 'critical' ? 'critical' : gradeCls === 'warn' ? 'warn' : 'healthy'}">${esc(grade)}</span>
          <h2 class="wt-spark-verdict__headline">${esc(verdict.headline || 'Spark profiler capture')}</h2>
          <p class="wt-spark-verdict__summary">${esc(verdict.summary || '')}</p>
        </div>
      </section>
      ${kpiCard('spark-tps', 'TPS (1m)', `${tps}<span class="wt-kpi__unit">TPS</span>`, kpiFoot, '', 'wt-bento__span-3')}
      ${kpiCard('spark-mspt', 'MSPT p95', `${mspt}<span class="wt-kpi__unit">ms</span>`, msptFoot, '', 'wt-bento__span-3')}
      ${kpiCard('spark-players', 'Players', players, 'Online during sample', '', 'wt-bento__span-3')}
      ${kpiCard('spark-entities', 'Entities', entities, 'World total', '', 'wt-bento__span-3')}
      ${renderCorrelationCards(profile)}
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-section">
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="search" width="16" height="16"></i> Key findings</h2>
        </div>
        <div class="wt-spark-findings">${renderFindings(profile.key_findings) || '<p class="wt-empty">No findings</p>'}</div>
      </section>
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-section wt-spark-recs-card">
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="lightbulb" width="16" height="16"></i> Recommended actions</h2>
        </div>
        <div class="wt-spark-recs-grid">${renderRecommendations(profile.recommendations, profile)}</div>
      </section>`;
  }

  function renderSparkModsView(profile) {
    const allocation = isAllocationProfile(profile);
    const modSectionTitle = allocation ? 'Mod allocation share' : 'Mod tick usage';
    const modSectionHint = allocation
      ? '<p class="text-caption">Share of allocations attributed to each mod during the sample</p>'
      : '';
    const methodsTitle = allocation ? 'Hot allocation sites (Server thread)' : 'Hot methods (Server thread)';

    return `
      ${renderSparkBanners(profile)}
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-section">
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="package" width="16" height="16"></i> ${modSectionTitle}</h2>
        </div>
        ${modSectionHint}
        ${renderModBars(profile.mod_rollups, profile)}
      </section>
      ${renderModHints(profile.mod_hints, profile)}
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-section">
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="list-ordered" width="16" height="16"></i> ${methodsTitle}</h2>
        </div>
        ${renderMethodsTable(profile.top_methods, {}, profile)}
      </section>`;
  }

  function renderSparkWorldView(profile) {
    const ctx = profile.context || {};
    return `
      ${renderSparkBanners(profile)}
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-spark-section">
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="layers" width="16" height="16"></i> World pressure</h2>
        </div>
        ${renderEntities(ctx.top_entities, ctx.tile_entities, ctx.entity_hotspots)}
      </section>`;
  }

  function renderSparkCaptureView(profile) {
    const ctx = profile.context || {};
    return `
      ${renderSparkBanners(profile)}
      <section class="wt-card wt-card--surface wt-spark-tech-card wt-spark-tech-card--full wt-bento__span-12">
        <h3 class="wt-card__title">Capture timeline</h3>
        ${renderTimelineTable(profile.timeline)}
      </section>
      <div class="wt-spark-technical-grid wt-bento__span-12">
        <section class="wt-card wt-card--surface wt-spark-tech-card">
          <h3 class="wt-card__title">Host vs tick</h3>
          ${renderHostStats(profile.system)}
        </section>
        <section class="wt-card wt-card--surface wt-spark-tech-card">
          <h3 class="wt-card__title">Extended tick health</h3>
          ${renderExtendedTickHealth(ctx, profile.capture)}
        </section>
      </div>`;
  }

  function renderSparkAdvancedView(profile) {
    const deepMethods = profile.deep?.top_methods || profile.top_methods || [];
    const allocation = isAllocationProfile(profile);
    const deepMethodsTitle = allocation ? 'Hot allocation sites — extended (up to 30)' : 'Hot methods — extended (up to 30)';

    return `
      ${renderSparkBanners(profile)}
      ${renderPerformanceOverlay()}
      ${renderCompareCard(profile)}
      <section class="wt-card wt-card--surface wt-spark-tech-card wt-bento__span-12">
        <h3 class="wt-card__title">${deepMethodsTitle}</h3>
        ${renderMethodsTable(deepMethods, { expandable: true, tableId: 'spark-deep-methods' }, profile)}
      </section>
      ${renderOtherThreads(profile.threads_other)}
      ${renderHeapSection(profile.heap_summary)}
      ${renderCaptureMeta(profile)}`;
  }

  function renderSparkViewBody(profile) {
    switch (sparkView()) {
      case 'mods': return renderSparkModsView(profile);
      case 'world': return renderSparkWorldView(profile);
      case 'capture': return renderSparkCaptureView(profile);
      case 'advanced': return renderSparkAdvancedView(profile);
      default: return renderSparkSummary(profile);
    }
  }

  function renderSparkBody(profile) {
    if (!profile) return renderSparkEmptyBody();
    return `
      ${renderSparkSubnav(profile)}
      <div class="wt-spark-subpanel wt-bento__span-12">
        ${renderSparkViewBody(profile)}
      </div>`;
  }

  function renderSparkReportBody() {
    if (state.sparkProfileLoading) return renderSparkLoadingBody();
    return renderSparkBody(getProfile());
  }

  function renderSpark() {
    const profile = getProfile();
    return `
      <div class="wt-tab-spark">
        <div class="wt-bento wt-stagger">
          ${renderWorkflowPanel()}
          ${renderSparkHero(profile)}
          <div id="spark-report-body" class="wt-spark-report-body">
            ${renderSparkReportBody()}
          </div>
        </div>
      </div>`;
  }

  function bindSparkChromeControls() {
    document.querySelectorAll('#spark-run-report-btn').forEach((btn) => {
      if (btn.dataset.sparkBound) return;
      btn.dataset.sparkBound = '1';
      btn.addEventListener('click', () => {
        document.getElementById('overview-run-report-btn')?.click()
          || document.getElementById('rail-run-report-btn')?.click();
      });
    });
    document.querySelectorAll('.wt-spark-copy-cmd').forEach((btn) => {
      if (btn.dataset.sparkBound) return;
      btn.dataset.sparkBound = '1';
      btn.addEventListener('click', () => copySparkCommand(btn.dataset.cmd));
    });
    const select = document.getElementById('spark-profile-select');
    if (select && !select.dataset.sparkBound) {
      select.dataset.sparkBound = '1';
      select.addEventListener('change', () => {
        loadSparkProfile(select.value || null);
      });
    }
    const refreshBtn = document.getElementById('spark-refresh-profiles-btn');
    if (refreshBtn && !refreshBtn.dataset.sparkBound) {
      refreshBtn.dataset.sparkBound = '1';
      refreshBtn.addEventListener('click', async () => {
        const current = state.sparkSelectedPath;
        await loadSparkProfiles({ autoLoad: false });
        refreshSparkChrome();
        const sel = document.getElementById('spark-profile-select');
        if (current && state.sparkProfilesList.some((p) => p.source_path === current)) {
          if (sel) sel.value = current;
        } else {
          const next = resolveDefaultSparkPath(state.sparkProfilesList, state.sparkReportProfilePath);
          if (next) await loadSparkProfile(next);
          else refreshSparkReportBody();
        }
      });
    }
  }

  function refreshSparkChrome() {
    const workflow = document.querySelector('.wt-spark-workflow-card');
    if (workflow) {
      const html = renderWorkflowPanel();
      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();
      workflow.replaceWith(tmp.firstElementChild);
    }
    const hero = document.querySelector('.wt-tab-spark .wt-hero-card, .wt-tab-spark .wt-spark-header');
    if (hero) {
      const html = renderSparkHero(getProfile());
      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();
      hero.replaceWith(tmp.firstElementChild);
    }
    bindSparkChromeControls();
    syncSparkSubnav();
    const select = document.getElementById('spark-profile-select');
    if (select) select.value = state.sparkSelectedPath || '';
  }

  function revealSparkReportSections() {
    const root = document.querySelector('.wt-tab-spark');
    const body = document.getElementById('spark-report-body');
    if (body) {
      body.querySelectorAll('.wt-scroll-reveal').forEach((el) => {
        el.classList.add('is-visible');
        el.dataset.motionRevealed = '1';
      });
    }
    if (root && typeof TowerMotion !== 'undefined') {
      TowerMotion.scrollReveal(root, '.wt-scroll-reveal');
    }
    if (state.activeTab === 'spark' && typeof TowerTabMotion !== 'undefined') {
      TowerTabMotion.resetIntro('spark');
    }
    const profile = getProfile();
    const ctx = profile?.context || {};
    if (profile && sparkView() === 'summary' && typeof TowerMotion !== 'undefined') {
      const M = TowerMotion;
      const animate = (id, value, opts) => {
        const el = document.getElementById(`${id}-val`);
        if (el) M.animateKpiHtml(`${id}-val`, value, { duration: 800, ...opts });
      };
      animate('spark-tps', Number(ctx.tps_1m) || 0, { decimals: 1, unit: 'TPS' });
      animate('spark-mspt', Number(ctx.mspt_p95_1m) || 0, { decimals: 0, unit: 'ms' });
      animate('spark-players', Number(ctx.players) || 0);
      animate('spark-entities', Number(ctx.world_entities) || 0);
    }
  }

  function initSparkViewWidgets() {
    if (sparkView() === 'advanced') {
      bindMethodTableInteractions();
      initSparkPerformanceChart();
    }
  }

  function bindSparkSubnav() {
    const subnav = document.getElementById('spark-subnav');
    if (!subnav) return;
    subnav.querySelectorAll('[data-spark-view]').forEach((btn) => {
      if (btn.dataset.sparkBound) return;
      btn.dataset.sparkBound = '1';
      btn.addEventListener('click', () => {
        const view = btn.dataset.sparkView;
        if (!view || view === sparkView()) return;
        state.sparkView = view;
        persistSparkView(view);
        refreshSparkReportBody();
      });
    });
  }

  function refreshSparkReportBody() {
    const body = document.getElementById('spark-report-body');
    if (!body) return;
    body.innerHTML = renderSparkReportBody();
    bindSparkSubnav();
    initSparkViewWidgets();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    revealSparkReportSections();
  }

  function resolveDefaultSparkPath(profiles, reportPath) {
    if (!profiles?.length) return null;
    const saved = localStorage.getItem(sparkHostnameKey());
    if (saved && profiles.some((p) => p.source_path === saved)) return saved;
    if (reportPath && profiles.some((p) => p.source_path === reportPath)) return reportPath;
    return profiles[0].source_path;
  }

  async function fetchSparkProfilesList() {
    if (state.apiMode && typeof WatchtowerApi !== 'undefined') {
      return WatchtowerApi.fetchSparkProfiles();
    }
    try {
      const r = await fetch('data/spark-profiles.json');
      if (r.ok) return r.json();
    } catch (_) { /* static fallback */ }
    const profile = state.activeFacts?.optional?.spark_profile;
    if (profile?.source_path) {
      return {
        profiles: [{
          source_path: profile.source_path,
          source_file: profile.source_file,
          source_kind: profile.source_kind || 'spark_upload',
          captured_at: profile.captured_at,
          mtime: profile.captured_at,
          size_bytes: 0,
          fresh: profile.fresh !== false,
        }],
        search_dirs: ['watchtower/spark-upload/', 'config/spark/'],
        report_profile_path: profile.source_path,
        spark_enabled: true,
      };
    }
    return { profiles: [], search_dirs: ['watchtower/spark-upload/', 'config/spark/'], spark_enabled: true };
  }

  let sparkProfileMocksCache = null;

  async function fetchSparkProfileMocks() {
    if (sparkProfileMocksCache) return sparkProfileMocksCache;
    try {
      const r = await fetch('data/spark-profile-mocks.json');
      sparkProfileMocksCache = r.ok ? await r.json() : { profiles: {} };
    } catch (_) {
      sparkProfileMocksCache = { profiles: {} };
    }
    return sparkProfileMocksCache;
  }

  async function fetchSparkProfileData(path) {
    if (state.apiMode && typeof WatchtowerApi !== 'undefined') {
      return WatchtowerApi.fetchSparkProfile(path);
    }
    const mocks = await fetchSparkProfileMocks();
    if (path && mocks.profiles?.[path]) {
      return { spark_profile: mocks.profiles[path] };
    }
    const profile = state.activeFacts?.optional?.spark_profile;
    if (profile && (profile.source_path === path || !path)) {
      return { spark_profile: profile };
    }
    throw new Error('profile_not_found');
  }

  async function loadSparkProfile(path, { persist = true } = {}) {
    if (!path) {
      state.sparkSelectedPath = null;
      state.sparkActiveProfile = null;
      state.sparkProfileError = null;
      refreshSparkReportBody();
      refreshSparkChrome();
      return;
    }
    state.sparkProfileLoading = true;
    state.sparkProfileError = null;
    refreshSparkReportBody();
    try {
      const data = await fetchSparkProfileData(path);
      state.sparkActiveProfile = data.spark_profile || null;
      state.sparkSelectedPath = path;
      if (persist) localStorage.setItem(sparkHostnameKey(), path);
      if (!state.sparkActiveProfile) throw new Error('profile_parse_failed');
      markWorkflowSeen();
    } catch (e) {
      state.sparkActiveProfile = null;
      state.sparkSelectedPath = path;
      state.sparkView = 'summary';
      persistSparkView('summary');
      state.sparkProfileError = 'Could not parse this profile — the file may be corrupt or unsupported.';
    } finally {
      state.sparkProfileLoading = false;
      refreshSparkReportBody();
      refreshSparkChrome();
    }
  }

  async function loadSparkProfiles({ autoLoad = true } = {}) {
    state.sparkProfilesLoading = true;
    state.sparkView = loadPersistedSparkView();
    refreshSparkChrome();
    try {
      const data = await fetchSparkProfilesList();
      state.sparkProfilesList = data.profiles || [];
      state.sparkSearchDirs = data.search_dirs || [];
      state.sparkReportProfilePath = data.report_profile_path || null;
      state.sparkEnabled = data.spark_enabled !== false;
      if (autoLoad) {
        const defaultPath = resolveDefaultSparkPath(state.sparkProfilesList, state.sparkReportProfilePath);
        if (defaultPath) {
          await loadSparkProfile(defaultPath, { persist: !localStorage.getItem(sparkHostnameKey()) });
        } else {
          state.sparkSelectedPath = null;
          state.sparkActiveProfile = null;
        }
      }
    } catch (_) {
      state.sparkProfilesList = [];
    } finally {
      state.sparkProfilesLoading = false;
      refreshSparkChrome();
      if (autoLoad) refreshSparkReportBody();
    }
  }

  async function loadProfilesAndRender() {
    await loadSparkProfiles({ autoLoad: true });
  }

  function bindMethodTableInteractions() {
    const table = document.getElementById('spark-deep-methods');
    if (!table || table.dataset.sparkBound) return;
    table.dataset.sparkBound = '1';

    table.querySelectorAll('.wt-spark-method-expand').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.methodExpand;
        const detail = table.querySelector(`[data-method-detail="${idx}"]`);
        if (!detail) return;
        const open = detail.hidden;
        detail.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.classList.toggle('wt-spark-method-expand--open', open);
      });
    });

    let sortKey = 'pct';
    let sortAsc = false;
    const sortTable = (key) => {
      if (sortKey === key) sortAsc = !sortAsc;
      else { sortKey = key; sortAsc = key !== 'pct'; }
      table.querySelectorAll('.wt-spark-sort').forEach((th) => {
        const active = th.dataset.sort === sortKey;
        th.classList.toggle('wt-spark-sort--active', active);
        th.setAttribute('aria-sort', active ? (sortAsc ? 'ascending' : 'descending') : 'none');
      });
      const tbody = table.querySelector('tbody');
      const rowPairs = [];
      tbody.querySelectorAll('.wt-spark-method-row').forEach((row) => {
        const idx = row.dataset.methodRow;
        const detail = tbody.querySelector(`[data-method-detail="${idx}"]`);
        rowPairs.push({ row, detail });
      });
      rowPairs.sort((a, b) => {
        const getVal = (el) => {
          if (key === 'pct') return Number(el.row.querySelector('.wt-spark-pct')?.textContent || 0);
          if (key === 'mod') return el.row.cells[1]?.textContent?.trim() || '';
          return el.row.cells[2]?.textContent?.trim() || '';
        };
        const av = getVal(a);
        const bv = getVal(b);
        if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
      rowPairs.forEach(({ row, detail }) => {
        tbody.appendChild(row);
        if (detail) tbody.appendChild(detail);
      });
    };

    table.querySelectorAll('.wt-spark-sort').forEach((th) => {
      th.addEventListener('click', () => sortTable(th.dataset.sort));
    });
    sortTable('pct');
  }

  function initSparkPerformanceChart() {
    if (typeof SparklineManager === 'undefined') return;
    const rollups = state.performanceRollups;
    const profile = getProfile();
    if (!rollups?.enabled || !rollups.rows?.length || !profile?.captured_at) return;
    const canvas = document.getElementById('spark-perf-mspt');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (wrap) {
      wrap.style.height = '100px';
      wrap.style.minHeight = '100px';
    }
    const colors = SparklineManager.colors();
    const msptSeries = rollups.rows.map((r) => ({ t: r.ts, v: r.mspt_avg ?? r.mspt_p95 ?? 0 }));
    SparklineManager.ensure('spark-perf-mspt', { color: colors.accent, yMax: 100, yMin: 0, unit: 'ms', metricKey: 'mspt' });
    SparklineManager.updateFromApiSeries('spark-perf-mspt', msptSeries, {
      yMax: 100, color: colors.accent, unit: 'ms', metricKey: 'mspt', windowMinutes: 24 * 60,
      markerAt: profile.captured_at,
    });
  }

  function bindSparkEvents() {
    document.getElementById('spark-help-btn')?.addEventListener('click', () => {
      window.openHelp?.();
    });
    bindSparkChromeControls();
    bindSparkSubnav();
    initSparkViewWidgets();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderSparkTeaser(facts) {
    const profile = facts?.optional?.spark_profile;
    if (!profile || profile.fresh === false) return '';
    const verdict = profile.verdict || {};
    const top = profile.mod_hints?.[0];
    const modLine = top
      ? `${sparkModLabel(top.mod_id, profile)} ~${Number(top.pct).toFixed(0)}% ${profile.mode === 'allocation' ? 'allocations' : 'Server thread'}`
      : (verdict.headline || 'Spark profile available');
    return `
      <div class="wt-meta-card wt-meta-card--spark">
        <h3 class="wt-panel__title"><i data-lucide="flame" width="14" height="14"></i> Spark profiler</h3>
        <p>${esc(modLine)}</p>
        <p class="text-caption"><a href="#" class="tab-link" data-tab="spark">Open Spark report →</a></p>
      </div>`;
  }

  return {
    renderSpark,
    bindSparkEvents,
    loadProfilesAndRender,
    renderSparkTeaser,
    initSparkPerformanceChart,
  };
})();
