/**
 * Live tab — "Right now" ops alerts (logs, disk, mods, jobs).
 */
const TowerRenderLiveAlerts = (function () {
  const esc = TowerRenderShared.esc;

  function collectAlerts() {
    const meta = state.overviewMeta;
    if (!meta) return [];
    const alerts = [];
    const rightNowSignals = state.opsCache?.right_now?.signals || [];

    for (const sig of rightNowSignals) {
      if (sig.type === 'backup_job') {
        alerts.push({
          icon: 'database-backup',
          category: 'Backup',
          title: 'Backup in progress',
          detail: sig.detail || 'Backup job detected in server logs.',
          tab: 'backups',
          live: true,
          tone: 'info',
        });
      } else if (sig.type === 'restart_scheduled') {
        alerts.push({
          icon: 'refresh-cw',
          category: 'Lifecycle',
          title: 'Restart scheduled',
          detail: sig.detail || 'A restart was scheduled or is imminent.',
          tab: 'activity',
          live: true,
          tone: 'warn',
        });
      }
    }

    const logStale = meta.log_stale_tldr || (state.opsCache?.log_stale?.active ? state.opsCache.log_stale : null);
    if (logStale?.active) {
      const gapMin = logStale.gap_minutes != null ? Math.round(logStale.gap_minutes) : null;
      alerts.push({
        icon: 'file-warning',
        category: 'Logs',
        title: 'Log output stale',
        detail: gapMin != null
          ? 'latest.log has not been updated while the server is still running.'
          : 'No recent log output while the server is still up.',
        metric: gapMin != null ? `${gapMin}m` : null,
        metricHint: 'idle',
        tab: 'issues',
        live: true,
        tone: 'warn',
      });
    }

    if (meta.disk_nudge?.active) {
      alerts.push({
        icon: 'hard-drive',
        category: 'Storage',
        title: 'Disk space low',
        detail: meta.disk_nudge.message,
        tone: 'critical',
      });
    }
    if (meta.backup_nudge?.active) {
      alerts.push({
        icon: 'database-backup',
        category: 'Backups',
        title: 'Backup stale',
        detail: meta.backup_nudge.message,
        tab: 'backups',
        tone: 'warn',
      });
    }
    const extTldr = meta.backup_external_tldr;
    if (extTldr && (extTldr.stale || extTldr.status === 'missing' || extTldr.status === 'failed')) {
      alerts.push({
        icon: 'cloud-off',
        category: 'Backups',
        title: extTldr.label || 'External backup issue',
        detail: Labels.backupExternalSummary(state.opsCache?.backup_external || extTldr),
        tab: 'backups',
        tone: extTldr.status === 'missing' ? 'warn' : 'warn',
      });
    }
    if (meta.mods_changed_tldr?.label) {
      const added = meta.mods_changed_tldr.added_count ?? 0;
      const removed = meta.mods_changed_tldr.removed_count ?? 0;
      const changed = meta.mods_changed_tldr.changed_count ?? 0;
      const chips = [];
      if (added > 0) chips.push(`${added} added`);
      if (removed > 0) chips.push(`${removed} removed`);
      if (changed > 0) chips.push(`${changed} updated`);
      alerts.push({
        icon: 'package-plus',
        category: 'Mods',
        title: 'Mods changed on disk',
        detail: 'JAR files differ from your last full health report.',
        metric: chips.length ? chips.join(' · ') : 'Changed',
        tab: 'performance',
        insightsView: 'mod-changes',
        live: true,
        tone: 'info',
      });
    }
    if (meta.disk_jump_tldr?.active) {
      const delta = meta.disk_jump_tldr.delta_pct;
      alerts.push({
        icon: 'hard-drive',
        category: 'Storage',
        title: 'Disk usage jumped',
        detail: meta.disk_jump_tldr.label || 'Disk use rose noticeably since your last report.',
        metric: delta != null ? `+${Number(delta).toFixed(1)}%` : null,
        tab: 'performance',
        insightsView: 'storage',
        live: true,
        tone: 'warn',
      });
    }

    return alerts;
  }

  function renderRow(alert) {
    const tone = alert.tone || 'warn';
    const metric = alert.metric
      ? `<div class="wt-right-now__metric wt-right-now__metric--${tone}" title="${esc(alert.metricHint || '')}">
          <span class="wt-right-now__metric-value">${esc(alert.metric)}</span>
        </div>`
      : '';
    const liveDot = alert.live
      ? '<span class="wt-right-now__live-dot" title="Live scan"></span>'
      : '';
    const chevron = alert.tab
      ? '<span class="wt-right-now__chev" aria-hidden="true"><i data-lucide="chevron-right" width="16" height="16"></i></span>'
      : '';
    const inner = `
      <span class="wt-right-now__icon wt-right-now__icon--${tone}" aria-hidden="true">
        <i data-lucide="${alert.icon}" width="18" height="18"></i>
      </span>
      <span class="wt-right-now__copy">
        <span class="wt-right-now__meta">
          ${liveDot}
          <span class="wt-right-now__category">${esc(alert.category || 'Alert')}</span>
        </span>
        <span class="wt-right-now__title">${esc(alert.title)}</span>
        <span class="wt-right-now__detail">${esc(alert.detail || '')}</span>
      </span>
      ${metric}
      ${chevron}`;

    if (alert.tab) {
      const viewAttr = alert.insightsView ? ` data-insights-view="${esc(alert.insightsView)}"` : '';
      return `<a href="#" class="wt-right-now__row wt-right-now__row--${tone} tab-link" data-tab="${esc(alert.tab)}"${viewAttr}>${inner}</a>`;
    }
    return `<div class="wt-right-now__row wt-right-now__row--${tone}">${inner}</div>`;
  }

  function renderLiveAlertsSection() {
    const alerts = collectAlerts();
    if (!alerts.length) return '';
    const count = alerts.length;
    return `
      <section class="wt-right-now wt-bento__span-12 wt-enter" aria-label="Right now">
        <header class="wt-right-now__head">
          <div class="wt-right-now__head-main">
            <h2 class="wt-right-now__heading">
              <span class="wt-right-now__heading-icon" aria-hidden="true"><i data-lucide="radio" width="18" height="18"></i></span>
              Right now
            </h2>
          </div>
          <span class="wt-right-now__count">${count} active</span>
        </header>
        <div class="wt-right-now__feed" role="list">
          ${alerts.map((a) => `<div role="listitem">${renderRow(a)}</div>`).join('')}
        </div>
      </section>`;
  }

  return { renderLiveAlertsSection, collectAlerts };
})();
