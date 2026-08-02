/**
 * Display formatting utilities — pure functions, no imports.
 */

/**
 * Format TPS value: "20.0", "—" if null/NaN.
 */
export function formatTps(tps) {
  if (tps == null || isNaN(tps)) return '—';
  return Number(tps).toFixed(1);
}

/**
 * Format MSPT: "4.2 ms", "—" if null/NaN.
 */
export function formatMspt(mspt) {
  if (mspt == null || isNaN(mspt)) return '—';
  return `${Number(mspt).toFixed(1)} ms`;
}

/**
 * Format percentage: "42%", "—" if null/NaN.
 * @param {number} pct   Value in 0–100 range.
 * @param {number} [decimals=0]
 */
export function formatPct(pct, decimals = 0) {
  if (pct == null || isNaN(pct)) return '—';
  return `${Number(pct).toFixed(decimals)}%`;
}

/**
 * Format gigabytes: "4.2 GB", "—" if null/NaN.
 */
export function formatGb(gb, decimals = 1) {
  if (gb == null || isNaN(gb)) return '—';
  return `${Number(gb).toFixed(decimals)} GB`;
}

/**
 * Format megabytes as "512 MB" or "1.2 GB" if >= 1024.
 */
export function formatMb(mb, decimals = 1) {
  if (mb == null || isNaN(mb)) return '—';
  const n = Number(mb);
  if (n >= 1024) return `${(n / 1024).toFixed(decimals)} GB`;
  return `${Math.round(n)} MB`;
}

/**
 * Format a plain number with thousands separators.
 */
export function formatNumber(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString();
}

/**
 * Format an uptime-style duration in seconds.
 * e.g. 90 → "1m 30s", 7200 → "2h", 90061 → "1d 1h"
 */
export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '—';
  const s = Math.floor(Number(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) {
    const rem = s % 60;
    return rem ? `${m}m ${rem}s` : `${m}m`;
  }
  const h = Math.floor(m / 60);
  if (h < 48) {
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h}h`;
  }
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return rem ? `${d}d ${rem}h` : `${d}d`;
}

/**
 * Format bytes as human-readable string:
 * < 1 KB → "N B", < 1 MB → "N KB", < 1 GB → "N MB", else "N GB".
 */
export function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '—';
  const n = Number(bytes);
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
