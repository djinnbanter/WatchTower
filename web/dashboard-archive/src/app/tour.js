/**
 * Spotlight tour — chrome cards, then one card per primary rail page.
 * Press Escape or click outside to skip.
 */

import { navigate } from './router.js';

const TOUR_KEY = 'wt.tourComplete';

/** @type {{ tab?: string, target: string, title: string, body: string, placement: string }[]} */
const STEPS = [
  {
    target: '[data-tour="rail"]',
    title: 'Navigation rail',
    body: 'Switch panels from the rail — use Collapse at the bottom to shrink it.',
    placement: 'right',
  },
  {
    target: '[data-tour="topbar"]',
    title: 'Top bar',
    body: 'Live/Offline and report freshness chips, Ctrl/Cmd+K search, and inbox live here.',
    placement: 'bottom',
  },
  {
    tab: 'overview',
    target: '[data-tour="overview"]',
    title: 'Overview',
    body: 'Welcome band, vitals, and a quick health summary before you dig into other tabs.',
    placement: 'bottom',
  },
  {
    tab: 'live',
    target: '[data-tour="live"]',
    title: 'Live',
    body: 'Real-time TPS, MSPT, CPU, and host charts for the window you pick.',
    placement: 'bottom',
  },
  {
    tab: 'session',
    target: '[data-tour="session"]',
    title: 'Session',
    body: 'See who is online and who has been here — roster, playtime chips, and copy UUID.',
    placement: 'bottom',
  },
  {
    tab: 'startup',
    target: '[data-tour="startup"]',
    title: 'Startup',
    body: 'Last boot duration, slowest phases, and boot warnings vs the previous restart.',
    placement: 'bottom',
  },
  {
    tab: 'insights',
    target: '[data-tour="insights"]',
    title: 'Insights',
    body: 'Patterns over time — schedule heatmaps, load tables, and week comparisons.',
    placement: 'bottom',
  },
  {
    tab: 'issues',
    target: '[data-tour="issues"]',
    title: 'Issues',
    body: 'Prioritized fix list from continuous Scanning plus peeks — mark items reviewed when done.',
    placement: 'bottom',
  },
  {
    tab: 'crashes',
    target: '[data-tour="crashes"]',
    title: 'Crashes',
    body: 'Grouped crash reports with numbered Do this now steps and Modrinth / Mods links.',
    placement: 'bottom',
  },
  {
    tab: 'logs',
    target: '[data-tour="logs"]',
    title: 'Logs',
    body: 'Browse server logs and crash report files without leaving the dashboard.',
    placement: 'bottom',
  },
  {
    tab: 'spark',
    target: '[data-tour="spark"]',
    title: 'Spark',
    body: 'Pick a saved Spark profile and read lag breakdown by mods, world, and methods.',
    placement: 'bottom',
  },
  {
    tab: 'mods',
    target: '[data-tour="mods"]',
    title: 'Mods',
    body: 'Mod inventory, updates with pack impact, conflicts, changes, and forensics.',
    placement: 'bottom',
  },
  {
    tab: 'backups',
    target: '[data-tour="backups"]',
    title: 'Backups',
    body: 'Point at backup folders or heartbeats — or choose Not tracking to silence alerts.',
    placement: 'bottom',
  },
  {
    tab: 'activity',
    target: '[data-tour="activity"]',
    title: 'Activity',
    body: 'Event timeline for joins, stops, crashes, and other lifecycle markers.',
    placement: 'bottom',
  },
  {
    tab: 'sources',
    target: '[data-tour="sources"]',
    title: 'Sources',
    body: 'Watching, Scanning, and Support compose — when each layer last updated and what it powers.',
    placement: 'bottom',
  },
  {
    tab: 'settings',
    target: '[data-tour="settings"]',
    title: 'Settings',
    body: 'Schedule (Off by default), monitoring, backups, security, Advanced support bundle, and About.',
    placement: 'bottom',
  },
  {
    tab: 'docs',
    target: '[data-tour="docs"]',
    title: 'Docs',
    body: 'Built-in operator wiki with search — reopen the setup wizard from here anytime.',
    placement: 'bottom',
  },
  {
    tab: 'roadmap',
    target: '[data-tour="roadmap"]',
    title: 'Roadmap',
    body: 'What works today, what’s coming next by situation, and what we’re not building — plain English.',
    placement: 'bottom',
  },
];

// ── Overlay state ─────────────────────────────────────────────────────────────

let _overlay = null;
let _step = 0;
let _keyHandler = null;
let _settleTimer = null;

function getTarget(selector) {
  return selector ? document.querySelector(selector) : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function positionTooltip(tooltipEl, targetRect, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 12;
  const tw = tooltipEl.offsetWidth || 280;
  const th = tooltipEl.offsetHeight || 120;

  let top, left;
  if (placement === 'right') {
    top = targetRect.top + (targetRect.height - th) / 2;
    left = targetRect.right + gap;
  } else if (placement === 'left') {
    top = targetRect.top + (targetRect.height - th) / 2;
    left = targetRect.left - tw - gap;
  } else if (placement === 'bottom') {
    top = targetRect.bottom + gap;
    left = targetRect.left + (targetRect.width - tw) / 2;
  } else {
    top = targetRect.top - th - gap;
    left = targetRect.left + (targetRect.width - tw) / 2;
  }

  top = clamp(top, 8, vh - th - 8);
  left = clamp(left, 8, vw - tw - 8);

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}

function waitForTarget(selector, attempts = 12) {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      const el = getTarget(selector);
      if (el || n >= attempts) {
        resolve(el);
        return;
      }
      n += 1;
      requestAnimationFrame(tick);
    };
    tick();
  });
}

