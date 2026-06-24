/**
 * Settings — in-canvas split view (General, Security, About).
 */
const WatchtowerSettings = (function () {
  let activePanel = 'settings';
  let settings = null;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function schedulePresetOptions(currentMode, currentInterval) {
    const presets = [
      { label: 'Twice daily (12:00 AM & 12:00 PM)', value: 'wall_clock' },
      { label: 'Off', value: '0' },
      { label: 'Every 1 hour', value: '60' },
      { label: 'Every 6 hours', value: '360' },
      { label: 'Every 12 hours', value: '720' },
      { label: 'Every 24 hours', value: '1440' },
      { label: 'Custom…', value: '-1' },
    ];
    const isCustom = currentMode === 'interval'
      && currentInterval > 0
      && !presets.some((p) => p.value === String(currentInterval));
    return presets.map((p) => {
      let selected = false;
      if (p.value === 'wall_clock') {
        selected = currentMode === 'wall_clock';
      } else if (p.value === '-1') {
        selected = isCustom;
      } else if (p.value === '0') {
        selected = currentMode === 'off';
      } else {
        selected = currentMode === 'interval' && Number(p.value) === currentInterval;
      }
      return `<option value="${p.value}" ${selected ? 'selected' : ''}>${esc(p.label)}</option>`;
    }).join('');
  }

  function renderSettingsForm() {
    const s = settings || {};
    const scheduleMode = s.report_schedule_mode || (s.report_interval_minutes > 0 ? 'interval' : 'wall_clock');
    const interval = s.report_interval_minutes ?? 720;
    const isCustom = scheduleMode === 'interval'
      && interval > 0
      && ![60, 360, 720, 1440].includes(interval);
    const lookback = s.lookback_hours ?? 24;
    const incremental = s.incremental !== false;
    const nextIn = s.next_report_in_minutes;
    const nextAt = s.next_report_at;
    let nextLine = '';
    if (scheduleMode !== 'off' && nextIn > 0) {
      const atPart = nextAt ? ` (~${esc(nextAt.replace('T', ' '))})` : '';
      nextLine = `<p class="text-caption help-settings-note">Next scheduled report in ~${nextIn} minute${nextIn === 1 ? '' : 's'}${atPart}.</p>`;
    }

    const tabActions = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.tabActions({
        text: 'Dashboard port and live sample rate are in <code>config/watchtower-server.toml</code> and require a server restart.',
        buttons: '<button type="submit" class="wt-btn wt-btn--primary" id="settings-save-btn" form="settings-form">Save settings</button>',
      })
      : `<div class="wt-hub-panel__actions">
          <button type="submit" class="wt-btn wt-btn--primary" id="settings-save-btn" form="settings-form">Save settings</button>
        </div>`;

    return `
      <div class="wt-hub-panel">
        <form class="help-settings-form" id="settings-form">
          <p class="settings-section-lead">Changes apply immediately — no server restart needed for these options.</p>
          <details class="wt-accordion" open>
            <summary class="wt-accordion__summary">Schedule & lookback</summary>
            <div class="wt-accordion__body">
          <div class="wt-form-row">
            <label for="settings-schedule-preset">Scheduled reports</label>
            <select id="settings-schedule-preset">${schedulePresetOptions(scheduleMode, interval)}</select>
          </div>
          <div class="wt-form-row ${isCustom ? '' : 'is-hidden'}" id="settings-schedule-custom-row">
            <label for="settings-schedule-custom">Custom interval (minutes)</label>
            <input type="number" id="settings-schedule-custom" min="1" max="10080" value="${isCustom ? interval : 60}">
          </div>
          ${nextLine}
          <div class="wt-form-row">
            <label for="settings-lookback">Default lookback window</label>
            <select id="settings-lookback">
              <option value="24" ${lookback === 24 ? 'selected' : ''}>Last 24 hours</option>
              <option value="168" ${lookback === 168 ? 'selected' : ''}>Last 7 days</option>
              <option value="720" ${lookback === 720 ? 'selected' : ''}>Last 30 days</option>
            </select>
          </div>
          <div class="wt-form-row">
            <label><input type="checkbox" id="settings-incremental" ${incremental ? 'checked' : ''}> Incremental scans (since last report)</label>
          </div>
            </div>
          </details>
          <details class="wt-accordion" open>
            <summary class="wt-accordion__summary">Warning thresholds</summary>
            <div class="wt-accordion__body">
          <div class="wt-form-row">
            <label for="settings-mspt-warn">MSPT warning threshold (ms)</label>
            <input type="number" id="settings-mspt-warn" min="1" max="500" step="0.5" value="${s.mspt_warn ?? 50}">
          </div>
          <div class="wt-form-row">
            <label for="settings-tps-warn">TPS warning threshold</label>
            <input type="number" id="settings-tps-warn" min="1" max="20" step="0.1" value="${s.tps_warn ?? 19.5}">
          </div>
            </div>
          </details>
          <details class="wt-accordion">
            <summary class="wt-accordion__summary">Environment</summary>
            <div class="wt-accordion__body help-settings-readonly">
            <p class="text-caption"><strong>Panel:</strong> ${esc(s.panel_display_name || s.panel || 'Unknown')}</p>
            <p class="text-caption"><strong>Host:</strong> ${esc(s.hostname || '—')}</p>
            ${s.backup_dirs ? `<p class="text-caption"><strong>Backup folders:</strong> <span class="mono-cell">${esc(s.backup_dirs)}</span></p>` : ''}
            <p class="text-caption"><a href="#" class="wt-settings-backups-link">Backup setup →</a></p>
            </div>
          </details>
        </form>
        ${tabActions}
      </div>`;
  }

  function sectionHead(title, icon) {
    if (typeof TowerTabChrome !== 'undefined') {
      return TowerTabChrome.sectionHead({ title, icon, span: 'wt-hub-panel__head' });
    }
    return `<h3 class="wt-hub-panel__head">${esc(title)}</h3>`;
  }

  function renderSecurity() {
    const sess = typeof WatchtowerAuth !== 'undefined' ? WatchtowerAuth.getSession() : null;
    const totpOn = sess?.totp_enabled;
    if (!state.apiMode) {
      return '<p class="help-settings-intro wt-hub-panel">Security settings are available when connected to the embedded mod dashboard.</p>';
    }
    return `
      <div class="wt-hub-panel wt-hub-panel--stack">
        <p class="help-settings-intro">Manage dashboard login credentials. Passwords are stored hashed on disk in <code>watchtower/dashboard-auth.json</code>.</p>
        <article class="wt-card wt-card--surface wt-hub-panel-card">
          ${sectionHead('Change password', 'key-round')}
          <form id="settings-security-password-form" class="help-settings-form">
            <div class="wt-form-row">
              <label for="settings-sec-current-pw">Current password</label>
              <input type="password" id="settings-sec-current-pw" autocomplete="current-password" required>
            </div>
            <div class="wt-form-row">
              <label for="settings-sec-new-pw">New password</label>
              <input type="password" id="settings-sec-new-pw" minlength="8" autocomplete="new-password" required>
            </div>
            <button type="submit" class="wt-btn wt-btn--primary btn-sm">Update password</button>
          </form>
        </article>
        <article class="wt-card wt-card--surface wt-hub-panel-card">
          ${sectionHead('Change username', 'user')}
          <form id="settings-security-username-form" class="help-settings-form">
            <div class="wt-form-row">
              <label for="settings-sec-username">Username</label>
              <input type="text" id="settings-sec-username" value="${esc(sess?.username || '')}" pattern="[a-zA-Z0-9_-]{3,32}" required>
            </div>
            <button type="submit" class="wt-btn wt-btn--primary btn-sm">Update username</button>
          </form>
        </article>
        <article class="wt-card wt-card--surface wt-hub-panel-card">
          ${sectionHead('Two-factor authentication (TOTP)', 'shield-check')}
          <p class="text-caption">Status: <strong>${totpOn ? 'Enabled' : 'Disabled'}</strong></p>
          ${totpOn ? `
            <form id="settings-security-disable-2fa" class="help-settings-form">
              <div class="wt-form-row">
                <label for="settings-sec-disable-pw">Password</label>
                <input type="password" id="settings-sec-disable-pw" required>
              </div>
              <div class="wt-form-row">
                <label for="settings-sec-disable-code">Authenticator or recovery code</label>
                <input type="text" id="settings-sec-disable-code" required>
              </div>
              <button type="submit" class="wt-btn wt-btn--ghost btn-sm">Disable 2FA</button>
            </form>
            <form id="settings-security-regen-recovery" class="help-settings-form">
              <p class="text-caption">Regenerate recovery codes (invalidates old codes).</p>
              <div class="wt-form-row">
                <label for="settings-sec-regen-pw">Password</label>
                <input type="password" id="settings-sec-regen-pw" required>
              </div>
              <div class="wt-form-row">
                <label for="settings-sec-regen-code">Current authenticator code</label>
                <input type="text" id="settings-sec-regen-code" inputmode="numeric" required>
              </div>
              <button type="submit" class="wt-btn wt-btn--ghost btn-sm">Regenerate recovery codes</button>
            </form>
            <div id="settings-recovery-codes" class="hidden recovery-codes-box"></div>
          ` : `
            <button type="button" class="wt-btn wt-btn--primary btn-sm" id="settings-enable-2fa-btn">Enable 2FA</button>
            <div id="settings-2fa-setup" class="hidden help-2fa-setup">
              <p class="text-caption">Scan with Google Authenticator, Authy, or 1Password:</p>
              <img id="settings-2fa-qr" alt="2FA QR code" class="help-2fa-qr">
              <p class="text-caption mono-cell" id="settings-2fa-secret"></p>
              <form id="settings-security-confirm-2fa" class="help-settings-form">
                <div class="wt-form-row">
                  <label for="settings-sec-confirm-code">6-digit code</label>
                  <input type="text" id="settings-sec-confirm-code" inputmode="numeric" required>
                </div>
                <button type="submit" class="wt-btn wt-btn--primary btn-sm">Confirm and enable</button>
              </form>
              <div id="settings-new-recovery-codes" class="hidden recovery-codes-box"></div>
            </div>
          `}
        </article>
        <article class="wt-card wt-card--surface wt-hub-panel-card">
          ${sectionHead('Forgot password?', 'life-buoy')}
          <p class="text-caption">No email reset — use one of these operator paths:</p>
          <ul class="help-recovery-list">
            <li>Never changed default? Sign in with <code>watchtower</code> / <code>password</code>, or run <code>/watchtower dashboard reset-password</code>.</li>
            <li>2FA off: <code>/watchtower dashboard reset-password</code> (OP 4) or delete <code>watchtower/dashboard-auth.json</code> after stopping the server.</li>
            <li>2FA on: use a recovery code at login, then change password here.</li>
            <li>Clear 2FA when resetting: <code>/watchtower dashboard reset-password clear-2fa</code></li>
          </ul>
        </article>
      </div>`;
  }

  function renderAbout() {
    const version = state.modVersion || state.liveConfig?.mod_version || state.overviewMeta?.version || '—';
    const update = state.overviewMeta?.update_check || state.updateCheck;
    let updateValue = 'Unavailable';
    let updateHint = 'Update check could not run';
    let updateTone = 'neutral';
    if (update) {
      if (update.enabled === false) {
        updateValue = 'Disabled';
        updateHint = 'UPDATE_CHECK=false';
      } else if (update.update_available) {
        updateValue = update.latest_version || 'Available';
        updateHint = 'New release on GitHub / Modrinth';
        updateTone = 'warn';
      } else {
        updateValue = 'Up to date';
        updateHint = update.latest_version ? `Latest: ${update.latest_version}` : 'You are on the latest release';
        updateTone = 'ok';
      }
      if (update.checked_at) {
        updateHint += ` · checked ${new Date(update.checked_at).toLocaleString()}`;
      }
    }
    const versionCard = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.statCard({
        icon: 'package',
        label: 'Installed version',
        value: esc(version),
        hint: 'NeoForge mod + CLI',
      })
      : `<p><strong>Version:</strong> <span class="mono-cell">${esc(version)}</span></p>`;
    const updateCard = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.statCard({
        tone: updateTone,
        icon: 'download',
        label: 'Update status',
        value: esc(updateValue),
        hint: esc(updateHint),
      })
      : '';
    let updateLinks = '';
    if (update?.update_available) {
      const gh = update.urls?.github || update.urls?.release_page || '#';
      const modrinth = update.urls?.modrinth || 'https://modrinth.com/mod/watchtower';
      updateLinks = `<p class="text-caption wt-hub-panel__links"><a href="${esc(gh)}" target="_blank" rel="noopener">GitHub release</a> · <a href="${esc(modrinth)}" target="_blank" rel="noopener">Modrinth</a></p>`;
    }
    const supportActions = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.tabActions({
        text: 'Download a support bundle from Overview or run <code>/watchtower diagnostics</code> on the server.',
        buttons: `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="settings-start-tour"><i data-lucide="compass" width="14" height="14"></i> Start guided tour</button>
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="settings-open-docs"><i data-lucide="book-open" width="14" height="14"></i> Browse documentation</button>`,
      })
      : `<p class="help-wiki-link">
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="settings-start-tour">Start guided tour</button>
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="settings-open-docs">Browse documentation</button>
        </p>`;
    return `
      <div class="wt-hub-panel wt-hub-panel--stack">
        <article class="wt-card wt-card--surface wt-hub-panel-card">
          ${sectionHead('Watchtower', 'radio-tower')}
          <p class="text-caption">Rule-based server health for NeoForge — logs, crashes, mods, backups, and host vitals stay on your machine.</p>
          <div class="wt-stat-grid wt-stat-grid--2col">
            ${versionCard}
            ${updateCard}
          </div>
          ${updateLinks}
        </article>
        <article class="wt-card wt-card--surface wt-hub-panel-card">
          ${sectionHead('Guided tour', 'compass')}
          <p class="text-caption">A quick spotlight walkthrough of the main dashboard areas. Takes about two minutes.</p>
        </article>
        ${supportActions}
      </div>`;
  }

  function toast(msg, kind = 'info') {
    if (typeof WatchtowerToast !== 'undefined') {
      WatchtowerToast.show({ message: msg, kind });
    }
  }

  function bindSecurityForm() {
    document.getElementById('settings-security-password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await WatchtowerAuth.changePassword(
          document.getElementById('settings-sec-current-pw')?.value,
          document.getElementById('settings-sec-new-pw')?.value
        );
        toast('Password updated', 'success');
        e.target.reset();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    document.getElementById('settings-security-username-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await WatchtowerAuth.changeUsername(document.getElementById('settings-sec-username')?.value);
        toast('Username updated', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    document.getElementById('settings-enable-2fa-btn')?.addEventListener('click', async () => {
      try {
        const setup = await WatchtowerAuth.totpSetup();
        document.getElementById('settings-2fa-setup')?.classList.remove('hidden');
        const qr = document.getElementById('settings-2fa-qr');
        if (qr && setup.qr_data_url) qr.src = setup.qr_data_url;
        const secretEl = document.getElementById('settings-2fa-secret');
        if (secretEl) secretEl.textContent = setup.secret || '';
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    document.getElementById('settings-security-confirm-2fa')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const result = await WatchtowerAuth.totpConfirm(document.getElementById('settings-sec-confirm-code')?.value);
        const box = document.getElementById('settings-new-recovery-codes');
        if (box && result.recovery_codes) {
          box.classList.remove('hidden');
          box.innerHTML = `<p><strong>Save these recovery codes offline:</strong></p><pre>${result.recovery_codes.join('\n')}</pre>`;
        }
        toast('2FA enabled', 'success');
        renderContent();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    document.getElementById('settings-security-disable-2fa')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await WatchtowerAuth.totpDisable(
          document.getElementById('settings-sec-disable-pw')?.value,
          document.getElementById('settings-sec-disable-code')?.value
        );
        toast('2FA disabled', 'success');
        renderContent();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    document.getElementById('settings-security-regen-recovery')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const result = await WatchtowerAuth.regenerateRecovery(
          document.getElementById('settings-sec-regen-pw')?.value,
          document.getElementById('settings-sec-regen-code')?.value
        );
        const box = document.getElementById('settings-recovery-codes');
        if (box && result.recovery_codes) {
          box.classList.remove('hidden');
          box.innerHTML = `<p><strong>New recovery codes:</strong></p><pre>${result.recovery_codes.join('\n')}</pre>`;
        }
        toast('Recovery codes regenerated', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  function bindSettingsForm() {
    const preset = document.getElementById('settings-schedule-preset');
    const customRow = document.getElementById('settings-schedule-custom-row');
    preset?.addEventListener('change', () => {
      customRow?.classList.toggle('is-hidden', preset.value !== '-1');
    });

    document.querySelector('.wt-settings-backups-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      openInCanvas('backups');
    });

    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.apiMode) return;
      const btn = document.getElementById('settings-save-btn');
      if (typeof TowerMotion !== 'undefined') TowerMotion.btnLoading(btn, true);
      else {
        btn?.classList.add('is-loading');
        if (btn) btn.disabled = true;
      }
      try {
        const presetVal = preset?.value ?? 'wall_clock';
        const payload = {
          lookbackHours: Number(document.getElementById('settings-lookback')?.value || 24),
          incremental: document.getElementById('settings-incremental')?.checked ?? true,
          tpsWarn: Number(document.getElementById('settings-tps-warn')?.value || 19.5),
          msptWarn: Number(document.getElementById('settings-mspt-warn')?.value || 50),
        };
        if (presetVal === 'wall_clock') {
          payload.reportScheduleMode = 'wall_clock';
          payload.reportWallClockHours = '0,12';
        } else if (presetVal === '0') {
          payload.reportScheduleMode = 'off';
          payload.reportIntervalMinutes = 0;
        } else if (presetVal === '-1') {
          payload.reportScheduleMode = 'interval';
          payload.reportIntervalMinutes = Math.max(1, Math.min(10080,
            Number(document.getElementById('settings-schedule-custom')?.value || 60)));
        } else {
          payload.reportScheduleMode = 'interval';
          payload.reportIntervalMinutes = Math.max(1, Math.min(10080, Number(presetVal)));
        }
        const result = await WatchtowerApi.saveSettings(payload);
        settings = result.settings || result;
        state.dashboardSettings = settings;
        toast('Settings saved', 'success');
        renderContent();
      } catch (err) {
        toast(`Save failed: ${err.message}`, 'error');
      } finally {
        if (typeof TowerMotion !== 'undefined') TowerMotion.btnLoading(btn, false);
        else {
          btn?.classList.remove('is-loading');
          if (btn) btn.disabled = false;
        }
      }
    });
  }

  function renderBackupsPanel() {
    return '<div id="settings-backups-mount" class="wt-hub-panel"></div>';
  }

  function bindBackupsPanel() {
    const mount = document.getElementById('settings-backups-mount');
    if (!mount || typeof WatchtowerBackupSettings === 'undefined') {
      if (mount) {
        mount.innerHTML = '<p class="help-settings-intro">Backup settings module not loaded.</p>';
      }
      return;
    }
    WatchtowerBackupSettings.mountPanel(mount, settings || state.dashboardSettings || {});
  }

  function renderMonitoring() {
    const s = settings || {};
    const rows = Labels.monitoringPanelRows();
    const tableRows = rows.map((row) => {
      let current = '—';
      if (row.key === 'live_sample') current = `${s.live_sample_interval_seconds ?? '—'}s`;
      if (row.key === 'ops_log_scan') current = `${s.ops_log_scan_sec ?? 60}s`;
      if (row.key === 'ops_poll') current = `${s.ops_poll_sec ?? 60}s`;
      if (row.key === 'schedule') {
        current = s.report_schedule_mode === 'wall_clock'
          ? 'Wall clock (0,12)'
          : (s.report_interval_minutes > 0 ? `Every ${s.report_interval_minutes} min` : 'Off');
      }
      if (row.key === 'retention') {
        current = `${s.report_retention_count ?? 30} reports / ${s.report_retention_days ?? 90} days`;
      }
      return `<tr>
        <td><strong>${esc(row.label)}</strong></td>
        <td>${esc(row.value)}</td>
        <td class="mono-cell">${esc(current)}</td>
        <td><code>${esc(row.edit)}</code> <span class="text-caption">(${esc(row.editNote)})</span></td>
      </tr>`;
    }).join('');
    return `
      <div class="wt-hub-panel wt-hub-panel--stack">
        ${typeof TowerTabChrome !== 'undefined'
    ? TowerTabChrome.sectionHead({
      id: 'settings-monitoring-head',
      title: 'Monitoring intervals',
      sub: 'Read-only view of poll rates, schedule, and retention — edit in General or config files as noted.',
      icon: 'gauge',
      span: 'wt-hub-panel__head',
    })
    : '<h3 class="wt-hub-panel__head">Monitoring intervals</h3>'}
        <div class="wt-settings-monitoring wt-card wt-card--surface wt-hub-panel-card">
          <div class="wt-table-wrap">
            <table class="wt-table wt-monitoring-table">
              <thead><tr><th>Layer</th><th>What it controls</th><th>Current</th><th>Where to edit</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </div>
        ${typeof TowerTabChrome !== 'undefined'
    ? TowerTabChrome.tabActions({
      text: '',
      buttons: '<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="monitoring-open-wiki"><i data-lucide="book-open" width="14" height="14"></i> Understanding data sources</button>',
    })
    : '<p class="text-caption help-settings-advanced"><button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="monitoring-open-wiki">Understanding data sources</button></p>'}
      </div>`;
  }

  function bindWikiButtons() {
    document.getElementById('settings-open-docs')?.addEventListener('click', () => {
      window.openWiki?.('Home');
    });
    document.getElementById('monitoring-open-wiki')?.addEventListener('click', () => {
      window.openWiki?.('Understanding-Data-Sources');
    });
    document.getElementById('settings-start-tour')?.addEventListener('click', () => {
      if (typeof TowerViews !== 'undefined') TowerViews.backToDashboard();
      if (typeof WatchtowerTour !== 'undefined') {
        setTimeout(() => WatchtowerTour.start({ force: true }), 300);
      }
    });
  }

  function renderContent() {
    const el = document.getElementById('settings-content');
    if (!el) return;
    if (activePanel === 'settings') {
      el.innerHTML = renderSettingsForm();
      bindSettingsForm();
    } else if (activePanel === 'monitoring') {
      el.innerHTML = renderMonitoring();
      bindWikiButtons();
    } else if (activePanel === 'backups') {
      el.innerHTML = renderBackupsPanel();
      bindBackupsPanel();
    } else if (activePanel === 'security') {
      el.innerHTML = renderSecurity();
      bindSecurityForm();
    } else {
      el.innerHTML = renderAbout();
      bindWikiButtons();
    }
    if (window.lucide) lucide.createIcons({ root: el });
  }

  async function loadSettings() {
    if (!state.apiMode) {
      settings = {};
      return;
    }
    try {
      settings = await WatchtowerApi.fetchSettings();
      state.dashboardSettings = settings;
    } catch {
      settings = {};
    }
  }

  async function openInCanvas(panel = 'settings') {
    activePanel = panel;
    await loadSettings();
    state.canvasView = 'settings';
    const panels = [['settings', 'General'], ['monitoring', 'Monitoring'], ['backups', 'Backups'], ['security', 'Security'], ['about', 'About']];
    const main = document.getElementById('main-content');
    if (!main || typeof TowerViews === 'undefined') return open(panel);
    main.innerHTML = TowerViews.renderHubShell({
      hubId: 'settings',
      title: 'Settings',
      panels,
      activePanel,
      contentHtml: '<div id="settings-content" class="wt-hub-shell__panel"></div>',
    });
    TowerViews.bindBack(() => TowerViews.backToDashboard());
    main.querySelectorAll('[data-view-panel]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.viewPanel === activePanel) return;
        await loadSettings();
        activePanel = btn.dataset.viewPanel;
        main.querySelectorAll('[data-view-panel]').forEach((b) => {
          b.classList.toggle('active', b.dataset.viewPanel === activePanel);
        });
        renderContent();
        const panel = document.getElementById('settings-content');
        if (typeof TowerMotion !== 'undefined' && panel) TowerMotion.staggerEnter(panel);
      });
    });
    renderContent();
    if (typeof TowerMotion !== 'undefined') TowerMotion.staggerEnter(main);
    if (typeof refreshChromeIcons === 'function') refreshChromeIcons();
    else if (window.lucide) lucide.createIcons({ root: main });
  }

  function schedulePayloadFromPreset(presetVal) {
    const payload = {};
    if (presetVal === 'wall_clock') {
      payload.reportScheduleMode = 'wall_clock';
      payload.reportWallClockHours = '0,12';
    } else if (presetVal === '0') {
      payload.reportScheduleMode = 'off';
      payload.reportIntervalMinutes = 0;
    } else {
      payload.reportScheduleMode = 'interval';
      payload.reportIntervalMinutes = Math.max(1, Math.min(10080, Number(presetVal)));
    }
    return payload;
  }

  function renderScheduleEmbed(settingsData) {
    const s = settingsData || settings || state.dashboardSettings || {};
    const mode = s.report_schedule_mode || (s.report_interval_minutes > 0 ? 'interval' : 'wall_clock');
    const interval = s.report_interval_minutes ?? 720;
    const selected = (id) => {
      if (id === 'wall_clock') return mode === 'wall_clock';
      if (id === '0') return mode === 'off';
      if (id === '60') return mode === 'interval' && interval === 60;
      return false;
    };
    return `
      <header class="wt-setup-wizard__head">
        <p class="wt-setup-wizard__eyebrow">Step 4</p>
        <h2 class="wt-setup-wizard__title">Scheduled reports</h2>
        <p class="wt-setup-wizard__lead">Automatic reports keep Issues, Activity, and trends useful without manual runs. Twice daily is a good default.</p>
      </header>
      <div class="wt-bs-option-grid" role="radiogroup" aria-label="Report schedule">
        <label class="wt-bs-option-card${selected('wall_clock') ? ' is-selected' : ''}">
          <input type="radio" name="setup-schedule" value="wall_clock" ${selected('wall_clock') ? 'checked' : ''}>
          <span class="wt-bs-option-card__badge">Recommended</span>
          <span class="wt-bs-option-card__title">Twice daily</span>
          <span class="wt-bs-option-card__desc">12:00 AM and 12:00 PM — balanced for most servers</span>
        </label>
        <label class="wt-bs-option-card${selected('60') ? ' is-selected' : ''}">
          <input type="radio" name="setup-schedule" value="60" ${selected('60') ? 'checked' : ''}>
          <span class="wt-bs-option-card__title">Every hour</span>
          <span class="wt-bs-option-card__desc">Best for busy servers or active troubleshooting</span>
        </label>
        <label class="wt-bs-option-card${selected('0') ? ' is-selected' : ''}">
          <input type="radio" name="setup-schedule" value="0" ${selected('0') ? 'checked' : ''}>
          <span class="wt-bs-option-card__title">Off</span>
          <span class="wt-bs-option-card__desc">Run reports manually from the sidebar</span>
        </label>
      </div>`;
  }

  async function saveScheduleFromEmbed(root) {
    const preset = root?.querySelector('input[name="setup-schedule"]:checked')?.value || 'wall_clock';
    const payload = schedulePayloadFromPreset(preset);
    if (!state.apiMode) {
      const next = { ...(state.dashboardSettings || {}), ...payloadToSettings(payload) };
      state.dashboardSettings = next;
      settings = next;
      localStorage.setItem(
        typeof PREVIEW_SETTINGS_KEY !== 'undefined' ? PREVIEW_SETTINGS_KEY : 'watchtower-preview-settings',
        JSON.stringify(next),
      );
      return;
    }
    const result = await WatchtowerApi.saveSettings(payload);
    settings = result.settings || result;
    state.dashboardSettings = settings;
  }

  function payloadToSettings(payload) {
    const next = {};
    if (payload.reportScheduleMode) next.report_schedule_mode = payload.reportScheduleMode;
    if (payload.reportIntervalMinutes != null) next.report_interval_minutes = payload.reportIntervalMinutes;
    if (payload.reportWallClockHours) next.report_wall_clock_hours = payload.reportWallClockHours;
    return next;
  }

  function renderSecurityEmbedCompact() {
    const sess = typeof WatchtowerAuth !== 'undefined' ? WatchtowerAuth.getSession() : null;
    const totpOn = sess?.totp_enabled;
    const exposed = sess?.bind_exposed;
    let exposureHtml = '';
    if (exposed) {
      exposureHtml = `
        <div class="wt-banner wt-banner--warn" style="margin-bottom:16px">
          <p><strong>Dashboard may be reachable from the internet.</strong> Enable 2FA below and see Security and Access in Docs for safe hosting.</p>
        </div>`;
    }
    if (!state.apiMode) {
      return `
      <header class="wt-setup-wizard__head">
        <p class="wt-setup-wizard__eyebrow">Optional</p>
        <h2 class="wt-setup-wizard__title">Security</h2>
        <p class="wt-setup-wizard__lead">On a live server, enable 2FA under Settings → Security if the dashboard is reachable from the internet.</p>
      </header>
      <div class="wt-panel wt-panel--nested">
        <p class="text-caption">Static preview — login and 2FA are not simulated here. On your real server, use <strong>Settings → Security</strong> after install.</p>
      </div>`;
    }
    return `
      <header class="wt-setup-wizard__head">
        <p class="wt-setup-wizard__eyebrow">Optional</p>
        <h2 class="wt-setup-wizard__title">Security</h2>
        <p class="wt-setup-wizard__lead">Optional but recommended if anyone outside your home network can reach port 8787.</p>
      </header>
      ${exposureHtml}
      <article class="wt-card wt-card--surface">
        <h3 class="wt-card__title"><i data-lucide="shield-check" width="16" height="16"></i> Two-factor authentication</h3>
        <p class="text-caption">Status: <strong>${totpOn ? 'Enabled' : 'Disabled'}</strong></p>
        ${totpOn ? '<p class="text-caption">2FA is on — manage in Settings → Security anytime.</p>' : `
          <button type="button" class="wt-btn wt-btn--primary wt-btn--sm" id="setup-wizard-enable-2fa">Enable 2FA</button>
          <div id="setup-wizard-2fa-setup" class="hidden help-2fa-setup" style="margin-top:12px">
            <p class="text-caption">Scan with your authenticator app:</p>
            <img id="setup-wizard-2fa-qr" alt="2FA QR code" class="help-2fa-qr">
            <p class="text-caption mono-cell" id="setup-wizard-2fa-secret"></p>
            <form id="setup-wizard-confirm-2fa" class="help-settings-form">
              <div class="wt-form-row">
                <label for="setup-wizard-confirm-code">6-digit code</label>
                <input type="text" id="setup-wizard-confirm-code" inputmode="numeric" required>
              </div>
              <button type="submit" class="wt-btn wt-btn--primary wt-btn--sm">Confirm 2FA</button>
            </form>
            <div id="setup-wizard-recovery-codes" class="hidden recovery-codes-box"></div>
          </div>`}
      </article>`;
  }

  function bindSecurityEmbedCompact(root) {
    root.querySelector('#setup-wizard-enable-2fa')?.addEventListener('click', async () => {
      try {
        const setup = await WatchtowerAuth.totpSetup();
        root.querySelector('#setup-wizard-2fa-setup')?.classList.remove('hidden');
        const qr = root.querySelector('#setup-wizard-2fa-qr');
        if (qr && setup.qr_data_url) qr.src = setup.qr_data_url;
        const secretEl = root.querySelector('#setup-wizard-2fa-secret');
        if (secretEl) secretEl.textContent = setup.secret || '';
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    root.querySelector('#setup-wizard-confirm-2fa')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const result = await WatchtowerAuth.totpConfirm(root.querySelector('#setup-wizard-confirm-code')?.value);
        const box = root.querySelector('#setup-wizard-recovery-codes');
        if (box && result.recovery_codes) {
          box.classList.remove('hidden');
          box.innerHTML = `<p><strong>Save these recovery codes offline:</strong></p><pre>${result.recovery_codes.join('\n')}</pre>`;
        }
        toast('2FA enabled', 'success');
        if (typeof WatchtowerSetupWizard !== 'undefined') WatchtowerSetupWizard.open({ step: 'security' });
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  async function open(panel = 'settings') {
    return openInCanvas(panel);
  }

  function close() {
    if (state.canvasView === 'settings') {
      state.canvasView = null;
      if (typeof render === 'function') render();
      if (typeof TowerNav !== 'undefined') TowerNav.setActiveTab(state.activeTab);
    }
  }

  return {
    open,
    openInCanvas,
    close,
    loadSettings,
    renderScheduleEmbed,
    saveScheduleFromEmbed,
    renderSecurityEmbedCompact,
    bindSecurityEmbedCompact,
  };
})();
