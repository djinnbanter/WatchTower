import { useState, useEffect, useRef } from '../lib/preact.js';
import { Motion } from './reduced.js';
import { DUR } from './tokens.js';

/** Match CSS stagger: `--ui-stagger-index * 60ms` + page-child enter duration. */
const STAGGER_STEP_MS = 60;

/**
 * Mount-once enter → settled contract.
 * CSS should only run enter animations while `data-motion="entering"`.
 * Poll re-renders stay settled and never re-trigger page enter.
 *
 * @param {{ childCount?: number, staggerMs?: number, durationMs?: number }} [opts]
 * @returns {{ motion: 'entering' | 'settled', ref: import('../lib/preact.js').Ref }}
 */
export function useMountEnter({
  childCount = 5,
  staggerMs = STAGGER_STEP_MS,
  durationMs = DUR[4],
} = {}) {
  const ref = useRef(null);
  const [motion, setMotion] = useState(() => (Motion.enabled ? 'entering' : 'settled'));

  useEffect(() => {
    if (!Motion.enabled) {
      setMotion('settled');
      return undefined;
    }
    setMotion('entering');
    const n = Math.max(1, childCount);
    const wait = (n - 1) * staggerMs + durationMs + 48;
    const t = setTimeout(() => setMotion('settled'), wait);
    return () => clearTimeout(t);
    // Mount-once only — childCount is a hint for settle timing on first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { motion, ref };
}

/**
 * Re-run enter → settled whenever `resetKey` changes (tab switch, filter, etc.).
 *
 * @param {string | number} resetKey
 * @param {{ childCount?: number, staggerMs?: number, durationMs?: number }} [opts]
 * @returns {'entering' | 'settled'}
 */
export function useStaggerPhase(resetKey, {
  childCount = 8,
  staggerMs = 28,
  durationMs = DUR[3],
} = {}) {
  const [motion, setMotion] = useState(() => (Motion.enabled ? 'entering' : 'settled'));

  useEffect(() => {
    if (!Motion.enabled) {
      setMotion('settled');
      return undefined;
    }
    setMotion('entering');
    const n = Math.max(1, Math.min(childCount, 16));
    const wait = (n - 1) * staggerMs + durationMs + 40;
    const t = setTimeout(() => setMotion('settled'), wait);
    return () => clearTimeout(t);
  }, [resetKey, childCount, staggerMs, durationMs]);

  return motion;
}

/**
 * Settle delay helper for non-hook callers (e.g. outlet wrappers).
 */
export function mountEnterDuration(childCount = 5, staggerMs = STAGGER_STEP_MS, durationMs = DUR[4]) {
  const n = Math.max(1, childCount);
  return (n - 1) * staggerMs + durationMs + 48;
}
