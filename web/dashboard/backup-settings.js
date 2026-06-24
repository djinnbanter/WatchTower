/**
 * Shared backup setup — Settings → Backups wizard and API helpers.
 */
const WatchtowerBackupSettings = (function () {
  const esc = (s) => (typeof TowerRenderShared !== 'undefined' ? TowerRenderShared.esc(s) : String(s ?? ''));

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function copy() {
    return Labels.backupWizardCopy || {};
  }

  const wizardState = {
    step: 1,
    revealedToken: null,
    backupSource: null,
    notifyMethod: null,
  };

  function externalFormDefaults() {
    const s = state.dashboardSettings || {};
    const tracking = s.backup_tracking_mode || 'off';
    const hasLocalDirs = !!(s.backup_dirs && String(s.backup_dirs).trim());
    let backupSource = 'local_only';
    let notifyMethod = 'webhook';
    if (tracking !== 'off') {
      backupSource = hasLocalDirs || (state.activeFacts?.optional?.last_backup?.status !== 'unconfigured')
        ? 'hybrid' : 'external_only';
      notifyMethod = tracking === 'both' ? 'both' : tracking;
    }
    const source = wizardState.backupSource || backupSource;
    let notify = wizardState.notifyMethod || notifyMethod;
    if ((source === 'external_only' || source === 'hybrid') && wizardState.step >= 2 && !wizardState.notifyMethod) {
      notify = 'webhook';
    }
    return {
      backupSource: source,
      notifyMethod: notify,
      markerRel: s.backup_external_marker_rel || 'watchtower/backup-heartbeat.json',
      suppressLocal: s.backup_suppress_local_missing !== false,
      webhookEnabled: !!s.backup_webhook_enabled,
      trackingMode: tracking,
    };
  }

  function mapToTrackingMode(backupSource, notifyMethod) {
    if (backupSource === 'local_only') return 'off';
    if (notifyMethod === 'marker') return 'marker';
    if (notifyMethod === 'both') return 'both';
    return 'webhook';
  }

  function buildWebhookCurl(host, port, token) {
    const base = `http://${host}:${port}/api/backups/heartbeat`;
    return `curl -sS -X POST "${base}" \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"ok","source":"panel"}'`;
  }

  function resolveDashboardHost() {
    const s = state.dashboardSettings || {};
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return window.location.hostname;
    }
    return s.hostname || 'localhost';
  }

  function resolveDashboardPort() {
    const s = state.dashboardSettings || {};
    return s.dashboard_port || state.liveConfig?.dashboard_port || 8787;
  }

  function markerJsonExample() {
    return JSON.stringify({
      last_at: new Date().toISOString(),
      source: 'my-backup-job',
      status: 'ok',
    }, null, 2);
  }

  function applyExternalSettingsFromResponse(data) {
    if (data.settings) {
      state.dashboardSettings = { ...(state.dashboardSettings || {}), ...data.settings };
    }
    if (data.backup_webhook_token) {
      wizardState.revealedToken = data.backup_webhook_token;
    }
    if (wizardState.step < 2 && (wizardState.backupSource === 'external_only' || wizardState.backupSource === 'hybrid')) {
      wizardState.step = 2;
    }
  }

  function applyExternalHeartbeatToState(backupExternal) {
    if (!backupExternal) return;
    state.opsCache = state.opsCache || {};
    state.opsCache.backup_external = backupExternal;
    if (!state.activeFacts.optional) state.activeFacts.optional = {};
    state.activeFacts.optional.backup_external = backupExternal;
    if (state.facts?.optional) state.facts.optional.backup_external = backupExternal;
    if (state.reportCache.latest?.facts?.optional) {
      state.reportCache.latest.facts.optional.backup_external = backupExternal;
    }
  }

  function getExternalStatus() {
    const ext = state.opsCache?.backup_external
      || state.activeFacts?.optional?.backup_external
      || null;
    return ext;
  }

  function showPhantomBanner(form) {
    const tracking = form.trackingMode;
    const ext = getExternalStatus();
    const c = copy();
    if (tracking === 'marker' && ext?.status === 'missing') {
      return `
        <div class="wt-bs-banner wt-bs-banner--info" role="status">
          <p><strong>${esc(c.phantomBannerTitle || 'Not using panel backups?')}</strong> ${c.phantomBanner || ''}</p>
        </div>`;
    }
    return '';
  }

  function renderStepRail(step, needsConnect) {
    const c = copy();
    const steps = needsConnect
      ? [
        { n: 1, label: c.stepWhere || 'Where your backups are' },
        { n: 2, label: c.stepConnect || 'Connect your panel' },
      ]
      : [{ n: 1, label: c.stepWhere || 'Where your backups are' }];
    return `
      <ol class="wt-bs-steps" aria-label="Setup progress">
        ${steps.map((s) => `
          <li class="wt-bs-steps__item${s.n === step ? ' is-active' : ''}${s.n < step ? ' is-done' : ''}">
            <span class="wt-bs-steps__num">${s.n}</span>
            <span class="wt-bs-steps__label">${esc(s.label)}</span>
          </li>`).join('')}
      </ol>`;
  }

  function renderSourceCards(selected) {
    const cards = copy().sourceCards || [];
    return `
      <div class="wt-bs-option-grid" role="radiogroup" aria-label="Where are your backups?">
        ${cards.map((o) => `
          <label class="wt-bs-option-card${selected === o.id ? ' is-selected' : ''}">
            <input type="radio" name="bs-backup-source" value="${o.id}" ${selected === o.id ? 'checked' : ''}>
            <span class="wt-bs-option-card__title">${esc(o.title)}</span>
            <span class="wt-bs-option-card__desc">${esc(o.desc)}</span>
            ${o.example ? `<span class="wt-bs-option-card__example">${esc(o.example)}</span>` : ''}
          </label>`).join('')}
      </div>`;
  }

  function renderOtherOptions(form, notify) {
    const c = copy();
    const useMarker = notify === 'marker' || notify === 'both';
    const useBoth = notify === 'both';
    return `
      <details class="wt-accordion wt-bs-advanced" id="bs-other-options">
        <summary class="wt-accordion__summary">${esc(c.otherOptionsSummary || 'Other options')}</summary>
        <div class="wt-accordion__body">
          <label class="wt-checkbox-label wt-bs-advanced-both">
            <input type="checkbox" id="bs-notify-marker" ${useMarker && notify !== 'webhook' ? 'checked' : ''}>
            ${esc(c.notifyMarker || 'My backup script writes a file instead')}
          </label>
          <label class="wt-checkbox-label wt-bs-advanced-both">
            <input type="checkbox" id="bs-notify-both" ${useBoth ? 'checked' : ''}>
            ${esc(c.notifyBoth || 'Use copy-paste command and status file together')}
          </label>
          <label class="wt-checkbox-label">
            <input type="checkbox" id="bs-suppress-local" ${form.suppressLocal ? 'checked' : ''}>
            ${esc(c.suppressLocal || "Don't warn when local backup folders are empty")}
          </label>
          <div id="bs-marker-fields" class="wt-bs-marker${useMarker ? '' : ' wt-bs-marker--hidden'}">
            <label class="wt-bs-label" for="bs-marker-path">${esc(c.markerPathLabel || 'Status file path')}</label>
            <input type="text" id="bs-marker-path" class="mono-cell" value="${escAttr(form.markerRel)}">
            <p class="text-caption">${esc(c.markerPathHint || '')}</p>
            <pre class="wt-bs-curl__pre mono-cell">${esc(markerJsonExample())}</pre>
            <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm bs-copy" data-copy="${escAttr(markerJsonExample())}">${esc(c.copyJsonExample || 'Copy example')}</button>
          </div>
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="bs-save-other-options">${esc(c.saveOtherOptions || 'Save options')}</button>
        </div>
      </details>`;
  }

  function renderProgressChecklist(form, { showWebhook, token, extOk, embed = false } = {}) {
    const c = copy();
    const items = [
      { done: form.trackingMode !== 'off', label: c.checklistTracking || 'Panel backup tracking turned on' },
      { done: token || !showWebhook, label: showWebhook ? (c.checklistCode || 'Setup code ready') : (c.checklistMarker || 'Status file path set') },
      { done: extOk, label: c.checklistTest || 'Test signal received' },
    ];
    return `
      <ul class="wt-bs-status-list${embed ? ' wt-bs-status-list--embed' : ''}" aria-label="Setup progress">
        ${items.map((item) => `
          <li class="wt-bs-status-list__item${item.done ? ' is-done' : ''}">
            <span class="wt-bs-status-list__icon" aria-hidden="true">
              <i data-lucide="${item.done ? 'circle-check' : 'circle'}" width="15" height="15"></i>
            </span>
            <span class="wt-bs-status-list__label">${esc(item.label)}</span>
          </li>`).join('')}
      </ul>`;
  }

  function renderFinishStep(form, settings, { embed = false } = {}) {
    const c = copy();
    const notify = wizardState.notifyMethod || form.notifyMethod;
    const token = wizardState.revealedToken || '';
    const host = resolveDashboardHost();
    const port = resolveDashboardPort();
    const showWebhook = notify === 'webhook' || notify === 'both';
    const showMarker = notify === 'marker' || notify === 'both';
    const ext = getExternalStatus();
    const extOk = ext?.configured && ext.status === 'success' && !ext.stale;
    const panel = settings.panel || '';
    const panelName = settings.panel_display_name || panel || 'your panel';
    const guideSteps = Labels.backupExternalPanelGuide(panel, panelName);
    const curlText = buildWebhookCurl(host, port, token || 'YOUR_SETUP_CODE');
    const commandLabel = typeof c.commandFor === 'function' ? c.commandFor(panelName) : `Command for ${panelName}`;

    const successBanner = extOk ? `
      <div class="wt-bs-success" role="status">
        <p>${esc(c.successBanner || '')}</p>
      </div>` : '';

    const tokenBlock = showWebhook && token ? `
      <div class="wt-bs-token">
        <label class="wt-bs-label">${esc(c.setupCodeLabel || 'Your setup code')}</label>
        <div class="wt-bs-token__row">
          <code class="mono-cell">${esc(token)}</code>
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm bs-copy" data-copy="${escAttr(token)}">Copy</button>
        </div>
        <p class="text-caption">${esc(c.setupCodeHint || '')}</p>
      </div>` : '';

    const generateBlock = showWebhook && !token ? `
      <div class="wt-bs-token-missing">
        <p class="text-caption">${esc(c.generateCodeHint || '')}</p>
        <button type="button" class="wt-btn wt-btn--primary wt-btn--sm" id="bs-generate-token">${esc(c.generateCode || 'Generate setup code')}</button>
      </div>` : '';

    const recipeSteps = [];
    if (showWebhook) {
      recipeSteps.push(`
        <li class="wt-bs-recipe__step">
          <span class="wt-bs-recipe__num">1</span>
          <div class="wt-bs-recipe__body">
            <strong>${esc(c.recipeCopyTitle || 'Copy the command')}</strong>
            <p class="text-caption">${esc(c.recipeCopyDesc || '')}</p>
            <pre class="wt-bs-curl__pre mono-cell">${esc(curlText)}</pre>
            <button type="button" class="wt-btn wt-btn--primary wt-bs-copy-primary bs-copy" data-copy="${escAttr(curlText)}" ${token ? '' : 'disabled'}>${esc(c.copyCommand || 'Copy command')}</button>
          </div>
        </li>
        <li class="wt-bs-recipe__step">
          <span class="wt-bs-recipe__num">2</span>
          <div class="wt-bs-recipe__body">
            <strong>${esc(c.recipeOpenTitle || 'Open your panel')}</strong>
            <p class="text-caption">${esc(commandLabel)}</p>
          </div>
        </li>
        <li class="wt-bs-recipe__step">
          <span class="wt-bs-recipe__num">3</span>
          <div class="wt-bs-recipe__body">
            <strong>${esc(c.recipePasteTitle || 'Paste it after each backup')}</strong>
            ${guideSteps.length ? `<ol class="wt-bs-guide">${guideSteps.map((g) => `<li>${esc(g)}</li>`).join('')}</ol>` : ''}
          </div>
        </li>
        <li class="wt-bs-recipe__step">
          <span class="wt-bs-recipe__num">4</span>
          <div class="wt-bs-recipe__body">
            <strong>${esc(c.recipeTestTitle || 'Come back here and test')}</strong>
            <p class="text-caption">${esc(c.recipeTestDesc || '')}</p>
          </div>
        </li>`);
    }

    const markerOnlyBlock = showMarker && !showWebhook ? `
      <div class="wt-bs-marker">
        <label class="wt-bs-label" for="bs-marker-path">${esc(c.markerPathLabel || 'Status file path')}</label>
        <input type="text" id="bs-marker-path" class="mono-cell" value="${escAttr(form.markerRel)}">
        <p class="text-caption">${esc(c.markerPathHint || '')}</p>
        <pre class="wt-bs-curl__pre mono-cell">${esc(markerJsonExample())}</pre>
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm bs-copy" data-copy="${escAttr(markerJsonExample())}">${esc(c.copyJsonExample || 'Copy example')}</button>
      </div>` : '';

    const checklist = renderProgressChecklist(form, { showWebhook, token, extOk, embed });

    return `
      ${successBanner}
      ${generateBlock}
      ${tokenBlock}
      ${recipeSteps.length ? `<ol class="wt-bs-recipe${embed ? ' wt-bs-recipe--embed' : ''}">${recipeSteps.join('')}</ol>` : ''}
      ${markerOnlyBlock}
      ${renderOtherOptions(form, notify)}
      ${checklist}
      <div class="wt-bs-actions${embed ? ' wt-bs-actions--embed' : ''}">
        ${showWebhook ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="bs-regenerate-token">${esc(c.regenerateCode || 'New setup code')}</button>` : ''}
        <button type="button" class="wt-btn wt-btn--primary" id="bs-test-heartbeat">${esc(c.testButton || 'Test it worked')}</button>
      </div>`;
  }

  function renderOffDiskWizard(settings, { embed = false } = {}) {
    const c = copy();
    const form = externalFormDefaults();
    const step = wizardState.step;
    const source = form.backupSource;
    const needsConnect = source === 'external_only' || source === 'hybrid';
    const onFinishStep = step === 2 && needsConnect;

    let body = showPhantomBanner(form);
    if (!embed && (needsConnect || step === 1)) {
      body += renderStepRail(onFinishStep ? 2 : step, needsConnect);
    }

    if (step === 1) {
      if (!embed) {
        body += `
        <h3 class="wt-bs-section-title">${esc(c.sectionWhereTitle || '')}</h3>
        <p class="wt-bs-lead">${esc(c.sectionWhereLead || '')}</p>`;
      } else {
        body += `<p class="wt-bs-lead wt-bs-lead--embed">${esc(c.sectionWhereLead || '')}</p>`;
      }
      body += `
        ${renderSourceCards(source)}
        <div class="wt-bs-actions${embed ? ' wt-bs-actions--embed' : ''}">
          <button type="button" class="wt-btn wt-btn--primary" id="bs-step1-next">Continue</button>
        </div>`;
    } else if (onFinishStep) {
      if (!embed) {
        body += `
        <h3 class="wt-bs-section-title">${esc(c.sectionConnectTitle || '')}</h3>
        <p class="wt-bs-lead">${c.sectionConnectLead || ''}</p>`;
      }
      body += renderFinishStep(form, settings, { embed });
      if (!embed) {
        body += `
        <div class="wt-bs-actions">
          <button type="button" class="wt-btn wt-btn--ghost" id="bs-step-back">Back</button>
        </div>`;
      }
    }

    const offline = !state.apiMode ? `<p class="text-caption wt-bs-offline">${esc(c.offlineHint || '')}</p>` : '';

    if (embed) {
      return `
      <div class="wt-bs-wizard wt-bs-wizard--embed">
        ${body}
        ${offline}
      </div>`;
    }

    return `
      <section class="wt-bs-wizard wt-card wt-card--surface">
        <h2 class="wt-bs-heading"><i data-lucide="cloud" width="18" height="18"></i> ${esc(c.wizardTitle || 'Panel backups')}</h2>
        <p class="text-caption wt-bs-intro">${esc(c.wizardIntro || '')}</p>
        ${body}
        ${offline}
      </section>`;
  }

  function renderLocalSection(settings) {
    const c = copy();
    const dirs = settings.backup_dirs ? esc(settings.backup_dirs) : '—';
    const form = externalFormDefaults();
    const openLocal = embedMode && form.backupSource === 'local_only' && !isConfigured();
    return `
      <details class="wt-bs-local wt-card wt-card--surface"${openLocal ? ' open' : ''}>
        <summary class="wt-bs-heading wt-bs-local__summary">
          <i data-lucide="folder" width="18" height="18"></i>
          <span>${esc(c.localSectionSummary || 'Backups in a folder on this server')}</span>
        </summary>
        <div class="wt-bs-local__body">
          <p class="wt-bs-lead">${esc(c.localSectionLead || '')}</p>
          <p class="text-caption"><strong>Monitored folders:</strong> <span class="mono-cell">${dirs}</span></p>
          <div class="wt-bs-actions">
            <button type="button" class="wt-btn wt-btn--primary" id="bs-pick-folder">Choose backup folder</button>
            <button type="button" class="wt-btn wt-btn--ghost" id="bs-rescan" ${state.apiMode ? '' : 'disabled'}>Rescan backups</button>
          </div>
        </div>
      </details>`;
  }

  function renderStartHere() {
    const c = copy();
    return `
      <div class="wt-bs-start-here" role="note">
        <h2 class="wt-bs-start-here__title">${esc(c.startHereTitle || 'Start here')}</h2>
        <p class="wt-bs-start-here__body">${esc(c.startHereBody || '')}</p>
      </div>`;
  }

  function renderPanel(settings) {
    return `
      <div class="wt-bs-settings">
        ${renderStartHere()}
        ${renderOffDiskWizard(settings)}
        ${renderLocalSection(settings)}
      </div>
      <div id="bs-fs-picker-mount"></div>`;
  }

  function readNotifyMethod() {
    const markerEl = document.getElementById('bs-notify-marker');
    const bothEl = document.getElementById('bs-notify-both');
    if (markerEl || bothEl) {
      if (bothEl?.checked) return 'both';
      if (markerEl?.checked) return 'marker';
      return 'webhook';
    }
    if (wizardState.notifyMethod) return wizardState.notifyMethod;
    return 'webhook';
  }

  function readBackupSource() {
    if (wizardState.backupSource) return wizardState.backupSource;
    const checked = document.querySelector('input[name="bs-backup-source"]:checked');
    return checked?.value || externalFormDefaults().backupSource;
  }

  function syncMarkerFieldsVisibility(root) {
    const marker = document.getElementById('bs-notify-marker')?.checked;
    const both = document.getElementById('bs-notify-both')?.checked;
    const fields = root?.querySelector('#bs-marker-fields') || document.getElementById('bs-marker-fields');
    if (fields) {
      fields.classList.toggle('wt-bs-marker--hidden', !marker && !both);
    }
  }

  async function saveFromWizard({ regenerateToken = false, backupSource, notifyMethod, forceGenerateToken = false } = {}) {
    if (!state.apiMode) {
      const source = backupSource || readBackupSource();
      const notify = notifyMethod || readNotifyMethod();
      const trackingMode = mapToTrackingMode(source, notify);
      const next = {
        ...(state.dashboardSettings || {}),
        backup_tracking_mode: trackingMode,
        backup_dirs: source === 'local_only'
          ? (state.dashboardSettings?.backup_dirs || '/demo/backups')
          : (state.dashboardSettings?.backup_dirs || ''),
      };
      if ((trackingMode === 'webhook' || trackingMode === 'both')
          && (regenerateToken || forceGenerateToken || !wizardState.revealedToken)) {
        wizardState.revealedToken = wizardState.revealedToken || 'PREVIEW-SETUP-CODE';
      }
      state.dashboardSettings = next;
      localStorage.setItem(
        typeof PREVIEW_SETTINGS_KEY !== 'undefined' ? PREVIEW_SETTINGS_KEY : 'watchtower-preview-settings',
        JSON.stringify(next),
      );
      if (!state.activeFacts) state.activeFacts = state.facts || {};
      if (!state.activeFacts.optional) state.activeFacts.optional = {};
      state.activeFacts.optional.last_backup = {
        status: source === 'local_only' || trackingMode !== 'off' ? 'success' : 'unconfigured',
        search_dirs: next.backup_dirs ? [next.backup_dirs] : [],
      };
      wizardState.backupSource = source;
      wizardState.notifyMethod = notify;
      return { ok: true, settings: next };
    }
    const source = backupSource || readBackupSource();
    const notify = notifyMethod || readNotifyMethod();
    const trackingMode = mapToTrackingMode(source, notify);
    const payload = {
      trackingMode,
      backupSuppressLocalMissing: document.getElementById('bs-suppress-local')?.checked !== false,
    };
    const markerEl = document.getElementById('bs-marker-path');
    if (markerEl && (trackingMode === 'marker' || trackingMode === 'both')) {
      payload.backupExternalMarker = markerEl.value.trim();
    } else if (trackingMode === 'marker' || trackingMode === 'both') {
      payload.backupExternalMarker = externalFormDefaults().markerRel;
    }
    const needsToken = trackingMode === 'webhook' || trackingMode === 'both';
    if (needsToken && (regenerateToken || forceGenerateToken || !wizardState.revealedToken)) {
      payload.generateWebhookToken = true;
    }
    const data = await WatchtowerApi.postBackupExternal(payload);
    applyExternalSettingsFromResponse(data);
    wizardState.backupSource = source;
    wizardState.notifyMethod = notify;
    return data;
  }

  async function handleStep1Next() {
    const source = readBackupSource();
    wizardState.backupSource = source;
    if (source === 'local_only') {
      try {
        const data = await saveFromWizard({ backupSource: 'local_only', notifyMethod: 'webhook' });
        showToast(Labels.backupExternalSaveSuccess('off'), 'success');
        wizardState.step = 1;
        wizardState.revealedToken = null;
        wizardState.notifyMethod = null;
        refreshPanel();
        if (typeof afterBackupDataUpdate === 'function') afterBackupDataUpdate();
        if (state.apiMode && !isConfigured() && typeof TowerRenderBackups !== 'undefined') {
          showToast('Choose a backup folder below to enable Continue, or use Skip for now.', 'info');
        }
        return data;
      } catch (e) {
        showToast(`Save failed: ${e.message}`, 'error');
        return null;
      }
    }
    wizardState.notifyMethod = 'webhook';
    const btn = document.getElementById('bs-step1-next');
    if (btn) btn.disabled = true;
    try {
      await saveFromWizard({
        backupSource: source,
        notifyMethod: 'webhook',
        forceGenerateToken: true,
      });
      showToast(Labels.backupExternalSaveSuccess('webhook'), 'success');
      wizardState.step = 2;
      refreshPanel();
      if (typeof afterBackupDataUpdate === 'function') afterBackupDataUpdate();
    } catch (e) {
      showToast(`Save failed: ${e.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
    return null;
  }

  async function handleSaveOtherOptions() {
    const source = wizardState.backupSource || readBackupSource();
    const notify = readNotifyMethod();
    wizardState.backupSource = source;
    wizardState.notifyMethod = notify;
    try {
      await saveFromWizard({
        backupSource: source,
        notifyMethod: notify,
        forceGenerateToken: notify === 'webhook' || notify === 'both',
      });
      showToast(Labels.backupExternalSaveSuccess(mapToTrackingMode(source, notify)), 'success');
      refreshPanel();
      if (typeof afterBackupDataUpdate === 'function') afterBackupDataUpdate();
    } catch (e) {
      showToast(`Save failed: ${e.message}`, 'error');
    }
  }

  async function handleTestHeartbeat() {
    if (!state.apiMode) {
      applyExternalHeartbeatToState({
        configured: true,
        status: 'success',
        source: 'preview-test',
        stale: false,
      });
      showToast(Labels.backupExternalTestSuccess?.() || 'Test heartbeat OK (preview)', 'success');
      refreshPanel();
      if (embedCallbacks?.onConfigured) embedCallbacks.onConfigured();
      return;
    }
    const btn = document.getElementById('bs-test-heartbeat');
    if (btn) btn.disabled = true;
    try {
      const markerEl = document.getElementById('bs-marker-path');
      if (markerEl) {
        await saveFromWizard({ backupSource: readBackupSource(), notifyMethod: readNotifyMethod() });
      }
      const data = await WatchtowerApi.postBackupExternalTest();
      applyExternalHeartbeatToState(data.backup_external);
      showToast(Labels.backupExternalTestSuccess(), 'success');
      refreshPanel();
      if (typeof afterBackupDataUpdate === 'function') afterBackupDataUpdate();
      if (embedCallbacks?.onConfigured) embedCallbacks.onConfigured();
    } catch (e) {
      showToast(`Test failed: ${e.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  let panelContainer = null;
  let settingsRef = null;
  let embedMode = false;
  let embedCallbacks = null;

  function refreshPanel() {
    if (!panelContainer) return;
    panelContainer.innerHTML = embedMode
      ? renderWizardEmbed(settingsRef || state.dashboardSettings || {})
      : renderPanel(settingsRef || state.dashboardSettings || {});
    bindPanel(panelContainer);
    if (embedMode && embedCallbacks?.onConfigured && isConfigured()) {
      embedCallbacks.onConfigured();
    }
    if (window.lucide) lucide.createIcons({ root: panelContainer });
  }

  function bindPanel(root) {
    root.querySelectorAll('input[name="bs-backup-source"]').forEach((el) => {
      el.addEventListener('change', () => {
        wizardState.backupSource = el.value;
        root.querySelectorAll('.wt-bs-option-card').forEach((c) => c.classList.remove('is-selected'));
        el.closest('.wt-bs-option-card')?.classList.add('is-selected');
      });
    });

    document.getElementById('bs-notify-marker')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        const both = document.getElementById('bs-notify-both');
        if (both && !both.checked) wizardState.notifyMethod = 'marker';
        else if (both?.checked) wizardState.notifyMethod = 'both';
      } else {
        const both = document.getElementById('bs-notify-both');
        wizardState.notifyMethod = both?.checked ? 'webhook' : 'webhook';
        if (both?.checked) both.checked = false;
      }
      syncMarkerFieldsVisibility(root);
    });
    document.getElementById('bs-notify-both')?.addEventListener('change', (e) => {
      const marker = document.getElementById('bs-notify-marker');
      if (e.target.checked) {
        if (marker) marker.checked = true;
        wizardState.notifyMethod = 'both';
      } else {
        wizardState.notifyMethod = marker?.checked ? 'marker' : 'webhook';
      }
      syncMarkerFieldsVisibility(root);
    });

    root.querySelector('#bs-step1-next')?.addEventListener('click', () => handleStep1Next());
    root.querySelector('#bs-step-back')?.addEventListener('click', () => {
      wizardState.step = Math.max(1, wizardState.step - 1);
      refreshPanel();
    });
    root.querySelector('#bs-save-other-options')?.addEventListener('click', () => handleSaveOtherOptions());
    root.querySelector('#bs-test-heartbeat')?.addEventListener('click', () => handleTestHeartbeat());
    root.querySelector('#bs-regenerate-token')?.addEventListener('click', async () => {
      const c = copy();
      if (!window.confirm(c.regenerateConfirm || 'Create a new setup code?')) return;
      try {
        await saveFromWizard({ regenerateToken: true });
        refreshPanel();
        showToast(c.newCodeToast || 'New setup code created', 'success');
      } catch (e) {
        showToast(`Failed: ${e.message}`, 'error');
      }
    });

    root.querySelector('#bs-generate-token')?.addEventListener('click', async () => {
      try {
        await saveFromWizard({
          backupSource: wizardState.backupSource || readBackupSource(),
          notifyMethod: wizardState.notifyMethod || readNotifyMethod(),
          forceGenerateToken: true,
        });
        refreshPanel();
        showToast(copy().codeGeneratedToast || 'Setup code ready', 'success');
      } catch (e) {
        showToast(`Failed: ${e.message}`, 'error');
      }
    });

    root.querySelectorAll('.bs-copy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = btn.dataset.copy || '';
        if (text && navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => showToast(copy().copiedToast || 'Copied', 'success')).catch(() => {});
        }
      });
    });

    root.querySelector('#bs-pick-folder')?.addEventListener('click', () => {
      if (typeof TowerRenderBackups !== 'undefined') {
        TowerRenderBackups.openBackupFolderPicker();
      }
    });

    root.querySelector('#bs-rescan')?.addEventListener('click', async () => {
      if (!state.apiMode) return;
      try {
        const data = await WatchtowerApi.postBackupScan();
        if (!state.activeFacts.optional) state.activeFacts.optional = {};
        if (data.last_backup) state.activeFacts.optional.last_backup = data.last_backup;
        if (data.backup_inventory) state.activeFacts.optional.backup_inventory = data.backup_inventory;
        showToast('Backup scan complete', 'success');
        if (typeof afterBackupDataUpdate === 'function') afterBackupDataUpdate();
      } catch (e) {
        showToast(`Scan failed: ${e.message}`, 'error');
      }
    });

    syncMarkerFieldsVisibility(root);
  }

  function resetEmbedState() {
    wizardState.step = 1;
    wizardState.revealedToken = null;
    wizardState.backupSource = null;
    wizardState.notifyMethod = null;
  }

  function promoteEmbedStepFromSettings(settings) {
    const tracking = settings?.backup_tracking_mode || 'off';
    if (tracking === 'webhook' || tracking === 'both' || tracking === 'marker') {
      if (wizardState.step < 2) wizardState.step = 2;
      wizardState.notifyMethod = wizardState.notifyMethod || tracking;
      const hasLocalDirs = !!(settings?.backup_dirs && String(settings.backup_dirs).trim());
      wizardState.backupSource = wizardState.backupSource || (
        hasLocalDirs ? 'hybrid' : 'external_only'
      );
    }
  }

  function isEmbedActive() {
    return embedMode;
  }

  function mountWizardEmbed(container, settings, callbacks = {}) {
    embedMode = true;
    embedCallbacks = callbacks;
    panelContainer = container;
    settingsRef = settings;
    promoteEmbedStepFromSettings(settings);
    refreshPanel();
  }

  function mountPanel(container, settings) {
    embedMode = false;
    embedCallbacks = null;
    panelContainer = container;
    settingsRef = settings;
    const tracking = settings?.backup_tracking_mode || 'off';
    if (tracking === 'webhook' || tracking === 'both' || tracking === 'marker') {
      wizardState.step = 2;
      wizardState.notifyMethod = wizardState.notifyMethod || tracking;
      if (tracking !== 'off') {
        const hasLocalDirs = !!(settings?.backup_dirs && String(settings.backup_dirs).trim());
        wizardState.backupSource = wizardState.backupSource || (
          hasLocalDirs ? 'hybrid' : 'external_only'
        );
      }
    }
    refreshPanel();
  }

  function openSettings() {
    if (typeof WatchtowerSettings !== 'undefined' && WatchtowerSettings.openInCanvas) {
      WatchtowerSettings.openInCanvas('backups');
    }
  }

  function isConfigured() {
    const backup = state.activeFacts?.optional?.last_backup;
    const ext = state.opsCache?.backup_external || state.activeFacts?.optional?.backup_external;
    const tracking = (settingsRef || state.dashboardSettings || {})?.backup_tracking_mode;
    if (tracking && tracking !== 'off') return true;
    if (backup?.status && backup.status !== 'unconfigured') return true;
    if (ext?.configured && (ext.status === 'success' || ext.status === 'running')) return true;
    const dirs = (settingsRef || state.dashboardSettings || {})?.backup_dirs;
    if (dirs && String(dirs).trim()) return true;
    return false;
  }

  function renderWizardEmbed(settings) {
    const c = copy();
    const form = externalFormDefaults();
    const step = wizardState.step;
    const needsConnect = (form.backupSource === 'external_only' || form.backupSource === 'hybrid') && step === 2;

    return `
      <header class="wt-setup-wizard__head">
        <p class="wt-setup-wizard__eyebrow">Required</p>
        <h2 class="wt-setup-wizard__title">${needsConnect ? esc(c.sectionConnectTitle || 'Connect your panel') : 'Backup setup'}</h2>
        <p class="wt-setup-wizard__lead">${needsConnect ? (c.sectionConnectLead || '') : 'Tell Watchtower where backup files live — on this server, on your hosting panel, or both.'}</p>
      </header>
      ${renderOffDiskWizard(settings, { embed: true })}
      ${renderLocalSection(settings)}
      <div id="bs-fs-picker-mount"></div>`;
  }

  return {
    wizardState,
    externalFormDefaults,
    mapToTrackingMode,
    buildWebhookCurl,
    applyExternalHeartbeatToState,
    applyExternalSettingsFromResponse,
    saveFromWizard,
    sendExternalTestHeartbeat: handleTestHeartbeat,
    renderPanel,
    renderWizardEmbed,
    mountWizardEmbed,
    resetEmbedState,
    isEmbedActive,
    isConfigured,
    mountPanel,
    refreshPanel,
    openSettings,
  };
})();
