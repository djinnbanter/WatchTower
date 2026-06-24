/**
 * Watchtower Dashboard UI v5
 */

function scheduleSparklineRefresh(pulseReadout = false) {
  if (state.chartUpdateScheduled) return;
  state.chartUpdateScheduled = true;
  requestAnimationFrame(() => {
    state.chartUpdateScheduled = false;
    refreshSparklinesFromSamples(pulseReadout);
  });
}




function nextPregenId(prefix) {
  state.pregenIdCounter += 1;
  return `${prefix}-${state.pregenIdCounter}`;
}








function getAcks() {
  return Acks.load(state.activeFacts?.meta?.hostname);
}

function getClientModIgnores() {
  return ClientModIgnores.load(state.activeFacts?.meta?.hostname);
}


function updateTabNavState() {
  document.querySelectorAll('.wt-rail__link[data-tab]').forEach((t) => {
    const active = t.dataset.tab === state.activeTab;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  updateTabBadges();
}

function updateTabBadges() {
  const f = state.activeFacts;
  if (!f) {
    setTabBadge('issues', 0);
    setTabBadge('crashes', 0);
    setTabBadge('mods', 0);
    setTabBadge('backups', 0);
    setTabBadge('activity', 0);
    setTabBadge('performance', 0);
    return;
  }
  const acks = getAcks();
  const ignores = getClientModIgnores();
  const queue = Health.buildActionQueue(f, acks, ignores);
  const attentionCount = queue.filter((i) => i.tier === 'now').length;
  const liveLagCount = (() => {
    const peek = state.lagIssuesPeek?.lag_issues;
    const cache = state.opsCache?.lag_issues?.entries;
    const entries = Array.isArray(peek) ? peek : (Array.isArray(cache) ? cache : []);
    return entries.filter((e) => e && !e.resolved).length;
  })();
  const issuesBadgeCount = attentionCount + liveLagCount + (typeof activeModIssues === 'function' ? activeModIssues().length : 0);
  const crashCount = Health.countUnreviewedCrashes(f, acks);
  const modErrCount = typeof mergedModLogErrors === 'function'
    ? mergedModLogErrors(f, state.opsCache).length
    : (f?.optional?.mod_log_errors ?? []).filter((e) => e.mod_id !== 'client_noise').length;
  setTabBadge('issues', issuesBadgeCount, issuesBadgeCount > 0 ? 'warn' : '');
  setTabBadge('crashes', crashCount, crashCount > 0 ? 'crit' : '');
  setTabBadge('mods', modErrCount, modErrCount > 0 ? 'warn' : '');
  const backup = f?.optional?.last_backup;
  const ext = f?.optional?.backup_external ?? state.opsCache?.backup_external;
  const mode = state.overviewMeta?.backup_mode || Labels.backupModeFromParts(backup, ext);
  const backupNeedsAttention = mode === 'none'
    || (ext?.configured && (ext.stale || ext.status === 'missing' || ext.status === 'failed' || ext.status === 'stale'))
    || (backup && backup.status !== 'success'
      && (backup.status === 'unconfigured' || backup.status === 'not_found' || backup.status === 'stale' || backup.stale)
      && !(ext?.configured && (ext.status === 'success' || ext.status === 'running') && !ext.stale));
  setTabBadge('backups', backupNeedsAttention ? 1 : 0, backupNeedsAttention ? 'warn' : '');
  const activityEvents = state.activityEvents.length ? state.activityEvents : (f?.events ?? []);
  const alertCount = activityEvents.filter((ev) => {
    const t = ev.type === 'crash' ? 'crash_report' : ev.type === 'reboot' ? 'manual_reboot' : ev.type;
    return t === 'crash_report' || t === 'manual_reboot' || t === 'kernel_oom'
      || t === 'tick_lag' || t === 'lag_incident';
  }).length;
  setTabBadge('activity', alertCount, alertCount > 0 ? 'warn' : '');
  const modDiff = state.opsCache?.mods_inventory?.diff;
  const insightsOpsCount = (modDiff?.has_changes
    ? (modDiff.added_count ?? 0) + (modDiff.removed_count ?? 0) + (modDiff.changed_count ?? 0)
    : 0) + (state.opsCache?.disk_jump?.active ? 1 : 0);
  setTabBadge('performance', insightsOpsCount, insightsOpsCount > 0 ? 'warn' : '');
}

function setTabBadge(tab, count, variant = '') {
  const badge = document.querySelector(`.wt-rail__link[data-tab="${tab}"] .wt-rail__badge[data-tab-badge="${tab}"]`)
    || document.querySelector(`[data-tab-badge="${tab}"]`);
  if (!badge) return;
  const prev = state.tabBadgeCounts[tab] ?? 0;
  if (!count || count <= 0) {
    badge.classList.add('hidden');
    badge.textContent = '';
    state.tabBadgeCounts[tab] = 0;
    return;
  }
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.classList.remove('hidden');
  badge.classList.remove('wt-rail__badge--warn', 'wt-rail__badge--crit');
  if (variant === 'warn') badge.classList.add('wt-rail__badge--warn');
  if (variant === 'crit') badge.classList.add('wt-rail__badge--crit');
  if (count > prev && typeof WatchtowerMotion !== 'undefined') {
    WatchtowerMotion.badgePop(badge);
  }
  state.tabBadgeCounts[tab] = count;
}


function syncHeroBeaconPulse(grade) {
  const dot = document.getElementById('hero-beacon-dot');
  if (!dot) return;
  if (state.lastHeroHealthGrade !== grade) {
    if (typeof WatchtowerMotion !== 'undefined') {
      WatchtowerMotion.beaconPulseOnce(dot);
    }
    state.lastHeroHealthGrade = grade;
  }
}




function getActivePregenJobs(f) {
  const opt = { ...(f?.optional || {}) };
  const liveDh = state.liveEnvelope?.dh_pregen;
  if (liveDh?.last) {
    opt.dh_pregen = liveDh;
  }
  const liveChunky = state.liveEnvelope?.chunky_pregen;
  if (liveChunky?.last) {
    opt.chunky_pregen = liveChunky;
  }
  const jobs = [];
  const dh = opt.dh_pregen;
  if (dh && (dh.pregen_active || (dh.last?.pct != null && !dh.pregen_paused))) jobs.push({ kind: 'dh', data: dh });
  const chunky = opt.chunky_pregen;
  if (chunky && (chunky.pregen_active || (chunky.last?.pct != null && !chunky.pregen_paused))) jobs.push({ kind: 'chunky', data: chunky });
  return jobs;
}

function updateOverviewProgressBar(barId, pct, labelId) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  const rounded = Math.min(100, Math.max(0, Math.round(pct ?? 0)));
  bar.style.setProperty('--progress', pct ?? 0);
  const label = labelId ? document.getElementById(labelId) : null;
  if (label) label.textContent = `${rounded}%`;
  const fill = bar.querySelector('.wt-progress-bar__fill');
  if (fill) {
    const mod = rounded >= 85 ? 'danger' : rounded >= 70 ? 'warn' : 'on';
    fill.className = `wt-progress-bar__fill wt-progress-bar__fill--${mod} wt-pattern-hatch`;
  }
}

function updateOverviewPregenLive(chunky) {
  const last = chunky?.last;
  if (!last || !document.querySelector('.wt-overview-pregen') || state.overviewIntroPlaying) return;
  const pct = last.pct ?? 0;
  const pctRounded = Math.min(100, Math.round(pct));
  const total = last.total ?? 0;
  const chunks = last.chunks ?? 0;
  const cps = last.cps ?? last.rate ?? '—';

  updateOverviewProgressBar('overview-pregen-progress', pct, 'overview-pregen-pct-label');

  const pctVal = document.getElementById('overview-pregen-pct-val');
  if (pctVal) pctVal.innerHTML = `${Number(pct).toFixed(1)}<span class="wt-overview-storage__unit">%</span>`;

  const chunksVal = document.getElementById('overview-pregen-chunks-val');
  if (chunksVal) {
    chunksVal.innerHTML = total
      ? `${Number(chunks).toLocaleString()}<span class="wt-overview-pregen__stat-sub"> / ${Number(total).toLocaleString()}</span>`
      : Number(chunks).toLocaleString();
  }

  const rateVal = document.getElementById('overview-pregen-rate-val');
  if (rateVal) rateVal.innerHTML = `${cps}<span class="wt-overview-pregen__stat-unit">cps</span>`;
}

function animateOverviewProgressIntro(barId, targetPct, labelId, duration = 1000) {
  if (typeof TowerMotion !== 'undefined' && TowerMotion.animateProgressBar) {
    TowerMotion.animateProgressBar(barId, targetPct, labelId, duration);
    return;
  }
  const bar = document.getElementById(barId);
  if (!bar) return;
  updateOverviewProgressBar(barId, targetPct, labelId);
}

function syncOverviewVitalsBaseline() {
  if (!state.liveLatest) return;
  const heap = state.liveLatest.heap_mb || {};
  state.lastOverviewVitals = {
    tps: Number((state.liveLatest.tps ?? 20).toFixed(2)),
    cpu: Math.round(state.liveLatest.host_cpu_pct ?? 0),
    heapUsed: Math.round(heap.used ?? 0),
    players: state.liveLatest.players_online ?? 0,
  };
}

function setOverviewUptimeAnchor(baseSec) {
  if (baseSec == null || !Number.isFinite(baseSec)) {
    state.overviewUptimeAnchor = null;
    return;
  }
  const floored = Math.floor(baseSec);
  const anchor = state.overviewUptimeAnchor;
  if (anchor) {
    const localSec = anchor.baseSec + Math.floor((Date.now() - anchor.at) / 1000);
    if (floored >= anchor.baseSec && floored <= localSec + 2) {
      return;
    }
  }
  state.overviewUptimeAnchor = { baseSec: floored, at: Date.now() };
}

function getCurrentOverviewUptimeSec() {
  const anchor = state.overviewUptimeAnchor;
  if (!anchor) return null;
  return anchor.baseSec + Math.floor((Date.now() - anchor.at) / 1000);
}

function updateOverviewUptimeClock({ tickSec = false } = {}) {
  const el = document.getElementById('overview-uptime-val');
  if (!el || typeof TowerRenderOverview === 'undefined') return;
  const sec = getCurrentOverviewUptimeSec();
  TowerRenderOverview.syncOverviewUptimeClock(el, sec, { tickSec });
}

function stopOverviewUptimeTicker() {
  if (state.overviewUptimeTimer) {
    clearTimeout(state.overviewUptimeTimer);
    state.overviewUptimeTimer = null;
  }
}

function scheduleOverviewUptimeTick() {
  stopOverviewUptimeTicker();
  if (state.activeTab !== 'overview') return;
  const delay = Math.max(50, 1000 - (Date.now() % 1000));
  state.overviewUptimeTimer = setTimeout(() => {
    if (state.activeTab !== 'overview') return;
    updateOverviewUptimeClock({ tickSec: true });
    scheduleOverviewUptimeTick();
  }, delay);
}

function startOverviewUptimeTicker() {
  scheduleOverviewUptimeTick();
}

function resetOverviewIntroPlaceholders(heapMax) {
  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  setHtml('vital-tps-val', '0.00<span class="wt-kpi__unit">TPS</span>');
  setHtml('vital-cpu-val', '0<span class="wt-kpi__unit">%</span>');
  if (heapMax) {
    setHtml('vital-mem-used-val', '0<span class="wt-kpi__unit">MB</span>');
    setHtml('vital-mem-free-val', '0<span class="wt-kpi__unit">MB</span>');
  }
  setHtml('vital-session-val', '0');
  if (document.getElementById('overview-pregen-pct-val')) {
    setHtml('overview-pregen-pct-val', '0.0<span class="wt-overview-storage__unit">%</span>');
    setHtml('overview-pregen-chunks-val', '0');
    setHtml('overview-pregen-rate-val', '0<span class="wt-overview-pregen__stat-unit">cps</span>');
  }
  const diskBar = document.getElementById('overview-disk-progress');
  if (diskBar) {
    diskBar.style.setProperty('--progress', 0);
    const label = document.getElementById('overview-disk-pct-label');
    if (label) label.textContent = '0%';
  }
  const pregenBar = document.getElementById('overview-pregen-progress');
  if (pregenBar) {
    pregenBar.style.setProperty('--progress', 0);
    const label = document.getElementById('overview-pregen-pct-label');
    if (label) label.textContent = '0%';
  }
}

function runOverviewIntroAnimations() {
  if (state.activeTab !== 'overview' || state.overviewIntroPlayed) return;
  state.overviewIntroPlayed = true;

  const live = state.liveLatest || {};
  const heap = live.heap_mb || {};
  const sys = state.activeFacts?.system || {};
  const used = Math.round(heap.used ?? 0);
  const max = Math.round(heap.max ?? (sys.java_xmx_gb ?? 0) * 1024);
  const free = max ? Math.max(0, max - used) : 0;
  const duration = 1000;
  const chunkyJob = getActivePregenJobs(state.activeFacts).find((j) => j.kind === 'chunky');
  const chunky = chunkyJob?.data?.last;
  const uptimeSec = live.java_uptime_sec ?? sys.java_uptime_sec;
  if (uptimeSec != null) {
    setOverviewUptimeAnchor(uptimeSec);
    updateOverviewUptimeClock();
  }

  const start = () => {
    if (state.activeTab !== 'overview') return;

    if (typeof TowerMotion !== 'undefined') {
      TowerMotion.animateKpiHtml('vital-tps-val', live.tps ?? 20, { decimals: 2, unit: 'TPS', duration });
      TowerMotion.animateKpiHtml('vital-cpu-val', Math.round(live.host_cpu_pct ?? 0), { unit: '%', duration });
      if (max) {
        TowerMotion.animateKpiHtml('vital-mem-used-val', used, { unit: 'MB', duration });
        TowerMotion.animateKpiHtml('vital-mem-free-val', free, { unit: 'MB', duration });
      }
      TowerMotion.animateKpiHtml('vital-session-val', live.players_online ?? 0, { duration });

      if (chunky && document.getElementById('overview-pregen-progress')) {
        const pct = chunky.pct ?? 0;
        TowerMotion.animateKpiHtml('overview-pregen-pct-val', pct, {
          decimals: 1,
          unit: '%',
          unitClass: 'wt-overview-storage__unit',
          duration,
        });
        TowerMotion.animateChunksStat('overview-pregen-chunks-val', chunky.chunks ?? 0, chunky.total ?? 0, duration);
        const cps = Number(chunky.cps ?? chunky.rate);
        if (!Number.isNaN(cps)) {
          TowerMotion.animateKpiHtml('overview-pregen-rate-val', cps, {
            unit: 'cps',
            unitClass: 'wt-overview-pregen__stat-unit',
            duration,
          });
        }
      }
    } else {
      syncOverviewVitalsBaseline();
    }

    animateOverviewProgressIntro('overview-disk-progress', live.disk_use_pct ?? 0, 'overview-disk-pct-label', duration);
    if (chunky && document.getElementById('overview-pregen-progress')) {
      animateOverviewProgressIntro('overview-pregen-progress', chunky.pct ?? 0, 'overview-pregen-pct-label', duration);
    }

    syncOverviewVitalsBaseline();
  };

  if (typeof TowerMotion !== 'undefined' && TowerMotion.prefersReducedMotion()) {
    start();
    return;
  }
  resetOverviewIntroPlaceholders(max);
  state.overviewIntroPlaying = true;
  setTimeout(start, 450);
  setTimeout(() => { state.overviewIntroPlaying = false; }, 450 + duration + 80);
}

function bindOverviewMotion() {
  if (state.activeTab !== 'overview') {
    stopOverviewUptimeTicker();
    return;
  }
  bindOverviewServerIcon();
  const bento = document.querySelector('.wt-tab-overview .wt-bento.wt-stagger');
  if (bento && typeof TowerMotion !== 'undefined') {
    TowerMotion.staggerEnter(bento);
  }
  const tldr = document.querySelector('.wt-welcome__tldr');
  if (tldr && !tldr.dataset.motionBound) {
    tldr.dataset.motionBound = '1';
    const summary = tldr.querySelector('.wt-welcome__tldr-summary');
    if (summary) {
      summary.setAttribute('aria-expanded', tldr.open);
      tldr.addEventListener('toggle', () => {
        summary.setAttribute('aria-expanded', tldr.open);
      });
    }
  }
  runOverviewIntroAnimations();
  const live = state.liveLatest || {};
  const sys = state.activeFacts?.system || {};
  const uptimeSec = live.java_uptime_sec ?? sys.java_uptime_sec;
  if (uptimeSec != null) setOverviewUptimeAnchor(uptimeSec);
  updateOverviewUptimeClock();
  startOverviewUptimeTicker();
}

function resetLiveIntroPlaceholders(showRam, ramDual) {
  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  setHtml('live-tps-val', '0.00<span class="wt-kpi__unit">TPS</span>');
  setHtml('live-mspt-val', '0.0<span class="wt-kpi__unit">ms</span>');
  setHtml('live-heap-used-val', '0<span class="wt-kpi__unit">MB</span>');
  setHtml('live-heap-free-val', '0<span class="wt-kpi__unit">MB</span>');
  setHtml('live-players-val', '0<span class="wt-kpi__unit">online</span>');
  setHtml('live-cpu-val', '0<span class="wt-kpi__unit">%</span>');
  if (showRam) {
    setHtml('live-ram-val', ramDual
      ? `0.0 / 0.0<span class="wt-kpi__unit">GB</span>`
      : '0.0<span class="wt-kpi__unit">GB</span>');
  }
  const cpuDial = document.getElementById('thermal-cpu-dial');
  if (cpuDial) {
    cpuDial.dataset.temp = '0';
    const readout = document.getElementById('thermal-package-readout');
    if (readout) TowerRenderLive.setThermalReadout(readout, 0);
    const band = document.getElementById('thermal-package-band');
    if (band) {
      band.textContent = TowerRenderLive.thermalBandLabel('cool');
      band.className = TowerRenderLive.thermalBandElClass('cool');
    }
    const tile = document.getElementById('thermal-cpu-tile');
    if (tile) tile.className = 'wt-live-thermal__tile wt-live-thermal__tile--cool';
  }
  const ambDial = document.getElementById('thermal-ambient-dial');
  if (ambDial) {
    ambDial.dataset.temp = '0';
    const readout = document.getElementById('thermal-ambient-readout');
    if (readout) TowerRenderLive.setThermalReadout(readout, 0);
    const band = document.getElementById('thermal-ambient-band');
    if (band) {
      band.textContent = TowerRenderLive.thermalBandLabel('cool');
      band.className = TowerRenderLive.thermalBandElClass('cool');
    }
    const tile = document.getElementById('thermal-ambient-tile');
    if (tile) tile.className = 'wt-live-thermal__tile wt-live-thermal__tile--cool';
  }
  if (typeof Viz !== 'undefined') Viz.refreshTempDials();
}

function animateThermalDialIntro(canvasId, readoutId, bandId, target, bandFn, duration = 1000) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || target == null || typeof TowerMotion === 'undefined') return;
  const readout = document.getElementById(readoutId);
  const bandEl = document.getElementById(bandId);
  const to = Number(target);
  if (Number.isNaN(to)) return;

    const apply = (v) => {
    canvas.dataset.temp = String(v);
    if (readout) TowerRenderLive.setThermalReadout(readout, v);
    const band = bandFn(v);
    if (bandEl) {
      bandEl.textContent = TowerRenderLive.thermalBandLabel(band);
      bandEl.className = TowerRenderLive.thermalBandElClass(band);
    }
    const tile = document.getElementById(`thermal-${canvas.dataset.kind || 'cpu'}-tile`);
    if (tile) tile.className = `wt-live-thermal__tile wt-live-thermal__tile--${band}`;
    const wrap = canvas.closest('.wt-thermal-dial');
    if (wrap) wrap.className = `wt-thermal-dial${TowerRenderShared.thermalDialHotMod(band)}`;
    if (typeof Viz !== 'undefined') Viz.refreshTempDials();
  };

  if (TowerMotion.prefersReducedMotion()) {
    apply(to);
    return;
  }

  TowerMotion.animateValue({
    from: 0,
    to,
    duration,
    onUpdate: apply,
    onComplete: () => apply(to),
  });
}

