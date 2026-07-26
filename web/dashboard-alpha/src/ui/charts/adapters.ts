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

const DEFAULT_KEYS = [
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

export type SampleJoinFill = 'hold' | 'null' | 'zero';

function asPoints(raw: unknown): SamplePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw as SamplePoint[];
}

function finiteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
