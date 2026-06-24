/**
 * Insights tab — mod inventory & storage drill-down views.
 */
const TowerRenderInsightsOps = (function () {
  const esc = TowerRenderShared.esc;
  const fmtRelative = TowerRenderShared.fmtRelative;

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function fmtSize(bytes) {
    if (bytes == null || Number.isNaN(Number(bytes))) return '—';
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fmtMtime(sec) {
    if (sec == null) return '—';
    const d = new Date(Number(sec) * 1000);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  function inventoryBlock() {
    return state.opsCache?.mods_inventory || null;
  }

  function modDiff() {
    return inventoryBlock()?.diff || null;
  }

  function renderChangeTable(rows, columns) {
    if (!rows?.length) {
      return '<p class="wt-empty wt-insights-ops__empty">None</p>';
    }
    return `
      <div class="wt-table-wrap">
        <table class="wt-table wt-table--compact wt-insights-ops__table">
          <thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((row) => `
            <tr>${columns.map((c) => `<td class="${esc(c.cls || '')}">${c.render(row)}</td>`).join('')}</tr>
          `).join('')}</tbody>
        </table>
      </div>`;
  }

  function renderModChangesBody() {
    const inv = inventoryBlock();
    const diff = modDiff();
    const scannedAt = inv?.scanned_at;
    const added = diff?.added || [];
    const removed = diff?.removed || [];
    const changed = diff?.changed || [];
    const hasChanges = diff?.has_changes;

    if (!diff || !hasChanges) {
      return `
        <div class="wt-card wt-card--surface wt-bento__span-12">
          <p class="wt-empty">No mod jar changes detected since your last full health report.</p>
          <p class="text-caption">Background scans compare files in <code>mods/</code> to the snapshot from your last <code>/watchtower run</code>.</p>
        </div>`;
    }

    const summary = [
      added.length ? `${added.length} added` : '',
      removed.length ? `${removed.length} removed` : '',
      changed.length ? `${changed.length} updated` : '',
    ].filter(Boolean).join(' · ');

    const addedCols = [
      { label: 'Mod', cls: 'wt-insights-ops__name', render: (r) => `<span class="wt-insights-ops__name-inner"><strong>${esc(r.display_name || Labels.modFriendlyName(r.mod_id) || r.jar)}</strong>${r.mod_id ? `<span class="text-caption mono-cell">${esc(r.mod_id)}</span>` : ''}</span>` },
      { label: 'JAR', cls: 'mono-cell', render: (r) => esc(r.jar) },
      { label: 'Version', cls: 'mono-cell', render: (r) => esc(r.version || '—') },
      { label: '', render: () => '<span class="wt-mod-chip wt-mod-chip--info">New</span>' },
    ];

    const removedCols = [
      { label: 'Mod', cls: 'wt-insights-ops__name', render: (r) => `<span class="wt-insights-ops__name-inner"><strong>${esc(r.display_name || Labels.modFriendlyName(r.mod_id) || r.jar)}</strong>${r.mod_id ? `<span class="text-caption mono-cell">${esc(r.mod_id)}</span>` : ''}</span>` },
      { label: 'JAR', cls: 'mono-cell', render: (r) => esc(r.jar) },
      { label: '', render: () => '<span class="wt-mod-chip wt-mod-chip--muted">Removed</span>' },
    ];

    const changedCols = [
      { label: 'Mod', cls: 'wt-insights-ops__name', render: (r) => `<span class="wt-insights-ops__name-inner"><strong>${esc(r.display_name || Labels.modFriendlyName(r.mod_id) || r.jar)}</strong>${r.mod_id ? `<span class="text-caption mono-cell">${esc(r.mod_id)}</span>` : ''}</span>` },
      { label: 'JAR', cls: 'mono-cell', render: (r) => esc(r.jar) },
      { label: 'Change', cls: 'mono-cell', render: (r) => {
        const parts = [];
        if (r.prev_size != null && r.size != null && r.prev_size !== r.size) {
          parts.push(`${fmtSize(r.prev_size)} → ${fmtSize(r.size)}`);
        }
        if (r.prev_mtime != null && r.mtime != null && r.prev_mtime !== r.mtime) {
          parts.push(`${fmtMtime(r.prev_mtime)} → ${fmtMtime(r.mtime)}`);
        }
        return esc(parts.length ? parts.join(' · ') : 'File updated');
      } },
      { label: '', render: () => '<span class="wt-mod-chip wt-mod-chip--warning">Updated</span>' },
    ];

    return `
      <section class="wt-card wt-card--surface wt-bento__span-12">
        <h3 class="wt-card__title"><i data-lucide="package-plus" width="16" height="16"></i> Added</h3>
        ${renderChangeTable(added, addedCols)}
      </section>

      <section class="wt-card wt-card--surface wt-bento__span-12">
        <h3 class="wt-card__title"><i data-lucide="package-minus" width="16" height="16"></i> Removed</h3>
        ${renderChangeTable(removed, removedCols)}
      </section>

      <section class="wt-card wt-card--surface wt-bento__span-12">
        <h3 class="wt-card__title"><i data-lucide="package" width="16" height="16"></i> Updated</h3>
        ${renderChangeTable(changed, changedCols)}
      </section>

      <p class="wt-bento__span-12 text-caption">
        <a href="#" class="tab-link" data-tab="mods">Open full mod manifest →</a>
        for conflict analysis and log errors.
      </p>`;
  }

  function mergedStorage() {
    const f = state.activeFacts;
    const storage = f?.optional?.storage || {};
    const liveStorage = state.liveEnvelope?.storage || {};
    const merged = { ...storage, ...liveStorage };
    if (state.liveLatest?.world_gb != null) {
      merged.world_gb = state.liveLatest.world_gb;
    }
    if (state.liveLatest?.by_dimension?.length) {
      merged.by_dimension = state.liveLatest.by_dimension;
    } else if (liveStorage.by_dimension?.length) {
      merged.by_dimension = liveStorage.by_dimension;
    }
    return merged;
  }

  function renderDiskJumpCard(jump) {
    const active = jump?.active;
    const basePct = jump?.baseline_disk_use_pct;
    const curPct = jump?.disk_use_pct ?? state.liveLatest?.disk_use_pct ?? state.activeFacts?.system?.disk_use_pct;
    const deltaPct = jump?.delta_pct;
    const deltaFree = jump?.delta_free_gb;
    const scannedAt = jump?.scanned_at;

    if (!active && curPct == null) {
      return `
        <div class="wt-card wt-card--surface wt-bento__span-12">
          <p class="wt-empty">No host disk jump detected since your last report.</p>
        </div>`;
    }

    const before = basePct != null ? Math.min(100, Math.round(basePct)) : null;
    const after = curPct != null ? Math.min(100, Math.round(curPct)) : null;
    const barHtml = before != null && after != null
      ? `<div class="wt-insights-disk-jump__compare" aria-hidden="true">
          <div class="wt-insights-disk-jump__track">
            <div class="wt-insights-disk-jump__fill wt-insights-disk-jump__fill--before" style="width:${before}%"></div>
            <div class="wt-insights-disk-jump__fill wt-insights-disk-jump__fill--after" style="width:${after}%"></div>
          </div>
          <div class="wt-insights-disk-jump__labels">
            <span>Report baseline <strong>${before}%</strong></span>
            <span>Now <strong>${after}%</strong></span>
          </div>
        </div>`
      : '';

    const deltaHtml = deltaPct != null
      ? `<span class="wt-insights-disk-jump__delta">+${Number(deltaPct).toFixed(1)}%</span>`
      : '';
    const freeHtml = deltaFree != null && deltaFree > 0
      ? `<span class="wt-insights-disk-jump__free">${Number(deltaFree).toFixed(1)} GB less free</span>`
      : '';

    return `
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-insights-disk-jump${active ? ' wt-insights-disk-jump--active' : ''}">
        <div class="wt-card__head">
          <h3 class="wt-card__title"><i data-lucide="hard-drive" width="16" height="16"></i> Host disk${active ? ' jumped' : ''}</h3>
          ${active ? '<span class="wt-source-badge wt-source-badge--live">Live scan</span>' : ''}
        </div>
        <p class="text-caption wt-insights-disk-jump__note">
          Compared to your last full health report — this is the <strong>host volume</strong> (entire server disk), not a single Minecraft dimension.
        </p>
        ${jump?.message && active ? `<p class="wt-insights-disk-jump__message">${esc(jump.message)}</p>` : ''}
        <div class="wt-insights-disk-jump__stats">
          ${deltaHtml}
          ${freeHtml}
          ${scannedAt && typeof fmtRelative === 'function' ? `<span class="text-caption">· ${esc(fmtRelative(scannedAt))}</span>` : ''}
        </div>
        ${barHtml}
      </section>`;
  }

  function renderDimensionSection(storage) {
    const dims = [...(storage.by_dimension || [])].sort((a, b) => (Number(b.gb) || 0) - (Number(a.gb) || 0));
    const maxGb = Math.max(...dims.map((d) => Number(d.gb) || 0), 0.001);
    const metaParts = [];
    if (storage.world_gb != null) metaParts.push(`World ${storage.world_gb} GB`);
    if (storage.mods_gb != null) metaParts.push(`Mods ${storage.mods_gb} GB`);
    if (storage.logs_gb != null) metaParts.push(`Logs ${storage.logs_gb} GB`);

    const dimRows = dims.length
      ? dims.map((d) => {
        const gb = Number(d.gb) || 0;
        const pct = Math.round((gb / maxGb) * 100);
        return `
          <div class="wt-dimension-row">
            <span class="wt-dimension-row__label">${esc(d.label || d.id || d.path)}</span>
            <div class="wt-dimension-row__bar-track" aria-hidden="true">
              <div class="wt-dimension-row__bar-fill wt-bar-grow-pending" data-bar-width="${pct}" style="width:0%"></div>
            </div>
            <span class="wt-dimension-row__value">${d.gb ?? '—'}<span class="wt-kpi__unit"> GB</span></span>
          </div>`;
      }).join('')
      : '<p class="wt-empty">No dimension breakdown in the latest report or live envelope.</p>';

    return `
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-scroll-reveal">
        <h3 class="wt-card__title"><i data-lucide="globe" width="16" height="16"></i> Where space lives</h3>
        <p class="text-caption">Current world folder sizes from your report or live samples — sorted largest first.</p>
        ${metaParts.length ? `<div class="wt-insights-storage__meta">${metaParts.map((p) => `<span>${esc(p)}</span>`).join('')}</div>` : ''}
        <div class="wt-dimension-breakdown">${dimRows}</div>
      </section>`;
  }

  function renderStorageBody() {
    const jump = state.opsCache?.disk_jump || null;
    const storage = mergedStorage();
    return `${renderDiskJumpCard(jump)}${renderDimensionSection(storage)}`;
  }

  function renderModChangesView() {
    return `
      <div class="wt-tab-performance wt-insights-ops">
        <div class="wt-bento wt-stagger">
          ${renderModChangesBody()}
        </div>
      </div>`;
  }

  function renderStorageView() {
    return `
      <div class="wt-tab-performance wt-insights-ops">
        <div class="wt-bento wt-stagger">
          ${renderStorageBody()}
        </div>
      </div>`;
  }

  function insightsOpsCounts() {
    const diff = modDiff();
    const modChanges = diff?.has_changes
      ? (diff.added_count ?? 0) + (diff.removed_count ?? 0) + (diff.changed_count ?? 0)
      : 0;
    const storageAlert = state.opsCache?.disk_jump?.active ? 1 : 0;
    return { modChanges, storageAlert };
  }

  return {
    renderModChangesView,
    renderStorageView,
    renderModChangesBody,
    renderStorageBody,
    insightsOpsCounts,
  };
})();
