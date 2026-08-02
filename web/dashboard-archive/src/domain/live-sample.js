/**
 * Live sample helpers — empty API `latest: {}` must not count as data.
 */

/** True when `/api/live` latest has a real recorded sample (not an empty placeholder). */
export function hasLiveSample(latest) {
  if (latest == null || typeof latest !== 'object') return false;
  if (latest.polled_at != null && String(latest.polled_at).length > 0) return true;
  if (latest.tps != null && Number.isFinite(Number(latest.tps))) return true;
  if (latest.mspt != null && Number.isFinite(Number(latest.mspt))) return true;
  return false;
}

/** Normalize API latest — empty JsonObject becomes null. */
export function normalizeLiveLatest(latest) {
  return hasLiveSample(latest) ? latest : null;
}
