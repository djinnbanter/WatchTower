import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { PageEnter } from '@/ui/motion';
import { EmptyState, ErrorState } from '@/ui/patterns';
import { asArray, asRecord, bool, str } from '@/lib/utils';
import { FileSidebar } from './file-sidebar';
import { LogsToolbar } from './toolbar';
import { EntryList, type EntryListHandle } from './entry-list';
import {
  buildVirtualItems,
  filterEntries,
  findMatchIndexes,
  findProblemIndexes,
  isProblemsOnly,
  levelsFromParam,
  levelsToParam,
  newestFirst,
  parseMcLog,
} from './parse-mc-log';
import type { LogFile, LogLevel, TailOpt } from './types';
import { ALL_LEVELS, PROBLEM_LEVELS, TAIL_OPTS } from './types';
import './logs.css';

function pickDefaultFile(files: LogFile[], preferred: string | null): string | null {
  if (preferred && files.some((f) => f.name === preferred)) return preferred;
  const latest = files.find((f) => f.name === 'latest.log');
  if (latest) return latest.name;
  const sorted = files.slice().sort((a, b) => b.mtime - a.mtime);
  return sorted[0]?.name ?? null;
}

function parseTail(raw: string | null | undefined): TailOpt {
  const n = Number(raw);
  if ((TAIL_OPTS as readonly number[]).includes(n)) return n as TailOpt;
  return 2000;
}

function stepIndex(list: number[], current: number, dir: 1 | -1): number | null {
  if (!list.length) return null;
  if (dir === 1) {
    const next = list.find((i) => i > current);
    return next ?? list[0];
  }
  const prev = [...list].reverse().find((i) => i < current);
  return prev ?? list[list.length - 1];
}

