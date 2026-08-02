import type { LogEntry, LogLevel, VirtualLogItem } from './types';
import { ALL_LEVELS, PROBLEM_LEVELS } from './types';

const LEVELS = 'FATAL|ERROR|WARN|INFO|DEBUG|TRACE';

/** Vanilla: [HH:mm:ss] [Thread/LEVEL]: message */
const VANILLA_RE = new RegExp(
  `^\\[([^\\]]+)\\]\\s+\\[([^/\\]]+)/(${LEVELS})\\]:\\s?(.*)$`,
);

/** NeoForge: [ts] [Thread/LEVEL] [logger/]: message */
const NEOFORGE_RE = new RegExp(
  `^\\[([^\\]]+)\\]\\s+\\[([^/\\]]+)/(${LEVELS})\\]\\s+\\[([^\\]]+)/\\]:\\s?(.*)$`,
);

/** Loose header: any line with /LEVEL] that starts a new entry. */
const LOOSE_LEVEL_RE = new RegExp(`/(${LEVELS})\\]`);

/** Pull HH:mm from common Minecraft timestamps for grouping. */
const TIME_GROUP_RE = /(\d{1,2}:\d{2})(?::\d{2})?/;

function emptyCounts(): Record<LogLevel, number> {
  return {
    FATAL: 0,
    ERROR: 0,
    WARN: 0,
    INFO: 0,
    DEBUG: 0,
    TRACE: 0,
    UNKNOWN: 0,
  };
}

function asLevel(raw: string): LogLevel {
  const u = raw.toUpperCase();
  if (
    u === 'FATAL' ||
    u === 'ERROR' ||
    u === 'WARN' ||
    u === 'INFO' ||
    u === 'DEBUG' ||
    u === 'TRACE'
  ) {
    return u;
  }
  return 'UNKNOWN';
}

function pushEntry(
  entries: LogEntry[],
  counts: Record<LogLevel, number>,
  partial: Omit<LogEntry, 'id'>,
) {
  const entry: LogEntry = { ...partial, id: entries.length };
  entries.push(entry);
  counts[entry.level] += 1;
}

type HeaderMatch = {
  level: LogLevel;
  ts?: string;
  thread?: string;
  logger?: string;
  message: string;
};

function matchHeader(line: string): HeaderMatch | null {
  const neo = NEOFORGE_RE.exec(line);
  if (neo) {
    return {
      ts: neo[1],
      thread: neo[2],
      level: asLevel(neo[3]),
      logger: neo[4]?.replace(/\/$/, '') || neo[4],
      message: neo[5] ?? '',
    };
  }
  const van = VANILLA_RE.exec(line);
  if (van) {
    return {
      ts: van[1],
      thread: van[2],
      level: asLevel(van[3]),
      message: van[4] ?? '',
    };
  }
  const loose = LOOSE_LEVEL_RE.exec(line);
  if (loose && line.trimStart().startsWith('[')) {
    const level = asLevel(loose[1]);
    const colon = line.indexOf(']:');
    const message = colon >= 0 ? line.slice(colon + 2).trimStart() : line;
    return { level, message };
  }
  return null;
}

/**
 * Parse Minecraft / NeoForge log text into structured entries.
 * Continuation lines (stacks, etc.) attach until the next header.
 */
export function parseMcLog(text: string): {
  entries: LogEntry[];
  counts: Record<LogLevel, number>;
  lineCount: number;
} {
  const counts = emptyCounts();
  const entries: LogEntry[] = [];
  if (!text) {
    return { entries, counts, lineCount: 0 };
  }

  const rawLines = text.split(/\r?\n/);
  if (rawLines.length && rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }

  let current: Omit<LogEntry, 'id'> | null = null;

  const flush = () => {
    if (current) {
      pushEntry(entries, counts, current);
      current = null;
    }
  };

  for (const line of rawLines) {
    const header = matchHeader(line);
    if (header) {
      flush();
      current = {
        level: header.level,
        ts: header.ts,
        thread: header.thread,
        logger: header.logger,
        message: header.message,
        lines: [line],
      };
      continue;
    }
    if (current) {
      current.lines.push(line);
      continue;
    }
    current = {
      level: 'UNKNOWN',
      message: line,
      lines: [line],
    };
  }
  flush();

  return { entries, counts, lineCount: rawLines.length };
}

