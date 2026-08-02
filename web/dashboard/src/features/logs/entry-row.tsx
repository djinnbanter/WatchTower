import type { CSSProperties, ReactNode } from 'react';
import { Copy } from '@/ui/icons';
import { Button } from '@/ui/patterns';
import { highlightQuery } from './parse-mc-log';
import type { LogEntry, VirtualLogItem } from './types';

function Highlighted({ text, query }: { text: string; query: string }) {
  const parts = highlightQuery(text, query);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="lg-mark">
            {p.t}
          </mark>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  );
}

export function EntryRow({
  item,
  open,
  index,
  focused,
  isSticky,
  query,
  onToggle,
  onCopy,
  onFocus,
  style,
  measureRef,
}: {
  item: VirtualLogItem;
  open: boolean;
  index: number;
  focused: boolean;
  isSticky: boolean;
  query: string;
  onToggle: () => void;
  onCopy: () => void;
  onFocus: () => void;
  style: CSSProperties;
  measureRef: (el: HTMLDivElement | null) => void;
}) {
  if (item.kind === 'header') {
    return (
      <div
        ref={measureRef}
        data-index={index}
        className={`lg-vrow lg-vrow--header${isSticky ? ' is-sticky' : ''}`}
        style={style}
      >
        <div className="lg-header">
          <span className="lg-header__label">{item.label}</span>
          <span className="lg-header__count">
            {item.count} entr{item.count === 1 ? 'y' : 'ies'}
          </span>
        </div>
      </div>
    );
  }

  const entry = item.entry;
  const hasStack = entry.lines.length > 1;
  const msg: ReactNode = query.trim() ? (
    <Highlighted text={entry.message || entry.lines[0] || '—'} query={query} />
  ) : (
    entry.message || entry.lines[0] || '—'
  );

  return (
    <div
      ref={measureRef}
      data-index={index}
      className={`lg-vrow lg-vrow--entry is-${entry.level}${open ? ' is-open' : ''}${focused ? ' is-focused' : ''}`}
      style={style}
    >
      <div className="lg-row">
        <button
          type="button"
          className="lg-row__hit"
          onClick={() => {
            onFocus();
            onToggle();
          }}
          onFocus={onFocus}
          aria-expanded={open}
        >
          <span className="lg-row__rail" aria-hidden />
          <div className="lg-row__body">
            <div className="lg-row__meta">
              <span className="lg-row__level">{entry.level}</span>
              {entry.ts ? <span className="lg-row__ts">{entry.ts}</span> : null}
              {entry.thread ? <span className="lg-row__dim">{entry.thread}</span> : null}
              {entry.logger ? <span className="lg-row__dim">{entry.logger}</span> : null}
              {hasStack ? (
                <span className="lg-row__dim">
                  {open ? '▾' : '▸'} {entry.lines.length - 1}
                </span>
              ) : null}
            </div>
            <p className="lg-row__msg">{msg}</p>
          </div>
        </button>
        {open ? (
          <>
            <pre className="lg-row__stack">
              {query.trim() ? (
                <Highlighted text={entry.lines.join('\n')} query={query} />
              ) : (
                entry.lines.join('\n')
              )}
            </pre>
            <div className="lg-row__actions">
              <Button kind="ghost" onClick={onCopy}>
                <Copy size={13} className="mr-1" /> Copy entry
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export type { LogEntry };
