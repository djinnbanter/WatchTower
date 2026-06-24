/**
 * Watchtower motion controller — tab fade, section enter, ack flash, badge pop.
 */
const WatchtowerMotion = (function () {
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function tabEnter(mainEl) {
    if (!mainEl || prefersReducedMotion()) return;
    mainEl.classList.remove('wt-tab-enter');
    void mainEl.offsetWidth;
    mainEl.classList.add('wt-tab-enter');
  }

  function sectionEnter(root) {
    if (!root || prefersReducedMotion()) return;
    root.querySelectorAll('.wt-section.wt-enter-pending').forEach((el, i) => {
      el.classList.remove('wt-enter-pending');
      el.style.animationDelay = `${Math.min(i * 30, 90)}ms`;
      el.classList.add('wt-enter');
    });
  }

  function ackRowFlash(row) {
    if (!row || prefersReducedMotion()) return;
    row.classList.remove('wt-row-ack-flash');
    void row.offsetWidth;
    row.classList.add('wt-row-ack-flash');
    setTimeout(() => row.classList.remove('wt-row-ack-flash'), 220);
  }

  function badgePop(badge) {
    if (!badge || prefersReducedMotion()) return;
    badge.classList.remove('wt-rail__badge--bounce');
    void badge.offsetWidth;
    badge.classList.add('wt-rail__badge--bounce');
  }

  function beaconPulseOnce(dot) {
    if (!dot || prefersReducedMotion()) return;
    dot.classList.remove('beacon-dot--pulse-once');
    void dot.offsetWidth;
    dot.classList.add('beacon-dot--pulse-once');
    setTimeout(() => dot.classList.remove('beacon-dot--pulse-once'), 2600);
  }

  function chartReady(wrap) {
    if (!wrap) return;
    wrap.classList.remove('is-loading');
    wrap.classList.add('is-ready');
  }

  function chartLoading(wrap) {
    if (!wrap) return;
    wrap.classList.add('is-loading');
    wrap.classList.remove('is-ready');
  }

  return {
    tabEnter,
    sectionEnter,
    ackRowFlash,
    badgePop,
    beaconPulseOnce,
    chartReady,
    chartLoading,
    prefersReducedMotion,
  };
})();

if (typeof window !== 'undefined') {
  window.WatchtowerMotion = WatchtowerMotion;
}
