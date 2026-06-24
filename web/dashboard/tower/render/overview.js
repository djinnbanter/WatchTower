/**
 * Watchtower UI v3 — overview tab renderers
 */
const TowerRenderOverview = (function () {
  const esc = TowerRenderShared.esc;
  const fmtTime = TowerRenderShared.fmtTime;
  const fmtTimeShort = TowerRenderShared.fmtTimeShort;
  const fmtUptime = TowerRenderShared.fmtUptime;
  const uptimeParts = TowerRenderShared.uptimeParts;
  const sparklineCard = TowerRenderShared.sparklineCard;
  const kpiCard = TowerRenderShared.kpiCard;
  const kpiDualCard = TowerRenderShared.kpiDualCard;
  const bentoChip = TowerRenderShared.bentoChip;
  const statusPillMod = TowerRenderShared.statusPillMod;
  const diagIconMod = TowerRenderShared.diagIconMod;
  const sortEventsNewestFirst = TowerRenderShared.sortEventsNewestFirst;
  const truncateDetail = TowerRenderShared.truncateDetail;
  function heapVitalParts(heap, sys) {
    const used = Math.round(heap?.used ?? 0);
    const max = Math.round(heap?.max ?? (sys?.java_xmx_gb ?? 0) * 1024);
    if (!max) {
      return { used: '—', free: '—', sub: 'Heap unknown' };
    }
    const free = Math.max(0, max - used);
    return {
      used,
      free,
      sub: `${max.toLocaleString()} MB max`,
    };
  }

  function renderHeapVitalCard(heap, sys) {
    const parts = heapVitalParts(heap, sys);
    const usedHtml = parts.used === '—'
      ? '—'
      : `${parts.used}<span class="wt-kpi__unit">MB</span>`;
    const freeHtml = parts.free === '—'
      ? '—'
      : `${parts.free}<span class="wt-kpi__unit">MB</span>`;
    return kpiDualCard(
      'vital-mem',
      'Java heap',
      'Used',
      usedHtml,
      'Free',
      freeHtml,
      esc(parts.sub),
    );
  }
  function storageDeltaHtml(mb, label) {
    if (mb == null || mb === '—') return '';
    const n = Number(mb);
    if (Number.isNaN(n)) return '';
    const cls = n > 0 ? 'delta-growth' : n < 0 ? 'delta-shrink' : 'delta-neutral';
    const sign = n > 0 ? '+' : '';
    return `<span class="storage-delta ${cls}">${sign}${n} MB ${label}</span>`;
  }

  function renderPregenCard(job, compact) {
    const { kind, data } = job;
    const last = data.last || {};
    const pct = last.pct ?? 0;
    const pctRounded = Math.min(100, Math.round(pct));
    const chunks = last.chunks ?? 0;
    const total = last.total ?? 0;
    const cps = last.cps ?? last.rate ?? '—';
    const chunksHtml = total
      ? `${Number(chunks).toLocaleString()}<span class="wt-overview-pregen__stat-sub"> / ${Number(total).toLocaleString()}</span>`
      : Number(chunks).toLocaleString();

    if (compact) {
      const radarId = nextPregenId(kind === 'chunky' ? 'chunky' : 'dh');
      const vizAttr = kind === 'chunky' ? 'data-viz-chunky' : 'data-viz-dh';
      return `
      <div class="pregen-card wt-panel compact">
        <div class="pregen-header">
          <h4 class="pregen-title">${esc(Labels.pregenTitle(kind))}</h4>
          <span class="chip">${data.pregen_active ? 'Active' : 'Recent'}</span>
        </div>
        <div class="pregen-grid">
          <canvas id="${radarId}" width="80" height="80" class="pregen-radar" ${vizAttr} data-pct="${pct}"></canvas>
          <div class="pregen-stats">
            <div class="value-text pregen-pct">${pct.toFixed(1)}%</div>
            <div class="chart-caption">${Math.round(chunks)} / ${total || 0} chunks · ${cps} cps</div>
          </div>
        </div>
        ${Viz.barHtml('Progress', pct, 100, '%', 90)}
      </div>`;
    }

    const icon = kind === 'chunky' ? 'layers' : 'mountain';
    const statusCls = data.pregen_active ? 'active' : 'recent';
    const statusLabel = data.pregen_active ? 'Active' : 'Recent';

    return `
      <div class="wt-overview-pregen" data-pregen-kind="${kind}">
        <div class="wt-overview-storage__head">
          <i data-lucide="${icon}" width="16" height="16"></i>
          <span class="wt-overview-storage__label">${esc(Labels.pregenTitle(kind))}</span>
          <span class="wt-overview-pregen__status wt-overview-pregen__status--${statusCls}">${statusLabel}</span>
        </div>
        <div class="wt-overview-storage__value" id="overview-pregen-pct-val">${pct.toFixed(1)}<span class="wt-overview-storage__unit">%</span></div>
        <div class="wt-overview-storage__bar">
          <div class="wt-overview-storage__bar-head"><span>Progress</span><span id="overview-pregen-pct-label">${pctRounded}%</span></div>
          ${renderProgressBar(pct, 'overview-pregen-progress')}
        </div>
        <div class="wt-overview-pregen__stats">
          <div class="wt-overview-pregen__stat">
            <span class="wt-overview-pregen__stat-label">Chunks</span>
            <span class="wt-overview-pregen__stat-value" id="overview-pregen-chunks-val">${chunksHtml}</span>
          </div>
          <div class="wt-overview-pregen__stat">
            <span class="wt-overview-pregen__stat-label">Rate</span>
            <span class="wt-overview-pregen__stat-value" id="overview-pregen-rate-val">${cps}<span class="wt-overview-pregen__stat-unit">cps</span></span>
          </div>
          ${last.eta ? `
          <div class="wt-overview-pregen__stat">
            <span class="wt-overview-pregen__stat-label">ETA</span>
            <span class="wt-overview-pregen__stat-value" id="overview-pregen-eta-val">${esc(last.eta)}</span>
          </div>` : ''}
        </div>
      </div>`;
  }

  function renderWorldJobsOverviewColumn(f) {
    const jobs = getActivePregenJobs(f);
    const body = jobs.length
      ? renderWorldJobs(jobs, false)
      : '<p class="wt-empty">No pregen jobs running</p>';
    return `
      <div class="triage-col" id="world-jobs-overview">
        <h2><i data-lucide="globe" width="14" height="14"></i> World Background Jobs</h2>
        <p class="text-caption">${esc(Labels.pregenSectionSubtitle())}</p>
        <div id="world-jobs-overview-body">${body}</div>
      </div>`;
  }


  function renderWorldJobs(jobs, compact) {
    if (!jobs.length) return '<p class="wt-empty">No pregen jobs running</p>';
    return jobs.map((j) => renderPregenCard(j, compact)).join('');
  }

  function overviewStatusTone(ok, warn) {
    if (!ok) return 'down';
    if (warn) return 'warn';
    return 'ok';
  }

  function statusPillClass(tone) {
    if (tone === 'down') return 'critical';
    if (tone === 'warn') return 'warn';
    return 'healthy';
  }

  function renderSegmentBar(pct, segments) {
    const total = segments || 20;
    const rounded = Math.min(100, Math.max(0, Math.round(pct ?? 0)));
    const filled = Math.round((rounded / 100) * total);
    const fillMod = rounded >= 85 ? 'danger' : rounded >= 70 ? 'warn' : 'on';
    const segs = [];
    for (let i = 0; i < total; i += 1) {
      const on = i < filled ? ` wt-segment-bar__seg--${fillMod}` : '';
      segs.push(`<span class="wt-segment-bar__seg${on}"></span>`);
    }
    return `<div class="wt-segment-bar wt-pattern-hatch" role="presentation">${segs.join('')}</div>`;
  }

  function progressFillMod(pct) {
    const rounded = Math.min(100, Math.max(0, Math.round(pct ?? 0)));
    if (rounded >= 85) return 'danger';
    if (rounded >= 70) return 'warn';
    return 'on';
  }

  function renderProgressBar(pct, barId) {
    const mod = progressFillMod(pct);
    const rounded = Math.min(100, Math.max(0, Math.round(pct ?? 0)));
    return `
      <div class="wt-progress-bar" id="${barId}" style="--progress: ${pct ?? 0}" role="presentation">
        <div class="wt-progress-bar__fill wt-progress-bar__fill--${mod} wt-pattern-hatch"></div>
      </div>
      <span class="wt-visually-hidden">${rounded}%</span>`;
  }

  function statusPillTint(tone, label) {
    if (tone === 'down') return 'critical';
    if (tone === 'warn') return 'warn';
    if (label === 'Mods' && tone === 'ok') return 'neutral';
    return 'healthy';
  }

  function renderOverviewStatusCell(label, value, icon, tone) {
    const tint = statusPillTint(tone, label);
    return `
      <div class="wt-overview-status-pill wt-overview-status-pill--${tint} wt-pressable">
        <span class="wt-overview-status-pill__lead">
          <span class="wt-overview-status-pill__icon"><i data-lucide="${icon}" width="16" height="16"></i></span>
          <span class="wt-overview-status-pill__label">${esc(label)}</span>
        </span>
        <span class="wt-overview-status-pill__value">${value}</span>
      </div>`;
  }

  function renderStatusPills(f) {
    const backup = f.optional?.last_backup;
    const external = f.optional?.backup_external ?? state.opsCache?.backup_external;
    const backupLabel = Labels.backupPillLabelCombined(backup, external, state.overviewMeta?.backup_mode);
    const backupTone = Labels.backupPillTone(backup, external, state.overviewMeta?.backup_mode);
    const hosting = Labels.overviewHostingPill(f, getHostEnvironment(f));
    const java = Labels.overviewJavaPill(f, state.liveLatest);
    const mods = Labels.overviewModsPill(f);

    const cells = [
      renderOverviewStatusCell(
        hosting.label,
        esc(hosting.value),
        hosting.icon,
        hosting.tone,
      ),
      renderOverviewStatusCell(
        java.label,
        esc(java.value),
        java.icon,
        java.tone,
      ),
      renderOverviewStatusCell(
        mods.label,
        esc(mods.value),
        mods.icon,
        mods.tone,
      ),
      renderOverviewStatusCell(
        'Backup',
        esc(backupLabel),
        'database-backup',
        backupTone,
      ),
    ];
    return `<div class="wt-overview-status-strip">${cells.join('')}</div>`;
  }

  function buildOverviewHeadline(f, live) {
    const h = f?.health || {};
    const mc = f?.minecraft || {};
    const opt = f?.optional || {};
    const players = live?.players_online ?? mc.players_online_now ?? 0;
    const tps = live?.tps ?? mc.tps?.overworld?.tps ?? opt.watchtower_native?.dimensions?.[0]?.tps ?? 20;
    const mspt = live?.mspt ?? mc.tps?.overworld?.mspt ?? 0;
    if (h.java_running) {
      return `Server online with ${players} player${players === 1 ? '' : 's'} · ${Number(tps).toFixed(1)} TPS · ${Number(mspt).toFixed(1)} ms/tick`;
    }
    return 'Minecraft process is not running — check your panel and recent logs';
  }

  function buildWelcomeSubline(f, live, effectiveWord) {
    const h = f?.health || {};
    const mc = f?.minecraft || {};
    const opt = f?.optional || {};
    const tps = live?.tps ?? mc.tps?.overworld?.tps ?? opt.watchtower_native?.dimensions?.[0]?.tps ?? 20;
    if (h.java_running) {
      return `Global health at <strong class="wt-welcome__highlight">${esc(effectiveWord)}</strong> · <strong class="wt-welcome__highlight">${Number(tps).toFixed(1)} TPS</strong> right now`;
    }
    return `Server offline — global health <strong class="wt-welcome__highlight">${esc(effectiveWord)}</strong> across the report window`;
  }

  function renderResourceRow(label, pct) {
    const rounded = pct != null ? Math.min(100, Math.max(0, Math.round(pct))) : 0;
    return `
      <div class="wt-resource-row">
        <div class="wt-resource-row__head">
          <span>${esc(label)}</span>
          <span>${pct != null ? `${rounded}%` : '—'}</span>
        </div>
        ${pct != null ? renderSegmentBar(rounded) : ''}
      </div>`;
  }

  function renderResourcePanel(f, live, sys, heap) {
    const hostCpu = live?.host_cpu_pct ?? sys.host_cpu_pct_now ?? 0;
    const diskPct = live?.disk_use_pct ?? sys.disk_use_pct ?? null;
    const heapUsed = Math.round(heap?.used ?? 0);
    const heapMax = Math.round(heap?.max ?? (sys?.java_xmx_gb ?? 0) * 1024);
    const heapPct = heapMax ? (heapUsed / heapMax) * 100 : null;
    const storage = f.optional?.storage || {};
    const worldGb = live?.world_gb ?? storage.world_gb;

    return `
      <div class="wt-card__head">
        <h3 class="wt-card__title"><i data-lucide="gauge" width="16" height="16"></i> Resource usage</h3>
      </div>
      ${renderResourceRow('CPU load', hostCpu)}
      ${renderResourceRow('Memory', heapPct)}
      ${renderResourceRow('Disk', diskPct)}
      ${worldGb != null ? `
        <div class="wt-resource-world">
          <span class="wt-resource-world__label">World storage</span>
          <span class="wt-resource-world__value">${worldGb}<span class="wt-kpi__unit">GB</span></span>
        </div>` : ''}
      ${storage.delta_mb_24h != null ? `<div class="wt-overview-storage__delta">${storageDeltaHtml(storage.delta_mb_24h, '24h')}</div>` : ''}`;
  }

  function kpiDeltaFromTps(tps) {
    const n = Number(tps);
    if (n >= 19.5) return '<span class="wt-kpi-delta wt-kpi-delta--up">Stable</span>';
    if (n >= 15) return '<span class="wt-kpi-delta wt-kpi-delta--down">Slow</span>';
    return '<span class="wt-kpi-delta wt-kpi-delta--down">Critical</span>';
  }

  function renderOverviewUptimeHtml(seconds) {
    const p = uptimeParts(seconds);
    if (!p) return '<span class="wt-overview-uptime__empty">—</span>';
    const showDays = p.days > 0;
    const showHours = showDays || p.hours > 0;
    return `
      <span class="wt-overview-uptime__block wt-overview-uptime__block--d${showDays ? '' : ' hidden'}" data-uptime-part="d">
        <span class="wt-overview-uptime__num" data-uptime-num="d">${p.days}</span><span class="wt-overview-uptime__unit">d</span>
      </span>
      <span class="wt-overview-uptime__block wt-overview-uptime__block--h${showHours ? '' : ' hidden'}" data-uptime-part="h">
        <span class="wt-overview-uptime__num" data-uptime-num="h">${p.hours}</span><span class="wt-overview-uptime__unit">h</span>
      </span>
      <span class="wt-overview-uptime__block" data-uptime-part="m">
        <span class="wt-overview-uptime__num" data-uptime-num="m">${p.minutes}</span><span class="wt-overview-uptime__unit">m</span>
      </span>
      <span class="wt-overview-uptime__block wt-overview-uptime__block--sec" data-uptime-part="s">
        <span class="wt-overview-uptime__num" data-uptime-num="s">${String(p.seconds).padStart(2, '0')}</span><span class="wt-overview-uptime__unit">s</span>
      </span>`;
  }

  function syncOverviewUptimeClock(el, seconds, { tickSec = false } = {}) {
    if (!el) return;
    if (seconds == null || !Number.isFinite(seconds)) {
      el.innerHTML = '<span class="wt-overview-uptime__empty">—</span>';
      return;
    }
    const p = uptimeParts(seconds);
    if (!p) return;

    const showDays = p.days > 0;
    const showHours = showDays || p.hours > 0;

    if (!el.querySelector('[data-uptime-part]')) {
      el.innerHTML = renderOverviewUptimeHtml(seconds);
      return;
    }

    const dayBlock = el.querySelector('[data-uptime-part="d"]');
    const hourBlock = el.querySelector('[data-uptime-part="h"]');
    const minBlock = el.querySelector('[data-uptime-part="m"]');
    const secBlock = el.querySelector('[data-uptime-part="s"]');

    if (dayBlock) {
      dayBlock.classList.toggle('hidden', !showDays);
      const n = dayBlock.querySelector('[data-uptime-num="d"]');
      if (n) n.textContent = String(p.days);
    }
    if (hourBlock) {
      hourBlock.classList.toggle('hidden', !showHours);
      const n = hourBlock.querySelector('[data-uptime-num="h"]');
      if (n) n.textContent = String(p.hours);
    }
    if (minBlock) {
      const n = minBlock.querySelector('[data-uptime-num="m"]');
      if (n) n.textContent = String(p.minutes);
    }
    if (secBlock) {
      const n = secBlock.querySelector('[data-uptime-num="s"]');
      if (n) n.textContent = String(p.seconds).padStart(2, '0');
      if (tickSec && typeof TowerMotion !== 'undefined' && !TowerMotion.prefersReducedMotion()) {
        secBlock.classList.remove('wt-overview-uptime__block--tick');
        void secBlock.offsetWidth;
        secBlock.classList.add('wt-overview-uptime__block--tick');
      }
    }
  }

  function renderOverviewHealthRow(gradCls, verdictMod, beaconCls, effectiveWord, ackSuffix, sessionMod, sessionWord, uptimeSec, scorecardHint) {
    const globalSev = verdictMod === 'critical' ? 'critical' : verdictMod === 'warn' ? 'warn' : 'ok';
    const sessionSev = sessionMod === 'critical' ? 'critical' : sessionMod === 'warn' ? 'warn' : 'ok';
    const uptimeHtml = renderOverviewUptimeHtml(uptimeSec);
    const hintHtml = scorecardHint
      ? `<p class="wt-overview-health-card__scorecard text-caption">${esc(scorecardHint)}</p>`
      : '';
    return `
      <div class="wt-bento__span-12 wt-overview-health-row">
      <div class="wt-card wt-card--surface wt-card--severity-${globalSev} wt-overview-health-card">
        <div class="wt-kpi">
          <span class="wt-kpi__label">Global health</span>
          <span class="wt-overview-health-card__hint">Trust scorecard · full report window</span>
          <div class="wt-overview-health-card__value">
            <span class="wt-beacon wt-beacon--lg ${beaconCls}" id="hero-beacon-dot" data-health-grade="${gradCls}" aria-hidden="true"></span>
            <span class="wt-overview-health-card__word wt-overview-health-card__word--${verdictMod}">${esc(effectiveWord)}${esc(ackSuffix)}</span>
          </div>
          ${hintHtml}
        </div>
      </div>
      <div class="wt-card wt-card--surface wt-card--severity-${sessionSev} wt-overview-health-card">
        <div class="wt-kpi">
          <span class="wt-kpi__label">Current session</span>
          <span class="wt-overview-health-card__hint">Right now on this boot</span>
          <div class="wt-overview-health-card__value">
            <i data-lucide="users" width="18" height="18" class="wt-overview-health-card__icon"></i>
            <span class="wt-overview-health-card__word wt-overview-health-card__word--${sessionMod}">${esc(sessionWord)}</span>
          </div>
        </div>
      </div>
      <div class="wt-card wt-card--surface wt-overview-health-card wt-overview-health-card--uptime wt-overview-health-card--neutral">
        <div class="wt-kpi">
          <span class="wt-kpi__label">Uptime</span>
          <div class="wt-overview-health-card__value wt-overview-health-card__value--uptime">
            <div class="wt-overview-uptime" id="overview-uptime-val" aria-live="polite">${uptimeHtml}</div>
          </div>
        </div>
      </div>
      </div>`;
  }

  function renderDimensionBreakdown(storage, live) {
    const dims = live?.by_dimension || storage?.by_dimension;
    if (!dims?.length) return '';
    const rows = dims.slice(0, 8).map((d) => `
      <div class="wt-dimension-row">
        <span class="wt-dimension-row__label">${esc(d.label || d.id || d.path)}</span>
        <span class="wt-dimension-row__value">${d.gb ?? '—'}<span class="wt-kpi__unit"> GB</span></span>
      </div>`).join('');
    const more = dims.length > 8 ? `<p class="text-caption wt-dimension-more">+${dims.length - 8} more dimensions</p>` : '';
    return `${rows}${more}`;
  }

  function renderOverviewStorageCompact(f) {
    const storage = f.optional?.storage || {};
    const liveStorage = state.liveEnvelope?.storage || {};
    const mergedStorage = { ...storage, ...liveStorage };
    if (state.liveLatest?.by_dimension?.length) {
      mergedStorage.by_dimension = state.liveLatest.by_dimension;
    }
    const sys = f.system || {};
    const worldGb = state.liveLatest?.world_gb ?? mergedStorage.world_gb;
    const diskPct = state.liveLatest?.disk_use_pct ?? sys.disk_use_pct ?? 0;
    const diskRounded = diskPct != null ? Math.min(100, Math.round(diskPct)) : null;
    if (worldGb == null && diskPct == null) {
      return '<p class="wt-empty">No storage data in this report.</p>';
    }
    const dimRows = renderDimensionBreakdown(mergedStorage, state.liveLatest);
    const metaParts = [];
    if (storage.mods_gb != null) metaParts.push(`Mods ${storage.mods_gb} GB`);
    if (storage.logs_gb != null) metaParts.push(`Logs ${storage.logs_gb} GB`);
    const metaHtml = metaParts.length
      ? `<div class="wt-overview-storage__meta">${metaParts.map((p) => `<span>${esc(p)}</span>`).join('')}</div>`
      : '';
    const deltaHtml = storage.delta_mb_24h != null
      ? `<div class="wt-overview-storage__delta">${storageDeltaHtml(storage.delta_mb_24h, '24h')}</div>`
      : '';
    const diskHtml = diskRounded != null
      ? `<div class="wt-overview-storage__disk" style="--disk-pct: ${diskRounded}">
          <div class="wt-overview-storage__donut" aria-hidden="true">
            <div class="wt-overview-storage__donut-inner">
              <span class="wt-overview-storage__donut-pct" id="overview-disk-pct-label">${diskRounded}%</span>
              <span class="wt-overview-storage__donut-label">Disk</span>
            </div>
          </div>
        </div>`
      : '';
    const dimHtml = dimRows
      ? `<details class="wt-overview-storage__dims">
          <summary>By dimension</summary>
          <div class="wt-dimension-breakdown">${dimRows}</div>
        </details>`
      : '';
    return `
      <div class="wt-overview-storage">
        <div class="wt-overview-storage__grid">
          <div class="wt-overview-storage__primary">
            <span class="wt-overview-storage__eyebrow">World size</span>
            <div class="wt-overview-storage__value">${worldGb ?? '—'}<span class="wt-overview-storage__unit">GB</span></div>
            ${deltaHtml}
          </div>
          ${diskHtml}
        </div>
        ${metaHtml}
        ${dimHtml}
      </div>`;
  }

  function renderOverviewStorage(f) {
    const storage = f.optional?.storage || {};
    const worldGb = state.liveLatest?.world_gb ?? storage.world_gb;
    if (worldGb == null && storage.delta_mb_24h == null) return '';
    return `
      <section class="wt-panel overview-storage-card">
        <h2><i data-lucide="hard-drive" width="16" height="16"></i> Storage</h2>
        <div class="overview-storage-row">
          <div class="overview-storage-stat">
            <span class="label-text">World size</span>
            <strong>${worldGb ?? '—'} GB</strong>
          </div>
          ${storage.delta_mb_24h != null ? `<div class="overview-storage-delta">${storageDeltaHtml(storage.delta_mb_24h, '24h world')}</div>` : ''}
        </div>
        <p class="text-caption">24h delta from last health report</p>
      </section>`;
  }

  function renderActionProtocol(f, maxSteps) {
    const acks = getAcks();
    const ignores = getClientModIgnores();
    const steps = Health.buildActionSteps(f, acks, maxSteps, ignores);
    if (!steps.length) return '<p class="wt-empty">No actions required</p>';
    return `
      <div class="action-protocol">
        <div class="action-protocol-header">
          <i data-lucide="check-circle-2" width="16" height="16"></i> Action Protocol
        </div>
        <div class="action-steps">
          ${steps.map((s, i) => `
            <div class="action-step">
              <div class="step-num ${s.severity === 'critical' ? 'red' : s.severity === 'info' ? 'blue' : 'yellow'}">${i + 1}</div>
              <div>
                <strong>${esc(s.title)}</strong>
                ${s.fixSteps?.length
      ? `<ol class="fix-list action-step-fixes">${s.fixSteps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>`
      : `<p>${s.code ? `Check <code class="inline-code">${esc(s.code)}</code>. ` : ''}${esc(s.body)}</p>`}
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function activeLagIssuesForOverview() {
    const peek = state.lagIssuesPeek?.lag_issues;
    const cache = state.opsCache?.lag_issues?.entries;
    const entries = Array.isArray(peek) ? peek : (Array.isArray(cache) ? cache : []);
    return entries.filter((e) => e && !e.resolved);
  }

  function flaggedIssueWhenMs(item) {
    const raw = item.when || item.time;
    if (!raw) return 0;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : 0;
  }

  function collectOverviewFlaggedIssues(f, acks) {
    const ignores = getClientModIgnores();
    const items = [];
    const seen = new Set();

    const push = (entry) => {
      if (!entry?.key || seen.has(entry.key)) return;
      seen.add(entry.key);
      items.push(entry);
    };

    for (const e of activeLagIssuesForOverview()) {
      push({
        key: `lag:${e.id || e.incident_id || e.title}`,
        severity: e.severity || 'warning',
        title: e.title || 'Lag spike',
        summary: e.narrative || '',
        tab: 'issues',
        when: e.time || null,
        live: true,
      });
    }

    if (typeof activeModIssues === 'function') {
      for (const e of activeModIssues()) {
        push({
          key: `mod:${e.id || e.mod_id || e.title}`,
          severity: e.severity || 'warning',
          title: e.title || 'Mod log error',
          summary: e.narrative || '',
          tab: 'mods',
          when: e.time || null,
          live: true,
        });
      }
    }

    const logStaleLive = state.lagIssuesPeek?.log_stale || state.opsCache?.log_stale;
    if (logStaleLive?.active) {
      const hasReportStale = (f?.issues || []).some((i) => i.id === 'LOG_STALE');
      if (!hasReportStale) {
        push({
          key: 'log_stale:live',
          severity: 'warning',
          title: 'Log output stale',
          summary: logStaleLive.gap_minutes != null
            ? `${Math.round(logStaleLive.gap_minutes)} min since latest.log write`
            : 'No recent log output while server is up',
          tab: 'issues',
          when: logStaleLive.checked_at || logStaleLive.last_mtime || null,
          live: true,
        });
      }
    }

    const queue = Health.buildActionQueue(f, acks, ignores);
    for (const q of queue) {
      if (q.tier === 'historical') continue;
      push({
        key: q.key || q.title,
        severity: q.severity || 'warning',
        title: q.title,
        summary: q.summary || '',
        tab: q.primaryAction?.tab || 'issues',
        when: q.when || q.evidence?.[0]?.time || null,
        live: false,
      });
    }

    return items
      .sort((a, b) => flaggedIssueWhenMs(b) - flaggedIssueWhenMs(a))
      .slice(0, 5);
  }

  function renderFlaggedIssueRow(item) {
    const sev = item.severity === 'critical' ? 'critical'
      : item.severity === 'info' ? 'info' : 'warning';
    const liveBadge = item.live
      ? '<span class="wt-source-badge wt-source-badge--scanned">Live</span>'
      : '';
    const summary = item.summary ? esc(truncateDetail(item.summary, 120)) : '';
    return `
      <a href="#" class="wt-server-health__row wt-server-health__row--${sev} tab-link" data-tab="${esc(item.tab)}">
        <span class="wt-server-health__accent" aria-hidden="true"></span>
        <span class="wt-server-health__copy">
          <span class="wt-server-health__title">${esc(item.title)}</span>
          ${summary ? `<span class="wt-server-health__meta">${summary}</span>` : ''}
        </span>
        ${liveBadge}
        <i data-lucide="chevron-right" width="16" height="16" class="wt-server-health__chev" aria-hidden="true"></i>
      </a>`;
  }

  function renderServerHealthColumn(f, acks) {
    const items = collectOverviewFlaggedIssues(f, acks);
    const headerIcon = items.length ? 'shield-alert' : 'shield-check';
    const body = items.length
      ? `<div class="wt-server-health__list">${items.map(renderFlaggedIssueRow).join('')}</div>`
      : `<div class="wt-server-health__clear" role="status">
          <i data-lucide="shield-check" width="20" height="20" aria-hidden="true"></i>
          <p><strong>All clear</strong> — no flagged issues right now.</p>
        </div>`;

    return `
        <div class="wt-card__head wt-server-health__head">
          <h3 class="wt-card__title"><i data-lucide="${headerIcon}" width="16" height="16"></i> Server health</h3>
          <a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="issues">Full issues list →</a>
        </div>
        ${body}`;
  }

  function renderRecentActivityStrip(facts, embedded) {
    const events = sortEventsNewestFirst(facts?.events ?? []);
    const recent = events.slice(0, 5);

    const listHtml = recent.length
      ? recent.map((ev, i) => `
          <div class="wt-activity-item${i === 0 ? ' wt-activity-item--recent' : ''}">
            <div class="wt-activity-item__time">${fmtTimeShort(ev.time)} · ${esc(Labels.eventType(ev.type))}</div>
            <div class="wt-activity-item__desc">${esc(Labels.eventTitle(ev))}${ev.detail ? ` — ${esc(truncateDetail(ev.detail))}` : ''}</div>
          </div>`).join('')
      : '<p class="wt-empty">No recent activity in this report window.</p>';

    const body = `
        <div class="wt-card__head">
          <h2 class="wt-card__title"><i data-lucide="history" width="16" height="16"></i> Recent activity</h2>
          <a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="activity">Open Activity →</a>
        </div>
        <div class="wt-activity-strip">${listHtml}</div>`;

    if (embedded) return body;
    return `
      <div class="wt-card wt-card--surface wt-bento__span-6 wt-enter">
        ${body}
      </div>`;
  }

  function renderActivityDrawer(facts) {
    return renderRecentActivityStrip(facts);
  }

  function renderPerformanceInsightsCard() {
    const insights = state.performanceInsights;
    const enabled = insights?.enabled !== false;
    const list = insights?.insights || [];
    const tldr = state.overviewMeta?.performance_insights_tldr;
    if (insights && insights.enabled === false) {
      return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-enter">
        <div class="wt-card__head">
          <h3 class="wt-card__title"><i data-lucide="bar-chart-3" width="16" height="16"></i> Performance insights</h3>
        </div>
        <p class="wt-empty">Minute rollups are disabled. Enable <code>L1_ROLLUP_ENABLED</code> in watchtower.conf.</p>
      </div>`;
    }
    if (insights && insights.sufficient_data === false && !list.length && !tldr) {
      return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-enter">
        <div class="wt-card__head">
          <h3 class="wt-card__title"><i data-lucide="bar-chart-3" width="16" height="16"></i> Performance insights</h3>
        </div>
        <p class="wt-empty">Need more uptime history — check back after 24 hours of minute rollups.</p>
      </div>`;
    }
    const top = list.slice(0, 1);
    if (!top.length && tldr?.label) {
      top.push({ title: tldr.label, detail: tldr.detail || '', severity: 'info' });
    }
    if (!top.length) return '';
    const ins = top[0];
    const sev = ins.severity === 'critical' ? 'critical' : ins.severity === 'warning' ? 'warn' : 'info';
    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-enter" id="overview-perf-insights">
        <div class="wt-card__head">
          <h3 class="wt-card__title"><i data-lucide="bar-chart-3" width="16" height="16"></i> Performance insights</h3>
          <a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="performance">Open Insights →</a>
        </div>
        <div class="wt-perf-insight wt-perf-insight--${sev}">
          <strong>${esc(ins.title)}</strong>
          ${ins.detail ? `<span class="text-caption">${esc(truncateDetail(ins.detail, 160))}</span>` : ''}
        </div>
      </div>`;
  }

  function renderOverview() {
    const f = state.activeFacts;
    const acks = getAcks();
    const ignores = getClientModIgnores();
    const health = Health.displayHealth(f, acks, ignores);
    const mc = f.minecraft || {};
    const sys = f.system || {};
    const opt = f.optional || {};
    const live = state.liveLatest;
    const tps = live?.tps ?? mc.tps?.overworld?.tps ?? opt.watchtower_native?.dimensions?.[0]?.tps ?? 20;
    const mspt = live?.mspt ?? mc.tps?.overworld?.mspt ?? 0;
    const hostCpu = live?.host_cpu_pct ?? sys.host_cpu_pct_now ?? 0;
    const heap = live?.heap_mb || opt.watchtower_native?.heap_mb || mc.heap_mb || {};
    const players = live?.players_online ?? mc.players_online_now ?? 0;
    const gradCls = health.effective === 'critical' ? 'critical' : health.effective === 'warning' ? 'warning' : 'ok';
    const effectiveWord = Labels.healthStatus(health.effective);
    const ackSuffix = health.ackCount > 0 && health.effective !== health.overall ? ` (${health.ackCount} acked)` : '';
    const scorecard = state.overviewMeta?.scorecard;
    const scorecardWord = scorecard?.grade_word;
    const scorecardHint = scorecard?.performance?.subtitle ?? '';
    const displayWord = scorecardWord || effectiveWord;
    const scorecardGrade = scorecard?.grade;
    const displayGradCls = scorecardGrade === 'critical' ? 'critical'
      : scorecardGrade === 'degraded' ? 'warning'
        : scorecardGrade === 'healthy' ? 'ok'
          : gradCls;
    const displayBeaconCls = displayGradCls === 'critical'
      ? 'wt-beacon--critical wt-beacon--pulse-critical'
      : displayGradCls === 'warning'
        ? 'wt-beacon--warn wt-beacon--pulse-warn'
        : 'wt-beacon--healthy wt-beacon--pulse-healthy';
    const displayVerdictMod = displayGradCls === 'critical' ? 'critical' : displayGradCls === 'warning' ? 'warn' : 'ok';
    const sessionMod = health.current === 'critical' ? 'critical' : health.current === 'warning' ? 'warn' : 'ok';
    const sessionWord = Labels.healthStatus(health.current);
    const uptimeSec = live?.java_uptime_sec ?? sys.java_uptime_sec;
    const headline = buildOverviewHeadline(f, live);
    const onboardingCard = renderOnboardingCard();
    const noReportBanner = state.apiMode && state.noReportYet && !onboardingCard
      ? '<div class="wt-banner wt-banner--info"><p><strong>Live works now</strong> — charts, crash scans, and online players update without a report. Run a baseline report to unlock Issues, mod analysis, and session history.</p></div>'
      : '';
    const hostname = titleCaseHostname(f.meta?.hostname ?? state.liveConfig?.hostname ?? 'your server');
    const serverIconUrl = getServerIconUrl();
    const welcomeSub = buildWelcomeSubline(f, live, effectiveWord);
    const freshness = state.overviewMeta
      ? `<p class="wt-welcome__meta">${esc(Labels.formatReportFreshness(state.overviewMeta))}</p>`
      : `<p class="wt-welcome__meta">Report generated ${fmtTime(f.meta?.generated)}</p>`;

    const supportBundleBtn = `<button type="button" class="wt-btn wt-btn--outline wt-btn--sm" id="support-bundle-btn"><i data-lucide="life-buoy" width="14" height="14"></i> Download support bundle</button>`;

    return `
      <div class="wt-tab-overview">
      ${onboardingCard}
      ${noReportBanner}

      <div class="wt-bento wt-stagger">
        ${supportBundleBtn ? `<div class="wt-bento__span-12 wt-overview-support-top">${supportBundleBtn}</div>` : ''}
        <header class="wt-welcome wt-bento__span-12 wt-hero-card wt-hero-card--compact">
          <div class="wt-welcome__lead">
            <div class="wt-welcome__icon-wrap" id="overview-server-icon-wrap">
              <img
                id="overview-server-icon"
                class="wt-welcome__icon"
                src="${esc(state.apiMode ? '' : serverIconUrl)}"
                alt="${esc(hostname)} server icon"
                width="64"
                height="64"
                decoding="async"
              >
            </div>
            <div class="wt-welcome__bar">
            <div class="wt-welcome__copy">
              <h1 class="wt-welcome__title">Welcome back, <span class="wt-welcome__accent">${esc(hostname)}</span></h1>
              <p class="wt-welcome__sub">${welcomeSub}</p>
            </div>
            <div class="wt-welcome__actions">
              <button type="button" class="wt-btn wt-btn--accent-text wt-btn--sm" id="overview-run-report-btn">+ Run report</button>
              <a href="#" class="wt-btn wt-btn--outline wt-btn--sm tab-link" data-tab="issues"><i data-lucide="triangle-alert" width="14" height="14"></i> View issues</a>
            </div>
            </div>
          </div>

          <div class="wt-bento__span-12 wt-overview-status-wrap">
            ${renderStatusPills(f)}
          </div>

          ${health.statusNote ? `<p class="wt-welcome__meta">${esc(health.statusNote)}</p>` : ''}
          ${freshness}
        </header>

        ${renderOverviewHealthRow(displayGradCls, displayVerdictMod, displayBeaconCls, displayWord, ackSuffix, sessionMod, sessionWord, uptimeSec, scorecardHint)}

        ${kpiCard('vital-tps', 'Tick performance', `${Number(tps).toFixed(2)}<span class="wt-kpi__unit">TPS</span>`, `MSPT <strong id="vital-mspt-sub">${Number(mspt).toFixed(1)} ms</strong>`, kpiDeltaFromTps(tps))}
        ${kpiCard('vital-cpu', 'Host CPU', `${Math.round(hostCpu)}<span class="wt-kpi__unit">%</span>`, esc(Labels.liveCpuCaption(live, sys, getHostEnvironment(f))), hostCpu < 70 ? '<span class="wt-kpi-delta wt-kpi-delta--up">OK</span>' : hostCpu < 85 ? '<span class="wt-kpi-delta wt-kpi-delta--down">High</span>' : '<span class="wt-kpi-delta wt-kpi-delta--down">Hot</span>')}
        ${renderHeapVitalCard(heap, sys)}
        ${kpiCard('vital-session', 'Players online', `${players}`, 'Session roster', players > 0 ? '<span class="wt-kpi-delta wt-kpi-delta--up">Active</span>' : '<span class="wt-kpi-delta">Idle</span>')}

        <div class="wt-bento__span-12 wt-live-toolbar">
          <div class="wt-live-toolbar__controls">${typeof ChartWindow !== 'undefined' ? ChartWindow.vitalsSelectHtml('Vitals range', typeof maxRetentionHours === 'function' ? maxRetentionHours() : 2160) : ''}</div>
        </div>

        <p class="wt-bento__span-12 text-caption samples-freshness" id="samples-freshness-caption"></p>

        ${renderPerformanceInsightsCard()}

        <div class="wt-overview-stack wt-bento__span-8">
          <div class="wt-card wt-card--surface wt-overview-server-health">
            ${renderServerHealthColumn(f, acks)}
          </div>
          <div class="wt-card wt-card--surface wt-overview-activity">
            ${renderRecentActivityStrip(f, true)}
          </div>
        </div>

        <div class="wt-overview-stack wt-bento__span-4">
          <div class="wt-card wt-card--surface wt-overview-storage-card">
            <div class="wt-card__head">
              <h3 class="wt-card__title"><i data-lucide="hard-drive" width="16" height="16"></i> Storage</h3>
            </div>
            ${renderOverviewStorageCompact(f)}
          </div>
          <div class="wt-card wt-card--surface" id="world-jobs-overview">
            <div class="wt-card__head">
              <h2 class="wt-card__title"><i data-lucide="globe" width="14" height="14"></i> World background jobs</h2>
            </div>
            <p class="wt-card__lead">${esc(Labels.pregenSectionSubtitle())}</p>
            <div id="world-jobs-overview-body">${getActivePregenJobs(f).length ? renderWorldJobs(getActivePregenJobs(f), false) : '<p class="wt-empty">No pregen jobs running</p>'}</div>
          </div>
        </div>
      </div>
      </div>`;
  }

  function needsOnboarding() {
    return typeof WatchtowerSetupWizard !== 'undefined' && WatchtowerSetupWizard.needsResumeCard();
  }

  function renderOnboardingCard() {
    if (!needsOnboarding()) return '';
    if (typeof WatchtowerSetupWizard !== 'undefined') {
      return WatchtowerSetupWizard.renderResumeCard();
    }
    return '';
  }

  return { renderOverview, renderOnboardingCard, renderServerHealthColumn, renderActionProtocol, renderOverviewStorageCompact, renderOverviewStorage, renderRecentActivityStrip, renderActivityDrawer, renderPerformanceInsightsCard, renderStatusPills, renderPregenCard, renderWorldJobsOverviewColumn, renderWorldJobs, renderOverviewUptimeHtml, syncOverviewUptimeClock, needsOnboarding };
})();
