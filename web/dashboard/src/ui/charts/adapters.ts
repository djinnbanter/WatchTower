/**
 * Join fixture sample series `{ t, v }[]` into Bklit time-series rows `{ date, ...keys }`.
 *
 * Sparse series (thermal ~15s, IO ~30s) share the timestamp union with dense tick
 * metrics. Filling gaps with `0` made Live charts sawtooth to zero on every sparse
 * sample — use hold-last-value by default (Preact Live joined per-chart / kept nulls).
 */

export type SamplePoint = { t?: string; v?: number };
export type SampleSeriesMap = Record<string, SamplePoint[] | unknown>;

export type BklitRow = { date: Date } & Record<string, number | Date | null>;

export const LIVE_SERIES_KEYS = [
  'tps',
  'mspt',
  'host_cpu',
  'heap_mb',
  'mem_used_gb',
  'mem_available_gb',
  'mem_total_gb',
  'disk_use_pct',
  'players',
  'thermal_package',
  'thermal_ambient',
  'net_rx_mbps',
  'net_tx_mbps',
  'disk_read_mb_s',
  'disk_write_mb_s',
  'gc_pause_pct',
] as const;

/** @deprecated Prefer LIVE_SERIES_KEYS — kept for call sites that used the private name. */
const DEFAULT_KEYS = LIVE_SERIES_KEYS;

export type SampleJoinFill = 'hold' | 'null' | 'zero';

/**
 * Structural equality for Live chart rows. Compares timestamps plus every
 * series key so host/net/thermal tip updates are not mistaken for "unchanged"
 * when only vitals were checked.
 */
export function rowsVisuallyEqual<T extends { date: Date }>(
  a: T[],
  b: T[],
  keys: readonly string[] = LIVE_SERIES_KEYS,
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.date.getTime() !== right.date.getTime()) return false;
    for (const key of keys) {
      if ((left as Record<string, unknown>)[key] !== (right as Record<string, unknown>)[key]) {
        return false;
      }
    }
  }
  return true;
}

function asPoints(raw: unknown): SamplePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw as SamplePoint[];
}

function finiteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Keep settled Live history stable across polls.
 *
 * `/api/samples` index-strides when over max_points, so a full replace reshuffles
 * which timestamps appear even when the sliding xDomain is locked. Only append
 * (and refresh the tip); never rewrite older points from a later response.
 */
export function mergeStableTimeSeriesRows<T extends { date: Date }>(
  prev: T[],
  next: T[],
  opts?: {
    /** Drop points older than (tip − maxAgeMs). */
    maxAgeMs?: number;
    /** Hard cap on retained rows (keeps the newest). */
    maxPoints?: number;
  },
): T[] {
  if (prev.length === 0) return trimStableTimeSeriesRows(next, opts);
  if (next.length === 0) return prev;

  const lastPrevMs = prev[prev.length - 1]!.date.getTime();
  const lastNextMs = next[next.length - 1]!.date.getTime();
  // Stale / out-of-order payload — keep what we already rendered.
  if (lastNextMs < lastPrevMs) return prev;

  const out = prev.slice();
  for (const row of next) {
    const t = row.date.getTime();
    if (t < lastPrevMs) continue;
    if (t === lastPrevMs) {
      out[out.length - 1] = row;
      continue;
    }
    out.push(row);
  }
  return trimStableTimeSeriesRows(out, opts);
}

function trimStableTimeSeriesRows<T extends { date: Date }>(
  rows: T[],
  opts?: { maxAgeMs?: number; maxPoints?: number },
): T[] {
  if (rows.length === 0) return rows;
  let out = rows;
  const maxAgeMs = opts?.maxAgeMs;
  if (maxAgeMs != null && maxAgeMs > 0) {
    const tip = out[out.length - 1]!.date.getTime();
    const cutoff = tip - maxAgeMs;
    let lo = 0;
    while (lo < out.length && out[lo]!.date.getTime() < cutoff) lo += 1;
    if (lo > 0) out = out.slice(lo);
  }
  const maxPoints = opts?.maxPoints;
  if (maxPoints != null && maxPoints > 0 && out.length > maxPoints) {
    out = out.slice(out.length - maxPoints);
  }
  return out;
}

