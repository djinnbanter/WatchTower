const PREFIX = 'wt.';

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * One-time migration of legacy localStorage keys to the wt.* namespace.
 * Safe to call multiple times — skips keys that were already migrated.
 */
export function migrateLegacy() {
  const DONE_KEY = PREFIX + '__migrated_v1';
  if (localStorage.getItem(DONE_KEY)) return;

  const migrations = [
    { from: 'watchtower-theme', to: 'theme' },
    { from: 'watchtower-poc-theme', to: 'theme' },
    { from: 'watchtower-setup-wizard-v1', to: 'setupWizard' },
    { from: 'watchtower-selected-report', to: 'selectedReport' },
    { from: 'watchtower-live-refresh-ms', to: 'liveRefreshMs' },
  ];

  for (const { from, to } of migrations) {
    const existing = localStorage.getItem(from);
    if (existing === null) continue;
    // Don't overwrite if the new key already has a value
    if (localStorage.getItem(PREFIX + to) === null) {
      try {
        // Values stored by legacy code are raw strings, not JSON
        // Wrap in JSON so get() can parse them
        localStorage.setItem(PREFIX + to, existing.startsWith('"') ? existing : JSON.stringify(existing));
      } catch {
        // ignore write failures
      }
    }
  }

  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // ignore
  }
}
