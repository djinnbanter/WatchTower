/** Dashboard timezone helpers (1.1.6). Backend timestamps stay UTC; UI converts for display. */

export type TimezoneMode = 'browser' | 'utc' | 'iana';

export type TimezonePreference = {
  mode: TimezoneMode;
  /** IANA zone when mode is `iana`; ignored for browser/utc. */
  zone?: string;
};

export const TIMEZONE_STORAGE_KEY = 'wt-timezone';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Returns true when `zone` is a usable IANA timezone id. */
export function isValidTimeZone(zone: string | null | undefined): boolean {
  if (!zone || typeof zone !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(pref: TimezonePreference | null | undefined): string {
  const mode = pref?.mode ?? 'browser';
  if (mode === 'utc') return 'UTC';
  if (mode === 'iana') {
    const zone = pref?.zone?.trim() ?? '';
    if (isValidTimeZone(zone)) return zone;
    return browserTimeZone();
  }
  return browserTimeZone();
}

/** Offset of `timeZone` at `at`, in minutes east of UTC (Date.getTimezoneOffset sign flipped). */
export function getOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * Map a canonical UTC schedule cell to local day/hour using the zone's offset at `now`.
 * Does not mutate the source cell.
 */
export function utcCellToLocal(
  dowUtc: number,
  hourUtc: number,
  timeZone: string,
  now: Date = new Date(),
): { dow: number; hour: number } {
  const offsetMin = getOffsetMinutes(timeZone, now);
  let localMinutes = dowUtc * 1440 + hourUtc * 60 + offsetMin;
  // Normalize into [0, 7*1440)
  const week = 7 * 1440;
  localMinutes = ((localMinutes % week) + week) % week;
  const dow = Math.floor(localMinutes / 1440);
  const hour = Math.floor((localMinutes % 1440) / 60);
  return { dow, hour };
}

/** Reindex UTC hour_of_week cells into local dow/hour buckets (weighted averages). */
export function localizeHourOfWeekCells(
  cells: Array<Record<string, unknown>>,
  timeZone: string,
  now: Date = new Date(),
): Array<Record<string, unknown>> {
  type Acc = {
    dow: number;
    hour: number;
    sample_minutes: number;
    playersSum: number;
    msptSum: number;
    tpsSum: number;
    msptW: number;
    tpsW: number;
    playersW: number;
  };
  const map = new Map<string, Acc>();

  for (const cell of cells) {
    const dowUtc = Number(cell.dow);
    const hourUtc = Number(cell.hour_utc);
    if (!Number.isFinite(dowUtc) || !Number.isFinite(hourUtc)) continue;
    const local = utcCellToLocal(dowUtc, hourUtc, timeZone, now);
    const key = `${local.dow}:${local.hour}`;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        dow: local.dow,
        hour: local.hour,
        sample_minutes: 0,
        playersSum: 0,
        msptSum: 0,
        tpsSum: 0,
        msptW: 0,
        tpsW: 0,
        playersW: 0,
      };
      map.set(key, acc);
    }
    const w = Math.max(0, Number(cell.sample_minutes) || 0);
    acc.sample_minutes += w;
    if (cell.avg_players != null && Number.isFinite(Number(cell.avg_players))) {
      acc.playersSum += Number(cell.avg_players) * Math.max(1, w);
      acc.playersW += Math.max(1, w);
    }
    if (cell.avg_mspt != null && Number.isFinite(Number(cell.avg_mspt))) {
      acc.msptSum += Number(cell.avg_mspt) * Math.max(1, w);
      acc.msptW += Math.max(1, w);
    }
    if (cell.avg_tps != null && Number.isFinite(Number(cell.avg_tps))) {
      acc.tpsSum += Number(cell.avg_tps) * Math.max(1, w);
      acc.tpsW += Math.max(1, w);
    }
  }

  const out: Array<Record<string, unknown>> = [];
  for (const acc of map.values()) {
    const row: Record<string, unknown> = {
      dow: acc.dow,
      hour_utc: acc.hour, // local hour stored under hour_utc for heatmap consumers
      sample_minutes: acc.sample_minutes,
      label: `${DAY_LABELS[acc.dow] ?? '?'} ${String(acc.hour).padStart(2, '0')}:00`,
    };
    if (acc.playersW > 0) row.avg_players = acc.playersSum / acc.playersW;
    if (acc.msptW > 0) row.avg_mspt = acc.msptSum / acc.msptW;
    if (acc.tpsW > 0) row.avg_tps = acc.tpsSum / acc.tpsW;
    out.push(row);
  }
  return out;
}

/** Localize busy/quiet hour rows (hour_utc → local hour label). */
export function localizeHourRows(
  rows: Array<Record<string, unknown>>,
  timeZone: string,
  now: Date = new Date(),
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const hourUtc = Number(row.hour_utc);
    const dowUtc = row.dow != null ? Number(row.dow) : 0;
    if (!Number.isFinite(hourUtc)) return { ...row };
    const local = utcCellToLocal(Number.isFinite(dowUtc) ? dowUtc : 0, hourUtc, timeZone, now);
    return {
      ...row,
      hour_utc: local.hour,
      dow: local.dow,
      label: `${DAY_LABELS[local.dow] ?? '?'} ${String(local.hour).padStart(2, '0')}:00`,
    };
  });
}

export function formatInTimeZone(
  iso: string | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      ...options,
    }).format(d);
  } catch {
    return '—';
  }
}

/** Format a quiet window as a localized range, e.g. "Wed 03:00–05:00". */
export function formatInstantRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  timeZone: string,
): string {
  if (!startIso || !endIso) return '—';
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';

  const fmtParts = (d: Date) => {
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = dtf.formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return {
      weekday: get('weekday'),
      day: get('day'),
      month: get('month'),
      hour: get('hour'),
      minute: get('minute'),
    };
  };

  const a = fmtParts(start);
  const b = fmtParts(end);
  const startLabel = `${a.weekday} ${a.hour}:${a.minute}`;
  const sameDay = a.day === b.day && a.month === b.month && a.weekday === b.weekday;
  const endLabel = sameDay ? `${b.hour}:${b.minute}` : `${b.weekday} ${b.hour}:${b.minute}`;
  return `${startLabel}–${endLabel}`;
}

export function parseTimezonePreference(raw: string | null): TimezonePreference {
  if (!raw) return { mode: 'browser' };
  try {
    const parsed = JSON.parse(raw) as Partial<TimezonePreference>;
    if (parsed.mode === 'utc') return { mode: 'utc' };
    if (parsed.mode === 'iana') {
      const zone = typeof parsed.zone === 'string' ? parsed.zone : '';
      if (isValidTimeZone(zone)) return { mode: 'iana', zone };
      return { mode: 'browser' };
    }
    if (parsed.mode === 'browser') return { mode: 'browser' };
  } catch {
    // corrupt storage
  }
  return { mode: 'browser' };
}

export function listTimeZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === 'function') {
      return intl.supportedValuesOf('timeZone');
    }
  } catch {
    // fall through
  }
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ];
}