function runLiveIntroAnimations() {
  if (state.activeTab !== 'live' || state.liveIntroPlayed) return;
  state.liveIntroPlayed = true;

  const live = state.liveLatest || {};
  const sys = state.activeFacts?.system || {};
  const heap = live.heap_mb || {};
  const env = getHostEnvironment(state.activeFacts);
  const memUsed = live.mem_used_gb ?? sys.mem_used_gb;
  const memTotal = live.mem_total_gb ?? sys.mem_total_gb;
  const memTrust = env?.metrics?.mem_used_gb;
  const memAvail = live.mem_available_gb ?? sys.mem_available_gb ?? 0;
  const ramDual = memUsed != null && memTotal != null && memTrust?.status !== 'unavailable';
  const showRam = Labels.liveRamAvailable(env);
  const duration = 1000;
  const thermal = state.liveEnvelope?.thermal ?? state.activeFacts?.optional?.thermal;

  const start = () => {
    if (state.activeTab !== 'live') return;

    if (typeof TowerMotion !== 'undefined') {
      TowerMotion.animateKpiHtml('live-tps-val', live.tps ?? 20, { decimals: 2, unit: 'TPS', duration });
      TowerMotion.animateKpiHtml('live-mspt-val', live.mspt ?? 0, { decimals: 1, unit: 'ms', duration });
      const heapMax = Math.round(heap.max ?? (sys.java_xmx_gb ?? 0) * 1024);
      const heapUsed = Math.round(heap.used ?? 0);
      const heapFree = heapMax ? Math.max(0, heapMax - heapUsed) : 0;
      TowerMotion.animateKpiHtml('live-heap-used-val', heapUsed, { unit: 'MB', duration });
      TowerMotion.animateKpiHtml('live-heap-free-val', heapFree, { unit: 'MB', duration });
      TowerMotion.animateKpiHtml('live-players-val', live.players_online ?? 0, { unit: 'online', duration });
      TowerMotion.animateKpiHtml('live-cpu-val', Math.round(live.host_cpu_pct ?? 0), { unit: '%', duration });
      if (showRam && document.getElementById('live-ram-val')) {
        if (ramDual) {
          TowerMotion.animateValue({
            from: 0,
            to: Number(memUsed),
            duration,
            onUpdate: (v) => {
              const el = document.getElementById('live-ram-val');
              if (el) {
                el.innerHTML = `${v.toFixed(1)} / ${Number(memTotal).toFixed(1)}<span class="wt-kpi__unit">GB</span>`;
              }
            },
          });
        } else {
          TowerMotion.animateKpiHtml('live-ram-val', memAvail, { decimals: 1, unit: 'GB', duration });
        }
      }
    }

    if (thermal?.available) {
      const pkg = thermal.package_c ?? 0;
      const ambient = TowerRenderLive.findAmbientC(thermal);
      animateThermalDialIntro('thermal-cpu-dial', 'thermal-package-readout', 'thermal-package-band', pkg, TowerRenderLive.thermalTempBand, duration);
      if (ambient != null) {
        animateThermalDialIntro('thermal-ambient-dial', 'thermal-ambient-readout', 'thermal-ambient-band', ambient, TowerRenderLive.ambientTempBand, duration);
      }
    }
  };

  if (typeof TowerMotion !== 'undefined' && TowerMotion.prefersReducedMotion()) {
    start();
    return;
  }
  resetLiveIntroPlaceholders(showRam, ramDual);
  state.liveIntroPlaying = true;
  setTimeout(start, 450);
  setTimeout(() => { state.liveIntroPlaying = false; }, 450 + duration + 80);
}

