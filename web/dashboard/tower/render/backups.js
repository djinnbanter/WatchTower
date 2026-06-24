/**
 * Watchtower UI v3 — backups tab renderers
 */
const TowerRenderBackups = (function () {
  const esc = TowerRenderShared.esc;
  const fmtTimeShort = TowerRenderShared.fmtTimeShort;

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function backupFixIssueId(backup) {
    if (!backup) return null;
    if (backup.status === 'unconfigured') return 'BACKUP_NOT_CONFIGURED';
    if (backup.status === 'not_found') return 'BACKUP_NOT_FOUND';
    if (backup.status === 'stale' || backup.stale) return 'BACKUP_STALE';
    return null;
  }

  function backupStatusLabel(backup) {
    const issueId = backupFixIssueId(backup);
    if (issueId) return Labels.issueTitle(issueId);
    if (backup?.status === 'success') return 'Backup OK';
    return 'Backup status';
  }

  function backupStatusMod(backup) {
    if (!backup || backup.status === 'unconfigured') return 'info';
    if (backup.status === 'success') return 'healthy';
    if (backup.status === 'not_found') return 'danger';
    return 'warn';
  }

  function statusChipCls(mod) {
    if (mod === 'healthy') return 'wt-backup-chip--ok';
    if (mod === 'danger') return 'wt-mod-chip--error';
    if (mod === 'info') return 'wt-mod-chip--info';
    return 'wt-mod-chip--warning';
  }

  function statusChipText(backup, mod) {
    if (mod === 'healthy') return 'OK';
    if (backup?.status === 'unconfigured') return 'Setup needed';
    if (backup?.status === 'not_found') return 'Not found';
    if (backup?.stale || backup?.status === 'stale') return 'Stale';
    return 'Check';
  }

  function severityAccent(mod) {
    if (mod === 'healthy') return 'wt-backup-briefing__accent--healthy';
    if (mod === 'danger') return 'wt-backup-briefing__accent--critical';
    if (mod === 'info') return 'wt-backup-briefing__accent--info';
    return 'wt-backup-briefing__accent--warn';
  }

  function resolveNewestArchive(backup, inventory) {
    if (inventory[0]) {
      return {
        filename: inventory[0].filename || inventory[0].path?.split('/').pop() || backup?.path || '—',
        size_gb: inventory[0].size_gb ?? backup?.size_gb ?? backup?.newest_size_gb,
        time: inventory[0].time ?? backup?.time ?? backup?.newest_on_disk,
        age_days: inventory[0].age_days ?? backup?.age_days,
      };
    }
    if (backup?.path || backup?.time) {
      return {
        filename: backup.path || '—',
        size_gb: backup.size_gb ?? backup.newest_size_gb,
        time: backup.time ?? backup.newest_on_disk,
        age_days: backup.age_days,
      };
    }
    return null;
  }

  function ageChipCls(ageDays, warnDays) {
    if (ageDays == null) return 'wt-backup-age--muted';
    const warn = warnDays ?? 7;
    if (ageDays < warn) return 'wt-backup-age--ok';
    if (ageDays < warn * 2) return 'wt-backup-age--warn';
    return 'wt-backup-age--danger';
  }

  function mergeOpsBackupFacts(f) {
    const optional = f?.optional ? { ...f.optional } : {};
    const live = state.opsCache?.backups_live;
    if (live?.last_backup) {
      optional.last_backup = live.last_backup;
      const inv = live.inventory_summary;
      if (Array.isArray(inv)) optional.backup_inventory = inv;
      else if (inv?.length != null) optional.backup_inventory = inv;
    }
    const ext = state.opsCache?.backup_external;
    if (ext) optional.backup_external = ext;
    return { ...f, optional };
  }

  function externalStatusMod(external) {
    if (!external?.configured) return 'info';
    if (external.status === 'success' && !external.stale) return 'healthy';
    if (external.status === 'running') return 'info';
    if (external.status === 'not_found' || external.status === 'missing' || external.status === 'failed') return 'danger';
    return 'warn';
  }

  function renderBackupSettingsCta(extraHint) {
    const hint = extraHint || Labels.backupWizardCopy?.backupsTabSetupHint || '';
    return `
      <div class="wt-backup-settings-cta">
        ${hint ? `<p class="text-caption wt-backup-settings-cta__hint">${esc(hint)}</p>` : ''}
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm backup-open-settings">
          <i data-lucide="settings" width="14" height="14"></i> Backup settings
        </button>
      </div>`;
  }

  function renderExternalBackupSection(ctx) {
    const { external, panel } = ctx;
    if (!external?.configured) return '';
    const mod = externalStatusMod(external);
    const chipCls = statusChipCls(mod);
    const chipText = mod === 'healthy' ? 'OK' : mod === 'danger' ? 'Missing' : mod === 'info' && external.status === 'running' ? 'Running' : 'Check';
    const summary = Labels.backupExternalSummary(external);
    const fixSteps = Labels.backupExternalFixHints(external);

    return `
      <section class="wt-card wt-card--surface wt-backup-external wt-enter ${backupSeverityCardCls(mod)}">
        <span class="wt-backup-briefing__accent ${severityAccent(mod)}" aria-hidden="true"></span>
        <header class="wt-backup-briefing__banner">
          <h3 class="wt-backup-briefing__title">Panel backups</h3>
          <span class="wt-mod-chip ${chipCls}">${esc(chipText)}</span>
          ${external.source ? `<span class="wt-backup-external__source">${esc(external.source)}</span>` : ''}
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm backup-open-settings">Backup settings</button>
        </header>
        <div class="wt-backup-briefing__sections">
          <section class="issue-section">
            <span class="issue-section-label">Status</span>
            <p>${esc(summary)}</p>
            ${external.last_at ? `<p class="wt-backup-briefing__archive-line">Last at: ${fmtTimeShort(external.last_at)}${external.age_hours != null ? ` · ${Math.round(external.age_hours)}h ago` : ''}</p>` : ''}
            ${external.remote_uri ? `<p class="wt-backup-external__uri mono-cell">${esc(external.remote_uri)}</p>` : ''}
            ${external.detail ? `<p class="wt-backup-briefing__extra">${esc(external.detail)}</p>` : ''}
          </section>
          ${renderFixSteps(fixSteps)}
        </div>
      </section>`;
  }

  function computeBackupsContext(f) {
    const merged = mergeOpsBackupFacts(f || state.activeFacts);
    const backup = merged?.optional?.last_backup ?? null;
    let inventory = merged?.optional?.backup_inventory ?? [];
    if (!Array.isArray(inventory)) inventory = [];
    const external = merged?.optional?.backup_external ?? null;
    const backupMode = state.overviewMeta?.backup_mode || Labels.backupModeFromParts(backup, external);
    const localConfigured = backupMode === 'local_only' || backupMode === 'hybrid' || (backup && backup.status !== 'unconfigured');
    const panel = merged?.meta?.panel || merged?.minecraft?.panel;
    const searchDirs = backup?.search_dirs ?? [];
    const q = (state.backupsSearch || '').trim().toLowerCase();
    const filteredInventory = q
      ? inventory.filter((b) => {
        const name = (b.filename || b.path?.split('/').pop() || '').toLowerCase();
        return name.includes(q);
      })
      : inventory;
    const issueId = backupFixIssueId(backup);
    const fixSteps = issueId ? Labels.fixHints(issueId) : [];
    const statusMod = backupStatusMod(backup);
    const newestArchive = resolveNewestArchive(backup, inventory);
    const paths = searchDirs.length ? searchDirs : (backup?.dir ? [backup.dir] : []);

    return {
      backup,
      inventory,
      filteredInventory,
      panel,
      paths,
      q,
      issueId,
      fixSteps,
      statusMod,
      newestArchive,
      panelHint: Labels.backupPanelHint(panel, backup),
      configHint: Labels.backupConfigHint(backup, panel),
      reasonHint: Labels.backupReasonHint(backup),
      summary: Labels.backupSummary(backup),
      warnDays: backup?.warn_days,
      hasData: !!backup || !!external?.configured,
      unconfigured: backupMode === 'none',
      external,
      backupMode,
      localConfigured,
    };
  }

  function pickFolderLabel(ctx) {
    if (!ctx || ctx.unconfigured || !ctx.paths?.length) return 'Choose backup folder';
    return 'Add backup folder';
  }

  function renderPickFolderButton(ctx, { variant = 'ghost', sm = false } = {}) {
    const label = pickFolderLabel(ctx);
    const cls = variant === 'primary' ? 'wt-btn--primary' : 'wt-btn--ghost';
    const size = sm ? ' wt-btn--sm' : '';
    const icon = sm ? 14 : 16;
    return `<button type="button" class="wt-btn ${cls}${size} backup-pick-btn"><i data-lucide="folder-plus" width="${icon}" height="${icon}"></i> ${esc(label)}</button>`;
  }

  function renderActionButtons(ctx, compact) {
    const sm = compact ? ' wt-btn--sm' : '';
    const pick = renderPickFolderButton(ctx, { sm: compact });
    const rescan = state.apiMode
      ? `<button type="button" class="wt-btn wt-btn--primary${sm}" id="backup-rescan-btn"><i data-lucide="refresh-cw" width="14" height="14"></i> Rescan backups</button>`
      : '';
    return `<div class="wt-backups-chrome__actions">${pick}${rescan}</div>`;
  }

  function kpiToneCls(ageDays, warnDays) {
    const mod = ageChipCls(ageDays, warnDays);
    if (mod === 'wt-backup-age--ok') return 'ok';
    if (mod === 'wt-backup-age--danger') return 'danger';
    if (mod === 'wt-backup-age--warn') return 'warn';
    return 'muted';
  }

  function renderKpiCard(label, valueHtml, tone, index) {
    if (typeof TowerTabChrome !== 'undefined') {
      const toneMap = { ok: 'ok', danger: 'danger', warn: 'warn', info: 'scanned', muted: 'neutral' };
      const icons = { ok: 'check-circle', danger: 'alert-triangle', warn: 'clock', info: 'info', muted: 'minus' };
      return TowerTabChrome.statCard({
        label,
        value: valueHtml,
        tone: toneMap[tone] || 'neutral',
        icon: icons[tone] || 'database-backup',
        hint: '',
      });
    }
    const toneCls = tone ? `wt-backup-kpi-card--${tone}` : '';
    const severityCls = tone === 'ok' ? 'wt-card--severity-ok'
      : tone === 'danger' ? 'wt-card--severity-critical'
        : tone === 'warn' ? 'wt-card--severity-warn'
          : '';
    return `
      <div class="wt-card wt-card--surface wt-backup-kpi-card ${toneCls} ${severityCls}" style="--wt-stagger-index: ${index}">
        <div class="wt-backup-kpi-card__inner">
          <span class="wt-backup-kpi-card__label">${esc(label)}</span>
          <div class="wt-backup-kpi-card__value">${valueHtml}</div>
        </div>
      </div>`;
  }

  function renderKpiCards(ctx) {
    const { backup, inventory, warnDays } = ctx;
    if (!backup || backup.status === 'unconfigured') return '';

    const ageNum = backup.age_days != null ? String(backup.age_days) : '—';
    const ageTone = backup.age_days != null ? kpiToneCls(backup.age_days, warnDays) : 'muted';
    const ageHtml = backup.age_days != null
      ? `${esc(ageNum)}<span class="wt-kpi__unit">d</span>`
      : esc(ageNum);
    const count = inventory.length || backup.inventory_count || 0;
    const warnHtml = warnDays != null
      ? `${warnDays}<span class="wt-kpi__unit">d</span>`
      : '—';

    const cards = [
      renderKpiCard('Newest', ageHtml, ageTone, 0),
      renderKpiCard('Archives', esc(String(count)), '', 1),
      renderKpiCard('Warn at', warnHtml, warnDays != null ? 'info' : 'muted', 2),
    ];
    return cards.join('');
  }

  function backupSeverityCardCls(statusMod) {
    if (statusMod === 'healthy') return 'wt-card--severity-ok';
    if (statusMod === 'danger') return 'wt-card--severity-critical';
    if (statusMod === 'info') return '';
    return 'wt-card--severity-warn';
  }

  function renderBackupsChrome(ctx) {
    const showSearch = ctx.inventory.length > 0;
    return `
      <div class="wt-card wt-card--surface wt-backups-chrome" id="backups-chrome">
        <div class="wt-backups-chrome__top">
          ${renderActionButtons(ctx, true)}
        </div>
        <div class="wt-backups-chrome__toolbar"${showSearch ? '' : ' hidden'}>
          <input type="search" id="backup-search" class="wt-backups-search" value="${esc(state.backupsSearch)}" placeholder="Search archives…" aria-label="Search backup archives">
        </div>
      </div>`;
  }

  function updateBackupsKpiRow(ctx) {
    const row = document.getElementById('backups-kpi-row');
    if (!row) return;
    const html = renderKpiCards(ctx);
    row.innerHTML = html;
    row.hidden = !html;
  }

  function updateBackupsChromeKpis(chrome, ctx) {
    updateBackupsKpiRow(ctx);
    if (!chrome) return;
    const toolbar = chrome.querySelector('.wt-backups-chrome__toolbar');
    if (toolbar) {
      toolbar.hidden = ctx.inventory.length === 0;
    }
    const meta = document.querySelector('.wt-backup-inventory__meta');
    if (meta) {
      meta.textContent = ctx.q
        ? `${ctx.filteredInventory.length} of ${ctx.inventory.length} archives match`
        : `${ctx.inventory.length} archive${ctx.inventory.length === 1 ? '' : 's'}`;
    }
  }

  function renderDiagnostics(backup) {
    const items = [];
    if (backup.reason) items.push(`Reason: ${backup.reason}`);
    if (backup.files_seen != null) items.push(`${backup.files_seen} files seen on disk`);
    if (backup.files_matching_suffix != null) items.push(`${backup.files_matching_suffix} matching archive suffix`);
    if (backup.files_matching_server != null) items.push(`${backup.files_matching_server} matching this server`);
    if (backup.inventory_count != null) items.push(`${backup.inventory_count} in inventory`);
    return items.map((t) => `<p>${esc(t)}</p>`).join('');
  }

  function renderFixSteps(steps) {
    if (!steps.length) return '';
    const copyText = steps.join('\n');
    return `<section class="issue-section wt-backup-briefing__fix-section">
      <div class="wt-backup-briefing__fix-head">
        <span class="issue-section-label">How to fix</span>
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm copy-hint" data-copy="${escAttr(copyText)}">Copy all steps</button>
      </div>
      <ol class="wt-backup-briefing__steps">
        ${steps.map((s, i) => `
          <li class="wt-backup-briefing__step">
            <span class="wt-backup-briefing__step-num" aria-hidden="true">${i + 1}</span>
            <span class="wt-backup-briefing__step-text">${esc(s)}</span>
          </li>`).join('')}
      </ol>
    </section>`;
  }

  function renderBackupBriefingCard(ctx) {
    const { backup, statusMod, newestArchive, fixSteps, summary, reasonHint, panelHint, configHint } = ctx;
    if (!backup || backup.status === 'unconfigured') return '';

    const chipCls = statusChipCls(statusMod);
    const chipText = statusChipText(backup, statusMod);
    const accent = severityAccent(statusMod);

    const latestSection = newestArchive
      ? `<section class="issue-section">
          <span class="issue-section-label">Latest archive</span>
          <p class="wt-backup-briefing__archive-line">
            <strong class="mono-cell">${esc(newestArchive.filename)}</strong>
            ${newestArchive.size_gb != null ? `<span class="wt-backup-briefing__sep" aria-hidden="true">·</span><span>${newestArchive.size_gb} GB</span>` : ''}
            ${newestArchive.time ? `<span class="wt-backup-briefing__sep" aria-hidden="true">·</span><span>${fmtTimeShort(newestArchive.time)}</span>` : ''}
            ${newestArchive.age_days != null ? `<span class="wt-backup-briefing__sep" aria-hidden="true">·</span><span class="wt-backup-age ${ageChipCls(newestArchive.age_days, ctx.warnDays)}">${newestArchive.age_days}d old</span>` : ''}
          </p>
        </section>`
      : '';

    const whyBody = [
      `<p>${esc(summary)}</p>`,
      renderDiagnostics(backup),
      reasonHint ? `<p class="wt-backup-briefing__extra">${esc(reasonHint)}</p>` : '',
      backup.hint ? `<p class="wt-backup-briefing__extra">${esc(backup.hint)}</p>` : '',
    ].filter(Boolean).join('');

    const notes = [
      panelHint ? `<p class="wt-backup-briefing__note">${esc(panelHint)}</p>` : '',
      configHint && backup.status !== 'success' ? `<p class="wt-backup-briefing__note">${esc(configHint)}</p>` : '',
    ].filter(Boolean).join('');

    return `
      <article class="wt-card wt-card--surface wt-backup-briefing wt-scroll-reveal ${backupSeverityCardCls(statusMod)} wt-enter">
        <span class="wt-backup-briefing__accent ${accent}" aria-hidden="true"></span>
        <header class="wt-backup-briefing__banner">
          <h3 class="wt-backup-briefing__title">${esc(backupStatusLabel(backup))}</h3>
          <span class="wt-mod-chip ${chipCls}">${esc(chipText)}</span>
        </header>
        <div class="wt-backup-briefing__sections">
          ${latestSection}
          <section class="issue-section">
            <span class="issue-section-label">Why this is happening</span>
            ${whyBody}
          </section>
          ${renderFixSteps(fixSteps)}
          ${notes ? `<div class="wt-backup-briefing__notes">${notes}</div>` : ''}
        </div>
      </article>`;
  }

  function renderInventoryRow(b, ctx) {
    const name = b.filename || b.path?.split('/').pop() || '—';
    const newest = ctx.inventory[0];
    const isNewest = newest && !ctx.q && (
      (newest.filename && newest.filename === b.filename)
      || (newest.path && newest.path === b.path)
    );
    const rowCls = isNewest ? 'wt-backup-inventory__row--newest' : '';
    const ageCls = ageChipCls(b.age_days, ctx.warnDays);
    const ageLabel = b.age_days != null ? `${b.age_days}d` : '—';
    return `<tr class="wt-backup-inventory__row ${rowCls}">
      <td class="mono-cell wt-backup-inventory__name">${esc(name)}</td>
      <td>${b.size_gb != null ? `${b.size_gb} GB` : '—'}</td>
      <td>${fmtTimeShort(b.time)}</td>
      <td><span class="wt-backup-age ${ageCls}">${esc(ageLabel)}</span></td>
    </tr>`;
  }

  function renderBackupInventory(ctx) {
    const { backup, inventory, filteredInventory, q } = ctx;
    const metaLine = q
      ? `${filteredInventory.length} of ${inventory.length} archives match`
      : `${inventory.length} archive${inventory.length === 1 ? '' : 's'}`;

    if (!inventory.length) {
      const emptyMsg = backup?.reason === 'empty'
        ? 'No backup archives found — searched folders exist but are empty from this process.'
        : 'No backup archives found.';
      return `
        <section class="wt-card wt-card--surface wt-backup-inventory wt-scroll-reveal wt-enter">
          <header class="wt-backup-inventory__head">
            <h3 class="wt-card__title"><i data-lucide="archive" width="16" height="16"></i> Archives</h3>
          </header>
          <p class="wt-backup-inventory__empty">${esc(emptyMsg)}</p>
        </section>`;
    }

    const rows = filteredInventory.length
      ? filteredInventory.map((b) => renderInventoryRow(b, ctx)).join('')
      : `<tr><td colspan="4" class="wt-backup-inventory__empty">No archives match your search.</td></tr>`;

    return `
      <section class="wt-card wt-card--surface wt-backup-inventory wt-scroll-reveal wt-enter">
        <header class="wt-backup-inventory__head">
          <div class="wt-backup-inventory__head-main">
            <h3 class="wt-card__title"><i data-lucide="archive" width="16" height="16"></i> Archives (${inventory.length})</h3>
            <p class="wt-backup-inventory__meta">${esc(metaLine)}</p>
          </div>
        </header>
        <div class="wt-table-wrap wt-backup-inventory__table-wrap">
          <table class="wt-table wt-table--compact wt-backup-inventory__table">
            <thead>
              <tr>
                <th scope="col">Archive</th>
                <th scope="col">Size</th>
                <th scope="col">Time</th>
                <th scope="col">Age</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function renderPathsHead(ctx, title) {
    return `<header class="wt-backup-paths__head">
      <h3 class="wt-card__title"><i data-lucide="folder-search" width="16" height="16"></i> ${title}</h3>
      ${renderPickFolderButton(ctx, { sm: true })}
    </header>`;
  }

  function renderBackupPaths(ctx) {
    const { backup, paths, panel } = ctx;
    const footerNote = `Archives must be <code class="inline-code">.tar.gz</code>, <code class="inline-code">.zip</code>, or similar on disk.${panel ? ` Panel: ${esc(Labels.panelDisplayName(panel))}.` : ''} New folders are added to <code class="inline-code">BACKUP_DIRS</code> in watchtower.conf.`;

    if (!paths.length) {
      return `
        <section class="wt-card wt-card--surface wt-backup-paths wt-scroll-reveal wt-enter">
          ${renderPathsHead(ctx, 'Search paths')}
          <p class="wt-backup-paths__empty">No search paths recorded — add a folder where your panel stores backup archives.</p>
        </section>`;
    }

    const rows = paths.map((d) => {
      const primary = backup?.dir && d === backup.dir;
      return `<li class="wt-backup-paths__row">
        <i data-lucide="folder" width="16" height="16" class="wt-backup-paths__icon" aria-hidden="true"></i>
        <code class="mono-cell wt-backup-paths__path">${esc(d)}</code>
        ${primary ? '<span class="wt-mod-chip wt-mod-chip--info">Primary</span>' : ''}
      </li>`;
    }).join('');

    return `
      <section class="wt-card wt-card--surface wt-backup-paths wt-scroll-reveal wt-enter">
        ${renderPathsHead(ctx, `Search paths (${paths.length})`)}
        <div class="wt-backup-paths__body">
          <ul class="wt-backup-paths__list">${rows}</ul>
        </div>
        <p class="wt-backup-paths__footer">${footerNote}</p>
      </section>`;
  }

  function renderSetupCard(ctx) {
    const { backup, panel } = ctx;
    const pickBtn = renderPickFolderButton(ctx, { variant: 'primary' });
    const configHint = Labels.backupConfigHint(backup, panel);
    const steps = [
      'Choose backup folder — point Watchtower at your panel\'s backup directory.',
      'Add more folders anytime — each path is merged into BACKUP_DIRS.',
      'Rescan backups — refresh the archive inventory after adding paths.',
      'Panel backups (bloom, Crafty, S3, etc.) — set up in Settings → Backups (about 2 minutes).',
    ];

    return `
      <section class="wt-card wt-card--surface wt-backup-setup wt-enter">
        <h2 class="wt-backup-setup__title"><i data-lucide="database-backup" width="20" height="20"></i> Set up backup tracking</h2>
        <p class="wt-backup-setup__lead">Watchtower does not search for backups until you choose where they live.</p>
        <ol class="wt-backup-briefing__steps wt-backup-setup__steps">
          ${steps.map((s, i) => `
            <li class="wt-backup-briefing__step">
              <span class="wt-backup-briefing__step-num" aria-hidden="true">${i + 1}</span>
              <span class="wt-backup-briefing__step-text">${esc(s)}</span>
            </li>`).join('')}
        </ol>
        ${configHint ? `<p class="wt-backup-setup__hint">${esc(configHint)}</p>` : ''}
        ${backup?.hint ? `<p class="wt-backup-setup__hint">${esc(backup.hint)}</p>` : ''}
        ${pickBtn}
      </section>`;
  }

  function renderWorldStorageSection(f) {
    const storage = f?.optional?.storage || state.liveEnvelope?.storage || {};
    const live = state.liveLatest || {};
    const worldGb = live.world_gb ?? storage.world_gb;
    const dims = live.by_dimension || storage.by_dimension;
    if (worldGb == null && !dims?.length) return '';
    const dimRows = (dims || []).slice(0, 6).map((d) => `
      <div class="wt-dimension-row">
        <span class="wt-dimension-row__label">${esc(d.label || d.id)}</span>
        <span class="wt-dimension-row__value">${d.gb ?? '—'} GB</span>
      </div>`).join('');
    return `
      <section class="wt-card wt-card--surface wt-scroll-reveal wt-enter">
        <h3 class="wt-card__title"><i data-lucide="hard-drive" width="16" height="16"></i> World storage</h3>
        ${worldGb != null ? `<p class="wt-backup-briefing__archive-line"><strong>${worldGb} GB</strong> total world data</p>` : ''}
        ${dimRows ? `<div class="wt-dimension-breakdown">${dimRows}</div>` : ''}
      </section>`;
  }

  function renderBackupsPageBody(f, ctx) {
    const parts = [];
    if (ctx.unconfigured) {
      parts.push(renderSetupCard(ctx));
      parts.push(`
        <section class="wt-card wt-card--surface wt-enter">
          ${renderBackupSettingsCta(Labels.backupWizardCopy?.backupsTabSetupHint)}
        </section>`);
      return parts.join('');
    }
    const localUnconfigured = !ctx.localConfigured || ctx.backup?.status === 'unconfigured';
    const extSection = renderExternalBackupSection(ctx);
    if (extSection) parts.push(extSection);
    parts.push(`
      <div class="wt-backup-settings-cta wt-backup-settings-cta--bar">
        ${renderBackupSettingsCta()}
      </div>`);
    if (!localUnconfigured) {
      parts.push(
        renderWorldStorageSection(f),
        renderBackupBriefingCard(ctx),
        renderBackupInventory(ctx),
        renderBackupPaths(ctx),
      );
    } else if (ctx.backupMode === 'external_only') {
      parts.push(renderExternalOnlyHint(ctx));
    }
    return parts.filter(Boolean).join('');
  }

  function renderExternalOnlyHint(ctx) {
    return `
      <section class="wt-card wt-card--surface wt-enter">
        <p class="wt-backup-setup__hint">You can add a backup folder anytime if you also keep archives on this server.</p>
        ${renderPickFolderButton(ctx, { variant: 'ghost' })}
      </section>`;
  }

  function renderBackups() {
    const f = state.activeFacts;
    const ctx = computeBackupsContext(f);

    if (!ctx.hasData) {
      return `
        <div class="wt-tab-backups">
          <div class="wt-bento">
            ${typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('backups') : ''}
            <div class="wt-bento__span-12" id="backups-page-body">${renderBackupsPageBody(f, ctx)}</div>
          </div>
        </div>`;
    }

    if (ctx.unconfigured) {
      return `
        <div class="wt-tab-backups">
          <div class="wt-bento">
            ${typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('backups') : ''}
            <div class="wt-bento__span-12" id="backups-page-body">${renderBackupsPageBody(f, ctx)}</div>
          </div>
          <div id="fs-picker-mount"></div>
        </div>`;
    }

    const showLocalChrome = ctx.localConfigured && ctx.backup?.status !== 'unconfigured';

    return `
      <div class="wt-tab-backups">
        <div class="wt-bento">
          ${typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('backups') : ''}
          ${showLocalChrome ? `<div class="wt-bento__span-12 wt-stat-grid wt-stat-grid--3 wt-backups-kpi-row wt-stagger" id="backups-kpi-row" aria-label="Backup summary">${renderKpiCards(ctx)}</div>
          <div class="wt-bento__span-12">${renderBackupsChrome(ctx)}</div>` : ''}
          <div class="wt-bento__span-12" id="backups-page-body">${renderBackupsPageBody(f, ctx)}</div>
        </div>
        <div id="fs-picker-mount"></div>
      </div>`;
  }

  const fsPickerState = {
    open: false,
    currentPath: null,
    selectedPath: null,
    archiveCount: 0,
    loading: false,
  };

  function fsPickerTitle() {
    const ctx = computeBackupsContext(state.activeFacts);
    return pickFolderLabel(ctx);
  }

  function renderFsPickerModal() {
    if (!fsPickerState.open) return '';
    const pickerTitle = fsPickerTitle();
    const crumbs = (fsPickerState.breadcrumbs ?? []).map((p, i, arr) => {
      const label = p.split(/[/\\]/).filter(Boolean).pop() || p;
      const isLast = i === arr.length - 1;
      return isLast
        ? `<span class="wt-fs-picker__crumb wt-fs-picker__crumb--current">${esc(label)}</span>`
        : `<button type="button" class="wt-fs-picker__crumb" data-fs-path="${esc(p)}">${esc(label)}</button>`;
    }).join('<span class="wt-fs-picker__sep">/</span>');

    const entries = (fsPickerState.entries ?? []).map((e) => {
      if (e.kind === 'dir') {
        const badge = e.archive_count > 0 ? `<span class="fs-archive-badge">${e.archive_count} archive${e.archive_count === 1 ? '' : 's'}</span>` : '';
        return `<button type="button" class="wt-fs-item wt-fs-item--dir" data-fs-path="${esc(e.path)}">
          <i data-lucide="folder" width="14" height="14" class="wt-fs-item__icon"></i>
          <span>${esc(e.name)}</span>${badge}
        </button>`;
      }
      if (e.archive) {
        return `<div class="wt-fs-item">
          <i data-lucide="archive" width="14" height="14" class="wt-fs-item__icon"></i>
          <span>${esc(e.name)}</span>
        </div>`;
      }
      return `<div class="wt-fs-item muted">
        <i data-lucide="file" width="14" height="14" class="wt-fs-item__icon"></i>
        <span>${esc(e.name)}</span>
      </div>`;
    }).join('');

    const preview = fsPickerState.selectedPath
      ? Labels.fsPickerSelectPreview(fsPickerState.archiveCount)
      : 'Select a folder containing backup archives.';

    return `
      <div class="wt-modal-backdrop is-open" id="fs-picker-overlay">
        <div class="wt-modal wt-fs-picker-modal" role="dialog" aria-labelledby="fs-picker-title">
          <div class="wt-modal__header">
            <h3 class="wt-modal__title" id="fs-picker-title"><i data-lucide="folder-search" width="16" height="16"></i> ${esc(pickerTitle)}</h3>
            <button type="button" class="wt-btn wt-btn--icon wt-btn--ghost wt-modal__close" id="fs-picker-close" aria-label="Close"><i data-lucide="x" width="16" height="16"></i></button>
          </div>
          <div class="wt-modal__body">
          <p class="wt-text-caption wt-text-tertiary">${esc(Labels.fsPickerBanner())}</p>
          <div class="wt-fs-picker">
            <div class="wt-fs-picker__path">${crumbs || '<span class="wt-text-caption">Loading…</span>'}</div>
            <div class="wt-fs-picker__list">${fsPickerState.loading ? '<p class="wt-empty">Loading…</p>' : entries || '<p class="wt-empty">Empty folder</p>'}</div>
          </div>
          ${fsPickerState.truncated ? '<p class="wt-text-caption wt-text-tertiary">Listing truncated — navigate into subfolders.</p>' : ''}
          <p class="wt-text-caption">${esc(preview)}</p>
          <code class="wt-text-mono wt-fs-picker__selected">${fsPickerState.selectedPath ? esc(fsPickerState.selectedPath) : 'No folder selected'}</code>
          </div>
          <div class="wt-modal__footer">
            <button type="button" class="wt-btn wt-btn--ghost" id="fs-picker-cancel">Cancel</button>
            <button type="button" class="wt-btn wt-btn--primary" id="fs-picker-save" ${fsPickerState.selectedPath ? '' : 'disabled'}>Save &amp; rescan</button>
          </div>
        </div>
      </div>`;
  }

  async function openBackupFolderPicker() {
    if (!state.apiMode) {
      showToast('Add backup folder requires the embedded dashboard on a live server.', 'info');
      return;
    }
    await openFsPicker();
  }

  async function openFsPicker() {
    fsPickerState.open = true;
    fsPickerState.loading = true;
    mountFsPicker();
    try {
      const data = await WatchtowerApi.fetchFsRoots();
      const roots = data.roots ?? [];
      const start = roots.find((r) => r.archive_count > 0) || roots[0];
      if (start?.path) {
        await navigateFsPicker(start.path);
      } else {
        fsPickerState.loading = false;
        mountFsPicker();
      }
    } catch (e) {
      showToast(`Could not open folder browser: ${e.message}`, 'error');
      closeFsPicker();
    }
  }

  async function navigateFsPicker(path) {
    fsPickerState.loading = true;
    fsPickerState.currentPath = path;
    mountFsPicker();
    try {
      const data = await WatchtowerApi.fetchFsList(path);
      fsPickerState.breadcrumbs = data.breadcrumbs ?? [path];
      fsPickerState.entries = data.entries ?? [];
      fsPickerState.truncated = data.truncated;
      fsPickerState.archiveCount = data.archive_count ?? 0;
      fsPickerState.selectedPath = path;
      fsPickerState.loading = false;
      mountFsPicker();
      refreshChromeIcons();
    } catch (e) {
      fsPickerState.loading = false;
      showToast(e.message, 'error');
      mountFsPicker();
    }
  }

  function resolveFsPickerMount() {
    return document.getElementById('fs-picker-mount')
      || document.getElementById('bs-fs-picker-mount');
  }

  function mountFsPicker() {
    const el = resolveFsPickerMount();
    if (el) el.innerHTML = renderFsPickerModal();
    bindFsPickerEvents();
  }

  function closeFsPicker() {
    fsPickerState.open = false;
    fsPickerState.currentPath = null;
    fsPickerState.selectedPath = null;
    const el = resolveFsPickerMount();
    if (el) el.innerHTML = '';
  }

  function afterBackupDataUpdate() {
    if (typeof refreshBackupsPage === 'function') {
      refreshBackupsPage();
      updateTabBadges();
    } else {
      render();
    }
  }

  function bindFsPickerEvents() {
    document.getElementById('fs-picker-close')?.addEventListener('click', closeFsPicker);
    document.getElementById('fs-picker-cancel')?.addEventListener('click', closeFsPicker);
    document.getElementById('fs-picker-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'fs-picker-overlay') closeFsPicker();
    });
    document.querySelectorAll('[data-fs-path]').forEach((btn) => {
      btn.addEventListener('click', () => navigateFsPicker(btn.dataset.fsPath));
    });
    document.getElementById('fs-picker-save')?.addEventListener('click', async () => {
      const path = fsPickerState.selectedPath;
      if (!path) return;
      const btn = document.getElementById('fs-picker-save');
      if (btn) btn.disabled = true;
      try {
        const data = await WatchtowerApi.postBackupDirs([path]);
        if (!state.activeFacts.optional) state.activeFacts.optional = {};
        if (data.last_backup) state.activeFacts.optional.last_backup = data.last_backup;
        if (data.backup_inventory) {
          state.activeFacts.optional.backup_inventory = data.backup_inventory;
        } else if (data.last_backup?.inventory_count === 0) {
          state.activeFacts.optional.backup_inventory = [];
        }
        if (data.saved_dirs) {
          state.dashboardSettings = state.dashboardSettings || {};
          state.dashboardSettings.backup_dirs = data.saved_dirs;
        }
        if (state.facts?.optional) {
          if (data.last_backup) state.facts.optional.last_backup = data.last_backup;
          if (data.backup_inventory) state.facts.optional.backup_inventory = data.backup_inventory;
        }
        if (state.reportCache.latest?.facts?.optional) {
          if (data.last_backup) state.reportCache.latest.facts.optional.last_backup = data.last_backup;
          if (data.backup_inventory) {
            state.reportCache.latest.facts.optional.backup_inventory = data.backup_inventory;
          }
        }
        showToast(data.last_backup?.status === 'success'
          ? `Backup OK: ${data.last_backup.path || 'archive found'}`
          : 'Backup folder added — rescan complete', data.last_backup?.status === 'success' ? 'success' : 'info');
        closeFsPicker();
        afterBackupDataUpdate();
        if (typeof WatchtowerBackupSettings !== 'undefined') {
          if (state.canvasView === 'settings' || WatchtowerBackupSettings.isEmbedActive?.()) {
            WatchtowerBackupSettings.refreshPanel();
          }
        }
      } catch (e) {
        showToast(`Save failed: ${e.message}`, 'error');
        if (btn) btn.disabled = false;
      }
    });
  }

  function bindBackupSettingsLink() {
    const tab = document.querySelector('.wt-tab-backups');
    if (!tab || tab.dataset.backupSettingsBound) return;
    tab.dataset.backupSettingsBound = '1';
    tab.addEventListener('click', (e) => {
      if (e.target.closest('.backup-open-settings')) {
        e.preventDefault();
        if (typeof WatchtowerBackupSettings !== 'undefined') {
          WatchtowerBackupSettings.openSettings();
        }
      }
    });
  }

  return {
    renderBackups,
    renderBackupsPageBody,
    renderBackupsChrome,
    renderKpiCards,
    updateBackupsKpiRow,
    updateBackupsChromeKpis,
    computeBackupsContext,
    renderFsPickerModal,
    fsPickerState,
    openBackupFolderPicker,
    openFsPicker,
    navigateFsPicker,
    mountFsPicker,
    closeFsPicker,
    bindFsPickerEvents,
    bindBackupSettingsLink,
  };
})();
