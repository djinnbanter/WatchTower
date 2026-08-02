/**
 * Local backup folder paths — browse + POST /api/backups/dirs (prod LocalFolderStep).
 * Edits the full BACKUP_DIRS list (first path is primary).
 */
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { FolderBrowseModal } from '@/features/backups/folder-browse';
import { X } from '@/ui/icons';
import { Button } from '@/ui/patterns';
import { asRecord } from '@/lib/utils';

export function parseBackupDirs(data: Record<string, unknown> | null | undefined): string[] {
  const raw = data?.backup_dirs ?? data?.backup_dir ?? '';
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeDirs(dirs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of dirs) {
    const d = raw.trim();
    if (!d || seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

function parseSavedDirsResponse(result: Record<string, unknown>, fallback: string[]): string[] {
  const saved = result.saved_dirs;
  if (Array.isArray(saved)) {
    return normalizeDirs(saved.map((s) => String(s)));
  }
  if (typeof saved === 'string' && saved.trim()) {
    return normalizeDirs(saved.split(','));
  }
  const csv = result.backup_dirs;
  if (typeof csv === 'string' && csv.trim()) {
    return normalizeDirs(csv.split(','));
  }
  return fallback;
}

export function LocalFolderSetup({
  settingsData,
  onSaved,
  compact = false,
}: {
  settingsData?: Record<string, unknown> | null;
  onSaved?: (dirs: string[]) => void;
  compact?: boolean;
}) {
  const canWrite = useCanWrite();
  const [dirs, setDirs] = useState<string[]>(() => {
    const saved = parseBackupDirs(settingsData);
    return saved.length ? saved : [''];
  });
  const [browseIndex, setBrowseIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedDirs, setSavedDirs] = useState<string[]>(() => parseBackupDirs(settingsData));

  useEffect(() => {
    const next = parseBackupDirs(settingsData);
    if (!next.length) return;
    setDirs(next);
    setSavedDirs(next);
  }, [settingsData]);

  function updateDir(index: number, value: string) {
    setDirs((prev) => prev.map((d, i) => (i === index ? value : d)));
    setError('');
  }

  function addDir() {
    setDirs((prev) => [...prev, '']);
    setError('');
  }

  function removeDir(index: number) {
    setDirs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [''];
    });
    setError('');
  }

  async function handleSave() {
    const next = normalizeDirs(dirs);
    if (!next.length) {
      setError('Add at least one folder — browse or paste a path.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = asRecord(await api.saveBackupDirs(next));
      const saved = parseSavedDirsResponse(result, next);
      setDirs(saved);
      setSavedDirs(saved);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save folders');
    } finally {
      setSaving(false);
    }
  }

  const filledCount = dirs.filter((d) => d.trim()).length;
  const canSave = canWrite && filledCount > 0 && !saving;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact ? (
        <div>
          <h3 className="text-sm font-semibold text-wt-text">Folders on this server</h3>
          <p className="mt-1 text-xs text-wt-text-low">
            Add every folder with <code className="rounded bg-wt-bg2 px-1">.zip</code> /{' '}
            <code className="rounded bg-wt-bg2 px-1">.tar.gz</code> archives — WatchTower never
            guesses the path. The first folder is primary.
          </p>
        </div>
      ) : null}

      <div className="wt-plate space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-wt-text">Backup folders</span>
          {dirs.length > 1 ? (
            <span className="text-xs text-wt-text-low">{dirs.length} paths</span>
          ) : null}
        </div>

        <ul className="space-y-2">
          {dirs.map((dir, index) => (
            <li key={`backup-dir-${index}`} className="flex gap-2">
              <label className="sr-only" htmlFor={`backup-local-path-${index}`}>
                Backup folder {index + 1}
                {index === 0 ? ' (primary)' : ''}
              </label>
              <input
                id={`backup-local-path-${index}`}
                type="text"
                value={dir}
                placeholder={index === 0 ? 'Primary folder…' : 'Another folder…'}
                onChange={(e) => updateDir(index, e.target.value)}
                className="min-w-0 flex-1 rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg2 px-3 py-2 font-mono text-sm outline-none focus:border-wt-accent"
              />
              <Button
                kind="default"
                type="button"
                disabled={!canWrite}
                title={canWrite ? undefined : VIEW_ONLY_TITLE}
                onClick={() => setBrowseIndex(index)}
              >
                Browse…
              </Button>
              {dirs.length > 1 ? (
                <Button
                  kind="ghost"
                  type="button"
                  disabled={!canWrite}
                  title={canWrite ? 'Remove folder' : VIEW_ONLY_TITLE}
                  aria-label={`Remove folder ${index + 1}`}
                  onClick={() => removeDir(index)}
                >
                  <X size={16} aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            kind="ghost"
            type="button"
            disabled={!canWrite}
            title={canWrite ? undefined : VIEW_ONLY_TITLE}
            onClick={addDir}
          >
            + Add another folder
          </Button>
        </div>

        <p className="text-xs text-wt-text-low">
          {savedDirs.length
            ? `Saved: ${savedDirs.join(' · ')}`
            : 'Browse to each backup output directory, then save.'}
        </p>
      </div>

      {error ? <p className="text-sm text-wt-danger">{error}</p> : null}

      <Button
        kind="default"
        disabled={!canSave}
        title={canWrite ? undefined : VIEW_ONLY_TITLE}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : filledCount > 1 ? 'Save folders & scan' : 'Save folder & scan'}
      </Button>
      <p className="text-xs text-wt-text-low">
        Folders save here. Stale threshold uses Save changes above.
      </p>

      <FolderBrowseModal
        open={browseIndex != null}
        onClose={() => setBrowseIndex(null)}
        onSelect={(p) => {
          if (browseIndex != null) updateDir(browseIndex, p);
          setBrowseIndex(null);
        }}
        title="Choose backup folder"
      />
    </div>
  );
}

/** Convenience: load settings once for standalone panels. */
export function LocalFolderSetupFromApi({ onSaved }: { onSaved?: (dirs: string[]) => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = asRecord(await api.settings());
        if (!cancelled) setData(s);
      } catch {
        if (!cancelled) setData({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LocalFolderSetup
      settingsData={data}
      onSaved={(dirs) => {
        setData((prev) => ({
          ...(prev ?? {}),
          backup_dirs: dirs.join(', '),
          backup_dir: dirs[0] ?? '',
        }));
        onSaved?.(dirs);
      }}
    />
  );
}
