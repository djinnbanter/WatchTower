import { useEffect } from '../lib/preact.js';

/**
 * Tracks pointer position on `ref` element and sets --ui-mx / --ui-my (percent).
 */
export function usePointerGlow(ref) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return undefined;

    function onMove(e) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--ui-mx', `${mx}%`);
      el.style.setProperty('--ui-my', `${my}%`);
    }

    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [ref]);
}