function resizeLiveCharts() {
  if (typeof SparklineManager === 'undefined') return;
  SparklineManager.resizeTab('live');
}

function bindLiveMotion() {
  if (state.activeTab !== 'live') return;
  const bento = document.querySelector('.wt-tab-live .wt-bento.wt-stagger');
  if (bento && typeof TowerMotion !== 'undefined') {
    TowerMotion.staggerEnter(bento);
  }
  runLiveIntroAnimations();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => resizeLiveCharts());
  });
  setTimeout(() => resizeLiveCharts(), 500);
  setTimeout(() => resizeLiveCharts(), 1600);
}

function updateWorldJobsOverview() {
  if (state.activeTab !== 'overview') return;
  const chunky = state.liveEnvelope?.chunky_pregen;
  if (document.querySelector('.wt-overview-pregen') && chunky?.last) {
    updateOverviewPregenLive(chunky);
    return;
  }
  const f = state.activeFacts;
  const jobs = getActivePregenJobs(f);
  const body = document.getElementById('world-jobs-overview-body');
  if (!body) return;
  state.pregenIdCounter = 0;
  body.innerHTML = jobs.length ? TowerRenderOverview.renderWorldJobs(jobs, false) : '<p class="wt-empty">No pregen jobs running</p>';
  Viz.refreshAll();
  if (window.lucide) lucide.createIcons();
}





function initPreCrashSparklines() {
  if (!window.SparklineManager?.updateFromApiSeries) return;
  document.querySelectorAll('[data-pre-crash-tps]').forEach((canvas) => {
    try {
      const points = JSON.parse(canvas.getAttribute('data-pre-crash-tps') || '[]');
      if (!points.length) return;
      const series = points.map((p) => ({ t: p.t, v: p.v }));
      const colors = SparklineManager.colors();
      SparklineManager.ensure(canvas.id, {
        color: colors.green,
        yMax: 22,
        yMin: 0,
        fill: true,
        unit: 'TPS',
        metricKey: 'tps',
        staticChart: true,
        windowMinutes: 10,
      });
      SparklineManager.updateFromApiSeries(canvas.id, series, {
        yMax: 22,
        color: colors.green,
        unit: 'TPS',
        windowMinutes: 10,
        metricKey: 'tps',
      });
    } catch {
      // skip malformed sparkline data
    }
  });
}




function bindClientModIgnoreEvents() {
  document.querySelectorAll('.client-mod-ignore-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const modId = btn.dataset.clientModIgnore;
      const ignored = btn.dataset.ignored !== 'true';
      const hostname = state.activeFacts?.meta?.hostname;
      await ClientModIgnores.postIgnore(hostname, modId, ignored, { apiMode: state.apiMode });
      if (state.activeTab === 'mods') {
        refreshModsPage();
      } else if (state.activeTab === 'overview' || state.activeTab === 'issues') {
        render();
      }
    });
  });
}

function findCrashSummaryInCache(bare) {
  const target = Acks.bareFile(bare);
  const active = state.activeFacts?.optional?.crash_summaries ?? [];
  const inActive = active.find((c) => Acks.bareFile(c.file) === target);
  if (inActive) return inActive;
  for (const cached of Object.values(state.reportCache || {})) {
    const list = cached?.facts?.optional?.crash_summaries ?? [];
    const match = list.find((c) => Acks.bareFile(c.file) === target);
    if (match) return match;
  }
  return null;
}

async function handleCrashUnreview(btn) {
  const file = btn.dataset.crashFile;
  if (!file) return;
  const bare = Acks.bareFile(file);
  const hostname = state.activeFacts?.meta?.hostname;
  await Acks.unack(hostname, file, { apiMode: state.apiMode });

  const inActive = (state.activeFacts?.optional?.crash_summaries ?? [])
    .some((c) => Acks.bareFile(c.file) === bare);

  if (!inActive) {
    const fromCache = findCrashSummaryInCache(bare);
    state.crashExtraRows = state.crashExtraRows || {};
    state.crashExtraRows[bare] = fromCache || {
      file: bare,
      plain_english: btn.dataset.crashPlain || bare,
      summary: 'Outside current report',
      category: btn.dataset.crashCategory || 'unknown',
      historical: true,
      orphan: true,
    };
  } else if (state.crashExtraRows) {
    delete state.crashExtraRows[bare];
  }

  state.crashFilter = 'all';
  state.crashScrollTo = bare;

  if (state.activeTab === 'overview' || state.activeTab === 'issues' || state.activeTab === 'crashes') {
    render();
  } else {
    navigateToTab('crashes');
  }
}

function scrollToCrashCard() {
  const bare = state.crashScrollTo;
  if (!bare || state.activeTab !== 'crashes') return;
  state.crashScrollTo = null;
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('.wt-crash-card[data-crash-file]');
    let card = null;
    cards.forEach((el) => {
      if (Acks.bareFile(el.dataset.crashFile) === bare) card = el;
    });
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('wt-crash-card--highlight');
    setTimeout(() => card.classList.remove('wt-crash-card--highlight'), 2600);
  });
}

function bindAckEvents() {
  document.querySelectorAll('.crash-ack').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const row = cb.closest('tr, .wt-queue__row, .crash-item, .wt-crash-card');
      const hostname = state.activeFacts?.meta?.hostname;
      const wasAcked = Acks.isAcked(getAcks(), cb.dataset.crashFile);
      await Acks.toggle(hostname, cb.dataset.crashFile, {
        apiMode: state.apiMode,
        category: cb.dataset.crashCategory,
        plainEnglish: cb.dataset.crashPlain,
      });
      const bare = Acks.bareFile(cb.dataset.crashFile);
      if (wasAcked) {
        state.crashFilter = 'all';
        state.crashScrollTo = bare;
      } else if (state.crashExtraRows) {
        delete state.crashExtraRows[bare];
      }
      if (row && typeof WatchtowerMotion !== 'undefined') WatchtowerMotion.ackRowFlash(row);
      if (state.activeTab === 'overview' || state.activeTab === 'issues' || state.activeTab === 'crashes') {
        render();
      }
    });
  });
  document.querySelectorAll('.crash-unack').forEach((btn) => {
    btn.addEventListener('click', () => handleCrashUnreview(btn));
  });
}

function crashReportBareFile(file) {
  if (!file) return '';
  return file.startsWith('crash-reports/') ? file.slice('crash-reports/'.length) : file;
}

async function loadCrashReportContent(file) {
  if (state.apiMode && typeof WatchtowerApi !== 'undefined' && WatchtowerApi.fetchCrashReport) {
    return WatchtowerApi.fetchCrashReport(file);
  }
  const bare = crashReportBareFile(file);
  const r = await fetch(`data/crash-reports/${encodeURIComponent(bare)}`);
  if (!r.ok) throw new Error('Report not found in static preview');
  const content = await r.text();
  return { file: bare, content, truncated: false, size: content.length };
}

function crashReportDownloadName(file, displayName) {
  const base = displayName || crashReportBareFile(file) || 'crash-report.txt';
  return base.endsWith('.txt') ? base : `${base}.txt`;
}

function triggerCrashReportDownload(content, filename) {
  const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadCrashReport(file, displayName, btn) {
  if (!file) return;
  const prevLabel = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Downloading…';
  }
  try {
    let content;
    let fname = crashReportDownloadName(file, displayName);
    if (state.crashLogModalFile === file && state.crashLogModalContent) {
      content = state.crashLogModalContent;
    } else {
      const data = await loadCrashReportContent(file);
      content = data.content || '';
      fname = crashReportDownloadName(data.file || file, displayName);
    }
    if (!content) throw new Error('Crash report is empty');
    triggerCrashReportDownload(content, fname);
  } catch (e) {
    if (typeof WatchtowerToast !== 'undefined') {
      WatchtowerToast.show({ message: e.message || 'Download failed', kind: 'error' });
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevLabel || 'Download';
    }
  }
}

async function openCrashLogModal(file, displayName) {
  const viewer = document.getElementById('crash-log-modal-viewer');
  const meta = document.getElementById('crash-log-modal-meta');
  const title = document.getElementById('crash-log-modal-title');
  const bare = crashReportBareFile(file);
  state.crashLogModalFile = file || '';
  state.crashLogModalContent = '';
  if (title) title.textContent = displayName || bare || 'Crash report';
  if (meta) meta.textContent = '';
  if (viewer) viewer.textContent = 'Loading…';
  openModal('crash-log-modal');
  refreshChromeIcons();
  try {
    const data = await loadCrashReportContent(file);
    if (viewer) viewer.textContent = data.content || '';
    const parts = [data.file];
    if (data.size) parts.push(`${Number(data.size).toLocaleString()} bytes`);
    if (data.truncated) parts.push('truncated to 512 KB');
    if (meta) meta.textContent = parts.join(' · ');
    state.crashLogModalContent = data.content || '';
  } catch (e) {
    if (viewer) viewer.textContent = e.message || 'Could not load crash report.';
    state.crashLogModalContent = '';
  }
}

