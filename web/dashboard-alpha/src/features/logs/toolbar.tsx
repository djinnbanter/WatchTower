import type { RefObject } from 'react';
import { Copy, Download, Search } from '@/ui/icons';
import { Button, StatusPill } from '@/ui/patterns';
import { fmtBytes } from '@/lib/utils';
import type { LogFile, LogLevel, TailOpt } from './types';
import { TAIL_OPTS } from './types';
import { isAllLevels, isProblemsOnly } from './parse-mc-log';

const CHIP_LEVELS: LogLevel[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

export function LogsToolbar({
  active,
  truncated,
  levels,
  counts,
  search,
  tail,
  statusLabel,
  matchCount,
  problemCount,
  searchInputRef,
  onToggleLevel,
  onShowAll,
  onShowProblems,
  onSearch,
  onTail,
  onCopyVisible,
  onDownload,
  onTop,
  onBottom,
  onNextProblem,
  onPrevProblem,
  onNextMatch,
  onPrevMatch,
}: {
  active: LogFile | null;
  truncated?: boolean;
  levels: ReadonlySet<LogLevel>;
  counts: Record<LogLevel, number>;
  search: string;
  tail: TailOpt;
  statusLabel: string;
  matchCount: number;
  problemCount: number;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onToggleLevel: (level: LogLevel) => void;
  onShowAll: () => void;
  onShowProblems: () => void;
  onSearch: (v: string) => void;
  onTail: (t: TailOpt) => void;
  onCopyVisible: () => void;
  onDownload: () => void;
  onTop: () => void;
  onBottom: () => void;
  onNextProblem: () => void;
  onPrevProblem: () => void;
  onNextMatch: () => void;
  onPrevMatch: () => void;
}) {
  const problems = isProblemsOnly(levels);
  const all = isAllLevels(levels);
  const hasQuery = search.trim().length > 0;

  return (
    <div className="lg-toolbar">
      <div className="lg-toolbar__row">
        <div className="lg-chips" role="group" aria-label="Severity filters">
          {CHIP_LEVELS.map((level) => {
            const on = levels.has(level);
            const n = counts[level] ?? 0;
            return (
              <button
                key={level}
                type="button"
                className={`lg-chip is-${level}${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => onToggleLevel(level)}
              >
                {level}
                <strong>{n}</strong>
              </button>
            );
          })}
        </div>
        <Button kind="ghost" onClick={all ? onShowProblems : onShowAll}>
          {all ? 'Problems only' : 'Show all levels'}
        </Button>
        {!problems && !all ? (
          <Button kind="ghost" onClick={onShowProblems}>
            Reset to problems
          </Button>
        ) : null}
      </div>

      <div className="lg-toolbar__row">
        <div className="lg-search">
          <Search size={14} />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search entries…  (/)"
            aria-label="Search log entries"
          />
        </div>
        <div className="lg-tail" role="group" aria-label="Tail size">
          {TAIL_OPTS.map((t) => (
            <button
              key={t}
              type="button"
              className={tail === t ? 'is-on' : undefined}
              onClick={() => onTail(t)}
            >
              {t >= 1000 ? `${t / 1000}k` : t}
            </button>
          ))}
        </div>
        {active ? (
          <div className="flex flex-wrap gap-2">
            <Button kind="ghost" onClick={onCopyVisible}>
              <Copy size={13} className="mr-1" /> Copy visible
            </Button>
            <Button kind="ghost" onClick={onDownload}>
              <Download size={13} className="mr-1" /> Download
            </Button>
          </div>
        ) : null}
      </div>

      <div className="lg-toolbar__row lg-toolbar__nav">
        <div className="lg-nav" role="group" aria-label="Navigate entries">
          <Button kind="ghost" onClick={onTop}>
            Top
          </Button>
          <Button kind="ghost" onClick={onBottom}>
            Bottom
          </Button>
          <Button kind="ghost" onClick={onPrevProblem} disabled={problemCount === 0}>
            Prev problem
          </Button>
          <Button kind="ghost" onClick={onNextProblem} disabled={problemCount === 0}>
            Next problem
          </Button>
          {hasQuery ? (
            <>
              <Button kind="ghost" onClick={onPrevMatch} disabled={matchCount === 0}>
                Prev match
              </Button>
              <Button kind="ghost" onClick={onNextMatch} disabled={matchCount === 0}>
                Next match
              </Button>
              <span className="lg-status">
                {matchCount} match{matchCount === 1 ? '' : 'es'}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="lg-toolbar__row">
        <p className="lg-status">{statusLabel}</p>
        {problemCount > 0 ? (
          <StatusPill tone="warn">
            {problemCount} problem{problemCount === 1 ? '' : 's'}
          </StatusPill>
        ) : null}
        {active ? <StatusPill tone="neutral">{fmtBytes(active.size)}</StatusPill> : null}
        {truncated ? <StatusPill tone="warn">Truncated</StatusPill> : null}
        {active?.gz ? <StatusPill tone="neutral">gzip</StatusPill> : null}
      </div>
    </div>
  );
}