/** Join multiple sample arrays on timestamp into Bklit `{ date, ... }` rows. */
export function toBklitRows(
  samples: SampleSeriesMap,
  keys: readonly string[] = DEFAULT_KEYS,
  opts?: {
    take?: number;
    windowMs?: number;
    /** Gap policy. Default `hold` — never invent 0 for missing series at a timestamp. */
    fill?: SampleJoinFill;
  },
): BklitRow[] {
  const take = opts?.take ?? 240;
  const windowMs = opts?.windowMs;
  const fill: SampleJoinFill = opts?.fill ?? 'hold';

  const maps = new Map<string, Map<string, number>>();
  const times = new Set<string>();

  for (const key of keys) {
    const pts = asPoints(samples[key]);
    const m = new Map<string, number>();
    for (const p of pts) {
      if (!p?.t) continue;
      const n = finiteNumber(p.v);
      if (n == null) continue;
      m.set(p.t, n);
      times.add(p.t);
    }
    maps.set(key, m);
  }

  let timestamps = [...times].sort();
  if (windowMs != null && windowMs > 0 && timestamps.length) {
    const lastTs = Date.parse(timestamps[timestamps.length - 1]!);
    const cutoff = lastTs - windowMs;
    const filtered = timestamps.filter((t) => Date.parse(t) >= cutoff);
    if (filtered.length) timestamps = filtered;
  }
  if (timestamps.length > take) {
    timestamps = timestamps.slice(timestamps.length - take);
  }

  // Seed hold-last from samples before the visible window (latest value < first row).
  const last = new Map<string, number>();
  if (fill === 'hold' && timestamps.length) {
    const firstMs = Date.parse(timestamps[0]!);
    for (const key of keys) {
      const m = maps.get(key);
      if (!m) continue;
      let bestT = -Infinity;
      let bestV: number | undefined;
      for (const [t, v] of m) {
        const ms = Date.parse(t);
        if (ms < firstMs && ms >= bestT) {
          bestT = ms;
          bestV = v;
        }
      }
      if (bestV !== undefined) last.set(key, bestV);
    }
  }

  return timestamps.map((t) => {
    const row: BklitRow = { date: new Date(t) };
    for (const key of keys) {
      const hit = maps.get(key)?.get(t);
      if (hit !== undefined) {
        last.set(key, hit);
        row[key] = hit;
      } else if (fill === 'hold' && last.has(key)) {
        row[key] = last.get(key)!;
      } else if (fill === 'zero') {
        row[key] = 0;
      } else {
        row[key] = null;
      }
    }
    return row;
  });
}

/** Single series → LiveLineChart points `{ time: unixSec, value }`. */
export function toLiveLinePoints(
  raw: unknown,
  opts?: { take?: number; windowMs?: number },
): { time: number; value: number }[] {
  const take = opts?.take ?? 120;
  let pts = asPoints(raw)
    .filter((p) => p?.t)
    .map((p) => {
      const value = finiteNumber(p.v);
      return value == null
        ? null
        : { time: Date.parse(String(p.t)) / 1000, value };
    })
    .filter((p): p is { time: number; value: number } => p != null && Number.isFinite(p.time));

  if (opts?.windowMs && pts.length) {
    const last = pts[pts.length - 1]!.time * 1000;
    const cutoff = last - opts.windowMs;
    const filtered = pts.filter((p) => p.time * 1000 >= cutoff);
    if (filtered.length) pts = filtered;
  }
  if (pts.length > take) pts = pts.slice(pts.length - take);
  return pts;
}

export function windowToMs(window: string): number {
  const map: Record<string, number> = {
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '1h': 60 * 60_000,
    '3h': 3 * 60 * 60_000,
    '6h': 6 * 60 * 60_000,
    '12h': 12 * 60 * 60_000,
    '24h': 24 * 60 * 60_000,
    '7d': 7 * 24 * 60 * 60_000,
    '30d': 30 * 24 * 60 * 60_000,
  };
  return map[window] ?? map['1h']!;
}

/** Window label → minutes for `/api/samples?minutes=`. */
export function windowToMinutes(window: string): number {
  return Math.max(1, Math.round(windowToMs(window) / 60_000));
}

/** Short windows use streaming LiveLine charts; longer windows stay historical. */
export function isLiveWindow(window: string): boolean {
  return window === '5m' || window === '15m' || window === '1h';
}

/** Daily rollup / dashboard arrays → Bklit rows using `day` or `t` as date. */
export function dailyToBklitRows(
  rows: Record<string, unknown>[],
  valueKeys: string[],
): BklitRow[] {
  return rows
    .map((r) => {
      const raw = r.day ?? r.t ?? r.date ?? r.ts;
      if (raw == null) return null;
      const date = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(date.getTime())) return null;
      const out: BklitRow = { date };
      for (const k of valueKeys) {
        out[k] = Number(r[k]) || 0;
      }
      return out;
    })
    .filter((r): r is BklitRow => r != null);
}