function closeCrashLogModal() {
  closeModal('crash-log-modal');
  state.crashLogModalContent = '';
  state.crashLogModalFile = '';
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLagIncidentInvestigation(incident) {
  if (!incident) return '<p class="wt-empty">Investigation snapshot not available.</p>';
  const ctx = incident.context || {};
  const metrics = [
    incident.mspt != null ? `MSPT ${Math.round(incident.mspt)}ms` : null,
    incident.tps != null ? `TPS ${Number(incident.tps).toFixed(1)}` : null,
    incident.players_online != null ? `${incident.players_online} players` : null,
    incident.entities != null ? `${incident.entities} entities` : null,
    incident.chunks != null ? `${incident.chunks} chunks` : null,
    incident.heap_used_gb != null && incident.heap_max_gb != null
      ? `Heap ${incident.heap_used_gb}/${incident.heap_max_gb} GB` : null,
    ctx.host_cpu_pct != null ? `Host CPU ${Math.round(ctx.host_cpu_pct)}%` : null,
  ].filter(Boolean).join(' · ');

  const players = (incident.players || []).map((p) => {
    if (typeof p === 'string') return p;
    const parts = [p.name, p.dimension, p.ping != null ? `${p.ping}ms ping` : null].filter(Boolean);
    return parts.join(' · ');
  });

  const findings = incident.findings?.length
    ? incident.findings
    : (ctx.recent_commands?.length || ctx.background_jobs?.length
      ? [{ kind: 'confirmed', text: incident.narrative || 'Automated checks completed at spike time.' }]
      : [{ kind: 'manual', text: 'Limited context saved — run a full report for deeper analysis.' }]);

  const confirmed = findings.filter((f) => f.kind !== 'manual');
  const manual = findings.filter((f) => f.kind === 'manual');

  const cmds = (ctx.recent_commands || []).map((c) => {
    const who = c.player ? `${c.player}: ` : '';
    return `<li><code>${escHtml(who + (c.command || ''))}</code></li>`;
  }).join('');

  const jobs = (ctx.background_jobs || []).map((j) =>
    `<li>${escHtml((j.type || 'job') + ' — ' + (j.detail || ''))}</li>`).join('');

  const logTail = (ctx.log_tail || []).slice(-8).map((line) =>
    `<div class="wt-lag-log-line">${escHtml(line)}</div>`).join('');

  return `
    <p class="text-caption wt-lag-incident-modal__lead">Captured automatically when the spike was detected — not a live re-scan.</p>
    ${incident.narrative ? `<p class="wt-lag-suspect">${escHtml(incident.narrative)}</p>` : ''}
    ${metrics ? `<p class="wt-lag-incident-modal__metrics"><strong>Metrics:</strong> ${escHtml(metrics)}</p>` : ''}
    ${players.length ? `<div class="issue-section"><span class="issue-section-label">Players online</span><ul class="fix-list">${players.map((p) => `<li>${escHtml(p)}</li>`).join('')}</ul></div>` : ''}
    ${confirmed.length ? `<div class="issue-section"><span class="issue-section-label">Checked at spike time</span><ul class="wt-lag-findings">${confirmed.map((f) => `<li class="wt-lag-finding wt-lag-finding--confirmed"><i data-lucide="circle-check" width="14" height="14"></i><span>${escHtml(f.text)}</span></li>`).join('')}</ul></div>` : ''}
    ${manual.length ? `<div class="issue-section"><span class="issue-section-label">Still needs a deeper look</span><ul class="wt-lag-findings wt-lag-findings--manual">${manual.map((f) => `<li class="wt-lag-finding wt-lag-finding--manual"><i data-lucide="search" width="14" height="14"></i><span>${escHtml(f.text)}</span></li>`).join('')}</ul></div>` : ''}
    ${cmds ? `<div class="issue-section"><span class="issue-section-label">Recent commands (log tail)</span><ul class="fix-list">${cmds}</ul></div>` : ''}
    ${jobs ? `<div class="issue-section"><span class="issue-section-label">Background jobs</span><ul class="fix-list">${jobs}</ul></div>` : ''}
    ${logTail ? `<div class="issue-section"><span class="issue-section-label">Log excerpt</span><div class="wt-lag-log-tail">${logTail}</div></div>` : ''}
    ${incident.note ? `<div class="issue-section"><span class="issue-section-label">Operator note</span><p>${escHtml(incident.note)}</p></div>` : ''}`;
}

async function openLagIncidentModal(incidentId) {
  const body = document.getElementById('lag-incident-modal-body');
  const title = document.getElementById('lag-incident-modal-title');
  if (!body || !incidentId) return;
  title.textContent = 'Lag spike investigation';
  body.innerHTML = '<p class="text-caption">Loading investigation…</p>';
  openModal('lag-incident-modal');
  try {
    let incident;
    if (state.apiMode && typeof WatchtowerApi !== 'undefined' && WatchtowerApi.fetchIncident) {
      const data = await WatchtowerApi.fetchIncident(incidentId);
      incident = data.incident || data;
    } else {
      const r = await fetch(`data/incidents/${encodeURIComponent(incidentId)}.json`);
      if (!r.ok) throw new Error('Snapshot not found in preview fixtures');
      incident = await r.json();
    }
    if (incident.findings == null && typeof TowerRenderIssues !== 'undefined') {
      /* peek entry may already include findings from ops cache */
      const peek = activeLagIssuesFromState?.() || [];
      const entry = peek.find((e) => e.incident_id === incidentId);
      if (entry?.findings) incident.findings = entry.findings;
    }
    title.textContent = incident.title || `Lag spike · ${incidentId}`;
    body.innerHTML = renderLagIncidentInvestigation(incident);
    refreshChromeIcons();
  } catch (e) {
    body.innerHTML = `<p class="wt-empty">${escHtml(e.message || 'Could not load investigation snapshot.')}</p>`;
  }
}

function activeLagIssuesFromState() {
  const peek = state.lagIssuesPeek?.lag_issues;
  const cache = state.opsCache?.lag_issues?.entries;
  const entries = Array.isArray(peek) ? peek : (Array.isArray(cache) ? cache : []);
  return entries.filter((e) => e && !e.resolved);
}

function closeLagIncidentModal() {
  closeModal('lag-incident-modal');
}

function bindLagIncidentModal() {
  document.getElementById('lag-incident-modal-close')?.addEventListener('click', closeLagIncidentModal);
  document.getElementById('lag-incident-modal-done')?.addEventListener('click', closeLagIncidentModal);
  document.getElementById('lag-incident-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'lag-incident-modal') closeLagIncidentModal();
  });
}

function bindLagIncidentEvents() {
  document.querySelectorAll('.view-lag-incident').forEach((btn) => {
    if (btn.dataset.lagBound) return;
    btn.dataset.lagBound = '1';
    btn.addEventListener('click', () => {
      openLagIncidentModal(btn.dataset.incidentId);
    });
  });
}

function bindCrashLogModal() {
  document.getElementById('crash-log-modal-close')?.addEventListener('click', closeCrashLogModal);
  document.getElementById('crash-log-modal-done')?.addEventListener('click', closeCrashLogModal);
  document.getElementById('crash-log-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'crash-log-modal') closeCrashLogModal();
  });
  document.getElementById('crash-log-modal-copy')?.addEventListener('click', async () => {
    const text = state.crashLogModalContent || document.getElementById('crash-log-modal-viewer')?.textContent || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('crash-log-modal-copy');
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = prev; }, 1500);
    } catch {
      // clipboard unavailable
    }
  });
  document.getElementById('crash-log-modal-download')?.addEventListener('click', () => {
    downloadCrashReport(state.crashLogModalFile, crashReportBareFile(state.crashLogModalFile), document.getElementById('crash-log-modal-download'));
  });
}

function bindModEvents() {
  document.getElementById('mods-scan-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('mods-scan-btn');
    if (btn) btn.disabled = true;
    await scanMods(true);
    render();
  });
}

function bindCrashEvents() {
  document.getElementById('crash-scan-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('crash-scan-btn');
    if (btn) btn.disabled = true;
    await scanCrashes(true);
    render();
  });
  document.querySelectorAll('[data-crash-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.crashFilter = btn.dataset.crashFilter;
      render();
    });
  });
  document.querySelectorAll('.copy-hint').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy || '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = prev; }, 1500);
      } catch {
        // clipboard unavailable
      }
    });
  });
  document.querySelectorAll('.view-crash-log').forEach((btn) => {
    btn.addEventListener('click', () => {
      openCrashLogModal(btn.dataset.crashFile, btn.dataset.crashName);
    });
  });
  document.querySelectorAll('.download-crash-log').forEach((btn) => {
    btn.addEventListener('click', () => {
      downloadCrashReport(btn.dataset.crashFile, btn.dataset.crashName, btn);
    });
  });
}

function bindTabLinks() {
  document.querySelectorAll('.tab-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      const insightsView = link.dataset.insightsView;
      if (insightsView) {
        state.insightsView = insightsView;
      }
      if (tab === 'performance' && state.activeTab === 'performance' && typeof TowerRenderPerformance?.refreshInsightsPage === 'function') {
        TowerRenderPerformance.refreshInsightsPage();
        return;
      }
      if (tab) navigateToTab(tab);
    });
  });
}

function resetMainScroll() {
  const area = document.getElementById('main-scroll-area');
  if (!area) return;
  const prevBehavior = area.style.scrollBehavior;
  area.style.scrollBehavior = 'auto';
  area.scrollTop = 0;
  area.style.scrollBehavior = prevBehavior || '';
}

async function navigateToTab(tab, options = {}) {
  if (!state.bootReady) return;
  if (options.insightsView) {
    state.insightsView = options.insightsView;
  }
  if (tab === 'docs') {
    state.wikiPageSlug = typeof TowerRouting !== 'undefined'
      ? TowerRouting.resolveWikiSlug(options)
      : (options.wikiSlug || WatchtowerWiki?.parseHash?.() || state.wikiPageSlug || 'Home');
  } else if (options.wikiSlug) {
    state.wikiPageSlug = options.wikiSlug;
  }
  state.canvasView = null;
  const main = document.getElementById('main-content');
  const prev = state.activeTab;
  if (tab === 'activity') {
    await loadActivityEvents();
    await fetchLagIssuesPeek();
  }
  if (tab === 'issues') await fetchLagIssuesPeek();
  if (tab === 'mods') {
    await fetchOpsCache();
    await fetchLagIssuesPeek();
  }
  if (tab === 'session') await loadPlayerRoster();
  if (tab === 'performance') {
    const w = state.performanceWindow || '7d';
    await fetchPerformanceDashboard(w);
    if (state.insightsView === 'mod-changes' || state.insightsView === 'storage') {
      await fetchOpsCache();
    }
  }
  document.querySelectorAll('.wt-rail__link[data-tab]').forEach((t) => {
    t.classList.toggle('is-active', t.dataset.tab === tab);
    t.setAttribute('aria-selected', t.dataset.tab === tab ? 'true' : 'false');
  });
  updateTabBadges();
  const wasChartTab = prev === 'overview' || prev === 'live';
  const isChartTab = tab === 'overview' || tab === 'live';
  if (wasChartTab && !isChartTab) {
    SparklineManager.destroyAll();
    destroyCharts();
  } else if (wasChartTab && isChartTab && prev !== tab) {
    SparklineManager.destroyExcept(SparklineManager.chartIdsForTab(tab));
  }
  state.activeTab = tab;
  render();
  if (prev !== tab) resetMainScroll();
  if (typeof WatchtowerMotion !== 'undefined') WatchtowerMotion.tabEnter(main);
  if (!options.skipUrlSync && typeof TowerRouting !== 'undefined') {
    TowerRouting.syncFromAppState({ push: options.pushUrl === true });
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY)
    || localStorage.getItem(LEGACY_THEME_KEY)
    || 'dark';
  setTheme(saved);
  document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);
  document.getElementById('cmdbar-theme-toggle')?.addEventListener('click', cycleTheme);
}

function cycleTheme() {
  const cur = document.documentElement.dataset.theme || 'dark';
  const idx = THEMES.indexOf(cur);
  setTheme(THEMES[(idx + 1) % THEMES.length]);
}

function setTheme(name) {
  document.documentElement.dataset.theme = name;
  localStorage.setItem(THEME_KEY, name);
  const icon = document.getElementById('theme-icon');
  const cmdIcon = document.getElementById('cmdbar-theme-icon');
  if (window.lucide) {
    const icons = { black: 'circle-dot', dark: 'moon', light: 'sun' };
    const lucideName = icons[name] || 'moon';
    if (icon) icon.setAttribute('data-lucide', lucideName);
    if (cmdIcon) cmdIcon.setAttribute('data-lucide', lucideName);
  }
  refreshChromeIcons();
  refreshChartsTheme();
  Viz.refreshAll();
  afterRender();
}

function chartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue('--text-muted').trim(),
    grid: style.getPropertyValue('--chart-grid').trim(),
    accent: style.getPropertyValue('--status-blue').trim(),
    warning: style.getPropertyValue('--status-yellow').trim(),
  };
}

function refreshChartsTheme() {
  if (state.activeTab === 'overview' || state.activeTab === 'live') {
    SparklineManager.destroyAll();
    initSparklinesForTab(state.activeTab);
  }
}

function destroyCharts() {
  SparklineManager.destroyAll();
  Object.values(state.charts).forEach((c) => c.destroy());
  state.charts = {};
}

function initTabs() {
  if (typeof TowerNav !== 'undefined') {
    TowerNav.init((tab) => {
      if (tab === 'performance') state.insightsView = 'patterns';
      navigateToTab(tab);
    });
  } else {
    document.querySelectorAll('.wt-rail__link[data-tab]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToTab(tab.dataset.tab);
      });
    });
  }
  updateTabNavState();
}

function initReportSelect() {
  const sel = document.getElementById('report-select');
  if (!sel) return;
  sel.addEventListener('change', async () => {
    await loadReport(sel.value);
    await mergeServerAcks();
    await mergeServerClientModIgnores();
    renderNav();
    render();
  });
}


function initWelcome() {
  /* legacy welcome — replaced by WatchtowerSetupWizard */
}

async function runWelcomeFirstReport() {
  if (typeof WatchtowerSetupWizard !== 'undefined') {
    WatchtowerSetupWizard.open({ force: true, step: 'audit' });
  }
}

function initNavButtons() {
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    if (typeof TowerViews !== 'undefined') TowerViews.openSettings('settings');
    else if (typeof WatchtowerSettings !== 'undefined') WatchtowerSettings.open('settings');
  });
  document.getElementById('help-btn')?.addEventListener('click', () => {
    if (typeof TowerViews !== 'undefined') TowerViews.openHelp('guide');
    else if (typeof WatchtowerHelp !== 'undefined') WatchtowerHelp.open('guide');
  });

  if (typeof TowerSidebar !== 'undefined') TowerSidebar.init();

  document.addEventListener('keydown', (e) => {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    if (typeof WatchtowerHelp !== 'undefined') WatchtowerHelp.open('guide');
  });
}

