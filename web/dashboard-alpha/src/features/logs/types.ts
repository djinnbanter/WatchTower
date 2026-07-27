export type LogLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'UNKNOWN';

export type LogFile = {
  name: string;
  size: number;
  mtime: number;
  gz: boolean;
};

export type LogEntry = {
  /** Stable index in parse order (oldest → newest in file). */
  id: number;
  level: LogLevel;
  ts?: string;
  thread?: string;
  logger?: string;
  /** First-line body text. */
  message: string;
  /** Header + continuation lines (full raw block). */
  lines: string[];
};

export type VirtualLogItem =
  | { kind: 'header'; key: string; label: string; count: number }
  | { kind: 'entry'; entry: LogEntry };

export const PROBLEM_LEVELS: readonly LogLevel[] = ['FATAL', 'ERROR', 'WARN'];

export const ALL_LEVELS: readonly LogLevel[] = [
  'FATAL',
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG',
  'TRACE',
  'UNKNOWN',
];

export const TAIL_OPTS = [500, 2000, 5000, 10000] as const;
export type TailOpt = (typeof TAIL_OPTS)[number];
