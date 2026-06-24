/**
 * Watchtower UI v3 — boot, welcome, chrome, banners, nav
 */

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('is-open');
  el.classList.remove('is-hidden', 'hidden');
  el.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
}

function setBootMessage(msg) {
  const el = document.getElementById('tower-boot-message') || document.getElementById('boot-message');
  if (el) el.textContent = msg;
  const step = document.querySelector('#boot-steps .wt-boot__step');
  if (step && msg) step.textContent = msg;
}

function showBootScreen() {
  document.getElementById('tower-boot')?.classList.remove('is-hidden');
  document.querySelector('.wt-rail')?.classList.add('nav-disabled');
}

function hideBootScreen() {
  state.bootReady = true;
  document.getElementById('tower-boot')?.classList.add('is-hidden');
  document.querySelector('.wt-rail')?.classList.remove('nav-disabled');
}
function truncatePath(p, max = 40) {
  if (!p) return '';
  if (p.length <= max) return p;
  return '…' + p.slice(-(max - 1));
}
function refreshChromeIcons() {
  if (!window.lucide) return;
  const wrap = document.querySelector('.wt-shell');
  if (wrap) lucide.createIcons({ root: wrap });
  else lucide.createIcons();
}
function titleCaseHostname(name) {
  if (!name || name === '—') return name || '—';
  return String(name)
    .split(/([\s._-]+)/)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

function getServerIconUrl() {
  const cacheKey = state.liveConfig?.server_icon_mtime
    ?? state.activeFacts?.meta?.generated
    ?? '';
  const qs = cacheKey ? `?v=${encodeURIComponent(String(cacheKey))}` : '';
  if (state.apiMode || (typeof WatchtowerApi !== 'undefined' && WatchtowerApi.isEmbedded())) {
    return `/api/server/icon${qs}`;
  }
  return `data/server-icon.png${qs}`;
}

function bindOverviewServerIcon() {
  const icon = document.getElementById('overview-server-icon');
  const wrap = document.getElementById('overview-server-icon-wrap');
  if (!icon || !wrap) return;

  const showIcon = () => {
    wrap.classList.remove('is-hidden');
    if (!WatchtowerMotion?.prefersReducedMotion?.()) {
      icon.classList.remove('wt-icon-pop-in');
      void icon.offsetWidth;
      icon.classList.add('wt-icon-pop-in');
    }
  };
  const hideIcon = () => wrap.classList.add('is-hidden');

  if (state.apiMode || (typeof WatchtowerApi !== 'undefined' && WatchtowerApi.isEmbedded())) {
    const cacheKey = state.liveConfig?.server_icon_mtime ?? '';
    const qs = cacheKey ? `?v=${encodeURIComponent(String(cacheKey))}` : '';
    watchtowerApiFetch(`/api/server/icon${qs}`)
      .then((r) => {
        if (!r.ok) {
          hideIcon();
          return null;
        }
        return r.blob();
      })
      .then((blob) => {
        if (!blob) return;
        if (icon._blobUrl) URL.revokeObjectURL(icon._blobUrl);
        icon._blobUrl = URL.createObjectURL(blob);
        icon.src = icon._blobUrl;
        showIcon();
      })
      .catch(() => hideIcon());
    return;
  }

  const url = getServerIconUrl();
  icon.onerror = hideIcon;
  icon.onload = showIcon;
  if (icon.getAttribute('src') !== url) icon.src = url;
}
function getHostEnvironment(f) {
  return state.liveEnvelope?.host_environment || f?.optional?.host_environment || null;
}
function renderEnvironmentBannerHtml(f) {
  const env = state.overviewMeta?.environment || getHostEnvironment(f);
  const enabled = state.dashboardSettings?.metrics_context_banner !== false;
  if (!Labels.shouldShowEnvironmentBanner(env, enabled)) return '';
  if (localStorage.getItem('wt_env_banner_dismiss') === '1') return '';
  return `
    <div class="wt-banner wt-banner--info" id="env-context-banner">
      <p><strong>Environment:</strong> ${esc(Labels.environmentBannerText(env, state.liveLatest))}</p>
      <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="env-banner-dismiss">Dismiss</button>
    </div>`;
}

const UPDATE_SNOOZE_KEY = 'wt_update_snooze_until';

function renderUpdateBannerHtml() {
  const u = state.updateCheck;
  if (!u?.update_available) return '';
  const snooze = Number(localStorage.getItem(UPDATE_SNOOZE_KEY) || 0);
  if (Date.now() < snooze) return '';
  const gh = u.urls?.github || u.urls?.release_page || '#';
  const modrinth = u.urls?.modrinth || 'https://modrinth.com/mod/watchtower';
  return `
    <div class="wt-banner wt-banner--info" id="update-banner">
      <p><strong>Update available:</strong> Watchtower ${esc(u.latest_version || '')} ·
        <a href="${esc(gh)}" target="_blank" rel="noopener">Download</a> ·
        <a href="${esc(modrinth)}" target="_blank" rel="noopener">Modrinth</a></p>
      <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="update-banner-snooze">Remind in 7 days</button>
    </div>`;
}

function renderReportStaleBannerHtml() {
  const meta = state.overviewMeta;
  if (!meta?.stale) return '';
  return `
    <div class="wt-banner wt-banner--warning" id="report-stale-banner">
      <p>${esc(Labels.formatReportFreshness(meta))}</p>
      <button type="button" class="wt-btn wt-btn--primary wt-btn--sm" id="stale-banner-run-btn">Run report</button>
    </div>`;
}

function renderStaticPreviewBannerHtml() {
  if (state.apiMode) return '';
  return `
    <div class="wt-banner" role="status" data-static-preview-banner>
      <span><strong>Static preview</strong> — mock metrics and report fixtures. Run against a live server for real data.</span>
    </div>`;
}

function renderGlobalBanners() {
  const el = document.getElementById('tower-banners');
  if (!el) return;
  const parts = [];
  parts.push(renderStaticPreviewBannerHtml());
  if (state.apiMode && typeof WatchtowerAuth !== 'undefined') {
    parts.push(WatchtowerAuth.renderSecurityUpdateBanner());
    parts.push(WatchtowerAuth.renderExposureBanner());
  }
  parts.push(renderUpdateBannerHtml());
  parts.push(renderEnvironmentBannerHtml(state.activeFacts));
  parts.push(renderReportStaleBannerHtml());
  el.innerHTML = parts.filter(Boolean).join('');
  if (typeof WatchtowerAuth !== 'undefined') WatchtowerAuth.bindBanners?.();
  bindDashboardBanners();
  if (window.lucide) lucide.createIcons({ root: el });
}

function renderVersionChip() {
  const chip = document.getElementById('nav-version-chip');
  if (!chip) return;
  const version = state.modVersion || state.overviewMeta?.version || state.liveConfig?.mod_version;
  if (!version || !state.apiMode) {
    chip.textContent = '';
    chip.classList.add('hidden');
    return;
  }
  chip.classList.remove('hidden');
  const hasUpdate = !!(state.updateCheck?.update_available || state.overviewMeta?.update_check?.update_available);
  chip.textContent = Labels.versionChipText(version, state.updateCheck || state.overviewMeta?.update_check);
  chip.classList.toggle('has-update', hasUpdate);
  chip.title = hasUpdate ? 'Update available' : `Watchtower ${version}`;
  const existingDot = chip.querySelector('.nav-update-dot');
  if (hasUpdate && !existingDot) {
    chip.insertAdjacentHTML('beforeend', '<span class="nav-update-dot" aria-hidden="true"></span>');
  } else if (!hasUpdate) {
    existingDot?.remove();
  }
}
function shouldShowWelcome() {
  return typeof WatchtowerSetupWizard !== 'undefined'
    ? WatchtowerSetupWizard.shouldAutoOpen()
    : (state.apiMode && state.noReportYet && !localStorage.getItem(WELCOME_KEY));
}

function showWelcome() {
  const el = document.getElementById('tower-welcome');
  el?.classList.remove('is-hidden');
  document.querySelector('.wt-rail')?.classList.add('nav-disabled');
  document.getElementById('main-content').innerHTML = '';
  const hostEl = document.getElementById('welcome-host');
  const host = state.liveConfig?.hostname || state.activeFacts?.meta?.hostname;
  if (hostEl && host) {
    hostEl.textContent = `Host: ${host}`;
    hostEl.classList.remove('hidden');
  }
  refreshChromeIcons();
}

function hideWelcome() {
  document.getElementById('tower-welcome')?.classList.add('is-hidden');
  if (state.bootReady) {
    document.querySelector('.wt-rail')?.classList.remove('nav-disabled');
  }
}

function markWelcomeSeen() {
  localStorage.setItem(WELCOME_KEY, '1');
}
function startClock() {
  const tick = () => {
    const now = new Date();
    const clock = document.getElementById('tower-clock-time');
    const date = document.getElementById('tower-clock-date');
    if (clock) clock.textContent = now.toLocaleTimeString();
    if (date) date.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  tick();
  setInterval(tick, 1000);
}
function renderNav() {
  const f = state.activeFacts || state.facts;
  if (!f) return;
  const hostname = f.meta?.hostname ?? state.liveConfig?.hostname ?? '—';
  document.getElementById('tower-host-name').textContent = titleCaseHostname(hostname);
  document.title = hostname && hostname !== '—' ? `Watchtower — ${hostname}` : 'Watchtower';
  renderVersionChip();
  
  const sel = document.getElementById('report-select');
  if (sel) sel.value = state.selectedReportId;

  const win = formatReportWindow(f);
  const primaryEl = document.getElementById('tower-report-window');
  const hintEl = document.getElementById('tower-report-window-hint');
  if (primaryEl) {
    primaryEl.textContent = win.secondary
      ? `${win.primary} ${win.secondary}`
      : win.primary;
  }
  if (hintEl) {
    if (win.isOlder && !state.noReportYet) {
      hintEl.textContent = 'Viewing older snapshot — compare mod changes on the Mods tab';
      hintEl.classList.remove('hidden');
    } else {
      hintEl.textContent = '';
      hintEl.classList.add('hidden');
    }
  }
  const freshEl = document.getElementById('tower-report-freshness');
  if (freshEl && state.overviewMeta) {
    freshEl.textContent = Labels.formatReportFreshness(state.overviewMeta);
    freshEl.classList.remove('hidden');
  } else if (freshEl) {
    freshEl.classList.add('hidden');
  }
  const cmdbarCtx = document.getElementById('tower-cmdbar-context');
  if (cmdbarCtx) {
    if (state.overviewMeta) {
      cmdbarCtx.textContent = Labels.formatReportFreshness(state.overviewMeta);
      cmdbarCtx.hidden = false;
    } else if (win.primary) {
      cmdbarCtx.textContent = win.primary;
      cmdbarCtx.hidden = false;
    } else {
      cmdbarCtx.hidden = true;
    }
  }
  
  // Health Glow Sync
  const grade = state.overviewMeta?.health_grade || state.activeFacts?.meta?.health_grade || 'U';
  if (window.TowerMotion) TowerMotion.healthGlow(document.getElementById('rail-logo'), grade);
  
  refreshChromeIcons();
}
function bindDashboardBanners() {
  document.getElementById('env-banner-dismiss')?.addEventListener('click', () => {
    localStorage.setItem('wt_env_banner_dismiss', '1');
    renderGlobalBanners();
  });
  document.getElementById('update-banner-snooze')?.addEventListener('click', () => {
    localStorage.setItem(UPDATE_SNOOZE_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    renderGlobalBanners();
  });
  document.getElementById('stale-banner-run-btn')?.addEventListener('click', openRunModal);
}
function hideEmbeddedPocChrome() {
  if (!state.apiMode) return;
  document.getElementById('run-modal-note')?.classList.add('hidden');
}
