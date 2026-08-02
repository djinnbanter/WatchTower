import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  TIMEZONE_STORAGE_KEY,
  browserTimeZone,
  formatInTimeZone,
  parseTimezonePreference,
  resolveTimeZone,
} from '@/lib/datetime';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe accessors for loosely-typed API payloads (Record<string, unknown>). */
export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/** PNG data URL from `/api/auth/totp/setup` (`qr_data_url`; legacy `qr_image_url` accepted). */
export function totpQrSrc(data: Record<string, unknown> | null | undefined): string {
  if (!data) return '';
  return str(data.qr_data_url) || str(data.qr_image_url);
}

export function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function get(o: unknown, ...path: Array<string | number>): unknown {
  let cur: unknown = o;
  for (const key of path) {
    if (cur == null) return undefined;
    if (typeof key === 'number') {
      cur = asArray(cur)[key];
    } else {
      cur = asRecord(cur)[key];
    }
  }
  return cur;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const sec = Math.round((Date.now() - t) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(-sec, 'second');
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute');
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 48) return rtf.format(-hr, 'hour');
  const day = Math.round(hr / 24);
  return rtf.format(-day, 'day');
}

function storedTimeZone(): string {
  try {
    if (typeof localStorage === 'undefined') return browserTimeZone();
    return resolveTimeZone(parseTimezonePreference(localStorage.getItem(TIMEZONE_STORAGE_KEY)));
  } catch {
    return browserTimeZone();
  }
}

export function fmtDate(iso: string | null | undefined): string {
  return formatInTimeZone(iso, storedTimeZone(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

export function fmtClock(iso: string | null | undefined): string {
  return formatInTimeZone(iso, storedTimeZone(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Math.abs(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
