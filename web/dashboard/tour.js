/**
 * Guided tour v2 for Watchtower dashboard.
 */
const WatchtowerTour = (function () {
  const STORAGE_KEY = 'watchtower-tour-v3-complete';

  const STEPS = [
    {
      target: '#tower-report-window',
      title: 'Report window',
      body: 'Shows the date range of the open health report — crashes, logs, and events are filtered to this window.',
    },
    {
      target: '#rail-report-actions',
      title: 'Report controls',
      body: 'Switch between saved report snapshots and run a new health scan from the sidebar.',
    },
    {
      target: '#report-select',
      title: 'Report history',
      body: 'Each run writes new facts and brief files on disk. Pick an older snapshot to compare.',
    },
    {
      target: '#run-report-btn',
      title: 'Run report',
      body: 'Re-scan logs and host metrics on demand. Cancel anytime if you change your mind.',
    },
    {
      target: '#tower-rail',
      tab: 'overview',
      placement: 'right',
      expandSidebar: true,
      title: 'Navigation',
      body: 'Icon rail groups Monitor, Triage, and Ops. Use the cmdbar toggle to expand or collapse the sidebar. Badge counts highlight urgent items.',
    },
    {
      target: '.wt-welcome',
      tab: 'overview',
      title: 'Health overview',
      body: 'Status grid, TLDR summary, global vs session health, and vital metrics at a glance.',
    },
    {
      target: '.wt-rail__link[data-tab="issues"]',
      tab: 'issues',
      title: 'Issues inbox',
      body: 'Prioritized fix queue — needs attention now, worth fixing, and historical items.',
    },
    {
      target: '.wt-rail__link[data-tab="crashes"]',
      tab: 'crashes',
      title: 'Crashes',
      body: 'Parsed crash reports with mod hints, ack workflow, and optional pre-crash context.',
    },
    {
      target: '.wt-rail__link[data-tab="mods"]',
      tab: 'mods',
      title: 'Mods',
      body: 'Mod errors, update conflicts, and client-only mods you can keep on server or remove.',
    },
    {
      target: '.wt-rail__link[data-tab="backups"]',
      tab: 'backups',
      title: 'Backups',
      body: 'Choose your backup folder first — Watchtower does not search until you point it at archives.',
    },
    {
      target: '.backup-pick-btn, .wt-backup-setup .wt-btn',
      tab: 'backups',
      title: 'Choose backup folder',
      body: 'Browse paths visible to the server process and save. Works on Crafty, Ptero, AMP, and plain VPS layouts.',
      optional: true,
    },
    {
      target: '.wt-rail__link[data-tab="session"]',
      tab: 'session',
      title: 'Session',
      body: 'Player roster with playtime from stats and live online status when embedded.',
    },
    {
      target: '.wt-rail__link[data-tab="live"]',
      tab: 'live',
      title: 'Live metrics',
      body: 'Real-time TPS, MSPT, CPU, memory, and temperature dials while the server runs.',
    },
    {
      target: '.wt-rail__link[data-tab="activity"]',
      tab: 'activity',
      title: 'Activity',
      body: 'Event timeline built from saved reports — richer history when scheduled reports are enabled.',
    },
    {
      target: '#settings-btn',
      title: 'Settings',
      body: 'Scheduled reports, lookback defaults, thresholds, backup paths, and security — gear icon in the nav bar.',
    },
    {
      target: '#help-btn',
      title: 'Help hub',
      body: 'Open the guide wiki or replay the guided tour anytime.',
    },
    {
      target: '#theme-toggle',
      title: 'Theme',
      body: 'Cycle black, dark, and light themes. Your choice is remembered.',
    },
  ];

  let overlay = null;
  let spotlight = null;
  let tooltip = null;
  let stepIndex = 0;
  let active = false;
  let onKeyDown = null;

  function isComplete() {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  function markComplete() {
    localStorage.setItem(STORAGE_KEY, '1');
  }

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'watchtower-tour-overlay';
    overlay.className = 'tour-overlay hidden';
    overlay.setAttribute('aria-hidden', 'true');

    spotlight = document.createElement('div');
    spotlight.className = 'tour-spotlight';
    overlay.appendChild(spotlight);

    tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.setAttribute('role', 'dialog');
    tooltip.setAttribute('aria-live', 'polite');
    overlay.appendChild(tooltip);

    document.body.appendChild(overlay);
  }

  function teardown() {
    active = false;
    overlay?.classList.add('hidden');
    overlay?.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.tour-target-active').forEach((el) => {
      el.classList.remove('tour-target-active');
    });
    if (onKeyDown) {
      document.removeEventListener('keydown', onKeyDown);
      onKeyDown = null;
    }
  }

  function findTarget(selector) {
    const parts = selector.split(',').map((s) => s.trim());
    for (const sel of parts) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function isRailLikeRect(rect) {
    return rect.height > window.innerHeight * 0.45 && rect.width < 320;
  }

  function isSidebarTarget(rect) {
    return rect.left < 300 && rect.right <= 320;
  }

  function positionTooltip(rect, placement) {
    const margin = 16;
    const ttRect = tooltip.getBoundingClientRect();
    const ttW = ttRect.width || Math.min(360, window.innerWidth - 32);
    const ttH = ttRect.height || 200;
    const placeRight = placement === 'right'
      || (placement !== 'below' && (isRailLikeRect(rect) || isSidebarTarget(rect)));

    let top;
    let left;

    if (placeRight) {
      left = rect.right + margin;
      top = Math.max(margin, Math.min(rect.top, window.innerHeight - ttH - margin));
      if (left + ttW > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - ttW - margin);
      }
    } else {
      top = rect.bottom + margin;
      if (top + ttH > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - ttH - margin);
      }
      left = rect.left;
      if (left + ttW > window.innerWidth - margin) {
        left = window.innerWidth - ttW - margin;
      }
      left = Math.max(margin, left);
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function positionStep(step) {
    if (step.tab && typeof navigateToTab === 'function' && state.activeTab !== step.tab) {
      navigateToTab(step.tab);
      setTimeout(() => positionStep(step), 350);
      return;
    }

    const el = findTarget(step.target);
    if (!el) {
      if (step.optional && stepIndex < STEPS.length - 1) {
        stepIndex += 1;
        showStep();
        return;
      }
      if (stepIndex < STEPS.length - 1) {
        stepIndex += 1;
        showStep();
        return;
      }
      finish();
      return;
    }

    const runPosition = () => {
      if (!active) return;
      const target = findTarget(step.target);
      if (!target) return;

      document.querySelectorAll('.tour-target-active').forEach((n) => n.classList.remove('tour-target-active'));
      target.classList.add('tour-target-active');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      const rect = target.getBoundingClientRect();
      const pad = 8;
      spotlight.style.top = `${Math.max(0, rect.top - pad)}px`;
      spotlight.style.left = `${Math.max(0, rect.left - pad)}px`;
      spotlight.style.width = `${rect.width + pad * 2}px`;
      spotlight.style.height = `${rect.height + pad * 2}px`;

      const isLast = stepIndex >= STEPS.length - 1;
      tooltip.innerHTML = `
      <p class="tour-step-count">Step ${stepIndex + 1} of ${STEPS.length}</p>
      <h3 class="tour-title">${step.title}</h3>
      <p class="tour-body">${step.body}</p>
      <div class="tour-actions">
        <button type="button" class="wt-btn wt-btn--ghost tour-skip">Skip tour</button>
        <div class="tour-nav-btns">
          ${stepIndex > 0 ? '<button type="button" class="wt-btn wt-btn--ghost tour-back">Back</button>' : ''}
          <button type="button" class="wt-btn wt-btn--primary tour-next">${isLast ? 'Done' : 'Next'}</button>
        </div>
      </div>`;

      tooltip.querySelector('.tour-skip')?.addEventListener('click', finish);
      tooltip.querySelector('.tour-back')?.addEventListener('click', () => {
        stepIndex -= 1;
        showStep();
      });
      tooltip.querySelector('.tour-next')?.addEventListener('click', () => {
        if (isLast) finish();
        else {
          stepIndex += 1;
          showStep();
        }
      });

      requestAnimationFrame(() => {
        positionTooltip(target.getBoundingClientRect(), step.placement);
      });
    };

    if (step.expandSidebar && typeof TowerSidebar !== 'undefined' && !window.matchMedia('(max-width: 768px)').matches) {
      TowerSidebar.setSidebarExpanded(true, { persist: false });
      setTimeout(runPosition, 320);
      return;
    }

    runPosition();
  }

  function showStep() {
    const step = STEPS[stepIndex];
    if (!step) {
      finish();
      return;
    }
    positionStep(step);
  }

  function finish() {
    markComplete();
    teardown();
    if (typeof onFinishCallback === 'function') {
      const cb = onFinishCallback;
      onFinishCallback = null;
      cb();
    }
  }

  let onFinishCallback = null;

  function start(options = {}) {
    if (!options.force && isComplete()) return;
    onFinishCallback = options.onFinish || null;
    ensureDom();
    active = true;
    stepIndex = 0;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    showStep();

    onKeyDown = (e) => {
      if (!active) return;
      if (e.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onKeyDown);
  }

  return { start, isComplete, markComplete, finish };
})();
