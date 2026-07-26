/**
 * Shared queue keyboard: `/` focus search, j/k move selection, `r` mark reviewed.
 * Skips when typing in inputs (except `/` when not focused in a field).
 * Callbacks/keys are read from refs so the window listener is not rebound every render.
 */
import { useEffect, useRef } from '../../lib/preact.js';
import { ui } from '../../state/stores.js';

function isEditableTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return !!el.isContentEditable;
}

/**
 * @param {{
 *   enabled?: boolean,
 *   searchRef: { current: HTMLInputElement | null },
 *   keys: string[],
 *   selectedKey: string | null,
 *   onSelect: (key: string) => void,
 *   onMarkReviewed?: (key: string) => void | Promise<void>,
 * }} opts
 */
export function useQueueKeyboard({
  enabled = true,
  searchRef,
  keys,
  selectedKey,
  onSelect,
  onMarkReviewed,
}) {
  const keysRef = useRef(keys);
  const selectedRef = useRef(selectedKey);
  const onSelectRef = useRef(onSelect);
  const onMarkRef = useRef(onMarkReviewed);
  keysRef.current = keys;
  selectedRef.current = selectedKey;
  onSelectRef.current = onSelect;
  onMarkRef.current = onMarkReviewed;

  useEffect(() => {
    if (!enabled) return undefined;

    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (ui.value?.modal) return;

      const editable = isEditableTarget(e.target);

      if (e.key === '/' && !editable) {
        e.preventDefault();
        searchRef.current?.focus?.();
        return;
      }

      if (editable) return;

      const list = keysRef.current || [];
      const selected = selectedRef.current;

      if ((e.key === 'j' || e.key === 'k') && list.length) {
        e.preventDefault();
        const idx = selected != null ? list.indexOf(selected) : -1;
        let next = idx;
        if (e.key === 'j') next = idx < 0 ? 0 : Math.min(list.length - 1, idx + 1);
        else next = idx < 0 ? 0 : Math.max(0, idx - 1);
        const key = list[next];
        if (key != null && key !== selected) onSelectRef.current?.(key);
        return;
      }

      if (e.key === 'r' && onMarkRef.current && selected) {
        e.preventDefault();
        onMarkRef.current(selected);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, searchRef]);
}

export default useQueueKeyboard;
