/**
 * Per-tab load-in motion — KPI count-ups, bar growth, scroll reveals.
 * Admin canvas views (Docs, Settings, Help) are excluded.
 */
const TowerTabMotion = (function () {
  const INTRO_DELAY_MS = 450;
  const INTRO_DURATION_MS = 1000;
  let scrollObserver = null;

  const OPERATIONAL_TABS = new Set([
    'performance', 'session', 'issues', 'crashes', 'spark', 'mods', 'backups', 'activity', 'sources',
  ]);

  function motion() {
    return typeof TowerMotion !== 'undefined' ? TowerMotion : null;
  }

  function introPlayed(tab) {
    if (!state.tabIntroPlayed) state.tabIntroPlayed = {};
    return state.tabIntroPlayed[tab] === true;
  }

  function markIntroPlayed(tab) {
    if (!state.tabIntroPlayed) state.tabIntroPlayed = {};
    state.tabIntroPlayed[tab] = true;
  }

  function resetIntro(tab) {
    if (state.tabIntroPlayed) delete state.tabIntroPlayed[tab];
  }

  function disconnectScrollReveal() {
    if (scrollObserver) {
      scrollObserver.disconnect();
      scrollObserver = null;
    }
  }

  function bindScrollReveal(root, selector = '.wt-scroll-reveal') {
    const M = motion();
    if (!root || !M) return;
    disconnectScrollReveal();
    scrollObserver = M.scrollReveal(root, selector);
  }

  function animateKpiCard(cardId, value, opts = {}) {
    const M = motion();
    if (!M) return;
    const byId = document.getElementById(`${cardId}-val`);
    const statVal = document.querySelector(`#${cardId} .wt-stat-card__value`);
    if (byId) M.animateKpiHtml(`${cardId}-val`, value, { duration: INTRO_DURATION_MS, ...opts });
    else if (statVal) M.animateKpiElement(statVal, value, { duration: INTRO_DURATION_MS, ...opts });
  }

  function runKpiIntros(items, duration = INTRO_DURATION_MS) {
    items.forEach((item) => {
      if (item.id) animateKpiCard(item.id, item.value, item);
      else if (item.el) motion()?.animateKpiElement(item.el, item.value, { duration, ...item });
    });
  }

  function zeroKpiHtml(item) {
    const { decimals = 0, unit = '', unitClass = 'wt-kpi__unit' } = item;
    const zeroText = decimals > 0 ? (0).toFixed(decimals) : '0';
    return unit ? `${zeroText}<span class="${unitClass}">${unit}</span>` : zeroText;
  }

  function resetKpiPlaceholder(item) {
    if (!item?.id) return;
    const el = document.getElementById(`${item.id}-val`);
    if (el) {
      el.innerHTML = zeroKpiHtml(item);
      return;
    }
    const statVal = document.querySelector(`#${item.id} .wt-stat-card__value`);
    if (statVal) {
      const { decimals = 0 } = item;
      statVal.textContent = decimals > 0 ? (0).toFixed(decimals) : '0';
    }
  }

  function resetKpiPlaceholders(items) {
    (items || []).forEach(resetKpiPlaceholder);
  }

  function runDelayedIntro(tab, fn, options = {}) {
    if (introPlayed(tab)) return;
    markIntroPlayed(tab);
    const M = motion();
    const applyReset = () => {
      if (typeof options.reset === 'function') options.reset();
      else if (options.kpiItems?.length) resetKpiPlaceholders(options.kpiItems);
    };
    if (!M || M.prefersReducedMotion()) {
      fn();
      return;
    }
    applyReset();
    setTimeout(fn, INTRO_DELAY_MS);
  }

  function bindPerformanceMotion() {
    const tab = 'performance';
    const root = document.querySelector('.wt-tab-performance');
    if (!root) return;
    bindScrollReveal(root);

    const buildKpis = () => {
      const d = state.performanceDashboard;
      const s = d?.summary_extended || {};
      const related = d?.related_event_count ?? (d?.related_events?.length ?? 0);
      return [
        { id: 'perf-samples', value: Number(s.sample_minutes) || 0 },
        { id: 'perf-tps', value: Number(s.tps_avg) || 0, decimals: 2 },
        { id: 'perf-mspt', value: Number(s.mspt_p95) || 0, decimals: 1, unit: 'ms' },
        { id: 'perf-low-tps', value: Number(s.low_tps_minutes) || 0 },
        { id: 'perf-players', value: Number(s.players_peak) || 0 },
        { id: 'perf-sticky', value: Number(s.sticky_episode_count) || 0 },
        { id: 'perf-outliers', value: Number(s.outlier_count) || 0 },
        { id: 'perf-related', value: Number(related) || 0 },
      ];
    };

    const kpis = buildKpis();
    runDelayedIntro(tab, () => {
      if (state.activeTab !== tab) return;
      runKpiIntros(buildKpis());
    }, { kpiItems: kpis });
  }

  function rebindPerformanceScroll() {
    const root = document.querySelector('.wt-tab-performance');
    if (!root) return;
    bindScrollReveal(root);
  }

  function bindSessionMotion() {
    const tab = 'session';
    const root = document.querySelector('.wt-tab-session');
    if (!root) return;
    bindScrollReveal(root);

    const buildKpis = () => {
      const summary = TowerRenderSession.sessionSummary?.();
      if (!summary) return [];
      return [
        { id: 'session-online', value: summary.onlineCount ?? 0 },
        { id: 'session-peak', value: Number(summary.peak) || 0 },
        { id: 'session-unique', value: Number(summary.unique) || 0 },
        { id: 'session-known', value: summary.knownCount ?? 0 },
      ];
    };

    runDelayedIntro(tab, () => {
      if (state.activeTab !== tab) return;
      const kpis = buildKpis();
      if (!kpis.length) return;
      runKpiIntros(kpis);
    }, { kpiItems: buildKpis() });
  }

  function bindIssuesMotion() {
    const tab = 'issues';
    const root = document.querySelector('.wt-tab-issues');
    if (!root) return;
    bindScrollReveal(root);

    const buildKpis = () => {
      const acks = typeof getAcks === 'function' ? getAcks() : {};
      const ignores = typeof getClientModIgnores === 'function' ? getClientModIgnores() : {};
      const f = state.activeFacts;
      if (!f || typeof Health === 'undefined') return [];
      const queue = Health.buildActionQueue(f, acks, ignores);
      return [
        { id: 'issues-now', value: queue.filter((i) => i.tier === 'now').length },
        { id: 'issues-soon', value: queue.filter((i) => i.tier === 'soon').length },
        { id: 'issues-hist', value: queue.filter((i) => i.tier === 'historical').length },
      ];
    };

    runDelayedIntro(tab, () => {
      if (state.activeTab !== tab) return;
      const kpis = buildKpis();
      if (!kpis.length) return;
      runKpiIntros(kpis);
    }, { kpiItems: buildKpis() });
  }

  function bindCrashesMotion() {
    const tab = 'crashes';
    const root = document.querySelector('.wt-tab-crashes');
    if (!root) return;
    bindScrollReveal(root);

    const buildKpis = () => {
      const summaries = TowerRenderCrashes?.collectDisplayCrashes?.(state.activeFacts)
        ?? state.activeFacts?.optional?.crash_summaries ?? [];
      const unacked = summaries.filter((c) => !c.acked);
      const modCount = summaries.filter((c) => (c.category || '').toLowerCase().includes('mod')).length;
      const hostCount = summaries.filter((c) => {
        const cat = (c.category || '').toLowerCase();
        return cat.includes('watchdog') || cat.includes('oom') || cat.includes('host');
      }).length;
      return [
        { id: 'crashes-total', value: summaries.length },
        { id: 'crashes-review', value: unacked.length },
        { id: 'crashes-mod', value: modCount },
        { id: 'crashes-host', value: hostCount },
      ];
    };

    runDelayedIntro(tab, () => {
      if (state.activeTab !== tab) return;
      runKpiIntros(buildKpis());
    }, { kpiItems: buildKpis() });
  }

  function bindSparkMotion() {
    const tab = 'spark';
    const root = document.querySelector('.wt-tab-spark');
    if (!root) return;
    root.querySelectorAll('.wt-scroll-reveal').forEach((el) => {
      el.classList.add('is-visible');
      el.dataset.motionRevealed = '1';
    });
    bindScrollReveal(root);

    const buildKpis = () => {
      const profile = state.sparkActiveProfile ?? state.activeFacts?.optional?.spark_profile;
      const ctx = profile?.context || {};
      return [
        { id: 'spark-tps', value: Number(ctx.tps_1m) || 0, decimals: 1, unit: 'TPS' },
        { id: 'spark-mspt', value: Number(ctx.mspt_p95_1m) || 0, decimals: 0, unit: 'ms' },
        { id: 'spark-players', value: Number(ctx.players) || 0 },
        { id: 'spark-entities', value: Number(ctx.world_entities) || 0 },
      ];
    };

    runDelayedIntro(tab, () => {
      if (state.activeTab !== tab) return;
      if ((state.sparkView || 'summary') !== 'summary') return;
      runKpiIntros(buildKpis());
    }, { kpiItems: buildKpis() });
  }

  function bindModsMotion() {
    const tab = 'mods';
    const root = document.querySelector('.wt-tab-mods');
    if (!root) return;
    bindScrollReveal(root);

    const countEl = root.querySelector('.wt-mods-status-bar__count');
    const match = countEl?.textContent.match(/(\d+)/);
    const modCount = match ? parseInt(match[1], 10) : 0;
    const modTemplate = countEl ? countEl.textContent.replace(/\d+/, '{{n}}') : '';

    runDelayedIntro(tab, () => {
      if (state.activeTab !== tab) return;
      const M = motion();
      if (!countEl || !M || !Number.isFinite(modCount)) return;
      M.animateValue({
        from: 0,
        to: modCount,
        duration: INTRO_DURATION_MS,
        onUpdate: (v) => {
          countEl.textContent = modTemplate.replace('{{n}}', String(Math.round(v)));
        },
      });
    }, {
      reset: () => {
        if (countEl && modTemplate) countEl.textContent = modTemplate.replace('{{n}}', '0');
      },
    });
  }

  function collectBackupKpiTargets(root) {
    const targets = [];
    root.querySelectorAll('.wt-backup-kpi-card__value, .wt-stat-card__value').forEach((el) => {
      const match = el.textContent.match(/^([\d.]+)/);
      if (!match) return;
      const n = parseFloat(match[1]);
      if (!Number.isFinite(n)) return;
      const unitHtml = el.querySelector('.wt-kpi__unit')?.outerHTML || '';
      targets.push({ el, n, unitHtml });
    });
    return targets;
  }

  function bindBackupsMotion() {
    const tab = 'backups';
    const root = document.querySelector('.wt-tab-backups');
    if (!root) return;
    bindScrollReveal(root);

    const backupTargets = collectBackupKpiTargets(root);

    runDelayedIntro(tab, () => {
      if (state.activeTab !== tab) return;
      const M = motion();
      if (!M) return;
      backupTargets.forEach(({ el, n, unitHtml }) => {
        M.animateValue({
          from: 0,
          to: n,
          duration: INTRO_DURATION_MS,
          onUpdate: (v) => {
            const text = Number.isInteger(n) ? String(Math.round(v)) : v.toFixed(1);
            el.innerHTML = unitHtml ? `${text}${unitHtml}` : text;
          },
        });
      });
    }, {
      reset: () => {
        backupTargets.forEach(({ el, unitHtml }) => {
          el.innerHTML = unitHtml ? `0${unitHtml}` : '0';
        });
      },
    });
  }

  function bindActivityMotion() {
    const tab = 'activity';
    const root = document.querySelector('.wt-tab-activity');
    if (!root) return;
    bindScrollReveal(root);

    const buildKpis = () => {
      const ctx = typeof TowerRenderActivity !== 'undefined' && TowerRenderActivity.computeActivityContext
        ? TowerRenderActivity.computeActivityContext(state.activeFacts)
        : null;
      if (!ctx) return [];
      return [
        { id: 'activity-events', value: ctx.totalStored ?? 0 },
        { id: 'activity-alerts', value: ctx.alertCount ?? 0 },
      ];
    };

    runDelayedIntro(tab, () => {
      if (state.activeTab !== tab) return;
      const kpis = buildKpis();
      if (!kpis.length) return;
      runKpiIntros(kpis);
    }, { kpiItems: buildKpis() });
  }

  function bindSourcesMotion() {
    const tab = 'sources';
    const root = document.querySelector('.wt-tab-sources');
    if (!root) return;
    bindScrollReveal(root);
  }

  function bind(tab) {
    if (!OPERATIONAL_TABS.has(tab)) return;
    disconnectScrollReveal();
    switch (tab) {
      case 'performance': bindPerformanceMotion(); break;
      case 'session': bindSessionMotion(); break;
      case 'issues': bindIssuesMotion(); break;
      case 'crashes': bindCrashesMotion(); break;
      case 'spark': bindSparkMotion(); break;
      case 'mods': bindModsMotion(); break;
      case 'backups': bindBackupsMotion(); break;
      case 'activity': bindActivityMotion(); break;
      case 'sources': bindSourcesMotion(); break;
      default: break;
    }
  }

  function bindOperationalTabMotion() {
    if (state.canvasView === 'settings' || state.canvasView === 'help') {
      disconnectScrollReveal();
      return;
    }
    if (!OPERATIONAL_TABS.has(state.activeTab)) {
      disconnectScrollReveal();
      return;
    }
    bind(state.activeTab);
  }

  return {
    bind,
    bindOperationalTabMotion,
    bindPerformanceMotion,
    bindSparkMotion,
    rebindPerformanceScroll,
    resetIntro,
    disconnectScrollReveal,
    OPERATIONAL_TABS,
  };
})();
