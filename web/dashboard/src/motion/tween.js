import { easeOutCubic } from './tokens.js';
import { Motion } from './reduced.js';

export function tweenNumber(from, to, durationMs, onUpdate, easing = easeOutCubic) {
  if (!Motion.enabled || from === to) {
    onUpdate(to);
    return () => {};
  }
  let raf;
  let start;
  const step = (ts) => {
    if (!start) start = ts;
    const t = Math.min(1, (ts - start) / durationMs);
    onUpdate(from + (to - from) * easing(t));
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