function closeRunModal() {
  closeModal('run-modal');
}

function openRunModal() {
  openModal('run-modal');
  document.getElementById('run-steps')?.classList.add('hidden');
  document.getElementById('run-confirm-btn')?.classList.remove('hidden');
  refreshChromeIcons();
}

function initRunReport() {
  document.getElementById('run-report-btn')?.addEventListener('click', openRunModal);
  document.getElementById('run-confirm-btn')?.addEventListener('click', () => runHealthReportFromUI());
  document.getElementById('run-modal-close')?.addEventListener('click', closeRunModal);
  document.getElementById('run-cancel-btn')?.addEventListener('click', closeRunModal);
  document.getElementById('run-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'run-modal') closeRunModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('run-modal');
    if (modal?.classList.contains('is-open')) closeRunModal();
  });
  document.getElementById('report-loading-dismiss')?.addEventListener('click', () => {
    closeModal('report-loading');
  });
  const saved = JSON.parse(
    localStorage.getItem(RUN_CONFIG_KEY)
    || localStorage.getItem(LEGACY_RUN_CONFIG_KEY)
    || '{}',
  );
  if (saved.lookback) document.getElementById('lookback-preset').value = saved.lookback;
  if (saved.incremental != null) document.getElementById('incremental-run').checked = saved.incremental;
}

async function runHealthReportFromUI(opts = {}) {
  const lookbackEl = document.getElementById('lookback-preset');
  const sinceEl = document.getElementById('since-custom');
  const incrementalEl = document.getElementById('incremental-run');
  const lookback = opts.lookbackHours != null ? String(opts.lookbackHours) : lookbackEl?.value;
  const since = opts.since !== undefined ? opts.since : (sinceEl?.value || '');
  const incremental = opts.incremental != null ? opts.incremental : incrementalEl?.checked;
  if (lookbackEl && opts.lookbackHours != null) lookbackEl.value = String(opts.lookbackHours);
  if (incrementalEl && opts.incremental != null) incrementalEl.checked = opts.incremental;
  localStorage.setItem(RUN_CONFIG_KEY, JSON.stringify({ lookback, incremental }));

  if (state.apiMode) {
    const payload = {
      lookbackHours: since ? null : Number(lookback),
      since: since || null,
      incremental,
    };
    const runBtn = document.getElementById('run-report-btn');
    const confirmBtn = document.getElementById('run-confirm-btn');
    if (typeof TowerMotion !== 'undefined') {
      TowerMotion.btnLoading(runBtn, true);
      TowerMotion.btnLoading(confirmBtn, true);
    } else {
      runBtn?.classList.add('is-loading');
      confirmBtn?.classList.add('is-loading');
    }
    closeModal('run-modal');
    const overlay = document.getElementById('report-loading');
    const msg = document.getElementById('report-loading-msg');
    const steps = document.getElementById('report-loading-steps');
    const dismiss = document.getElementById('report-loading-dismiss');
    openModal('report-loading');
    dismiss?.classList.add('hidden');
    steps?.querySelectorAll('li').forEach((s) => { s.className = ''; });
    if (msg) msg.textContent = 'Starting report…';
    try {
      await WatchtowerApi.runReport(payload);
      let stepIdx = 0;
      const items = steps?.querySelectorAll('li') || [];
      const stepTimer = setInterval(() => {
        if (stepIdx < items.length) {
          items.forEach((s, i) => {
            s.classList.toggle('active', i === stepIdx);
            s.classList.toggle('done', i < stepIdx);
          });
          stepIdx += 1;
        }
      }, 3000);
      for (;;) {
        await sleep(2000);
        const status = await WatchtowerApi.fetchReportStatus();
        if (status.running) {
          if (msg) msg.textContent = status.message || 'Report in progress…';
          continue;
        }
        clearInterval(stepTimer);
        items.forEach((s) => { s.classList.remove('active'); s.classList.add('done'); });
        if (status.success) {
          await loadDataFromApi();
          state.selectedReportId = 'latest';
          localStorage.setItem(SELECTED_REPORT_KEY, 'latest');
          populateReportSelect();
          await fetchOverviewMeta();
          renderNav();
          render();
          if (msg) msg.textContent = 'Report complete — dashboard updated.';
          showToast('Report complete', 'success');
          setTimeout(() => closeModal('report-loading'), 1200);
          return true;
        }
        if (msg) msg.textContent = status.message || 'Report failed';
        dismiss?.classList.remove('hidden');
        return false;
      }
    } catch (e) {
      if (msg) msg.textContent = `Run failed: ${e.message}`;
      dismiss?.classList.remove('hidden');
      return false;
    } finally {
      if (typeof TowerMotion !== 'undefined') {
        TowerMotion.btnLoading(runBtn, false);
        TowerMotion.btnLoading(confirmBtn, false);
      } else {
        runBtn?.classList.remove('is-loading');
        confirmBtn?.classList.remove('is-loading');
      }
    }
  }

  document.getElementById('run-confirm-btn')?.classList.add('hidden');
  const steps = document.getElementById('run-steps');
  steps?.classList.remove('hidden');
  const items = steps?.querySelectorAll('li') || [];
  items.forEach((s) => { s.className = ''; });

  for (let i = 0; i < items.length; i++) {
    items[i].classList.add('active');
    await sleep(700);
    items[i].classList.remove('active');
    items[i].classList.add('done');
  }
  await sleep(300);
  closeModal('run-modal');
  showToast('Mock report complete', 'success');
  return true;
}

/** @deprecated use runHealthReportFromUI */
async function mockRunReport() {
  return runHealthReportFromUI();
}

function showToast(msg, kind = 'info') {
  if (typeof WatchtowerToast !== 'undefined') {
    WatchtowerToast.show({ message: msg, kind });
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }



function bindOnboardingEvents() {
  if (typeof WatchtowerSetupWizard !== 'undefined') {
    WatchtowerSetupWizard.bindResumeCard();
  }
  document.getElementById('overview-run-report-btn')?.addEventListener('click', openRunModal);
}





function rebindSessionRowActions() {
  document.querySelectorAll('.session-copy-uuid').forEach((btn) => {
    if (btn.dataset.uuidBound) return;
    btn.dataset.uuidBound = '1';
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid || '';
      if (!uuid) return;
      try {
        await navigator.clipboard.writeText(uuid);
        if (typeof TowerMotion !== 'undefined') TowerMotion.valueFlash(btn, 'ok');
        if (typeof showToast === 'function') showToast('UUID copied', 'success');
      } catch {
        if (typeof showToast === 'function') showToast('Copy failed', 'error');
      }
    });
  });
  bindSessionActivityLinks();
}

function bindSessionEvents() {
  if (!document.querySelector('.wt-tab-session')) return;
  document.querySelectorAll('[data-session-filter]').forEach((btn) => {
    if (btn.dataset.sessionFilterBound) return;
    btn.dataset.sessionFilterBound = '1';
    btn.addEventListener('click', () => {
      const filter = btn.dataset.sessionFilter;
      state.sessionFilter = filter;
      document.querySelectorAll('.wt-tab-session [data-session-filter]').forEach((b) => {
        b.classList.toggle('active', b.dataset.sessionFilter === filter);
      });
      TowerRenderSession.refreshRosterDom();
    });
  });
  const search = document.getElementById('session-search');
  if (search && !search.dataset.bound) {
    search.dataset.bound = '1';
    search.value = state.sessionSearch || '';
    search.oninput = () => {
      state.sessionSearch = search.value.trim();
      TowerRenderSession.refreshRosterDom();
    };
  }
  const sortSel = document.getElementById('session-sort');
  if (sortSel && !sortSel.dataset.bound) {
    sortSel.dataset.bound = '1';
    sortSel.value = state.sessionSort || 'name';
    sortSel.onchange = () => {
      state.sessionSort = sortSel.value;
      TowerRenderSession.refreshRosterDom();
    };
  }
  rebindSessionRowActions();
  if (typeof SparklineManager !== 'undefined' && document.getElementById('session-players-spark')) {
    const colors = SparklineManager.colors();
    const windowMinutes = chartWindowMinutes();
    SparklineManager.ensure('session-players-spark', { color: colors.accent, yMin: 0, yGrace: '8%', unit: 'online', windowMinutes });
    const raw = state.liveSamplesRaw;
    if (raw?.players) {
      SparklineManager.updateFromApiSeries('session-players-spark', raw.players, { color: colors.accent, unit: 'online', windowMinutes });
    }
  }
  SparklineManager.bindVitalsSelect?.(() => {
    if (typeof pollSamples === 'function') pollSamples(true);
  });
}

function bindSessionActivityLinks() {
  document.querySelectorAll('.session-activity-link').forEach((link) => {
    if (link.dataset.sessionActivityBound) return;
    link.dataset.sessionActivityBound = '1';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      state.activitySearch = link.dataset.player || '';
      navigateToTab('activity');
    });
  });
}

function memChartMax(raw, latest) {
  const series = raw?.mem_used_gb;
  const fromSeries = Array.isArray(series) && series.length ? series[series.length - 1]?.v : null;
  const total = latest?.mem_total_gb ?? fromSeries;
  if (total != null && Number.isFinite(Number(total))) return Math.max(4, Math.ceil(Number(total) * 1.15));
  return 64;
}

function initSparklinesForTab(tab, pulseReadout = false) {
  if (typeof SparklineManager === 'undefined') return;
  const raw = state.liveSamplesRaw;
  const colors = SparklineManager.colors();
  const windowMinutes = chartWindowMinutes();
  if (tab === 'overview') {
    return;
  }
  if (tab === 'live') {
    const heapMax = heapChartMax();
    const playersMax = playersChartMax(raw);
    if (SparklineManager.meta?.['lv-heap']?.dual) {
      SparklineManager.destroy('lv-heap');
    }
    const singleSpecs = [
      ['lv-tps', 'tps', colors.green, 20, 'TPS', 'tps'],
      ['lv-mspt', 'mspt', colors.accent, 50, 'ms', 'mspt'],
      ['lv-heap', 'heap_mb', colors.yellow, heapMax, 'MB used', 'heap_mb'],
      ['lv-players', 'players', colors.accent, playersMax, 'online', null],
      ['lv-cpu', 'host_cpu', colors.yellow, 100, '%', 'cpu'],
      ['lv-mem', 'mem_used_gb', colors.accent, memChartMax(raw, state.liveLatest), 'GB used', 'mem_used_gb'],
    ];
    singleSpecs.forEach(([id, key, color, yMax, unit, metricKey]) => {
      if (id === 'lv-mem' && !Labels.liveRamAvailable(getHostEnvironment(state.activeFacts))) return;
      SparklineManager.ensure(id, { color, yMax, yMin: 0, unit, metricKey, windowMinutes });
      if (raw) SparklineManager.updateFromApiSeries(id, raw[key], { yMax, color, unit, metricKey, windowMinutes, pulseReadout });
      else SparklineManager.setLoading(id, true);
    });
    initBandwidthChart(pulseReadout, windowMinutes);
    initDiskIoChart(pulseReadout, windowMinutes);
  }
}

function initDiskIoChart(pulseReadout = false, windowMinutes = chartWindowMinutes()) {
  const points = TowerRenderLive.diskIoChartPoints();
  if (!points.length) return;
  const colors = SparklineManager.colors();
  SparklineManager.ensureDual('lv-disk-io', {
    rxColor: colors.green,
    txColor: colors.accent,
    yGrace: '8%',
    rxUnit: 'MB/s',
    txUnit: 'MB/s',
    rxLabel: 'Read',
    txLabel: 'Write',
    windowMinutes,
  });
  SparklineManager.updateDual('lv-disk-io', points, { yGrace: '8%', pulseReadout, windowMinutes });
}

