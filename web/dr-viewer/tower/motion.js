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

  function intersectionReveal(root) {
    if (!root || prefersReducedMotion()) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    
    root.querySelectorAll('.wt-timeline-item').forEach(el => {
      observer.observe(el);
    });
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
    intersectionReveal,
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
