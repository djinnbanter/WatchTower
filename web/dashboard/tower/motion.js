/**
 * Watchtower UI v3 — motion orchestrator
 */
const TowerMotion = (function () {
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function canvasEnter(canvasEl) {
    if (!canvasEl || prefersReducedMotion()) return;
    canvasEl.classList.remove('wt-canvas-fade');
    void canvasEl.offsetWidth;
    canvasEl.classList.add('wt-canvas-fade');
  }

  function staggerEnter(root) {
    if (!root || prefersReducedMotion()) return;
    const items = root.querySelectorAll('.wt-stagger > *');
    items.forEach((el, i) => {
      // The CSS stagger system handles the animation via CSS variables
      el.style.setProperty('--wt-stagger-index', i);
    });
  }

  let scrollRevealHandler = null;

  function onScrollRevealVisible(handler) {
    scrollRevealHandler = typeof handler === 'function' ? handler : null;
  }

  function fireScrollRevealVisible(el) {
    if (scrollRevealHandler) scrollRevealHandler(el);
    else defaultScrollRevealVisible(el);
  }

  function getScrollRoot() {
    return document.getElementById('main-scroll-area');
  }

  function defaultScrollRevealVisible(el) {
    const widthBars = [...el.querySelectorAll('[data-bar-width]')].filter((b) => b.dataset.barAnimated !== '1');
    const heightFills = [...el.querySelectorAll('[data-bar-height]')].filter((f) => f.dataset.barAnimated !== '1');

    if (widthBars.length) {
      widthBars.forEach((bar) => {
        bar.dataset.barAnimated = '1';
        const target = Math.min(100, Math.max(0, parseFloat(bar.dataset.barWidth) || 0));
        bar.classList.add('wt-bar-grow-pending');
        bar.style.width = '0%';
        bar.dataset.barTarget = String(target);
      });
      requestAnimationFrame(() => {
        widthBars.forEach((bar) => {
          bar.classList.remove('wt-bar-grow-pending');
          bar.style.width = `${bar.dataset.barTarget}%`;
        });
      });
    }

    if (heightFills.length) {
      heightFills.forEach((fill) => {
        fill.dataset.barAnimated = '1';
        fill.classList.add('wt-bar-height-pending');
        fill.style.transform = 'scaleY(0)';
      });
      requestAnimationFrame(() => {
        heightFills.forEach((fill) => {
          fill.classList.remove('wt-bar-height-pending');
          fill.style.transform = 'scaleY(1)';
        });
      });
    }

    const heat = el.querySelector('.wt-perf-heat') || (el.classList.contains('wt-perf-heat') ? el : null);
    if (heat) animateHeatmapCells(heat);
  }

  function revealScrollTarget(el, observer) {
    if (el.dataset.motionRevealed === '1') {
      observer?.unobserve(el);
      return;
    }
    el.dataset.motionRevealed = '1';
    el.classList.add('is-visible');
    fireScrollRevealVisible(el);
    observer?.unobserve(el);
  }

  function scrollReveal(root, selector = '.wt-scroll-reveal') {
    if (!root) return null;
    const targets = [...root.querySelectorAll(selector)].filter((el) => el.dataset.motionRevealed !== '1');
    if (!targets.length) return null;

    if (prefersReducedMotion()) {
      targets.forEach((el) => revealScrollTarget(el));
      return null;
    }

    const scrollRoot = getScrollRoot();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealScrollTarget(entry.target, observer);
      });
    }, {
      threshold: 0.08,
      root: scrollRoot,
      rootMargin: '0px 0px -24px 0px',
    });

    targets.forEach((el) => observer.observe(el));
    return observer;
  }

  function intersectionReveal(root, selector = '.wt-timeline-item') {
    if (!root) return;
    scrollReveal(root, selector);
  }

  function cardReveal(cards) {
    if (!cards || prefersReducedMotion()) return;
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'none';
      
      setTimeout(() => {
        card.style.transition = 'opacity 300ms var(--wt-ease-spring), transform 300ms var(--wt-ease-spring)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 50 + (i * 60));
    });
  }

  function countUp(element, target, duration = 1500) {
    if (!element) return;
    if (prefersReducedMotion()) {
      element.textContent = target;
      return;
    }
    // Set CSS var for @property animation
    element.style.setProperty('--target-num', target);
    element.classList.remove('wt-signal__value--animate');
    void element.offsetWidth; // trigger reflow
    element.classList.add('wt-signal__value--animate');
  }

  function tabTransition(container, renderFn) {
    if (!container) return;
    if (prefersReducedMotion()) {
      renderFn();
      return;
    }
    
    // Cross-fade out
    container.style.transition = 'opacity 150ms var(--wt-ease-out)';
    container.style.opacity = '0';
    
    setTimeout(() => {
      renderFn();
      // Reset opacity before stagger handles the entrance
      container.style.opacity = '1';
      container.style.transition = 'none';
      staggerEnter(container);
    }, 150);
  }

  function healthGlow(element, grade) {
    if (!element) return;
    element.classList.remove('wt-glow-healthy', 'wt-glow-warning', 'wt-glow-danger');
    if (grade === 'A' || grade === 'B') element.classList.add('wt-glow-healthy');
    else if (grade === 'C' || grade === 'D') element.classList.add('wt-glow-warning');
    else if (grade === 'F') element.classList.add('wt-glow-danger');
  }

  function ackRowFlash(row) {
    if (!row || prefersReducedMotion()) return;
    row.classList.remove('is-acked');
    void row.offsetWidth;
    row.classList.add('is-acked');
  }

  function badgePop(badge) {
    if (!badge || prefersReducedMotion()) return;
    badge.classList.remove('wt-rail__badge--bounce');
    void badge.offsetWidth;
    badge.classList.add('wt-rail__badge--bounce');
  }

  function beaconPulse(dot) {
    if (!dot || prefersReducedMotion()) return;
    dot.classList.add('wt-pulse-glow');
  }

  function chartReady(wrap) {
    if (wrap) wrap.classList.remove('is-loading');
  }

  function chartLoading(wrap) {
    if (wrap) wrap.classList.add('is-loading');
  }

  function btnLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('wt-btn--loading', !!loading);
    btn.disabled = !!loading;
  }

  function valueFlash(el, tone) {
    if (!el || prefersReducedMotion()) return;
    const tones = ['wt-value-flash', 'wt-value-flash--warn', 'wt-value-flash--critical'];
    el.classList.remove(...tones);
    void el.offsetWidth;
    if (tone === 'warn') el.classList.add('wt-value-flash--warn');
    else if (tone === 'critical') el.classList.add('wt-value-flash--critical');
    else el.classList.add('wt-value-flash');
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateValue({ from, to, duration = 1000, onUpdate, onComplete }) {
    if (onUpdate == null) return;
    if (prefersReducedMotion()) {
      onUpdate(to);
      onComplete?.();
      return;
    }
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      onUpdate(from + (to - from) * easeOutCubic(t));
      if (t < 1) requestAnimationFrame(frame);
      else onComplete?.();
    }
    requestAnimationFrame(frame);
  }

  function animateKpiHtml(elId, target, opts = {}) {
    const {
      decimals = 0,
      unit = '',
      unitClass = 'wt-kpi__unit',
      duration = 1000,
    } = opts;
    const el = document.getElementById(elId);
    if (!el) return;
    const to = Number(target);
    if (Number.isNaN(to)) return;
    animateValue({
      from: 0,
      to,
      duration,
      onUpdate: (v) => {
        const text = decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
        el.innerHTML = unit
          ? `${text}<span class="${unitClass}">${unit}</span>`
          : text;
      },
    });
  }

  function animateChunksStat(elId, chunks, total, duration = 1000) {
    const el = document.getElementById(elId);
    if (!el) return;
    animateValue({
      from: 0,
      to: Number(chunks) || 0,
      duration,
      onUpdate: (v) => {
        const n = Math.round(v);
        el.innerHTML = total
          ? `${n.toLocaleString()}<span class="wt-overview-pregen__stat-sub"> / ${Number(total).toLocaleString()}</span>`
          : n.toLocaleString();
      },
    });
  }

  function animateProgressBar(barEl, targetPct, labelEl, duration = 1000) {
    const bar = typeof barEl === 'string' ? document.getElementById(barEl) : barEl;
    if (!bar) return;
    const fill = bar.querySelector('.wt-progress-bar__fill');
    const target = Math.min(100, Math.max(0, Number(targetPct) || 0));
    const label = typeof labelEl === 'string' ? document.getElementById(labelEl) : labelEl;

    if (prefersReducedMotion()) {
      bar.style.setProperty('--progress', target);
      if (label) label.textContent = `${Math.round(target)}%`;
      return;
    }

    fill?.classList.add('wt-progress-bar__fill--no-transition');
    bar.style.setProperty('--progress', 0);
    if (label) label.textContent = '0%';
    void bar.offsetWidth;
    fill?.classList.remove('wt-progress-bar__fill--no-transition');

    animateValue({
      from: 0,
      to: target,
      duration,
      onUpdate: (v) => {
        bar.style.setProperty('--progress', v);
        if (label) label.textContent = `${Math.round(v)}%`;
      },
      onComplete: () => {
        bar.style.setProperty('--progress', target);
        if (label) label.textContent = `${Math.round(target)}%`;
      },
    });
  }

  function animateKpiElement(el, target, opts = {}) {
    const {
      decimals = 0,
      unit = '',
      unitClass = 'wt-kpi__unit',
      duration = 1000,
      preserveHtml = false,
    } = opts;
    if (!el) return;
    const to = Number(target);
    if (Number.isNaN(to)) return;

    const unitNode = el.querySelector(`.${unitClass}`);
    const unitHtml = unitNode ? unitNode.outerHTML : (unit ? `<span class="${unitClass}">${unit}</span>` : '');
    const suffixHtml = preserveHtml && !unit ? el.innerHTML.replace(/^[\d.]+\s*/, '') : '';

    if (prefersReducedMotion()) {
      const text = decimals > 0 ? to.toFixed(decimals) : String(Math.round(to));
      el.innerHTML = unitHtml ? `${text}${unitHtml}` : (suffixHtml ? `${text}${suffixHtml}` : text);
      return;
    }

    animateValue({
      from: 0,
      to,
      duration,
      onUpdate: (v) => {
        const text = decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
        el.innerHTML = unitHtml ? `${text}${unitHtml}` : (suffixHtml ? `${text}${suffixHtml}` : text);
      },
    });
  }

  function animateBarWidth(barEl, targetPct) {
    const bar = typeof barEl === 'string' ? document.querySelector(barEl) : barEl;
    if (!bar || bar.dataset.barAnimated === '1') return;
    const target = Math.min(100, Math.max(0, Number(targetPct) || 0));
    bar.dataset.barAnimated = '1';

    if (prefersReducedMotion()) {
      bar.style.width = `${target}%`;
      bar.classList.remove('wt-bar-grow-pending');
      return;
    }

    bar.classList.add('wt-bar-grow-pending');
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      bar.classList.remove('wt-bar-grow-pending');
      bar.style.width = `${target}%`;
    });
  }

  function animateBarHeight(fillEl, targetPct) {
    const fill = typeof fillEl === 'string' ? document.querySelector(fillEl) : fillEl;
    if (!fill || fill.dataset.barAnimated === '1') return;
    const target = Math.min(100, Math.max(0, Number(targetPct) || 0));
    fill.style.height = `${target}%`;
    fill.dataset.barHeight = String(target);
    fill.dataset.barAnimated = '1';

    if (prefersReducedMotion()) {
      fill.style.transform = 'scaleY(1)';
      fill.classList.remove('wt-bar-height-pending');
      return;
    }

    fill.classList.add('wt-bar-height-pending');
    fill.style.transform = 'scaleY(0)';
    requestAnimationFrame(() => {
      fill.classList.remove('wt-bar-height-pending');
      fill.style.transform = 'scaleY(1)';
    });
  }

  function animateHeatmapCells(container) {
    if (!container || container.dataset.heatAnimated === '1') return;
    container.dataset.heatAnimated = '1';

    if (prefersReducedMotion()) {
      container.classList.add('is-heat-animated');
      return;
    }

    container.classList.add('is-heat-animated');

    const cells = container.querySelectorAll('.wt-perf-heat__cell:not(.wt-perf-heat__cell--empty)');
    let busiest = null;
    let busiestVal = -1;
    cells.forEach((cell) => {
      const raw = cell.querySelector('.wt-perf-heat__value')?.textContent?.trim();
      const n = raw && raw !== '—' ? parseFloat(raw) : 0;
      if (n > busiestVal) {
        busiestVal = n;
        busiest = cell;
      }
    });
    const rowCount = container.querySelectorAll('.wt-perf-heat__row:not(.wt-perf-heat__row--head)').length;
    if (busiest && busiestVal > 0) {
      setTimeout(() => busiest.classList.add('is-heat-busiest'), rowCount * 48 + 280);
    }
  }

  function animateOverviewUptime(elId, targetSec, duration = 1500) {
    const el = document.getElementById(elId);
    if (!el || typeof TowerRenderOverview === 'undefined') return;
    const to = Math.max(0, Math.floor(Number(targetSec) || 0));
    const render = (sec) => {
      el.innerHTML = TowerRenderOverview.renderOverviewUptimeHtml(sec);
    };
    animateValue({
      from: 0,
      to,
      duration,
      onUpdate: (v) => render(Math.floor(v)),
      onComplete: () => render(to),
    });
  }

  return {
    prefersReducedMotion,
    canvasEnter,
    staggerEnter,
    scrollReveal,
    intersectionReveal,
    onScrollRevealVisible,
    cardReveal,
    countUp,
    tabTransition,
    healthGlow,
    ackRowFlash,
    badgePop,
    beaconPulse,
    chartReady,
    chartLoading,
    btnLoading,
    valueFlash,
    animateValue,
    animateKpiHtml,
    animateKpiElement,
    animateProgressBar,
    animateBarWidth,
    animateBarHeight,
    animateHeatmapCells,
    animateChunksStat,
    animateOverviewUptime,
  };
})();

// Legacy alias for app.js ack flash paths
window.WatchtowerMotion = {
  prefersReducedMotion: () => TowerMotion.prefersReducedMotion(),
  tabEnter: (el) => TowerMotion.canvasEnter(el),
  sectionEnter: (root) => TowerMotion.staggerEnter(root),
  ackRowFlash: (row) => TowerMotion.ackRowFlash(row),
  badgePop: (badge) => TowerMotion.badgePop(badge),
  beaconPulseOnce: (dot) => TowerMotion.beaconPulse(dot),
  chartReady: (wrap) => TowerMotion.chartReady(wrap),
  chartLoading: (wrap) => TowerMotion.chartLoading(wrap),
  countUp: (el, t, d) => TowerMotion.countUp(el, t, d),
  intersectionReveal: (root) => TowerMotion.intersectionReveal(root),
  healthGlow: (el, g) => TowerMotion.healthGlow(el, g),
  valueFlash: (el, tone) => TowerMotion.valueFlash(el, tone),
};