function initBandwidthChart(pulseReadout = false, windowMinutes = chartWindowMinutes()) {
  const points = TowerRenderLive.bandwidthChartPoints();
  if (!points.length) return;
  const colors = SparklineManager.colors();
  SparklineManager.ensureDual('lv-bandwidth', {
    rxColor: colors.green,
    txColor: colors.accent,
    yGrace: '8%',
    rxUnit: 'Mbps',
    txUnit: 'Mbps',
    rxLabel: 'Download',
    txLabel: 'Upload',
    windowMinutes,
  });
  SparklineManager.updateDual('lv-bandwidth', points, { yGrace: '8%', pulseReadout, windowMinutes });
}

function refreshSparklinesFromSamples(pulseReadout = false) {
  initSparklinesForTab(state.activeTab, pulseReadout);
  if (state.activeTab === 'live') {
    requestAnimationFrame(() => resizeLiveCharts());
  }
}


function updateLiveStatusLine(live) {
  const status = document.getElementById('live-status-line');
  if (!status) return;
  if (state.livePollError) {
    status.textContent = state.livePollError;
    status.classList.add('live-status-error');
    return;
  }
  status.classList.remove('live-status-error');
  if (!live) return;
  const rec = live.sample_interval_sec ?? 1;
  const ret = live.retention_hours ?? 24;
  const refresh = getLiveRefreshMs();
  const storageAge = live.latest?.storage_age_sec;
  status.textContent = `Recording every ${rec}s · Retention ${ret}h · Display ${refresh >= 1000 ? refresh / 1000 + 's' : 'paused'}`
    + (storageAge != null ? ` · Storage cache ${storageAge}s old` : '');
}

function updateLiveValues(latest) {
  if (!latest) return;
  const heap = latest.heap_mb || {};
  const heapUsed = Math.round(heap.used ?? 0);
  const sys = state.activeFacts?.system || {};
  const heapMax = Math.round(heap.max ?? (sys.java_xmx_gb ?? 0) * 1024);

  const setVal = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  if (state.activeTab === 'overview') {
    const heap = latest.heap_mb || {};
    const sys = state.activeFacts?.system || {};
    const used = Math.round(heap.used ?? 0);
    const max = Math.round(heap.max ?? (sys.java_xmx_gb ?? 0) * 1024);
    const free = max ? Math.max(0, max - used) : null;
    const vitals = {
      tps: Number((latest.tps ?? 20).toFixed(2)),
      cpu: Math.round(latest.host_cpu_pct ?? 0),
      heapUsed: used,
      players: latest.players_online ?? 0,
    };

    if (!state.overviewIntroPlaying) {
      setVal('vital-tps-val', `${vitals.tps.toFixed(2)}<span class="wt-kpi__unit">TPS</span>`);

      const msptSub = document.getElementById('vital-mspt-sub');
      if (msptSub) msptSub.textContent = `${Number(latest.mspt ?? 0).toFixed(1)} ms`;

      setVal('vital-cpu-val', `${vitals.cpu}<span class="wt-kpi__unit">%</span>`);

      if (max) {
        setVal('vital-mem-used-val', `${used}<span class="wt-kpi__unit">MB</span>`);
        setVal('vital-mem-free-val', `${free}<span class="wt-kpi__unit">MB</span>`);
        const memSub = document.getElementById('vital-mem-sub');
        if (memSub) memSub.textContent = `${max.toLocaleString()} MB max`;
      }

      setVal('vital-session-val', `${vitals.players}`);

      const uptimeSec = latest.java_uptime_sec ?? sys.java_uptime_sec;
      if (uptimeSec != null) setOverviewUptimeAnchor(uptimeSec);
    }

    if (state.activeTab === 'overview') {
      updateOverviewUptimeClock();
    }

    state.lastOverviewVitals = vitals;
    if (!state.overviewIntroPlaying) {
      updateOverviewProgressBar('overview-disk-progress', latest.disk_use_pct ?? 0, 'overview-disk-pct-label');
    }
  }

  if (state.activeTab === 'live') {
    if (!state.liveIntroPlaying) {
      setVal('live-tps-val', `${Number(latest.tps ?? 20).toFixed(2)}<span class="wt-kpi__unit">TPS</span>`);
      setVal('live-mspt-val', `${Number(latest.mspt ?? 0).toFixed(1)}<span class="wt-kpi__unit">ms</span>`);
      setVal('live-heap-used-val', `${heapUsed}<span class="wt-kpi__unit">MB</span>`);
      if (heapMax) {
        setVal('live-heap-free-val', `${Math.max(0, heapMax - heapUsed)}<span class="wt-kpi__unit">MB</span>`);
        const heapSub = document.getElementById('live-heap-sub');
        if (heapSub) heapSub.textContent = `${heapMax.toLocaleString()} MB max`;
      }
      setVal('live-players-val', `${latest.players_online ?? 0}<span class="wt-kpi__unit">online</span>`);
      setVal('live-cpu-val', `${Math.round(latest.host_cpu_pct ?? 0)}<span class="wt-kpi__unit">%</span>`);
      const env = getHostEnvironment(state.activeFacts);
      const memUsed = latest.mem_used_gb;
      const memTotal = latest.mem_total_gb;
      const memTrust = env?.metrics?.mem_used_gb;
      if (memUsed != null && memTotal != null && memTrust?.status !== 'unavailable') {
        setVal('live-ram-val', `${Number(memUsed).toFixed(1)} / ${Number(memTotal).toFixed(1)}<span class="wt-kpi__unit">GB</span>`);
      } else {
        setVal('live-ram-val', `${Number(latest.mem_available_gb ?? 0).toFixed(1)}<span class="wt-kpi__unit">GB</span>`);
      }
    }
  }
}

function updateLivePanels() {
  if (state.activeTab !== 'live' || state.liveIntroPlaying) return;
  const thermal = state.liveEnvelope?.thermal;
  if (thermal?.available) {
    const pkg = thermal.package_c ?? 0;
    const readout = document.getElementById('thermal-package-readout');
    if (readout) TowerRenderLive.setThermalReadout(readout, pkg);
    const pkgBand = TowerRenderLive.thermalTempBand(pkg);
    const pkgBandEl = document.getElementById('thermal-package-band');
    if (pkgBandEl) {
      pkgBandEl.textContent = TowerRenderLive.thermalBandLabel(pkgBand);
      pkgBandEl.className = TowerRenderLive.thermalBandElClass(pkgBand);
    }
    const pkgTile = document.getElementById('thermal-cpu-tile');
    if (pkgTile) pkgTile.className = `wt-live-thermal__tile wt-live-thermal__tile--${pkgBand}`;
    const ambient = TowerRenderLive.findAmbientC(thermal);
    const ambEl = document.getElementById('thermal-ambient-readout');
    if (ambEl && ambient != null) {
      TowerRenderLive.setThermalReadout(ambEl, ambient);
      const ambBand = TowerRenderLive.ambientTempBand(ambient);
      const ambBandEl = document.getElementById('thermal-ambient-band');
      if (ambBandEl) {
        ambBandEl.textContent = TowerRenderLive.thermalBandLabel(ambBand);
        ambBandEl.className = TowerRenderLive.thermalBandElClass(ambBand);
      }
      const ambTile = document.getElementById('thermal-ambient-tile');
      if (ambTile) ambTile.className = `wt-live-thermal__tile wt-live-thermal__tile--${ambBand}`;
    }
    const cpuCanvas = document.getElementById('thermal-cpu-dial');
    if (cpuCanvas) {
      cpuCanvas.dataset.temp = String(pkg);
      const band = TowerRenderLive.thermalTempBand(pkg);
      const wrap = cpuCanvas.closest('[data-thermal-kind="cpu"]');
      if (wrap) {
        wrap.className = `wt-thermal-dial${TowerRenderShared.thermalDialHotMod(band)}`;
        wrap.dataset.thermalKind = 'cpu';
      }
    }
    const ambCanvas = document.getElementById('thermal-ambient-dial');
    if (ambCanvas && ambient != null) {
      ambCanvas.dataset.temp = String(ambient);
      const wrap = ambCanvas.closest('[data-thermal-kind="ambient"]');
      if (wrap) {
        wrap.className = `wt-thermal-dial${TowerRenderShared.thermalDialHotMod(TowerRenderLive.ambientTempBand(ambient))}`;
        wrap.dataset.thermalKind = 'ambient';
      }
    }
    if (typeof Viz !== 'undefined') Viz.refreshTempDials();
  }
  const bw = state.liveEnvelope?.bandwidth;
  if (bw?.interface) {
    TowerRenderLive.appendBandwidthSample(bw);
    const rxEl = document.getElementById('live-net-rx-rate');
    const txEl = document.getElementById('live-net-tx-rate');
    const cap = document.getElementById('live-net-caption');
    if (rxEl) rxEl.textContent = TowerRenderLive.formatNetworkRate(bw.rx_mbps);
    if (txEl) txEl.textContent = TowerRenderLive.formatNetworkRate(bw.tx_mbps);
    if (cap) {
      const age = bw.sample_age_sec != null ? `${bw.sample_age_sec}s sample` : 'live';
      cap.textContent = age;
    }
    initBandwidthChart(true);
  }
  const disk = state.liveEnvelope?.disk_io;
  if (disk?.device) {
    TowerRenderLive.appendDiskIoSample(disk);
    const readEl = document.getElementById('live-disk-read-rate');
    const writeEl = document.getElementById('live-disk-write-rate');
    const cap = document.getElementById('live-disk-caption');
    if (readEl) readEl.textContent = TowerRenderLive.formatDiskIoRate(disk.read_mb_s);
    if (writeEl) writeEl.textContent = TowerRenderLive.formatDiskIoRate(disk.write_mb_s);
    if (cap) {
      const age = disk.sample_age_sec != null ? `${disk.sample_age_sec}s sample` : 'live';
      cap.textContent = age;
    }
    initDiskIoChart(true);
  }
}






function bindActivityEvents() {
  bindActivityChromeEvents();
  document.getElementById('activity-scan-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('activity-scan-btn');
    if (btn) btn.disabled = true;
    await scanActivity(true);
    await loadActivityEvents();
    render();
  });
  const tab = document.querySelector('.wt-tab-activity');
  if (!tab || tab.dataset.activityBound) return;
  tab.dataset.activityBound = '1';
  tab.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-hint');
    if (copyBtn && tab.contains(copyBtn)) {
      const text = copyBtn.dataset.copy || '';
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success')).catch(() => {});
      }
    }
  });
}

function bindActivityChromeEvents() {
  const chrome = document.getElementById('activity-chrome');
  if (!chrome || chrome.dataset.activityChromeBound) return;
  chrome.dataset.activityChromeBound = '1';

  chrome.querySelector('#activity-search')?.addEventListener('input', (e) => {
    state.activitySearch = e.target.value;
    refreshActivityPage();
  });

  chrome.addEventListener('click', (e) => {
    const filterBtn = e.target.closest('[data-activity-filter]');
    if (!filterBtn || !chrome.contains(filterBtn)) return;
    const next = filterBtn.dataset.activityFilter;
    if (next === state.activityTypeFilter) return;
    state.activityTypeFilter = next;
    refreshActivityPage();
  });
}

function refreshActivityPage() {
  const f = state.activeFacts;
  const ctx = TowerRenderActivity.computeActivityContext(f);
  const tab = document.querySelector('.wt-tab-activity');
  if (!tab || state.activeTab !== 'activity') {
    rerenderActivityTab();
    return;
  }
  const body = document.getElementById('activity-page-body');
  const chrome = document.getElementById('activity-chrome');
  if (!body || !chrome) {
    rerenderActivityTab();
    return;
  }
  TowerRenderActivity.updateActivityKpiRow(ctx);
  TowerRenderActivity.updateActivityChromeMeta(ctx);
  body.innerHTML = TowerRenderActivity.renderActivityPageBody(ctx);
  refreshChromeIcons();
  bindTabLinks();
  TowerRenderActivity.wireTimelineReveal();
}

function rerenderActivityTab() {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = TowerRenderActivity.renderActivity();
  bindActivityEvents();
  afterRender();
}

async function refreshActivityAfterLoad() {
  if (state.activeTab !== 'activity') return;
  refreshActivityPage();
  updateTabBadges();
  TowerRenderActivity.wireTimelineReveal();
}

