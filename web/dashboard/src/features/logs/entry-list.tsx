import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  defaultRangeExtractor,
  useVirtualizer,
  type Range,
} from '@tanstack/react-virtual';
import { Button, EmptyState } from '@/ui/patterns';
import {
  buildVirtualItems,
  findMatchIndexes,
  findProblemIndexes,
} from './parse-mc-log';
import type { LogEntry, VirtualLogItem } from './types';
import { EntryRow } from './entry-row';

export type EntryListHandle = {
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end' | 'auto') => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  focusList: () => void;
  getItems: () => VirtualLogItem[];
  getProblemIndexes: () => number[];
  getMatchIndexes: () => number[];
};

export const EntryList = forwardRef<
  EntryListHandle,
  {
    entries: LogEntry[];
    expandedId: number | null;
    focusedIndex: number;
    query: string;
    onExpand: (id: number | null) => void;
    onFocusIndex: (index: number) => void;
    onCopyEntry: (entry: LogEntry) => void;
    onShowAll: () => void;
    hasEntriesButFilteredOut: boolean;
  }
>(function EntryList(
  {
    entries,
    expandedId,
    focusedIndex,
    query,
    onExpand,
    onFocusIndex,
    onCopyEntry,
    onShowAll,
    hasEntriesButFilteredOut,
  },
  ref,
) {
  const parentRef = useRef<HTMLDivElement>(null);

  const { items, stickyIndexes } = useMemo(() => buildVirtualItems(entries), [entries]);
  const problemIndexes = useMemo(() => findProblemIndexes(items), [items]);
  const matchIndexes = useMemo(() => findMatchIndexes(items, query), [items, query]);

  const activeStickyIndexRef = useRef(0);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const active =
        [...stickyIndexes].reverse().find((i) => range.startIndex >= i) ?? stickyIndexes[0] ?? 0;
      activeStickyIndexRef.current = active;
      const next = new Set([active, ...defaultRangeExtractor(range)]);
      return [...next].sort((a, b) => a - b);
    },
    [stickyIndexes],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const item = items[i];
      if (!item) return 56;
      if (item.kind === 'header') return 32;
      if (item.kind === 'entry' && expandedId === item.entry.id) return 220;
      return 56;
    },
    gap: 6,
    overscan: 16,
    rangeExtractor,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [expandedId, items.length, virtualizer]);

  const didInitScroll = useRef(false);
  useEffect(() => {
    didInitScroll.current = false;
  }, [entries]);

  useEffect(() => {
    if (didInitScroll.current || !items.length) return;
    didInitScroll.current = true;
    const firstProblem = problemIndexes[0];
    if (firstProblem != null) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(firstProblem, { align: 'center' });
        onFocusIndex(firstProblem);
      });
    }
  }, [items, problemIndexes, virtualizer, onFocusIndex]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index, align = 'center') => {
        virtualizer.scrollToIndex(index, { align });
        onFocusIndex(index);
      },
      scrollToTop: () => {
        virtualizer.scrollToOffset(0);
        onFocusIndex(0);
      },
      scrollToBottom: () => {
        const last = Math.max(0, items.length - 1);
        virtualizer.scrollToIndex(last, { align: 'end' });
        onFocusIndex(last);
      },
      focusList: () => parentRef.current?.focus(),
      getItems: () => items,
      getProblemIndexes: () => problemIndexes,
      getMatchIndexes: () => matchIndexes,
    }),
    [virtualizer, items, problemIndexes, matchIndexes, onFocusIndex],
  );

  if (!entries.length) {
    if (hasEntriesButFilteredOut) {
      return (
        <div className="lg-empty-cta">
          <EmptyState title="No warnings or errors in this tail">
            This filter hides INFO/DEBUG noise so problems stand out. Widen the levels if you need the
            full story.
          </EmptyState>
          <Button kind="default" onClick={onShowAll}>
            Show all levels
          </Button>
        </div>
      );
    }
    return <EmptyState title="No log entries">This tail is empty.</EmptyState>;
  }

  const activeSticky = activeStickyIndexRef.current;

  return (
    <div
      ref={parentRef}
      className="lg-entries"
      tabIndex={0}
      role="listbox"
      aria-label="Log entries"
    >
      <div className="lg-entries__inner" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index];
          const isSticky = item.kind === 'header' && row.index === activeSticky;
          const open = item.kind === 'entry' && expandedId === item.entry.id;
          return (
            <EntryRow
              key={row.key}
              item={item}
              index={row.index}
              open={open}
              focused={focusedIndex === row.index}
              isSticky={isSticky}
              query={query}
              onFocus={() => onFocusIndex(row.index)}
              onToggle={() => {
                if (item.kind !== 'entry') return;
                const next = open ? null : item.entry.id;
                onExpand(next);
                onFocusIndex(row.index);
                requestAnimationFrame(() => {
                  virtualizer.measure();
                  virtualizer.scrollToIndex(row.index, { align: 'auto' });
                });
              }}
              onCopy={() => {
                if (item.kind === 'entry') onCopyEntry(item.entry);
              }}
              measureRef={virtualizer.measureElement}
              style={
                isSticky
                  ? { position: 'sticky', top: 0, zIndex: 2 }
                  : {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${row.start}px)`,
                    }
              }
            />
          );
        })}
      </div>
    </div>
  );
});
