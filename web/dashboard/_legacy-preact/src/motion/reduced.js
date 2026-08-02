const mq =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener() {} };

export const Motion = {
  get enabled() {
    return !mq.matches;
  },
  subscribe(fn) {
    const handler = () => fn(Motion.enabled);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  },
};