function bindBackupsEvents() {
  bindBackupsChromeEvents();
  TowerRenderBackups.bindBackupSettingsLink();
  const tab = document.querySelector('.wt-tab-backups');
  if (!tab || tab.dataset.backupsBound) return;
  tab.dataset.backupsBound = '1';
  tab.addEventListener('click', (e) => {
    if (e.target.closest('.backup-pick-btn')) TowerRenderBackups.openBackupFolderPicker();
    if (e.target.closest('#backup-rescan-btn')) handleBackupRescan();
    const copyBtn = e.target.closest('.copy-hint');
    if (copyBtn && tab.contains(copyBtn)) {
      const text = copyBtn.dataset.copy || '';
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success')).catch(() => {});
      }
    }
  });
}

async function handleBackupRescan() {
  if (!state.apiMode) {
    showToast('Rescan requires the embedded dashboard on a live server.', 'info');
    return;
  }
  const btn = document.getElementById('backup-rescan-btn');
  if (btn) btn.disabled = true;
  try {
    const data = await WatchtowerApi.postBackupScan();
    if (!state.activeFacts.optional) state.activeFacts.optional = {};
    if (data.last_backup) state.activeFacts.optional.last_backup = data.last_backup;
    if (data.backup_inventory) {
      state.activeFacts.optional.backup_inventory = data.backup_inventory;
    } else if (data.last_backup?.inventory_count === 0) {
      state.activeFacts.optional.backup_inventory = [];
    }
    showToast(data.last_backup?.status === 'success'
      ? `Backup OK: ${data.last_backup.path || 'found'}`
      : 'Backup scan complete', data.last_backup?.status === 'success' ? 'success' : 'info');
    refreshBackupsPage();
    updateTabBadges();
  } catch (e) {
    showToast(`Backup scan failed: ${e.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function refreshBackupsPage() {
  const f = state.activeFacts;
  const ctx = TowerRenderBackups.computeBackupsContext(f);
  const tab = document.querySelector('.wt-tab-backups');
  if (!tab || state.activeTab !== 'backups') {
    rerenderBackupsTab();
    return;
  }

  if (!ctx.hasData || ctx.unconfigured) {
    rerenderBackupsTab();
    return;
  }

  const body = document.getElementById('backups-page-body');
  const chrome = document.getElementById('backups-chrome');
  if (!body || !chrome) {
    rerenderBackupsTab();
    return;
  }

  body.innerHTML = TowerRenderBackups.renderBackupsPageBody(f, ctx);
  TowerRenderBackups.updateBackupsChromeKpis(chrome, ctx);
  refreshChromeIcons();
}

function rerenderBackupsTab() {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = TowerRenderBackups.renderBackups();
  bindBackupsEvents();
  afterRender();
}

function bindBackupsChromeEvents() {
  const chrome = document.getElementById('backups-chrome');
  if (!chrome || chrome.dataset.backupsChromeBound) return;
  chrome.dataset.backupsChromeBound = '1';

  chrome.querySelector('#backup-search')?.addEventListener('input', (e) => {
    state.backupsSearch = e.target.value;
    refreshBackupsPage();
  });
}


function refreshModsPage() {
  const body = document.getElementById('mods-page-body');
  const chrome = document.getElementById('mods-chrome');
  if (!body || !chrome || state.activeTab !== 'mods') {
    rerenderModsTab();
    return;
  }
  const f = state.activeFacts;
  const ctx = TowerRenderMods.computeModsContext(f);
  const counts = {
    conflicts: ctx.conflictRecsAll.length,
    client: ctx.clientToReview || ctx.clientMods.length,
    errors: ctx.errorModIds.size,
  };

  const statusWrap = document.getElementById('mods-status-bar-wrap');
  if (statusWrap) {
    statusWrap.innerHTML = TowerRenderMods.renderModsStatusBar(ctx);
  }

  document.querySelectorAll('#mods-subnav .wt-mods-subnav__btn').forEach((btn) => {
    const viewId = btn.dataset.modView;
    btn.classList.toggle('active', viewId === ctx.view);
    const n = viewId === 'conflicts' ? counts.conflicts
      : viewId === 'client' ? counts.client
        : viewId === 'errors' ? counts.errors
          : 0;
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
  const countEl = document.querySelector('.wt-mods-status-bar__count');
  if (countEl) countEl.textContent = TowerRenderMods.modsCountLabel(ctx);
  const search = document.getElementById('mod-search');
  if (search) search.placeholder = TowerRenderMods.searchPlaceholder(ctx.view);
  const techWrap = document.getElementById('mods-tech-toggle-wrap');
  if (techWrap) techWrap.hidden = ctx.view !== 'overview' && ctx.view !== 'errors';

  body.innerHTML = TowerRenderMods.renderModsPageBody(f, ctx);
  bindModsPageEvents();
  bindModEvents();
  refreshChromeIcons();
  bindClientModIgnoreEvents();
}

function rerenderModsTab() {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = TowerRenderMods.renderMods();
  bindModsEvents();
  afterRender();
}

function bindModsChromeEvents() {
  const chrome = document.getElementById('mods-chrome');
  if (!chrome || chrome.dataset.modsChromeBound) return;
  chrome.dataset.modsChromeBound = '1';

  chrome.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-mod-view]');
    if (!viewBtn || !chrome.contains(viewBtn)) return;
    const view = viewBtn.dataset.modView;
    if (view === state.modsView) return;
    state.modsView = view;
    state.modsPage = 0;
    refreshModsPage();
  });

  chrome.querySelector('#mod-search')?.addEventListener('input', (e) => {
    state.modsSearch = e.target.value;
    state.modsPage = 0;
    refreshModsPage();
  });

  chrome.querySelector('#tech-names-toggle')?.addEventListener('change', (e) => {
    state.showTechNames = e.target.checked;
    refreshModsPage();
  });
}

function bindModsPageEvents() {
  const body = document.getElementById('mods-page-body');
  if (!body || body.dataset.modsPageBound) return;
  body.dataset.modsPageBound = '1';

  body.addEventListener('click', (e) => {
    if (e.target.closest('#mod-prev')) {
      state.modsPage = Math.max(0, state.modsPage - 1);
      refreshModsPage();
      return;
    }
    if (e.target.closest('#mod-next')) {
      state.modsPage += 1;
      refreshModsPage();
      return;
    }
    const row = e.target.closest('.wt-mod-manifest__row[data-mod-id]');
    if (!row) return;
    const id = row.dataset.modId;
    const base = TowerRenderMods.computeModsBase(state.activeFacts);
    const view = TowerRenderMods.resolveModViewForId(base, id);
    if (view !== state.modsView) {
      state.modsView = view;
      state.modsPage = 0;
      refreshModsPage();
    }
    requestAnimationFrame(() => {
      const target = document.getElementById(`mod-problem-${id}`)
        || document.querySelector(`.wt-mod-client-card[data-mod-id="${CSS.escape(id)}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('wt-mod-issue-card--highlight', 'wt-mod-client-card--highlight');
        setTimeout(() => target.classList.remove('wt-mod-issue-card--highlight', 'wt-mod-client-card--highlight'), 2000);
      }
    });
  });
}

function bindModsEvents() {
  bindModsChromeEvents();
  bindModsPageEvents();
}

function rerenderMods() {
  rerenderModsTab();
}