export function filterEntries(
  entries: LogEntry[],
  levels: ReadonlySet<LogLevel>,
  query: string,
): LogEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (!levels.has(e.level)) return false;
    if (!q) return true;
    return e.lines.join('\n').toLowerCase().includes(q);
  });
}

/** Newest-first display order (file parse order is oldest → newest). */
export function newestFirst(entries: LogEntry[]): LogEntry[] {
  return entries.slice().reverse();
}

export function groupKeyFromTs(ts: string | undefined): { key: string; label: string } {
  if (!ts?.trim()) {
    return { key: 'unknown', label: 'Unknown time' };
  }
  const m = TIME_GROUP_RE.exec(ts);
  if (!m) {
    return { key: ts.slice(0, 16), label: ts.slice(0, 24) };
  }
  const hm = m[1];
  const datePart = ts.slice(0, Math.max(0, ts.indexOf(hm))).trim();
  const label = datePart ? `${datePart} ${hm}` : hm;
  return { key: label, label };
}

/** Flatten newest-first entries into sticky header + entry virtual items. */
export function buildVirtualItems(entries: LogEntry[]): {
  items: VirtualLogItem[];
  stickyIndexes: number[];
} {
  const items: VirtualLogItem[] = [];
  const stickyIndexes: number[] = [];
  let currentKey = '';
  let headerIndex = -1;

  for (const entry of entries) {
    const { key, label } = groupKeyFromTs(entry.ts);
    if (key !== currentKey) {
      currentKey = key;
      headerIndex = items.length;
      stickyIndexes.push(headerIndex);
      items.push({ kind: 'header', key, label, count: 0 });
    }
    const header = items[headerIndex];
    if (header?.kind === 'header') header.count += 1;
    items.push({ kind: 'entry', entry });
  }

  return { items, stickyIndexes };
}

export function findProblemIndexes(items: VirtualLogItem[]): number[] {
  const problems = new Set<string>(PROBLEM_LEVELS);
  const out: number[] = [];
  items.forEach((item, i) => {
    if (item.kind === 'entry' && problems.has(item.entry.level)) out.push(i);
  });
  return out;
}

export function findMatchIndexes(items: VirtualLogItem[], query: string): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: number[] = [];
  items.forEach((item, i) => {
    if (item.kind === 'entry' && item.entry.lines.join('\n').toLowerCase().includes(q)) {
      out.push(i);
    }
  });
  return out;
}

export function levelsFromParam(raw: string | null | undefined): Set<LogLevel> {
  if (!raw || !raw.trim()) {
    return new Set<LogLevel>(['FATAL', 'ERROR', 'WARN']);
  }
  const next = new Set<LogLevel>();
  for (const part of raw.split(',')) {
    const p = part.trim().toUpperCase();
    if ((ALL_LEVELS as readonly string[]).includes(p)) {
      next.add(p as LogLevel);
    }
  }
  return next.size ? next : new Set<LogLevel>(['FATAL', 'ERROR', 'WARN']);
}

export function levelsToParam(levels: ReadonlySet<LogLevel>): string {
  return ALL_LEVELS.filter((l) => levels.has(l)).join(',');
}

export function isProblemsOnly(levels: ReadonlySet<LogLevel>): boolean {
  if (levels.size !== 3) return false;
  return levels.has('FATAL') && levels.has('ERROR') && levels.has('WARN');
}

export function isAllLevels(levels: ReadonlySet<LogLevel>): boolean {
  return ALL_LEVELS.every((l) => levels.has(l));
}

/** Highlight case-insensitive query matches inside text. */
export function highlightQuery(text: string, query: string): Array<{ t: string; hit: boolean }> {
  const q = query.trim();
  if (!q || !text) return [{ t: text, hit: false }];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: Array<{ t: string; hit: boolean }> = [];
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(needle, i);
    if (at < 0) {
      parts.push({ t: text.slice(i), hit: false });
      break;
    }
    if (at > i) parts.push({ t: text.slice(i, at), hit: false });
    parts.push({ t: text.slice(at, at + q.length), hit: true });
    i = at + q.length;
  }
  return parts.length ? parts : [{ t: text, hit: false }];
}
