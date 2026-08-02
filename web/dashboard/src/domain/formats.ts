export function formatTps(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toFixed(1);
}

export function formatMs(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)} ms`;
}

export function formatPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${Math.round(v)}%`;
}

export function formatGb(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)} GB`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
