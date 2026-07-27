import { Archive, FileText, Search } from '@/ui/icons';
import { EmptyState } from '@/ui/patterns';
import { fmtBytes, fmtDate } from '@/lib/utils';
import type { LogFile } from './types';

export function FileSidebar({
  files,
  activeName,
  filter,
  onFilter,
  onSelect,
}: {
  files: LogFile[];
  activeName: string | null;
  filter: string;
  onFilter: (v: string) => void;
  onSelect: (name: string) => void;
}) {
  const filtered = files
    .filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
    .slice()
    .sort((a, b) => b.mtime - a.mtime);

  return (
    <aside className="lg-sidebar">
      <div className="lg-sidebar__head">
        <h2>Files</h2>
        <span className="lg-status">
          {filtered.length} of {files.length}
        </span>
      </div>
      <div className="lg-sidebar__filter">
        <Search size={14} />
        <input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder="Filter files…"
          aria-label="Filter log files"
        />
      </div>
      <div className="lg-sidebar__list">
        {filtered.length ? (
          filtered.map((f) => {
            const active = f.name === activeName;
            return (
              <button
                key={f.name}
                type="button"
                className={`lg-file${active ? ' is-active' : ''}${f.gz ? ' is-gz' : ''}`}
                onClick={() => onSelect(f.name)}
                aria-current={active ? 'true' : undefined}
              >
                <div className="lg-file__main">
                  {f.gz ? <Archive size={15} /> : <FileText size={15} />}
                  <div className="min-w-0">
                    <div className="lg-file__name">{f.name}</div>
                    <div className="lg-file__meta">
                      {fmtDate(new Date(f.mtime * 1000).toISOString())}
                    </div>
                  </div>
                </div>
                <span className="lg-file__size">{fmtBytes(f.size)}</span>
              </button>
            );
          })
        ) : (
          <EmptyState title="No matching files">Try a different search term.</EmptyState>
        )}
      </div>
    </aside>
  );
}
