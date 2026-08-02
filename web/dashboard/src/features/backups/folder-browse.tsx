/**
 * Browse host folders for backup path selection (GET /api/fs/roots + /api/fs/list).
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { isFixturePreview } from '@/app/runtime';
import { Button } from '@/ui/patterns';
import { asArray, asRecord, num, str } from '@/lib/utils';
import { FolderOpen, X } from '@/ui/icons';

type FsRoot = { path: string; label?: string; archive_count?: number };
type FsEntry = { name: string; path: string; kind?: string; archive_count?: number };
type FsListing = {
  path: string;
  breadcrumbs?: string[];
  entries?: FsEntry[];
  archive_count?: number;
  truncated?: boolean;
};

const PREVIEW_ROOTS: FsRoot[] = [
  { path: '/srv/minecraft/backups', label: 'Server backups (preview)', archive_count: 3 },
  { path: '/srv/minecraft', label: 'Server directory (preview)', archive_count: 0 },
];

async function loadBrowse(path: string | null): Promise<{ roots?: FsRoot[]; listing?: FsListing }> {
  if (isFixturePreview()) {
    if (!path) return { roots: PREVIEW_ROOTS };
    return {
      listing: {
        path,
        breadcrumbs: [path],
        entries: [
          { name: 'world-backups', path: `${path}/world-backups`, kind: 'dir', archive_count: 2 },
          { name: 'daily', path: `${path}/daily`, kind: 'dir', archive_count: 5 },
        ],
        archive_count: 0,
        truncated: false,
      },
    };
  }
  if (!path) {
    const data = asRecord(await api.fsRoots());
    return { roots: asArray<FsRoot>(data.roots) };
  }
  const data = asRecord(await api.fsList(path));
  return { listing: data as FsListing };
}

export function FolderBrowseModal({
  open,
  onClose,
  onSelect,
  title = 'Choose folder',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roots, setRoots] = useState<FsRoot[]>([]);
  const [listing, setListing] = useState<FsListing | null>(null);

  const currentPath = listing?.path ?? null;

  const load = useCallback(async (path: string | null) => {
    setLoading(true);
    setError('');
    try {
      const data = await loadBrowse(path);
      if (data.roots) {
        setRoots(data.roots);
        setListing(null);
      } else if (data.listing) {
        setListing(data.listing);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not list folder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setRoots([]);
    setListing(null);
    setError('');
    void load(null);
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const breadcrumbs = listing?.breadcrumbs ?? [];
  const entries = (listing?.entries ?? []).filter((e) => e.kind === 'dir' || !e.kind);

  function handleSelect(path: string) {
    onSelect(path);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Close" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[min(36rem,88dvh)] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 shadow-[var(--wt-shadow)]">
        <div className="flex items-center justify-between gap-3 border-b border-wt-line px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <FolderOpen size={16} className="text-wt-accent" />
            {title}
          </div>
          <button
            type="button"
            className="rounded-[var(--radius-wt)] p-1.5 text-wt-text-low hover:bg-wt-bg2 hover:text-wt-text"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {isFixturePreview() ? (
            <p className="mb-3 text-xs text-wt-text-low">
              Preview mode — sample folders only. On a live server you can browse real paths.
            </p>
          ) : null}
          {error ? <p className="mb-2 text-sm text-wt-danger">{error}</p> : null}
          {loading ? <p className="text-sm text-wt-text-low">Loading…</p> : null}

          {!listing && roots.length > 0 ? (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-wt-text-low">
                Suggested locations
              </p>
              <ul className="space-y-1">
                {roots.map((r) => (
                  <li key={r.path}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg2/40 px-3 py-2.5 text-left text-sm hover:border-wt-accent/40"
                      onClick={() => void load(r.path)}
                    >
                      <span className="min-w-0 truncate font-medium">{r.label ?? r.path}</span>
                      <span className="shrink-0 text-xs text-wt-text-low">
                        {num(r.archive_count, 0)} archives
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {listing ? (
            <>
              <nav className="mb-2 flex flex-wrap gap-1" aria-label="Path">
                {breadcrumbs.map((crumb) => {
                  const leaf = crumb.split(/[/\\]/).filter(Boolean).pop() || crumb;
                  return (
                    <button
                      key={crumb}
                      type="button"
                      className="rounded-md bg-wt-bg2 px-2 py-1 text-xs text-wt-text-mid hover:text-wt-text"
                      onClick={() => void load(crumb)}
                    >
                      {leaf}
                    </button>
                  );
                })}
              </nav>
              {num(listing.archive_count, 0) > 0 ? (
                <p className="mb-2 text-xs text-wt-text-low">
                  {listing.archive_count} backup archive
                  {listing.archive_count === 1 ? '' : 's'} in this folder
                </p>
              ) : null}
              <ul className="space-y-1">
                {entries.map((e) => (
                  <li key={e.path}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg2/40 px-3 py-2.5 text-left text-sm hover:border-wt-accent/40"
                      onClick={() => void load(e.path)}
                    >
                      <span className="min-w-0 truncate font-medium">{str(e.name)}</span>
                      {num(e.archive_count, 0) > 0 ? (
                        <span className="shrink-0 text-xs text-wt-text-low">
                          {e.archive_count} archives
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              {entries.length === 0 && !loading ? (
                <p className="text-xs text-wt-text-low">
                  No subfolders here. You can still select this folder if backups are stored here.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-wt-line px-4 py-3">
          <Button kind="default" onClick={onClose}>
            Cancel
          </Button>
          {currentPath ? (
            <Button kind="primary" onClick={() => handleSelect(currentPath)}>
              Use this folder
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