async function renderStep() {
  if (!_overlay) return;
  const step = STEPS[_step];
  if (!step) { endTour(); return; }

  if (_settleTimer) {
    clearTimeout(_settleTimer);
    _settleTimer = null;
  }

  if (step.tab) {
    navigate(step.tab);
  }

  const targetEl = step.target
    ? await waitForTarget(step.target)
    : null;
  const targetRect = targetEl
    ? targetEl.getBoundingClientRect()
    : { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 };

  // Spotlight cutout
  const cutout = _overlay.querySelector('.tour-cutout');
  const padding = 6;
  if (targetEl && targetRect.width > 0) {
    cutout.style.display = 'block';
    cutout.style.top = `${targetRect.top - padding}px`;
    cutout.style.left = `${targetRect.left - padding}px`;
    cutout.style.width = `${targetRect.width + padding * 2}px`;
    cutout.style.height = `${targetRect.height + padding * 2}px`;
  } else {
    cutout.style.display = 'none';
  }

  // Tooltip
  const tooltip = _overlay.querySelector('.tour-tooltip');
  const titleEl = tooltip.querySelector('.tour-tooltip__title');
  const bodyEl = tooltip.querySelector('.tour-tooltip__body');
  const progressEl = tooltip.querySelector('.tour-tooltip__progress');
  const prevBtn = tooltip.querySelector('[data-tour-btn="prev"]');
  const nextBtn = tooltip.querySelector('[data-tour-btn="next"]');

  titleEl.textContent = step.title;
  bodyEl.textContent = step.body;
  progressEl.textContent = `${_step + 1} / ${STEPS.length}`;
  prevBtn.disabled = _step === 0;
  nextBtn.textContent = _step === STEPS.length - 1 ? 'Finish' : 'Next →';

  if (targetEl) targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  requestAnimationFrame(() => positionTooltip(tooltip, targetRect, step.placement));

  // Re-measure after layout settle (nav + page paint)
  _settleTimer = setTimeout(async () => {
    if (!_overlay || STEPS[_step] !== step) return;
    const el = getTarget(step.target);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cut = _overlay.querySelector('.tour-cutout');
    const tip = _overlay.querySelector('.tour-tooltip');
    if (rect.width > 0) {
      cut.style.display = 'block';
      cut.style.top = `${rect.top - padding}px`;
      cut.style.left = `${rect.left - padding}px`;
      cut.style.width = `${rect.width + padding * 2}px`;
      cut.style.height = `${rect.height + padding * 2}px`;
      positionTooltip(tip, rect, step.placement);
    }
  }, 80);
}

function endTour() {
  if (_settleTimer) {
    clearTimeout(_settleTimer);
    _settleTimer = null;
  }
  if (_overlay) {
    _overlay.remove();
    _overlay = null;
  }
  if (_keyHandler) {
    window.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
}

/** Start (or restart) the tour from step 0. */
export function startTour() {
  endTour();
  _step = 0;

  const el = document.createElement('div');
  el.className = 'tour-overlay';
  el.innerHTML = `
    <div class="tour-scrim"></div>
    <div class="tour-cutout"></div>
    <div class="tour-tooltip">
      <button class="tour-tooltip__skip" aria-label="Skip tour">Skip</button>
      <div class="tour-tooltip__title"></div>
      <div class="tour-tooltip__body"></div>
      <div class="tour-tooltip__footer">
        <span class="tour-tooltip__progress"></span>
        <div class="tour-tooltip__btns">
          <button data-tour-btn="prev">← Back</button>
          <button data-tour-btn="next">Next →</button>
        </div>
      </div>
    </div>
  `;

  el.querySelector('.tour-scrim').addEventListener('click', endTour);
  el.querySelector('.tour-tooltip__skip').addEventListener('click', endTour);
  el.querySelector('[data-tour-btn="prev"]').addEventListener('click', () => {
    _step = Math.max(0, _step - 1);
    renderStep();
  });
  el.querySelector('[data-tour-btn="next"]').addEventListener('click', () => {
    if (_step >= STEPS.length - 1) { endTour(); return; }
    _step++;
    renderStep();
  });

  _keyHandler = (e) => {
    if (e.key === 'Escape') endTour();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      _step = Math.min(_step + 1, STEPS.length - 1);
      renderStep();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      _step = Math.max(_step - 1, 0);
      renderStep();
    }
  };
  window.addEventListener('keydown', _keyHandler);

  document.body.appendChild(el);
  _overlay = el;
  renderStep();
}

/** Returns true if the tour has been completed before. */
export function isTourComplete() {
  try { return !!localStorage.getItem(TOUR_KEY); } catch { return false; }
}
