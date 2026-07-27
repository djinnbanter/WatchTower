/** Preview screenshot capture helpers (README Visuals studio). */

const KEY = 'wt-capture';

export function isCaptureMode(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.wtCapture === '1') return true;
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setCaptureMode(on: boolean) {
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (on) document.documentElement.dataset.wtCapture = '1';
  else delete document.documentElement.dataset.wtCapture;
  window.dispatchEvent(new CustomEvent('wt:capture-change', { detail: { on } }));
}

/** Sync DOM from sessionStorage (call once when Visuals loads). */
export function syncCaptureModeFromStorage() {
  setCaptureMode(isCaptureMode());
}
