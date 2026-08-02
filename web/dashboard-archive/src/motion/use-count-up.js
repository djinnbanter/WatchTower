import { useState, useEffect, useRef } from '../lib/preact.js';
import { tweenNumber } from './tween.js';
import { DUR } from './tokens.js';
import { Motion } from './reduced.js';

function toFinite(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Shared rAF count-up/down toward `value`.
 * - On mount (motion on): starts at 0 and counts to `value`
 * - On change: tweens from the currently displayed number
 * - Reduced motion / null: snaps
 *
 * @param {number | null | undefined} value
 * @param {{ duration?: number }} [opts]
 */
export function useCountUp(value, { duration = DUR[5] } = {}) {
  const target = toFinite(value);
  const [display, setDisplay] = useState(() => {
    if (target == null) return null;
    return Motion.enabled ? 0 : target;
  });
  const displayRef = useRef(display);

  useEffect(() => {
    if (target == null) {
      displayRef.current = null;
      setDisplay(null);
      return undefined;
    }

    const from =
      displayRef.current == null || !Number.isFinite(Number(displayRef.current))
        ? (Motion.enabled ? 0 : target)
        : Number(displayRef.current);

    // Sync start frame immediately (avoid a blank/— flash before first rAF)
    if (displayRef.current !== from) {
      displayRef.current = from;
      setDisplay(from);
    }

    if (from === target) {
      displayRef.current = target;
      setDisplay(target);
      return undefined;
    }

    const cancel = tweenNumber(from, target, duration, (v) => {
      displayRef.current = v;
      setDisplay(v);
    });
    return cancel;
  }, [target, duration]);

  return display;
}