async function bindSupportBundle() {
  if (document.body.dataset.supportBundleBound === '1') return;
  document.body.dataset.supportBundleBound = '1';
  document.addEventListener('click', async (e) => {
    const exportBtn = e.target.closest('#performance-export-btn');
    if (exportBtn) {
      e.preventDefault();
      if (typeof TowerMotion !== 'undefined') TowerMotion.btnLoading(exportBtn, true);
      else {
        exportBtn.classList.add('is-loading');
        exportBtn.disabled = true;
      }
      const windowParam = state.performanceWindow || '7d';
      try {
        const blob = await WatchtowerApi.downloadPerformanceExport(windowParam);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `watchtower-performance-${windowParam}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Performance CSV downloaded', 'success');
      } catch (err) {
        showToast(`Export failed: ${err.message}`, 'error');
      } finally {
        if (typeof TowerMotion !== 'undefined') TowerMotion.btnLoading(exportBtn, false);
        else {
          exportBtn.classList.remove('is-loading');
          exportBtn.disabled = false;
        }
      }
      return;
    }
    const btn = e.target.closest('#support-bundle-btn');
    if (!btn) return;
    e.preventDefault();
    if (typeof TowerMotion !== 'undefined') TowerMotion.btnLoading(btn, true);
    else {
      btn.classList.add('is-loading');
      btn.disabled = true;
    }
    try {
      const blob = await WatchtowerApi.downloadSupportBundle();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchtower-support-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Support bundle downloaded', 'success');
    } catch (e) {
      showToast(`Bundle download failed: ${e.message}`, 'error');
    } finally {
      if (typeof TowerMotion !== 'undefined') TowerMotion.btnLoading(btn, false);
      else {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
    }
  });
}

function bindTabMotion() {
  if (typeof TowerMotion === 'undefined') return;
  document.querySelectorAll('.wt-stagger').forEach((el) => TowerMotion.staggerEnter(el));
}

function afterRender() {
  refreshChromeIcons();
  updateTabNavState();
  bindTabMotion();
  bindOverviewMotion();
  bindLiveMotion();
  if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.bindOperationalTabMotion();
  Viz.refreshAll();
  bindAckEvents();
  bindClientModIgnoreEvents();
  bindDashboardBanners();
  bindSessionEvents();
  bindTabLinks();
  bindCrashEvents();
  bindModEvents();
  bindLagIncidentEvents();
  bindOnboardingEvents();
  bindSupportBundle();
  if (typeof WatchtowerMotion !== 'undefined') {
    WatchtowerMotion.sectionEnter(document.getElementById('main-content'));
  }
  requestAnimationFrame(() => {
    if (state.activeTab === 'overview' || state.activeTab === 'live') {
      initSparklinesForTab(state.activeTab);
      if (state.activeTab === 'live') {
        requestAnimationFrame(() => resizeLiveCharts());
      }
    }
    if (state.activeTab === 'crashes') {
      initPreCrashSparklines();
      const summaries = TowerRenderCrashes.collectDisplayCrashes?.(state.activeFacts)
        ?? state.activeFacts?.optional?.crash_summaries ?? [];
      loadCrashContexts(summaries.map((c) => c.file).filter(Boolean));
      scanCrashes(false).then((result) => {
        if (result) render();
      });
    }
    if (state.activeTab === 'activity') {
      TowerRenderActivity.wireTimelineReveal();
      scanActivity(false).then(async (result) => {
        if (result) {
          await loadActivityEvents();
          render();
        }
      });
    }
    if (state.activeTab === 'mods') {
      scanMods(false).then((result) => {
        if (result) render();
      });
    }
    if (state.activeTab === 'sources' && typeof TowerDataSources !== 'undefined') {
      TowerDataSources.fetchFromApi();
    }
    if (state.activeTab === 'crashes') {
      scrollToCrashCard();
    }
  });
}

function render() {
  if (state.canvasView === 'settings' || state.canvasView === 'help') return;
  state.pregenIdCounter = 0;
  renderNav();
  renderGlobalBanners();
  const main = document.getElementById('main-content');
  switch (state.activeTab) {
    case 'overview': main.innerHTML = TowerTabFooter.wrapTab('overview', TowerRenderOverview.renderOverview()); state.lastOverviewVitals = null; state.overviewIntroPlayed = false; break;
    case 'live': main.innerHTML = TowerTabFooter.wrapTab('live', TowerRenderLive.renderLive()); state.liveIntroPlayed = false; break;
    case 'performance': main.innerHTML = TowerTabFooter.wrapTab('performance', TowerRenderPerformance.renderPerformance()); TowerRenderPerformance.bindPerformanceEvents(); if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('performance'); break;
    case 'session': main.innerHTML = TowerTabFooter.wrapTab('session', TowerRenderSession.renderSession()); bindSessionEvents(); if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('session'); break;
    case 'issues': main.innerHTML = TowerTabFooter.wrapTab('issues', TowerRenderIssues.renderIssues()); if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('issues'); break;
    case 'crashes': main.innerHTML = TowerTabFooter.wrapTab('crashes', TowerRenderCrashes.renderCrashes()); if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('crashes'); break;
    case 'spark':
      main.innerHTML = TowerTabFooter.wrapTab('spark', TowerRenderSpark.renderSpark());
      TowerRenderSpark.bindSparkEvents();
      TowerRenderSpark.loadProfilesAndRender();
      if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('spark');
      break;
    case 'mods': main.innerHTML = TowerTabFooter.wrapTab('mods', TowerRenderMods.renderMods()); bindModsEvents(); if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('mods'); break;
    case 'backups': main.innerHTML = TowerTabFooter.wrapTab('backups', TowerRenderBackups.renderBackups()); bindBackupsEvents(); if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('backups'); break;
    case 'activity': main.innerHTML = TowerTabFooter.wrapTab('activity', TowerRenderActivity.renderActivity()); bindActivityEvents(); if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('activity'); break;
    case 'sources': main.innerHTML = TowerTabFooter.wrapTab('sources', TowerRenderSources.renderSources()); TowerRenderSources.bindSourcesEvents(); if (typeof TowerTabMotion !== 'undefined') TowerTabMotion.resetIntro('sources'); break;
    case 'docs': {
      main.innerHTML = TowerTabFooter.wrapTab('docs', TowerRenderDocs.renderDocs());
      if (typeof WatchtowerWiki !== 'undefined') {
        const slug = typeof TowerRouting !== 'undefined'
          ? TowerRouting.resolveWikiSlug({})
          : (state.wikiPageSlug || WatchtowerWiki.parseHash() || 'Home');
        WatchtowerWiki.mount(document.getElementById('wiki-root'), slug);
      }
      break;
    }
    default: main.innerHTML = TowerTabFooter.wrapTab('overview', TowerRenderOverview.renderOverview());
  }
  afterRender();
  if (state.activeTab === 'overview') {
    const f = state.activeFacts;
    const acks = getAcks();
    const ignores = getClientModIgnores();
    const health = f ? Health.displayHealth(f, acks, ignores) : null;
    const grade = health?.effective === 'critical' ? 'critical' : health?.effective === 'warning' ? 'warning' : 'ok';
    syncHeroBeaconPulse(grade);
  }
  stopCorePolling();
  stopStaticSimulation();
  if (state.apiMode && (state.activeTab === 'overview' || state.activeTab === 'live' || state.activeTab === 'session' || state.activeTab === 'sources')) {
    startCorePolling();
    if (state.activeTab === 'live' || state.activeTab === 'overview') bindLiveControls();
  } else if (!state.apiMode && (state.activeTab === 'overview' || state.activeTab === 'live')) {
    startLiveSimulation();
    if (state.activeTab === 'live') bindLiveControls();
  }
}

function stopStaticSimulation() {
  if (state.staticSimTimer) {
    clearInterval(state.staticSimTimer);
    state.staticSimTimer = null;
  }
}

function jitterStaticMetric(value, spread, min, max) {
  const next = (value ?? 0) + (Math.random() - 0.5) * spread;
  return Math.min(max, Math.max(min, next));
}

function tickStaticChunkyPregen() {
  const chunky = state.liveEnvelope?.chunky_pregen;
  if (!chunky?.pregen_active || !chunky.last) return;
  const last = chunky.last;
  const total = last.total ?? 14068432;
  const step = 0.015 + Math.random() * 0.04;
  const nextPct = Math.min(99.5, (last.pct ?? 0) + step);
  last.pct = Math.round(nextPct * 100) / 100;
  last.chunks = Math.round((nextPct / 100) * total);
  last.cps = Math.round(jitterStaticMetric(last.cps ?? 12.5, 2.5, 4, 28) * 10) / 10;
  last.rate = last.cps;
  last.time = new Date().toISOString();
  if (state.activeTab === 'overview') updateOverviewPregenLive(chunky);
}

function tickStaticLiveMetrics() {
  if (!state.liveLatest || document.hidden) return;
  const base = state.liveLatest;
  const heapMax = base.heap_mb?.max ?? 8192;
  const next = {
    ...base,
    tps: jitterStaticMetric(base.tps, 0.4, 17.5, 20),
    mspt: jitterStaticMetric(base.mspt, 2.5, 2, 45),
    players_online: Math.max(0, Math.round(jitterStaticMetric(base.players_online, 0.8, 0, 8))),
    host_cpu_pct: jitterStaticMetric(base.host_cpu_pct, 10, 8, 95),
    heap_mb: {
      ...base.heap_mb,
      used: Math.round(jitterStaticMetric(base.heap_mb?.used, 220, 4000, heapMax)),
    },
    mem_available_gb: jitterStaticMetric(base.mem_available_gb, 0.4, 6, 24),
    disk_use_pct: jitterStaticMetric(base.disk_use_pct, 0.6, 30, 90),
    entities: Math.round(jitterStaticMetric(base.entities, 60, 200, 5000)),
    polled_at: new Date().toISOString(),
  };
  state.liveLatest = next;
  applyLiveLatest(next);
  appendTailToSamplesRaw(next);
  if (state.liveEnvelope?.bandwidth) {
    const bw = state.liveEnvelope.bandwidth;
    bw.rx_mbps = jitterStaticMetric(bw.rx_mbps, 5, 0.5, 80);
    bw.tx_mbps = jitterStaticMetric(bw.tx_mbps, 2.5, 0.2, 40);
    bw.sample_age_sec = 0;
    TowerRenderLive.appendBandwidthSample(bw);
  }
  if (state.liveEnvelope?.disk_io) {
    const disk = state.liveEnvelope.disk_io;
    disk.read_mb_s = jitterStaticMetric(disk.read_mb_s, 12, 0.5, 450);
    disk.write_mb_s = jitterStaticMetric(disk.write_mb_s, 8, 0.2, 180);
    disk.sample_age_sec = 0;
    TowerRenderLive.appendDiskIoSample(disk);
  }
  if (state.liveEnvelope?.thermal) {
    const th = state.liveEnvelope.thermal;
    th.package_c = jitterStaticMetric(th.package_c, 2.5, 40, 88);
    if (th.ambient_c != null) th.ambient_c = jitterStaticMetric(th.ambient_c, 1.2, 24, 42);
    (th.zones || []).forEach((z) => {
      if (TowerRenderLive.isCoreZone(z)) {
        z.c = jitterStaticMetric(z.c, 1.8, 38, 95);
      }
    });
  }
  tickStaticChunkyPregen();
  updateLiveValues(next);
  updateLivePanels();
  updateSamplesFreshnessCaption();
  if (state.activeTab === 'overview' || state.activeTab === 'live') {
    refreshSparklinesFromSamples(false);
  }
}

function startLiveSimulation() {
  if (state.apiMode) return;
  stopStaticSimulation();
  tickStaticLiveMetrics();
  state.staticSimTimer = setInterval(tickStaticLiveMetrics, 3000);
}

function updateSecurityBanners() {
  renderGlobalBanners();
}

async function handleRouteFromUrl({ skipUrlSync = false } = {}) {
  const tab = typeof TowerRouting !== 'undefined' ? TowerRouting.parseTab() : null;
  const wiki = typeof TowerRouting !== 'undefined'
    ? TowerRouting.parseWikiSlug()
    : (typeof WatchtowerWiki !== 'undefined' ? WatchtowerWiki.parseHash() : null);
  const insightsView = typeof TowerRouting !== 'undefined' ? TowerRouting.parseInsightsView() : null;
  if (insightsView) state.insightsView = insightsView;
  if (tab && document.querySelector(`.wt-rail__link[data-tab="${tab}"]`)) {
    const opts = { skipUrlSync };
    if (wiki && tab === 'docs') opts.wikiSlug = wiki;
    if (insightsView) opts.insightsView = insightsView;
    await navigateToTab(tab, opts);
    return true;
  }
  if (wiki) {
    await navigateToTab('docs', { wikiSlug: wiki, skipUrlSync });
    return true;
  }
  return false;
}

async function applyDeepLinks() {
  await handleRouteFromUrl({ skipUrlSync: true });
  const params = new URLSearchParams(window.location.search);
  const help = params.get('help');
  if (help && typeof WatchtowerHelp !== 'undefined') {
    if (help === 'docs' && typeof navigateToTab === 'function') navigateToTab('docs');
    else WatchtowerHelp.open('guide');
  }
  if (params.get('tour') === '1') {
    if (typeof WatchtowerSettings !== 'undefined') {
      await WatchtowerSettings.open('about');
    }
    if (typeof WatchtowerTour !== 'undefined') {
      setTimeout(() => WatchtowerTour.start({ force: true }), 500);
    }
  }
  const settings = params.get('settings');
  if (settings && typeof WatchtowerSettings !== 'undefined') {
    const panel = ['security', 'about'].includes(settings) ? settings : 'settings';
    WatchtowerSettings.open(panel);
  }
  if (params.get('setup') === '1' && typeof WatchtowerSetupWizard !== 'undefined') {
    const replay = WatchtowerSetupWizard.isWizardComplete();
    WatchtowerSetupWizard.open(replay ? { force: true, replay: true } : { force: true });
  }
  if (typeof TowerRouting !== 'undefined') TowerRouting.syncFromAppState({ push: false });
}

function initLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (typeof WatchtowerAuth === 'undefined') return;
    await WatchtowerAuth.logout();
    location.reload();
  });
}

async function init() {
  showBootScreen();
  setBootMessage('Starting Watchtower…');
  initTheme();
  initTabs();
  initRunReport();
  bindCrashLogModal();
  bindLagIncidentModal();
  initWelcome();
  if (typeof WatchtowerSetupWizard !== 'undefined') WatchtowerSetupWizard.init();
  initNavButtons();
  initReportSelect();
  initLogout();
  if (typeof TowerCmdk !== 'undefined') TowerCmdk.init();
  window.addEventListener('popstate', () => {
    if (!state.bootReady) return;
    handleRouteFromUrl({ skipUrlSync: true });
  });
  startClock();
  document.addEventListener('visibilitychange', () => {
    if (shouldPollLive()) startCorePolling();
    else stopCorePolling();
    if (!state.apiMode) {
      if (document.hidden) stopStaticSimulation();
      else if (state.activeTab === 'overview' || state.activeTab === 'live') startLiveSimulation();
    }
  });
  try {
    if (isApiMode() && typeof WatchtowerAuth !== 'undefined') {
      setBootMessage('Checking session…');
      await WatchtowerAuth.ensureAuthenticated();
      updateSecurityBanners();
      document.getElementById('logout-btn')?.classList.remove('hidden');
    }
    await loadData();
    setBootMessage('Preparing dashboard…');
    hideEmbeddedPocChrome();
    hideBootScreen();
    if (typeof WatchtowerSetupWizard !== 'undefined' && WatchtowerSetupWizard.shouldAutoOpen()) {
      WatchtowerSetupWizard.open();
      startLiveSimulation();
      return;
    }
    render();
    startLiveSimulation();
    await applyDeepLinks();
  } catch (e) {
    hideBootScreen();
    document.getElementById('main-content').innerHTML = `<div class="wt-panel"><h2>Load error</h2><p>Run <code>python -m http.server 8080</code> from web/dashboard/</p><pre>${TowerRenderShared.esc(e.message)}</pre></div>`;
    afterRender();
  }
}


document.addEventListener('DOMContentLoaded', init);

window.navigateToTab = navigateToTab;
window.openWiki = (slug) => {
  if (typeof navigateToTab === 'function') {
    navigateToTab('docs', { wikiSlug: slug || 'Home' });
  }
};
window.openHelp = (panel) => {
  if (typeof TowerViews !== 'undefined') TowerViews.openHelp(panel || 'guide');
};