export function PageView({ route }: { route: RouteState }) {
  const logsQ = useQuery({ queryKey: ['logs-index'], queryFn: api.logsIndex });
  const listRef = useRef<EntryListHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fileFromUrl = route.raw.get('file');
  const [fileFilter, setFileFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(fileFromUrl);
  const [tail, setTail] = useState<TailOpt>(() => parseTail(route.raw.get('tail')));
  const [search, setSearch] = useState(() => route.raw.get('logq') ?? '');
  const [levels, setLevels] = useState<Set<LogLevel>>(() => levelsFromParam(route.raw.get('levels')));
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const focusedIndexRef = useRef(0);
  focusedIndexRef.current = focusedIndex;

  const files = useMemo(() => asArray<LogFile>(asRecord(logsQ.data).files), [logsQ.data]);

  useEffect(() => {
    if (!files.length) return;
    const next = pickDefaultFile(files, selected ?? fileFromUrl);
    if (next && next !== selected) setSelected(next);
  }, [files, fileFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = files.find((f) => f.name === selected) ?? null;

  useEffect(() => {
    if (!active?.name) return;
    navigate(
      {
        tab: 'logs',
        file: active.name,
        logq: search.trim() || null,
        levels: levelsToParam(levels) || null,
        tail: String(tail),
      },
      true,
    );
  }, [active?.name, search, levels, tail]);

  const contentQ = useQuery({
    queryKey: ['logs-content', active?.name, tail],
    queryFn: () => api.logsContent(active!.name, tail),
    enabled: !!active?.name,
  });

  const content = str(asRecord(contentQ.data).content);
  const truncated = bool(asRecord(contentQ.data).truncated);
  const parsed = useMemo(() => parseMcLog(content), [content]);

  const visible = useMemo(() => {
    const filtered = filterEntries(parsed.entries, levels, search);
    return newestFirst(filtered);
  }, [parsed.entries, levels, search]);

  const virtualMeta = useMemo(() => {
    const { items } = buildVirtualItems(visible);
    return {
      problemIndexes: findProblemIndexes(items),
      matchIndexes: findMatchIndexes(items, search),
    };
  }, [visible, search]);

  const problemsMode = isProblemsOnly(levels);
  const statusLabel = useMemo(() => {
    const loaded = parsed.lineCount;
    if (problemsMode) {
      return `${visible.length} problem${visible.length === 1 ? '' : 's'} · ${loaded.toLocaleString()} lines in tail`;
    }
    return `${visible.length} entr${visible.length === 1 ? 'y' : 'ies'} · ${loaded.toLocaleString()} lines in tail`;
  }, [visible.length, parsed.lineCount, problemsMode]);

  const jumpRelative = (list: number[], dir: 1 | -1) => {
    const next = stepIndex(list, focusedIndexRef.current, dir);
    if (next == null) return;
    listRef.current?.scrollToIndex(next, 'center');
  };

  useEffect(() => {
    if (!search.trim()) return;
    const first = virtualMeta.matchIndexes[0];
    if (first != null) {
      listRef.current?.scrollToIndex(first, 'center');
    }
  }, [search, virtualMeta.matchIndexes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (typing) return;

      const list = listRef.current;
      if (!list) return;
      const items = list.getItems();
      if (!items.length) return;

      const moveFocus = (dir: 1 | -1) => {
        let i = focusedIndexRef.current;
        for (let step = 0; step < items.length; step++) {
          i = Math.min(items.length - 1, Math.max(0, i + dir));
          if (items[i]?.kind === 'entry') {
            list.scrollToIndex(i, 'auto');
            return;
          }
          if ((dir === 1 && i === items.length - 1) || (dir === -1 && i === 0)) return;
        }
      };

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          moveFocus(1);
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(-1);
          break;
        case 'Enter': {
          e.preventDefault();
          const item = items[focusedIndexRef.current];
          if (item?.kind === 'entry') {
            setExpandedId((id) => (id === item.entry.id ? null : item.entry.id));
          }
          break;
        }
        case 'n':
          e.preventDefault();
          jumpRelative(
            search.trim() ? virtualMeta.matchIndexes : virtualMeta.problemIndexes,
            1,
          );
          break;
        case 'p':
          e.preventDefault();
          jumpRelative(
            search.trim() ? virtualMeta.matchIndexes : virtualMeta.problemIndexes,
            -1,
          );
          break;
        case 'Home':
          e.preventDefault();
          list.scrollToTop();
          break;
        case 'End':
          e.preventDefault();
          list.scrollToBottom();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search, virtualMeta]);

  const toggleLevel = (level: LogLevel) => {
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      if (next.size === 0) next.add(level);
      return next;
    });
    setExpandedId(null);
  };

  const showAll = () => {
    setLevels(new Set(ALL_LEVELS));
    setExpandedId(null);
  };

  const showProblems = () => {
    setLevels(new Set(PROBLEM_LEVELS));
    setExpandedId(null);
  };

  const copyText = (text: string) => {
    void navigator.clipboard?.writeText(text);
  };

  if (logsQ.isLoading) {
    return (
      <PageEnter className="lg-page">
        <div className="h-10 w-72 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-[28rem] animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </PageEnter>
    );
  }

  if (logsQ.isError) {
    return (
      <ErrorState title="Couldn't load log index">{(logsQ.error as Error)?.message}</ErrorState>
    );
  }

  if (!files.length) {
    return (
      <PageEnter className="lg-page">
        <EmptyState title="No log files">
          Watchtower looks in the server <code className="font-mono text-xs">logs/</code> folder for
          latest.log, debug.log, and rotated *.log.gz files.
        </EmptyState>
      </PageEnter>
    );
  }

  return (
    <PageEnter className="lg-page">
      <div className="lg-split">
        <FileSidebar
          files={files}
          activeName={active?.name ?? null}
          filter={fileFilter}
          onFilter={setFileFilter}
          onSelect={(name) => {
            setSelected(name);
            setExpandedId(null);
            setFocusedIndex(0);
          }}
        />

        <div className="lg-viewer">
          <div className="lg-viewer__head">
            <h2 className="lg-viewer__title">{active?.name ?? 'Viewer'}</h2>
            <span className="lg-status">j/k move · n/p next · / search</span>
          </div>
          <LogsToolbar
            active={active}
            truncated={truncated}
            levels={levels}
            counts={parsed.counts}
            search={search}
            tail={tail}
            statusLabel={statusLabel}
            matchCount={virtualMeta.matchIndexes.length}
            problemCount={virtualMeta.problemIndexes.length}
            searchInputRef={searchInputRef}
            onToggleLevel={toggleLevel}
            onShowAll={showAll}
            onShowProblems={showProblems}
            onSearch={(v) => {
              setSearch(v);
              setExpandedId(null);
            }}
            onTail={(t) => {
              setTail(t);
              setExpandedId(null);
            }}
            onCopyVisible={() =>
              copyText(visible.map((e) => e.lines.join('\n')).join('\n\n'))
            }
            onDownload={() => {
              if (!active) return;
              const blob = new Blob([content], { type: 'text/plain' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = active.name.replace(/\.gz$/i, '.txt');
              a.click();
            }}
            onTop={() => listRef.current?.scrollToTop()}
            onBottom={() => listRef.current?.scrollToBottom()}
            onNextProblem={() => jumpRelative(virtualMeta.problemIndexes, 1)}
            onPrevProblem={() => jumpRelative(virtualMeta.problemIndexes, -1)}
            onNextMatch={() => jumpRelative(virtualMeta.matchIndexes, 1)}
            onPrevMatch={() => jumpRelative(virtualMeta.matchIndexes, -1)}
          />
          <div className="lg-viewer__body">
            {contentQ.isLoading ? (
              <div className="m-4 h-64 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
            ) : contentQ.isError ? (
              <ErrorState title="Couldn't load log content">
                {(contentQ.error as Error)?.message}
              </ErrorState>
            ) : (
              <EntryList
                ref={listRef}
                entries={visible}
                expandedId={expandedId}
                focusedIndex={focusedIndex}
                query={search}
                onExpand={setExpandedId}
                onFocusIndex={setFocusedIndex}
                onCopyEntry={(e) => copyText(e.lines.join('\n'))}
                onShowAll={showAll}
                hasEntriesButFilteredOut={parsed.entries.length > 0 && visible.length === 0}
              />
            )}
          </div>
        </div>
      </div>
    </PageEnter>
  );
}
