/**
 * Watchtower setup wizard — unified first-run flow with initial audit scan.
 */
const WatchtowerSetupWizard = (function () {
  const STORAGE_KEY = typeof SETUP_WIZARD_KEY !== 'undefined' ? SETUP_WIZARD_KEY : 'watchtower-setup-wizard-v1';
  const RESUME_HIDDEN_KEY = 'watchtower-setup-resume-hidden';
  const MIN_STEP_MS = 400;

  const STEPS = [
    { id: 'welcome', label: 'Welcome', required: true },
    { id: 'audit', label: 'Initial audit', required: true },
    { id: 'backups', label: 'Backups', required: true },
    { id: 'schedule', label: 'Scheduled reports', required: true },
    { id: 'security', label: 'Security', required: false },
  ];

  const STEP_ICONS = {
    welcome: 'sparkles',
    audit: 'scan-search',
    backups: 'archive',
    schedule: 'calendar-clock',
    security: 'shield',
  };

  const SCAN_PHASES = [
    { id: 'logs', label: 'Scanning server logs…', run: () => WatchtowerApi.postActivityScan() },
    { id: 'crashes', label: 'Checking crash reports…', run: () => WatchtowerApi.postCrashScan() },
    { id: 'mods', label: 'Inventorying mods…', run: () => WatchtowerApi.postModsScan() },
    { id: 'backups', label: 'Looking for backups…', run: () => WatchtowerApi.postBackupScan() },
    { id: 'baseline', label: 'Building 30-day health baseline…', run: null },
    { id: 'issues', label: 'Analyzing issues…', run: null },
  ];

  let isOpen = false;
  let auditAbort = false;

  let backupDiscoverState = { status: 'pending', found: false, result: null };

  function resetBackupDiscover() {
    backupDiscoverState = { status: 'pending', found: false, result: null };
  }

  function applyBackupScanData(data) {
    if (!data) return;
    if (!state.activeFacts) state.activeFacts = state.facts || {};
    if (!state.activeFacts.optional) state.activeFacts.optional = {};
    if (data.last_backup) state.activeFacts.optional.last_backup = data.last_backup;
    if (data.backup_inventory) {
      state.activeFacts.optional.backup_inventory = data.backup_inventory;
    } else if (data.last_backup?.inventory_count === 0) {
      state.activeFacts.optional.backup_inventory = [];
    }
  }

  function classifyBackupDiscover() {
    const backup = state.activeFacts?.optional?.last_backup;
    const ext = state.opsCache?.backup_external || state.activeFacts?.optional?.backup_external;
    const inventory = state.activeFacts?.optional?.backup_inventory;

    if (ext?.configured && (ext.status === 'success' || ext.status === 'running')) {
      return { found: true, kind: 'panel', external: ext, backup };
    }
    if (backup?.status && backup.status !== 'unconfigured') {
      return { found: true, kind: 'local', backup, external: ext };
    }
    if (Array.isArray(inventory) && inventory.length > 0) {
      return { found: true, kind: 'local', backup, inventoryCount: inventory.length };
    }
    return { found: false, backup, external: ext };
  }

  function describeBackupDiscover(result) {
    const c = Labels.backupWizardCopy || {};
    if (!result?.found) {
      return {
        tone: 'neutral',
        icon: 'folder-search',
        title: c.setupBackupsNotFoundTitle || 'No backups found yet',
        body: c.setupBackupsNotFoundLead || '',
        hint: c.setupBackupsSettingsHint || '',
      };
    }
    if (result.kind === 'panel') {
      const summary = typeof Labels.backupExternalSummary === 'function'
        ? Labels.backupExternalSummary(result.external)
        : 'A panel backup signal is configured.';
      return {
        tone: 'ok',
        icon: 'cloud',
        title: c.setupBackupsPanelFoundTitle || 'Panel backup detected',
        body: summary,
      };
    }
    const b = result.backup;
    if (b?.status === 'success' && !b?.stale) {
      const detail = b.path
        ? `Latest archive: ${b.path}${b.size_gb != null ? ` (${b.size_gb} GB)` : ''}.`
        : 'Backup archives found on this server.';
      return {
        tone: 'ok',
        icon: 'archive',
        title: c.setupBackupsFoundTitle || 'Backups found',
        body: detail,
      };
    }
    if (b?.status === 'stale' || b?.stale) {
      const age = b.age_days != null ? `${Math.round(b.age_days)} days ago` : 'a while ago';
      const detail = b.path
        ? `Latest archive is ${b.path} (${age}).`
        : `Newest backup is older than usual (${age}).`;
      return {
        tone: 'warn',
        icon: 'archive',
        title: c.setupBackupsStaleTitle || 'Backups found (getting old)',
        body: detail,
      };
    }
    if (result.inventoryCount > 0) {
      return {
        tone: 'ok',
        icon: 'archive',
        title: c.setupBackupsFoundTitle || 'Backups found',
        body: `Found ${result.inventoryCount} backup archive${result.inventoryCount === 1 ? '' : 's'} on this server.`,
      };
    }
    const statusNote = b?.status === 'missing'
      ? 'Backup folders are set up but no archives were found yet.'
      : 'Backup folders were checked on this server.';
    return {
      tone: 'warn',
      icon: 'folder',
      title: c.setupBackupsCheckedTitle || 'Backup folders checked',
      body: statusNote,
    };
  }

  function renderWizardBackupsDiscover() {
    const c = Labels.backupWizardCopy || {};
    const ds = backupDiscoverState;
    const scanning = ds.status === 'pending' || ds.status === 'scanning';

    let resultCard;
    if (scanning) {
      resultCard = `
        <div class="wt-setup-backup-discover wt-setup-backup-discover--scanning wt-enter">
          <span class="wt-setup-backup-discover__spinner" aria-hidden="true"></span>
          <p>${esc(c.setupBackupsScanning || 'Looking for backup files on this server…')}</p>
        </div>`;
    } else {
      const classified = ds.result || classifyBackupDiscover();
      const desc = describeBackupDiscover(classified);
      const showSettingsCta = !classified.found;
      resultCard = `
        <div class="wt-setup-backup-discover wt-setup-backup-discover--${desc.tone} wt-enter">
          <div class="wt-setup-backup-discover__icon" aria-hidden="true">
            <i data-lucide="${desc.icon}" width="28" height="28"></i>
          </div>
          <h3 class="wt-setup-backup-discover__title">${esc(desc.title)}</h3>
          <p class="wt-setup-backup-discover__body">${esc(desc.body)}</p>
          ${showSettingsCta ? `<p class="wt-setup-backup-discover__hint text-caption">${esc(desc.hint)}</p>` : ''}
          ${ds.status === 'error' ? `<p class="wt-text-caption wt-text-tertiary">${esc(c.setupBackupsScanError || '')}</p>` : ''}
          <div class="wt-setup-backup-discover__actions">
            <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="setup-backups-rescan">${esc(c.setupBackupsRescan || 'Scan again')}</button>
            ${showSettingsCta ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="setup-backups-open-settings">${esc(c.setupBackupsOpenSettings || 'Open backup settings')}</button>` : ''}
          </div>
        </div>`;
    }

    return `
      ${renderWizardStepHead(
        'Step 3',
        c.setupBackupsTitle || 'Backups',
        c.setupBackupsLead || 'Watchtower scans this server for backup archives automatically.',
      )}
      <div class="wt-setup-wizard__body">${resultCard}</div>`;
  }

  async function runBackupDiscover() {
    if (backupDiscoverState.status === 'scanning') return;
    backupDiscoverState.status = 'scanning';

    const body = document.getElementById('setup-wizard-body');
    if (body && currentStepId() === 'backups') {
      const embed = body.querySelector('.wt-setup-wizard__embed');
      if (embed) {
        embed.innerHTML = renderWizardBackupsDiscover();
        if (window.lucide) lucide.createIcons({ root: embed });
      }
    }

    try {
      if (isPreviewMode()) {
        await sleep(700);
      } else {
        const data = await WatchtowerApi.postBackupScan();
        applyBackupScanData(data);
      }
      const result = classifyBackupDiscover();
      backupDiscoverState = { status: 'done', found: result.found, result };
    } catch {
      const result = classifyBackupDiscover();
      backupDiscoverState = { status: 'error', found: result.found, result };
    }

    if (currentStepId() === 'backups') renderWizard();
  }

  function bindBackupsDiscoverStep() {
    document.getElementById('setup-backups-rescan')?.addEventListener('click', () => {
      resetBackupDiscover();
      runBackupDiscover();
    });
    document.getElementById('setup-backups-open-settings')?.addEventListener('click', () => {
      if (typeof WatchtowerBackupSettings !== 'undefined' && WatchtowerBackupSettings.openSettings) {
        WatchtowerBackupSettings.openSettings();
      }
    });
  }

  function esc(s) {
    if (typeof TowerRenderShared !== 'undefined') return TowerRenderShared.esc(s);
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function defaultPersisted() {
    return {
      version: 1,
      step: 'welcome',
      completed: {},
      skipped: {},
      auditSummary: null,
      finishedAt: null,
      dismissed: false,
    };
  }

  function readPersistedDirect() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultPersisted(), ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return null;
  }

  function loadPersisted() {
    const direct = readPersistedDirect();
    if (direct) return direct;
    return migrateLegacyKeys();
  }

  function savePersisted(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (data.finishedAt) {
      localStorage.setItem(typeof WELCOME_KEY !== 'undefined' ? WELCOME_KEY : 'watchtower-welcome-seen', '1');
    }
  }

  let migrating = false;

  function scheduleCompleteInData(persisted) {
    if (persisted?.completed?.schedule || persisted?.skipped?.schedule) return true;
    const s = state.dashboardSettings || {};
    const previewKey = typeof PREVIEW_SETTINGS_KEY !== 'undefined' ? PREVIEW_SETTINGS_KEY : 'watchtower-preview-settings';
    if (!state.apiMode) {
      return !!localStorage.getItem(previewKey) && s.report_schedule_mode != null;
    }
    return s.report_schedule_mode != null || s.report_interval_minutes != null;
  }

  function migrateLegacyKeys() {
    if (migrating) return defaultPersisted();
    migrating = true;
    try {
    const migrated = defaultPersisted();
    const welcomeSeen = localStorage.getItem(typeof WELCOME_KEY !== 'undefined' ? WELCOME_KEY : 'watchtower-welcome-seen');
    const onboardingDismissed = localStorage.getItem(typeof ONBOARDING_KEY !== 'undefined' ? ONBOARDING_KEY : 'watchtower-onboarding-dismissed');

    if (welcomeSeen) {
      migrated.completed.welcome = true;
      if (!state.noReportYet) {
        migrated.completed.audit = true;
        migrated.step = 'backups';
      }
    }
    if (onboardingDismissed) {
      migrated.dismissed = true;
      if (!state.noReportYet) migrated.completed.audit = true;
    }
    if (isBackupsConfigured()) migrated.completed.backups = true;
    if (scheduleCompleteInData(migrated)) migrated.completed.schedule = true;

    if (welcomeSeen && !state.noReportYet && isBackupsConfigured() && scheduleCompleteInData(migrated)) {
      migrated.finishedAt = new Date().toISOString();
      migrated.step = 'done';
    }

    if (welcomeSeen || onboardingDismissed || migrated.completed.audit) {
      savePersisted(migrated);
    }
    return migrated;
    } finally {
      migrating = false;
    }
  }

  function isBackupsConfigured() {
    if (typeof WatchtowerBackupSettings !== 'undefined' && WatchtowerBackupSettings.isConfigured) {
      return WatchtowerBackupSettings.isConfigured();
    }
    const backup = state.activeFacts?.optional?.last_backup;
    const ext = state.opsCache?.backup_external || state.activeFacts?.optional?.backup_external;
    const tracking = state.dashboardSettings?.backup_tracking_mode;
    if (tracking && tracking !== 'off') return true;
    if (backup?.status && backup.status !== 'unconfigured') return true;
    if (ext?.configured && (ext.status === 'success' || ext.status === 'running')) return true;
    const dirs = state.dashboardSettings?.backup_dirs;
    if (dirs && String(dirs).trim()) return true;
    return false;
  }

  function isScheduleChosen() {
    return scheduleCompleteInData(readPersistedDirect());
  }

  function isWizardComplete() {
    return !!loadPersisted().finishedAt;
  }

  function isStepDone(stepId) {
    const p = readPersistedDirect() || defaultPersisted();
    return !!p.completed[stepId] || !!p.skipped[stepId];
  }

  function requiredProgress() {
    const required = STEPS.filter((s) => s.required);
    const done = required.filter((s) => isStepDone(s.id)).length;
    return { done, total: required.length, pct: Math.round((done / required.length) * 100) };
  }

  function needsResumeCard() {
    if (isWizardComplete()) return false;
    if (sessionStorage.getItem(RESUME_HIDDEN_KEY)) return false;
    const prog = requiredProgress();
    const optionalLeft = STEPS.filter((s) => !s.required && !isStepDone(s.id));
    return prog.done < prog.total || optionalLeft.length > 0;
  }

  function nextIncompleteStep() {
    for (const s of STEPS) {
      if (!isStepDone(s.id)) return s;
    }
    return null;
  }

  function shouldAutoOpen() {
    if (new URLSearchParams(window.location.search).get('setup') === '1') return true;
    if (isWizardComplete()) return false;
    const p = loadPersisted();
    if (p.dismissed) return false;
    if (!localStorage.getItem(STORAGE_KEY)) return true;
    return false;
  }

  function needsWizard() {
    return shouldAutoOpen();
  }

  function markStep(id, { skipped = false } = {}) {
    const p = loadPersisted();
    if (skipped) p.skipped[id] = true;
    else p.completed[id] = true;
    const idx = STEPS.findIndex((s) => s.id === id);
    if (idx >= 0 && idx < STEPS.length - 1) p.step = STEPS[idx + 1].id;
    else if (idx >= 0) p.step = 'done';
    savePersisted(p);
  }

  function finishWizard() {
    const p = loadPersisted();
    p.finishedAt = new Date().toISOString();
    p.step = 'done';
    STEPS.forEach((s) => { p.completed[s.id] = true; });
    savePersisted(p);
  }

  function setRailDisabled(disabled) {
    document.querySelector('.wt-rail')?.classList.toggle('nav-disabled', disabled);
  }

  function showWizard() {
    const el = document.getElementById('tower-setup-wizard');
    el?.classList.remove('is-hidden');
    isOpen = true;
    setRailDisabled(true);
    document.getElementById('main-content').innerHTML = '';
  }

  function hideWizard() {
    document.getElementById('tower-setup-wizard')?.classList.add('is-hidden');
    isOpen = false;
    if (state.bootReady) setRailDisabled(false);
  }

  function renderDashboard() {
    if (typeof renderNav === 'function') renderNav();
    if (typeof window.render === 'function') window.render();
  }

  function showScanScreen() {
    document.getElementById('tower-setup-scan')?.classList.remove('is-hidden');
  }

  function hideScanScreen() {
    document.getElementById('tower-setup-scan')?.classList.add('is-hidden');
  }

  function setScanPhase(phaseId, status) {
    const el = document.querySelector(`#setup-scan-steps [data-phase="${phaseId}"]`);
    if (!el) return;
    el.classList.remove('is-pending', 'is-active', 'is-done');
    el.classList.add(`is-${status}`);
  }

  function updateScanProgress(done, total, indeterminate = false) {
    const wrap = document.getElementById('setup-scan-progress');
    const bar = wrap?.querySelector('.wt-setup-scan__progress-bar');
    if (!wrap || !bar) return;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    bar.style.width = `${pct}%`;
    wrap.classList.toggle('is-indeterminate', indeterminate);
  }

  function updateScanTicker(lines) {
    const el = document.getElementById('setup-scan-ticker');
    if (!el) return;
    el.innerHTML = lines.map((l) => (
      `<p class="wt-setup-scan__ticker-line"><i data-lucide="search" width="14" height="14"></i><span>${esc(l)}</span></p>`
    )).join('');
    if (window.lucide) lucide.createIcons({ root: el });
  }

  function collectDiscoveryLines(ops, meta) {
    const lines = [];
    const modCount = ops?.running_mods?.count
      ?? ops?.running_mod_count
      ?? meta?.running_mod_count
      ?? (Array.isArray(ops?.running_mods?.mods) ? ops.running_mods.mods.length : null)
      ?? state.opsCache?.running_mods?.count;
    if (modCount != null) lines.push(`Found ${modCount} mod${modCount === 1 ? '' : 's'}`);
    const crashes = ops?.crashes?.unreviewed_count ?? ops?.crashes?.unreviewed ?? ops?.crashes?.new_count;
    if (crashes != null && crashes > 0) lines.push(`${crashes} unreviewed crash${crashes === 1 ? '' : 'es'}`);
    const backup = state.activeFacts?.optional?.last_backup;
    if (backup?.status === 'unconfigured') lines.push('Backups not configured yet');
    else if (backup?.status) lines.push(`Backup status: ${backup.status}`);
    return lines;
  }

  function isPreviewMode() {
    return !state.apiMode;
  }

  function refreshDiscoveryFromState() {
    const ops = state.opsCache;
    const meta = state.overviewMeta;
    updateScanTicker(collectDiscoveryLines(ops, meta));
  }

  async function runPreviewAuditPhases() {
    auditAbort = false;
    const started = Date.now();
    showScanScreen();
    SCAN_PHASES.forEach((p) => setScanPhase(p.id, 'pending'));
    updateScanProgress(0, SCAN_PHASES.length, true);
    updateScanTicker(['Starting initial audit…']);
    document.getElementById('setup-scan-actions')?.classList.add('is-hidden');
    document.getElementById('setup-scan-progress')?.classList.remove('is-hidden');
    const statusEl = document.getElementById('setup-scan-status');
    if (statusEl) statusEl.textContent = 'Static preview — using bundled demo fixtures';

    const elapsedTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const el = document.getElementById('setup-scan-elapsed');
      if (el && elapsed >= 5) el.textContent = `${elapsed}s elapsed`;
    }, 1000);

    const previewDurations = { logs: 600, crashes: 500, mods: 700, backups: 500, baseline: 1800, issues: 400 };
    for (let i = 0; i < SCAN_PHASES.slice(0, 4).length; i++) {
      const phase = SCAN_PHASES[i];
      if (auditAbort) break;
      setScanPhase(phase.id, 'active');
      updateScanProgress(i, SCAN_PHASES.length, true);
      if (statusEl) statusEl.textContent = phase.label;
      refreshDiscoveryFromState();
      await sleep(previewDurations[phase.id] || MIN_STEP_MS);
      setScanPhase(phase.id, 'done');
      updateScanProgress(i + 1, SCAN_PHASES.length, false);
    }

    setScanPhase('baseline', 'active');
    updateScanProgress(4, SCAN_PHASES.length, true);
    if (statusEl) statusEl.textContent = 'Building 30-day health baseline…';
    await sleep(previewDurations.baseline);
    setScanPhase('baseline', 'done');
    updateScanProgress(5, SCAN_PHASES.length, false);

    setScanPhase('issues', 'active');
    updateScanProgress(5, SCAN_PHASES.length, true);
    refreshDiscoveryFromState();
    await sleep(previewDurations.issues);
    setScanPhase('issues', 'done');
    updateScanProgress(SCAN_PHASES.length, SCAN_PHASES.length, false);

    clearInterval(elapsedTimer);
    document.getElementById('setup-scan-progress')?.classList.add('is-hidden');

    const summary = buildAuditSummary(true);
    const p = loadPersisted();
    p.auditSummary = summary;
    p.completed.audit = true;
    savePersisted(p);
    hideScanScreen();
    return { ok: true, summary };
  }

  async function refreshOpsData() {
    if (isPreviewMode()) {
      refreshDiscoveryFromState();
      return;
    }
    try {
      const [ops, meta] = await Promise.all([
        WatchtowerApi.fetchOpsCache().catch(() => null),
        WatchtowerApi.fetchOverviewMeta().catch(() => null),
      ]);
      if (ops) state.opsCache = ops;
      if (meta) state.overviewMeta = meta;
      updateScanTicker(collectDiscoveryLines(ops || state.opsCache, meta || state.overviewMeta));
    } catch { /* ignore */ }
  }

  async function runOnboardingAuditKickoff() {
    try {
      return await WatchtowerApi.postOnboardingAudit();
    } catch {
      return null;
    }
  }

  async function runAuditPhases(onProgress) {
    if (isPreviewMode()) {
      return runPreviewAuditPhases();
    }
    auditAbort = false;
    const started = Date.now();
    let elapsedTimer = null;

    showScanScreen();
    SCAN_PHASES.forEach((p) => setScanPhase(p.id, 'pending'));
    updateScanProgress(0, SCAN_PHASES.length, true);
    updateScanTicker(['Starting initial audit…']);
    document.getElementById('setup-scan-actions')?.classList.add('is-hidden');
    document.getElementById('setup-scan-progress')?.classList.remove('is-hidden');

    elapsedTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const el = document.getElementById('setup-scan-elapsed');
      if (el && elapsed >= 30) el.textContent = `${elapsed}s elapsed`;
    }, 1000);

    await runOnboardingAuditKickoff();

    for (let i = 0; i < SCAN_PHASES.slice(0, 4).length; i++) {
      const phase = SCAN_PHASES[i];
      if (auditAbort) break;
      setScanPhase(phase.id, 'active');
      updateScanProgress(i, SCAN_PHASES.length, true);
      onProgress?.(phase.id, 'active');
      const t0 = Date.now();
      try {
        if (phase.run) await phase.run();
      } catch { /* continue */ }
      await refreshOpsData();
      const wait = Math.max(0, MIN_STEP_MS - (Date.now() - t0));
      if (wait) await sleep(wait);
      setScanPhase(phase.id, 'done');
      updateScanProgress(i + 1, SCAN_PHASES.length, false);
      onProgress?.(phase.id, 'done');
    }

    setScanPhase('baseline', 'active');
    updateScanProgress(4, SCAN_PHASES.length, true);
    onProgress?.('baseline', 'active');
    let reportOk = false;
    try {
      const runRes = await WatchtowerApi.runReport({ lookbackHours: 720, since: null, incremental: false });
      if (runRes?.status === 'already_running') {
        const msgEl = document.getElementById('setup-scan-status');
        if (msgEl) msgEl.textContent = 'A report is already running — waiting for it to finish…';
      }
      const timeoutMin = state.liveConfig?.report_timeout_minutes ?? 15;
      const pollDeadline = Date.now() + (timeoutMin * 60 * 1000) + 60_000;
      let showBackgroundAfter = Date.now() + 30_000;
      for (;;) {
        if (auditAbort) break;
        if (Date.now() > pollDeadline) {
          const msgEl = document.getElementById('setup-scan-status');
          if (msgEl) msgEl.textContent = `Report timed out after ${timeoutMin} minutes. You can retry or skip the audit.`;
          document.getElementById('setup-scan-actions')?.classList.remove('is-hidden');
          break;
        }
        await sleep(2000);
        const status = await WatchtowerApi.fetchReportStatus();
        const msgEl = document.getElementById('setup-scan-status');
        if (msgEl) msgEl.textContent = status.message || 'Building baseline report…';
        if (Date.now() >= showBackgroundAfter) {
          document.getElementById('setup-scan-background')?.classList.remove('is-hidden');
          document.getElementById('setup-scan-actions')?.classList.remove('is-hidden');
        }
        if (!status.running) {
          reportOk = !!status.success;
          if (!reportOk) {
            if (msgEl) {
              msgEl.textContent = status.message
                ? `Report failed: ${status.message}`
                : 'Report finished without a successful baseline.';
            }
            document.getElementById('setup-scan-actions')?.classList.remove('is-hidden');
          }
          break;
        }
      }
      if (reportOk && typeof loadDataFromApi === 'function') {
        await loadDataFromApi();
        state.selectedReportId = 'latest';
        localStorage.setItem(typeof SELECTED_REPORT_KEY !== 'undefined' ? SELECTED_REPORT_KEY : 'watchtower-selected-report', 'latest');
        if (typeof populateReportSelect === 'function') populateReportSelect();
        if (typeof fetchOverviewMeta === 'function') await fetchOverviewMeta();
        state.noReportYet = false;
      }
    } catch (e) {
      reportOk = false;
      const msgEl = document.getElementById('setup-scan-status');
      if (msgEl) msgEl.textContent = `Report failed: ${e.message}`;
      document.getElementById('setup-scan-actions')?.classList.remove('is-hidden');
    }

    if (reportOk) {
      setScanPhase('baseline', 'done');
      updateScanProgress(5, SCAN_PHASES.length, false);
      setScanPhase('issues', 'active');
      updateScanProgress(5, SCAN_PHASES.length, true);
      await refreshOpsData();
      await sleep(MIN_STEP_MS);
      setScanPhase('issues', 'done');
      updateScanProgress(SCAN_PHASES.length, SCAN_PHASES.length, false);
    } else if (!auditAbort) {
      setScanPhase('baseline', 'pending');
    }

    clearInterval(elapsedTimer);
    document.getElementById('setup-scan-progress')?.classList.add('is-hidden');

    const summary = buildAuditSummary(reportOk);
    const p = loadPersisted();
    p.auditSummary = summary;
    if (reportOk) p.completed.audit = true;
    savePersisted(p);

    if (reportOk) {
      hideScanScreen();
      return { ok: true, summary };
    }
    return { ok: false, summary };
  }

  function buildAuditSummary(reportOk) {
    const f = state.activeFacts || state.facts;
    const issues = f?.issues?.length ?? 0;
    const mods = f?.minecraft?.mods?.length
      ?? state.opsCache?.running_mods?.count
      ?? state.opsCache?.running_mod_count
      ?? state.overviewMeta?.running_mod_count
      ?? 0;
    const crashes = state.opsCache?.crashes?.unreviewed_count
      ?? state.opsCache?.crashes?.unreviewed
      ?? state.opsCache?.crashes?.new_count
      ?? 0;
    const backupStatus = f?.optional?.last_backup?.status || 'unknown';
    const health = f?.health?.grade || f?.health?.status || '—';
    const busy = mods > 80 || crashes > 3 || issues > 10;
    return {
      reportOk,
      mods,
      crashes,
      issues,
      backupStatus,
      health,
      tone: busy ? 'busy' : 'quiet',
      lookbackDays: 30,
    };
  }

  function setupHostname() {
    return state.liveConfig?.hostname || state.activeFacts?.meta?.hostname || '';
  }

  function previousStepId(stepId) {
    if (stepId === 'done') return STEPS[STEPS.length - 1]?.id || null;
    const idx = STEPS.findIndex((s) => s.id === stepId);
    return idx > 0 ? STEPS[idx - 1].id : null;
  }

  function stepMeta(stepId) {
    if (stepId === 'done') {
      return { index: STEPS.length, total: STEPS.length, label: 'Complete' };
    }
    const idx = STEPS.findIndex((s) => s.id === stepId);
    const step = STEPS[idx];
    return {
      index: idx + 1,
      total: STEPS.length,
      label: step?.label || stepId,
      required: step?.required !== false,
    };
  }

  function goBack(stepId) {
    const prev = previousStepId(stepId);
    if (!prev) return;
    const p = loadPersisted();
    p.step = prev;
    savePersisted(p);
    renderWizard();
  }

  function canGoBack(stepId) {
    return !!previousStepId(stepId);
  }

  function renderWizardStepHead(eyebrow, title, leadHtml) {
    return `
      <header class="wt-setup-wizard__head">
        ${eyebrow ? `<p class="wt-setup-wizard__eyebrow">${esc(eyebrow)}</p>` : ''}
        <h2 class="wt-setup-wizard__title" id="setup-wizard-title">${esc(title)}</h2>
        <p class="wt-setup-wizard__lead">${leadHtml}</p>
      </header>`;
  }

  function healthSeverityClass(grade) {
    const g = String(grade || '').toUpperCase().charAt(0);
    if (g === 'A' || g === 'B') return 'wt-card--severity-ok';
    if (g === 'C') return 'wt-card--severity-warn';
    if (g === 'D' || g === 'F') return 'wt-card--severity-critical';
    return '';
  }

  function renderWizardStepRail(currentId) {
    const p = loadPersisted();
    const prog = requiredProgress();
    const host = setupHostname();
    const currentIdx = currentId === 'done'
      ? STEPS.length
      : STEPS.findIndex((s) => s.id === currentId);
    const stepNum = currentIdx >= 0 ? currentIdx + 1 : STEPS.length;

    return `
      <div class="wt-setup-wizard__brand">
        <img src="assets/watchtower-wordmark.png?v=4" alt="" class="wt-wordmark" width="40" height="40">
        <div>
          <div class="wt-setup-wizard__brand-title">Setup</div>
          ${host ? `<div class="wt-setup-wizard__brand-host">${esc(host)}</div>` : ''}
        </div>
      </div>
      <div class="wt-setup-wizard__progress-meta">
        <span>${prog.done} of ${prog.total} required</span>
        <span>Step ${stepNum} of ${STEPS.length}</span>
      </div>
      <div class="wt-setup-wizard__progress" aria-hidden="true">
        <div class="wt-setup-wizard__progress-bar" style="width:${prog.pct}%"></div>
      </div>
      <ol class="wt-setup-steps" aria-label="Setup progress">
        ${STEPS.map((s, stepIdx) => {
          const active = s.id === currentId;
          const done = stepIdx < currentIdx;
          const icon = STEP_ICONS[s.id] || 'circle';
          const connector = stepIdx < STEPS.length - 1
            ? `<span class="wt-setup-steps__connector${done ? ' is-done' : ''}" aria-hidden="true"></span>`
            : '';
          return `
            <li class="wt-setup-steps__item${active ? ' is-active' : ''}${done ? ' is-done' : ''}">
              <span class="wt-setup-steps__track">
                <span class="wt-setup-steps__icon" aria-hidden="true">
                  ${done ? '<i data-lucide="check" width="14" height="14"></i>' : `<i data-lucide="${icon}" width="16" height="16"></i>`}
                </span>
                ${connector}
              </span>
              <span class="wt-setup-steps__label">
                <span class="wt-setup-steps__name">${esc(s.label)}</span>
                ${!s.required ? '<span class="wt-setup-steps__pill">Optional</span>' : ''}
              </span>
            </li>`;
        }).join('')}
      </ol>`;
  }

  function renderWizardWelcome() {
    const host = setupHostname() || 'your server';
    const previewNote = isPreviewMode()
      ? '<br><span class="wt-text-caption wt-text-tertiary">Demo preview — sample data, no live server required.</span>'
      : '';
    return `
      ${renderWizardStepHead(
        'First-time setup',
        'Welcome to Watchtower',
        `We'll scan <strong>${esc(host)}</strong>, build a 30-day health baseline, look for backups,
          and help you set scheduled reports and security. Takes about 5 minutes.${previewNote}`,
      )}
      <div class="wt-setup-wizard__body wt-enter">
        <div class="wt-setup-features">
          <article class="wt-card wt-card--surface wt-setup-feature">
            <span class="wt-setup-feature__icon"><i data-lucide="activity" width="18" height="18"></i></span>
            <h3 class="wt-setup-feature__title">Live from the start</h3>
            <p class="wt-setup-feature__desc">Charts and player counts work immediately — no report required.</p>
          </article>
          <article class="wt-card wt-card--surface wt-setup-feature">
            <span class="wt-setup-feature__icon"><i data-lucide="scan-search" width="18" height="18"></i></span>
            <h3 class="wt-setup-feature__title">Audit unlocks depth</h3>
            <p class="wt-setup-feature__desc">Issues, mod analysis, and session history open after the baseline scan.</p>
          </article>
          <article class="wt-card wt-card--surface wt-setup-feature">
            <span class="wt-setup-feature__icon"><i data-lucide="lock" width="18" height="18"></i></span>
            <h3 class="wt-setup-feature__title">Stays on your server</h3>
            <p class="wt-setup-feature__desc">All data stays local — nothing is sent to external services.</p>
          </article>
        </div>
      </div>`;
  }

  function renderWizardAuditIntro() {
    const p = loadPersisted();
    if (p.auditSummary?.reportOk) return renderWizardAuditSummary(p.auditSummary);
    return `
      ${renderWizardStepHead(
        'Step 2',
        'Initial server audit',
        'Watchtower will scan logs, crash reports, mods, and backups, then run a 30-day baseline health report. You\'ll see live progress while it works.',
      )}
      <div class="wt-setup-wizard__body wt-enter">
        <div class="wt-setup-audit-checklist">
          <div class="wt-setup-audit-checklist__row">
            <i data-lucide="file-text" width="16" height="16"></i>
            <span>Server logs and activity patterns</span>
          </div>
          <div class="wt-setup-audit-checklist__row">
            <i data-lucide="bug" width="16" height="16"></i>
            <span>Crash reports and unreviewed dumps</span>
          </div>
          <div class="wt-setup-audit-checklist__row">
            <i data-lucide="package" width="16" height="16"></i>
            <span>Mod inventory and backup status</span>
          </div>
          <div class="wt-setup-audit-checklist__row">
            <i data-lucide="heart-pulse" width="16" height="16"></i>
            <span>30-day health baseline report</span>
          </div>
        </div>
      </div>`;
  }

  function renderWizardAuditKpi(label, value, severityCls = '') {
    return `
      <article class="wt-card wt-card--surface wt-setup-audit-kpi ${severityCls}">
        <div class="wt-kpi">
          <div class="wt-kpi__value">${value}</div>
          <div class="wt-kpi__label">${esc(label)}</div>
        </div>
      </article>`;
  }

  function renderWizardAuditSummary(summary) {
    const tone = summary.tone === 'busy'
      ? 'Your server has plenty of history — the dashboard will be informative right away.'
      : 'Your server looks fairly quiet — you\'re starting from a clean baseline.';
    return `
      ${renderWizardStepHead('Audit complete', 'Baseline ready', esc(tone))}
      <div class="wt-setup-wizard__body wt-enter">
        <div class="wt-setup-audit-summary">
          ${renderWizardAuditKpi('Mods', summary.mods)}
          ${renderWizardAuditKpi('Crashes', summary.crashes)}
          ${renderWizardAuditKpi('Issues', summary.issues)}
          ${renderWizardAuditKpi('Health grade', esc(String(summary.health)), healthSeverityClass(summary.health))}
        </div>
        <p class="wt-text-caption wt-text-tertiary">Scanned ${summary.lookbackDays} days of logs and host metrics.</p>
      </div>`;
  }

  function renderWizardDone() {
    const p = loadPersisted();
    const s = p.auditSummary;
    const issueNote = s
      ? `Found ${s.issues} issue${s.issues === 1 ? '' : 's'} to review on the Issues tab.`
      : 'Open Overview for a health summary, or check Issues for prioritized fixes.';
    return `
      <div class="wt-setup-done wt-enter">
        <div class="wt-setup-done__icon" aria-hidden="true">
          <i data-lucide="circle-check" width="32" height="32"></i>
        </div>
        ${renderWizardStepHead('Setup complete', "You're all set", `Watchtower is configured and your baseline report is ready. ${esc(issueNote)}`)}
        <div class="wt-setup-done__links">
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="setup-wizard-goto-issues">
            <i data-lucide="triangle-alert" width="14" height="14"></i> Go to Issues
          </button>
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="setup-wizard-goto-overview">
            <i data-lucide="layout-dashboard" width="14" height="14"></i> Explore Overview
          </button>
        </div>
      </div>`;
  }

  function renderWizardStepContent(stepId) {
    switch (stepId) {
      case 'welcome': return renderWizardWelcome();
      case 'audit': return renderWizardAuditIntro();
      case 'backups': return renderWizardBackupsDiscover();
      case 'schedule':
        return typeof WatchtowerSettings !== 'undefined'
          ? WatchtowerSettings.renderScheduleEmbed(state.dashboardSettings || {})
          : '<p>Settings unavailable.</p>';
      case 'security':
        return typeof WatchtowerSettings !== 'undefined'
          ? WatchtowerSettings.renderSecurityEmbedCompact()
          : '<p>Security settings unavailable.</p>';
      case 'done': return renderWizardDone();
      default: return '';
    }
  }

  function renderWizardActions(stepId) {
    const p = loadPersisted();
    if (stepId === 'welcome') {
      return `
        <button type="button" class="wt-btn wt-btn--primary" id="setup-wizard-next">Get started</button>
        <button type="button" class="wt-btn wt-btn--ghost setup-wizard-exit wt-setup-wizard__exit">Exit setup</button>`;
    }
    if (stepId === 'audit') {
      if (p.auditSummary?.reportOk) {
        return `<button type="button" class="wt-btn wt-btn--primary" id="setup-wizard-next">Continue</button>`;
      }
      if (p.skipped?.audit) {
        return `
        <button type="button" class="wt-btn wt-btn--primary" id="setup-wizard-next">Continue</button>
        <button type="button" class="wt-btn wt-btn--ghost" id="setup-wizard-run-audit">Run audit</button>
        <button type="button" class="wt-btn wt-btn--ghost setup-wizard-exit wt-setup-wizard__exit">Exit setup</button>`;
      }
      return `
        <button type="button" class="wt-btn wt-btn--primary" id="setup-wizard-run-audit">Run initial audit</button>
        <button type="button" class="wt-btn wt-btn--ghost setup-wizard-exit wt-setup-wizard__exit">Exit setup</button>`;
    }
    if (stepId === 'backups') {
      return `
        <button type="button" class="wt-btn wt-btn--primary" id="setup-wizard-next">Continue</button>
        <button type="button" class="wt-btn wt-btn--ghost setup-wizard-exit wt-setup-wizard__exit">Exit setup</button>`;
    }
    if (stepId === 'schedule') {
      return `
        <button type="button" class="wt-btn wt-btn--primary" id="setup-wizard-save-schedule">Save & continue</button>
        <button type="button" class="wt-btn wt-btn--ghost setup-wizard-exit wt-setup-wizard__exit">Exit setup</button>`;
    }
    if (stepId === 'security') {
      return `
        <button type="button" class="wt-btn wt-btn--primary" id="setup-wizard-next">Continue</button>
        <button type="button" class="wt-btn wt-btn--ghost" id="setup-wizard-skip-step">Skip — I'll do this later</button>
        <button type="button" class="wt-btn wt-btn--ghost setup-wizard-exit wt-setup-wizard__exit">Exit setup</button>`;
    }
    if (stepId === 'done') {
      return `<button type="button" class="wt-btn wt-btn--primary" id="setup-wizard-finish">Go to dashboard</button>`;
    }
    return '';
  }

  function currentStepId() {
    const p = loadPersisted();
    if (p.step === 'done' || p.step === 'tour') return 'done';
    if (p.step && STEPS.some((s) => s.id === p.step)) return p.step;
    for (const s of STEPS) {
      if (!p.completed[s.id] && !p.skipped[s.id]) return s.id;
    }
    return 'done';
  }

  function renderWizardToolbar(stepId) {
    const meta = stepMeta(stepId);
    const back = canGoBack(stepId) ? `
      <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm wt-setup-wizard__back" id="setup-wizard-back">
        <i data-lucide="arrow-left" width="16" height="16"></i>
        <span>Back</span>
      </button>` : '<span class="wt-setup-wizard__back-spacer" aria-hidden="true"></span>';
    const optional = meta.required === false ? '<span class="wt-setup-wizard__step-pill">Optional</span>' : '';
    return `
      <div class="wt-setup-wizard__toolbar-inner">
        ${back}
        <div class="wt-setup-wizard__toolbar-meta">
          <span class="wt-setup-wizard__step-chip">Step ${meta.index} of ${meta.total}</span>
          ${optional}
        </div>
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm setup-wizard-exit wt-setup-wizard__toolbar-exit">
          <i data-lucide="x" width="16" height="16"></i>
          <span class="wt-setup-wizard__toolbar-exit-label">Exit</span>
        </button>
      </div>`;
  }

  function bindBackButtons(stepId) {
    document.getElementById('setup-wizard-back')?.addEventListener('click', () => goBack(stepId));
  }

  function renderWizard() {
    const stepId = currentStepId();
    const body = document.getElementById('setup-wizard-body');
    const rail = document.getElementById('setup-wizard-rail');
    const toolbar = document.getElementById('setup-wizard-toolbar');
    const actions = document.getElementById('setup-wizard-actions');
    if (!body) return;

    if (stepId === 'done') {
      if (rail) rail.innerHTML = renderWizardStepRail('done');
      if (toolbar) toolbar.innerHTML = renderWizardToolbar('done');
      body.innerHTML = `<div class="wt-setup-wizard__embed wt-setup-wizard__embed--done">${renderWizardDone()}</div>`;
      if (actions) actions.innerHTML = renderWizardActions('done');
    } else {
      if (rail) rail.innerHTML = renderWizardStepRail(stepId);
      if (toolbar) toolbar.innerHTML = renderWizardToolbar(stepId);
      body.innerHTML = `<div class="wt-setup-wizard__embed">${renderWizardStepContent(stepId)}</div>`;
      if (actions) actions.innerHTML = renderWizardActions(stepId);
    }

    if (stepId === 'backups') {
      if (backupDiscoverState.status === 'pending') runBackupDiscover();
      bindBackupsDiscoverStep();
    }

    if (stepId === 'security' && typeof WatchtowerSettings !== 'undefined') {
      WatchtowerSettings.bindSecurityEmbedCompact(body);
    }

    if (stepId === 'schedule') {
      body.querySelectorAll('.wt-bs-option-card input[type="radio"]').forEach((input) => {
        input.addEventListener('change', () => {
          body.querySelectorAll('.wt-bs-option-card').forEach((card) => card.classList.remove('is-selected'));
          input.closest('.wt-bs-option-card')?.classList.add('is-selected');
        });
      });
    }

    body.querySelectorAll('.setup-wizard-exit').forEach((btn) => {
      btn.addEventListener('click', () => dismiss());
    });

    bindBackButtons(stepId);

    document.getElementById('setup-wizard-next')?.addEventListener('click', () => advance(stepId));
    document.getElementById('setup-wizard-run-audit')?.addEventListener('click', () => startAudit());
    document.getElementById('setup-wizard-save-schedule')?.addEventListener('click', () => saveScheduleAndAdvance());
    document.getElementById('setup-wizard-skip-step')?.addEventListener('click', () => skipStep(stepId));
    document.getElementById('setup-wizard-finish')?.addEventListener('click', () => completeAndClose());
    document.getElementById('setup-wizard-goto-issues')?.addEventListener('click', () => finishAndGoToTab('issues'));
    document.getElementById('setup-wizard-goto-overview')?.addEventListener('click', () => finishAndGoToTab('overview'));

    document.getElementById('setup-scan-retry')?.addEventListener('click', () => startAudit());
    document.getElementById('setup-scan-skip')?.addEventListener('click', () => {
      hideScanScreen();
      const p = loadPersisted();
      const auditAlreadyPassed = !!(p.completed?.audit || p.skipped?.audit);
      if (!auditAlreadyPassed) resetBackupDiscover();
      markStep('audit', { skipped: true });
      renderWizard();
    });
    document.getElementById('setup-scan-background')?.addEventListener('click', () => {
      hideScanScreen();
      dismiss();
    });

    if (window.lucide) lucide.createIcons({ root: document.getElementById('tower-setup-wizard') });
  }

  async function startAudit() {
    const p = loadPersisted();
    const auditAlreadyPassed = !!(p.completed?.audit || p.skipped?.audit);
    const result = await runAuditPhases();
    if (result.ok) {
      markStep('audit');
      if (!auditAlreadyPassed) resetBackupDiscover();
      renderWizard();
    }
  }

  async function saveScheduleAndAdvance() {
    if (typeof WatchtowerSettings === 'undefined') {
      markStep('schedule');
      renderWizard();
      return;
    }
    try {
      await WatchtowerSettings.saveScheduleFromEmbed(document.getElementById('tower-setup-wizard'));
      markStep('schedule');
      renderWizard();
    } catch (e) {
      if (typeof showToast === 'function') showToast(`Save failed: ${e.message}`, 'error');
    }
  }

  function skipStep(stepId) {
    markStep(stepId, { skipped: true });
    renderWizard();
  }

  function advance(stepId) {
    if (stepId === 'audit') {
      const p = loadPersisted();
      const auditAlreadyPassed = !!(p.completed?.audit || p.skipped?.audit);
      markStep(stepId);
      if (!auditAlreadyPassed) resetBackupDiscover();
      renderWizard();
      return;
    }
    markStep(stepId);
    renderWizard();
  }

  function dismiss() {
    auditAbort = true;
    hideScanScreen();
    const p = loadPersisted();
    p.dismissed = true;
    savePersisted(p);
    hideWizard();
    if (typeof startLiveSimulation === 'function') startLiveSimulation();
    renderDashboard();
  }

  function completeAndClose() {
    finishWizard();
    hideWizard();
    if (typeof startLiveSimulation === 'function') startLiveSimulation();
    renderDashboard();
  }

  function finishAndGoToTab(tab) {
    finishWizard();
    hideWizard();
    if (typeof startLiveSimulation === 'function') startLiveSimulation();
    state.activeTab = tab;
    if (typeof TowerNav !== 'undefined') TowerNav.setActiveTab(tab);
    else document.querySelector(`.wt-rail__link[data-tab="${tab}"]`)?.click();
    renderDashboard();
  }

  function open(options = {}) {
    loadPersisted();
    const setupDeepLink = new URLSearchParams(window.location.search).get('setup') === '1';
    if (setupDeepLink && isWizardComplete() && !options.replay && !options.step) {
      options = { ...options, force: true, replay: true };
    }
    if (options.replay) {
      const p = loadPersisted();
      p.dismissed = false;
      p.finishedAt = null;
      ['schedule', 'security'].forEach((id) => {
        delete p.completed[id];
        delete p.skipped[id];
      });
      p.step = options.step || 'schedule';
      savePersisted(p);
    }
    if (options.step) {
      const p = loadPersisted();
      p.step = options.step;
      p.dismissed = false;
      savePersisted(p);
    }
    if (options.force) {
      const p = loadPersisted();
      p.dismissed = false;
      savePersisted(p);
    }
    sessionStorage.removeItem(RESUME_HIDDEN_KEY);
    showWizard();
    renderWizard();
  }

  function renderWizardResumeCard() {
    if (!needsResumeCard()) return '';
    const prog = requiredProgress();
    const next = nextIncompleteStep();
    const nextLabel = next ? next.label : 'Finish setup';
    const dots = STEPS.filter((s) => s.required).map((s) => {
      const done = isStepDone(s.id);
      const active = next?.id === s.id;
      return `<span class="wt-setup-resume__dot${done ? ' is-done' : ''}${active ? ' is-active' : ''}" aria-hidden="true"></span>`;
    }).join('');
    return `
      <section class="wt-setup-resume wt-panel wt-enter" id="setup-resume-card">
        <div class="onboarding-head wt-panel__head">
          <h2 class="wt-panel__title"><i data-lucide="rocket" width="18" height="18"></i> Finish setup</h2>
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="setup-resume-dismiss">Dismiss</button>
        </div>
        <div class="wt-setup-resume__dots" aria-hidden="true">${dots}</div>
        <div class="wt-setup-resume__progress" aria-hidden="true">
          <div class="wt-setup-resume__progress-bar" style="width:${prog.pct}%"></div>
        </div>
        <p class="wt-setup-resume__next">Next: <strong>${esc(nextLabel)}</strong> · ${prog.done} of ${prog.total} required steps done</p>
        <div class="onboarding-actions">
          <button type="button" class="wt-btn wt-btn--primary wt-btn--sm" id="setup-resume-btn">Resume setup</button>
        </div>
      </section>`;
  }

  function bindResumeCard() {
    document.getElementById('setup-resume-dismiss')?.addEventListener('click', () => {
      sessionStorage.setItem(RESUME_HIDDEN_KEY, '1');
      if (typeof window.render === 'function') window.render();
    });
    document.getElementById('setup-resume-btn')?.addEventListener('click', () => {
      open({ force: true, step: nextIncompleteStep()?.id });
    });
  }

  function init() {
    const scanEl = document.getElementById('tower-setup-scan');
    if (scanEl && !scanEl.querySelector('#setup-scan-steps')) {
      scanEl.innerHTML = `
        <div class="wt-auth__card wt-panel--glass wt-setup-scan__card">
          <img src="assets/watchtower-wordmark.png?v=4" alt="Watchtower" class="wt-boot__logo wt-wordmark" width="80" height="80">
          <h2 class="wt-boot__title">Initial audit</h2>
          <ol class="wt-boot__steps wt-setup-scan__steps" id="setup-scan-steps">
            ${SCAN_PHASES.map((p) => `
              <li class="wt-boot__step is-pending" data-phase="${p.id}">${esc(p.label)}</li>`).join('')}
          </ol>
          <div class="wt-setup-scan__progress" id="setup-scan-progress">
            <div class="wt-setup-scan__progress-bar"></div>
          </div>
          <p class="wt-text-caption wt-text-secondary" id="setup-scan-status">Preparing scan…</p>
          <div class="wt-setup-scan__ticker" id="setup-scan-ticker"></div>
          <p class="wt-setup-scan__elapsed" id="setup-scan-elapsed"></p>
          <div class="wt-setup-scan__actions is-hidden" id="setup-scan-actions">
            <button type="button" class="wt-btn wt-btn--primary" id="setup-scan-retry">Retry</button>
            <button type="button" class="wt-btn wt-btn--ghost" id="setup-scan-skip">Skip audit</button>
            <button type="button" class="wt-btn wt-btn--ghost is-hidden" id="setup-scan-background">Continue in background</button>
          </div>
        </div>`;
    }
  }

  return {
    init,
    open,
    dismiss,
    needsWizard,
    shouldAutoOpen,
    isWizardComplete,
    needsResumeCard,
    renderResumeCard: renderWizardResumeCard,
    renderWizardResumeCard,
    bindResumeCard,
    isBackupsConfigured,
    isStepDone,
    nextIncompleteStep,
    requiredProgress,
    runAuditPhases,
    finishWizard,
  };
})();
